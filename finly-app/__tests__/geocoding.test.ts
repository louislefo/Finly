import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  extractPostalCode,
  isOnlineMerchant,
  extractMerchantAndLocationInfo,
  geocodeTransaction,
} from "@/lib/utils/geocoding"
import { Transaction } from "@/lib/types/finance"

describe("geocoding utilities", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("extracts 5-digit postal codes accurately", () => {
    expect(extractPostalCode("CB CARREFOUR CITY 75011 PARIS")).toBe("75011")
    expect(extractPostalCode("PAIEMENT CARTE LECLERC 35000 RENNES")).toBe("35000")
    expect(extractPostalCode("ACHAT FNAC LYON")).toBeNull()
  })

  it("identifies purely online transactions", () => {
    expect(isOnlineMerchant("NETFLIX")).toBe(true)
    expect(isOnlineMerchant("Spotify", "PRLV SPOTIFY MONTHLY")).toBe(true)
    expect(isOnlineMerchant("Amazon Prime", "AMAZON.FR")).toBe(true)
    expect(isOnlineMerchant("Carrefour City", "CB CARREFOUR")).toBe(false)
    expect(isOnlineMerchant("Boulangerie Paul", "CB BOULANGERIE")).toBe(false)
  })

  it("extracts store name, postal code, and city info from raw bank labels", () => {
    const res1 = extractMerchantAndLocationInfo("Carrefour", "CB CARREFOUR EXPRESS 75011 PARIS")
    expect(res1.cleanStore).toBe("Carrefour")
    expect(res1.postalCode).toBe("75011")
    expect(res1.cityHint).toBe("PARIS 11e")
    expect(res1.locationQuery).toContain("Carrefour")
    expect(res1.locationQuery).toContain("75011")

    const res2 = extractMerchantAndLocationInfo("Decathlon", "PAIEMENT CARTE 12/04 DECATHLON RENNES")
    expect(res2.cleanStore).toBe("Decathlon")
    expect(res2.cityHint).toBe("RENNES")
    expect(res2.locationQuery).toContain("Decathlon")
    expect(res2.locationQuery).toContain("RENNES")
  })

  it("geocodes transactions with fallback and cache strictly within France", async () => {
    const mockTx: Transaction = {
      id: "tx-test-1",
      merchant: "Carrefour Market",
      rawLabel: "CB CARREFOUR MARKET 69002 LYON",
      amount: -45.5,
      category: "Alimentation",
      date: "2026-04-12",
      time: "14:30",
      account: "acc-1",
    }

    const loc = await geocodeTransaction(mockTx)
    expect(loc).not.toBeNull()
    expect(loc?.lat).toBeDefined()
    expect(loc?.lng).toBeDefined()
    expect(loc?.city).toBeDefined()
    expect(loc.lat).toBeGreaterThan(41.0)
    expect(loc.lat).toBeLessThan(51.5)
    expect(loc.lng).toBeGreaterThan(-5.5)
    expect(loc.lng).toBeLessThan(10.0)
  })
})
