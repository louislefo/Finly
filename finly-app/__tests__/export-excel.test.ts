import { describe, it, expect } from "vitest"
import { generateExportFileName } from "@/lib/export/excel-export"
import { Account } from "@/lib/types/finance"

describe("Excel Export Utility - generateExportFileName", () => {
  const mockAccounts: Account[] = [
    {
      id: "acc_1",
      name: "Compte Courant Bourso",
      bank: "BoursoBank",
      type: "Compte Courant",
      balance: 1500,
      currency: "EUR",
      accountNumber: "FR76...",
    },
  ]

  it("generates correct filename for string scope shorthand", () => {
    expect(generateExportFileName("transactions", "xlsx")).toBe("finly_transactions.xlsx")
    expect(generateExportFileName("projets", "csv")).toBe("finly_projets.csv")
  })

  it("generates correct filename for monthly period", () => {
    const fileName = generateExportFileName(
      {
        format: "xlsx",
        scope: "transactions",
        periodMode: "month",
        selectedMonth: "2026-09",
      },
      "xlsx",
      mockAccounts
    )
    expect(fileName).toBe("finly_transactions_septembre_2026.xlsx")
  })

  it("generates correct filename for account filtering", () => {
    const fileName = generateExportFileName(
      {
        format: "xlsx",
        scope: "transactions",
        periodMode: "last_3_months",
        selectedAccountId: "acc_1",
      },
      "xlsx",
      mockAccounts
    )
    expect(fileName).toContain("finly_transactions_compte_courant_bourso_3_derniers_mois.xlsx")
  })

  it("generates correct filename for expenses transaction type", () => {
    const fileName = generateExportFileName(
      {
        format: "csv",
        scope: "all",
        transactionType: "expense",
        periodMode: "year",
      },
      "csv",
      mockAccounts
    )
    expect(fileName).toMatch(/^finly_depenses_annee_\d{4}\.csv$/)
  })
})
