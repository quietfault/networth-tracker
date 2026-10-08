import { describe, it, expect } from 'vitest'
import type { ImportSnapshot, ParsedWorkbook } from './parseWorkbook'
import { canCommit, planImport, toNewSnapshot } from './planImport'

const snap = (period: string, amounts: Record<string, number>): ImportSnapshot => ({
  row: 4,
  period,
  snapshotDate: `${period}-28`,
  rates: { usdtRub: 100, eurUsd: null, btcUsd: 100000 },
  amounts,
  reportedTotalRub: 1,
})

const parsed: ParsedWorkbook = {
  places: [
    { name: 'Сбер', category: 'Банки', currency: 'RUB', form: 'noncash' },
    { name: 'Крипта', category: 'Крипта', currency: 'BTC', form: 'noncash' },
    { name: 'Налик $', category: 'Наличные', currency: 'USD', form: 'cash' },
  ],
  snapshots: [snap('2025-01', { Сбер: 1 }), snap('2025-02', { Сбер: 2 })],
  issues: [],
}

describe('planImport', () => {
  it('creates only places the database does not have, in sheet order', () => {
    const plan = planImport(parsed, { places: [{ name: 'Сбер', currency: 'RUB' }], periods: [] })
    expect(plan.placesToCreate.map((p) => p.name)).toEqual(['Крипта', 'Налик $'])
    expect(plan.currencyConflicts).toEqual([])
  })

  it('reports a same-named place with another currency as a conflict', () => {
    const plan = planImport(parsed, { places: [{ name: 'Крипта', currency: 'USD' }], periods: [] })
    expect(plan.currencyConflicts).toEqual([{ name: 'Крипта', fileCurrency: 'BTC', dbCurrency: 'USD' }])
    expect(canCommit(parsed, plan)).toBe(false)
  })

  it('skips months already in the database', () => {
    const plan = planImport(parsed, { places: [], periods: ['2025-02'] })
    expect(plan.snapshotsToCreate.map((s) => s.period)).toEqual(['2025-01'])
    expect(plan.skippedPeriods).toEqual(['2025-02'])
  })
})

describe('canCommit', () => {
  it('allows a clean plan with something to write', () => {
    expect(canCommit(parsed, planImport(parsed, { places: [], periods: [] }))).toBe(true)
  })

  it('blocks on any format issue', () => {
    const broken = { ...parsed, issues: [{ sheet: null, row: null, message: 'x' }] }
    expect(canCommit(broken, planImport(broken, { places: [], periods: [] }))).toBe(false)
  })

  it('blocks when every month is already in the database', () => {
    expect(canCommit(parsed, planImport(parsed, { places: [], periods: ['2025-01', '2025-02'] }))).toBe(false)
  })
})

describe('toNewSnapshot', () => {
  it('maps names to ids and drops zero amounts', () => {
    const ids = new Map([['Сбер', 'id-1'], ['Крипта', 'id-2']])
    const row = toNewSnapshot(snap('2025-01', { Сбер: 5, Крипта: 0 }), ids)
    expect(row).toEqual({
      period: '2025-01',
      snapshotDate: '2025-01-28',
      rates: { usdtRub: 100, eurUsd: null, btcUsd: 100000 },
      entries: [{ placeId: 'id-1', amount: 5 }],
      reportedTotalRub: 1,
      source: 'import',
    })
  })

  it('refuses an amount whose place has no id', () => {
    expect(() => toNewSnapshot(snap('2025-01', { Альфа: 5 }), new Map())).toThrow(/Альфа/)
  })
})
