# Неделя 1: модель, расчёт, импорт со сверкой — план реализации

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** владелец выбирает `.xlsx` формата шаблона, видит каждую строку со
сверкой «итог Excel ↔ итог приложения» и одной кнопкой записывает места и срезы
в новую схему Supabase.

**Architecture:** чистые модули без React и без сети — расчёт
(`src/model/`), разбор книги, сверка и план импорта (`src/import/`) — покрыты
vitest, в том числе на настоящем файле шаблона. Тонкий слой данных
(`src/data/`) пишет в Supabase. Экран `/import` склеивает одно с другим. Старые
страницы и старая модель удаляются: схема меняется, и они всё равно перестанут
работать.

**Tech Stack:** React 19, Vite 8, TypeScript 6, Supabase JS 2, vitest 5.0.3,
read-excel-file 9.3.12.

**Спецификация:** `docs/superpowers/specs/2026-10-05-srez-rebuild-design.md`.

## Global Constraints

- Ветка `rebuild`. Пуш — только по просьбе владельца.
- Один коммит — одна задача; тело коммита объясняет *почему*. Сообщения коммитов
  на английском, комментарии в коде на английском, тексты интерфейса на русском.
- Каждый коммит заканчивается строкой
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Пересчёт в рубли: RUB × 1 · USD × `usdtRub` · EUR × `eurUsd` × `usdtRub` ·
  BTC × `btcUsd` × `usdtRub`. Курса ЦБ нет нигде.
- Валюты: `RUB`, `USD`, `EUR`, `BTC`. Формы: `cash`, `noncash`, `none`.
- Допуск сверки — 1 ₽ включительно.
- Цвета и размеры — только через токены и существующие классы `src/styles/app.css`;
  литералов цвета в компонентах нет.
- Тест сначала падает. Когда реализацию ломают нарочно, чтобы увидеть красный, —
  `git diff` показывает поломку, иначе прогон ничего не доказывает.
- Экран проверяется открытием в браузере, а не чтением кода.
- Настоящий Excel владельца в репозиторий не попадает (`.gitignore` закрывает
  `*.xlsx` кроме шаблона).

## Карта файлов

| Файл | Ответственность |
|---|---|
| `vitest.config.ts` | Конфиг тестов, отдельно от `vite.config.ts` |
| `src/model/types.ts` | Типы предметной области: валюта, форма, место, курсы, срез |
| `src/model/valuation.ts` | Пересчёт суммы в рубли и итог в трёх мерах |
| `src/import/parseWorkbook.ts` | Листы «Места» и «Срезы» → места, срезы, ошибки формата |
| `src/import/reconcile.ts` | Вердикт по строке: совпало / разошлось / нет итога |
| `src/import/planImport.ts` | Что создать, что пропустить, что конфликтует; строки среза для базы |
| `src/import/readWorkbook.ts` | Браузерный адаптер: `File` → листы |
| `src/data/places.ts`, `src/data/snapshots.ts` | Чтение и вставка в Supabase |
| `src/data/commitImport.ts` | Исполнение плана импорта |
| `src/pages/Import.tsx`, `src/pages/Overview.tsx` | Экран импорта; заглушка обзора до недели 2 |
| `supabase/schema.sql` | Новая схема (удаляет старые таблицы) |
| `scripts/check-schema.mjs` | Проверка без пароля, что новая схема на месте |
| `docs/import/save-through-excel.ps1` | Пересохранение шаблона через Excel |

---

### Task 1: Тестовый контур, модель и расчёт

**Files:**
- Create: `vitest.config.ts`, `src/model/types.ts`, `src/model/valuation.ts`, `src/model/valuation.test.ts`
- Modify: `package.json` (скрипт `test`, devDependency), `tsconfig.app.json` (исключить тесты)

**Interfaces:**
- Produces:
  - `type Currency = 'RUB' | 'USD' | 'EUR' | 'BTC'`, `const CURRENCIES: readonly Currency[]`
  - `type PlaceForm = 'cash' | 'noncash' | 'none'`, `type Chain = 'ethereum' | 'bitcoin' | 'solana'`
  - `interface Rates { usdtRub: number; eurUsd: number | null; btcUsd: number }`
  - `interface Place { id; name; category; currency: Currency; form: PlaceForm; sortOrder: number; chain: Chain | null; address: string | null }`
  - `interface SnapshotEntry { placeId: string; amount: number; detail?: unknown }`
  - `interface Snapshot { id; period; snapshotDate; rates: Rates; entries: SnapshotEntry[]; reportedTotalRub: number | null; source: SnapshotSource; createdAt }`, `type SnapshotSource = 'import' | 'manual'`
  - `toRub(amount: number, currency: Currency, rates: Rates): number`
  - `interface Totals { rub: number; usd: number; btc: number }`, `totalsFromRub(rub: number, rates: Rates): Totals`

- [ ] **Step 1: Поставить vitest и завести скрипт**

```bash
npm i -D vitest@5.0.3
```

В `package.json`, в `scripts`, после `"lint": "oxlint",` добавить:

```json
    "test": "vitest run",
```

Создать `vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'

// Separate from vite.config.ts: tests exercise plain modules and need neither
// the React plugin nor the Pages base path.
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
```

В `tsconfig.app.json` после `"include": ["src"]` добавить исключение, иначе
`tsc -b` начнёт проверять тесты и тестовые фикстуры с `node:`-импортами без
типов Node:

```json
  "include": ["src"],
  "exclude": ["src/**/*.test.ts", "src/**/*.fixture.ts"]
```

- [ ] **Step 2: Написать падающий тест расчёта**

Ожидание 5 427 016 посчитано руками по первой строке шаблона, а не взято из
Excel: RUB 2 355 000 + USD 4 500 × 101 + EUR 400 × 1,04 × 101 + BTC 0,25 × 102 000 × 101.

`src/model/valuation.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { toRub, totalsFromRub } from './valuation'
import type { Currency, Rates } from './types'

const rates: Rates = { usdtRub: 101, eurUsd: 1.04, btcUsd: 102000 }

describe('toRub', () => {
  it('converts each currency through the P2P dollar', () => {
    expect(toRub(1000, 'RUB', rates)).toBe(1000)
    expect(toRub(10, 'USD', rates)).toBe(1010)
    expect(toRub(400, 'EUR', rates)).toBeCloseTo(42016, 6)
    expect(toRub(0.25, 'BTC', rates)).toBeCloseTo(2575500, 6)
  })

  it('treats a zero amount as zero even without a EUR/USD rate', () => {
    expect(toRub(0, 'EUR', { ...rates, eurUsd: null })).toBe(0)
  })

  it('refuses a euro amount without a EUR/USD rate', () => {
    expect(() => toRub(5, 'EUR', { ...rates, eurUsd: null })).toThrow(/EUR\/USD/)
  })

  it('reproduces the first template row computed by hand', () => {
    const row: [number, Currency][] = [
      [420000, 'RUB'], [85000, 'RUB'], [3000, 'USD'], [60000, 'RUB'], [50000, 'RUB'],
      [1500, 'USD'], [400, 'EUR'], [0.25, 'BTC'], [1500000, 'RUB'], [240000, 'RUB'],
    ]
    const total = row.reduce((sum, [amount, currency]) => sum + toRub(amount, currency, rates), 0)
    expect(total).toBeCloseTo(5427016, 6)
  })
})

describe('totalsFromRub', () => {
  it('derives dollars and bitcoin from rubles with the same rates', () => {
    const t = totalsFromRub(5427016, rates)
    expect(t.rub).toBe(5427016)
    expect(t.usd).toBeCloseTo(53732.831683, 4)
    expect(t.btc).toBeCloseTo(0.526792467, 8)
  })
})
```

