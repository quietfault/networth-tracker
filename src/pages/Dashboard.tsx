import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { listSnapshots } from '../lib/snapshots'
import { categoryTotals } from '../lib/valuation'
import { formatUsd } from '../lib/format'
import { getErrorMessage } from '../lib/errors'
import type { Snapshot } from '../types/snapshot'

// Цвета берутся токенами, а не литералами: var() в SVG-атрибутах работает,
// поэтому график сам переключается вместе с темой, без перерисовки.
const CATEGORY_COLORS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)']

const tooltipStyle = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontFamily: 'var(--font-mono)',
  fontSize: '0.9em',
}

export function Dashboard() {
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        setSnapshots(await listSnapshots())
      } catch (e) {
        setError(getErrorMessage(e))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) return <p className="muted">Загрузка...</p>
  if (error) return <p className="error">{error}</p>

  if (snapshots.length === 0) {
    return (
      <div className="stack">
        <h1>Обзор</h1>
        <p className="muted">
          Срезов пока нет. <Link to="/snapshot/new">Сделать первый</Link>
        </p>
      </div>
    )
  }

  // Итог берётся из сохранённого total_usd, а пересчёт — только запасной
  // вариант для старых записей. Иначе цифра в шапке расходится с графиком.
  const totalOf = (s: Snapshot) => s.totalUsd ?? categoryTotals(s.assets, s.usdRub).total

  const latest = snapshots[snapshots.length - 1]
  const latestTotals = categoryTotals(latest.assets, latest.usdRub)
  const latestTotal = totalOf(latest)
  const previous = snapshots.length > 1 ? snapshots[snapshots.length - 2] : null
  const change = previous ? latestTotal - totalOf(previous) : null

  const historyData = snapshots.map((s) => ({ period: s.period, total: totalOf(s) }))

  const pieData = [
    { name: 'Банки', value: latestTotals.banks },
    { name: 'Крипта', value: latestTotals.crypto },
    { name: 'Инвентарь', value: latestTotals.inventory },
    { name: 'Физика', value: latestTotals.physical },
  ].filter((d) => d.value > 0)

  return (
    <div className="stack">
      <div className="page-head">
        <h1>Обзор</h1>
        <Link to="/snapshot/new">Новый срез</Link>
      </div>

      <section className="card">
        <div className="label">Срез {latest.period}</div>
        <div className="total">{formatUsd(latestTotal)}</div>
        {change != null && (
          <p className="muted mono" style={{ fontSize: 'var(--step--1)' }}>
            {change >= 0 ? '+' : '−'}
            {formatUsd(Math.abs(change))} к срезу {previous?.period}
          </p>
        )}
      </section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head">
            <h2>Net worth по месяцам</h2>
          </div>
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={historyData} margin={{ top: 8, right: 8, bottom: 0, left: 8 }}>
                <CartesianGrid stroke="var(--line)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="period"
                  stroke="var(--line)"
                  tick={{ fill: 'var(--text-dim)', fontSize: 12 }}
                />
                <YAxis
                  stroke="var(--line)"
                  tick={{ fill: 'var(--text-dim)', fontSize: 12 }}
                  width={72}
                  tickFormatter={(v) => formatUsd(Number(v)).replace('.00', '')}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: 'var(--text-dim)' }}
                  formatter={(v) => formatUsd(Number(v))}
                />
                <Line
                  type="monotone"
                  dataKey="total"
                  name="Итого"
                  stroke="var(--accent)"
                  strokeWidth={2}
                  dot={{ fill: 'var(--accent)', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="card">
          <div className="card-head">
            <h2>Разбивка · {latest.period}</h2>
          </div>
          {pieData.length === 0 ? (
            <p className="muted">Нет данных для разбивки.</p>
          ) : (
            <>
              <div className="chart">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={90}
                      paddingAngle={1}
                      stroke="var(--bg-raised)"
                    >
                      {pieData.map((d, i) => (
                        <Cell key={d.name} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(v) => formatUsd(Number(v))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend">
                {pieData.map((d, i) => (
                  <span key={d.name} className="legend-item">
                    <span
                      className="swatch"
                      style={{ background: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                    />
                    {d.name}
                    <span className="muted mono">{formatUsd(d.value)}</span>
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
