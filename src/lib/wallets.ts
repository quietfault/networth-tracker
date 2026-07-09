import { supabase } from './supabase'
import type { Wallet, Chain } from '../types/snapshot'

interface WalletRow {
  id: string
  user_id: string
  label: string
  chain: Chain
  address: string
  created_at: string
}

function fromRow(row: WalletRow): Wallet {
  return {
    id: row.id,
    userId: row.user_id,
    label: row.label,
    chain: row.chain,
    address: row.address,
    createdAt: row.created_at,
  }
}

export async function listWallets(): Promise<Wallet[]> {
  const { data, error } = await supabase
    .from('wallets')
    .select('*')
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data as WalletRow[]).map(fromRow)
}

export async function addWallet(input: {
  label: string
  chain: Chain
  address: string
}): Promise<Wallet> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('wallets')
    .insert({ ...input, user_id: user.id })
    .select()
    .single()

  if (error) throw error
  return fromRow(data as WalletRow)
}

export async function deleteWallet(id: string): Promise<void> {
  const { error } = await supabase.from('wallets').delete().eq('id', id)
  if (error) throw error
}
