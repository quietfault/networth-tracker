import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function Layout() {
  const { user, signOut } = useAuth()

  return (
    <div>
      <nav style={{ display: 'flex', gap: 16, alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #333' }}>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/snapshot/new">Новый снимок</NavLink>
        <NavLink to="/wallets">Кошельки</NavLink>
        <NavLink to="/settings">Настройки</NavLink>
        <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{user?.email}</span>
        <button onClick={() => signOut()}>Выйти</button>
      </nav>
      <main style={{ padding: 20 }}>
        <Outlet />
      </main>
    </div>
  )
}
