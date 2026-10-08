import { describe, it, expect } from 'vitest'
import readXlsxFile from 'read-excel-file/node'
import { parseWorkbook, type Cell, type RawSheet } from './parseWorkbook'
import { TEMPLATE_PATH } from './template.fixture'

const PLACES_HEAD: Cell[] = ['Место', 'Категория', 'Валюта', 'Форма']
const SNAP_HEAD: Cell[] = ['Дата', 'USDT/RUB', 'EUR/USD', 'BTC/USD', 'Итог ₽']

function book(places: Cell[][], snapHead: Cell[], snaps: Cell[][]): RawSheet[] {
  return [
    { sheet: 'Места', data: [PLACES_HEAD, ...places] },
    { sheet: 'Срезы', data: [['Срезы — заголовок'], [], snapHead, ...snaps] },
  ]
}

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)
const messages = (sheets: RawSheet[]) => parseWorkbook(sheets).issues.map((i) => i.message)

describe('parseWorkbook on the real template', () => {
  it('reads ten places and six snapshots without issues', async () => {
    const parsed = parseWorkbook((await readXlsxFile(TEMPLATE_PATH)) as unknown as RawSheet[])
    expect(parsed.issues).toEqual([])
    expect(parsed.places).toHaveLength(10)
    expect(parsed.places[6]).toEqual({ name: 'Налик €', category: 'Наличные', currency: 'EUR', form: 'cash' })
    expect(parsed.places[8].form).toBe('none')
    expect(parsed.snapshots).toHaveLength(6)
    expect(parsed.snapshots[0]).toMatchObject({
      row: 4,
      period: '2025-01',
      snapshotDate: '2025-01-31',
      rates: { usdtRub: 101, eurUsd: 1.04, btcUsd: 102000 },
      reportedTotalRub: 5427016,
    })
    expect(parsed.snapshots[0].amounts['Крипта']).toBe(0.25)
    expect(parsed.snapshots[3].amounts['Альфа']).toBe(0)
  })
})

describe('parseWorkbook leniency', () => {
  it('reads an empty amount as zero and USDT as USD, skipping blank rows', () => {
    const parsed = parseWorkbook(
      book(
        [['Сбер', 'Банки', 'RUB', 'безнал'], [], ['Тезер', 'Крипта', 'USDT', '']],
        [...SNAP_HEAD, 'Сбер', 'Тезер'],
        [[d('2025-01-31'), 100, null, 90000, 1000, 1000, null], []],
      ),
    )
    expect(parsed.issues).toEqual([])
    expect(parsed.places[1]).toEqual({ name: 'Тезер', category: 'Крипта', currency: 'USD', form: 'none' })
    expect(parsed.snapshots[0].amounts).toEqual({ Сбер: 1000, Тезер: 0 })
    expect(parsed.snapshots[0].rates.eurUsd).toBeNull()
  })
})