- [ ] **Step 3: Убедиться, что тест падает**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./valuation"`.

- [ ] **Step 4: Написать типы и расчёт**

`src/model/types.ts`:

```ts
export type Currency = 'RUB' | 'USD' | 'EUR' | 'BTC'
export const CURRENCIES: readonly Currency[] = ['RUB', 'USD', 'EUR', 'BTC']

export type PlaceForm = 'cash' | 'noncash' | 'none'

export type Chain = 'ethereum' | 'bitcoin' | 'solana'

// The ruble is defined by one number only: the P2P USDT rate. Euros reach
// rubles through EUR/USD, which may be absent for months without euros.
export interface Rates {
  usdtRub: number
  eurUsd: number | null
  btcUsd: number
}

export interface Place {
  id: string
  name: string
  category: string
  currency: Currency
  form: PlaceForm
  sortOrder: number
  chain: Chain | null
  address: string | null
}

export interface SnapshotEntry {
  placeId: string
  amount: number
  detail?: unknown
}

export type SnapshotSource = 'import' | 'manual'

export interface Snapshot {
  id: string
  period: string // 'YYYY-MM'
  snapshotDate: string // 'YYYY-MM-DD'
  rates: Rates
  entries: SnapshotEntry[]
  reportedTotalRub: number | null
  source: SnapshotSource
  createdAt: string
}
```

`src/model/valuation.ts`:

```ts
import type { Currency, Rates } from './types'

// Same rule as the "Итог ₽" formula in docs/import/import-template.xlsx.
export function toRub(amount: number, currency: Currency, rates: Rates): number {
  if (amount === 0) return 0
  switch (currency) {
    case 'RUB':
      return amount
    case 'USD':
      return amount * rates.usdtRub
    case 'EUR':
      if (rates.eurUsd === null) throw new Error('EUR/USD rate is missing for a euro amount')
      return amount * rates.eurUsd * rates.usdtRub
    case 'BTC':
      return amount * rates.btcUsd * rates.usdtRub
  }
}

export interface Totals {
  rub: number
  usd: number
  btc: number
}

export function totalsFromRub(rub: number, rates: Rates): Totals {
  const usd = rub / rates.usdtRub
  return { rub, usd, btc: usd / rates.btcUsd }
}
```

- [ ] **Step 5: Прогнать тесты**

Run: `npm test`
Expected: PASS, 5 tests.

- [ ] **Step 6: Увидеть красный на настоящей поломке**

В `src/model/valuation.ts` заменить строку BTC на
`return amount * rates.btcUsd` (без `* rates.usdtRub`).
Run: `git diff src/model/valuation.ts` — в диффе видна именно эта строка.
Run: `npm test`
Expected: FAIL в `converts each currency…` и `reproduces the first template row…`.
Вернуть строку: `git checkout src/model/valuation.ts`, `npm test` — PASS.

- [ ] **Step 7: Проверить сборку**

Run: `npx tsc -b`
Expected: без ошибок.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tsconfig.app.json src/model
git commit -m "Add the valuation rule under test, with a test runner the repo never had" -m "The wallet work was reported as covered by 16 tests, but no test was ever committed and package.json had no test script. The valuation rule is the thing every number on the dashboard rests on, so it comes first and is pinned to a hand-computed template row." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Шаблон, сохранённый через Excel, и страж этого

**Files:**
- Create: `docs/import/save-through-excel.ps1`, `src/import/template.fixture.ts`, `src/import/template.test.ts`
- Modify: `docs/import/make-template.py` (строка запуска в шапке), `docs/import/import-template.xlsx` (пересохранение)

**Interfaces:**
- Produces: `docs/import/import-template.xlsx` с вычисленными значениями формул; `TEMPLATE_PATH: string` из `src/import/template.fixture.ts` — путь к нему для задач 3 и 4. Путь живёт не в `.test.ts`: импорт тестового файла в другой тестовый файл заново регистрирует его тесты.

Почему: `read-excel-file` не считает формулы, а берёт значения, которые сохранил
Excel. Файл прямо из `make-template.py` читается с пустой колонкой «Итог ₽» —
проверено 2026-10-08. Сверка на таком файле невозможна.

- [ ] **Step 1: Поставить read-excel-file**

```bash
npm i read-excel-file@9.3.12
```

- [ ] **Step 2: Написать падающий тест-страж**

`src/import/template.fixture.ts`:

```ts
import { fileURLToPath } from 'node:url'

// The import contract itself is the fixture: tests read the very file the owner
// copies, not a separate sample that could drift from it.
export const TEMPLATE_PATH = fileURLToPath(new URL('../../docs/import/import-template.xlsx', import.meta.url))
```

`src/import/template.test.ts`:

```ts
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
```

- [ ] **Step 3: Убедиться, что тест падает на нынешнем шаблоне**

Run: `npm test`
Expected: FAIL в `carries totals computed by Excel` — `expected false to be true`
(итоги читаются как `null`).

- [ ] **Step 4: Скрипт пересохранения через Excel**

`docs/import/save-through-excel.ps1` (только латиница: PowerShell 5.1 читает
UTF-8 без BOM как ANSI):

```powershell
# Recalculates import-template.xlsx in Excel and saves it in place, so formula
# cells carry cached values. read-excel-file returns cached values only.
# Run after make-template.py: powershell -File docs/import/save-through-excel.ps1
$ErrorActionPreference = 'Stop'
$path = Join-Path $PSScriptRoot 'import-template.xlsx'
$xl = New-Object -ComObject Excel.Application
$xl.Visible = $false
$xl.DisplayAlerts = $false
try {
  $wb = $xl.Workbooks.Open($path)
  $xl.CalculateFull()
  $wb.Save()
  $wb.Close($false)
} finally {
  $xl.Quit()
  [void][Runtime.InteropServices.Marshal]::ReleaseComObject($xl)
}
Write-Output "saved through Excel: $path"
```

В `docs/import/make-template.py` заменить вторую строку шапки
`# Run: python docs/import/make-template.py` на:

```python
# Run: python docs/import/make-template.py
#      powershell -File docs/import/save-through-excel.ps1   (fills formula values)
```

- [ ] **Step 5: Пересобрать и пересохранить шаблон**

```bash
python docs/import/make-template.py
powershell -NoProfile -File docs/import/save-through-excel.ps1
```

Expected: `saved …import-template.xlsx`, затем `saved through Excel: …`.

- [ ] **Step 6: Прогнать тесты**

Run: `npm test`
Expected: PASS, 6 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json docs/import src/import/template.fixture.ts src/import/template.test.ts
git commit -m "Store the import template with Excel-computed totals" -m "read-excel-file returns cached formula values only, so a template written by the generator alone read back with an empty total column and could not be reconciled. A test now fails if the template is ever committed without passing through Excel." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Разбор книги

