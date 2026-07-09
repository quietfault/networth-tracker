import type { SnapshotAssets } from '../types/snapshot'

export function toUsd(amount: number, currency: string, usdRub: number | null): number {
  if (currency === 'USD') return amount
  if (currency === 'RUB') return usdRub ? amount / usdRub : 0
  return amount
}

export interface CategoryTotals {
  banks: number
  crypto: number
  inventory: number
  physical: number
  total: number
}

export function categoryTotals(assets: SnapshotAssets, usdRub: number | null): CategoryTotals {
  const banks = assets.banks.reduce((sum, b) => sum + toUsd(b.amount, b.currency, usdRub), 0)
  const inventory = assets.inventory.reduce(
    (sum, i) => sum + toUsd(i.qty * i.pricePerUnit, i.currency, usdRub),
    0,
  )
  const physical = assets.physical.reduce((sum, p) => sum + toUsd(p.value, p.currency, usdRub), 0)
  const crypto = assets.crypto.reduce(
    (sum, holding) => sum + holding.tokens.reduce((s, t) => s + t.amount * (t.priceUSD ?? 0), 0),
    0,
  )
  return { banks, crypto, inventory, physical, total: banks + inventory + physical + crypto }
}
