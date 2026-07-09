// Etherscan API V2: one key works across all EVM chains via the chainid param.
// A single address is the same account on every EVM chain, so we check
// balances on the popular ones and only return the chains with funds.
export const EVM_CHAINS = [
  { id: 1, name: 'Ethereum', symbol: 'ETH' },
  { id: 56, name: 'BNB Chain', symbol: 'BNB' },
  { id: 137, name: 'Polygon', symbol: 'MATIC' },
  { id: 42161, name: 'Arbitrum One', symbol: 'ETH' },
  { id: 10, name: 'Optimism', symbol: 'ETH' },
  { id: 8453, name: 'Base', symbol: 'ETH' },
  { id: 43114, name: 'Avalanche', symbol: 'AVAX' },
] as const

export interface EvmChainBalance {
  chainId: number
  chainName: string
  symbol: string
  amount: number
}

async function fetchChainBalance(
  chainId: number,
  address: string,
  apiKey: string,
): Promise<number> {
  const url = `https://api.etherscan.io/v2/api?chainid=${chainId}&module=account&action=balance&address=${address}&tag=latest&apikey=${apiKey}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Etherscan error: ${res.status}`)

  const data = await res.json()
  if (data.status !== '1') throw new Error(data.message || 'Etherscan request failed')

  return Number(data.result) / 1e18
}

// Returns only chains where the address holds a non-zero native balance.
export async function fetchEvmBalances(
  address: string,
  apiKey: string,
): Promise<EvmChainBalance[]> {
  if (!apiKey) throw new Error('Etherscan API key не задан (Настройки)')

  const results = await Promise.all(
    EVM_CHAINS.map(async (chain) => {
      const amount = await fetchChainBalance(chain.id, address, apiKey)
      return { chainId: chain.id, chainName: chain.name, symbol: chain.symbol, amount }
    }),
  )

  return results.filter((r) => r.amount > 0)
}
