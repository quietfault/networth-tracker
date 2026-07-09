import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWallets } from '../lib/wallets'
import { listSnapshots, createSnapshot } from '../lib/snapshots'
import { getSettings } from '../lib/settings'
import { fetchEvmBalances } from '../lib/api/etherscan'
import { fetchBtcBalance } from '../lib/api/blockchair'
import { fetchSolBalance } from '../lib/api/solana'
import { fetchRuneBalances } from '../lib/api/unisat'
import { fetchTokenPrices } from '../lib/api/coingecko'
import { getErrorMessage } from '../lib/errors'
import { categoryTotals } from '../lib/valuation'
import { emptyAssets } from '../types/snapshot'
import type { Bank, CryptoHolding, InventoryItem, PhysicalAsset, SnapshotAssets, Token } from '../types/snapshot'

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

export function SnapshotNew() {
  const navigate = useNavigate()

  const [period, setPeriod] = useState(currentPeriod())
  const [usdRub, setUsdRub] = useState<string>('')
  const [assets, setAssets] = useState<SnapshotAssets>(emptyAssets())

  const [etherscanKey, setEtherscanKey] = useState<string | null>(null)
  const [unisatKey, setUnisatKey] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshErrors, setRefreshErrors] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void loadInitial()
  }, [])

  async function loadInitial() {
    setLoading(true)
    setError(null)
    try {
      const [w, snapshots, settings] = await Promise.all([
        listWallets(),
        listSnapshots(),
        getSettings(),
      ])
      setEtherscanKey(settings?.etherscanApiKey ?? null)
      setUnisatKey(settings?.unisatApiKey ?? null)

      const previous = snapshots[snapshots.length - 1]

      const walletRows: CryptoHolding[] = w.map((wallet) => {
        const prevRow = previous?.assets.crypto.find(
          (c) => c.type === 'wallet' && c.address === wallet.address,
        )
        return {
          type: 'wallet',
          label: wallet.label,
          address: wallet.address,
          chain: wallet.chain,
          tokens: prevRow ? prevRow.tokens : [],
        }
      })
      const cexRows: CryptoHolding[] = previous?.assets.crypto.filter((c) => c.type === 'cex') ?? []

      setAssets({
        banks: previous ? structuredClone(previous.assets.banks) : [],
        crypto: [...walletRows, ...cexRows],
        inventory: previous ? structuredClone(previous.assets.inventory) : [],
        physical: previous ? structuredClone(previous.assets.physical) : [],
      })
      setUsdRub(previous?.usdRub != null ? String(previous.usdRub) : '')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  async function handleRefreshBalances() {
    setRefreshing(true)
    setRefreshErrors([])
    const errors: string[] = []

    const updatedCrypto = await Promise.all(
      assets.crypto.map(async (holding) => {
        if (holding.type !== 'wallet') return holding
        try {
          const tokens: Token[] = []

          if (holding.chain === 'ethereum') {
            const chains = await fetchEvmBalances(holding.address!, etherscanKey ?? '')
            const bySymbol = new Map<string, number>()
            for (const c of chains) bySymbol.set(c.symbol, (bySymbol.get(c.symbol) ?? 0) + c.amount)
            for (const [symbol, amount] of bySymbol) tokens.push({ symbol, amount, priceUSD: null })
          } else if (holding.chain === 'bitcoin') {
            const btc = await fetchBtcBalance(holding.address!)
            tokens.push({ symbol: 'BTC', amount: btc, priceUSD: null })
            if (unisatKey) {
              const runes = await fetchRuneBalances(holding.address!, unisatKey)
              for (const r of runes) tokens.push({ symbol: r.symbol, amount: r.amount, priceUSD: null })
            }
          } else if (holding.chain === 'solana') {
            const sol = await fetchSolBalance(holding.address!)
            tokens.push({ symbol: 'SOL', amount: sol, priceUSD: null })
          }

          return { ...holding, tokens }
        } catch (e) {
          errors.push(`${holding.label}: ${getErrorMessage(e)}`)
          return holding
        }
      }),
    )

    const allSymbols = updatedCrypto.flatMap((h) => h.tokens.map((t) => t.symbol))
    let prices: Record<string, number> = {}
    try {
      prices = await fetchTokenPrices(allSymbols)
    } catch (e) {
      errors.push(`CoinGecko: ${getErrorMessage(e)}`)
    }

    const pricedCrypto = updatedCrypto.map((holding) => ({
      ...holding,
      tokens: holding.tokens.map((t) => ({ ...t, priceUSD: prices[t.symbol] ?? t.priceUSD })),
    }))

    setAssets((prev) => ({ ...prev, crypto: pricedCrypto }))
    setRefreshErrors(errors)
    setRefreshing(false)
  }

  function updateBank(index: number, patch: Partial<Bank>) {
    setAssets((prev) => ({
      ...prev,
      banks: prev.banks.map((b, i) => (i === index ? { ...b, ...patch } : b)),
    }))
  }
  function addBank() {
    setAssets((prev) => ({ ...prev, banks: [...prev.banks, { name: '', amount: 0, currency: 'USD' }] }))
  }
  function removeBank(index: number) {
    setAssets((prev) => ({ ...prev, banks: prev.banks.filter((_, i) => i !== index) }))
  }

  function updateInventory(index: number, patch: Partial<InventoryItem>) {
    setAssets((prev) => ({
      ...prev,
      inventory: prev.inventory.map((it, i) => (i === index ? { ...it, ...patch } : it)),
    }))
  }
  function addInventory() {
    setAssets((prev) => ({
      ...prev,
      inventory: [...prev.inventory, { name: '', qty: 1, pricePerUnit: 0, currency: 'USD' }],
    }))
  }
  function removeInventory(index: number) {
    setAssets((prev) => ({ ...prev, inventory: prev.inventory.filter((_, i) => i !== index) }))
  }

  function updatePhysical(index: number, patch: Partial<PhysicalAsset>) {
    setAssets((prev) => ({
      ...prev,
      physical: prev.physical.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }))
  }
  function addPhysical() {
    setAssets((prev) => ({ ...prev, physical: [...prev.physical, { name: '', value: 0, currency: 'USD' }] }))
  }
  function removePhysical(index: number) {
    setAssets((prev) => ({ ...prev, physical: prev.physical.filter((_, i) => i !== index) }))
  }

  function addCexRow() {
    setAssets((prev) => ({
      ...prev,
      crypto: [...prev.crypto, { type: 'cex', label: '', tokens: [] }],
    }))
  }
  function removeCryptoRow(index: number) {
    setAssets((prev) => ({ ...prev, crypto: prev.crypto.filter((_, i) => i !== index) }))
  }
  function updateCryptoLabel(index: number, label: string) {
    setAssets((prev) => ({
      ...prev,
      crypto: prev.crypto.map((c, i) => (i === index ? { ...c, label } : c)),
    }))
  }
  function addToken(rowIndex: number) {
    setAssets((prev) => ({
      ...prev,
      crypto: prev.crypto.map((c, i) =>
        i === rowIndex ? { ...c, tokens: [...c.tokens, { symbol: '', amount: 0, priceUSD: null }] } : c,
      ),
    }))
  }
  function updateToken(rowIndex: number, tokenIndex: number, patch: Partial<Token>) {
    setAssets((prev) => ({
      ...prev,
      crypto: prev.crypto.map((c, i) =>
        i === rowIndex
          ? { ...c, tokens: c.tokens.map((t, ti) => (ti === tokenIndex ? { ...t, ...patch } : t)) }
          : c,
      ),
    }))
  }
  function removeToken(rowIndex: number, tokenIndex: number) {
    setAssets((prev) => ({
      ...prev,
      crypto: prev.crypto.map((c, i) =>
        i === rowIndex ? { ...c, tokens: c.tokens.filter((_, ti) => ti !== tokenIndex) } : c,
      ),
    }))
  }

  const parsedUsdRub = usdRub ? Number(usdRub) : null
  const totalUsd = categoryTotals(assets, parsedUsdRub).total

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const snapshot = await createSnapshot({
        period,
        snapshotDate: `${period}-01`,
        assets,
        usdRub: parsedUsdRub,
        totalUsd,
      })
      navigate(`/snapshot/${snapshot.id}`)
    } catch (e) {
      const message = getErrorMessage(e)
      setError(
        message.includes('duplicate key') || message.includes('unique')
          ? `Снимок за период ${period} уже существует`
          : message,
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p>Загрузка...</p>

  return (
    <div>
      <h1>Новый снимок</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <label>
            Период{' '}
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
          </label>
          <label>
            Курс USD/RUB{' '}
            <input
              type="number"
              step="any"
              value={usdRub}
              onChange={(e) => setUsdRub(e.target.value)}
              placeholder="например, 92.5"
            />
          </label>
          <button type="button" onClick={handleRefreshBalances} disabled={refreshing}>
            {refreshing ? 'Обновление...' : 'Обновить балансы'}
          </button>
        </div>

        {refreshErrors.length > 0 && (
          <ul style={{ color: 'crimson' }}>
            {refreshErrors.map((msg, i) => (
              <li key={i}>{msg}</li>
            ))}
          </ul>
        )}

        <section>
          <h2>Банки</h2>
          {assets.banks.map((b, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input placeholder="Название" value={b.name} onChange={(e) => updateBank(i, { name: e.target.value })} />
              <input
                type="number"
                step="any"
                placeholder="Сумма"
                value={b.amount}
                onChange={(e) => updateBank(i, { amount: Number(e.target.value) })}
              />
              <select value={b.currency} onChange={(e) => updateBank(i, { currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="RUB">RUB</option>
              </select>
              <button type="button" onClick={() => removeBank(i)}>
                Удалить
              </button>
            </div>
          ))}
          <button type="button" onClick={addBank}>
            + Банк
          </button>
        </section>

        <section>
          <h2>Крипта</h2>
          {assets.crypto.map((holding, i) => (
            <div key={i} style={{ border: '1px solid #333', padding: 10, marginBottom: 10 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {holding.type === 'wallet' ? (
                  <strong>
                    {holding.label} ({holding.chain})
                  </strong>
                ) : (
                  <input
                    placeholder="Название биржи (например, Binance)"
                    value={holding.label}
                    onChange={(e) => updateCryptoLabel(i, e.target.value)}
                  />
                )}
                <button type="button" onClick={() => removeCryptoRow(i)}>
                  Удалить строку
                </button>
              </div>
              {holding.tokens.map((t, ti) => (
                <div key={ti} style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  <input
                    placeholder="Symbol"
                    value={t.symbol}
                    onChange={(e) => updateToken(i, ti, { symbol: e.target.value.toUpperCase() })}
                    style={{ width: 80 }}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Amount"
                    value={t.amount}
                    onChange={(e) => updateToken(i, ti, { amount: Number(e.target.value) })}
                  />
                  <input
                    type="number"
                    step="any"
                    placeholder="Price USD"
                    value={t.priceUSD ?? ''}
                    onChange={(e) => updateToken(i, ti, { priceUSD: e.target.value ? Number(e.target.value) : null })}
                  />
                  <button type="button" onClick={() => removeToken(i, ti)}>
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => addToken(i)} style={{ marginTop: 6 }}>
                + Токен
              </button>
            </div>
          ))}
          <button type="button" onClick={addCexRow}>
            + Биржа (CEX)
          </button>
        </section>

        <section>
          <h2>Инвентарь</h2>
          {assets.inventory.map((it, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                placeholder="Название"
                value={it.name}
                onChange={(e) => updateInventory(i, { name: e.target.value })}
              />
              <input
                type="number"
                step="any"
                placeholder="Кол-во"
                value={it.qty}
                onChange={(e) => updateInventory(i, { qty: Number(e.target.value) })}
              />
              <input
                type="number"
                step="any"
                placeholder="Цена за штуку"
                value={it.pricePerUnit}
                onChange={(e) => updateInventory(i, { pricePerUnit: Number(e.target.value) })}
              />
              <select value={it.currency} onChange={(e) => updateInventory(i, { currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="RUB">RUB</option>
              </select>
              <button type="button" onClick={() => removeInventory(i)}>
                Удалить
              </button>
            </div>
          ))}
          <button type="button" onClick={addInventory}>
            + Товар
          </button>
        </section>

        <section>
          <h2>Физические активы</h2>
          {assets.physical.map((p, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input
                placeholder="Название"
                value={p.name}
                onChange={(e) => updatePhysical(i, { name: e.target.value })}
              />
              <input
                type="number"
                step="any"
                placeholder="Стоимость"
                value={p.value}
                onChange={(e) => updatePhysical(i, { value: Number(e.target.value) })}
              />
              <select value={p.currency} onChange={(e) => updatePhysical(i, { currency: e.target.value })}>
                <option value="USD">USD</option>
                <option value="RUB">RUB</option>
              </select>
              <button type="button" onClick={() => removePhysical(i)}>
                Удалить
              </button>
            </div>
          ))}
          <button type="button" onClick={addPhysical}>
            + Актив
          </button>
        </section>

        <div style={{ fontSize: 20, fontWeight: 'bold' }}>Итого: ${totalUsd.toFixed(2)}</div>

        {error && <p style={{ color: 'crimson' }}>{error}</p>}

        <button type="submit" disabled={submitting} style={{ alignSelf: 'flex-start' }}>
          Сохранить снимок
        </button>
      </form>
    </div>
  )
}
