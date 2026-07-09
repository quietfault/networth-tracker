import { useEffect, useState, type FormEvent } from 'react'
import { getSettings, upsertSettings } from '../lib/settings'
import { getErrorMessage } from '../lib/errors'

export function Settings() {
  const [baseCurrency, setBaseCurrency] = useState('USD')
  const [etherscanApiKey, setEtherscanApiKey] = useState('')
  const [unisatApiKey, setUnisatApiKey] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const s = await getSettings()
        if (s) {
          setBaseCurrency(s.baseCurrency)
          setEtherscanApiKey(s.etherscanApiKey ?? '')
          setUnisatApiKey(s.unisatApiKey ?? '')
        }
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      await upsertSettings({
        baseCurrency,
        etherscanApiKey: etherscanApiKey || null,
        unisatApiKey: unisatApiKey || null,
      })
      setSaved(true)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p>Загрузка...</p>

  return (
    <div style={{ maxWidth: 420 }}>
      <h1>Настройки</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          Базовая валюта
          <select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)} style={{ display: 'block', width: '100%' }}>
            <option value="USD">USD</option>
            <option value="RUB">RUB</option>
          </select>
        </label>
        <label>
          Etherscan API key
          <input
            value={etherscanApiKey}
            onChange={(e) => setEtherscanApiKey(e.target.value)}
            placeholder="Нужен для ETH и EVM-сетей (etherscan.io/apis)"
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        <label>
          UniSat API key
          <input
            value={unisatApiKey}
            onChange={(e) => setUnisatApiKey(e.target.value)}
            placeholder="Нужен для баланса Рун (developer.unisat.io)"
            style={{ display: 'block', width: '100%' }}
          />
        </label>
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {saved && <p style={{ color: 'seagreen' }}>Сохранено</p>}
        <button type="submit" disabled={saving}>
          Сохранить
        </button>
      </form>
    </div>
  )
}
