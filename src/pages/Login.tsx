import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Logo } from '../components/Logo'
import { ThemeToggle } from '../components/ThemeToggle'

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
    <div className="login">
      <div className="login-card">
        <Logo />

        <div>
          <h1>Срез</h1>
          <p className="muted">
            Личный трекер состояния: банки, крипта, инвентарь и физические активы одним
            снимком в месяц.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: 12 }}>
          <input
            type="email"
            placeholder="Email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Пароль"
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className="error">{error}</p>}
          {info && <p className="ok">{info}</p>}
          <button type="submit" className="btn-primary" disabled={submitting}>
            {mode === 'signin' ? 'Войти' : 'Зарегистрироваться'}
          </button>
        </form>

        <div className="row" style={{ justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn-link"
            onClick={() => setMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {mode === 'signin' ? 'Нет аккаунта? Зарегистрироваться' : 'Уже есть аккаунт? Войти'}
          </button>
          <ThemeToggle />
        </div>
      </div>
    </div>
  )
}
