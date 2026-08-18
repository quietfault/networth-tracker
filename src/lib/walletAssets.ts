import { fetchEvmBalances } from './api/etherscan'
import { fetchBtcBalance } from './api/blockchair'
import { fetchSolBalance, fetchSplTokens } from './api/solana'
import { fetchRuneBalances } from './api/unisat'
import { fetchTokenPrices, fetchTokenPricesByContract } from './api/coingecko'
import { getErrorMessage } from './errors'
import type { Chain } from '../types/snapshot'

export interface WalletAsset {
  symbol: string
  amount: number
  priceUSD: number | null
  /** Extra context for the UI: chain name, full mint, rune name. */
  note?: string
  /** CoinGecko asset platform id, set for tokens priced by contract address. */
  platform?: string
  /** Token contract / SPL mint, used for pricing when the symbol is unknown. */
  contract?: string
}

export interface WalletAssetsResult {
  assets: WalletAsset[]
  /**
   * Partial failures. Every source is fetched independently, so a dead
   * Blockchair or a missing UniSat key never hides the balances that did load.
   */
  errors: string[]
}

export interface ApiKeys {
  etherscan: string | null
  unisat: string | null
}

export interface WalletTarget {
  chain: Chain
  address: string
}

export async function fetchWalletAssets(
  wallet: WalletTarget,
  keys: ApiKeys,
): Promise<WalletAssetsResult> {
  const assets: WalletAsset[] = []
  const errors: string[] = []

  const collect = async (fn: () => Promise<WalletAsset[]>) => {
    try {
      assets.push(...(await fn()))
    } catch (e) {
      errors.push(getErrorMessage(e))
    }
  }

  if (wallet.chain === 'ethereum') {
    if (!keys.etherscan) {
      errors.push('Etherscan API key не задан (Настройки) — балансы EVM-сетей не загружены')
    } else {
      await collect(async () => {
        const { balances, errors: chainErrors } = await fetchEvmBalances(
          wallet.address,
          keys.etherscan!,
        )
        errors.push(...chainErrors)
        return balances.map((b) => ({
          symbol: b.symbol,
          amount: b.amount,
          priceUSD: null,
          note: b.chainName,
        }))
      })
    }
  } else if (wallet.chain === 'bitcoin') {
    await collect(async () => [
      { symbol: 'BTC', amount: await fetchBtcBalance(wallet.address), priceUSD: null },
    ])

    if (!keys.unisat) {
      errors.push('UniSat API key не задан (Настройки) — балансы Рун не загружены')
    } else {
      await collect(async () => {
        const runes = await fetchRuneBalances(wallet.address, keys.unisat!)
        // Runes have no CoinGecko listing — amount only, price stays manual.
        return runes.map((r) => ({ symbol: r.symbol, amount: r.amount, priceUSD: null, note: 'Rune' }))
      })
    }
  } else if (wallet.chain === 'solana') {
    await collect(async () => [
      { symbol: 'SOL', amount: await fetchSolBalance(wallet.address), priceUSD: null },
    ])
    await collect(async () => {
      const tokens = await fetchSplTokens(wallet.address)
      return tokens.map((t) => ({
        symbol: t.symbol,
        amount: t.amount,
        priceUSD: null,
        note: t.known ? undefined : t.mint,
        platform: 'solana',
        contract: t.mint,
      }))
    })
  }

  return { assets, errors }
}

export interface PriceMap {
  bySymbol: Record<string, number>
  byContract: Record<string, number>
}

export const emptyPriceMap: PriceMap = { bySymbol: {}, byContract: {} }

// Prices are resolved in one place for a whole batch of assets: known tickers
// by CoinGecko id, everything else (SPL mints) by contract address.
export async function fetchPrices(
  assets: WalletAsset[],
): Promise<{ prices: PriceMap; errors: string[] }> {
  const errors: string[] = []
  const prices: PriceMap = { bySymbol: {}, byContract: {} }

  const symbols = assets.filter((a) => !a.contract).map((a) => a.symbol)
  if (symbols.length > 0) {
    try {
      prices.bySymbol = await fetchTokenPrices(symbols)
    } catch (e) {
      errors.push(getErrorMessage(e))
    }
  }

  const byPlatform = new Map<string, string[]>()
  for (const asset of assets) {
    if (!asset.contract || !asset.platform) continue
    const list = byPlatform.get(asset.platform) ?? []
    list.push(asset.contract)
    byPlatform.set(asset.platform, list)
  }

  for (const [platform, contracts] of byPlatform) {
    try {
      Object.assign(prices.byContract, await fetchTokenPricesByContract(platform, contracts))
    } catch (e) {
      errors.push(getErrorMessage(e))
    }
  }

  return { prices, errors }
}

// A snapshot row holds one amount per ticker, but EVM natives come back once
// per chain (ETH on mainnet + Arbitrum + Base), so same-ticker lines are summed.
export function mergeBySymbol(assets: WalletAsset[]): WalletAsset[] {
  const merged = new Map<string, WalletAsset>()
  for (const asset of assets) {
    const key = asset.contract?.toLowerCase() ?? asset.symbol.toUpperCase()
    const existing = merged.get(key)
    if (existing) {
      existing.amount += asset.amount
      existing.priceUSD = existing.priceUSD ?? asset.priceUSD
    } else {
      merged.set(key, { ...asset })
    }
  }
  return [...merged.values()]
}

export function applyPrices(assets: WalletAsset[], prices: PriceMap): WalletAsset[] {
  return assets.map((asset) => {
    const priceUSD = asset.contract
      ? (prices.byContract[asset.contract.toLowerCase()] ??
        prices.bySymbol[asset.symbol.toUpperCase()] ??
        null)
      : (prices.bySymbol[asset.symbol.toUpperCase()] ?? null)
    return { ...asset, priceUSD: priceUSD ?? asset.priceUSD }
  })
}
