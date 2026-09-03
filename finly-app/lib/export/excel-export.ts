import XLSX from "xlsx-js-style"
import { Transaction, Project, Account } from "@/lib/types/finance"
import { MOCK_ACCOUNTS, MOCK_TRANSACTIONS, MOCK_PROJECTS } from "@/lib/data/mock-finance"

export interface ExportSettings {
  format: "xlsx" | "csv"
  scope: "all" | "transactions" | "projects" | "summary"
  periodMode: "all" | "month" | "last_3_months" | "year"
  selectedMonth?: string // YYYY-MM
  selectedAccountId?: string // "all" or specific account ID
  transactionType?: "all" | "expense" | "income"
  includeFormulas?: boolean
  includeCategorySummary?: boolean
}

export function generateExportFileName(
  settings: Partial<ExportSettings> | string,
  formatOrAccount?: string,
  extraPeriodOrAccounts?: Account[] | string
): string {
  if (typeof settings === "string") {
    const scope = settings
    const format = typeof formatOrAccount === "string" ? formatOrAccount : "xlsx"
    const period = typeof extraPeriodOrAccounts === "string" && extraPeriodOrAccounts ? `_${extraPeriodOrAccounts}` : ""
    return `finly_${scope}${period}.${format}`
  }

  const s = settings as ExportSettings
  const format = s.format || (typeof formatOrAccount === "string" ? formatOrAccount : "xlsx")
  const parts: string[] = ["finly"]

  // 1. Type / Scope
  if (s.transactionType === "expense") {
    parts.push("depenses")
  } else if (s.transactionType === "income") {
    parts.push("revenus")
  } else if (s.scope === "projects") {
    parts.push("projets")
  } else if (s.scope === "summary") {
    parts.push("synthese")
  } else {
    parts.push("transactions")
  }

  // 2. Account name if specific account filtered
  if (s.selectedAccountId && s.selectedAccountId !== "all" && Array.isArray(extraPeriodOrAccounts)) {
    const acc = extraPeriodOrAccounts.find((a) => a.id === s.selectedAccountId)
    if (acc) {
      const cleanAcc = (acc.name || acc.bank)
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
      if (cleanAcc) parts.push(cleanAcc)
    }
  }

  // 3. Period
  if (s.periodMode === "month" && s.selectedMonth) {
    const [year, month] = s.selectedMonth.split("-")
    const monthNames = [
      "janvier", "fevrier", "mars", "avril", "mai", "juin",
      "juillet", "aout", "septembre", "octobre", "novembre", "decembre"
    ]
    const mIdx = parseInt(month, 10) - 1
    const mName = monthNames[mIdx] || month
    parts.push(`${mName}_${year}`)
  } else if (s.periodMode === "last_3_months") {
    parts.push("3_derniers_mois")
  } else if (s.periodMode === "year") {
    const yr = new Date().getFullYear().toString()
    parts.push(`annee_${yr}`)
  }

  return `${parts.join("_")}.${format}`
}

