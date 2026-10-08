import type { Currency, PlaceForm, Rates } from '../model/types'

export type Cell = string | number | boolean | Date | null

export interface RawSheet {
  sheet: string
  data: Cell[][]
}

export interface ImportPlace {
  name: string
  category: string
  currency: Currency
  form: PlaceForm
}

export interface ImportSnapshot {
  row: number // Excel row number, for messages
  period: string
  snapshotDate: string
  rates: Rates
  amounts: Record<string, number> // place name → amount in the place's currency
  reportedTotalRub: number | null
}

type SheetName = 'Места' | 'Срезы'

export interface ImportIssue {
  sheet: SheetName | null
  row: number | null
  message: string
}

export interface ParsedWorkbook {
  places: ImportPlace[]
  snapshots: ImportSnapshot[]
  issues: ImportIssue[]
}

const PLACES: SheetName = 'Места'
const SNAPSHOTS: SheetName = 'Срезы'
const DATE = 'Дата'
const USDT_RUB = 'USDT/RUB'
const EUR_USD = 'EUR/USD'
const BTC_USD = 'BTC/USD'
const TOTAL = 'Итог ₽'
const FIXED_COLUMNS = [DATE, USDT_RUB, EUR_USD, BTC_USD, TOTAL]

// USDT is priced by the same P2P rate as the dollar, so it is the same currency here.
const CURRENCY_BY_LABEL: Record<string, Currency> = {
  RUB: 'RUB',
  USD: 'USD',
  USDT: 'USD',
  EUR: 'EUR',
  BTC: 'BTC',
}

const FORM_BY_LABEL: Record<string, PlaceForm> = {
  нал: 'cash',
  безнал: 'noncash',
  '—': 'none',
  '-': 'none',
  '': 'none',
}

// Plain lookup: keys like "constructor" must not resolve through Object.prototype.
function lookup<T>(table: Record<string, T>, key: string): T | undefined {
  return Object.hasOwn(table, key) ? table[key] : undefined
}

function text(c: Cell | undefined): string {
  return c === null || c === undefined ? '' : String(c).trim()
}

function isBlank(c: Cell | undefined): boolean {
  return text(c) === ''
}

function isBlankRow(r: Cell[]): boolean {
  return r.every(isBlank)
}

interface ParsedPlaces {
  places: ImportPlace[]
  // every name that appears on «Места», valid or not: an invalid one is already explained there
  knownNames: Set<string>
}

function parsePlaces(data: Cell[][], issues: ImportIssue[]): ParsedPlaces {
  const head = (data[0] ?? []).map(text)
  const col = {
    name: head.indexOf('Место'),
    category: head.indexOf('Категория'),
    currency: head.indexOf('Валюта'),
    form: head.indexOf('Форма'),
  }
  const missing = (['Место', 'Категория', 'Валюта', 'Форма'] as const).filter((h) => !head.includes(h))
  if (missing.length > 0) {
    issues.push({ sheet: PLACES, row: 1, message: `Нет колонок: ${missing.join(', ')}` })
    return { places: [], knownNames: new Set() }
  }

  const places: ImportPlace[] = []
  const seen = new Set<string>()
  for (let i = 1; i < data.length; i++) {
    const r = data[i]
    if (isBlankRow(r)) continue
    const issue = (message: string) => issues.push({ sheet: PLACES, row: i + 1, message })

    const name = text(r[col.name])
    const category = text(r[col.category])
    if (!name) {
      issue('Пустое имя места')
      continue
    }
    if (seen.has(name)) {
      issue(`Место «${name}» встречается дважды`)
      continue
    }
    seen.add(name)
    if (!category) {
      issue(`У места «${name}» пустая категория`)
      continue
    }
    const currency = lookup(CURRENCY_BY_LABEL, text(r[col.currency]).toUpperCase())
    if (!currency) {
      issue(`У места «${name}» неизвестная валюта «${text(r[col.currency])}» — нужна RUB, USD, EUR или BTC`)
      continue
    }
    const form = lookup(FORM_BY_LABEL, text(r[col.form]).toLowerCase())
    if (!form) {
      issue(`У места «${name}» неизвестная форма «${text(r[col.form])}» — нужна нал, безнал или —`)
      continue
    }
    places.push({ name, category, currency, form })
  }
  return { places, knownNames: seen }
}

