import { describe, it, expect } from 'vitest'
import readXlsxFile from 'read-excel-file/node'
import { parseWorkbook, type ImportPlace, type ImportSnapshot, type RawSheet } from './parseWorkbook'
import { reconcile } from './reconcile'
import { TEMPLATE_PATH } from './template.fixture'

const places: ImportPlace[] = [
  { name: 'Сбер', category: 'Банки', currency: 'RUB', form: 'noncash' },
  { name: 'Крипта', category: 'Крипта', currency: 'BTC', form: 'noncash' },
]
const snapshot = (amounts: Record<string, number>, reportedTotalRub: number | null): ImportSnapshot => ({
  row: 4,
  period: '2025-01',
  snapshotDate: '2025-01-31',
  rates: { usdtRub: 100, eurUsd: null, btcUsd: 100000 },
  amounts,
  reportedTotalRub,
})

describe('reconcile', () => {
  it('says match when the totals differ by at most one ruble', () => {
    const r = reconcile(snapshot({ Сбер: 1000, Крипта: 0.01 }, 101000.6), places)
    expect(r.status).toBe('match')
    expect(r.computedRub).toBeCloseTo(101000, 6)
    expect(r.diffRub).toBeCloseTo(-0.6, 6)
  })

  it('says mismatch beyond one ruble and keeps the sign of the difference', () => {
    const r = reconcile(snapshot({ Сбер: 1000, Крипта: 0.01 }, 100998), places)
    expect(r.status).toBe('mismatch')
    expect(r.diffRub).toBeCloseTo(2, 6)
  })

  it('says no-total when Excel gave no total', () => {
    expect(reconcile(snapshot({ Сбер: 1 }, null), places)).toMatchObject({ status: 'no-total', diffRub: null })
  })

  it('matches every row of the real template, where Excel computed the totals', async () => {
    const parsed = parseWorkbook((await readXlsxFile(TEMPLATE_PATH)) as unknown as RawSheet[])
    const verdicts = parsed.snapshots.map((s) => reconcile(s, parsed.places).status)
    expect(verdicts).toEqual(['match', 'match', 'match', 'match', 'match', 'match'])
  })

  it('catches a changed amount in a real template row', async () => {
    const parsed = parseWorkbook((await readXlsxFile(TEMPLATE_PATH)) as unknown as RawSheet[])
    const tampered = { ...parsed.snapshots[2], amounts: { ...parsed.snapshots[2].amounts, Сбер: 380002 } }
    expect(reconcile(tampered, parsed.places).status).toBe('mismatch')
  })
})
