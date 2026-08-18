// Space-grouped integers with dot decimals ("1 234.57"), so a BONK balance and
// a BTC balance read the same way. ru-RU would flip decimals to a comma for big
// numbers only, which looks inconsistent next to "0.0012 BTC".
function group(value: string): string {
  const [integer, fraction] = value.split('.')
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
  return fraction ? `${grouped}.${fraction}` : grouped
}

// Balances span 12 orders of magnitude (0.000001 BTC ... 4 000 000 BONK),
// so a fixed number of decimals is wrong at one end or the other.
export function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n === 0) return '0'
  const abs = Math.abs(n)
  if (abs >= 1000) return group(n.toFixed(2))
  if (abs >= 1) return String(Number(n.toFixed(4)))
  return String(Number(n.toPrecision(4)))
}

export function formatUsd(n: number): string {
  return `$${group(n.toFixed(2))}`
}
