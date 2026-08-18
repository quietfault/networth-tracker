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

  if (loading) return <p className="muted">Загрузка...</p>

  return (
    <div className="stack" style={{ maxWidth: 520 }}>
      <h1>Настройки</h1>

      <section className="card">
        <form onSubmit={handleSubmit} className="stack" style={{ gap: 16 }}>
          <label className="stack" style={{ gap: 6 }}>
            <span className="label">Базовая валюта</span>
            <select value={baseCurrency} onChange={(e) => setBaseCurrency(e.target.value)}>
              <option value="USD">USD</option>
              <option value="RUB">RUB</option>
            </select>
          </label>

          <label className="stack" style={{ gap: 6 }}>
            <span className="label">Etherscan API key</span>
            <input
              value={etherscanApiKey}
              onChange={(e) => setEtherscanApiKey(e.target.value)}
              placeholder="etherscan.io/apis"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="warn">Балансы ETH и остальных EVM-сетей. Один ключ на все сети.</span>
          </label>

          <label className="stack" style={{ gap: 6 }}>
            <span className="label">UniSat API key</span>
            <input
              value={unisatApiKey}
              onChange={(e) => setUnisatApiKey(e.target.value)}
              placeholder="developer.unisat.io"
              autoComplete="off"
              spellCheck={false}
            />
            <span className="warn">Балансы Рун на BTC-адресах. Без ключа Руны не подтянутся.</span>
          </label>

          {error && <p className="error">{error}</p>}
          {saved && <p className="ok">Сохранено</p>}

          <button type="submit" className="btn-primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
            Сохранить
          </button>
        </form>
      </section>

      <p className="warn">
        Ключи лежат в таблице <span className="mono">settings</span> и видны только тебе — доступ
        закрыт политиками RLS.
      </p>
    </div>
  )
}
