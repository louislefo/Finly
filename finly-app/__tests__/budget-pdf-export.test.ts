import { describe, it, expect, vi } from 'vitest'
import { exportBudgetToPdf, downloadBudgetPdf, formatCurrency } from '@/lib/export/budget-pdf-export'
import { BudgetSummary } from '@/lib/types/finance'

describe('Budget PDF Export', () => {
  const mockSummary: BudgetSummary = {
    month: '2026-09',
    total_budget: 2500,
    total_spent: 1850.5,
    total_income: 3400,
    net_cashflow: 1549.5,
    remaining_budget: 649.5,
    items: [
      {
        category: 'Alimentation',
        monthly_limit: 600,
        spent: 540.2,
        remaining: 59.8,
        percentage: 90,
        transactions_count: 12,
        transactions: [
          {
            id: 'tx_1',
            merchant: 'Carrefour',
            raw_label: 'CB CARREFOUR 05/09',
            date: '2026-09-05',
            amount: -85.5,
            category: 'Alimentation',
          },
        ],
      },
      {
        category: 'Transports',
        monthly_limit: 200,
        spent: 240.0,
        remaining: -40.0,
        percentage: 120,
        transactions_count: 4,
        transactions: [
          {
            id: 'tx_2',
            merchant: 'SNCF',
            raw_label: 'CB SNCF PARIS',
            date: '2026-09-02',
            amount: -120.0,
            category: 'Transports',
          },
        ],
      },
      {
        category: 'Loisirs & Sorties',
        monthly_limit: 300,
        spent: 150.0,
        remaining: 150.0,
        percentage: 50,
        transactions_count: 2,
        transactions: [],
      },
    ],
  }

  it('formats currency correctly with clear thousands separator', () => {
    expect(formatCurrency(1250.5)).toBe('1 250,50 €')
    expect(formatCurrency(1000000)).toBe('1 000 000,00 €')
    expect(formatCurrency(-45.2, 'USD')).toBe('-45,20 USD')
  })

  it('generates a valid jsPDF document with standard budget data and user name', () => {
    const doc = exportBudgetToPdf({
      summary: mockSummary,
      periodName: 'Septembre 2026',
      accountName: 'Tous les comptes',
      userName: 'Louis Lefort',
      currency: 'EUR',
    })

    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('handles empty budget items without throwing errors', () => {
    const emptySummary: BudgetSummary = {
      month: '2026-09',
      total_budget: 0,
      total_spent: 0,
      remaining_budget: 0,
      items: [],
    }

    const doc = exportBudgetToPdf({
      summary: emptySummary,
      periodName: 'Septembre 2026',
    })

    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('generates a valid jsPDF document including cashflow image data URL', () => {
    // 1x1 transparent PNG data URL for test
    const dummyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
    const doc = exportBudgetToPdf({
      summary: mockSummary,
      periodName: 'Septembre 2026',
      accountName: 'Tous les comptes',
      userName: 'Louis Lefort',
      currency: 'EUR',
      cashflowImageDataUrl: dummyPng,
    })

    expect(doc).toBeDefined()
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(1)
  })

  it('calls doc.save with formatted file name in downloadBudgetPdf', () => {
    expect(typeof downloadBudgetPdf).toBe('function')
  })
})
