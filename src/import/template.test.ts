import { describe, it, expect } from 'vitest'
import readXlsxFile from 'read-excel-file/node'
import { TEMPLATE_PATH } from './template.fixture'

describe('import template', () => {
  // A template written by the generator alone has formulas without cached
  // values, and read-excel-file reads such cells as empty.
  it('carries totals computed by Excel', async () => {
    const sheets = await readXlsxFile(TEMPLATE_PATH)
    const data = sheets.find((s) => s.sheet === 'Срезы')!.data
    const header = data.findIndex((r) => r[0] === 'Дата')
    const totalCol = data[header].indexOf('Итог ₽')
    const totals = data.slice(header + 1).filter((r) => r[0] !== null).map((r) => r[totalCol])
    expect(totals).toHaveLength(6)
    expect(totals.every((t) => typeof t === 'number')).toBe(true)
  })
})
