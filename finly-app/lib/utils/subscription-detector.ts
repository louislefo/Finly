import { Transaction } from "@/lib/types/finance"

export type SubscriptionCycle = "monthly" | "yearly" | "weekly" | "bimonthly" | "custom"
export type SubscriptionStatus = "active" | "cancelled" | "due_soon"

export interface DetectedSubscription {
  id: string
  name: string
  merchant: string
  category: string
  cycle: SubscriptionCycle
  status: SubscriptionStatus
  occurrencesCount: number
  amounts: number[]
  averageAmount: number
  latestAmount: number
  monthlyCost: number
  annualCost: number
  lastDate: string
  firstDate: string
  nextEstimatedDate: string
  priceIncreased: boolean
  previousAmount?: number
  priceDifference?: number
  isFixedAmount: boolean
}

export interface SubscriptionsSummary {
  activeSubscriptions: DetectedSubscription[]
  cancelledSubscriptions: DetectedSubscription[]
  totalMonthlyCost: number
  totalAnnualCost: number
  activeCount: number
  cancelledCount: number
  monthlySavingsFromCancelled: number
  priceIncreasesCount: number
  categoryBreakdown: {
    category: string
    monthlyCost: number
    percentage: number
    count: number
  }[]
}

/**
 * Normalise un nom de marchand pour regrouper les libelles similaires
 */