**Files:**
- Create: `src/import/parseWorkbook.ts`, `src/import/parseWorkbook.test.ts`

**Interfaces:**
- Consumes: `Currency`, `PlaceForm`, `Rates` из `src/model/types.ts`; `TEMPLATE_PATH` из `src/import/template.fixture.ts`.
- Produces:
  - `type Cell = string | number | boolean | Date | null`, `interface RawSheet { sheet: string; data: Cell[][] }`
  - `interface ImportPlace { name: string; category: string; currency: Currency; form: PlaceForm }`
  - `interface ImportSnapshot { row: number; period: string; snapshotDate: string; rates: Rates; amounts: Record<string, number>; reportedTotalRub: number | null }`
  - `interface ImportIssue { sheet: 'Места' | 'Срезы' | null; row: number | null; message: string }`
  - `interface ParsedWorkbook { places: ImportPlace[]; snapshots: ImportSnapshot[]; issues: ImportIssue[] }`
  - `parseWorkbook(sheets: RawSheet[]): ParsedWorkbook`

Правила, которые реализуются (из спецификации и сессии 2026-10-05):

- строка заголовков «Срезов» — первая, где в колонке A стоит «Дата»; всё выше игнорируется (там заголовок и серая строка валют);
- обязательные колонки «Срезов»: «Дата», «USDT/RUB», «EUR/USD», «BTC/USD», «Итог ₽»; всё остальное с непустым заголовком — места;
- пустая ячейка суммы — 0 (место ещё не открыто); пустой «Итог ₽» — `null`; пустой EUR/USD — `null`, но ошибка, если в строке есть ненулевая сумма в EUR;
- «USDT» в валюте места — синоним USD; форма «нал» / «безнал» / «—», «-» или пусто;
- полностью пустые строки пропускаются; второй срез в том же месяце — ошибка.

- [ ] **Step 1: Написать падающие тесты**

`src/import/parseWorkbook.test.ts`:

```ts
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

  it('keeps an empty Excel total as null', () => {
    const parsed = parseWorkbook(
      book([['Сбер', 'Банки', 'RUB', 'безнал']], [...SNAP_HEAD, 'Сбер'], [[d('2025-01-31'), 100, 1.1, 90000, null, 5]]),
    )
    expect(parsed.snapshots[0].reportedTotalRub).toBeNull()
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

  it('numbers issues by the Excel row', () => {
    const parsed = parseWorkbook(book([place], [...SNAP_HEAD, 'Сбер'], [row({ 0: 'x' })]))
    expect(parsed.issues[0]).toMatchObject({ sheet: 'Срезы', row: 4 })
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./parseWorkbook"`.

- [ ] **Step 3: Реализовать разбор**

`src/import/parseWorkbook.ts`:

```ts
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

function text(c: Cell | undefined): string {
  return c === null || c === undefined ? '' : String(c).trim()
}

function isBlank(c: Cell | undefined): boolean {
  return text(c) === ''
}

function isBlankRow(r: Cell[]): boolean {
  return r.every(isBlank)
}

function parsePlaces(data: Cell[][], issues: ImportIssue[]): ImportPlace[] {
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
    return []
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
    const currency = CURRENCY_BY_LABEL[text(r[col.currency]).toUpperCase()]
    if (!currency) {
      issue(`У места «${name}» неизвестная валюта «${text(r[col.currency])}» — нужна RUB, USD, EUR или BTC`)
      continue
    }
    const form = FORM_BY_LABEL[text(r[col.form]).toLowerCase()]
    if (!form) {
      issue(`У места «${name}» неизвестная форма «${text(r[col.form])}» — нужна нал, безнал или —`)
      continue
    }
    places.push({ name, category, currency, form })
  }
  return places
}

function parseSnapshots(data: Cell[][], places: ImportPlace[], issues: ImportIssue[]): ImportSnapshot[] {
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
  const missing = FIXED_COLUMNS.filter((h) => !head.includes(h))
  if (missing.length > 0) {
    issues.push({ sheet: SNAPSHOTS, row: headerIndex + 1, message: `Нет колонок: ${missing.join(', ')}` })
    return []
  }
  const col = (h: string) => head.indexOf(h)

  const currencyOf = new Map(places.map((p) => [p.name, p.currency]))
  const placeColumns: { name: string; index: number }[] = []
  head.forEach((h, index) => {
    if (!h || FIXED_COLUMNS.includes(h)) return
    if (currencyOf.has(h)) placeColumns.push({ name: h, index })
    else
      issues.push({
        sheet: SNAPSHOTS,
        row: headerIndex + 1,
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
    if (!(date instanceof Date)) {
      issue(`В колонке «Дата» не дата: «${text(date)}»`)
      continue
    }
    // read-excel-file returns dates as UTC midnight.
    const snapshotDate = date.toISOString().slice(0, 10)
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

    const hasEuros = placeColumns.some(({ name }) => currencyOf.get(name) === 'EUR' && (amounts[name] ?? 0) !== 0)
    if (hasEuros && eurUsd === null && !broken) {
      issue('Есть суммы в EUR, но не заполнен курс EUR/USD')
      broken = true
    }

    const totalCell = r[col(TOTAL)]
    let reportedTotalRub: number | null = null
    if (typeof totalCell === 'number') reportedTotalRub = totalCell
    else if (!isBlank(totalCell)) {
      issue(`«${TOTAL}» не число: «${text(totalCell)}»`)
      broken = true
    }

    if (broken || usdtRub === null || btcUsd === null) continue
    snapshots.push({ row, period, snapshotDate, rates: { usdtRub, eurUsd, btcUsd }, amounts, reportedTotalRub })
  }
  return snapshots
}

export function parseWorkbook(sheets: RawSheet[]): ParsedWorkbook {
  const issues: ImportIssue[] = []
  const placesSheet = sheets.find((s) => s.sheet === PLACES)
  const snapshotsSheet = sheets.find((s) => s.sheet === SNAPSHOTS)
  for (const [name, sheet] of [[PLACES, placesSheet], [SNAPSHOTS, snapshotsSheet]] as const) {
    if (!sheet) issues.push({ sheet: null, row: null, message: `Нет листа «${name}»` })
  }
  if (!placesSheet || !snapshotsSheet) return { places: [], snapshots: [], issues }

  const places = parsePlaces(placesSheet.data, issues)
  const snapshots = parseSnapshots(snapshotsSheet.data, places, issues)
  return { places, snapshots, issues }
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS, 17 tests. Если падает тест с порядком сообщений — сверить порядок
проверок в реализации с порядком в тесте, а не переписывать ожидание.

- [ ] **Step 5: Commit**

```bash
git add src/import/parseWorkbook.ts src/import/parseWorkbook.test.ts
git commit -m "Parse the import workbook into places, snapshots and format issues" -m "The parser knows only the template contract, never the owner's 19 crypto tables: the owner maps his Excel onto the contract by formulas, and every deviation surfaces as a message with its Excel row instead of a silent guess." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Сверка — вердикт по строке

**Files:**
- Create: `src/import/reconcile.ts`, `src/import/reconcile.test.ts`

