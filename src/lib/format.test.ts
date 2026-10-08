import { describe, it, expect } from 'vitest'
import { formatRubDiff } from './format'

describe('formatRubDiff', () => {
  it('shows an explicit plus and two decimals', () => {
    expect(formatRubDiff(0.6)).toBe('+0.60 ₽')
  })

  it('uses the real minus sign (U+2212) and space grouping', () => {
    expect(formatRubDiff(-1234.5)).toBe('−1 234.50 ₽')
  })

  it('never prints a signed zero', () => {
    expect(formatRubDiff(0)).toBe('0.00 ₽')
    expect(formatRubDiff(-0)).toBe('0.00 ₽')
    expect(formatRubDiff(-0.004)).toBe('0.00 ₽')
    expect(formatRubDiff(0.004)).toBe('0.00 ₽')
  })

  it('keeps the sign once the value rounds to a cent', () => {
    expect(formatRubDiff(-0.005)).toBe('−0.01 ₽')
    expect(formatRubDiff(2)).toBe('+2.00 ₽')
  })
})
