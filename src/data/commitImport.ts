import type { Place } from '../model/types'
import { toNewSnapshot, type ImportPlan } from '../import/planImport'
import { insertPlaces } from './places'
import { insertSnapshots } from './snapshots'

// Two inserts, not one transaction: if snapshots fail after places were
// created, a repeated import matches those places by name and goes on.
export async function commitImport(
  plan: ImportPlan,
  existingPlaces: Place[],
): Promise<{ placesCreated: number; snapshotsCreated: number }> {
  const firstOrder = existingPlaces.reduce((max, p) => Math.max(max, p.sortOrder), -1) + 1
  const created = await insertPlaces(plan.placesToCreate.map((p, i) => ({ ...p, sortOrder: firstOrder + i })))
  const idByName = new Map([...existingPlaces, ...created].map((p) => [p.name, p.id]))
  const snapshotsCreated = await insertSnapshots(plan.snapshotsToCreate.map((s) => toNewSnapshot(s, idByName)))
  return { placesCreated: created.length, snapshotsCreated }
}
