import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { FinlyAPI } from "@/lib/api/finly-api"

describe("FinlyAPI Loans and Amortization", () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => (key === "finly_token" ? "fake_token_123" : null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("fetches loans list", async () => {
    const mockLoans = [
      {
        id: "loan_1",
        name: "Crédit Immobilier RP",
        loan_type: "mortgage",
        principal_amount: 250000,
        interest_rate: 3.2,
        insurance_rate: 0.3,
        duration_months: 300,
        start_date: "2024-01",
        monthly_payment: 1250,
        remaining_balance: 235000,
        capital_amortized: 15000,
        completion_percentage: 6.0,
      },
    ]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockLoans,
    })

    const result = await FinlyAPI.getLoans()
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe("Crédit Immobilier RP")
    expect(result[0].remaining_balance).toBe(235000)
  })

  it("creates a new loan", async () => {
    const newLoanPayload = {
      name: "Prêt Auto",
      loan_type: "auto" as const,
      principal_amount: 20000,
      interest_rate: 4.5,
      duration_months: 48,
      start_date: "2025-06",
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: "loan_auto_1", ...newLoanPayload, remaining_balance: 20000 }),
    })

    const result = await FinlyAPI.createLoan(newLoanPayload)
    expect(result.id).toBe("loan_auto_1")
    expect(result.name).toBe("Prêt Auto")
  })

  it("fetches loan amortization schedule", async () => {
    const mockSchedule = {
      loan_id: "loan_1",
      loan_name: "Crédit Immobilier RP",
      total_periods: 2,
      schedule: [
        {
          period: 1,
          date: "2024-01",
          beginning_balance: 250000,
          principal_payment: 550,
          interest_payment: 666,
          insurance_payment: 62.5,
          total_payment: 1278.5,
          ending_balance: 249450,
          cumulative_principal: 550,
          cumulative_interest: 666,
          is_past: true,
        },
      ],
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSchedule,
    })

    const result = await FinlyAPI.getLoanSchedule("loan_1")
    expect(result.schedule).toHaveLength(1)
    expect(result.schedule[0].ending_balance).toBe(249450)
  })

  it("simulates early repayment with duration reduction", async () => {
    const mockSim = {
      strategy: "reduce_duration" as const,
      repayment_amount: 10000,
      repayment_month: 24,
      penalty_amount: 0,
      balance_before: 235000,
      balance_after: 225000,
      original_remaining_months: 276,
      new_remaining_months: 255,
      months_saved: 21,
      years_saved: 1.8,
      current_monthly_payment: 1250,
      new_monthly_payment: 1250,
      monthly_payment_change: 0,
      interest_saved: 4500,
      insurance_saved: 1312.5,
      total_gross_savings: 5812.5,
      net_savings: 5812.5,
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSim,
    })

    const result = await FinlyAPI.simulateLoanEarlyRepayment("loan_1", {
      repayment_amount: 10000,
      strategy: "reduce_duration",
    })

    expect(result.strategy).toBe("reduce_duration")
    expect(result.months_saved).toBe(21)
    expect(result.net_savings).toBe(5812.5)
  })
})
