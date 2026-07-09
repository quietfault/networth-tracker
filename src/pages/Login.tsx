import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Login() {
  const { session, signIn, signUp } = useAuth()
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  if (session) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setSubmitting(true)

    const result = mode === 'signin' ? await signIn(email, password) : await signUp(email, password)

    if (result.error) {
      setError(result.error)
    } else if (mode === 'signup') {
      setInfo('Аккаунт создан. Если включено подтверждение почты — проверь email.')
    }
    setSubmitting(false)
  }

  return (
    <div style={{ maxWidth: 360, margin: '80px auto' }}>
      <h1>Net Worth Tracker</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p style={{ color: 'crimson' }}>{error}</p>}
        {info && <p style={{ color: 'seagreen' }}>{info}</p>}
        <button type="submit" disabled={submitting}>
          {mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
        style={{ marginTop: 12, background: 'none', border: 'none', textDecoration: 'underline', cursor: 'pointer' }}
      >
        {mode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
      </button>
    </div>
  )
}
