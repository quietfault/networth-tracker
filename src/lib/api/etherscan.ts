import { getErrorMessage } from '../errors'

// Etherscan API V2: one key works across all EVM chains via the chainid param.
// A single address is the same account on every EVM chain, so we check
// balances on the popular ones and only return the chains with funds.
export const EVM_CHAINS = [
  { id: 1, name: 'Ethereum', symbol: 'ETH' },
  { id: 56, name: 'BNB Chain', symbol: 'BNB' },
  { id: 137, name: 'Polygon', symbol: 'POL' },
  { id: 42161, name: 'Arbitrum One', symbol: 'ETH' },
  { id: 10, name: 'Optimism', symbol: 'ETH' },
  { id: 8453, name: 'Base', symbol: 'ETH' },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX' },
] as const

// Free tier allows 5 calls/sec. Firing all chains at once (Promise.all) trips
// that limit and the whole wallet fails with a bare "NOTOK", so requests are
// spaced out and retried instead.
const CALL_SPACING_MS = 250
const RATE_LIMIT_RETRIES = 2

export interface EvmChainBalance {
  chainId: number
  chainName: string
  symbol: string
  amount: number
}

export interface EvmBalancesResult {
  balances: EvmChainBalance[]
  // Per-chain failures. A chain that fails no longer hides the ones that worked.
  errors: string[]
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// V2 signals failure in three different ways depending on what went wrong:
// {status:"0", message:"NOTOK", result:"Invalid API Key"}, a JSON-RPC style
// {error:{message}}, or a plain HTTP error. `result` carries the useful text.
function responseError(data: {
  status?: string
  message?: string
  result?: unknown
  error?: { message?: string }
}): string | null {
  if (data?.error?.message) return data.error.message
  if (data?.status === '1') return null

  const detail = typeof data?.result === 'string' ? data.result : ''
  const message = data?.message || 'запрос отклонён'
  if (!detail || detail === message) return message
  return `${message}: ${detail}`
}

async function fetchChainBalance(
  chainId: number,
  address: string,
  apiKey: string,
): Promise<number> {
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const data = await res.json()
    const error = responseError(data)
    if (!error) return Number(data.result) / 1e18

    const rateLimited = /rate limit|too many|throttl/i.test(error)
    if (rateLimited && attempt < RATE_LIMIT_RETRIES) {
      await sleep(1000 * (attempt + 1))
      continue
    }
    throw new Error(error)
  }
}

// Returns chains where the address holds a non-zero native balance, plus the
// chains that could not be checked. Never throws for a single failing chain.
export async function fetchEvmBalances(
  address: string,
  apiKey: string,
): Promise<EvmBalancesResult> {
  if (!apiKey) throw new Error('Etherscan API key не задан (Настройки)')

  const balances: EvmChainBalance[] = []
  const failures: { chain: string; message: string }[] = []

  for (const [index, chain] of EVM_CHAINS.entries()) {
    if (index > 0) await sleep(CALL_SPACING_MS)
    try {
      const amount = await fetchChainBalance(chain.id, address, apiKey)
      if (amount > 0) {
        balances.push({
          chainId: chain.id,
          chainName: chain.name,
          symbol: chain.symbol,
          amount,
        })
      }
    } catch (e) {
      failures.push({ chain: chain.name, message: getErrorMessage(e) })
    }
  }

  // A bad or missing key fails identically on every chain — say it once.
  const distinct = new Set(failures.map((f) => f.message))
  const errors =
    failures.length === EVM_CHAINS.length && distinct.size === 1
      ? [`Etherscan: ${[...distinct][0]} (все сети)`]
      : failures.map((f) => `Etherscan ${f.chain}: ${f.message}`)

  return { balances, errors }
}
