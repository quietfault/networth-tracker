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
