import { useState } from 'react'
import { getTheme, setTheme, type Theme } from '../lib/theme'

export function ThemeToggle() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme())

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  return (
    <button type="button" className="btn-quiet" onClick={toggle} aria-pressed={theme === 'light'}>
      {theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
    </button>
  )
}
