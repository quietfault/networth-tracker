import { supabase } from './supabase'
import type { Snapshot, SnapshotAssets } from '../types/snapshot'

interface SnapshotRow {
  id: string
  user_id: string
  period: string
  snapshot_date: string
  assets: SnapshotAssets
  usd_rub: number | null
  total_usd: number | null
  created_at: string
}

function fromRow(row: SnapshotRow): Snapshot {
  return {
    id: row.id,
    userId: row.user_id,
    period: row.period,
    snapshotDate: row.snapshot_date,
    assets: row.assets,
    usdRub: row.usd_rub,
    totalUsd: row.total_usd,
    createdAt: row.created_at,
  }
}

export async function listSnapshots(): Promise<Snapshot[]> {
  const { data, error } = await supabase
    .from('snapshots')
    .select('*')
    .order('period', { ascending: true })

  if (error) throw error
  return (data as SnapshotRow[]).map(fromRow)
}

export async function getSnapshot(id: string): Promise<Snapshot | null> {
  const { data, error } = await supabase.from('snapshots').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? fromRow(data as SnapshotRow) : null
}

export async function createSnapshot(input: {
  period: string
  snapshotDate: string
  assets: SnapshotAssets
  usdRub: number | null
  totalUsd: number | null
}): Promise<Snapshot> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('snapshots')
    .insert({
      user_id: user.id,
      period: input.period,
      snapshot_date: input.snapshotDate,
      assets: input.assets,
      usd_rub: input.usdRub,
      total_usd: input.totalUsd,
    })
    .select()
    .single()

  if (error) throw error
  return fromRow(data as SnapshotRow)
}