**Interfaces:**
- Consumes: `toRub` из `src/model/valuation.ts`; `ImportPlace`, `ImportSnapshot`, `RawSheet`, `parseWorkbook` из `src/import/parseWorkbook.ts`; `TEMPLATE_PATH`.
- Produces:
  - `const RECONCILE_TOLERANCE_RUB = 1`
  - `type ReconcileStatus = 'match' | 'mismatch' | 'no-total'`
  - `interface Reconciliation { row: number; period: string; computedRub: number; reportedRub: number | null; diffRub: number | null; status: ReconcileStatus }`
  - `reconcile(snapshot: ImportSnapshot, places: ImportPlace[]): Reconciliation`

- [ ] **Step 1: Написать падающие тесты на вердикт**

`src/import/reconcile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import readXlsxFile from 'read-excel-file/node'
import { parseWorkbook, type ImportPlace, type ImportSnapshot, type RawSheet } from './parseWorkbook'
import { reconcile } from './reconcile'
import { TEMPLATE_PATH } from './template.fixture'

const places: ImportPlace[] = [
  { name: 'Сбер', category: 'Банки', currency: 'RUB', form: 'noncash' },
  { name: 'Крипта', category: 'Крипта', currency: 'BTC', form: 'noncash' },
]
const snapshot = (amounts: Record<string, number>, reportedTotalRub: number | null): ImportSnapshot => ({
  row: 4,
  period: '2025-01',
  snapshotDate: '2025-01-31',
  rates: { usdtRub: 100, eurUsd: null, btcUsd: 100000 },
  amounts,
  reportedTotalRub,
})

describe('reconcile', () => {
  it('says match when the totals differ by at most one ruble', () => {
    const r = reconcile(snapshot({ Сбер: 1000, Крипта: 0.01 }, 101000.6), places)
    expect(r.status).toBe('match')
    expect(r.computedRub).toBeCloseTo(101000, 6)
    expect(r.diffRub).toBeCloseTo(-0.6, 6)
  })

  it('says mismatch beyond one ruble and keeps the sign of the difference', () => {
    const r = reconcile(snapshot({ Сбер: 1000, Крипта: 0.01 }, 100998), places)
    expect(r.status).toBe('mismatch')
    expect(r.diffRub).toBeCloseTo(2, 6)
  })

  it('says no-total when Excel gave no total', () => {
    expect(reconcile(snapshot({ Сбер: 1 }, null), places)).toMatchObject({ status: 'no-total', diffRub: null })
  })

  it('matches every row of the real template, where Excel computed the totals', async () => {
    const parsed = parseWorkbook((await readXlsxFile(TEMPLATE_PATH)) as unknown as RawSheet[])
    const verdicts = parsed.snapshots.map((s) => reconcile(s, parsed.places).status)
    expect(verdicts).toEqual(['match', 'match', 'match', 'match', 'match', 'match'])
  })

  it('catches a changed amount in a real template row', async () => {
    const parsed = parseWorkbook((await readXlsxFile(TEMPLATE_PATH)) as unknown as RawSheet[])
    const tampered = { ...parsed.snapshots[2], amounts: { ...parsed.snapshots[2].amounts, Сбер: 380002 } }
    expect(reconcile(tampered, parsed.places).status).toBe('mismatch')
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./reconcile"`.

- [ ] **Step 3: Реализовать сверку**

`src/import/reconcile.ts`:

```ts
import { toRub } from '../model/valuation'
import type { ImportPlace, ImportSnapshot } from './parseWorkbook'

export const RECONCILE_TOLERANCE_RUB = 1

export type ReconcileStatus = 'match' | 'mismatch' | 'no-total'

export interface Reconciliation {
  row: number
  period: string
  computedRub: number
  reportedRub: number | null
  diffRub: number | null // computed minus reported
  status: ReconcileStatus
}

export function reconcile(snapshot: ImportSnapshot, places: ImportPlace[]): Reconciliation {
  const currencyOf = new Map(places.map((p) => [p.name, p.currency]))
  let computedRub = 0
  for (const [name, amount] of Object.entries(snapshot.amounts)) {
    const currency = currencyOf.get(name)
    if (!currency) throw new Error(`Snapshot row ${snapshot.row} has an amount for unknown place ${name}`)
    computedRub += toRub(amount, currency, snapshot.rates)
  }

  const base = { row: snapshot.row, period: snapshot.period, computedRub, reportedRub: snapshot.reportedTotalRub }
  if (snapshot.reportedTotalRub === null) return { ...base, diffRub: null, status: 'no-total' }
  const diffRub = computedRub - snapshot.reportedTotalRub
  return { ...base, diffRub, status: Math.abs(diffRub) <= RECONCILE_TOLERANCE_RUB ? 'match' : 'mismatch' }
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS, 22 tests.

- [ ] **Step 5: Увидеть красный на сломанном правиле евро**

В `src/model/valuation.ts` в ветке `EUR` заменить
`return amount * rates.eurUsd * rates.usdtRub` на `return amount * rates.usdtRub`.
Run: `git diff src/model/valuation.ts` — видна именно эта строка.
Run: `npm test`
Expected: FAIL в `matches every row of the real template…` — вердикты
`mismatch` в каждой строке (евро есть во всех шести). Это и есть проверка, что
сверка ловит неверное правило пересчёта, а не только неверные суммы.
Вернуть: `git checkout src/model/valuation.ts`, `npm test` — PASS.

- [ ] **Step 6: Commit**

```bash
git add src/import/reconcile.ts src/import/reconcile.test.ts
git commit -m "Reconcile each imported row against the total Excel computed" -m "The import is accepted on a verdict, not on 'it loaded': a row matches only when the app's own total lands within a ruble of Excel's. The real template is the fixture, and a broken euro rule turns every row red." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: План импорта

**Files:**
- Create: `src/import/planImport.ts`, `src/import/planImport.test.ts`

**Interfaces:**
- Consumes: `ParsedWorkbook`, `ImportPlace`, `ImportSnapshot` из `parseWorkbook.ts`; `Currency`, `SnapshotEntry`, `Rates`, `SnapshotSource` из `src/model/types.ts`.
- Produces:
  - `interface ExistingData { places: { name: string; currency: Currency }[]; periods: string[] }`
  - `interface CurrencyConflict { name: string; fileCurrency: Currency; dbCurrency: Currency }`
  - `interface ImportPlan { placesToCreate: ImportPlace[]; snapshotsToCreate: ImportSnapshot[]; skippedPeriods: string[]; currencyConflicts: CurrencyConflict[] }`
  - `planImport(parsed: ParsedWorkbook, existing: ExistingData): ImportPlan`
  - `canCommit(parsed: ParsedWorkbook, plan: ImportPlan): boolean`
  - `interface NewSnapshot { period: string; snapshotDate: string; rates: Rates; entries: SnapshotEntry[]; reportedTotalRub: number | null; source: SnapshotSource }`
  - `toNewSnapshot(snapshot: ImportSnapshot, idByName: Map<string, string>): NewSnapshot`

Правила: место сопоставляется по имени; существующее место импорт не меняет
(справочник живой, приложение главнее файла); другая валюта у одноимённого места —
конфликт, блокирующий запись. Месяц, который уже есть в базе, пропускается.
Нулевые суммы в базу не пишутся.

- [ ] **Step 1: Написать падающие тесты**

