import readXlsxFile from 'read-excel-file/browser'
import type { RawSheet } from './parseWorkbook'

// The library types a date cell as `typeof Date` (the constructor), while at
// runtime it is a Date instance; RawSheet states what actually arrives.
export async function readWorkbook(file: File): Promise<RawSheet[]> {
  return (await readXlsxFile(file)) as unknown as RawSheet[]
}
