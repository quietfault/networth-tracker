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