function parseSnapshots(
  data: Cell[][],
  { places, knownNames }: ParsedPlaces,
  issues: ImportIssue[],
  today: string,
): ImportSnapshot[] {
  const headerIndex = data.findIndex((r) => text(r[0]) === DATE)
  if (headerIndex < 0) {
    issues.push({
      sheet: SNAPSHOTS,
      row: null,
      message: 'Не найдена строка заголовков: в колонке A должно стоять «Дата»',
    })
    return []
  }
  const head = data[headerIndex].map(text)
  const headerRow = headerIndex + 1
  const missing = FIXED_COLUMNS.filter((h) => !head.includes(h))
  if (missing.length > 0) {
    issues.push({ sheet: SNAPSHOTS, row: headerRow, message: `Нет колонок: ${missing.join(', ')}` })
  }
  // A repeated header would make "which column?" a silent guess.
  const counts = new Map<string, number>()
  for (const h of head) if (h) counts.set(h, (counts.get(h) ?? 0) + 1)
  const duplicated = [...counts].filter(([, n]) => n > 1).map(([h]) => h)
  for (const h of duplicated) {
    issues.push({ sheet: SNAPSHOTS, row: headerRow, message: `Колонка «${h}» встречается дважды` })
  }
  if (missing.length > 0 || duplicated.length > 0) return []
  const col = (h: string) => head.indexOf(h)

  const currencyOf = new Map(places.map((p) => [p.name, p.currency]))
  const placeColumns: { name: string; index: number }[] = []
  head.forEach((h, index) => {
    if (!h || FIXED_COLUMNS.includes(h)) return
    if (currencyOf.has(h)) placeColumns.push({ name: h, index })
    else if (!knownNames.has(h))
      issues.push({
        sheet: SNAPSHOTS,
        row: headerRow,
        message: `Колонка «${h}» — такого места нет на листе «Места»`,
      })
  })

  const snapshots: ImportSnapshot[] = []
  const firstRowOfPeriod = new Map<string, number>()
  for (let i = headerIndex + 1; i < data.length; i++) {
    const r = data[i]
    if (isBlankRow(r)) continue
    const row = i + 1
    const issue = (message: string) => issues.push({ sheet: SNAPSHOTS, row, message })

    const date = r[col(DATE)]
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
      issue(`В колонке «Дата» не дата: «${text(date)}»`)
      continue
    }
    // read-excel-file returns dates as UTC midnight.
    const snapshotDate = date.toISOString().slice(0, 10)
    // A pre-filled future row (date by formula, total 0) would occupy a month and block the
    // real snapshot later; snapshots cannot be deleted from the app. It must not claim the month.
    if (snapshotDate > today) {
      issue(`Дата среза в будущем: «${snapshotDate}»`)
      continue
    }
    const period = snapshotDate.slice(0, 7)
    const first = firstRowOfPeriod.get(period)
    if (first !== undefined) {
      issue(`Второй срез за ${period} — первый в строке ${first}`)
      continue
    }
    firstRowOfPeriod.set(period, row)

    let broken = false
    const rate = (label: string, required: boolean): number | null => {
      const c = r[col(label)]
      if (!required && isBlank(c)) return null
      if (typeof c === 'number' && c > 0) return c
      issue(`Курс ${label} должен быть числом больше нуля, а стоит «${text(c)}»`)
      broken = true
      return null
    }
    const usdtRub = rate(USDT_RUB, true)
    const eurUsd = rate(EUR_USD, false)
    const btcUsd = rate(BTC_USD, true)

    const amounts: Record<string, number> = {}
    for (const { name, index } of placeColumns) {
      const c = r[index]
      if (isBlank(c)) amounts[name] = 0
      else if (typeof c === 'number') amounts[name] = c
      else {
        issue(`Место «${name}»: не число «${text(c)}»`)
        broken = true
      }
    }

    if (!broken && placeColumns.length > 0 && placeColumns.every(({ name }) => amounts[name] === 0)) {
      issue('Все суммы в строке нулевые — похоже на заготовку будущего месяца')
      continue
    }

    const hasEuros = placeColumns.some(({ name }) => currencyOf.get(name) === 'EUR' && (amounts[name] ?? 0) !== 0)
    if (hasEuros && eurUsd === null && !broken) {
      issue('Есть суммы в EUR, но не заполнен курс EUR/USD')
      broken = true
    }

    const totalCell = r[col(TOTAL)]
    // Required: read-excel-file turns Excel error cells (#REF!, #N/A) into empty ones, so an
    // optional total would let a broken formula pass as a silent zero.
    let reportedTotalRub: number | null = null
    if (typeof totalCell === 'number') reportedTotalRub = totalCell
    else if (isBlank(totalCell)) {
      issue(`Пустой «${TOTAL}» — нужен итог из вашего Excel (ошибка формулы в Excel тоже читается как пустая ячейка)`)
      broken = true
    } else {
      issue(`«${TOTAL}» не число: «${text(totalCell)}»`)
      broken = true
    }

    if (broken || usdtRub === null || btcUsd === null) continue
    snapshots.push({ row, period, snapshotDate, rates: { usdtRub, eurUsd, btcUsd }, amounts, reportedTotalRub })
  }
  return snapshots
}

export function parseWorkbook(sheets: RawSheet[], today: Date = new Date()): ParsedWorkbook {
  const issues: ImportIssue[] = []
  const placesSheet = sheets.find((s) => s.sheet === PLACES)
  const snapshotsSheet = sheets.find((s) => s.sheet === SNAPSHOTS)
  for (const [name, sheet] of [[PLACES, placesSheet], [SNAPSHOTS, snapshotsSheet]] as const) {
    if (!sheet) issues.push({ sheet: null, row: null, message: `Нет листа «${name}»` })
  }
  if (!placesSheet || !snapshotsSheet) return { places: [], snapshots: [], issues }

  const parsedPlaces = parsePlaces(placesSheet.data, issues)
  const snapshots = parseSnapshots(snapshotsSheet.data, parsedPlaces, issues, today.toISOString().slice(0, 10))
  return { places: parsedPlaces.places, snapshots, issues }
}
