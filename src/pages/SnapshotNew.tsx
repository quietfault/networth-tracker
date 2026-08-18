import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { listWallets } from '../lib/wallets'
import { listSnapshots, createSnapshot } from '../lib/snapshots'
import { getSettings } from '../lib/settings'
import {
  applyPrices,
  fetchPrices,
  fetchWalletAssets,
  type ApiKeys,
  mergeBySymbol,
  type WalletAsset,
} from '../lib/walletAssets'
import { getErrorMessage } from '../lib/errors'
import { categoryTotals } from '../lib/valuation'
import { formatUsd } from '../lib/format'
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

  const [keys, setKeys] = useState<ApiKeys>({ etherscan: null, unisat: null })

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
      setKeys({
        etherscan: settings?.etherscanApiKey ?? null,
        unisat: settings?.unisatApiKey ?? null,
      })

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

    // Sequential on purpose: Etherscan's free tier counts calls per second
    // across the whole key, so parallel wallets would rate-limit each other.
    const fetched: (WalletAsset[] | null)[] = []
    for (const holding of assets.crypto) {
      if (holding.type !== 'wallet' || !holding.address || !holding.chain) {
        fetched.push(null)
        continue
      }
      try {
        const result = await fetchWalletAssets(
          { chain: holding.chain, address: holding.address },
          keys,
        )
        errors.push(...result.errors.map((message) => `${holding.label}: ${message}`))
        fetched.push(result.assets)
      } catch (e) {
        errors.push(`${holding.label}: ${getErrorMessage(e)}`)
        fetched.push(null)
      }
    }

    const { prices, errors: priceErrors } = await fetchPrices(fetched.flatMap((a) => a ?? []))
    errors.push(...priceErrors)

    const updatedCrypto = assets.crypto.map((holding, i) => {
      const walletAssets = fetched[i]
      if (!walletAssets) return holding
      return {
        ...holding,
        tokens: mergeBySymbol(applyPrices(walletAssets, prices)).map<Token>((a) => ({
          symbol: a.symbol,
          amount: a.amount,
          priceUSD: a.priceUSD,
        })),
      }
    })

    setAssets((prev) => ({ ...prev, crypto: updatedCrypto }))
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

  if (loading) return <p className="muted">Загрузка...</p>

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Новый срез</h1>
        <span className="label">прошлый срез подставлен, меняются только суммы</span>
      </div>

      <form onSubmit={handleSubmit} className="stack">
        <section className="card">
          <div className="row">
            <label className="row" style={{ gap: 8 }}>
              <span className="label">Период</span>
              <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} required />
            </label>
            <label className="row" style={{ gap: 8 }}>
              <span className="label">Курс USD/RUB</span>
              <input
                type="number"
                step="any"
                value={usdRub}
                onChange={(e) => setUsdRub(e.target.value)}
                placeholder="92.5"
                style={{ width: 110 }}
              />
            </label>
            <button type="button" onClick={handleRefreshBalances} disabled={refreshing} style={{ marginLeft: 'auto' }}>
              {refreshing ? 'Обновление...' : 'Обновить балансы'}
            </button>
          </div>

          {refreshErrors.length > 0 && (
            <ul className="bullets" style={{ marginTop: 14 }}>
              {refreshErrors.map((msg, i) => (
                <li key={i} className="warn">
                  {msg}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Банки</h2>
            <button type="button" className="btn-quiet" onClick={addBank}>
              + Банк
            </button>
          </div>
          {assets.banks.length === 0 && <p className="muted">Пусто.</p>}
          {assets.banks.map((b, i) => (
            <div key={i} className="row" style={{ marginBottom: 8 }}>
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
              <button type="button" className="btn-quiet" onClick={() => removeBank(i)}>
                Удалить
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Крипта</h2>
            <button type="button" className="btn-quiet" onClick={addCexRow}>
              + Биржа (CEX)
            </button>
          </div>
          {assets.crypto.length === 0 && <p className="muted">Пусто.</p>}
          <div className="stack" style={{ gap: 14 }}>
            {assets.crypto.map((holding, i) => (
              <div key={i}>
                <div className="row">
                  {holding.type === 'wallet' ? (
                    <strong>
                      {holding.label} <span className="muted">· {holding.chain}</span>
                    </strong>
                  ) : (
                    <input
                      placeholder="Название биржи (например, Binance)"
                      value={holding.label}
                      onChange={(e) => updateCryptoLabel(i, e.target.value)}
                    />
                  )}
                  <button type="button" className="btn-quiet" onClick={() => addToken(i)}>
                    + Токен
                  </button>
                  <button type="button" className="btn-quiet" onClick={() => removeCryptoRow(i)}>
                    Удалить строку
                  </button>
                </div>
                {holding.tokens.map((t, ti) => (
                  <div key={ti} className="row" style={{ marginTop: 6 }}>
                    <input
                      placeholder="Symbol"
                      value={t.symbol}
                      onChange={(e) => updateToken(i, ti, { symbol: e.target.value.toUpperCase() })}
                      className="mono"
                      style={{ width: 120 }}
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Количество"
                      value={t.amount}
                      onChange={(e) => updateToken(i, ti, { amount: Number(e.target.value) })}
                    />
                    <input
                      type="number"
                      step="any"
                      placeholder="Цена, $"
                      value={t.priceUSD ?? ''}
                      onChange={(e) => updateToken(i, ti, { priceUSD: e.target.value ? Number(e.target.value) : null })}
                    />
                    <button type="button" className="btn-quiet" onClick={() => removeToken(i, ti)}>
                      ×
                    </button>
                  </div>
                ))}
                {i < assets.crypto.length - 1 && <div className="divider" />}
              </div>
            ))}
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Инвентарь</h2>
            <button type="button" className="btn-quiet" onClick={addInventory}>
              + Товар
            </button>
          </div>
          {assets.inventory.length === 0 && <p className="muted">Пусто.</p>}
          {assets.inventory.map((it, i) => (
            <div key={i} className="row" style={{ marginBottom: 8 }}>
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
                style={{ width: 100 }}
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
              <button type="button" className="btn-quiet" onClick={() => removeInventory(i)}>
                Удалить
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Физические активы</h2>
            <button type="button" className="btn-quiet" onClick={addPhysical}>
              + Актив
            </button>
          </div>
          {assets.physical.length === 0 && <p className="muted">Пусто.</p>}
          {assets.physical.map((p, i) => (
            <div key={i} className="row" style={{ marginBottom: 8 }}>
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
              <button type="button" className="btn-quiet" onClick={() => removePhysical(i)}>
                Удалить
              </button>
            </div>
          ))}
        </section>

        <section className="card">
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <div>
              <div className="label">Итого</div>
              <div className="total-sub">{formatUsd(totalUsd)}</div>
            </div>
            <button type="submit" className="btn-primary" disabled={submitting}>
              Сохранить срез
            </button>
          </div>
          {error && <p className="error" style={{ marginTop: 12 }}>{error}</p>}
        </section>
      </form>
    </div>
  )
}
