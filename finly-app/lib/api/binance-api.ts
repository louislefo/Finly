export interface CryptoAsset {
  symbol: string
  baseAsset: string
  quoteAsset: string
  name: string
  lastPrice: number
  priceChange: number
  priceChangePercent: number
  highPrice: number
  lowPrice: number
  volume: number
  quoteVolume: number
  rank: number
}

export interface CryptoKline {
  time: number
  dateStr: string
  open: number
  high: number
  low: number
  close: number
  volume: number
}

export type CryptoTimeframe = "24H" | "7J" | "1M" | "1A"

const TOP_SYMBOLS_CONFIG: { symbol: string; baseAsset: string; name: string }[] = [
  { symbol: "BTCUSDT", baseAsset: "BTC", name: "Bitcoin" },
  { symbol: "ETHUSDT", baseAsset: "ETH", name: "Ethereum" },
  { symbol: "SOLUSDT", baseAsset: "SOL", name: "Solana" },
  { symbol: "BNBUSDT", baseAsset: "BNB", name: "BNB" },
  { symbol: "XRPUSDT", baseAsset: "XRP", name: "Ripple" },
  { symbol: "DOGEUSDT", baseAsset: "DOGE", name: "Dogecoin" },
  { symbol: "ADAUSDT", baseAsset: "ADA", name: "Cardano" },
  { symbol: "AVAXUSDT", baseAsset: "AVAX", name: "Avalanche" },
  { symbol: "SUIUSDT", baseAsset: "SUI", name: "Sui" },
  { symbol: "LINKUSDT", baseAsset: "LINK", name: "Chainlink" },
  { symbol: "NEARUSDT", baseAsset: "NEAR", name: "Near Protocol" },
  { symbol: "DOTUSDT", baseAsset: "DOT", name: "Polkadot" },
  { symbol: "AAVEUSDT", baseAsset: "AAVE", name: "Aave" },
  { symbol: "RENDERUSDT", baseAsset: "RENDER", name: "Render" },
  { symbol: "FETUSDT", baseAsset: "FET", name: "Artificial Superintelligence Alliance" },
  { symbol: "UNIUSDT", baseAsset: "UNI", name: "Uniswap" },
]

export class BinanceAPI {
  private static BASE_URL = "https://api.binance.com/api/v3"

  /**
   * Fetch top cryptos 24h ticker data from Binance public API
   */
  static async getTopCryptos(): Promise<CryptoAsset[]> {
    try {
      const symbolsParam = JSON.stringify(TOP_SYMBOLS_CONFIG.map((c) => c.symbol))
      const res = await fetch(
        `${this.BASE_URL}/ticker/24hr?symbols=${encodeURIComponent(symbolsParam)}`,
        { cache: "no-store" }
      )

      if (!res.ok) {
        throw new Error(`Binance API error: ${res.statusText}`)
      }

      const rawData: any[] = await res.json()
      const dataMap = new Map<string, any>()
      for (const item of rawData) {
        dataMap.set(item.symbol, item)
      }

      return TOP_SYMBOLS_CONFIG.map((cfg, index) => {
        const item = dataMap.get(cfg.symbol)
        if (!item) {
          return {
            symbol: cfg.symbol,
            baseAsset: cfg.baseAsset,
            quoteAsset: "USDT",
            name: cfg.name,
            lastPrice: 0,
            priceChange: 0,
            priceChangePercent: 0,
            highPrice: 0,
            lowPrice: 0,
            volume: 0,
            quoteVolume: 0,
            rank: index + 1,
          }
        }

        return {
          symbol: cfg.symbol,
          baseAsset: cfg.baseAsset,
          quoteAsset: "USDT",
          name: cfg.name,
          lastPrice: parseFloat(item.lastPrice) || 0,
          priceChange: parseFloat(item.priceChange) || 0,
          priceChangePercent: parseFloat(item.priceChangePercent) || 0,
          highPrice: parseFloat(item.highPrice) || 0,
          lowPrice: parseFloat(item.lowPrice) || 0,
          volume: parseFloat(item.volume) || 0,
          quoteVolume: parseFloat(item.quoteVolume) || 0,
          rank: index + 1,
        }
      })
    } catch (err) {
      console.error("Failed to fetch Binance top cryptos:", err)
      return this.getFallbackCryptos()
    }
  }

