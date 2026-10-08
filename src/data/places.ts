import { supabase } from '../lib/supabase'
import type { Chain, Currency, Place, PlaceForm } from '../model/types'

interface PlaceRow {
  id: string
  name: string
  category: string
  currency: Currency
  form: PlaceForm
  sort_order: number
  chain: Chain | null
  address: string | null
}

function fromRow(r: PlaceRow): Place {
  return {
    id: r.id,
    name: r.name,
    category: r.category,
    currency: r.currency,
    form: r.form,
    sortOrder: r.sort_order,
    chain: r.chain,
    address: r.address,
  }
}

export async function listPlaces(): Promise<Place[]> {
  const { data, error } = await supabase.from('places').select('*').order('sort_order')
  if (error) throw error
  return (data as PlaceRow[]).map(fromRow)
}

export interface NewPlace {
  name: string
  category: string
  currency: Currency
  form: PlaceForm
  sortOrder: number
}

export async function insertPlaces(places: NewPlace[]): Promise<Place[]> {
  if (places.length === 0) return []
  const { data, error } = await supabase
    .from('places')
    .insert(
      places.map((p) => ({
        name: p.name,
        category: p.category,
        currency: p.currency,
        form: p.form,
        sort_order: p.sortOrder,
      })),
    )
    .select()
  if (error) throw error
  return (data as PlaceRow[]).map(fromRow)
}
