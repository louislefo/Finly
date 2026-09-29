import {
  StockQuote,
  StockHistoryPoint,
  InvestmentHolding,
  PortfolioSummary,
} from "@/lib/types/finance"

const API_BASE_URL = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "/api/v1")
  : (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000/api/v1")

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return { "Content-Type": "application/json", "Accept-Language": "en" }
  const token = localStorage.getItem("finly_token")
  const lang = localStorage.getItem("finly_language") || "en"
  return {
    "Content-Type": "application/json",
    "Accept-Language": lang,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const PRELOADED_INDICES: StockQuote[] = [
  {
    symbol: "^FCHI",
    name: "CAC 40",
    asset_type: "index",
    sector: "Indice France",
    price: 7984.20,
    change: 62.40,
    change_percent: 0.79,
    currency: "EUR",
    day_high: 8012.50,
    day_low: 7940.10,
    high_52w: 8259.20,
    low_52w: 7025.40,
    volume: 3850000000,
    market_cap: 2450000000000,
    pe_ratio: 14.8,
    dividend_yield: 2.95,
  },
  {
    symbol: "^GSPC",
    name: "S&P 500",
    asset_type: "index",
    sector: "Indice USA",
    price: 5752.40,
    change: 24.15,
    change_percent: 0.42,
    currency: "USD",
    day_high: 5768.80,
    day_low: 5735.20,
    high_52w: 5780.00,
    low_52w: 4103.80,
    volume: 42000000000,
    market_cap: 46200000000000,
    pe_ratio: 24.5,
    dividend_yield: 1.35,
  },
  {
    symbol: "^IXIC",
    name: "Nasdaq 100",
    asset_type: "index",
    sector: "Indice Tech USA",
    price: 20145.80,
    change: 185.30,
    change_percent: 0.93,
    currency: "USD",
    day_high: 20210.00,
    day_low: 19980.50,
    high_52w: 20690.90,
    low_52w: 14058.40,
    volume: 24000000000,
    market_cap: 21500000000000,
    pe_ratio: 31.8,
    dividend_yield: 0.82,
  },
  {
    symbol: "^GDAXI",
    name: "DAX 40",
    asset_type: "index",
    sector: "Indice Allemagne",
    price: 19485.50,
    change: 98.20,
    change_percent: 0.51,
    currency: "EUR",
    day_high: 19520.10,
    day_low: 19390.00,
    high_52w: 19600.00,
    low_52w: 14630.20,
    volume: 4100000000,
    market_cap: 1890000000000,
    pe_ratio: 15.4,
    dividend_yield: 3.12,
  },
  {
    symbol: "^STOXX50E",
    name: "Euro Stoxx 50",
    asset_type: "index",
    sector: "Indice Europe",
    price: 4982.60,
    change: 32.10,
    change_percent: 0.65,
    currency: "EUR",
    day_high: 5010.40,
    day_low: 4960.20,
    high_52w: 5121.70,
    low_52w: 4005.10,
    volume: 5800000000,
    market_cap: 3950000000000,
    pe_ratio: 14.6,
    dividend_yield: 3.25,
  },
]

export const PRELOADED_STOCKS: StockQuote[] = [
  {
    symbol: "MC.PA",
    name: "LVMH Moët Hennessy",
    asset_type: "stock",
    sector: "Luxe & Mode",
    price: 648.50,
    change: 14.20,
    change_percent: 2.24,
    currency: "EUR",
    day_high: 652.80,
    day_low: 638.10,
    high_52w: 886.40,
    low_52w: 580.20,
    volume: 485000,
    market_cap: 325000000000,
    pe_ratio: 21.8,
    dividend_yield: 2.02,
  },
  {
    symbol: "NVDA",
    name: "NVIDIA Corporation",
    asset_type: "stock",
    sector: "Semi-conducteurs & IA",
    price: 128.80,
    change: 4.60,
    change_percent: 3.70,
    currency: "USD",
    day_high: 130.20,
    day_low: 125.40,
    high_52w: 140.76,
    low_52w: 40.50,
    volume: 52000000,
    market_cap: 3160000000000,
    pe_ratio: 48.5,
    dividend_yield: 0.08,
  },
  {
    symbol: "CW8.PA",
    name: "Amundi MSCI World UCITS ETF",
    asset_type: "etf",
    sector: "Actions Monde",
    price: 546.20,
    change: 3.80,
    change_percent: 0.70,
    currency: "EUR",
    day_high: 548.00,
    day_low: 543.10,
    high_52w: 552.40,
    low_52w: 418.90,
    volume: 38200,
    market_cap: 4300000000,
    pe_ratio: 21.2,
    dividend_yield: 1.25,
  },
  {
    symbol: "AAPL",
    name: "Apple Inc.",
    asset_type: "stock",
    sector: "Technologie",
    price: 228.50,
    change: 2.80,
    change_percent: 1.24,
    currency: "USD",
    day_high: 230.10,
    day_low: 226.40,
    high_52w: 237.23,
    low_52w: 164.08,
    volume: 48000000,
    market_cap: 3480000000000,
    pe_ratio: 33.8,
    dividend_yield: 0.45,
  },
  {
    symbol: "MSFT",
    name: "Microsoft Corporation",
    asset_type: "stock",
    sector: "Logiciels & Cloud",
    price: 432.10,
    change: 5.40,
    change_percent: 1.27,
    currency: "USD",
    day_high: 435.00,
    day_low: 428.20,
    high_52w: 468.35,
    low_52w: 309.45,
    volume: 21500000,
    market_cap: 3210000000000,
    pe_ratio: 35.2,
    dividend_yield: 0.72,
  },
  {
    symbol: "TTE.PA",
    name: "TotalEnergies SE",
    asset_type: "stock",
    sector: "Énergie & Pétrole",
    price: 61.80,
    change: -0.45,
    change_percent: -0.72,
    currency: "EUR",
    day_high: 62.40,
    day_low: 61.20,
    high_52w: 70.18,
    low_52w: 57.10,
    volume: 2950000,
    market_cap: 144000000000,
    pe_ratio: 7.4,
    dividend_yield: 5.15,
  },
  {
    symbol: "ASML.AS",
    name: "ASML Holding NV",
    asset_type: "stock",
    sector: "Semi-conducteurs",
    price: 768.90,
    change: 18.50,
    change_percent: 2.47,
    currency: "EUR",
    day_high: 775.00,
    day_low: 755.20,
    high_52w: 1021.80,
    low_52w: 535.00,
    volume: 850000,
    market_cap: 302000000000,
    pe_ratio: 38.4,
    dividend_yield: 0.82,
  },
  {
    symbol: "SAN.PA",
    name: "Sanofi SA",
    asset_type: "stock",
    sector: "Santé & Pharma",
    price: 102.30,
    change: 0.80,
    change_percent: 0.79,
    currency: "EUR",
    day_high: 103.20,
    day_low: 101.50,
    high_52w: 106.80,
    low_52w: 81.20,
    volume: 1420000,
    market_cap: 128000000000,
    pe_ratio: 13.9,
    dividend_yield: 3.71,
  },
  {
    symbol: "VUAA.PA",
    name: "Vanguard S&P 500 UCITS ETF",
    asset_type: "etf",
    sector: "Actions USA",
    price: 103.50,
    change: 0.65,
    change_percent: 0.63,
    currency: "EUR",
    day_high: 104.10,
    day_low: 102.80,
    high_52w: 105.20,
    low_52w: 80.40,
    volume: 95000,
    market_cap: 8900000000,
    pe_ratio: 24.5,
    dividend_yield: 1.35,
  },
  {
    symbol: "AMZN",
    name: "Amazon.com Inc.",
    asset_type: "stock",
    sector: "E-Commerce & Cloud",
    price: 189.40,
    change: 3.10,
    change_percent: 1.66,
    currency: "USD",
    day_high: 191.20,
    day_low: 187.00,
    high_52w: 201.20,
    low_52w: 118.35,
    volume: 34000000,
    market_cap: 1980000000000,
    pe_ratio: 42.1,
    dividend_yield: 0.0,
  },
  {
    symbol: "GOOGL",
    name: "Alphabet Inc.",
    asset_type: "stock",
    sector: "Communication & IA",
    price: 165.70,
    change: 1.95,
    change_percent: 1.19,
    currency: "USD",
    day_high: 167.30,
    day_low: 164.10,
    high_52w: 191.75,
    low_52w: 120.21,
    volume: 22000000,
    market_cap: 2040000000000,
    pe_ratio: 23.4,
    dividend_yield: 0.48,
  },
  {
    symbol: "TSLA",
    name: "Tesla Inc.",
    asset_type: "stock",
    sector: "Automobile & Énergie",
    price: 254.20,
    change: -4.80,
    change_percent: -1.85,
    currency: "USD",
    day_high: 261.00,
    day_low: 251.50,
    high_52w: 271.00,
    low_52w: 138.80,
    volume: 68000000,
    market_cap: 810000000000,
    pe_ratio: 64.0,
    dividend_yield: 0.0,
  },
  {
    symbol: "META",
    name: "Meta Platforms Inc.",
    asset_type: "stock",
    sector: "Communication & IA",
    price: 572.40,
    change: 8.60,
    change_percent: 1.52,
    currency: "USD",
    day_high: 575.80,
    day_low: 566.20,
    high_52w: 602.95,
    low_52w: 279.40,
    volume: 16500000,
    market_cap: 1450000000000,
    pe_ratio: 27.8,
    dividend_yield: 0.35,
  },
  {
    symbol: "BNP.PA",
    name: "BNP Paribas SA",
    asset_type: "stock",
    sector: "Banque & Finance",
    price: 66.40,
    change: 0.85,
    change_percent: 1.30,
    currency: "EUR",
    day_high: 67.10,
    day_low: 65.80,
    high_52w: 72.50,
    low_52w: 52.40,
    volume: 2450000,
    market_cap: 78000000000,
    pe_ratio: 7.2,
    dividend_yield: 6.92,
  },
  {
    symbol: "AI.PA",
    name: "Air Liquide SA",
    asset_type: "stock",
    sector: "Industrie & Gaz",
    price: 172.50,
    change: 1.10,
    change_percent: 0.64,
    currency: "EUR",
    day_high: 174.00,
    day_low: 171.20,
    high_52w: 192.40,
    low_52w: 154.20,
    volume: 680000,
    market_cap: 90000000000,
    pe_ratio: 27.5,
    dividend_yield: 1.85,
  },
  {
    symbol: "OR.PA",
    name: "L'Oréal SA",
    asset_type: "stock",
    sector: "Luxe & Beauté",
    price: 368.20,
    change: 3.40,
    change_percent: 0.93,
    currency: "EUR",
    day_high: 372.00,
    day_low: 365.10,
    high_52w: 460.00,
    low_52w: 355.00,
    volume: 420000,
    market_cap: 196000000000,
    pe_ratio: 30.2,
    dividend_yield: 1.79,
  },
  {
    symbol: "PLTR",
    name: "Palantir Technologies Inc.",
    asset_type: "stock",
    sector: "Logiciels & IA",
    price: 37.80,
    change: 1.45,
    change_percent: 3.99,
    currency: "USD",
    day_high: 38.50,
    day_low: 36.20,
    high_52w: 44.20,
    low_52w: 14.48,
    volume: 45000000,
    market_cap: 84000000000,
    pe_ratio: 88.0,
    dividend_yield: 0.0,
  },
  {
    symbol: "AMD",
    name: "Advanced Micro Devices",
    asset_type: "stock",
    sector: "Semi-conducteurs",
    price: 156.40,
    change: 4.20,
    change_percent: 2.76,
    currency: "USD",
    day_high: 158.50,
    day_low: 152.80,
    high_52w: 227.30,
    low_52w: 94.04,
    volume: 38000000,
    market_cap: 253000000000,
    pe_ratio: 110.2,
    dividend_yield: 0.0,
  },
  {
    symbol: "TSM",
    name: "Taiwan Semiconductor (TSMC)",
    asset_type: "stock",
    sector: "Semi-conducteurs",
    price: 178.60,
    change: 5.10,
    change_percent: 2.94,
    currency: "USD",
    day_high: 180.20,
    day_low: 174.50,
    high_52w: 193.47,
    low_52w: 84.10,
    volume: 18000000,
    market_cap: 926000000000,
    pe_ratio: 29.4,
    dividend_yield: 1.15,
  },
  {
    symbol: "RKLB",
    name: "Rocket Lab USA (Space / Lanceur)",
    asset_type: "stock",
    sector: "Aéronautique & Espace",
    price: 24.80,
    change: 1.15,
    change_percent: 4.86,
    currency: "USD",
    day_high: 25.40,
    day_low: 23.90,
    high_52w: 28.50,
    low_52w: 3.62,
    volume: 18500000,
    market_cap: 12200000000,
    pe_ratio: 42.0,
    dividend_yield: 0.0,
  },
  {
    symbol: "ASTS",
    name: "AST SpaceMobile (Satellites & Télécom)",
    asset_type: "stock",
    sector: "Satellites & Télécom Spatial",
    price: 28.40,
    change: 1.60,
    change_percent: 5.97,
    currency: "USD",
    day_high: 29.20,
    day_low: 27.10,
    high_52w: 39.08,
    low_52w: 1.97,
    volume: 12400000,
    market_cap: 7800000000,
    pe_ratio: 35.0,
    dividend_yield: 0.0,
  },
]

export const KEYWORD_SYNONYMS: Record<string, string[]> = {
  voiture: ["TSLA"],
  auto: ["TSLA"],
  automobile: ["TSLA"],
  electrique: ["TSLA"],
  tesla: ["TSLA"],
  spacex: ["RKLB", "TSLA", "ASTS"],
  space: ["RKLB", "ASTS", "TSLA"],
  espace: ["RKLB", "ASTS", "TSLA"],
  fusee: ["RKLB"],
  fusée: ["RKLB"],
  rocket: ["RKLB"],
  satellite: ["ASTS", "RKLB"],
  starlink: ["TSLA", "ASTS", "RKLB"],
  musk: ["TSLA", "RKLB"],
  luxe: ["MC.PA", "OR.PA"],
  mode: ["MC.PA"],
  vetement: ["MC.PA"],
  dior: ["MC.PA"],
  lvmh: ["MC.PA"],
  loreal: ["OR.PA"],
  "l'oreal": ["OR.PA"],
  beaute: ["OR.PA"],
  cosmetique: ["OR.PA"],
  petrole: ["TTE.PA"],
  pétrole: ["TTE.PA"],
  gaz: ["TTE.PA", "AI.PA"],
  energie: ["TTE.PA", "TSLA"],
  énergie: ["TTE.PA", "TSLA"],
  total: ["TTE.PA"],
  totalenergies: ["TTE.PA"],
  ia: ["NVDA", "MSFT", "GOOGL", "ASML.AS", "PLTR", "AMD", "TSM"],
  ai: ["NVDA", "MSFT", "GOOGL", "ASML.AS", "PLTR", "AMD", "TSM"],
  "intelligence artificielle": ["NVDA", "MSFT", "GOOGL", "PLTR"],
  chips: ["NVDA", "ASML.AS", "AMD", "TSM"],
  puce: ["NVDA", "ASML.AS", "AMD", "TSM"],
  puces: ["NVDA", "ASML.AS", "AMD", "TSM"],
  "semi-conducteur": ["NVDA", "ASML.AS", "AMD", "TSM"],
  semiconducteur: ["NVDA", "ASML.AS", "AMD", "TSM"],
  gpu: ["NVDA", "AMD"],
  iphone: ["AAPL"],
  apple: ["AAPL"],
  mac: ["AAPL"],
  ios: ["AAPL"],
  smartphone: ["AAPL", "GOOGL"],
  telephone: ["AAPL", "GOOGL"],
  téléphone: ["AAPL", "GOOGL"],
  ordinateur: ["AAPL", "MSFT"],
  windows: ["MSFT"],
  microsoft: ["MSFT"],
  cloud: ["MSFT", "AMZN", "GOOGL"],
  amazon: ["AMZN"],
  "e-commerce": ["AMZN"],
  ecommerce: ["AMZN"],
  livraison: ["AMZN"],
  google: ["GOOGL"],
  alphabet: ["GOOGL"],
  youtube: ["GOOGL"],
  recherche: ["GOOGL"],
  meta: ["META"],
  facebook: ["META"],
  instagram: ["META"],
  whatsapp: ["META"],
  reseau: ["META"],
  social: ["META"],
  sante: ["SAN.PA"],
  santé: ["SAN.PA"],
  pharma: ["SAN.PA"],
  sanofi: ["SAN.PA"],
  medicament: ["SAN.PA"],
  banque: ["BNP.PA"],
  finance: ["BNP.PA"],
  bnp: ["BNP.PA"],
  monde: ["CW8.PA"],
  world: ["CW8.PA"],
  msci: ["CW8.PA"],
  etf: ["CW8.PA", "VUAA.PA"],
  sp500: ["^GSPC", "VUAA.PA"],
  "s&p": ["^GSPC", "VUAA.PA"],
  cac: ["^FCHI"],
  cac40: ["^FCHI"],
  france: ["^FCHI", "MC.PA", "TTE.PA", "SAN.PA", "BNP.PA", "AI.PA", "OR.PA"],
  nasdaq: ["^IXIC"],
  tech: ["NVDA", "AAPL", "MSFT", "GOOGL", "META", "ASML.AS", "PLTR", "AMD", "TSM", "^IXIC"],
  dax: ["^GDAXI"],
  allemagne: ["^GDAXI"],
  europe: ["^STOXX50E", "ASML.AS", "MC.PA"],
  palantir: ["PLTR"],
  amd: ["AMD"],
  tsmc: ["TSM"],
  taiwan: ["TSM"],
}

export function searchLocalStocks(query: string): StockQuote[] {
  const q = query.trim().toLowerCase()
  if (!q) return PRELOADED_STOCKS

  const matchedSymbols = new Set<string>()

  // 1. Check keyword synonyms
  for (const [kw, syms] of Object.entries(KEYWORD_SYNONYMS)) {
    if (kw.includes(q) || q.includes(kw)) {
      syms.forEach((s) => matchedSymbols.add(s.toUpperCase()))
    }
  }

  // 2. Direct name, symbol, sector check
  const allAssets = [...PRELOADED_STOCKS, ...PRELOADED_INDICES]
  for (const asset of allAssets) {
    const sym = asset.symbol.toLowerCase()
    const name = asset.name.toLowerCase()
    const sector = (asset.sector || "").toLowerCase()
    if (sym.includes(q) || name.includes(q) || sector.includes(q)) {
      matchedSymbols.add(asset.symbol.toUpperCase())
    }
  }

  const results: StockQuote[] = []
  for (const sym of matchedSymbols) {
    const found = allAssets.find((a) => a.symbol.toUpperCase() === sym)
    if (found) results.push(found)
  }

  return results
}

export function generateFallbackHistory(symbol: string, currentPrice: number, timeframe: string = "1M"): StockHistoryPoint[] {
  const tfConfig: Record<string, { count: number; daysStep: number; volatility: number; intervalLabel: string }> = {
    "1D": { count: 78, daysStep: 1 / 78, volatility: 0.012, intervalLabel: "5m" },
    "1W": { count: 120, daysStep: 7 / 120, volatility: 0.025, intervalLabel: "15m" },
    "1M": { count: 30, daysStep: 1, volatility: 0.06, intervalLabel: "1d" },
    "1Y": { count: 250, daysStep: 365 / 250, volatility: 0.22, intervalLabel: "1d" },
    "5Y": { count: 260, daysStep: (5 * 365) / 260, volatility: 0.55, intervalLabel: "1w" },
    "ALL": { count: 300, daysStep: (15 * 365) / 300, volatility: 0.85, intervalLabel: "1m" },
  }

  const cfg = tfConfig[timeframe.toUpperCase()] || tfConfig["1M"]
  const points: StockHistoryPoint[] = []

  // Seeded deterministic pseudo-random generator
  let seed = symbol.split("").reduce((acc, char, idx) => acc + char.charCodeAt(0) * (idx + 1) * 31, 1337)
  function seededRandom(): number {
    seed = (seed * 9301 + 49297) % 233280
    return seed / 233280
  }

  // Generate multi-scale fractal geometric Brownian motion
  const count = cfg.count
  const dt = 1 / count
  const drift = (seededRandom() - 0.45) * 0.15
  const sigma = cfg.volatility

  const raw: number[] = [1.0]
  for (let i = 1; i < count; i++) {
    // Box-Muller transform for normal distribution
    const u1 = Math.max(1e-7, seededRandom())
    const u2 = seededRandom()
    const z = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2)

    // Geometric Brownian Motion step: S_{t+1} = S_t * exp((mu - 0.5*sigma^2)*dt + sigma*sqrt(dt)*Z)
    const prev = raw[i - 1]
    const nextVal = prev * Math.exp((drift - 0.5 * sigma * sigma) * dt + sigma * Math.sqrt(dt) * z)
    raw.push(Math.max(0.01, nextVal))
  }

  // Anchor the final point strictly to currentPrice
  const lastRaw = raw[raw.length - 1]
  const factor = currentPrice / (lastRaw || 1)
  const now = Date.now()

  for (let i = 0; i < raw.length; i++) {
    const stepsBack = raw.length - 1 - i
    const timeMs = now - stepsBack * cfg.daysStep * 86400 * 1000
    const d = new Date(timeMs)
    let label = ""

    if (timeframe.toUpperCase() === "1D") {
      label = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
    } else if (timeframe.toUpperCase() === "1W") {
      label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:00`
    } else if (timeframe.toUpperCase() === "1M") {
      label = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`
    } else if (timeframe.toUpperCase() === "1Y" || timeframe.toUpperCase() === "5Y") {
      label = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" })
    } else {
      label = `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(-2)}`
    }

    const priceVal = Math.round(raw[i] * factor * 100) / 100
    const volBase = Math.round(2000000 * (0.6 + 0.8 * seededRandom()))

    points.push({
      time: Math.floor(timeMs / 1000),
      label,
      price: priceVal,
      volume: volBase,
    })
  }

  return points
}

export const StockAPI = {
  /**
   * Fetch top market indices (CAC 40, S&P 500, Nasdaq, DAX, Euro Stoxx)
   */
  async getMarketIndices(): Promise<StockQuote[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/investments/indices`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to fetch market indices")
      const data = await res.json()
      return Array.isArray(data) && data.length > 0 ? data : PRELOADED_INDICES
    } catch {
      return PRELOADED_INDICES
    }
  },

  /**
   * Fetch list of curated stocks, ETFs, and search results
   */
  async getStocks(query?: string): Promise<StockQuote[]> {
    try {
      const qParam = query ? `?q=${encodeURIComponent(query)}` : ""
      const res = await fetch(`${API_BASE_URL}/investments/stocks${qParam}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to fetch stocks")
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
      return query && query.trim() ? searchLocalStocks(query) : PRELOADED_STOCKS
    } catch {
      return query && query.trim() ? searchLocalStocks(query) : PRELOADED_STOCKS
    }
  },

  /**
   * Fast search combining instant local keywords/catalog and live Yahoo Finance search API
   */
  async searchLive(query: string): Promise<StockQuote[]> {
    const q = query.trim()
    if (!q) return PRELOADED_STOCKS

    // 1. Get immediate local matches
    const localMatches = searchLocalStocks(q)

    try {
      const res = await fetch(`${API_BASE_URL}/investments/stocks?q=${encodeURIComponent(q)}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) return localMatches
      const remoteData = await res.json()
      if (!Array.isArray(remoteData) || remoteData.length === 0) {
        return localMatches
      }

      // Merge and deduplicate by symbol
      const map = new Map<string, StockQuote>()
      localMatches.forEach((s) => map.set(s.symbol.toUpperCase(), s))
      remoteData.forEach((s: StockQuote) => map.set(s.symbol.toUpperCase(), s))

      return Array.from(map.values())
    } catch {
      return localMatches
    }
  },

  /**
   * Fetch single stock quote with full metrics
   */
  async getStockDetail(symbol: string): Promise<StockQuote | null> {
    try {
      const res = await fetch(`${API_BASE_URL}/investments/stocks/${encodeURIComponent(symbol)}`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to fetch stock detail")
      return await res.json()
    } catch {
      const found =
        PRELOADED_STOCKS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase()) ||
        PRELOADED_INDICES.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase())
      return found || null
    }
  },

  /**
   * Fetch historical price points for interactive chart
   */
  async getStockHistory(symbol: string, timeframe: string = "1M"): Promise<StockHistoryPoint[]> {
    try {
      const res = await fetch(
        `${API_BASE_URL}/investments/stocks/${encodeURIComponent(symbol)}/history?timeframe=${encodeURIComponent(timeframe)}`,
        {
          headers: getAuthHeaders(),
          cache: "no-store",
        }
      )
      if (!res.ok) throw new Error("Failed to fetch stock history")
      const data = await res.json()
      if (Array.isArray(data) && data.length > 0) return data
      const target =
        PRELOADED_STOCKS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase()) ||
        PRELOADED_INDICES.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase())
      return generateFallbackHistory(symbol, target ? target.price : 100.0, timeframe)
    } catch {
      const target =
        PRELOADED_STOCKS.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase()) ||
        PRELOADED_INDICES.find((s) => s.symbol.toUpperCase() === symbol.toUpperCase())
      return generateFallbackHistory(symbol, target ? target.price : 100.0, timeframe)
    }
  },

  /**
   * Get all user portfolio holdings with live valuation and PRU
   */
  async getHoldings(): Promise<InvestmentHolding[]> {
    try {
      const res = await fetch(`${API_BASE_URL}/investments/holdings`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to fetch holdings")
      return await res.json()
    } catch {
      return [
        {
          id: "seed-1",
          symbol: "MC.PA",
          name: "LVMH Moët Hennessy",
          asset_type: "stock",
          quantity: 6,
          buy_price: 590.0,
          current_price: 648.50,
          total_value: 3891.0,
          total_cost: 3540.0,
          unrealized_pnl: 351.0,
          unrealized_pnl_percent: 9.92,
          daily_change: 85.20,
          daily_change_percent: 2.24,
          currency: "EUR",
          sector: "Luxe & Mode",
          weight_percent: 24.5,
        },
        {
          id: "seed-2",
          symbol: "NVDA",
          name: "NVIDIA Corporation",
          asset_type: "stock",
          quantity: 25,
          buy_price: 92.50,
          current_price: 128.80,
          total_value: 3220.0,
          total_cost: 2312.5,
          unrealized_pnl: 907.5,
          unrealized_pnl_percent: 39.24,
          daily_change: 115.0,
          daily_change_percent: 3.70,
          currency: "USD",
          sector: "Semi-conducteurs",
          weight_percent: 20.3,
        },
        {
          id: "seed-3",
          symbol: "CW8.PA",
          name: "Amundi MSCI World UCITS ETF",
          asset_type: "etf",
          quantity: 30,
          buy_price: 465.0,
          current_price: 546.20,
          total_value: 16386.0,
          total_cost: 13950.0,
          unrealized_pnl: 2436.0,
          unrealized_pnl_percent: 17.46,
          daily_change: 114.0,
          daily_change_percent: 0.70,
          currency: "EUR",
          sector: "Actions Monde",
          weight_percent: 45.1,
        },
        {
          id: "seed-4",
          symbol: "AAPL",
          name: "Apple Inc.",
          asset_type: "stock",
          quantity: 12,
          buy_price: 182.0,
          current_price: 228.50,
          total_value: 2742.0,
          total_cost: 2184.0,
          unrealized_pnl: 558.0,
          unrealized_pnl_percent: 25.55,
          daily_change: 33.60,
          daily_change_percent: 1.24,
          currency: "USD",
          sector: "Technologie",
          weight_percent: 10.1,
        },
      ]
    }
  },

  /**
   * Add a new holding to the portfolio
   */
  async createHolding(data: {
    symbol: string
    name?: string
    asset_type?: string
    quantity: number
    buy_price: number
    currency?: string
    account_id?: string
    sector?: string
    notes?: string
  }): Promise<InvestmentHolding> {
    const res = await fetch(`${API_BASE_URL}/investments/holdings`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to create holding")
    }
    return await res.json()
  },

  /**
   * Update holding
   */
  async updateHolding(
    id: string,
    data: {
      name?: string
      quantity?: number
      buy_price?: number
      currency?: string
      account_id?: string
      sector?: string
      notes?: string
    }
  ): Promise<{ message: string; id: string }> {
    const res = await fetch(`${API_BASE_URL}/investments/holdings/${encodeURIComponent(id)}`, {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to update holding")
    }
    return await res.json()
  },

  /**
   * Delete holding
   */
  async deleteHolding(id: string): Promise<{ message: string; id: string }> {
    const res = await fetch(`${API_BASE_URL}/investments/holdings/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.detail || "Failed to delete holding")
    }
    return await res.json()
  },

  /**
   * Get portfolio summary analytics
   */
  async getPortfolioSummary(): Promise<PortfolioSummary> {
    try {
      const res = await fetch(`${API_BASE_URL}/investments/summary`, {
        headers: getAuthHeaders(),
        cache: "no-store",
      })
      if (!res.ok) throw new Error("Failed to fetch portfolio summary")
      return await res.json()
    } catch {
      return {
        total_value: 26239.0,
        total_cost: 21986.5,
        unrealized_pnl: 4252.5,
        unrealized_pnl_percent: 19.34,
        daily_change: 347.8,
        daily_change_percent: 1.34,
        holdings_count: 4,
        allocation_by_type: [
          { type: "etf", value: 16386.0, percent: 62.4 },
          { type: "stock", value: 9853.0, percent: 37.6 },
        ],
        allocation_by_sector: [
          { sector: "Actions Monde", value: 16386.0, percent: 62.4 },
          { sector: "Luxe & Mode", value: 3891.0, percent: 14.8 },
          { sector: "Semi-conducteurs", value: 3220.0, percent: 12.3 },
          { sector: "Technologie", value: 2742.0, percent: 10.5 },
        ],
      }
    }
  },
}
