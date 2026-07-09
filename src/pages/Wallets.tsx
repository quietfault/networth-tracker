import { useEffect, useRef, useState, type FormEvent } from 'react'
import { addWallet, deleteWallet, listWallets } from '../lib/wallets'
import { getSettings } from '../lib/settings'
import { fetchEvmBalances } from '../lib/api/etherscan'
import { fetchBtcBalance } from '../lib/api/blockchair'
import { fetchSolBalance } from '../lib/api/solana'
import { fetchRuneBalances } from '../lib/api/unisat'
import { fetchTokenPrices } from '../lib/api/coingecko'
import { getErrorMessage } from '../lib/errors'
import type { Chain, Wallet } from '../types/snapshot'

interface BalanceEntry {
  label: string
  amount: number | null
  usd: number | null
  error?: string
}

interface BalanceState {
  loading: boolean
  error: string | null
  entries: BalanceEntry[]
}

const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: 'Ethereum (+EVM)',
  bitcoin: 'Bitcoin',
  solana: 'Solana',
}

const PRICED_SYMBOLS = ['ETH', 'BTC', 'SOL', 'BNB', 'MATIC', 'AVAX']

export function Wallets() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [chain, setChain] = useState<Chain>('ethereum')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [etherscanKey, setEtherscanKey] = useState<string | null>(null)
  const [unisatKey, setUnisatKey] = useState<string | null>(null)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [balances, setBalances] = useState<Record<string, BalanceState>>({})
  const fetchedIds = useRef(new Set<string>())

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [w, settings, priceMap] = await Promise.all([
        listWallets(),
        getSettings(),
        fetchTokenPrices(PRICED_SYMBOLS),
      ])
      setWallets(w)
      setEtherscanKey(settings?.etherscanApiKey ?? null)
      setUnisatKey(settings?.unisatApiKey ?? null)
      setPrices(priceMap)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (loading) return
    for (const w of wallets) {
      if (fetchedIds.current.has(w.id)) continue
      fetchedIds.current.add(w.id)
      void loadBalance(w)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallets, loading])

  async function loadBalance(w: Wallet) {
    setBalances((prev) => ({ ...prev, [w.id]: { loading: true, error: null, entries: [] } }))
    try {
      let entries: BalanceEntry[] = []

      if (w.chain === 'ethereum') {
        const chains = await fetchEvmBalances(w.address, etherscanKey ?? '')
        entries = chains.map((c) => ({
          label: `${c.symbol} (${c.chainName})`,
          amount: c.amount,
          usd: prices[c.symbol] ? c.amount * prices[c.symbol] : null,
        }))
      } else if (w.chain === 'bitcoin') {
        // BTC-native and Runes come from independent APIs; one failing
        // (e.g. Blockchair's daily rate limit) shouldn't hide the other.
        try {
          const btc = await fetchBtcBalance(w.address)
          entries.push({ label: 'BTC', amount: btc, usd: prices.BTC ? btc * prices.BTC : null })
        } catch (e) {
          entries.push({ label: 'BTC', amount: null, usd: null, error: getErrorMessage(e) })
        }

        if (unisatKey) {
          try {
            const runes = await fetchRuneBalances(w.address, unisatKey)
            entries.push(...runes.map((r) => ({ label: r.symbol, amount: r.amount, usd: null })))
          } catch (e) {
            entries.push({ label: 'Runes', amount: null, usd: null, error: getErrorMessage(e) })
          }
        }
      } else {
        const sol = await fetchSolBalance(w.address)
        entries.push({ label: 'SOL', amount: sol, usd: prices.SOL ? sol * prices.SOL : null })
      }

      setBalances((prev) => ({ ...prev, [w.id]: { loading: false, error: null, entries } }))
    } catch (e) {
      setBalances((prev) => ({
        ...prev,
        [w.id]: { loading: false, error: getErrorMessage(e), entries: [] },
      }))
    }
  }

  async function handleAdd(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const w = await addWallet({ label, chain, address })
      setWallets((prev) => [...prev, w])
      setLabel('')
      setAddress('')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(id: string) {
    await deleteWallet(id)
    setWallets((prev) => prev.filter((w) => w.id !== id))
    setBalances((prev) => {
      const { [id]: _removed, ...rest } = prev
      return rest
    })
  }

  return (
    <div>
      <h1>Кошельки</h1>

      <form onSubmit={handleAdd} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
        <input
          placeholder="Label (например, MetaMask main)"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          required
        />
        <select value={chain} onChange={(e) => setChain(e.target.value as Chain)}>
          <option value="ethereum">Ethereum</option>
          <option value="bitcoin">Bitcoin</option>
          <option value="solana">Solana</option>
        </select>
        <input
          placeholder="Адрес"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
          style={{ flex: 1 }}
        />
        <button type="submit" disabled={submitting}>
          Добавить
        </button>
      </form>

      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {loading && <p>Загрузка...</p>}

      {!loading && wallets.length === 0 && <p>Кошельков пока нет.</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <tbody>
          {wallets.map((w) => {
            const b = balances[w.id]
            return (
              <tr key={w.id} style={{ borderBottom: '1px solid #333' }}>
                <td style={{ padding: '8px 0', verticalAlign: 'top' }}>{w.label}</td>
                <td style={{ verticalAlign: 'top' }}>{CHAIN_LABELS[w.chain]}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12, verticalAlign: 'top' }}>{w.address}</td>
                <td style={{ verticalAlign: 'top' }}>
                  {b?.loading ? (
                    'Загрузка...'
                  ) : b?.error ? (
                    <span style={{ color: 'crimson' }}>{b.error}</span>
                  ) : b && b.entries.length > 0 ? (
                    <div>
                      {b.entries.map((entry, i) => (
                        <div key={i}>
                          {entry.error ? (
                            <span style={{ color: 'crimson' }}>
                              {entry.label}: {entry.error}
                            </span>
                          ) : (
                            <>
                              {entry.amount} {entry.label}
                              {entry.usd != null && ` (~$${entry.usd.toFixed(2)})`}
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : b ? (
                    <span style={{ opacity: 0.6 }}>нет средств</span>
                  ) : null}
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <button onClick={() => loadBalance(w)}>Обновить</button>
                </td>
                <td style={{ verticalAlign: 'top' }}>
                  <button onClick={() => handleDelete(w.id)}>Удалить</button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
