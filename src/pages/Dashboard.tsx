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
import { getErrorMessage } from '../lib/errors'
import type { Snapshot } from '../types/snapshot'

const CATEGORY_COLORS: Record<string, string> = {
  Банки: '#60a5fa',
  Крипта: '#f59e0b',
  Инвентарь: '#34d399',
  Физика: '#a78bfa',
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

  if (loading) return <p>Загрузка...</p>
  if (error) return <p style={{ color: 'crimson' }}>{error}</p>

  if (snapshots.length === 0) {
    return (
      <div>
        <h1>Dashboard</h1>
        <p>
          Снимков пока нет. <Link to="/snapshot/new">Создать первый</Link>
        </p>
      </div>
    )
  }

  const latest = snapshots[snapshots.length - 1]
  const latestTotals = categoryTotals(latest.assets, latest.usdRub)

  const historyData = snapshots.map((s) => ({
    period: s.period,
    total: s.totalUsd ?? categoryTotals(s.assets, s.usdRub).total,
  }))

  const pieData = [
    { name: 'Банки', value: latestTotals.banks },
    { name: 'Крипта', value: latestTotals.crypto },
    { name: 'Инвентарь', value: latestTotals.inventory },
    { name: 'Физика', value: latestTotals.physical },
  ].filter((d) => d.value > 0)

  return (
    <div>
      <h1>Dashboard</h1>

      <div style={{ marginBottom: 24 }}>
        <div style={{ opacity: 0.7 }}>Последний снимок: {latest.period}</div>
        <div style={{ fontSize: 32, fontWeight: 'bold' }}>${latestTotals.total.toFixed(2)}</div>
      </div>

      <h2>Net worth по месяцам</h2>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={historyData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis />
          <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
          <Line type="monotone" dataKey="total" stroke="#60a5fa" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>

      <h2>Разбивка по категориям ({latest.period})</h2>
      {pieData.length === 0 ? (
        <p>Нет данных для разбивки.</p>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie data={pieData} dataKey="value" nameKey="name" outerRadius={100} label>
              {pieData.map((d) => (
                <Cell key={d.name} fill={CATEGORY_COLORS[d.name]} />
              ))}
            </Pie>
            <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