// Styling Helper Constants
const STYLES = {
  mainTitle: {
    font: { name: "Calibri", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4338CA" } }, // Indigo 700
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
  },
  subTitle: {
    font: { name: "Calibri", sz: 10, italic: true, color: { rgb: "475569" } },
    fill: { fgColor: { rgb: "F1F5F9" } },
    alignment: { horizontal: "left", vertical: "center", indent: 1 },
  },
  sectionHeader: {
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "1E1B4B" } }, // Dark Indigo
    alignment: { horizontal: "left", vertical: "center" },
  },
  tableHeader: {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
    fill: { fgColor: { rgb: "4F46E5" } }, // Indigo 600
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      bottom: { style: "medium", color: { rgb: "312E81" } },
    },
  },
  cellEven: {
    font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
    fill: { fgColor: { rgb: "FFFFFF" } },
    border: {
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "F1F5F9" } },
    },
    alignment: { vertical: "center" },
  },
  cellOdd: {
    font: { name: "Calibri", sz: 10, color: { rgb: "1E293B" } },
    fill: { fgColor: { rgb: "F8FAFC" } }, // Slate 50
    border: {
      bottom: { style: "thin", color: { rgb: "E2E8F0" } },
      right: { style: "thin", color: { rgb: "F1F5F9" } },
    },
    alignment: { vertical: "center" },
  },
  cellPositive: {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "059669" } }, // Emerald 600
    fill: { fgColor: { rgb: "ECFDF5" } }, // Emerald 50
    alignment: { horizontal: "right", vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "A7F3D0" } } },
    numFmt: "#,##0.00 €",
  },
  cellNegative: {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "DC2626" } }, // Red 600
    fill: { fgColor: { rgb: "FEF2F2" } }, // Red 50
    alignment: { horizontal: "right", vertical: "center" },
    border: { bottom: { style: "thin", color: { rgb: "FECACA" } } },
    numFmt: "#,##0.00 €",
  },
  kpiLabel: {
    font: { name: "Calibri", sz: 10, bold: true, color: { rgb: "475569" } },
    fill: { fgColor: { rgb: "F8FAFC" } },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      left: { style: "thin", color: { rgb: "CBD5E1" } },
    },
    alignment: { vertical: "center" },
  },
  kpiValue: {
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "1E293B" } },
    fill: { fgColor: { rgb: "FFFFFF" } },
    alignment: { horizontal: "right", vertical: "center" },
    border: {
      top: { style: "thin", color: { rgb: "CBD5E1" } },
      bottom: { style: "thin", color: { rgb: "CBD5E1" } },
      right: { style: "thin", color: { rgb: "CBD5E1" } },
    },
    numFmt: "#,##0.00 €",
  },
  totalRow: {
    font: { name: "Calibri", sz: 11, bold: true, color: { rgb: "1E1B4B" } },
    fill: { fgColor: { rgb: "EEF2FF" } }, // Indigo 50
    border: {
      top: { style: "thin", color: { rgb: "6366F1" } },
      bottom: { style: "double", color: { rgb: "4338CA" } },
    },
    alignment: { vertical: "center" },
  },
}

function setCell(
  ws: XLSX.WorkSheet,
  ref: string,
  val: any,
  style?: any,
  type: "s" | "n" | "b" | "d" = "s",
  formula?: string
) {
  const cell: any = { t: type, s: style }
  if (formula) {
    cell.f = formula
    if (val !== undefined) cell.v = val
  } else {
    cell.v = val
  }
  ws[ref] = cell
}

