import { jsPDF } from "jspdf"
import { BudgetSummary, BudgetItem } from "@/lib/types/finance"
import { dictionaries } from "@/lib/i18n"
import { FINLY_LOGO_FULL_DATA_URL } from "@/lib/assets/brand-logo"

export interface BudgetPdfExportOptions {
  summary: BudgetSummary
  periodName: string
  accountName?: string
  userName?: string
  currency?: string
  cashflowImageDataUrl?: string | null
  language?: "fr" | "en"
}

export const PDF_STRINGS = {
  fr: {
    reportCategory: "RAPPORT FINANCIER & BUDGET",
    reportTitle: "Rapport Budgétaire & Cash Flow",
    ownerLabel: "Titulaire :",
    periodLabel: "Période :",
    accountLabel: "Compte :",
    editedLabel: "Édité le",
    defaultAccount: "Tous les comptes",
    defaultUser: "Utilisateur Finly",
    kpis: {
      income: "REVENUS TOTAUX",
      expenses: "DÉPENSES RÉELLES",
      remaining: "RESTE À VIVRE",
      savingsRate: "TAUX D'ÉPARGNE",
    },
    budgetSectionTitle: "Exécution du Budget Mensuel",
    budgetRatio: (spent: string, budget: string, pct: number) =>
      `${spent} consommés sur ${budget} alloués (${pct}%)`,
    statusExceeded: "Dépassement",
    statusRespected: "Budget Respecté",
    distributionTitle: "Répartition des Dépenses par Catégorie",
    noExpenses: "Aucune dépense enregistrée sur cette période.",
    categoriesTitle: "Détail des Catégories & Avancement",
    colCategory: "CATÉGORIE",
    colAllocated: "ALLOUÉ",
    colSpent: "DÉPENSÉ",
    colRemaining: "RESTE",
    colUsed: "CONSO.",
    colStatus: "STATUT",
    statusWarning: "Attention",
    statusConform: "Conforme",
    statusUnbudgeted: "Hors budget",
    topExpensesTitle: "Principales Dépenses de la Période",
    colDate: "DATE",
    colLabelMerchant: "LIBELLÉ / MARCHAND",
    colCategoryTop: "CATÉGORIE",
    colAmount: "MONTANT",
    fallbackMerchant: "Dépense",
    fallbackCategory: "Divers",
    cashflowTitle: "Schéma des Flux Financiers (Cash Flow)",
    footerConfidential: "Finly — Document confidentiel de gestion budgétaire",
    footerPage: (page: number, total: number) => `Page ${page} sur ${total}`,
    filePrefix: "finly_rapport_budget",
    fileDefaultPeriod: "synthese",
  },
  en: {
    reportCategory: "FINANCIAL & BUDGET REPORT",
    reportTitle: "Budget & Cash Flow Report",
    ownerLabel: "Owner:",
    periodLabel: "Period:",
    accountLabel: "Account:",
    editedLabel: "Generated on",
    defaultAccount: "All accounts",
    defaultUser: "Finly User",
    kpis: {
      income: "TOTAL INCOME",
      expenses: "ACTUAL EXPENSES",
      remaining: "REMAINING CASHFLOW",
      savingsRate: "SAVINGS RATE",
    },
    budgetSectionTitle: "Monthly Budget Execution",
    budgetRatio: (spent: string, budget: string, pct: number) =>
      `${spent} spent of ${budget} allocated (${pct}%)`,
    statusExceeded: "Over Budget",
    statusRespected: "On Track",
    distributionTitle: "Expense Breakdown by Category",
    noExpenses: "No expenses recorded for this period.",
    categoriesTitle: "Category Breakdown & Progress",
    colCategory: "CATEGORY",
    colAllocated: "BUDGET",
    colSpent: "SPENT",
    colRemaining: "REMAINING",
    colUsed: "USED",
    colStatus: "STATUS",
    statusWarning: "Warning",
    statusConform: "On track",
    statusUnbudgeted: "Unbudgeted",
    topExpensesTitle: "Top Expenses of the Period",
    colDate: "DATE",
    colLabelMerchant: "DESCRIPTION / MERCHANT",
    colCategoryTop: "CATEGORY",
    colAmount: "AMOUNT",
    fallbackMerchant: "Expense",
    fallbackCategory: "Miscellaneous",
    cashflowTitle: "Cash Flow Diagram",
    footerConfidential: "Finly — Confidential financial management report",
    footerPage: (page: number, total: number) => `Page ${page} of ${total}`,
    filePrefix: "finly_budget_report",
    fileDefaultPeriod: "summary",
  },
}

