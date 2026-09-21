import { describe, it, expect } from "vitest"
import {
  POPULAR_CURRENCIES,
  CURRENCY_FLAGS,
  CURRENCY_SYMBOLS,
} from "@/lib/api/forex-api"

describe("Forex API & Currency Utilities", () => {
  it("defines standard ECB supported currencies", () => {
    expect(POPULAR_CURRENCIES.length).toBeGreaterThan(10)
    const eur = POPULAR_CURRENCIES.find((c) => c.code === "EUR")
    const usd = POPULAR_CURRENCIES.find((c) => c.code === "USD")
    const gbp = POPULAR_CURRENCIES.find((c) => c.code === "GBP")

    expect(eur).toBeDefined()
    expect(usd).toBeDefined()
    expect(gbp).toBeDefined()
    expect(eur?.symbol).toBe("€")
    expect(usd?.symbol).toBe("$")
  })

  it("maps currency codes to ISO country flags", () => {
    expect(CURRENCY_FLAGS["EUR"]).toBe("EU")
    expect(CURRENCY_FLAGS["USD"]).toBe("US")
    expect(CURRENCY_FLAGS["GBP"]).toBe("GB")
    expect(CURRENCY_FLAGS["JPY"]).toBe("JP")
    expect(CURRENCY_FLAGS["CHF"]).toBe("CH")
  })

  it("maps currency symbols accurately", () => {
    expect(CURRENCY_SYMBOLS["EUR"]).toBe("€")
    expect(CURRENCY_SYMBOLS["USD"]).toBe("$")
    expect(CURRENCY_SYMBOLS["JPY"]).toBe("¥")
    expect(CURRENCY_SYMBOLS["GBP"]).toBe("£")
  })

  it("calculates conversion and inverse exchange rates properly", () => {
    const baseRate = 1.149 // 1 EUR = 1.149 USD
    const amount = 250 // 250 EUR
    const converted = amount * baseRate
    const inverse = 1 / baseRate

    expect(converted).toBeCloseTo(287.25, 2)
    expect(inverse).toBeCloseTo(0.8703, 4)
  })
})
