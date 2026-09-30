import { describe, it, expect, vi, beforeEach } from "vitest"
import { StockAPI } from "@/lib/api/stock-api"

describe("StockAPI Client", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("getMarketIndices returns indices list", async () => {
    const mockIndices = [
      { symbol: "^FCHI", name: "CAC 40", price: 7980.5, change_percent: 0.85, currency: "EUR" },
      { symbol: "^GSPC", name: "S&P 500", price: 5750.25, change_percent: 0.42, currency: "USD" },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockIndices,
    } as any)

    const result = await StockAPI.getMarketIndices()
    expect(result).toHaveLength(2)
    expect(result[0].symbol).toBe("^FCHI")
  })

  it("getStocks returns search and filtered list", async () => {
    const mockStocks = [
      { symbol: "AAPL", name: "Apple Inc.", price: 228.5, change_percent: 1.2, currency: "USD" },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockStocks,
    } as any)

    const result = await StockAPI.getStocks("apple")
    expect(result).toHaveLength(1)
    expect(result[0].symbol).toBe("AAPL")
  })

  it("getHoldings returns portfolio holdings with PRU", async () => {
    const mockHoldings = [
      {
        id: "hold-1",
        symbol: "MC.PA",
        name: "LVMH",
        quantity: 5,
        buy_price: 580,
        current_price: 642.5,
        total_value: 3212.5,
        total_cost: 2900,
        unrealized_pnl: 312.5,
        unrealized_pnl_percent: 10.78,
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockHoldings,
    } as any)

    const result = await StockAPI.getHoldings()
    expect(result).toHaveLength(1)
    expect(result[0].unrealized_pnl).toBe(312.5)
    expect(result[0].buy_price).toBe(580)
  })

  it("searchLocalStocks finds assets by French and English concept keywords", async () => {
    const { searchLocalStocks } = await import("@/lib/api/stock-api")
    
    // Search by synonym "voiture" should return Tesla (TSLA)
    const carResults = searchLocalStocks("voiture")
    expect(carResults.some((s) => s.symbol === "TSLA")).toBe(true)

    // Search by synonym "pétrole" should return TotalEnergies (TTE.PA)
    const oilResults = searchLocalStocks("pétrole")
    expect(oilResults.some((s) => s.symbol === "TTE.PA")).toBe(true)

    // Search by synonym "luxe" should return LVMH (MC.PA)
    const luxuryResults = searchLocalStocks("luxe")
    expect(luxuryResults.some((s) => s.symbol === "MC.PA")).toBe(true)
  })

  it("searchLive merges local matches and remote search results", async () => {
    const mockRemote = [
      { symbol: "PLTR", name: "Palantir Technologies", price: 37.8, change_percent: 3.99, currency: "USD" },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRemote,
    } as any)

    const result = await StockAPI.searchLive("palantir")
    expect(result.some((s) => s.symbol === "PLTR")).toBe(true)
  })
})
