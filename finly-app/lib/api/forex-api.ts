/**
 * Frankfurter Forex API Client
 * European Central Bank reference exchange rates
 * https://api.frankfurter.dev
 */

export type ForexTimeframe = "7D" | "1M" | "3M" | "1Y" | "5Y"

export interface ForexRatesResponse {
  amount: number
  base: string
  date: string
  rates: Record<string, number>
}

export interface ForexTimeSeriesPoint {
  date: string
  rate: number
}

export interface ForexTimeSeriesResponse {
  amount: number
  base: string
  start_date: string
  end_date: string
  rates: Record<string, Record<string, number>>
}

export interface CurrencyItem {
  code: string
  name: string
  symbol: string
  flag: string
}

export const POPULAR_CURRENCIES: CurrencyItem[] = [
  { code: "EUR", name: "Euro", symbol: "€", flag: "EU" },
  { code: "USD", name: "US Dollar", symbol: "$", flag: "US" },
  { code: "GBP", name: "British Pound", symbol: "£", flag: "GB" },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF", flag: "CH" },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", flag: "JP" },
  { code: "CAD", name: "Canadian Dollar", symbol: "CA$", flag: "CA" },
  { code: "AUD", name: "Australian Dollar", symbol: "AU$", flag: "AU" },
  { code: "CNY", name: "Chinese Yuan", symbol: "¥", flag: "CN" },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", flag: "SG" },
  { code: "SEK", name: "Swedish Krona", symbol: "kr", flag: "SE" },
  { code: "NOK", name: "Norwegian Krone", symbol: "kr", flag: "NO" },
  { code: "DKK", name: "Danish Krone", symbol: "kr", flag: "DK" },
  { code: "PLN", name: "Polish Zloty", symbol: "zł", flag: "PL" },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", flag: "BR" },
  { code: "INR", name: "Indian Rupee", symbol: "₹", flag: "IN" },
  { code: "MXN", name: "Mexican Peso", symbol: "Mex$", flag: "MX" },
  { code: "TRY", name: "Turkish Lira", symbol: "₺", flag: "TR" },
  { code: "ZAR", name: "South African Rand", symbol: "R", flag: "ZA" },
]

export const CURRENCY_FLAGS: Record<string, string> = {
  AUD: "AU",
  BGN: "BG",
  BRL: "BR",
  CAD: "CA",
  CHF: "CH",
  CNY: "CN",
  CZK: "CZ",
  DKK: "DK",
  EUR: "EU",
  GBP: "GB",
  HKD: "HK",
  HUF: "HU",
  IDR: "ID",
  ILS: "IL",
  INR: "IN",
  ISK: "IS",
  JPY: "JP",
  KRW: "KR",
  MXN: "MX",
  MYR: "MY",
  NOK: "NO",
  NZD: "NZ",
  PHP: "PH",
  PLN: "PL",
  RON: "RO",
  SEK: "SE",
  SGD: "SG",
  THB: "TH",
  TRY: "TR",
  USD: "US",
  ZAR: "ZA",
}

export const CURRENCY_SYMBOLS: Record<string, string> = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "CHF",
  JPY: "¥",
  CAD: "CA$",
  AUD: "AU$",
  CNY: "¥",
  SGD: "S$",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  PLN: "zł",
  BRL: "R$",
  INR: "₹",
  MXN: "Mex$",
  TRY: "₺",
  ZAR: "R",
  HKD: "HK$",
  NZD: "NZ$",
  KRW: "₩",
  HUF: "Ft",
  CZK: "Kč",
  ILS: "₪",
  IDR: "Rp",
  PHP: "₱",
  RON: "lei",
  THB: "฿",
  MYR: "RM",
  BGN: "лв",
  ISK: "kr",
}

function formatDate(d: Date): string {
  return d.toISOString().split("T")[0]
}

function getStartDateForTimeframe(timeframe: ForexTimeframe): string {
  const now = new Date()
  const d = new Date(now)

  switch (timeframe) {
    case "7D":
      d.setDate(d.getDate() - 7)
      break
    case "1M":
      d.setMonth(d.getMonth() - 1)
      break
    case "3M":
      d.setMonth(d.getMonth() - 3)
      break
    case "1Y":
      d.setFullYear(d.getFullYear() - 1)
      break
    case "5Y":
      d.setFullYear(d.getFullYear() - 5)
      break
    default:
      d.setMonth(d.getMonth() - 1)
  }

  return formatDate(d)
}

export class ForexAPI {
  private static baseUrl = "https://api.frankfurter.dev/v1"

  /**
   * Get all supported currencies dictionary
   */
  static async getCurrencies(): Promise<Record<string, string>> {
    try {
      const res = await fetch(`${this.baseUrl}/currencies`, { cache: "default" })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return await res.json()
    } catch {
      // Fallback default dictionary
      return {
        EUR: "Euro",
        USD: "US Dollar",
        GBP: "British Pound",
        CHF: "Swiss Franc",
        JPY: "Japanese Yen",
        CAD: "Canadian Dollar",
        AUD: "Australian Dollar",
        CNY: "Chinese Renminbi Yuan",
        SGD: "Singapore Dollar",
        SEK: "Swedish Krona",
        NOK: "Norwegian Krone",
        DKK: "Danish Krone",
        PLN: "Polish Zloty",
        BRL: "Brazilian Real",
        INR: "Indian Rupee",
        MXN: "Mexican Peso",
        TRY: "Turkish Lira",
        ZAR: "South African Rand",
      }
    }
  }

  /**
   * Get latest exchange rates with a given base currency
   */
  static async getLatestRates(base = "EUR"): Promise<ForexRatesResponse> {
    const res = await fetch(`${this.baseUrl}/latest?base=${encodeURIComponent(base)}`, {
      cache: "no-store",
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch latest forex rates: HTTP ${res.status}`)
    }
    return await res.json()
  }

  /**
   * Get historical exchange rate time-series between base and target currency
   */
  static async getTimeSeries(
    base: string,
    target: string,
    timeframe: ForexTimeframe
  ): Promise<ForexTimeSeriesPoint[]> {
    if (base === target) {
      return []
    }

    const startDate = getStartDateForTimeframe(timeframe)
    const endDate = formatDate(new Date())

    const res = await fetch(
      `${this.baseUrl}/${startDate}..${endDate}?base=${encodeURIComponent(
        base
      )}&symbols=${encodeURIComponent(target)}`,
      { cache: "no-store" }
    )

    if (!res.ok) {
      throw new Error(`Failed to fetch timeseries: HTTP ${res.status}`)
    }

    const data: ForexTimeSeriesResponse = await res.json()
    const points: ForexTimeSeriesPoint[] = []

    if (data.rates) {
      const sortedDates = Object.keys(data.rates).sort()
      for (const date of sortedDates) {
        const rateObj = data.rates[date]
        if (rateObj && rateObj[target] !== undefined) {
          points.push({
            date,
            rate: rateObj[target],
          })
        }
      }
    }

    return points
  }
}
