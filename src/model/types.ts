export type Currency = 'RUB' | 'USD' | 'EUR' | 'BTC'
export const CURRENCIES: readonly Currency[] = ['RUB', 'USD', 'EUR', 'BTC']

export type PlaceForm = 'cash' | 'noncash' | 'none'

export type Chain = 'ethereum' | 'bitcoin' | 'solana'

// The ruble is defined by one number only: the P2P USDT rate. Euros reach
// rubles through EUR/USD, which may be absent for months without euros.
export interface Rates {
  usdtRub: number
  eurUsd: number | null
  btcUsd: number
}

export interface Place {
  id: string
  name: string
  category: string
  currency: Currency
  form: PlaceForm
  sortOrder: number
  chain: Chain | null
  address: string | null
}

export interface SnapshotEntry {
  placeId: string
  amount: number
  detail?: unknown
}

export type SnapshotSource = 'import' | 'manual'

export interface Snapshot {
  id: string
  period: string // 'YYYY-MM'
  snapshotDate: string // 'YYYY-MM-DD'
  rates: Rates
  entries: SnapshotEntry[]
  reportedTotalRub: number | null
  source: SnapshotSource
  createdAt: string
}
