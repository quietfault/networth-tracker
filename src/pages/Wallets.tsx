import { useEffect, useRef, useState, type FormEvent } from 'react'
import { addWallet, deleteWallet, listWallets } from '../lib/wallets'
import { getSettings } from '../lib/settings'
import { applyPrices, fetchPrices, fetchWalletAssets, type ApiKeys, type WalletAsset } from '../lib/walletAssets'
import { formatAmount, formatUsd } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import type { Chain, Wallet } from '../types/snapshot'

interface BalanceState {
  loading: boolean
  /** Set only when nothing could be loaded at all. */
  error: string | null
  assets: WalletAsset[]
  /** Sources that failed while others succeeded (rate limits, missing keys). */
  warnings: string[]
}

const CHAIN_LABELS: Record<Chain, string> = {
  ethereum: 'Ethereum (+EVM)',
  bitcoin: 'Bitcoin',
  solana: 'Solana',
}

export function Wallets() {
  const [wallets, setWallets] = useState<Wallet[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [label, setLabel] = useState('')
  const [chain, setChain] = useState<Chain>('ethereum')
  const [address, setAddress] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const [keys, setKeys] = useState<ApiKeys>({ etherscan: null, unisat: null })
  const [balances, setBalances] = useState<Record<string, BalanceState>>({})
  const fetchedIds = useRef(new Set<string>())

  useEffect(() => {
    void loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setError(null)
    try {
      const [w, settings] = await Promise.all([listWallets(), getSettings()])
      setWallets(w)
      setKeys({
        etherscan: settings?.etherscanApiKey ?? null,
        unisat: settings?.unisatApiKey ?? null,
      })
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
    setBalances((prev) => ({
      ...prev,
      [w.id]: { loading: true, error: null, assets: [], warnings: [] },
    }))
    try {
      const { assets, errors } = await fetchWalletAssets(w, keys)
      const { prices, errors: priceErrors } = await fetchPrices(assets)
      setBalances((prev) => ({
        ...prev,
        [w.id]: {
          loading: false,
          error: null,
          assets: applyPrices(assets, prices),
          warnings: [...errors, ...priceErrors],
        },
      }))
    } catch (e) {
      setBalances((prev) => ({
        ...prev,
        [w.id]: { loading: false, error: getErrorMessage(e), assets: [], warnings: [] },
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
                  {b?.loading && 'Загрузка...'}
                  {b?.error && <div style={{ color: 'crimson' }}>{b.error}</div>}
                  {b?.assets.map((asset, i) => (
                    <div key={i}>
                      {formatAmount(asset.amount)} {asset.symbol}
                      {asset.priceUSD != null && ` (~${formatUsd(asset.amount * asset.priceUSD)})`}
                      {asset.note && asset.note !== asset.symbol && (
                        <span style={{ opacity: 0.5, fontSize: 12 }}> · {asset.note}</span>
                      )}
                    </div>
                  ))}
                  {b && !b.loading && !b.error && b.assets.length === 0 && b.warnings.length === 0 && (
                    <span style={{ opacity: 0.6 }}>нет средств</span>
                  )}
                  {b?.warnings.map((warning, i) => (
                    <div key={i} style={{ color: 'goldenrod', fontSize: 12 }}>
                      {warning}
                    </div>
                  ))}
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