  /**
   * Fetch historical klines / candlestick data from Binance for charts
   */
  static async getKlines(
    symbol: string = "BTCUSDT",
    timeframe: CryptoTimeframe = "24H"
  ): Promise<CryptoKline[]> {
    let interval = "1h"
    let limit = 24

    switch (timeframe) {
      case "24H":
        interval = "1h"
        limit = 24
        break
      case "7J":
        interval = "4h"
        limit = 42
        break
      case "1M":
        interval = "1d"
        limit = 30
        break
      case "1A":
        interval = "1w"
        limit = 52
        break
    }

    try {
      const res = await fetch(
        `${this.BASE_URL}/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
        { cache: "no-store" }
      )

      if (!res.ok) {
        throw new Error(`Binance klines error: ${res.statusText}`)
      }

      const rawKlines: any[][] = await res.json()

      return rawKlines.map((k) => {
        const timestamp = k[0]
        const date = new Date(timestamp)
        let dateStr = ""

        if (timeframe === "24H") {
          dateStr = `${date.getHours().toString().padStart(2, "0")}:00`
        } else if (timeframe === "7J") {
          dateStr = `${date.toLocaleDateString("fr-FR", { weekday: "short" })} ${date.getHours()}h`
        } else if (timeframe === "1M") {
          dateStr = `${date.getDate()} ${date.toLocaleDateString("fr-FR", { month: "short" })}`
        } else {
          dateStr = `${date.toLocaleDateString("fr-FR", { month: "short" })} ${date.getFullYear().toString().slice(-2)}`
        }

        return {
          time: timestamp,
          dateStr,
          open: parseFloat(k[1]) || 0,
          high: parseFloat(k[2]) || 0,
          low: parseFloat(k[3]) || 0,
          close: parseFloat(k[4]) || 0,
          volume: parseFloat(k[5]) || 0,
        }
      })
    } catch (err) {
      console.error(`Failed to fetch Binance klines for ${symbol}:`, err)
      return this.generateFallbackKlines(timeframe)
    }
  }

  /**
   * Fallback static data in case of offline / blocked network
   */
  private static getFallbackCryptos(): CryptoAsset[] {
    return [
      { symbol: "BTCUSDT", baseAsset: "BTC", quoteAsset: "USDT", name: "Bitcoin", lastPrice: 81450, priceChange: 1250, priceChangePercent: 1.55, highPrice: 82100, lowPrice: 79800, volume: 24500, quoteVolume: 1995000000, rank: 1 },
      { symbol: "ETHUSDT", baseAsset: "ETH", quoteAsset: "USDT", name: "Ethereum", lastPrice: 2625, priceChange: -18, priceChangePercent: -0.68, highPrice: 2680, lowPrice: 2590, volume: 154000, quoteVolume: 405000000, rank: 2 },
      { symbol: "SOLUSDT", baseAsset: "SOL", quoteAsset: "USDT", name: "Solana", lastPrice: 138.5, priceChange: 4.2, priceChangePercent: 3.12, highPrice: 142.0, lowPrice: 133.2, volume: 1250000, quoteVolume: 173000000, rank: 3 },
      { symbol: "BNBUSDT", baseAsset: "BNB", quoteAsset: "USDT", name: "BNB", lastPrice: 585, priceChange: 2.1, priceChangePercent: 0.36, highPrice: 592, lowPrice: 578, volume: 185000, quoteVolume: 108000000, rank: 4 },
      { symbol: "XRPUSDT", baseAsset: "XRP", quoteAsset: "USDT", name: "Ripple", lastPrice: 2.15, priceChange: 0.08, priceChangePercent: 3.86, highPrice: 2.22, lowPrice: 2.05, volume: 350000000, quoteVolume: 752000000, rank: 5 },
      { symbol: "DOGEUSDT", baseAsset: "DOGE", quoteAsset: "USDT", name: "Dogecoin", lastPrice: 0.245, priceChange: -0.005, priceChangePercent: -2.00, highPrice: 0.258, lowPrice: 0.238, volume: 450000000, quoteVolume: 110000000, rank: 6 },
    ]
  }

  private static generateFallbackKlines(timeframe: CryptoTimeframe): CryptoKline[] {
    const points = timeframe === "24H" ? 24 : timeframe === "7J" ? 28 : 30
    const now = Date.now()
    const step = (24 * 3600 * 1000) / points
    let basePrice = 80000

    return Array.from({ length: points }, (_, i) => {
      const time = now - (points - i) * step
      const variation = (Math.sin(i / 3) + (Math.random() - 0.5) * 0.5) * 1200
      const close = Math.round(basePrice + variation)
      return {
        time,
        dateStr: new Date(time).toLocaleDateString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
        open: close - 200,
        high: close + 300,
        low: close - 250,
        close,
        volume: 1200,
      }
    })
  }
}
