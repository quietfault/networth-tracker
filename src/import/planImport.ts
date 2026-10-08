import type { Currency, Rates, SnapshotEntry, SnapshotSource } from '../model/types'
import type { ImportPlace, ImportSnapshot, ParsedWorkbook } from './parseWorkbook'

export interface ExistingData {
  places: { name: string; currency: Currency }[]
  periods: string[]
}

export interface CurrencyConflict {
  name: string
  fileCurrency: Currency
  dbCurrency: Currency
}

export interface ImportPlan {
  placesToCreate: ImportPlace[]
  snapshotsToCreate: ImportSnapshot[]
  skippedPeriods: string[]
  currencyConflicts: CurrencyConflict[]
}

// An existing place is never changed by an import: the registry in the app is
// live and wins over the file. Only a currency clash blocks, because it would
// reprice the place's whole history.
export function planImport(parsed: ParsedWorkbook, existing: ExistingData): ImportPlan {
  const dbCurrency = new Map(existing.places.map((p) => [p.name, p.currency]))
  const placesToCreate: ImportPlace[] = []
  const currencyConflicts: CurrencyConflict[] = []
  for (const place of parsed.places) {
    const current = dbCurrency.get(place.name)
    if (current === undefined) placesToCreate.push(place)
    else if (current !== place.currency)
      currencyConflicts.push({ name: place.name, fileCurrency: place.currency, dbCurrency: current })
  }

  const taken = new Set(existing.periods)
  const snapshotsToCreate = parsed.snapshots.filter((s) => !taken.has(s.period))
  const skippedPeriods = parsed.snapshots.filter((s) => taken.has(s.period)).map((s) => s.period)

  return { placesToCreate, snapshotsToCreate, skippedPeriods, currencyConflicts }
}

export function canCommit(parsed: ParsedWorkbook, plan: ImportPlan): boolean {
  return parsed.issues.length === 0 && plan.currencyConflicts.length === 0 && plan.snapshotsToCreate.length > 0
}

export interface NewSnapshot {
  period: string
  snapshotDate: string
  rates: Rates
  entries: SnapshotEntry[]
  reportedTotalRub: number | null
  source: SnapshotSource
}

export function toNewSnapshot(snapshot: ImportSnapshot, idByName: Map<string, string>): NewSnapshot {
  const entries: SnapshotEntry[] = []
  for (const [name, amount] of Object.entries(snapshot.amounts)) {
    if (amount === 0) continue
    const placeId = idByName.get(name)
    if (!placeId) throw new Error(`No place id for ${name} (snapshot ${snapshot.period})`)
    entries.push({ placeId, amount })
  }
  return {
    period: snapshot.period,
    snapshotDate: snapshot.snapshotDate,
    rates: snapshot.rates,
    entries,
    reportedTotalRub: snapshot.reportedTotalRub,
    source: 'import',
  }
}
