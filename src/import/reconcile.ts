import { toRub } from '../model/valuation'
import type { ImportPlace, ImportSnapshot } from './parseWorkbook'

export const RECONCILE_TOLERANCE_RUB = 1

export type ReconcileStatus = 'match' | 'mismatch' | 'no-total'

export interface Reconciliation {
  row: number
  period: string
  computedRub: number
  reportedRub: number | null
  diffRub: number | null // computed minus reported
  status: ReconcileStatus
}

export function reconcile(snapshot: ImportSnapshot, places: ImportPlace[]): Reconciliation {
  const currencyOf = new Map(places.map((p) => [p.name, p.currency]))
  let computedRub = 0
  for (const [name, amount] of Object.entries(snapshot.amounts)) {
    const currency = currencyOf.get(name)
    if (!currency) throw new Error(`Snapshot row ${snapshot.row} has an amount for unknown place ${name}`)
    computedRub += toRub(amount, currency, snapshot.rates)
  }

  const base = { row: snapshot.row, period: snapshot.period, computedRub, reportedRub: snapshot.reportedTotalRub }
  if (snapshot.reportedTotalRub === null) return { ...base, diffRub: null, status: 'no-total' }
  const diffRub = computedRub - snapshot.reportedTotalRub
  return { ...base, diffRub, status: Math.abs(diffRub) <= RECONCILE_TOLERANCE_RUB ? 'match' : 'mismatch' }
}