const CATEGORY_COLORS = [
  [99, 102, 241],   // Indigo 500
  [16, 185, 129],   // Emerald 500
  [245, 158, 11],   // Amber 500
  [244, 63, 94],    // Rose 500
  [14, 165, 233],   // Sky 500
  [168, 85, 247],   // Purple 500
  [236, 72, 153],   // Pink 500
  [20, 184, 166],   // Teal 500
  [249, 115, 22],   // Orange 500
  [100, 116, 139],  // Slate 500
]

/**
 * Formate un montant en devise avec separateur de milliers lisible (espace standard)
 */
export function formatCurrency(amount: number, currency: string = "EUR"): string {
  const symbol = currency === "EUR" ? "€" : currency
  const isNegative = amount < 0
  const absVal = Math.abs(amount)
  const [intPart, decPart] = absVal.toFixed(2).split(".")
  const formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ")
  return `${isNegative ? "-" : ""}${formattedInt},${decPart} ${symbol}`
}

/**
 * Capture le graphique Cashflow SVG actuel dans le DOM et le convertit en PNG haute definition en mode clair.
 */
export async function captureCashflowChartAsImage(
  containerId: string = "finly-cashflow-sankey-container"
): Promise<string | null> {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return null
  }

  const container = document.getElementById(containerId)
  if (!container) return null

  const svg = container.querySelector("svg")
  if (!svg) return null

  try {
    const clonedSvg = svg.cloneNode(true) as SVGSVGElement
    const bbox = svg.getBoundingClientRect()
    const width = Math.max(bbox.width || 900, 900)
    const height = Math.max(bbox.height || 520, 520)

    clonedSvg.setAttribute("width", `${width}`)
    clonedSvg.setAttribute("height", `${height}`)
    if (!clonedSvg.getAttribute("viewBox")) {
      clonedSvg.setAttribute("viewBox", `0 0 ${width} ${height}`)
    }

    // Fond blanc epure
    const bgRect = document.createElementNS("http://www.w3.org/2000/svg", "rect")
    bgRect.setAttribute("width", "100%")
    bgRect.setAttribute("height", "100%")
    bgRect.setAttribute("fill", "#ffffff")
    clonedSvg.insertBefore(bgRect, clonedSvg.firstChild)

    // Bloc de style injecte pour forcer les textes en noir pur et lisible
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style")
    styleEl.textContent = `
      text, tspan {
        fill: #09090b !important;
        color: #09090b !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
        font-weight: 600 !important;
        font-size: 11px !important;
        opacity: 1 !important;
      }
    `
    clonedSvg.insertBefore(styleEl, clonedSvg.firstChild)

    const texts = clonedSvg.querySelectorAll("text, tspan")
    texts.forEach((txt) => {
      txt.setAttribute("fill", "#09090b")
      txt.setAttribute("style", "fill: #09090b !important; color: #09090b !important; font-weight: 600 !important; opacity: 1 !important;")
    })

    const svgString = new XMLSerializer().serializeToString(clonedSvg)
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" })
    const url = URL.createObjectURL(svgBlob)

    return await new Promise<string | null>((resolve) => {
      const img = new Image()
      img.onload = () => {
        const scale = 2
        const canvas = document.createElement("canvas")
        canvas.width = width * scale
        canvas.height = height * scale
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          URL.revokeObjectURL(url)
          return resolve(null)
        }
        ctx.fillStyle = "#ffffff"
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        URL.revokeObjectURL(url)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = () => {
        URL.revokeObjectURL(url)
        resolve(null)
      }
      img.src = url
    })
  } catch (err) {
    console.error("Erreur capture cashflow chart:", err)
    return null
  }
}

