export const COIN_IDS: Record<string, string> = {
  ETH: 'ethereum',
  BTC: 'bitcoin',
  SOL: 'solana',
  BNB: 'binancecoin',
  MATIC: 'matic-network',
  POL: 'polygon-ecosystem-token',
  AVAX: 'avalanche-2',
  USDT: 'tether',
  USDC: 'usd-coin',
  DAI: 'dai',
  WBTC: 'wrapped-bitcoin',
  OP: 'optimism',
  ARB: 'arbitrum',
  LINK: 'chainlink',
  TON: 'the-open-network',
  TRX: 'tron',
}

// CoinGecko's free tier is rate limited (~10-30 req/min shared by IP) and the
// wallets page can ask for the same prices several times in a row, so answers
// are cached briefly. Cache is per-URL, i.e. per exact set of ids/contracts.
const CACHE_TTL_MS = 60_000
const cache = new Map<string, { at: number; data: unknown }>()

async function getJson(url: string): Promise<Record<string, unknown>> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data as Record<string, unknown>

  const res = await fetch(url)
  if (res.status === 429) throw new Error('CoinGecko: лимит запросов, попробуйте через минуту')
  if (!res.ok) throw new Error(`CoinGecko error: ${res.status}`)

  const data = (await res.json()) as Record<string, unknown>
  cache.set(url, { at: Date.now(), data })
  return data
}

// symbol -> price in USD. Unknown symbols are silently omitted from the result.
export async function fetchTokenPrices(symbols: string[]): Promise<Record<string, number>> {
  const knownSymbols = [...new Set(symbols.map((s) => s.toUpperCase()))].filter(
    (s) => s in COIN_IDS,
  )
  if (knownSymbols.length === 0) return {}

  const ids = knownSymbols.map((s) => COIN_IDS[s]).join(',')
  const data = (await getJson(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
  )) as Record<string, { usd: number }>
  const idToSymbol = Object.fromEntries(knownSymbols.map((s) => [COIN_IDS[s], s]))

  const prices: Record<string, number> = {}
  for (const [id, value] of Object.entries(data)) {
    if (value?.usd != null) prices[idToSymbol[id]] = value.usd
  }
  return prices
}

// Prices tokens that have no fixed symbol mapping (SPL mints, ERC-20 contracts).
// `platform` is a CoinGecko asset platform id: 'solana', 'ethereum', ...
// Keys of the result are lowercased addresses — CoinGecko lowercases them too.
export async function fetchTokenPricesByContract(
  platform: string,
  contracts: string[],
): Promise<Record<string, number>> {
  const unique = [...new Set(contracts.map((c) => c.toLowerCase()))]
  const prices: Record<string, number> = {}

  // The endpoint truncates very long query strings, so ask in chunks.
  for (let i = 0; i < unique.length; i += 40) {
    const chunk = unique.slice(i, i + 40)
    const data = (await getJson(
      `https://api.coingecko.com/api/v3/simple/token_price/${platform}` +
        `?contract_addresses=${chunk.join(',')}&vs_currencies=usd`,
    )) as Record<string, { usd?: number }>
    for (const [address, value] of Object.entries(data)) {
      if (value?.usd != null) prices[address.toLowerCase()] = value.usd
    }
  }
  return prices
}