`src/import/planImport.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import type { ImportSnapshot, ParsedWorkbook } from './parseWorkbook'
import { canCommit, planImport, toNewSnapshot } from './planImport'

const snap = (period: string, amounts: Record<string, number>): ImportSnapshot => ({
  row: 4,
  period,
  snapshotDate: `${period}-28`,
  rates: { usdtRub: 100, eurUsd: null, btcUsd: 100000 },
  amounts,
  reportedTotalRub: 1,
})

const parsed: ParsedWorkbook = {
  places: [
    { name: 'Сбер', category: 'Банки', currency: 'RUB', form: 'noncash' },
    { name: 'Крипта', category: 'Крипта', currency: 'BTC', form: 'noncash' },
    { name: 'Налик $', category: 'Наличные', currency: 'USD', form: 'cash' },
  ],
  snapshots: [snap('2025-01', { Сбер: 1 }), snap('2025-02', { Сбер: 2 })],
  issues: [],
}

describe('planImport', () => {
  it('creates only places the database does not have, in sheet order', () => {
    const plan = planImport(parsed, { places: [{ name: 'Сбер', currency: 'RUB' }], periods: [] })
    expect(plan.placesToCreate.map((p) => p.name)).toEqual(['Крипта', 'Налик $'])
    expect(plan.currencyConflicts).toEqual([])
  })

  it('reports a same-named place with another currency as a conflict', () => {
    const plan = planImport(parsed, { places: [{ name: 'Крипта', currency: 'USD' }], periods: [] })
    expect(plan.currencyConflicts).toEqual([{ name: 'Крипта', fileCurrency: 'BTC', dbCurrency: 'USD' }])
    expect(canCommit(parsed, plan)).toBe(false)
  })

  it('skips months already in the database', () => {
    const plan = planImport(parsed, { places: [], periods: ['2025-02'] })
    expect(plan.snapshotsToCreate.map((s) => s.period)).toEqual(['2025-01'])
    expect(plan.skippedPeriods).toEqual(['2025-02'])
  })
})

describe('canCommit', () => {
  it('allows a clean plan with something to write', () => {
    expect(canCommit(parsed, planImport(parsed, { places: [], periods: [] }))).toBe(true)
  })

  it('blocks on any format issue', () => {
    const broken = { ...parsed, issues: [{ sheet: null, row: null, message: 'x' }] }
    expect(canCommit(broken, planImport(broken, { places: [], periods: [] }))).toBe(false)
  })

  it('blocks when every month is already in the database', () => {
    expect(canCommit(parsed, planImport(parsed, { places: [], periods: ['2025-01', '2025-02'] }))).toBe(false)
  })
})

describe('toNewSnapshot', () => {
  it('maps names to ids and drops zero amounts', () => {
    const ids = new Map([['Сбер', 'id-1'], ['Крипта', 'id-2']])
    const row = toNewSnapshot(snap('2025-01', { Сбер: 5, Крипта: 0 }), ids)
    expect(row).toEqual({
      period: '2025-01',
      snapshotDate: '2025-01-28',
      rates: { usdtRub: 100, eurUsd: null, btcUsd: 100000 },
      entries: [{ placeId: 'id-1', amount: 5 }],
      reportedTotalRub: 1,
      source: 'import',
    })
  })

  it('refuses an amount whose place has no id', () => {
    expect(() => toNewSnapshot(snap('2025-01', { Альфа: 5 }), new Map())).toThrow(/Альфа/)
  })
})
```

- [ ] **Step 2: Убедиться, что тесты падают**

Run: `npm test`
Expected: FAIL — `Failed to resolve import "./planImport"`.

- [ ] **Step 3: Реализовать план**

`src/import/planImport.ts`:

```ts
import type { Currency, Rates, SnapshotEntry, SnapshotSource } from '../model/types'
import type { ImportPlace, ImportSnapshot, ParsedWorkbook } from './parseWorkbook'

export interface ExistingData {
  places: { name: string; currency: Currency }[]
  periods: string[]
}

export interface CurrencyConflict {
  name: string
  fileCurrency: Currency
  dbCurrency: Currency
}

export interface ImportPlan {
  placesToCreate: ImportPlace[]
  snapshotsToCreate: ImportSnapshot[]
  skippedPeriods: string[]
  currencyConflicts: CurrencyConflict[]
}

// An existing place is never changed by an import: the registry in the app is
// live and wins over the file. Only a currency clash blocks, because it would
// reprice the place's whole history.
export function planImport(parsed: ParsedWorkbook, existing: ExistingData): ImportPlan {
  const dbCurrency = new Map(existing.places.map((p) => [p.name, p.currency]))
  const placesToCreate: ImportPlace[] = []
  const currencyConflicts: CurrencyConflict[] = []
  for (const place of parsed.places) {
    const current = dbCurrency.get(place.name)
    if (current === undefined) placesToCreate.push(place)
    else if (current !== place.currency)
      currencyConflicts.push({ name: place.name, fileCurrency: place.currency, dbCurrency: current })
  }

  const taken = new Set(existing.periods)
  const snapshotsToCreate = parsed.snapshots.filter((s) => !taken.has(s.period))
  const skippedPeriods = parsed.snapshots.filter((s) => taken.has(s.period)).map((s) => s.period)

  return { placesToCreate, snapshotsToCreate, skippedPeriods, currencyConflicts }
}

export function canCommit(parsed: ParsedWorkbook, plan: ImportPlan): boolean {
  return parsed.issues.length === 0 && plan.currencyConflicts.length === 0 && plan.snapshotsToCreate.length > 0
}

export interface NewSnapshot {
  period: string
  snapshotDate: string
  rates: Rates
  entries: SnapshotEntry[]
  reportedTotalRub: number | null
  source: SnapshotSource
}

export function toNewSnapshot(snapshot: ImportSnapshot, idByName: Map<string, string>): NewSnapshot {
  const entries: SnapshotEntry[] = []
  for (const [name, amount] of Object.entries(snapshot.amounts)) {
    if (amount === 0) continue
    const placeId = idByName.get(name)
    if (!placeId) throw new Error(`No place id for ${name} (snapshot ${snapshot.period})`)
    entries.push({ placeId, amount })
  }
  return {
    period: snapshot.period,
    snapshotDate: snapshot.snapshotDate,
    rates: snapshot.rates,
    entries,
    reportedTotalRub: snapshot.reportedTotalRub,
    source: 'import',
  }
}
```

- [ ] **Step 4: Прогнать тесты**

Run: `npm test`
Expected: PASS, 30 tests.

- [ ] **Step 5: Commit**

