import { supabase } from '../lib/supabase'
import type { NewSnapshot } from '../import/planImport'

export async function listSnapshotPeriods(): Promise<string[]> {
  const { data, error } = await supabase.from('snapshots').select('period')
  if (error) throw error
  return (data as { period: string }[]).map((r) => r.period)
}

export async function insertSnapshots(rows: NewSnapshot[]): Promise<number> {
  if (rows.length === 0) return 0
  const { error } = await supabase.from('snapshots').insert(
    rows.map((s) => ({
      period: s.period,
      snapshot_date: s.snapshotDate,
      usdt_rub: s.rates.usdtRub,
      eur_usd: s.rates.eurUsd,
      btc_usd: s.rates.btcUsd,
      entries: s.entries,
      reported_total_rub: s.reportedTotalRub,
      source: s.source,
    })),
  )
  if (error) throw error
  return rows.length
}
