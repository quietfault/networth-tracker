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
