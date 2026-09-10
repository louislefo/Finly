import { jsPDF } from "jspdf"
import { BudgetSummary, BudgetItem } from "@/lib/types/finance"

export interface BudgetPdfExportOptions {
  summary: BudgetSummary
  periodName: string
  accountName?: string
  userName?: string
  currency?: string
  cashflowImageDataUrl?: string | null
}

const CATEGORY_COLORS = [
  [99, 102, 241],   // Indigo
  [16, 185, 129],   // Emerald
  [245, 158, 11],   // Amber
  [244, 63, 94],    // Rose
  [14, 165, 233],   // Sky
  [168, 85, 247],   // Purple
  [236, 72, 153],   // Pink
  [20, 184, 166],   // Teal
  [249, 115, 22],   // Orange
  [100, 116, 139],  // Slate
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

    // Bloc de style injecte pour forcer les textes en noir pur et gras
    const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style")
    styleEl.textContent = `
      text, tspan {
        fill: #000000 !important;
        color: #000000 !important;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
        font-weight: 700 !important;
        font-size: 11px !important;
        opacity: 1 !important;
      }
    `
    clonedSvg.insertBefore(styleEl, clonedSvg.firstChild)

    // Ajustement individuel de chaque noeud textuel pour lisibilite maximale
    const texts = clonedSvg.querySelectorAll("text, tspan")
    texts.forEach((txt) => {
      txt.setAttribute("fill", "#000000")
      txt.setAttribute("style", "fill: #000000 !important; color: #000000 !important; font-weight: 700 !important; opacity: 1 !important;")
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
  accountName = "Tous les comptes",
  userName = "Utilisateur Finly",
  currency = "EUR",
  cashflowImageDataUrl = null,
}: BudgetPdfExportOptions): jsPDF {
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
  // 1. En-tete du document
  // -------------------------------------------------------------
  // Logo / Finly Tag
  doc.setFillColor(79, 70, 229) // Indigo 600
  doc.roundedRect(margin, y, 20, 7, 1.5, 1.5, "F")
  doc.setTextColor(255, 255, 255)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("FINLY", margin + 10, y + 4.8, { align: "center" })

  // Titre principal
  doc.setTextColor(15, 23, 42) // Slate 900
  doc.setFont("helvetica", "bold")
  doc.setFontSize(15)
  doc.text("Rapport Budgétaire & Cash Flow", margin + 23, y + 5.5)

  // Meta infos a droite
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  const nowStr = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
  doc.text(`Titulaire : ${userName}`, pageWidth - margin, y + 1.5, { align: "right" })
  doc.text(`Période : ${periodName}`, pageWidth - margin, y + 5.2, { align: "right" })
  doc.text(`Compte : ${accountName}`, pageWidth - margin, y + 8.9, { align: "right" })
  doc.text(`Édité le ${nowStr}`, pageWidth - margin, y + 12.6, { align: "right" })

  y += 16

  // Ligne de separation
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.setLineWidth(0.4)
  doc.line(margin, y, pageWidth - margin, y)
  y += 5

  // -------------------------------------------------------------
  // 2. Chiffres Cles / KPIs
  // -------------------------------------------------------------
  const totalIncome = summary.total_income || 0
  const totalSpent = summary.total_spent || 0
  const netSavings = totalIncome - totalSpent
  const savingsRate = totalIncome > 0 ? ((netSavings / totalIncome) * 100) : 0

  const kpiCardWidth = (contentWidth - 6) / 4
  const kpiCardHeight = 15

  const kpis = [
    {
      title: "REVENUS TOTAUX",
      val: `+${formatCurrency(totalIncome, currency)}`,
      color: [16, 185, 129], // Emerald
    },
    {
      title: "DÉPENSES RÉELLES",
      val: formatCurrency(totalSpent, currency),
      color: [244, 63, 94], // Rose
    },
    {
      title: "RESTE À VIVRE",
      val: formatCurrency(netSavings, currency),
      color: netSavings >= 0 ? [16, 185, 129] : [244, 63, 94],
    },
    {
      title: "TAUX D'ÉPARGNE",
      val: `${savingsRate > 0 ? "+" : ""}${savingsRate.toFixed(1)} %`,
      color: savingsRate >= 20 ? [16, 185, 129] : (savingsRate > 0 ? [79, 70, 229] : [244, 63, 94]),
    },
  ]

  kpis.forEach((kpi, idx) => {
    const kpiX = margin + idx * (kpiCardWidth + 2)
    doc.setFillColor(248, 250, 252) // Slate 50
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(kpiX, y, kpiCardWidth, kpiCardHeight, 2, 2, "FD")

    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6)
    doc.text(kpi.title, kpiX + 3, y + 4.2)

    doc.setTextColor(kpi.color[0], kpi.color[1], kpi.color[2])
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9.5)
    doc.text(kpi.val, kpiX + 3, y + 10.8)
  })

  y += kpiCardHeight + 5

  // -------------------------------------------------------------
  // 3. Execution Budgetaire Globale
  // -------------------------------------------------------------
  const totalBudget = summary.total_budget || 0
  const globalBudgetPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0
  const isBudgetExceeded = totalBudget > 0 && totalSpent > totalBudget

  doc.setFillColor(248, 250, 252)
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, "FD")

  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(8.5)
  doc.text("Exécution du Budget Mensuel", margin + 4, y + 4.5)

  doc.setFont("helvetica", "normal")
  doc.setFontSize(7.5)
  doc.setTextColor(100, 116, 139)
  const budgetRatioText = `${formatCurrency(totalSpent, currency)} consommés sur ${formatCurrency(totalBudget, currency)} alloués (${globalBudgetPercentage}%)`
  doc.text(budgetRatioText, margin + 4, y + 8.8)

  // Statut badge a droite
  const statusLabel = isBudgetExceeded ? "Dépassement" : "Budget Respecté"
  const statusBg = isBudgetExceeded ? [254, 226, 226] : [209, 250, 229]
  const statusFg = isBudgetExceeded ? [225, 29, 72] : [5, 150, 105]

  doc.setFillColor(statusBg[0], statusBg[1], statusBg[2])
  doc.roundedRect(pageWidth - margin - 34, y + 2.5, 30, 5, 1.2, 1.2, "F")
  doc.setTextColor(statusFg[0], statusFg[1], statusFg[2])
  doc.setFont("helvetica", "bold")
  doc.setFontSize(7)
  doc.text(statusLabel, pageWidth - margin - 19, y + 6, { align: "center" })

  // Barre de progression
  const barY = y + 11.2
  const barWidth = contentWidth - 8
  const barHeight = 2.2
  doc.setFillColor(226, 232, 240)
  doc.roundedRect(margin + 4, barY, barWidth, barHeight, 1, 1, "F")

  if (totalBudget > 0) {
    const filledWidth = Math.max(2, Math.min(barWidth, (totalSpent / totalBudget) * barWidth))
    const progressColor = isBudgetExceeded ? [244, 63, 94] : (globalBudgetPercentage > 85 ? [245, 158, 11] : [79, 70, 229])
    doc.setFillColor(progressColor[0], progressColor[1], progressColor[2])
    doc.roundedRect(margin + 4, barY, filledWidth, barHeight, 1, 1, "F")
  }

  y += 21

  // -------------------------------------------------------------
  // 4. Graphique de Repartition des Depenses (Distribution Bar & Legende)
  // -------------------------------------------------------------
  const items = (summary.items || []).filter((it) => (it.spent || 0) > 0)
  const totalExpensesForGraph = items.reduce((sum, it) => sum + (it.spent || 0), 0)

  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("Répartition des Dépenses par Catégorie", margin, y)
  y += 3.5

  if (items.length > 0 && totalExpensesForGraph > 0) {
    // Barre segmentee de repartition
    const distBarHeight = 4.5
    let currentX = margin
    items.forEach((it, idx) => {
      const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length]
      const segWidth = (it.spent / totalExpensesForGraph) * contentWidth
      doc.setFillColor(color[0], color[1], color[2])
      doc.rect(currentX, y, segWidth, distBarHeight, "F")
      currentX += segWidth
    })
    y += distBarHeight + 2.5

    // Legende (sur 3 colonnes)
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
      doc.setTextColor(51, 65, 85)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      const labelText = `${it.category} (${pct}%) : ${formatCurrency(it.spent, currency)}`
      doc.text(labelText, legX + 4.5, legY)
    })

    const legendRows = Math.ceil(items.length / legendCols)
    y += legendRows * legendItemH + 4
  } else {
    doc.setTextColor(100, 116, 139)
    doc.setFont("helvetica", "italic")
    doc.setFontSize(7.5)
    doc.text("Aucune dépense enregistrée sur cette période.", margin, y + 2.5)
    y += 6
  }

  // -------------------------------------------------------------
  // 5. Tableau Detaille des Postes Budgetaires
  // -------------------------------------------------------------
  if (y > pageHeight - 45) {
    doc.addPage()
    y = margin
  }

  doc.setTextColor(15, 23, 42)
  doc.setFont("helvetica", "bold")
  doc.setFontSize(9)
  doc.text("Détail des Catégories & Avancement", margin, y)
  y += 3.5

  // Table header
  const thH = 5.5
  doc.setFillColor(241, 245, 249) // Slate 100
  doc.rect(margin, y, contentWidth, thH, "F")

  doc.setTextColor(71, 85, 105) // Slate 600
  doc.setFont("helvetica", "bold")
  doc.setFontSize(6.5)

  doc.text("CATÉGORIE", margin + 3, y + 3.8)
  doc.text("ALLOUÉ", margin + 60, y + 3.8, { align: "right" })
  doc.text("DÉPENSÉ", margin + 95, y + 3.8, { align: "right" })
  doc.text("RESTE", margin + 130, y + 3.8, { align: "right" })
  doc.text("CONSO.", margin + 152, y + 3.8, { align: "right" })
  doc.text("STATUT", pageWidth - margin - 3, y + 3.8, { align: "right" })

  y += thH

  const allItems: BudgetItem[] = summary.items || []
  const sortedItems = [...allItems].sort((a, b) => b.spent - a.spent)

  sortedItems.forEach((it, idx) => {
    // Check if new page needed
    if (y > pageHeight - 30) {
      doc.addPage()
      y = margin
      // Repeat header
      doc.setFillColor(241, 245, 249)
      doc.rect(margin, y, contentWidth, thH, "F")
      doc.setTextColor(71, 85, 105)
      doc.setFont("helvetica", "bold")
      doc.setFontSize(6.5)
      doc.text("CATÉGORIE", margin + 3, y + 3.8)
      doc.text("ALLOUÉ", margin + 60, y + 3.8, { align: "right" })
      doc.text("DÉPENSÉ", margin + 95, y + 3.8, { align: "right" })
      doc.text("RESTE", margin + 130, y + 3.8, { align: "right" })
      doc.text("CONSO.", margin + 152, y + 3.8, { align: "right" })
      doc.text("STATUT", pageWidth - margin - 3, y + 3.8, { align: "right" })
      y += thH
    }

    const rowH = 5
    if (idx % 2 === 1) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y, contentWidth, rowH, "F")
    }

    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(7)
    doc.text(it.category, margin + 3, y + 3.5)

    // Alloue
    const limit = it.monthly_limit || 0
    const limitStr = limit > 0 ? formatCurrency(limit, currency) : "—"
    doc.text(limitStr, margin + 60, y + 3.5, { align: "right" })

    // Depense
    doc.setFont("helvetica", "bold")
    doc.text(formatCurrency(it.spent, currency), margin + 95, y + 3.5, { align: "right" })
    doc.setFont("helvetica", "normal")

    // Reste
    const remVal = limit > 0 ? limit - it.spent : 0
    if (limit > 0) {
      doc.setTextColor(remVal >= 0 ? 16 : 244, remVal >= 0 ? 185 : 63, remVal >= 0 ? 129 : 94)
      doc.text(formatCurrency(remVal, currency), margin + 130, y + 3.5, { align: "right" })
    } else {
      doc.setTextColor(148, 163, 184)
      doc.text("—", margin + 130, y + 3.5, { align: "right" })
    }

    // % Conso
    doc.setTextColor(51, 65, 85)
    const pctStr = limit > 0 ? `${it.percentage}%` : "—"
    doc.text(pctStr, margin + 152, y + 3.5, { align: "right" })

    // Statut
    if (limit > 0) {
      if (it.spent > limit) {
        doc.setTextColor(225, 29, 72)
        doc.setFont("helvetica", "bold")
        doc.text("Dépassement", pageWidth - margin - 3, y + 3.5, { align: "right" })
      } else if (it.percentage >= 85) {
        doc.setTextColor(217, 119, 6)
        doc.setFont("helvetica", "bold")
        doc.text("Attention", pageWidth - margin - 3, y + 3.5, { align: "right" })
      } else {
        doc.setTextColor(5, 150, 105)
        doc.text("Conforme", pageWidth - margin - 3, y + 3.5, { align: "right" })
      }
    } else {
      doc.setTextColor(148, 163, 184)
      doc.text("Hors budget", pageWidth - margin - 3, y + 3.5, { align: "right" })
    }

    y += rowH
  })

  y += 5

  // -------------------------------------------------------------
  // 6. Principales Depenses de la Periode (Top 5)
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

    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("Principales Dépenses de la Période", margin, y)
    y += 3.5

    doc.setFillColor(241, 245, 249)
    doc.rect(margin, y, contentWidth, 5, "F")
    doc.setTextColor(71, 85, 105)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(6.5)
    doc.text("DATE", margin + 3, y + 3.5)
    doc.text("LIBELLÉ / MARCHAND", margin + 28, y + 3.5)
    doc.text("CATÉGORIE", margin + 115, y + 3.5)
    doc.text("MONTANT", pageWidth - margin - 3, y + 3.5, { align: "right" })
    y += 5

    topExpenses.forEach((tx, idx) => {
      const rowH = 4.8
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252)
        doc.rect(margin, y, contentWidth, rowH, "F")
      }
      doc.setTextColor(100, 116, 139)
      doc.setFont("helvetica", "normal")
      doc.setFontSize(7)
      doc.text(tx.date || "—", margin + 3, y + 3.3)

      doc.setTextColor(15, 23, 42)
      const merchantLabel = tx.merchant || tx.raw_label || "Dépense"
      doc.text(merchantLabel.slice(0, 42), margin + 28, y + 3.3)

      doc.setTextColor(100, 116, 139)
      doc.text(tx.category || "Divers", margin + 115, y + 3.3)

      doc.setTextColor(244, 63, 94)
      doc.setFont("helvetica", "bold")
      doc.text(formatCurrency(tx.amount, currency), pageWidth - margin - 3, y + 3.3, { align: "right" })
      doc.setFont("helvetica", "normal")
      y += rowH
    })
    y += 5
  }

  // -------------------------------------------------------------
  // 7. Schema du Cash Flow (Capture d'ecran en Mode Clair avec Libelles Noirs)
  // Tout en dessous du PDF
  // -------------------------------------------------------------
  if (cashflowImageDataUrl) {
    const imgH = 86
    // Check if enough space remains on current page or start on next page
    if (y > pageHeight - imgH - 20) {
      doc.addPage()
      y = margin
    }

    doc.setTextColor(15, 23, 42)
    doc.setFont("helvetica", "bold")
    doc.setFontSize(9)
    doc.text("Schéma des Flux Financiers (Cash Flow)", margin, y)
    y += 3.5

    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(226, 232, 240)
    doc.roundedRect(margin, y, contentWidth, imgH, 2, 2, "FD")
    
    doc.addImage(cashflowImageDataUrl, "PNG", margin + 1, y + 1, contentWidth - 2, imgH - 2)
    y += imgH + 6
  }

  // -------------------------------------------------------------
  // 8. Pied de page sur toutes les pages
  // -------------------------------------------------------------
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.setLineWidth(0.3)
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10)

    doc.setTextColor(148, 163, 184)
    doc.setFont("helvetica", "normal")
    doc.setFontSize(6.5)
    doc.text("Document confidentiel généré automatiquement par Finly", margin, pageHeight - 6.5)
    doc.text(`Page ${i} sur ${totalPages}`, pageWidth - margin, pageHeight - 6.5, { align: "right" })
  }

  return doc
}

export async function downloadBudgetPdf(options: BudgetPdfExportOptions): Promise<void> {
  let cashflowImg = options.cashflowImageDataUrl
  if (cashflowImg === undefined) {
    cashflowImg = await captureCashflowChartAsImage()
  }

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
  const fileName = `finly_rapport_budget_${cleanPeriod || "synthese"}.pdf`
  doc.save(fileName)
}

