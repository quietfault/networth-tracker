export interface RuneBalance {
  rune: string
  symbol: string
  amount: number
}

interface UnisatRuneEntry {
  rune: string
  spacedRune: string
  amount: string
  divisibility: number
}

// Verified live against the real API (2026-07-09): { code, data: { detail: [...] } },
// symbol field is a single decorative glyph, so spacedRune is used as the label instead.
export async function fetchRuneBalances(address: string, apiKey: string): Promise<RuneBalance[]> {
  if (!apiKey) throw new Error('UniSat API key не задан (Настройки)')

  const res = await fetch(
    `https://open-api.unisat.io/v1/indexer/address/${address}/runes/balance-list`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
  )
  if (!res.ok) throw new Error(`UniSat error: ${res.status}`)

  const data = await res.json()
  if (data.code !== 0) throw new Error(data.msg || 'UniSat request failed')

  const list: UnisatRuneEntry[] = data.data?.detail ?? []
  return list.map((r) => ({
    rune: r.rune,
    symbol: r.spacedRune,
    amount: r.divisibility > 0 ? Number(r.amount) / 10 ** r.divisibility : Number(r.amount),
  }))
}
