// Solana's own public RPC blocks browser-origin requests (403), so we use
// publicnode's mirror instead, which sends Access-Control-Allow-Origin: *.
// Shared/rate-limited, so failures are expected occasionally under load.
const SOLANA_RPC_URL = 'https://solana-rpc.publicnode.com'

export async function fetchSolBalance(address: string): Promise<number> {
  const res = await fetch(SOLANA_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getBalance',
      params: [address],
    }),
  })
  if (!res.ok) throw new Error(`Solana RPC error: ${res.status}`)

  const data = await res.json()
  if (data.error) throw new Error(data.error.message || 'Solana RPC request failed')

  return data.result.value / 1e9
}