describe('parseWorkbook format errors', () => {
  const place = ['Сбер', 'Банки', 'RUB', 'безнал']
  const row = (over: Partial<Record<number, Cell>> = {}): Cell[] => {
    const r: Cell[] = [d('2025-01-31'), 100, 1.1, 90000, 5, 5]
    for (const [i, v] of Object.entries(over)) r[Number(i)] = v as Cell
    return r
  }

  it('reports a missing sheet', () => {
    expect(messages([{ sheet: 'Места', data: [PLACES_HEAD] }])).toEqual(['Нет листа «Срезы»'])
  })

  it('reports a place column absent from Места', () => {
    expect(messages(book([place], [...SNAP_HEAD, 'Сбер', 'Альфа'], [[...row(), 1]]))).toContain(
      'Колонка «Альфа» — такого места нет на листе «Места»',
    )
  })

  it('reports an unknown currency and form, and a duplicate place', () => {
    const m = messages(
      book(
        [place, ['Касса', 'Наличные', 'GBP', 'нал'], ['Сейф', 'Наличные', 'RUB', 'карман'], place],
        [...SNAP_HEAD, 'Сбер'],
        [row()],
      ),
    )
    expect(m).toContain('У места «Касса» неизвестная валюта «GBP» — нужна RUB, USD, EUR или BTC')
    expect(m).toContain('У места «Сейф» неизвестная форма «карман» — нужна нал, безнал или —')
    expect(m).toContain('Место «Сбер» встречается дважды')
  })

  it('reports a sheet without a «Дата» header row', () => {
    const sheets: RawSheet[] = [
      { sheet: 'Места', data: [PLACES_HEAD, place] },
      { sheet: 'Срезы', data: [['Date', 'USDT/RUB']] },
    ]
    expect(messages(sheets)).toEqual(['Не найдена строка заголовков: в колонке A должно стоять «Дата»'])
  })

  it('reports a missing rate column', () => {
    expect(messages(book([place], ['Дата', 'USDT/RUB', 'BTC/USD', 'Итог ₽', 'Сбер'], []))).toEqual([
      'Нет колонок: EUR/USD',
    ])
  })

  it('reports a second snapshot in the same month with both rows', () => {
    expect(messages(book([place], [...SNAP_HEAD, 'Сбер'], [row(), row({ 0: d('2025-01-15') })]))).toEqual([
      'Второй срез за 2025-01 — первый в строке 4',
    ])
  })

  it('reports a non-date, a non-positive rate, a text amount and a missing EUR/USD', () => {
    const m = messages(
      book(
        [place, ['Евро', 'Наличные', 'EUR', 'нал']],
        [...SNAP_HEAD, 'Сбер', 'Евро'],
        [
          [...row({ 0: '31.01.2025' }), 0],
          [...row({ 0: d('2025-02-28'), 1: 0 }), 0],
          [...row({ 0: d('2025-03-31'), 5: 'много' }), 0],
          [...row({ 0: d('2025-04-30'), 2: null }), 10],
        ],
      ),
    )
    expect(m).toEqual([
      'В колонке «Дата» не дата: «31.01.2025»',
      'Курс USDT/RUB должен быть числом больше нуля, а стоит «0»',
      'Место «Сбер»: не число «много»',
      'Есть суммы в EUR, но не заполнен курс EUR/USD',
    ])
  })

  it('blocks a row with an empty total, since an Excel error cell is read as empty', () => {
    const parsed = parseWorkbook(book([place], [...SNAP_HEAD, 'Сбер'], [row({ 4: null })]))
    expect(parsed.issues.map((i) => i.message)).toEqual([
      'Пустой «Итог ₽» — нужен итог из вашего Excel (ошибка формулы в Excel тоже читается как пустая ячейка)',
    ])
    expect(parsed.issues[0]).toMatchObject({ sheet: 'Срезы', row: 4 })
    expect(parsed.snapshots).toEqual([])
  })

  it('reports a duplicated header column once, with the header row', () => {
    const parsed = parseWorkbook(book([place], [...SNAP_HEAD, 'Сбер', 'Сбер'], [[...row(), 1, 1]]))
    expect(parsed.issues).toEqual([{ sheet: 'Срезы', row: 3, message: 'Колонка «Сбер» встречается дважды' }])
  })

  it('reports a duplicated fixed column', () => {
    expect(messages(book([place], [...SNAP_HEAD, 'USDT/RUB', 'Сбер'], []))).toEqual([
      'Колонка «USDT/RUB» встречается дважды',
    ])
  })

  it('explains a place that failed validation on Места only once', () => {
    expect(messages(book([['Касса', 'Наличные', 'GBP', 'нал']], [...SNAP_HEAD, 'Касса'], [row()]))).toEqual([
      'У места «Касса» неизвестная валюта «GBP» — нужна RUB, USD, EUR или BTC',
    ])
  })

  it('does not take Object.prototype keys for a form', () => {
    expect(messages(book([['Сейф', 'Наличные', 'RUB', 'constructor']], [...SNAP_HEAD], []))).toEqual([
      'У места «Сейф» неизвестная форма «constructor» — нужна нал, безнал или —',
    ])
  })

  it('treats an invalid Date as a non-date instead of throwing', () => {
    expect(messages(book([place], [...SNAP_HEAD, 'Сбер'], [row({ 0: new Date('nope') })]))).toEqual([
      'В колонке «Дата» не дата: «Invalid Date»',
    ])
  })

  it('reports a missing column on Места', () => {
    const sheets: RawSheet[] = [
      { sheet: 'Места', data: [['Место', 'Категория', 'Валюта'], place] },
      { sheet: 'Срезы', data: [SNAP_HEAD] },
    ]
    expect(messages(sheets)).toEqual(['Нет колонок: Форма'])
  })

  it('numbers issues by the Excel row', () => {
    const parsed = parseWorkbook(book([place], [...SNAP_HEAD, 'Сбер'], [row({ 0: 'x' })]))
    expect(parsed.issues[0]).toMatchObject({ sheet: 'Срезы', row: 4 })
  })
})
