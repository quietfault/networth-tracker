export const COIN_IDS: Record<string, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  SOL: 'solana',
  BNB: 'binancecoin',
  MATIC: 'matic-network',
  AVAX: 'avalanche-2',
  USDT: 'tether',
  USDC: 'usd-coin',
}

// symbol -> price in USD. Unknown symbols are silently omitted from the result.
export async function fetchTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  const knownSymbols = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(
    (s) => s in COIN_IDS,
  )
  if (knownSymbols.length === 0) return {}

  const ids = knownSymbols.map((s) => COIN_IDS[s]).join(',')
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
  )
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)

  const data: Record<string, { usd: number }> = await res.json()
  const idToSymbol = Object.fromEntries(knownSymbols.map((s) => [COIN_IDS[s], s]))

  const prices: Record<string, number> = {}
  for (const [id, { usd }] of Object.entries(data)) {
    prices[idToSymbol[id]] = usd
  }
  return prices
}