export function normalizeMerchantName(raw: string): string {
  if (!raw) return "Inconnu"
  return raw
    .trim()
    .toLowerCase()
    .replace(/[0-9*#_\-./]/g, " ")
    .replace(/\b(cb|prlv|sepa|facture|virement|sa|sas|sarl|ab|fr|eu|com|ltd|gmbh|pay)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Calcule la difference en jours entre deux dates ISO (YYYY-MM-DD)
 */
function diffDays(d1: string, d2: string): number {
  const t1 = new Date(d1).getTime()
  const t2 = new Date(d2).getTime()
  return Math.abs(Math.round((t1 - t2) / (1000 * 60 * 60 * 24)))
}

/**
 * Calcule la mediane d'un tableau de nombres
 */
function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

/**
 * Detecte et classe les abonnements et charges fixes recurrentes (>= 3 occurrences)
 */
export function detectSubscriptions(
  transactions: Transaction[],
  nowDate: Date = new Date()
): SubscriptionsSummary {
  // 1. Filtrer uniquement les debits (depenses)
  const expenseTx = transactions.filter((t) => (t.amount || 0) < 0)

  // 2. Regrouper par marchand normalise
  const groupedByMerchant: Record<
    string,
    {
      canonicalName: string
      category: string
      txList: Transaction[]
    }
  > = {}

  expenseTx.forEach((tx) => {
    const raw = tx.merchant || tx.rawLabel || tx.raw_label || "Abonnement"
    const cleanKey = normalizeMerchantName(raw)
    if (!cleanKey || cleanKey.length < 2) return

    if (!groupedByMerchant[cleanKey]) {
      // Capitaliser proprement le nom
      const displayName = raw.trim().replace(/\s+/g, " ")
      const capitalized = displayName.charAt(0).toUpperCase() + displayName.slice(1)
      groupedByMerchant[cleanKey] = {
        canonicalName: capitalized.slice(0, 28),
        category: tx.category || "Abonnements",
        txList: [],
      }
    }
    groupedByMerchant[cleanKey].txList.push(tx)
  })

  const activeSubscriptions: DetectedSubscription[] = []
  const cancelledSubscriptions: DetectedSubscription[] = []

  const nowTime = nowDate.getTime()

  // 3. Analyser la recurrence pour chaque groupe
  Object.entries(groupedByMerchant).forEach(([key, group]) => {
    // Condition stricte : au moins 3 occurrences pour etre qualifie d'abonnement / charge recurrente
    if (group.txList.length < 3) return

    // Trier chronologiquement
    const sortedTx = [...group.txList].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    )

    // Verifier la distribution temporelle : au moins 3 mois distincts ou au moins 50 jours d'ecart
    const distinctMonths = new Set(sortedTx.map((t) => t.date.slice(0, 7)))
    const firstDate = sortedTx[0].date
    const lastDate = sortedTx[sortedTx.length - 1].date
    const totalDaysSpan = diffDays(lastDate, firstDate)

    if (distinctMonths.size < 3 && totalDaysSpan < 50) {
      return
    }

    // Calculer les intervalles entre paiements successifs
    const intervals: number[] = []
    for (let i = 1; i < sortedTx.length; i++) {
      const days = diffDays(sortedTx[i].date, sortedTx[i - 1].date)
      intervals.push(days)
    }

    const medInterval = median(intervals)

    // Identifier le cycle
    let cycle: SubscriptionCycle = "monthly"
    if (medInterval >= 25 && medInterval <= 35) {
      cycle = "monthly"
    } else if (medInterval >= 340 && medInterval <= 385) {
      cycle = "yearly"
    } else if (medInterval >= 6 && medInterval <= 8) {
      cycle = "weekly"
    } else if (medInterval >= 12 && medInterval <= 16) {
      cycle = "bimonthly"
    } else if (medInterval >= 20 && medInterval <= 45) {
      cycle = "monthly"
    } else {
      cycle = "custom"
    }

    // Montants
    const absAmounts = sortedTx.map((t) => Math.abs(t.amount))
    const totalSpent = absAmounts.reduce((sum, v) => sum + v, 0)
    const averageAmount = totalSpent / absAmounts.length
    const latestAmount = absAmounts[absAmounts.length - 1]
    const previousAmount = absAmounts.length >= 2 ? absAmounts[absAmounts.length - 2] : latestAmount

    // Calcul du cout mensuel normalise
    let monthlyCost = latestAmount
    if (cycle === "yearly") {
      monthlyCost = latestAmount / 12
    } else if (cycle === "weekly") {
      monthlyCost = latestAmount * 4.333
    } else if (cycle === "bimonthly") {
      monthlyCost = latestAmount * 2.166
    }

    const annualCost = monthlyCost * 12

    // Variance des montants (fixe vs variable)
    const amountVariance = Math.max(...absAmounts) - Math.min(...absAmounts)
    const isFixedAmount = amountVariance <= 0.05 * averageAmount

    // Hausse tarifaire recente
    const priceIncreased = latestAmount > previousAmount * 1.02 && previousAmount > 0
    const priceDifference = priceIncreased ? latestAmount - previousAmount : 0

    // Statut : Actif vs Resilie / Dormant
    const daysSinceLast = Math.round((nowTime - new Date(lastDate).getTime()) / (1000 * 60 * 60 * 24))

    let status: SubscriptionStatus = "active"
    if (cycle === "monthly") {
      if (daysSinceLast <= 36) {
        status = "active"
      } else if (daysSinceLast <= 50) {
        status = "due_soon"
      } else {
        status = "cancelled"
      }
    } else if (cycle === "yearly") {
      if (daysSinceLast <= 380) {
        status = "active"
      } else {
        status = "cancelled"
      }
    } else {
      if (daysSinceLast <= medInterval * 1.5) {
        status = "active"
      } else {
        status = "cancelled"
      }
    }

    // Estimation de la prochaine date de prelevement
    const lastDateObj = new Date(lastDate)
    const nextDateObj = new Date(lastDateObj)
    if (cycle === "monthly") {
      nextDateObj.setMonth(nextDateObj.getMonth() + 1)
    } else if (cycle === "yearly") {
      nextDateObj.setFullYear(nextDateObj.getFullYear() + 1)
    } else if (cycle === "weekly") {
      nextDateObj.setDate(nextDateObj.getDate() + 7)
    } else {
      nextDateObj.setDate(nextDateObj.getDate() + Math.round(medInterval))
    }

    const nextEstimatedDate = nextDateObj.toISOString().slice(0, 10)

    const subItem: DetectedSubscription = {
      id: `sub_${key}`,
      name: group.canonicalName,
      merchant: group.canonicalName,
      category: group.category,
      cycle,
      status,
      occurrencesCount: sortedTx.length,
      amounts: absAmounts,
      averageAmount,
      latestAmount,
      monthlyCost,
      annualCost,
      lastDate,
      firstDate,
      nextEstimatedDate,
      priceIncreased,
      previousAmount: priceIncreased ? previousAmount : undefined,
      priceDifference: priceIncreased ? priceDifference : undefined,
      isFixedAmount,
    }

    if (status === "cancelled") {
      cancelledSubscriptions.push(subItem)
    } else {
      activeSubscriptions.push(subItem)
    }
  })

  // Trier les abonnements actifs par cout mensuel decroissant
  activeSubscriptions.sort((a, b) => b.monthlyCost - a.monthlyCost)
  cancelledSubscriptions.sort((a, b) => b.monthlyCost - a.monthlyCost)

  const totalMonthlyCost = activeSubscriptions.reduce((sum, s) => sum + s.monthlyCost, 0)
  const totalAnnualCost = totalMonthlyCost * 12
  const monthlySavingsFromCancelled = cancelledSubscriptions.reduce((sum, s) => sum + s.monthlyCost, 0)
  const priceIncreasesCount = activeSubscriptions.filter((s) => s.priceIncreased).length

  // Repartition par categorie
  const categoryMap: Record<string, { monthlyCost: number; count: number }> = {}
  activeSubscriptions.forEach((s) => {
    const cat = s.category || "Abonnements"
    if (!categoryMap[cat]) {
      categoryMap[cat] = { monthlyCost: 0, count: 0 }
    }
    categoryMap[cat].monthlyCost += s.monthlyCost
    categoryMap[cat].count += 1
  })

  const categoryBreakdown = Object.entries(categoryMap)
    .map(([category, data]) => ({
      category,
      monthlyCost: data.monthlyCost,
      percentage: totalMonthlyCost > 0 ? Math.round((data.monthlyCost / totalMonthlyCost) * 100) : 0,
      count: data.count,
    }))
    .sort((a, b) => b.monthlyCost - a.monthlyCost)

  return {
    activeSubscriptions,
    cancelledSubscriptions,
    totalMonthlyCost,
    totalAnnualCost,
    activeCount: activeSubscriptions.length,
    cancelledCount: cancelledSubscriptions.length,
    monthlySavingsFromCancelled,
    priceIncreasesCount,
    categoryBreakdown,
  }
}
