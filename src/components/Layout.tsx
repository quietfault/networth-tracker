import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Logo } from './Logo'
import { ThemeToggle } from './ThemeToggle'

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <>
      <header className="masthead">
        <div className="masthead-inner">
          <div className="brand">
            <Logo withMark />
            <span className="brand-name">Срез</span>
          </div>

          <nav className="masthead-nav">
            <NavLink to="/" end>
              Обзор
            </NavLink>
            <NavLink to="/snapshot/new">Новый срез</NavLink>
            <NavLink to="/wallets">Кошельки</NavLink>
            <NavLink to="/settings">Настройки</NavLink>
          </nav>

          <div className="masthead-side">
            <span className="mono">{user?.email}</span>
            <ThemeToggle />
            <button type="button" className="btn-quiet" onClick={() => signOut()}>
              Выйти
            </button>
          </div>
        </div>
      </header>

      <main className="page">
        <Outlet />
      </main>
    </>
  )
}