export function exportBudgetToPdf({
  summary,
  periodName,
  accountName,
  userName,
  currency = "EUR",
  cashflowImageDataUrl = null,
  language = "fr",
}: BudgetPdfExportOptions): jsPDF {
  const isEn = language === "en"
  const strings = isEn ? PDF_STRINGS.en : PDF_STRINGS.fr
  const categoryDict = isEn ? dictionaries.en.categories : dictionaries.fr.categories
  const getCatLabel = (cat: string) => categoryDict[cat] || cat

  const resolvedAccountName = accountName || strings.defaultAccount
  const resolvedUserName = userName || strings.defaultUser

  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  })

  const pageWidth = 210
  const pageHeight = 297
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  let y = margin

  // -------------------------------------------------------------
  // 1. En-tête du document avec VRAI LOGO FINLY et typographie épurée
  // -------------------------------------------------------------
  const logoWidth = 27
  const logoHeight = 7.5

  try {
    doc.addImage(
      FINLY_LOGO_FULL_DATA_URL,
      "PNG",
      margin,
      y,
      logoWidth,
      logoHeight,
      undefined,
      "FAST"
    )
  } catch {
    // Fallback élégant en cas d'impossibilité de charger l'image
    doc.setFillColor(79, 70, 229)
    doc.roundedRect(margin, y, 20, 7, 1.5, 1.5, "F")
    doc.setTextColor(255, 255, 255)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("FINLY", margin + 10, y + 4.8, { align: "center" })
  }

  // Sous-titre catégorie sous le logo
  doc.setTextColor(113, 113, 122) // Zinc 500
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.text(strings.reportCategory, margin, y + logoHeight + 4)

  // Meta informations à droite (alignées de manière sobre et claire)
  const nowStr = new Date().toLocaleDateString(isEn ? "en-US" : "fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })

  const rightX = pageWidth - margin
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8)
  doc.setTextColor(24, 24, 27) // Zinc 900
  doc.text(`${resolvedUserName}`, rightX, y + 2, { align: "right" })

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7)
  doc.setTextColor(113, 113, 122) // Zinc 500
  doc.text(`${strings.periodLabel} ${periodName}`, rightX, y + 5.5, { align: "right" })
  doc.text(`${strings.accountLabel} ${resolvedAccountName}`, rightX, y + 8.8, { align: "right" })
  doc.setTextColor(161, 161, 170) // Zinc 400
  doc.text(`${strings.editedLabel} ${nowStr}`, rightX, y + 12, { align: "right" })

  y += 16.5

  // Ligne de séparation fine et minimaliste
  doc.setDrawColor(228, 228, 231) // Zinc 200
  doc.setLineWidth(0.25)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5.5

  // -------------------------------------------------------------
  // 2. Chiffres Clés / KPIs Cartes Minimalistes
  // -------------------------------------------------------------
  const totalIncome = summary.total_income || 0
  const totalSpent = summary.total_spent || 0
  const netSavings = totalIncome - totalSpent
  const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0

  const kpiCardWidth = (contentWidth - 6) / 4
  const kpiCardHeight = 15.5

  const kpis = [
    {
      title: strings.kpis.income,
      val: `+${formatCurrency(totalIncome, currency)}`,
      color: [5, 150, 105], // Emerald 600
    },
    {
      title: strings.kpis.expenses,
      val: formatCurrency(totalSpent, currency),
      color: [225, 29, 72], // Rose 600
    },
    {
      title: strings.kpis.remaining,
      val: `${netSavings > 0 ? "+" : ""}${formatCurrency(netSavings, currency)}`,
      color: netSavings >= 0 ? [5, 150, 105] : [225, 29, 72],
    },
    {
      title: strings.kpis.savingsRate,
      val: `${savingsRate > 0 ? "+" : ""}${savingsRate.toFixed(1)} %`,
      color: savingsRate >= 20 ? [5, 150, 105] : (savingsRate > 0 ? [79, 70, 229] : [225, 29, 72]),
    },
  ]

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiCardWidth + 2)
    doc.setFillColor(250, 250, 250) // Zinc 50
    doc.setDrawColor(228, 228, 231) // Zinc 200
    doc.roundedRect(kpiX, y, kpiCardWidth, kpiCardHeight, 1.8, 1.8, "FD")

    doc.setTextColor(113, 113, 122) // Zinc 500
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6)
    doc.text(kpi.title, kpiX + 3, y + 4.5)

    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2])
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    doc.text(kpi.val, kpiX + 3, y + 11.2)
  })

  y += kpiCardHeight + 5

  // -------------------------------------------------------------
  // 3. Exécution Budgétaire Globale
  // -------------------------------------------------------------
  const totalBudget = summary.total_budget || 0
  const globalBudgetPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  const isBudgetExceeded = totalBudget > 0 && totalSpent > totalBudget

  doc.setFillColor(250, 250, 250) // Zinc 50
  doc.setDrawColor(228, 228, 231)
  doc.roundedRect(margin, y, contentWidth, 16.5, 1.8, 1.8, "FD")

  doc.setTextColor(24, 24, 27) // Zinc 900
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text(strings.budgetSectionTitle, margin + 4, y + 4.8)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(113, 113, 122)
  const budgetRatioText = strings.budgetRatio(
    formatCurrency(totalSpent, currency),
    formatCurrency(totalBudget, currency),
    globalBudgetPercentage
  )
  doc.text(budgetRatioText, margin + 4, y + 9.2)

  // Badge statut sobre
  const statusLabel = isBudgetExceeded ? strings.statusExceeded : strings.statusRespected
  const statusBg = isBudgetExceeded ? [255, 241, 242] : [236, 253, 245] // Rose 50 / Emerald 50
  const statusFg = isBudgetExceeded ? [225, 29, 72] : [5, 150, 105] // Rose 600 / Emerald 600

  doc.setFillColor(statusBg[0], statusBg[1], statusBg[2])
  doc.roundedRect(pageWidth - margin - 34, y + 3, 30, 5, 1.2, 1.2, "F")
  doc.setTextColor(statusFg[0], statusFg[1], statusFg[2])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.8)
  doc.text(statusLabel, pageWidth - margin - 19, y + 6.5, { align: "center" })

  // Barre de progression élégante
  const barY = y + 12
  const barWidth = contentWidth - 8
  const barHeight = 2.2
  doc.setFillColor(228, 228, 231) // Zinc 200
  doc.roundedRect(margin + 4, barY, barWidth, barHeight, 1.1, 1.1, "F")

  if (totalBudget > 0) {
    const filledWidth = Math.max(2, Math.min(barWidth, (totalSpent / totalBudget) * barWidth))
    const progressColor = isBudgetExceeded
      ? [225, 29, 72]
      : (globalBudgetPercentage > 85 ? [245, 158, 11] : [16, 185, 129])
    doc.setFillColor(progressColor[0], progressColor[1], progressColor[2])
    doc.roundedRect(margin + 4, barY, filledWidth, barHeight, 1.1, 1.1, "F")
  }

  y += 21.5

  // -------------------------------------------------------------
  // 4. Répartition des Dépenses par Catégorie
  // -------------------------------------------------------------
  const items = (summary.items || []).filter((it) => (it.spent || 0) > 0)
  const totalExpensesForGraph = items.reduce((sum, it) => sum + (it.spent || 0), 0)

  doc.setTextColor(24, 24, 27) // Zinc 900
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text(strings.distributionTitle, margin, y)
  y += 3.8

  if (items.length > 0 && totalExpensesForGraph > 0) {
    // Barre segmentée
    const distBarHeight = 4
    let currentX = margin
    items.forEach((it, idx) => {
      const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
      const segWidth = (it.spent / totalExpensesForGraph) * contentWidth
      doc.setFillColor(color[0], color[1], color[2])
      doc.rect(currentX, y, segWidth, distBarHeight, "F")
      currentX += segWidth
    })
    y += distBarHeight + 3

    // Légende sur 3 colonnes
    const legendCols = 3
    const colW = contentWidth / legendCols
    const legendItemH = 4.2

    items.forEach((it, idx) => {
      const colIdx = idx % legendCols
      const rowIdx = Math.floor(idx / legendCols)
      const legX = margin + colIdx * colW
      const legY = y + rowIdx * legendItemH

      const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
      doc.setFillColor(color[0], color[1], color[2])
      doc.circle(legX + 1.5, legY - 0.8, 1.1, "F")

      const pct = ((it.spent / totalExpensesForGraph) * 100).toFixed(0)
      doc.setTextColor(71, 85, 105)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(6.8)
      const catLabel = getCatLabel(it.category)
      const labelText = `${catLabel} (${pct}%) : ${formatCurrency(it.spent, currency)}`
      doc.text(labelText, legX + 4.5, legY)
    })

    const legendRows = Math.ceil(items.length / legendCols)
    y += legendRows * legendItemH + 4
  } else {
    doc.setTextColor(148, 163, 184)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(7.5)
    doc.text(strings.noExpenses, margin, y + 2.5)
    y += 6
  }

  // -------------------------------------------------------------
  // 5. Tableau Détaillé des Postes Budgétaires
  // -------------------------------------------------------------
  if (y > pageHeight - 48) {
    doc.addPage()
    y = margin
  }

  doc.setTextColor(24, 24, 27)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text(strings.categoriesTitle, margin, y)
  y += 3.5

  // En-tête de tableau épuré
  const thH = 5.2
  doc.setFillColor(244, 244, 245) // Zinc 100
  doc.rect(margin, y, contentWidth, thH, "F")

  doc.setTextColor(82, 82, 91) // Zinc 600
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)

  doc.text(strings.colCategory, margin + 3, y + 3.6)
  doc.text(strings.colAllocated, margin + 60, y + 3.6, { align: "right" })
  doc.text(strings.colSpent, margin + 95, y + 3.6, { align: "right" })
  doc.text(strings.colRemaining, margin + 130, y + 3.6, { align: "right" })
  doc.text(strings.colUsed, margin + 152, y + 3.6, { align: "right" })
  doc.text(strings.colStatus, pageWidth - margin - 3, y + 3.6, { align: "right" })

  y += thH

  const allItems: BudgetItem[] = summary.items || []
  const sortedItems = [...allItems].sort((a, b) => b.spent - a.spent)

  sortedItems.forEach((it, idx) => {
    if (y > pageHeight - 30) {
      doc.addPage()
      y = margin
      doc.setFillColor(244, 244, 245)
      doc.rect(margin, y, contentWidth, thH, "F")
      doc.setTextColor(82, 82, 91)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(6.5)
      doc.text(strings.colCategory, margin + 3, y + 3.6)
      doc.text(strings.colAllocated, margin + 60, y + 3.6, { align: "right" })
      doc.text(strings.colSpent, margin + 95, y + 3.6, { align: "right" })
      doc.text(strings.colRemaining, margin + 130, y + 3.6, { align: "right" })
      doc.text(strings.colUsed, margin + 152, y + 3.6, { align: "right" })
      doc.text(strings.colStatus, pageWidth - margin - 3, y + 3.6, { align: "right" })
      y += thH
    }

    const rowH = 4.8
    if (idx % 2 === 1) {
      doc.setFillColor(250, 250, 250) // Zinc 50
      doc.rect(margin, y, contentWidth, rowH, "F")
    }

    doc.setTextColor(24, 24, 27) // Zinc 900
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.8)
    doc.text(getCatLabel(it.category), margin + 3, y + 3.3)

    // Alloué
    const limit = it.monthly_limit || 0
    const limitStr = limit > 0 ? formatCurrency(limit, currency) : "—"
    doc.text(limitStr, margin + 60, y + 3.3, { align: "right" })

    // Dépensé
    doc.setFont("helvetica", "bold")
    doc.text(formatCurrency(it.spent, currency), margin + 95, y + 3.3, { align: "right" })
    doc.setFont("helvetica", "normal")

    // Reste
    const remVal = limit > 0 ? limit - it.spent : 0
    if (limit > 0) {
      doc.setTextColor(remVal >= 0 ? 5 : 225, remVal >= 0 ? 150 : 29, remVal >= 0 ? 105 : 72)
      doc.text(formatCurrency(remVal, currency), margin + 130, y + 3.3, { align: "right" })
    } else {
      doc.setTextColor(161, 161, 170)
      doc.text("—", margin + 130, y + 3.3, { align: "right" })
    }

    // % Conso
    doc.setTextColor(82, 82, 91)
    const pctStr = limit > 0 ? `${it.percentage}%` : "—"
    doc.text(pctStr, margin + 152, y + 3.3, { align: "right" })

    // Statut
    if (limit > 0) {
      if (it.spent > limit) {
        doc.setTextColor(225, 29, 72)
        doc.setFont("helvetica", "bold")
        doc.text(strings.statusExceeded, pageWidth - margin - 3, y + 3.3, { align: "right" })
      } else if (it.percentage >= 85) {
        doc.setTextColor(217, 119, 6)
        doc.setFont("helvetica", "bold")
        doc.text(strings.statusWarning, pageWidth - margin - 3, y + 3.3, { align: "right" })
      } else {
        doc.setTextColor(5, 150, 105)
        doc.text(strings.statusConform, pageWidth - margin - 3, y + 3.3, { align: "right" })
      }
    } else {
      doc.setTextColor(161, 161, 170)
      doc.text(strings.statusUnbudgeted, pageWidth - margin - 3, y + 3.3, { align: "right" })
    }

    y += rowH
  })

  y += 5

  // -------------------------------------------------------------
  // 6. Principales Dépenses de la Période (Top 5)
  // -------------------------------------------------------------
  const allTxs = allItems.flatMap((it) => it.transactions || [])
  const topExpenses = [...allTxs]
    .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
    .slice(0, 5)

  if (topExpenses.length > 0) {
    if (y > pageHeight - 38) {
      doc.addPage()
      y = margin
    }

    doc.setTextColor(24, 24, 27)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.text(strings.topExpensesTitle, margin, y)
    y += 3.5

    doc.setFillColor(244, 244, 245)
    doc.rect(margin, y, contentWidth, 5, "F")
    doc.setTextColor(82, 82, 91)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.5)
    doc.text(strings.colDate, margin + 3, y + 3.5)
    doc.text(strings.colLabelMerchant, margin + 28, y + 3.5)
    doc.text(strings.colCategoryTop, margin + 115, y + 3.5)
    doc.text(strings.colAmount, pageWidth - margin - 3, y + 3.5, { align: "right" })
    y += 5

    topExpenses.forEach((tx, idx) => {
      const rowH = 4.6
      if (idx % 2 === 1) {
        doc.setFillColor(250, 250, 250)
        doc.rect(margin, y, contentWidth, rowH, "F")
      }
      doc.setTextColor(113, 113, 122)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(6.8)
      doc.text(tx.date || "—", margin + 3, y + 3.2)

      doc.setTextColor(24, 24, 27)
      const merchantLabel = tx.merchant || tx.raw_label || strings.fallbackMerchant
      doc.text(merchantLabel.slice(0, 42), margin + 28, y + 3.2)

      doc.setTextColor(113, 113, 122)
      doc.text(getCatLabel(tx.category || strings.fallbackCategory), margin + 115, y + 3.2)

      doc.setTextColor(225, 29, 72)
      doc.setFont("helvetica", "bold")
      doc.text(formatCurrency(tx.amount, currency), pageWidth - margin - 3, y + 3.2, { align: "right" })
      doc.setFont("helvetica", "normal")
      y += rowH
    })
    y += 5
  }

  // -------------------------------------------------------------
  // 7. Schéma du Cash Flow (Capture d'écran en Mode Clair)
  // -------------------------------------------------------------
  if (cashflowImageDataUrl) {
    const imgH = 84
    if (y > pageHeight - imgH - 20) {
      doc.addPage()
      y = margin
    }

    doc.setTextColor(24, 24, 27)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(8.5)
    doc.text(strings.cashflowTitle, margin, y)
    y += 3.5

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(228, 228, 231)
    doc.roundedRect(margin, y, contentWidth, imgH, 1.8, 1.8, "FD")

    try {
      doc.addImage(cashflowImageDataUrl, "PNG", margin + 1, y + 1, contentWidth - 2, imgH - 2)
    } catch (e) {
      console.error("Impossible d'ajouter l'image cashflow au PDF:", e)
    }
    y += imgH + 6
  }

  // -------------------------------------------------------------
  // 8. Pied de page minimaliste sur toutes les pages
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(228, 228, 231) // Zinc 200
    doc.setLineWidth(0.25)
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)

    doc.setTextColor(161, 161, 170) // Zinc 400
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.text(strings.footerConfidential, margin, pageHeight - 6.5)
    doc.text(strings.footerPage(i, totalPages), pageWidth - margin, pageHeight - 6.5, { align: "right" })
  }

  return doc
}

export async function downloadBudgetPdf(options: BudgetPdfExportOptions): Promise<void> {
  let cashflowImg = options.cashflowImageDataUrl
  if (cashflowImg === undefined) {
    cashflowImg = await captureCashflowChartAsImage()
  }

  const isEn = options.language === "en"
  const strings = isEn ? PDF_STRINGS.en : PDF_STRINGS.fr

  const doc = exportBudgetToPdf({
    ...options,
    cashflowImageDataUrl: cashflowImg,
  })

  const cleanPeriod = options.periodName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
  const fileName = `${strings.filePrefix}_${cleanPeriod || strings.fileDefaultPeriod}.pdf`
  doc.save(fileName)
}
