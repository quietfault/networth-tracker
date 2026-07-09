// Returns BTC balance for an address. No API key needed, but Blockchair
// limits free usage to ~30 requests/day.
export async function fetchBtcBalance(address: string): Promise<number> {
  const res = await fetch(`https://api.blockchair.com/bitcoin/dashboards/address/${address}`)
  const data = await res.json().catch(() => null)

  if (data?.context?.error) throw new Error(`Blockchair: ${data.context.error}`)
  if (!res.ok) throw new Error(`Blockchair error: ${res.status}`)

  const entry = data.data?.[address]
  if (!entry) throw new Error('Blockchair: адрес не найден в ответе')

  return entry.address.balance / 1e8
}
