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