```bash
git add src/import/planImport.ts src/import/planImport.test.ts
git commit -m "Plan an import: new places, skipped months, currency clashes" -m "Snapshots are immutable, so a month already in the database is skipped rather than overwritten, and a place whose currency differs from the file blocks the import: writing it would silently reprice that place's whole history." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Новая схема базы и проверка без пароля

**Files:**
- Modify: `supabase/schema.sql` (переписать целиком)
- Create: `scripts/check-schema.mjs`

**Interfaces:**
- Produces: таблицы `places`, `snapshots`, `settings` с колонками, которые читают задачи 7–8:
  - `places`: `id, user_id, name, category, currency, form, sort_order, chain, address, created_at`
  - `snapshots`: `id, user_id, period, snapshot_date, usdt_rub, eur_usd, btc_usd, entries, reported_total_rub, source, created_at`
  - `user_id` у всех таблиц по умолчанию `auth.uid()` — клиент его не передаёт.

> **Внимание, разрушительный шаг владельца.** Схема удаляет старые таблицы
> `wallets`, `snapshots`, `settings` вместе с тестовыми срезами и сохранёнными
> адресами кошельков. Прод (`main`) после этого перестанет работать до слияния
> `rebuild` на неделе 4 — он смотрит в ту же базу. Владелец согласился, что старые
> срезы тестовые (2026-10-05); про прод — подтвердить перед запуском.

- [ ] **Step 1: Скрипт проверки**

`scripts/check-schema.mjs`:

```js
// Tells whether the rebuild schema is live, using only the anon key from .env.
// The anon role has no grants, so Postgres answers a known column with
// "permission denied" (42501), an unknown column with 42703, and PostgREST
// answers a missing table with PGRST205. No password, no data read.
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]),
)
const url = env.VITE_SUPABASE_URL
const key = env.VITE_SUPABASE_ANON_KEY

const checks = [
  { table: 'places', select: 'name,category,currency,form,sort_order,chain,address', want: 'exists' },
  { table: 'snapshots', select: 'period,usdt_rub,eur_usd,btc_usd,entries,reported_total_rub,source', want: 'exists' },
  { table: 'settings', select: 'unisat_api_key,coingecko_api_key', want: 'exists' },
  { table: 'wallets', select: '*', want: 'missing' },
]

let ok = true
for (const { table, select, want } of checks) {
  const res = await fetch(`${url}/rest/v1/${table}?select=${select}&limit=1`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
  })
  const body = await res.json().catch(() => ({}))
  const got =
    body.code === '42501' ? 'exists'
    : body.code === 'PGRST205' ? 'missing'
    : body.code === '42703' ? 'old columns'
    : Array.isArray(body) ? 'readable by anon (grants leak!)'
    : `unexpected ${res.status} ${body.code ?? ''}`
  const pass = got === want
  ok &&= pass
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${table}: ${got} (want ${want})`)
}
process.exit(ok ? 0 : 1)
```

- [ ] **Step 2: Прогнать проверку до смены схемы — она должна упасть**

Run: `node scripts/check-schema.mjs`
Expected: exit code 1; `places: missing`, `snapshots: old columns`,
`settings: old columns`, `wallets: exists`.
Если ответы другие (например, старые таблицы читаются анонимом) — остановиться и
разобраться: значит, допущение про гранты из `DECISIONS.md` неверно, и сама
проверка ничего не доказывает.

- [ ] **Step 3: Переписать схему**

`supabase/schema.sql` целиком:

```sql
-- «Срез» — Supabase schema (rebuild, 2026-10)
-- Run whole in Supabase Dashboard → SQL Editor → New query.
-- DESTRUCTIVE: drops the previous tables and everything in them.

drop table if exists wallets cascade;
drop table if exists snapshots cascade;
drop table if exists settings cascade;
drop table if exists places cascade;

-- A place where money is or was kept. Name and category are live: editing
-- them regroups history. Currency is fixed once amounts exist (enforced in the app).
create table places (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  category text not null check (length(trim(category)) > 0),
  currency text not null check (currency in ('RUB', 'USD', 'EUR', 'BTC')),
  form text not null default 'none' check (form in ('cash', 'noncash', 'none')),
  sort_order integer not null default 0,
  chain text check (chain in ('ethereum', 'bitcoin', 'solana')),
  address text,
  created_at timestamptz not null default now(),
  unique (user_id, name),
  check ((chain is null) = (address is null))
);

-- One snapshot per month. Amounts and rates are immutable: no update grant.
create table snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  period text not null check (period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  snapshot_date date not null,
  usdt_rub numeric not null check (usdt_rub > 0),
  eur_usd numeric check (eur_usd > 0),
  btc_usd numeric not null check (btc_usd > 0),
  entries jsonb not null default '[]'::jsonb check (jsonb_typeof(entries) = 'array'),
  reported_total_rub numeric,
  source text not null check (source in ('import', 'manual')),
  created_at timestamptz not null default now(),
  unique (user_id, period)
);

create table settings (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  unisat_api_key text,
  coingecko_api_key text,
  updated_at timestamptz not null default now()
);

alter table places enable row level security;
alter table snapshots enable row level security;
alter table settings enable row level security;

create policy places_owner on places
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy snapshots_owner on snapshots
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy settings_owner on settings
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Supabase grants new public tables to anon by default; take that back
-- explicitly, then give logged-in users only what the app needs.
revoke all on places, snapshots, settings from anon, authenticated;
grant select, insert, update, delete on places to authenticated;
grant select, insert on snapshots to authenticated;
grant select, insert, update on settings to authenticated;
```

- [ ] **Step 4: Commit (до запуска владельцем — схема в репозитории первична)**