export function executeExport(
  settings: ExportSettings,
  customTransactions?: Transaction[],
  customProjects?: Project[],
  customAccounts?: Account[]
): void {
  const rawTransactions = customTransactions && customTransactions.length > 0 ? customTransactions : MOCK_TRANSACTIONS
  const projects = customProjects && customProjects.length > 0 ? customProjects : MOCK_PROJECTS
  const accounts = customAccounts && customAccounts.length > 0 ? customAccounts : MOCK_ACCOUNTS

  // 1. Filter Transactions based on Period Settings
  let filteredTransactions = [...rawTransactions]

  if (settings.periodMode === "month" && settings.selectedMonth) {
    filteredTransactions = filteredTransactions.filter((t) => {
      const txDate = (t.date || "").split("T")[0]
      return txDate.startsWith(settings.selectedMonth!)
    })
  } else if (settings.periodMode === "last_3_months") {
    const now = new Date()
    const past = new Date(now)
    past.setMonth(now.getMonth() - 3)
    const pastStr = past.toISOString().slice(0, 10)
    filteredTransactions = filteredTransactions.filter((t) => {
      const txDate = (t.date || "").split("T")[0]
      return txDate >= pastStr
    })
  } else if (settings.periodMode === "year") {
    const currentYear = new Date().getFullYear().toString()
    filteredTransactions = filteredTransactions.filter((t) => {
      const txDate = (t.date || "").split("T")[0]
      return txDate.startsWith(currentYear)
    })
  }

  // 2. Filter by Account
  if (settings.selectedAccountId && settings.selectedAccountId !== "all") {
    const matchedAccount = accounts.find((a) => a.id === settings.selectedAccountId)
    filteredTransactions = filteredTransactions.filter(
      (t) =>
        t.account_id === settings.selectedAccountId ||
        (matchedAccount && t.account === matchedAccount.name)
    )
  }

  // 3. Filter by Transaction Type (all, expense, income)
  if (settings.transactionType === "expense") {
    filteredTransactions = filteredTransactions.filter((t) => t.amount < 0)
  } else if (settings.transactionType === "income") {
    filteredTransactions = filteredTransactions.filter((t) => t.amount > 0)
  }

  // Sort descending by date
  filteredTransactions.sort((a, b) => (b.date || "").localeCompare(a.date || ""))

  // CSV Export Mode
  if (settings.format === "csv") {
    const txData = filteredTransactions.map((t) => ({
      Date: t.date,
      Heure: t.time || "-",
      Marchand: t.merchant,
      Categorie: t.category,
      Sous_Categorie: t.subcategory || "-",
      Compte: t.account,
      Montant_EUR: t.amount,
      Projet: t.project || "-",
      Libelle_Brut: t.rawLabel || (t as any).raw_label || "",
    }))
    const ws = XLSX.utils.json_to_sheet(txData)
    const csvOutput = XLSX.utils.sheet_to_csv(ws)
    const blob = new Blob([csvOutput], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    link.href = URL.createObjectURL(blob)
    link.download = generateExportFileName(settings, "csv", accounts)
    link.click()
    return
  }

  // Excel (.xlsx) Workbook creation with Full Styling
  const wb = XLSX.utils.book_new()

  // Calculate totals
  const totalDepenses = filteredTransactions
    .filter((t) => t.amount < 0)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)
  const totalRevenus = filteredTransactions
    .filter((t) => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0)
  const soldeNet = totalRevenus - totalDepenses
  const totalPatrimoine = accounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0)

  const periodLabel =
    settings.periodMode === "month" && settings.selectedMonth
      ? `Mois sélectionné : ${settings.selectedMonth}`
      : settings.periodMode === "last_3_months"
      ? "Période : 3 Derniers Mois"
      : settings.periodMode === "year"
      ? `Période : Année ${new Date().getFullYear()}`
      : "Période : Historique Global"

  // ----------------------------------------------------
  // SHEET 1: SYNTHESE
  // ----------------------------------------------------
  if (settings.scope === "all" || settings.scope === "summary") {
    const ws: XLSX.WorkSheet = {}

    // Title Banner
    setCell(ws, "A1", "FINLY — RAPPORT FINANCIER CONSOLIDÉ", STYLES.mainTitle)
    setCell(ws, "B1", "", STYLES.mainTitle)
    setCell(ws, "C1", "", STYLES.mainTitle)
    setCell(ws, "D1", "", STYLES.mainTitle)

    setCell(ws, "A2", `Généré le ${new Date().toLocaleString("fr-FR")} | ${periodLabel}`, STYLES.subTitle)
    setCell(ws, "B2", "", STYLES.subTitle)
    setCell(ws, "C2", "", STYLES.subTitle)
    setCell(ws, "D2", "", STYLES.subTitle)

    // Section 1: Indicateurs Cles
    setCell(ws, "A4", "INDICATEURS CLÉS DE LA PÉRIODE", STYLES.sectionHeader)
    setCell(ws, "B4", "", STYLES.sectionHeader)

    setCell(ws, "A5", "Total des Revenus", STYLES.kpiLabel)
    setCell(ws, "B5", totalRevenus, { ...STYLES.kpiValue, font: { ...STYLES.kpiValue.font, color: { rgb: "059669" } } }, "n")

    setCell(ws, "A6", "Total des Dépenses", STYLES.kpiLabel)
    setCell(ws, "B6", -totalDepenses, { ...STYLES.kpiValue, font: { ...STYLES.kpiValue.font, color: { rgb: "DC2626" } } }, "n")

    setCell(ws, "A7", "Solde Net de la Période", STYLES.kpiLabel)
    setCell(ws, "B7", soldeNet, { ...STYLES.kpiValue, font: { ...STYLES.kpiValue.font, color: soldeNet >= 0 ? { rgb: "059669" } : { rgb: "DC2626" } } }, "n")

    setCell(ws, "A8", "Patrimoine Total Consolidé", STYLES.kpiLabel)
    setCell(ws, "B8", totalPatrimoine, { ...STYLES.kpiValue, font: { ...STYLES.kpiValue.font, color: { rgb: "4338CA" } } }, "n")

    setCell(ws, "A9", "Nombre d'Opérations", STYLES.kpiLabel)
    setCell(ws, "B9", filteredTransactions.length, { ...STYLES.kpiValue, numFmt: "0" }, "n")

    // Section 2: Soldes par Compte
    setCell(ws, "A11", "SOLDES ACTUELS PAR ÉTABLISSEMENT BANCAIRE", STYLES.sectionHeader)
    setCell(ws, "B11", "", STYLES.sectionHeader)
    setCell(ws, "C11", "", STYLES.sectionHeader)
    setCell(ws, "D11", "", STYLES.sectionHeader)

    setCell(ws, "A12", "Nom du Compte", STYLES.tableHeader)
    setCell(ws, "B12", "Banque", STYLES.tableHeader)
    setCell(ws, "C12", "Type", STYLES.tableHeader)
    setCell(ws, "D12", "Solde (EUR)", STYLES.tableHeader)

    accounts.forEach((acc, idx) => {
      const row = 13 + idx
      const isEven = idx % 2 === 0
      const style = isEven ? STYLES.cellEven : STYLES.cellOdd
      setCell(ws, `A${row}`, acc.name, style)
      setCell(ws, `B${row}`, acc.bank, style)
      setCell(ws, `C${row}`, acc.type, style)
      setCell(ws, `D${row}`, Number(acc.balance) || 0, { ...style, alignment: { horizontal: "right" }, font: { bold: true }, numFmt: "#,##0.00 €" }, "n")
    })

    const totalAccRow = 13 + accounts.length
    setCell(ws, `A${totalAccRow}`, "TOTAL CONSOLIDÉ", STYLES.totalRow)
    setCell(ws, `B${totalAccRow}`, "", STYLES.totalRow)
    setCell(ws, `C${totalAccRow}`, "", STYLES.totalRow)
    setCell(
      ws,
      `D${totalAccRow}`,
      totalPatrimoine,
      { ...STYLES.totalRow, alignment: { horizontal: "right" }, numFmt: "#,##0.00 €" },
      "n",
      accounts.length > 0 ? `SUM(D13:D${totalAccRow - 1})` : undefined
    )

    ws["!ref"] = `A1:D${totalAccRow}`
    ws["!cols"] = [{ wch: 32 }, { wch: 22 }, { wch: 18 }, { wch: 20 }]
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 10, c: 0 }, e: { r: 10, c: 3 } },
    ]

    XLSX.utils.book_append_sheet(wb, ws, "Synthese")
  }

  // ----------------------------------------------------
  // SHEET 2: TRANSACTIONS
  // ----------------------------------------------------
  if (settings.scope === "all" || settings.scope === "transactions" || settings.scope === "summary") {
    const wsTx: XLSX.WorkSheet = {}

    const headers = [
      "ID",
      "Date",
      "Heure",
      "Marchand / Destinataire",
      "Catégorie",
      "Sous-Catégorie",
      "Compte Bancaire",
      "Montant (EUR)",
      "Projet Associé",
      "Libellé Brut Bancaire",
    ]

    // Title banner
    setCell(wsTx, "A1", `FINLY — DÉTAIL DES OPÉRATIONS (${periodLabel})`, STYLES.mainTitle)
    for (let c = 1; c < headers.length; c++) {
      const colLetter = XLSX.utils.encode_col(c)
      setCell(wsTx, `${colLetter}1`, "", STYLES.mainTitle)
    }

    // Table Headers
    headers.forEach((h, idx) => {
      const colLetter = XLSX.utils.encode_col(idx)
      setCell(wsTx, `${colLetter}3`, h, STYLES.tableHeader)
    })

    // Rows
    filteredTransactions.forEach((t, idx) => {
      const r = 4 + idx
      const isEven = idx % 2 === 0
      const baseStyle = isEven ? STYLES.cellEven : STYLES.cellOdd
      const isPos = t.amount > 0

      setCell(wsTx, `A${r}`, t.id, baseStyle)
      setCell(wsTx, `B${r}`, t.date, { ...baseStyle, alignment: { horizontal: "center" } })
      setCell(wsTx, `C${r}`, t.time || "-", { ...baseStyle, alignment: { horizontal: "center" } })
      setCell(wsTx, `D${r}`, t.merchant, { ...baseStyle, font: { bold: true } })
      setCell(wsTx, `E${r}`, t.category, baseStyle)
      setCell(wsTx, `F${r}`, t.subcategory || "-", baseStyle)
      setCell(wsTx, `G${r}`, t.account, baseStyle)
      setCell(
        wsTx,
        `H${r}`,
        t.amount,
        isPos ? STYLES.cellPositive : STYLES.cellNegative,
        "n"
      )
      setCell(wsTx, `I${r}`, t.project || "-", baseStyle)
      setCell(wsTx, `J${r}`, t.rawLabel || (t as any).raw_label || "", { ...baseStyle, font: { italic: true, color: { rgb: "64748B" } } })
    })

    const endRow = 4 + filteredTransactions.length
    if (settings.includeFormulas && filteredTransactions.length > 0) {
      setCell(wsTx, `A${endRow}`, "TOTAL", STYLES.totalRow)
      for (let c = 1; c <= 6; c++) {
        setCell(wsTx, `${XLSX.utils.encode_col(c)}${endRow}`, "", STYLES.totalRow)
      }
      setCell(
        wsTx,
        `H${endRow}`,
        soldeNet,
        { ...STYLES.totalRow, alignment: { horizontal: "right" }, numFmt: "#,##0.00 €" },
        "n",
        `SUM(H4:H${endRow - 1})`
      )
      setCell(wsTx, `I${endRow}`, "", STYLES.totalRow)
      setCell(wsTx, `J${endRow}`, "", STYLES.totalRow)
    }

    wsTx["!ref"] = `A1:J${endRow}`
    wsTx["!cols"] = [
      { wch: 10 },
      { wch: 13 },
      { wch: 10 },
      { wch: 28 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 16 },
      { wch: 18 },
      { wch: 38 },
    ]
    wsTx["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
    ]

    XLSX.utils.book_append_sheet(wb, wsTx, "Transactions")
  }

  // ----------------------------------------------------
  // SHEET 3: PAR CATEGORIE
  // ----------------------------------------------------
  if (settings.includeCategorySummary !== false) {
    const wsCat: XLSX.WorkSheet = {}

    const catMap: Record<string, { spent: number; count: number }> = {}
    filteredTransactions
      .filter((t) => t.amount < 0)
      .forEach((t) => {
        const cat = t.category || "Autres"
        if (!catMap[cat]) catMap[cat] = { spent: 0, count: 0 }
        catMap[cat].spent += Math.abs(t.amount)
        catMap[cat].count += 1
      })

    const catEntries = Object.entries(catMap).sort((a, b) => b[1].spent - a[1].spent)

    setCell(wsCat, "A1", "FINLY — RÉPARTITION DES DÉPENSES PAR CATÉGORIE", STYLES.mainTitle)
    setCell(wsCat, "B1", "", STYLES.mainTitle)
    setCell(wsCat, "C1", "", STYLES.mainTitle)
    setCell(wsCat, "D1", "", STYLES.mainTitle)

    setCell(wsCat, "A3", "Catégorie", STYLES.tableHeader)
    setCell(wsCat, "B3", "Total Dépensé (EUR)", STYLES.tableHeader)
    setCell(wsCat, "C3", "Nombre d'Opérations", STYLES.tableHeader)
    setCell(wsCat, "D3", "Part du Budget (%)", STYLES.tableHeader)

    catEntries.forEach(([cat, info], idx) => {
      const r = 4 + idx
      const isEven = idx % 2 === 0
      const style = isEven ? STYLES.cellEven : STYLES.cellOdd
      const pct = totalDepenses > 0 ? info.spent / totalDepenses : 0

      setCell(wsCat, `A${r}`, cat, { ...style, font: { bold: true } })
      setCell(wsCat, `B${r}`, info.spent, { ...style, alignment: { horizontal: "right" }, font: { bold: true, color: { rgb: "DC2626" } }, numFmt: "#,##0.00 €" }, "n")
      setCell(wsCat, `C${r}`, info.count, { ...style, alignment: { horizontal: "center" } }, "n")
      setCell(wsCat, `D${r}`, pct, { ...style, alignment: { horizontal: "right" }, numFmt: "0.0%" }, "n")
    })

    const endCatRow = 4 + catEntries.length
    const totalExpensesCount = filteredTransactions.filter((t) => t.amount < 0).length

    setCell(wsCat, `A${endCatRow}`, "TOTAL DES DÉPENSES", STYLES.totalRow)
    setCell(
      wsCat,
      `B${endCatRow}`,
      totalDepenses,
      { ...STYLES.totalRow, alignment: { horizontal: "right" }, numFmt: "#,##0.00 €" },
      "n",
      catEntries.length > 0 ? `SUM(B4:B${endCatRow - 1})` : undefined
    )
    setCell(
      wsCat,
      `C${endCatRow}`,
      totalExpensesCount,
      { ...STYLES.totalRow, alignment: { horizontal: "center" } },
      "n",
      catEntries.length > 0 ? `SUM(C4:C${endCatRow - 1})` : undefined
    )
    setCell(
      wsCat,
      `D${endCatRow}`,
      1,
      { ...STYLES.totalRow, alignment: { horizontal: "right" }, numFmt: "0.0%" },
      "n"
    )

    wsCat["!ref"] = `A1:D${endCatRow}`
    wsCat["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 22 }, { wch: 20 }]
    wsCat["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 3 } }]

    XLSX.utils.book_append_sheet(wb, wsCat, "Par_Categorie")
  }

  // ----------------------------------------------------
  // SHEET 4: PROJETS & BUDGETS
  // ----------------------------------------------------
  if (settings.scope === "all" || settings.scope === "projects" || settings.scope === "summary") {
    const wsProj: XLSX.WorkSheet = {}

    const projHeaders = [
      "ID",
      "Nom du Projet",
      "Description",
      "Catégorie",
      "Budget Cible (EUR)",
      "Montant Consommé (EUR)",
      "Reste Disponible (EUR)",
      "Progression (%)",
      "Date d'Échéance",
      "Statut",
    ]

    setCell(wsProj, "A1", "FINLY — SUIVI DES PROJETS & CAGNOTTES D'ÉPARGNE", STYLES.mainTitle)
    for (let c = 1; c < projHeaders.length; c++) {
      setCell(wsProj, `${XLSX.utils.encode_col(c)}1`, "", STYLES.mainTitle)
    }

    projHeaders.forEach((h, idx) => {
      setCell(wsProj, `${XLSX.utils.encode_col(idx)}3`, h, STYLES.tableHeader)
    })

    projects.forEach((p, idx) => {
      const r = 4 + idx
      const isEven = idx % 2 === 0
      const style = isEven ? STYLES.cellEven : STYLES.cellOdd
      const remaining = p.targetAmount - p.currentAmount
      const pct = p.targetAmount > 0 ? p.currentAmount / p.targetAmount : 0
      const statusLabel = p.status === "completed" ? "Terminé" : p.status === "near" ? "Presque atteint" : "En cours"

      setCell(wsProj, `A${r}`, p.id, style)
      setCell(wsProj, `B${r}`, p.name, { ...style, font: { bold: true } })
      setCell(wsProj, `C${r}`, p.description, style)
      setCell(wsProj, `D${r}`, p.category, style)
      setCell(wsProj, `E${r}`, p.targetAmount, { ...style, alignment: { horizontal: "right" }, numFmt: "#,##0.00 €" }, "n")
      setCell(wsProj, `F${r}`, p.currentAmount, { ...style, alignment: { horizontal: "right" }, font: { bold: true, color: { rgb: "059669" } }, numFmt: "#,##0.00 €" }, "n")
      setCell(wsProj, `G${r}`, remaining, { ...style, alignment: { horizontal: "right" }, numFmt: "#,##0.00 €" }, "n")
      setCell(wsProj, `H${r}`, pct, { ...style, alignment: { horizontal: "right" }, font: { bold: true }, numFmt: "0.0%" }, "n")
      setCell(wsProj, `I${r}`, p.deadline, { ...style, alignment: { horizontal: "center" } })
      setCell(wsProj, `J${r}`, statusLabel, { ...style, alignment: { horizontal: "center" } })
    })

    const endProjRow = 4 + projects.length
    wsProj["!ref"] = `A1:J${endProjRow}`
    wsProj["!cols"] = [
      { wch: 10 },
      { wch: 24 },
      { wch: 30 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 20 },
      { wch: 16 },
      { wch: 16 },
      { wch: 16 },
    ]
    wsProj["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: projHeaders.length - 1 } }]

    XLSX.utils.book_append_sheet(wb, wsProj, "Projets_Budgets")
  }

  // Trigger download of cleanly styled .xlsx file
  const fileName = generateExportFileName(settings, "xlsx", accounts)
  XLSX.writeFile(wb, fileName)
}
