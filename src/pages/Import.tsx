import { useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { readWorkbook } from '../import/readWorkbook'
import { parseWorkbook, type ParsedWorkbook } from '../import/parseWorkbook'
import { reconcile, type Reconciliation } from '../import/reconcile'
import { canCommit, mismatchesToWrite, planImport, rowVerdict, type ImportPlan, type RowVerdict } from '../import/planImport'
import { listPlaces } from '../data/places'
import { listSnapshotPeriods } from '../data/snapshots'
import { commitImport } from '../data/commitImport'
import { getErrorMessage } from '../lib/errors'
import { formatRub, formatRubDiff } from '../lib/format'
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

const STATUS_TEXT: Record<RowVerdict, string> = {
  match: 'сошлось',
  mismatch: 'разошлось',
  'no-total': 'нет итога Excel',
  'in-database': 'уже в базе',
}
const STATUS_CLASS: Record<RowVerdict, string> = {
  match: 'ok',
  mismatch: 'error',
  'no-total': 'warn',
  'in-database': 'muted',
}

// A failed commit may have written some places or snapshots before it stopped.
const PARTIAL_WRITE_HINT =
  ' Часть данных могла записаться. Выберите файл ещё раз — уже записанное будет учтено и не задвоится.'

export function Import() {
  const [state, setState] = useState<State>({ step: 'idle' })
  const [acknowledged, setAcknowledged] = useState(false)

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setAcknowledged(false)
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
      setState({ step: 'failed', message: getErrorMessage(err) + PARTIAL_WRITE_HINT })
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
          <input type="file" accept=".xlsx" aria-label="Файл импорта .xlsx" onChange={onFile} disabled={state.step === 'reading' || state.step === 'saving'} />
        </label>
        {state.step === 'reading' && <p className="muted">Читаю файл…</p>}
        {state.step === 'failed' && <p className="error">{state.message}</p>}
        {state.step === 'done' && (
          <p className="ok">
            Записано: мест — {state.placesCreated}, срезов — {state.snapshotsCreated}. <Link to="/">К обзору</Link>
          </p>
        )}
      </div>

      {preview && (
        <PreviewView
          preview={preview}
          saving={state.step === 'saving'}
          acknowledged={acknowledged}
          onAcknowledge={setAcknowledged}
          onCommit={() => onCommit(preview)}
        />
      )}
    </section>
  )
}

interface PreviewViewProps {
  preview: Preview
  saving: boolean
  acknowledged: boolean
  onAcknowledge: (value: boolean) => void
  onCommit: () => void
}

function PreviewView({ preview, saving, acknowledged, onAcknowledge, onCommit }: PreviewViewProps) {
  const { parsed, plan, rows, existingPlaces } = preview
  const mismatches = mismatchesToWrite(rows, plan)
  const conflicting = new Set(plan.currencyConflicts.map((c) => c.name))
  const existingNames = new Set(existingPlaces.map((p) => p.name))
  const matchedPlaces = parsed.places.filter((p) => existingNames.has(p.name) && !conflicting.has(p.name))
  // Mismatches are written as they are; the owner must have seen them first.
  const ready = canCommit(parsed, plan) && (mismatches === 0 || acknowledged)

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
          {plan.placesToCreate.length > 0 && ` (${plan.placesToCreate.map((p) => p.name).join(', ')})`}. Уже в базе:{' '}
          {matchedPlaces.length}
          {matchedPlaces.length > 0 && ` (${matchedPlaces.map((p) => p.name).join(', ')})`}. Срезов к записи:{' '}
          {plan.snapshotsToCreate.length}. Разошлось со своим Excel: <span className={mismatches ? 'error' : 'ok'}>{mismatches}</span>.
        </p>
        {matchedPlaces.length > 0 && (
          <p className="muted">Категория и форма уже существующих мест берутся из базы, а не из файла.</p>
        )}
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
            {rows.map((r) => {
              const verdict = rowVerdict(r, plan)
              return (
                <tr key={r.period}>
                  <td className="mono">{r.row}</td>
                  <td className="mono">{r.period}</td>
                  <td className="money">{r.reportedRub === null ? '—' : formatRub(r.reportedRub)}</td>
                  <td className="money">{formatRub(r.computedRub)}</td>
                  <td className="money">{r.diffRub === null ? '—' : formatRubDiff(r.diffRub)}</td>
                  <td className={STATUS_CLASS[verdict]}>{STATUS_TEXT[verdict]}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {mismatches > 0 && (
          <label>
            <input type="checkbox" checked={acknowledged} onChange={(e) => onAcknowledge(e.target.checked)} /> Я просмотрел
            расхождения ({mismatches}) и понимаю, что они будут записаны как есть
          </label>
        )}
        <div>
          <button type="button" className="btn-primary" disabled={!ready || saving} onClick={onCommit}>
            {saving ? 'Записываю…' : 'Импортировать'}
          </button>
        </div>
      </div>
    </>
  )
}