```bash
git add supabase/schema.sql scripts/check-schema.mjs
git commit -m "Replace the schema with places, monthly snapshots and three rates" -m "Snapshots get no update grant, so immutability holds in the database and not only in the absence of a function. user_id defaults to auth.uid(), so the client cannot write a row for someone else even by mistake. The check script proves the switch without a password." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 5: 🔴 Владелец — применить схему**

Перед этим шагом напомнить владельцу в чате, что схема **удаляет** старые таблицы,
а прод перестанет работать до недели 4, и дождаться явного «да».

1. Открыть Supabase Dashboard → проект «Среза» → **SQL Editor** → **New query**.
2. Вставить целиком содержимое `supabase/schema.sql`, нажать **Run**.
3. Ожидаемо: `Success. No rows returned`.

- [ ] **Step 6: Проверить смену схемы**

Run: `node scripts/check-schema.mjs`
Expected: exit code 0, четыре строки `ok`.

---

### Task 7: Слой данных и снос старой модели

**Files:**
- Create: `src/data/places.ts`, `src/data/snapshots.ts`, `src/data/commitImport.ts`, `src/pages/Overview.tsx`
- Modify: `src/App.tsx`, `src/components/Layout.tsx`, `src/lib/walletAssets.ts:7`
- Delete: `src/pages/Dashboard.tsx`, `src/pages/SnapshotNew.tsx`, `src/pages/SnapshotView.tsx`, `src/pages/Wallets.tsx`, `src/pages/Settings.tsx`, `src/lib/valuation.ts`, `src/lib/snapshots.ts`, `src/lib/wallets.ts`, `src/lib/settings.ts`, `src/types/snapshot.ts`

**Interfaces:**
- Consumes: `Place`, `Currency`, `PlaceForm`, `Chain` из `src/model/types.ts`; `ImportPlan`, `NewSnapshot`, `toNewSnapshot` из `src/import/planImport.ts`; `supabase` из `src/lib/supabase.ts`.
- Produces:
  - `listPlaces(): Promise<Place[]>`
  - `insertPlaces(places: NewPlace[]): Promise<Place[]>`, `interface NewPlace { name: string; category: string; currency: Currency; form: PlaceForm; sortOrder: number }`
  - `listSnapshotPeriods(): Promise<string[]>`
  - `insertSnapshots(rows: NewSnapshot[]): Promise<number>`
  - `commitImport(plan: ImportPlan, existingPlaces: Place[]): Promise<{ placesCreated: number; snapshotsCreated: number }>`
  - Маршруты: `/` → `Overview`, `/import` → `Import` (задача 8).

Почему без юнит-тестов: здесь только вызовы Supabase и маппинг полей; логика
(`toNewSnapshot`) уже под тестами в задаче 5. Проверка — сборкой здесь и живой
записью в задаче 8.

- [ ] **Step 1: Удалить старую модель и страницы**

```bash
git rm src/pages/Dashboard.tsx src/pages/SnapshotNew.tsx src/pages/SnapshotView.tsx src/pages/Wallets.tsx src/pages/Settings.tsx src/lib/valuation.ts src/lib/snapshots.ts src/lib/wallets.ts src/lib/settings.ts src/types/snapshot.ts
```

В `src/lib/walletAssets.ts` строку 7 заменить:

```ts
import type { Chain } from '../model/types'
```

(`walletAssets.ts` и `src/lib/api/*` остаются нетронутыми до недели 3.)

- [ ] **Step 2: Убедиться, что сборка падает ровно на ссылках из `App.tsx`**

Run: `npx tsc -b`
Expected: ошибки только в `src/App.tsx` — `Cannot find module './pages/Dashboard'` и
так далее. Ошибка в любом другом файле означает, что кто-то ещё зависел от
старой модели, — разобрать до продолжения.

- [ ] **Step 3: Слой данных**

`src/data/places.ts`:

```ts
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
```

`src/data/snapshots.ts`:

```ts
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
```

`src/data/commitImport.ts`:

```ts
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
```

- [ ] **Step 4: Заглушка обзора, маршруты, меню**

`src/pages/Overview.tsx`:

```tsx
import { Link } from 'react-router-dom'

export function Overview() {
  return (
    <section className="stack">
      <div className="page-head">
        <h1>Обзор</h1>
      </div>
      <p className="muted">
        Дашборд появится на второй неделе пересборки. Пока можно загрузить историю — <Link to="/import">Импорт</Link>.
      </p>
    </section>
  )
}
```

`src/App.tsx` целиком:

```tsx
import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { Login } from './pages/Login'
import { Overview } from './pages/Overview'
import { Import } from './pages/Import'

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Overview />} />
        <Route path="/import" element={<Import />} />
      </Route>
    </Routes>
  )
}

export default App
```

В `src/components/Layout.tsx` заменить блок `<nav className="masthead-nav">…</nav>` на:

```tsx
          <nav className="masthead-nav">
            <NavLink to="/" end>
              Обзор
            </NavLink>
            <NavLink to="/import">Импорт</NavLink>
          </nav>
```

Временный `src/pages/Import.tsx`, чтобы сборка прошла до задачи 8:

```tsx
export function Import() {
  return null
}
```

- [ ] **Step 5: Сборка и тесты**

Run: `npx tsc -b && npm run lint && npm test`
Expected: сборка без ошибок, oxlint без ошибок, 30 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add -A src
git commit -m "Swap the old model for a data layer on places and snapshots" -m "The old pages read tables the new schema dropped, so they go now rather than linger broken. Wallet fetchers stay untouched until week 3; only their Chain type moves to the new model." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: Экран импорта и живая проверка

**Files:**
- Create: `src/import/readWorkbook.ts`
- Modify: `src/pages/Import.tsx` (заменить заглушку), `src/lib/format.ts` (добавить `formatRub`)

**Interfaces:**
- Consumes: `parseWorkbook`, `RawSheet`, `ParsedWorkbook`; `reconcile`, `Reconciliation`; `planImport`, `canCommit`, `ImportPlan`; `listPlaces`; `listSnapshotPeriods`; `commitImport`; `getErrorMessage` из `src/lib/errors.ts`.
- Produces: `readWorkbook(file: File): Promise<RawSheet[]>`; `formatRub(n: number): string`; экран `/import`.

- [ ] **Step 1: Браузерный адаптер и формат рублей**

`src/import/readWorkbook.ts`:

```ts
import readXlsxFile from 'read-excel-file/browser'
import type { RawSheet } from './parseWorkbook'

// The library types a date cell as `typeof Date` (the constructor), while at
// runtime it is a Date instance; RawSheet states what actually arrives.
export async function readWorkbook(file: File): Promise<RawSheet[]> {
  return (await readXlsxFile(file)) as unknown as RawSheet[]
}
```

В `src/lib/format.ts` добавить в конец:

```ts
export function formatRub(n: number): string {
  return `${group(n.toFixed(0))} ₽`
}
```

- [ ] **Step 2: Экран импорта**

`src/pages/Import.tsx` целиком:

```tsx
import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { readWorkbook } from '../import/readWorkbook'
import { parseWorkbook, type ParsedWorkbook } from '../import/parseWorkbook'
import { reconcile, type Reconciliation } from '../import/reconcile'
import { canCommit, planImport, type ImportPlan } from '../import/planImport'
import { listPlaces } from '../data/places'
import { listSnapshotPeriods } from '../data/snapshots'
import { commitImport } from '../data/commitImport'
import { getErrorMessage } from '../lib/errors'
import { formatRub } from '../lib/format'
import type { Place } from '../model/types'

interface Preview {
  fileName: string
  parsed: ParsedWorkbook
  plan: ImportPlan
  rows: Reconciliation[]
  existingPlaces: Place[]
}

type State =
  | { step: 'idle' }
  | { step: 'reading' }
  | { step: 'preview'; preview: Preview }
  | { step: 'saving'; preview: Preview }
  | { step: 'done'; placesCreated: number; snapshotsCreated: number }
  | { step: 'failed'; message: string }

const STATUS_TEXT: Record<Reconciliation['status'], string> = {
  match: 'сошлось',
  mismatch: 'разошлось',
  'no-total': 'нет итога Excel',
}
const STATUS_CLASS: Record<Reconciliation['status'], string> = {
  match: 'ok',
  mismatch: 'error',
  'no-total': 'warn',
}

export function Import() {
  const [state, setState] = useState<State>({ step: 'idle' })

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setState({ step: 'reading' })
    try {
      const [sheets, existingPlaces, periods] = await Promise.all([
        readWorkbook(file),
        listPlaces(),
        listSnapshotPeriods(),
      ])
      const parsed = parseWorkbook(sheets)
      const plan = planImport(parsed, { places: existingPlaces, periods })
      const rows = parsed.snapshots.map((s) => reconcile(s, parsed.places))
      setState({ step: 'preview', preview: { fileName: file.name, parsed, plan, rows, existingPlaces } })
    } catch (err) {
      setState({ step: 'failed', message: getErrorMessage(err) })
    }
  }

  async function onCommit(preview: Preview) {
    setState({ step: 'saving', preview })
    try {
      const result = await commitImport(preview.plan, preview.existingPlaces)
      setState({ step: 'done', ...result })
    } catch (err) {
      setState({ step: 'failed', message: getErrorMessage(err) })
    }
  }

  const preview = state.step === 'preview' || state.step === 'saving' ? state.preview : null

  return (
    <section className="stack">
      <div className="page-head">
        <h1>Импорт истории</h1>
      </div>

      <div className="card stack">
        <p className="muted">
          Файл формата шаблона: листы «Места» и «Срезы». Читается в браузере и уходит только в вашу базу.
        </p>
        <label>
          <input type="file" accept=".xlsx" onChange={onFile} disabled={state.step === 'reading' || state.step === 'saving'} />
        </label>
        {state.step === 'reading' && <p className="muted">Читаю файл…</p>}
        {state.step === 'failed' && <p className="error">{state.message}</p>}
        {state.step === 'done' && (
          <p className="ok">
            Записано: мест — {state.placesCreated}, срезов — {state.snapshotsCreated}. <Link to="/">К обзору</Link>
          </p>
        )}
      </div>

      {preview && <PreviewView preview={preview} saving={state.step === 'saving'} onCommit={() => onCommit(preview)} />}
    </section>
  )
}

function PreviewView({ preview, saving, onCommit }: { preview: Preview; saving: boolean; onCommit: () => void }) {
  const { parsed, plan, rows } = preview
  const mismatches = rows.filter((r) => r.status === 'mismatch').length
  const ready = canCommit(parsed, plan)

  return (
    <>
      {parsed.issues.length > 0 && (
        <div className="card stack">
          <h2>Ошибки формата — запись невозможна</h2>
          <ul className="bullets">
            {parsed.issues.map((issue, i) => (
              <li key={i} className="error">
                {issue.sheet ? `«${issue.sheet}»` : 'Файл'}
                {issue.row !== null ? `, строка ${issue.row}` : ''}: {issue.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {plan.currencyConflicts.length > 0 && (
        <div className="card stack">
          <h2>Валюта не совпадает с базой — запись невозможна</h2>
          <ul className="bullets">
            {plan.currencyConflicts.map((c) => (
              <li key={c.name} className="error">
                «{c.name}»: в файле {c.fileCurrency}, в базе {c.dbCurrency}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card stack">
        <h2>{preview.fileName}</h2>
        <p>
          Новых мест: {plan.placesToCreate.length}
          {plan.placesToCreate.length > 0 && ` (${plan.placesToCreate.map((p) => p.name).join(', ')})`}. Срезов к записи:{' '}
          {plan.snapshotsToCreate.length}. Разошлось со своим Excel: <span className={mismatches ? 'error' : 'ok'}>{mismatches}</span>.
        </p>
        {plan.skippedPeriods.length > 0 && (
          <p className="warn">Уже есть в базе и не перезаписываются: {plan.skippedPeriods.join(', ')}</p>
        )}
        <table>
          <thead>
            <tr>
              <th>Строка</th>
              <th>Месяц</th>
              <th className="money">Итог Excel</th>
              <th className="money">Итог приложения</th>
              <th className="money">Разница</th>
              <th>Сверка</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period}>
                <td className="mono">{r.row}</td>
                <td className="mono">{r.period}</td>
                <td className="money">{r.reportedRub === null ? '—' : formatRub(r.reportedRub)}</td>
                <td className="money">{formatRub(r.computedRub)}</td>
                <td className="money">{r.diffRub === null ? '—' : formatRub(r.diffRub)}</td>
                <td className={STATUS_CLASS[r.status]}>{STATUS_TEXT[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div>
          <button type="button" className="btn-primary" disabled={!ready || saving} onClick={onCommit}>
            {saving ? 'Записываю…' : 'Импортировать'}
          </button>
        </div>
      </div>
    </>
  )
}
```

Расхождения не блокируют запись намеренно: критерий месяца — «у каждой
разошедшейся строки есть объяснение», а объяснение может быть и «в Excel была
ошибка». Блокируют только ошибки формата и конфликт валют.

- [ ] **Step 3: Сборка, линт, тесты**

Run: `npx tsc -b && npm run lint && npm test`
Expected: всё зелёное, 30 tests.

- [ ] **Step 4: Живая проверка в браузере — предпросмотр**

1. `preview_start` с `{ name: "dev" }` (`.claude/launch.json`), открыть
   `http://localhost:5173/networth-tracker/#/import`.
2. 🔴 Владелец входит своим паролем: Claude не вводит пароли от настоящего аккаунта.
3. 🔴 Владелец выбирает `docs/import/import-template.xlsx` в поле файла: у
   встроенного браузера нет загрузки файлов от имени Claude.
4. `read_page`: ожидаемо «Новых мест: 10», «Срезов к записи: 6», «Разошлось со своим
   Excel: 0», в таблице шесть строк «сошлось», строка 4 — итог `5 427 016 ₽` и в
   Excel, и в приложении. Кнопка «Импортировать» активна.
5. `read_console_messages` с `onlyErrors: true` — пусто.

- [ ] **Step 5: Живая проверка — красный путь**

1. 🔴 Владелец открывает копию шаблона в Excel, в строке 6 листа «Срезы» заменяет
   формулу в «Итог ₽» числом **4 634 100** и сохраняет копию как
   `docs/import/check-red.xlsx` (её закрывает `.gitignore`). Приложение посчитает
   для этой строки 4 634 111,4 ₽.
2. Владелец выбирает эту копию в поле файла.
3. `read_page`: ожидаемо «Разошлось со своим Excel: **1**», строка 6 —
   «разошлось», разница `11 ₽`; остальные пять — «сошлось»; кнопка
   «Импортировать» активна (расхождение не блокирует запись).

- [ ] **Step 6: Живая проверка — запись и откат**

> Шаблон пишет в настоящую базу выдуманные 2025-01…2025-06. Эти месяцы есть и в
> настоящей истории владельца, и, оставшись, они заблокируют её импорт. Поэтому
> после проверки записи — обязательная очистка.

1. На предпросмотре чистого шаблона нажать «Импортировать». Ожидаемо: «Записано:
   мест — 10, срезов — 6».
2. Выбрать шаблон повторно. Ожидаемо: «Новых мест: 0», «Срезов к записи: 0»,
   «Уже есть в базе и не перезаписываются: 2025-01, …, 2025-06», кнопка
   неактивна. Это проверка, что импорт не перезаписывает срезы.
3. 🔴 Владелец в Supabase → SQL Editor выполняет:

```sql
delete from snapshots;
delete from places;
```

4. Выбрать шаблон ещё раз — снова «Новых мест: 10, Срезов к записи: 6». База
   чистая.
5. Скриншот предпросмотра — владельцу как доказательство.

- [ ] **Step 7: Commit**

```bash
git add src/import/readWorkbook.ts src/pages/Import.tsx src/lib/format.ts
git commit -m "Add the import screen with a per-row reconciliation verdict" -m "Mismatches do not block the write on purpose: the month's criterion is that every red row has an explanation, and the explanation may be an error in Excel. Format issues and currency clashes do block, because they would store wrong data rather than surface a question." -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

## После недели 1

- `/handoff`: `STATUS.md` (первый блок для карты), `ЛЕТОПИСЬ.md`. `CLAUDE.md`
  описывает старую модель и Etherscan — переписать разделы «Архитектура данных» и
  «API-интеграции» на неделе 3, когда сменятся источники, одним заходом.
- Владелец: собирает свой лист под шаблон и загружает его через `/import` на
  неделе 2.
