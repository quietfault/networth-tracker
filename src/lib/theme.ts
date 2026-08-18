export type Theme = 'dark' | 'light'

// Тёмная — основная тема бренда, поэтому она и есть значение по умолчанию:
// в tokens.css она объявлена на голом :root, а светлая включается атрибутом.
export const DEFAULT_THEME: Theme = 'dark'

// Тот же ключ, что у панели маркетинга: домены разные, но привычка одна.
const STORAGE_KEY = 'qf-theme'

export function getTheme(): Theme {
  const attribute = document.documentElement.getAttribute('data-theme')
  return attribute === 'light' || attribute === 'dark' ? attribute : DEFAULT_THEME
}

export function setTheme(theme: Theme): void {
  document.documentElement.setAttribute('data-theme', theme)
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    /* приватный режим: тема живёт до перезагрузки */
  }
  syncThemeColor()
}

// Цвет строки браузера на мобильном берётся из токена, а не дублируется
// литералом в разметке — иначе он разъедется с темой при правке бренда.
function syncThemeColor(): void {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  const bg = getComputedStyle(document.body).backgroundColor
  if (bg) meta.setAttribute('content', bg)
}
