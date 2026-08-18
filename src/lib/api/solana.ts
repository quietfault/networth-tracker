// Solana's own public RPC blocks browser-origin requests (403), so we use
// publicnode's mirror instead, which sends Access-Control-Allow-Origin: *.
// Shared/rate-limited, so failures are expected occasionally under load.
const SOLANA_RPC_URL = 'https://solana-rpc.publicnode.com'

// Token accounts live under two programs: the original SPL Token program and
// Token-2022. Wallets hold newer mints (PYUSD и т.п.) under the second one, so
// both are queried — otherwise part of the balance is invisible.
const TOKEN_PROGRAMS = [
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',
]

// The RPC returns mints, not tickers. Known ones get a readable symbol; the
// rest fall back to a shortened mint (editable by hand in the snapshot form).
const MINT_SYMBOLS: Record<string, string> = {
  So11111111111111111111111111111111111111112: 'WSOL',
  EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v: 'USDC',
  Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB: 'USDT',
  DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263: 'BONK',
  mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So: 'mSOL',
  J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn: 'JitoSOL',
  JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN: 'JUP',
  EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm: 'WIF',
  HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3: 'PYTH',
  jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL: 'JTO',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R': 'RAY',
}

function shortMint(mint: string): string {
  return `${mint.slice(0, 4)}…${mint.slice(-4)}`
}

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  })
  if (!res.ok) throw new Error(`Solana RPC error: ${res.status}`)

  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Solana RPC request failed')
  return data.result as T
}

export async function fetchSolBalance(address: string): Promise<number> {
  const result = await rpc<{ value: number }>('getBalance', [address])
  return result.value / 1e9
}

export interface SplTokenBalance {
  mint: string
  symbol: string
  amount: number
  /** false when the symbol is a shortened mint, i.e. the token is unrecognised. */
  known: boolean
}

interface TokenAccountsResponse {
  value: {
    account: {
      data: {
        parsed?: {
          info?: {
            mint?: string
            tokenAmount?: { amount?: string; decimals?: number; uiAmountString?: string }
          }
        }
      }
    }
  }[]
}

// SPL/Token-2022 balances of an address. Zero-balance accounts (left over after
// a swap) and NFTs (decimals = 0) are dropped; several accounts of the same mint
// are summed into one line.
export async function fetchSplTokens(address: string): Promise<SplTokenBalance[]> {
  const responses = await Promise.allSettled(
    TOKEN_PROGRAMS.map((programId) =>
      rpc<TokenAccountsResponse>('getTokenAccountsByOwner', [
        address,
        { programId },
        { encoding: 'jsonParsed' },
      ]),
    ),
  )

  const failed = responses.filter((r) => r.status === 'rejected')
  // One program failing while the other answers is survivable; both failing is not.
  if (failed.length === TOKEN_PROGRAMS.length) {
    throw (failed[0] as PromiseRejectedResult).reason
  }

  const byMint = new Map<string, number>()
  for (const response of responses) {
    if (response.status !== 'fulfilled') continue
    for (const entry of response.value.value ?? []) {
      const info = entry.account?.data?.parsed?.info
      const tokenAmount = info?.tokenAmount
      if (!info?.mint || !tokenAmount) continue
      if (!tokenAmount.decimals) continue // decimals = 0 -> NFT, not a balance
      const amount = Number(tokenAmount.uiAmountString ?? 0)
      if (!(amount > 0)) continue
      byMint.set(info.mint, (byMint.get(info.mint) ?? 0) + amount)
    }
  }

  return [...byMint.entries()]
    .map(([mint, amount]) => ({
      mint,
      amount,
      symbol: MINT_SYMBOLS[mint] ?? shortMint(mint),
      known: mint in MINT_SYMBOLS,
    }))
    .sort((a, b) => b.amount - a.amount)
}
