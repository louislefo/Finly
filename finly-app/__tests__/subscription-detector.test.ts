import { describe, it, expect } from "vitest"
import { detectSubscriptions, normalizeMerchantName } from "@/lib/utils/subscription-detector"
import { Transaction } from "@/lib/types/finance"

describe("Subscription Detector Utility", () => {
  it("normalizes merchant names accurately", () => {
    expect(normalizeMerchantName("CB SPOTIFY*FR 12/09")).toBe("spotify")
    expect(normalizeMerchantName("PRLV SEPA NETFLIX.COM")).toBe("netflix")
    expect(normalizeMerchantName("FREE MOBILE SA")).toBe("free mobile")
  })

  it("requires at least 3 occurrences across months to detect a recurring subscription", () => {
    const twoMonthsTx: Transaction[] = [
      {
        id: "tx1",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Netflix",
        amount: -15.99,
        date: "2026-07-15",
        category: "Abonnements",
      },
      {
        id: "tx2",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Netflix",
        amount: -15.99,
        date: "2026-08-15",
        category: "Abonnements",
      },
    ]

    const result2 = detectSubscriptions(twoMonthsTx, new Date("2026-09-01"))
    expect(result2.activeSubscriptions.length).toBe(0)

    const threeMonthsTx: Transaction[] = [
      ...twoMonthsTx,
      {
        id: "tx3",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Netflix",
        amount: -15.99,
        date: "2026-09-15",
        category: "Abonnements",
      },
    ]

    const result3 = detectSubscriptions(threeMonthsTx, new Date("2026-09-20"))
    expect(result3.activeSubscriptions.length).toBe(1)
    expect(result3.activeSubscriptions[0].name).toBe("Netflix")
    expect(result3.activeSubscriptions[0].monthlyCost).toBe(15.99)
    expect(result3.activeSubscriptions[0].cycle).toBe("monthly")
    expect(result3.activeSubscriptions[0].status).toBe("active")
  })

  it("detects cancelled or dormant subscriptions when no payment for over 2 months", () => {
    const oldTx: Transaction[] = [
      {
        id: "tx1",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Gym Club",
        amount: -30.0,
        date: "2026-01-10",
        category: "Sport & Bien-être",
      },
      {
        id: "tx2",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Gym Club",
        amount: -30.0,
        date: "2026-02-10",
        category: "Sport & Bien-être",
      },
      {
        id: "tx3",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Gym Club",
        amount: -30.0,
        date: "2026-03-10",
        category: "Sport & Bien-être",
      },
    ]

    // Now is September 2026 (6 months later)
    const result = detectSubscriptions(oldTx, new Date("2026-09-20"))
    expect(result.activeSubscriptions.length).toBe(0)
    expect(result.cancelledSubscriptions.length).toBe(1)
    expect(result.cancelledSubscriptions[0].name).toBe("Gym Club")
    expect(result.monthlySavingsFromCancelled).toBe(30.0)
  })

  it("flags price increases accurately", () => {
    const priceHikeTx: Transaction[] = [
      {
        id: "tx1",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Cloud SaaS",
        amount: -20.0,
        date: "2026-06-01",
        category: "Abonnements",
      },
      {
        id: "tx2",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Cloud SaaS",
        amount: -20.0,
        date: "2026-07-01",
        category: "Abonnements",
      },
      {
        id: "tx3",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Cloud SaaS",
        amount: -25.0,
        date: "2026-08-01",
        category: "Abonnements",
      },
      {
        id: "tx4",
        account_id: "acc_1",
        account: "Courant",
        merchant: "Cloud SaaS",
        amount: -25.0,
        date: "2026-09-01",
        category: "Abonnements",
      },
    ]

    const result = detectSubscriptions(priceHikeTx, new Date("2026-09-10"))
    expect(result.activeSubscriptions.length).toBe(1)
    expect(result.activeSubscriptions[0].latestAmount).toBe(25.0)
  })
})
