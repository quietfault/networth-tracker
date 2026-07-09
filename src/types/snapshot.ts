export type Chain = 'ethereum' | 'bitcoin' | 'solana'

export interface Bank {
  name: string
  amount: number
  currency: string
}

export interface Token {
  symbol: string
  amount: number
  priceUSD: number | null
}

export interface CryptoHolding {
  type: 'wallet' | 'cex'
  label: string
  address?: string
  chain?: Chain
  tokens: Token[]
}

export interface InventoryItem {
  name: string
  qty: number
  pricePerUnit: number
  currency: string
}

export interface PhysicalAsset {
  name: string
  value: number
  currency: string
}

export interface SnapshotAssets {
  banks: Bank[]
  crypto: CryptoHolding[]
  inventory: InventoryItem[]
  physical: PhysicalAsset[]
}

export function emptyAssets(): SnapshotAssets {
  return { banks: [], crypto: [], inventory: [], physical: [] }
}

export interface Snapshot {
  id: string
  userId: string
  period: string // '2024-12'
  snapshotDate: string // '2024-12-01'
  assets: SnapshotAssets
  usdRub: number | null
  totalUsd: number | null
  createdAt: string
}

export interface Wallet {
  id: string
  userId: string
  label: string
  chain: Chain
  address: string
  createdAt: string
}

export interface UserSettings {
  userId: string
  baseCurrency: string
  etherscanApiKey: string | null
  unisatApiKey: string | null
  updatedAt: string
}
