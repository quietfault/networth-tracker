import { supabase } from './supabase'
import type { UserSettings } from '../types/snapshot'

interface SettingsRow {
  user_id: string
  base_currency: string
  etherscan_api_key: string | null
  unisat_api_key: string | null
  updated_at: string
}

function fromRow(row: SettingsRow): UserSettings {
  return {
    userId: row.user_id,
    baseCurrency: row.base_currency,
    etherscanApiKey: row.etherscan_api_key,
    unisatApiKey: row.unisat_api_key,
    updatedAt: row.updated_at,
  }
}

export async function getSettings(): Promise<UserSettings | null> {
  const { data, error } = await supabase.from('settings').select('*').maybeSingle()
  if (error) throw error
  return data ? fromRow(data as SettingsRow) : null
}

export async function upsertSettings(input: {
  baseCurrency: string
  etherscanApiKey: string | null
  unisatApiKey: string | null
}): Promise<UserSettings> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('settings')
    .upsert({
      user_id: user.id,
      base_currency: input.baseCurrency,
      etherscan_api_key: input.etherscanApiKey,
      unisat_api_key: input.unisatApiKey,
      updated_at: new Date().toISOString(),
    })
    .select()
    .single()

  if (error) throw error
  return fromRow(data as SettingsRow)
}
