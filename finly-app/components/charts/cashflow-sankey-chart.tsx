"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ResponsiveSankey } from "@nivo/sankey"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronDown,
  GitFork,
  Moon,
  Sun,
  Wallet,
} from "lucide-react"
import { BudgetSummary } from "@/lib/types/finance"

interface CashflowSankeyChartProps {
  budgetSummary: BudgetSummary | null
  selectedMonth: string
  periodMode: "month" | "last_30_days"
  formatMonthName: (monthKey: string) => string
}

interface SankeyNode {
  id: string
  label: string
  nodeColor: string
  amount?: number
  stage?: "source" | "inflow_pillar" | "hub" | "outflow_pillar" | "category" | "sub"
  order?: number
}

interface SankeyLink {
  source: string
  target: string
  value: number
}

// Category to Outflow Pillar mapping
const CATEGORY_PILLAR_MAP: Record<string, { pillarId: string; pillarLabel: string; lightColor: string; darkColor: string }> = {
  "Logement": { pillarId: "outpil_fixed", pillarLabel: "Dépenses Fixes", lightColor: "#64748b", darkColor: "#94a3b8" },
  "Abonnements": { pillarId: "outpil_fixed", pillarLabel: "Dépenses Fixes", lightColor: "#64748b", darkColor: "#94a3b8" },
  "Impôts & Taxes": { pillarId: "outpil_fixed", pillarLabel: "Dépenses Fixes", lightColor: "#64748b", darkColor: "#94a3b8" },
  "Assurances": { pillarId: "outpil_fixed", pillarLabel: "Dépenses Fixes", lightColor: "#64748b", darkColor: "#94a3b8" },
  "Alimentation": { pillarId: "outpil_living", pillarLabel: "Dépenses Courantes", lightColor: "#ea580c", darkColor: "#f59e0b" },
  "Transports": { pillarId: "outpil_living", pillarLabel: "Dépenses Courantes", lightColor: "#ea580c", darkColor: "#fb923c" },
  "Santé & Bien-être": { pillarId: "outpil_living", pillarLabel: "Dépenses Courantes", lightColor: "#0284c7", darkColor: "#38bdf8" },
  "Divers": { pillarId: "outpil_living", pillarLabel: "Dépenses Courantes", lightColor: "#ea580c", darkColor: "#fbbf24" },
  "Loisirs & Sorties": { pillarId: "outpil_discretionary", pillarLabel: "Loisirs & Plaisir", lightColor: "#9333ea", darkColor: "#c084fc" },
  "Shopping": { pillarId: "outpil_discretionary", pillarLabel: "Loisirs & Plaisir", lightColor: "#9333ea", darkColor: "#c084fc" },
  "Voyages & Vacances": { pillarId: "outpil_discretionary", pillarLabel: "Loisirs & Plaisir", lightColor: "#9333ea", darkColor: "#c084fc" },
  "Épargne & Investissements": { pillarId: "outpil_savings", pillarLabel: "Épargne & Avenir", lightColor: "#16a34a", darkColor: "#34d399" },
  "Virements & Épargne": { pillarId: "outpil_savings", pillarLabel: "Épargne & Avenir", lightColor: "#16a34a", darkColor: "#34d399" },
  "Épargne": { pillarId: "outpil_savings", pillarLabel: "Épargne & Avenir", lightColor: "#16a34a", darkColor: "#34d399" },
}

// Light & Dark color mappings for individual categories
const CATEGORY_STYLE_MAP: Record<string, { light: string; dark: string }> = {
  "Logement": { light: "#94a3b8", dark: "#94a3b8" },
  "Abonnements": { light: "#cbd5e1", dark: "#a1a1aa" },
  "Alimentation": { light: "#fb923c", dark: "#f97316" },
  "Transports": { light: "#fdba74", dark: "#fb923c" },
  "Loisirs & Sorties": { light: "#c084fc", dark: "#c084fc" },
  "Santé & Bien-être": { light: "#38bdf8", dark: "#38bdf8" },
  "Divers": { light: "#fed7aa", dark: "#eab308" },
  "Épargne & Investissements": { light: "#4ade80", dark: "#34d399" },
  "Virements & Épargne": { light: "#4ade80", dark: "#34d399" },
  "Épargne": { light: "#4ade80", dark: "#34d399" },
}

const ORDERED_OUTFLOW_PILLARS = [
  "outpil_fixed",
  "outpil_living",
  "outpil_discretionary",
  "outpil_savings",
] as const

export function CashflowSankeyChart({
  budgetSummary,
  selectedMonth,
  periodMode,
  formatMonthName,
}: CashflowSankeyChartProps) {
  const { formatAmount } = usePrivacy()
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [chartTheme, setChartTheme] = useState<"dark" | "light">("dark")
  const [detailLevel, setDetailLevel] = useState<"standard" | "detailed">("detailed")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const isLight = chartTheme === "light"

  // Raw totals
  const totalIncome = budgetSummary?.total_income || 0
  const totalSpent = budgetSummary?.total_spent || 0
  const totalSavingsTxs = budgetSummary?.total_savings_transfers || 0
  const netCashflow = totalIncome - totalSpent - totalSavingsTxs
  const isSurplus = netCashflow >= 0
  const savingsRate = totalIncome > 0 ? Math.round(((Math.max(0, netCashflow) + totalSavingsTxs) / totalIncome) * 100) : 0

  // Multi-tier Non-crossing DAG Data construction
  const sankeyData = useMemo<{ nodes: SankeyNode[]; links: SankeyLink[] }>(() => {
    if (!budgetSummary) return { nodes: [], links: [] }

    const nodesList: SankeyNode[] = []
    const addedNodeIds = new Set<string>()
    const linksList: SankeyLink[] = []

    const addNode = (id: string, label: string, color: string, stage?: SankeyNode["stage"], amount?: number) => {
      if (!addedNodeIds.has(id)) {
        addedNodeIds.add(id)
        nodesList.push({
          id,
          label,
          nodeColor: color,
          stage,
          amount,
          order: nodesList.length,
        })
      }
    }

    const addLink = (source: string, target: string, value: number) => {
      if (value <= 0.001 || source === target) return
      const roundedVal = Math.round(value * 100) / 100
      const existing = linksList.find((l) => l.source === source && l.target === target)
      if (existing) {
        existing.value = Math.round((existing.value + roundedVal) * 100) / 100
      } else {
        linksList.push({ source, target, value: roundedVal })
      }
    }

    const incomes = budgetSummary.incomes || []
    const rawCategories = (budgetSummary.items || []).filter((i) => i.spent > 0)

    // 1. Inflow Classification
    const earnedInflows: { id: string; label: string; amount: number }[] = []
    const passiveInflows: { id: string; label: string; amount: number }[] = []

    if (incomes.length > 0) {
      for (const inc of incomes) {
        if (inc.amount <= 0) continue
        const nameUpper = (inc.category || "").toUpperCase()
        const isPassiveOrRefund = (
          nameUpper.includes("WERO") ||
          nameUpper.includes("INSTANTANE") ||
          nameUpper.includes("REMBOURSEMENT") ||
          nameUpper.includes("DIVIDENDE") ||
          nameUpper.includes("INTERET")
        )

        let cleanLabel = inc.category
          .replace(/^(VIR\.PERMANENT|VIR INST|VIR SEPA|VIREMENT|CB)\s*/i, "")
          .replace(/^(M |MME )/i, "")
          .trim() || inc.category

        if (nameUpper.includes("VIR.PERMANENT") || nameUpper.includes("SALAIRE")) {
          cleanLabel = "Salaire & Virement"
        } else if (nameUpper.includes("WERO")) {
          cleanLabel = "Virement Wero"
        } else if (nameUpper.includes("INSTANTANE")) {
          cleanLabel = "Virement Reçu"
        }

        if (isPassiveOrRefund) {
          passiveInflows.push({
            id: `inc_src_${inc.category.replace(/\s+/g, "_")}`,
            label: cleanLabel,
            amount: inc.amount,
          })
        } else {
          earnedInflows.push({
            id: `inc_src_${inc.category.replace(/\s+/g, "_")}`,
            label: cleanLabel,
            amount: inc.amount,
          })
        }
      }
    } else {
      const fallbackAmount = Math.max(totalSpent, budgetSummary.total_budget || 1000)
      earnedInflows.push({
        id: "inc_src_default",
        label: "Revenus Estimés",
        amount: fallbackAmount,
      })
    }

    earnedInflows.sort((a, b) => b.amount - a.amount)
    passiveInflows.sort((a, b) => b.amount - a.amount)

    // Stage 1: Inflow Sources
    const earnedSrcColor = isLight ? "#60a5fa" : "#38bdf8"
    const passiveSrcColor = isLight ? "#fb923c" : "#fb923c"

    for (const inc of earnedInflows) {
      addNode(inc.id, inc.label, earnedSrcColor, "source", inc.amount)
    }
    for (const inc of passiveInflows) {
      addNode(inc.id, inc.label, passiveSrcColor, "source", inc.amount)
    }

    // Stage 2: Inflow Pillars
    const earnedPillarId = "inpil_earned"
    const earnedPillarColor = isLight ? "#3b82f6" : "#38bdf8"
    const passivePillarId = "inpil_passive"
    const passivePillarColor = isLight ? "#f97316" : "#fb923c"

    if (earnedInflows.length > 0) {
      addNode(earnedPillarId, "Revenus d'Activité", earnedPillarColor, "inflow_pillar")
      for (const inc of earnedInflows) {
        addLink(inc.id, earnedPillarId, inc.amount)
      }
    }
    if (passiveInflows.length > 0) {
      addNode(passivePillarId, "Remboursements & Passifs", passivePillarColor, "inflow_pillar")
      for (const inc of passiveInflows) {
        addLink(inc.id, passivePillarId, inc.amount)
      }
    }

    // Deficit Inflow
    const hasDeficit = totalSpent + totalSavingsTxs > totalIncome && totalIncome > 0
    const deficitAmount = hasDeficit ? (totalSpent + totalSavingsTxs) - totalIncome : 0
    const deficitId = "inflow_deficit"
    const deficitColor = isLight ? "#dc2626" : "#f87171"
    if (hasDeficit) {
      addNode(deficitId, "Prélèvement Épargne", deficitColor, "source", deficitAmount)
    }

    // Stage 3: Hub
    const HUB_ID = "hub_central"
    const hubColor = isLight ? "#6366f1" : "#818cf8"
    const hubLabel = totalIncome > 0 ? "Total Revenus" : "Ressources Mensuelles"
    addNode(HUB_ID, hubLabel, hubColor, "hub")

    if (earnedInflows.length > 0) {
      const earnedSum = earnedInflows.reduce((sum, i) => sum + i.amount, 0)
      addLink(earnedPillarId, HUB_ID, earnedSum)
    }
    if (passiveInflows.length > 0) {
      const passiveSum = passiveInflows.reduce((sum, i) => sum + i.amount, 0)
      addLink(passivePillarId, HUB_ID, passiveSum)
    }
    if (hasDeficit) {
      addLink(deficitId, HUB_ID, deficitAmount)
    }

    // Stage 4: Group categories strictly by pillar
    const pillarCategoriesMap: Record<string, typeof rawCategories> = {
      outpil_fixed: [],
      outpil_living: [],
      outpil_discretionary: [],
      outpil_savings: [],
    }

    for (const catItem of rawCategories) {
      const mapping = CATEGORY_PILLAR_MAP[catItem.category] || {
        pillarId: "outpil_living",
        pillarLabel: "Dépenses Courantes",
        lightColor: "#ea580c",
        darkColor: "#f59e0b",
      }
      pillarCategoriesMap[mapping.pillarId].push(catItem)
    }

    for (const pId of ORDERED_OUTFLOW_PILLARS) {
      pillarCategoriesMap[pId].sort((a, b) => b.spent - a.spent)
    }

    const pillarTotals: Record<string, { label: string; color: string; amount: number }> = {}
    const pillarMeta: Record<string, { label: string; lightColor: string; darkColor: string }> = {
      outpil_fixed: { label: "Dépenses Fixes", lightColor: "#64748b", darkColor: "#94a3b8" },
      outpil_living: { label: "Dépenses Courantes", lightColor: "#ea580c", darkColor: "#f59e0b" },
      outpil_discretionary: { label: "Loisirs & Plaisir", lightColor: "#9333ea", darkColor: "#c084fc" },
      outpil_savings: { label: "Épargne & Avenir", lightColor: "#16a34a", darkColor: "#34d399" },
    }

    for (const pId of ORDERED_OUTFLOW_PILLARS) {
      const sumSpent = pillarCategoriesMap[pId].reduce((s, c) => s + c.spent, 0)
      if (pId === "outpil_savings") {
        const effectiveSavings = totalSavingsTxs + Math.max(0, netCashflow)
        if (effectiveSavings > 0) {
          pillarTotals[pId] = {
            label: pillarMeta[pId].label,
            color: isLight ? pillarMeta[pId].lightColor : pillarMeta[pId].darkColor,
            amount: effectiveSavings,
          }
        }
      } else if (sumSpent > 0) {
        pillarTotals[pId] = {
          label: pillarMeta[pId].label,
          color: isLight ? pillarMeta[pId].lightColor : pillarMeta[pId].darkColor,
          amount: sumSpent,
        }
      }
    }

    // Add Pillar Nodes
    for (const pId of ORDERED_OUTFLOW_PILLARS) {
      const pData = pillarTotals[pId]
      if (pData) {
        addNode(pId, pData.label, pData.color, "outflow_pillar", pData.amount)
        addLink(HUB_ID, pId, pData.amount)
      }
    }

    // Stage 5: Add Category Nodes in strict sequence
    for (const pId of ORDERED_OUTFLOW_PILLARS) {
      if (pId === "outpil_savings") {
        const savStyle = isLight ? "#22c55e" : "#34d399"
        if (totalSavingsTxs > 0) {
          const savTxCatId = "cat_epargne_virements"
          addNode(savTxCatId, "Virements Épargne", savStyle, "category", totalSavingsTxs)
          addLink(pId, savTxCatId, totalSavingsTxs)
        }
        if (netCashflow > 0) {
          const savSurplusCatId = "cat_epargne_reste"
          const surplusColor = isLight ? "#0284c7" : "#38bdf8"
          addNode(savSurplusCatId, "Reste Disponible", surplusColor, "category", netCashflow)
          addLink(pId, savSurplusCatId, netCashflow)
        }
      } else {
        const catsInPillar = pillarCategoriesMap[pId]
        for (const catItem of catsInPillar) {
          const catNodeId = `cat_${catItem.category.replace(/\s+/g, "_")}`
          const style = CATEGORY_STYLE_MAP[catItem.category] || { light: "#94a3b8", dark: "#94a3b8" }
          const catColor = isLight ? style.light : style.dark
          addNode(catNodeId, catItem.category, catColor, "category", catItem.spent)
          addLink(pId, catNodeId, catItem.spent)
        }
      }
    }

    // Stage 6: Subcategory Nodes in strict sequence
    if (detailLevel === "detailed") {
      for (const pId of ORDERED_OUTFLOW_PILLARS) {
        if (pId === "outpil_savings") {
          const savStyle = isLight ? "#22c55e" : "#34d399"
          if (totalSavingsTxs > 0) {
            const savSubId = "sub_epargne_livrets"
            addNode(savSubId, "Livrets & Épargne", savStyle, "sub", totalSavingsTxs)
            addLink("cat_epargne_virements", savSubId, totalSavingsTxs)
          }
          if (netCashflow > 0) {
            const surplusColor = isLight ? "#0284c7" : "#38bdf8"
            const surplusSubId = "sub_reste_tresorerie"
            addNode(surplusSubId, "Épargne / Trésorerie", surplusColor, "sub", netCashflow)
            addLink("cat_epargne_reste", surplusSubId, netCashflow)
          }
        } else {
          const catsInPillar = pillarCategoriesMap[pId]
          for (const catItem of catsInPillar) {
            const catNodeId = `cat_${catItem.category.replace(/\s+/g, "_")}`
            const style = CATEGORY_STYLE_MAP[catItem.category] || { light: "#94a3b8", dark: "#94a3b8" }
            const catColor = isLight ? style.light : style.dark

            if (catItem.transactions && catItem.transactions.length > 0) {
              const subMap = new Map<string, number>()
              let unclassified = 0

              for (const tx of catItem.transactions) {
                if (tx.is_excluded_from_budget) continue
                const amt = Math.abs(tx.amount)
                const subLabel = tx.subcategory?.trim() || tx.merchant?.trim()
                if (subLabel) {
                  subMap.set(subLabel, (subMap.get(subLabel) || 0) + amt)
                } else {
                  unclassified += amt
                }
              }

              const sortedSubs = Array.from(subMap.entries()).sort((a, b) => b[1] - a[1])
              const topSubs = sortedSubs.slice(0, 4)
              const remainder = sortedSubs.slice(4).reduce((sum, s) => sum + s[1], 0) + unclassified

              for (const [subName, subAmt] of topSubs) {
                if (subAmt <= 0) continue
                const cleanSub = subName.replace(/^(CB|PRLV SEPA|VIR)\s*/i, "").trim()
                const subNodeId = `sub_${catItem.category.replace(/\s+/g, "_")}_${cleanSub.replace(/\s+/g, "_")}`
                addNode(subNodeId, cleanSub, catColor, "sub", subAmt)
                addLink(catNodeId, subNodeId, subAmt)
              }

              if (remainder > 0) {
                const otherNodeId = `sub_${catItem.category.replace(/\s+/g, "_")}_Autres`
                addNode(otherNodeId, "Autres", catColor, "sub", remainder)
                addLink(catNodeId, otherNodeId, remainder)
              }
            }
          }
        }
      }
    }

    return {
      nodes: nodesList,
      links: linksList,
    }
  }, [budgetSummary, totalIncome, totalSpent, totalSavingsTxs, netCashflow, detailLevel, isLight])

  if (!isMounted) {
    return (
      <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl flex items-center justify-center min-h-[350px]">
        <span className="text-xs text-zinc-500">Chargement du diagramme...</span>
      </Card>
    )
  }

  const hasData = sankeyData.nodes.length > 0 && sankeyData.links.length > 0

  return (
    <Card className="p-4 sm:p-5 md:p-6 rounded-3xl flex flex-col gap-4 sm:gap-5 w-full overflow-hidden bg-[#18181B] text-white border-white/10">
      {/* Header with Discrete Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/5">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="p-2 rounded-xl border bg-zinc-900 border-white/10 text-indigo-400 shrink-0">
            <GitFork className="w-4 h-4 rotate-90" />
          </div>
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-white flex-wrap">
            <span>Flux Financier (Cashflow)</span>
            <Badge
              variant="outline"
              className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-normal"
            >
              {periodMode === "last_30_days" ? "30 derniers jours" : formatMonthName(selectedMonth)}
            </Badge>
          </CardTitle>
        </div>

        {/* Minimalist Controls */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
          {/* Direct Sun / Moon Toggle */}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setChartTheme(isLight ? "dark" : "light")}
            className={`h-8 w-8 p-0 rounded-xl border transition-all cursor-pointer shrink-0 ${
              isLight
                ? "bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-amber-500 shadow-xs"
                : "bg-zinc-900 hover:bg-zinc-800 border-white/10 text-indigo-400"
            }`}
            title={isLight ? "Passer en canevas sombre" : "Passer en canevas clair"}
          >
            {isLight ? (
              <Sun className="w-4 h-4 text-amber-500" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </Button>

          {/* Minimalist Dropdown Selector */}
          <div className="relative">
            <select
              value={detailLevel}
              onChange={(e) => setDetailLevel(e.target.value as "standard" | "detailed")}
              className="h-8 pl-3 pr-7 bg-zinc-900 hover:bg-zinc-800/80 border border-white/10 text-xs text-zinc-300 hover:text-white rounded-xl outline-none cursor-pointer appearance-none transition-colors font-medium"
            >
              <option value="detailed" className="bg-zinc-900 text-white">Vue détaillée</option>
              <option value="standard" className="bg-zinc-900 text-white">Vue synthétique</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* KPI Stats Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3">
        <div className="p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between bg-zinc-950/60 border-white/5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shrink-0">
              <ArrowDownRight className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400">Total Entrées</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                +{formatAmount(totalIncome)}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {budgetSummary?.incomes?.length || 0} source(s)
          </span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between bg-zinc-950/60 border-white/5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center bg-rose-500/10 border-rose-500/20 text-rose-400 shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400">Total Dépensé</span>
              <span className="text-xs font-bold font-mono text-white">
                -{formatAmount(totalSpent)}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {budgetSummary?.items?.filter((i) => i.spent > 0).length || 0} poste(s)
          </span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between bg-zinc-950/60 border-white/5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div
              className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                isSurplus
                  ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400"
                  : "bg-amber-500/10 border-amber-500/20 text-amber-400"
              }`}
            >
              <Wallet className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400">
                {isSurplus ? "Épargne & Reste Net" : "Déficit Mensuel"}
              </span>
              <span
                className={`text-xs font-bold font-mono ${
                  isSurplus ? "text-indigo-300" : "text-amber-400"
                }`}
              >
                {isSurplus ? "+" : ""}{formatAmount(netCashflow + totalSavingsTxs)}
              </span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={`text-[10px] py-0 px-2 font-mono ${
              isSurplus
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            {isSurplus ? `${savingsRate}% épargné` : "Dépassement"}
          </Badge>
        </div>
      </div>

      {/* Sankey Chart Responsive Touch Container */}
      {!hasData || totalSpent + totalIncome === 0 ? (
        <div className="h-48 w-full flex flex-col items-center justify-center text-xs p-6 text-center rounded-2xl border bg-zinc-950/40 border-white/5 text-zinc-500">
          <span className="font-semibold text-zinc-400">
            Aucun flux financier enregistré sur cette période
          </span>
        </div>
      ) : (
        <div
          className={`w-full relative rounded-2xl border transition-colors duration-300 overflow-x-auto overflow-y-hidden ${
            isLight
              ? "bg-[#FFFFFF] border-white/20 shadow-2xl"
              : "bg-zinc-950/90 border-white/5"
          }`}
        >
          <div
            id="finly-cashflow-sankey-container"
            className="min-w-[700px] sm:min-w-[800px] lg:min-w-full h-[460px] sm:h-[520px] md:h-[580px] p-2 sm:p-4"
          >
            <ResponsiveSankey
              data={sankeyData}
              margin={{ top: 20, right: 165, bottom: 20, left: 165 }}
              align="justify"
              sort="input"
              colors={(node: any) => node.nodeColor || (isLight ? "#3b82f6" : "#38bdf8")}
              nodeOpacity={1}
              nodeHoverOthersOpacity={0.25}
              nodeThickness={15}
              nodeSpacing={16}
              nodeBorderWidth={0}
              nodeBorderRadius={4}
              linkBlendMode="normal"
              linkOpacity={isLight ? 0.38 : 0.55}
              linkHoverOpacity={isLight ? 0.75 : 0.85}
              linkContract={0}
              enableLinkGradient={true}
              labelPosition="outside"
              labelOrientation="horizontal"
              labelPadding={8}
              label={(node: any) => node.label || node.id}
              labelTextColor={isLight ? "#0f172a" : "#f4f4f5"}
              theme={{
                text: {
                  fontSize: 11,
                  fontWeight: 600,
                  fill: isLight ? "#0f172a" : "#f4f4f5",
                  fontFamily: "inherit",
                },
                tooltip: {
                  container: {
                    background: isLight ? "#ffffff" : "#18181b",
                    color: isLight ? "#0f172a" : "#ffffff",
                    fontSize: 12,
                    borderRadius: 14,
                    boxShadow: isLight
                      ? "0 10px 25px rgba(0,0,0,0.1), 0 4px 6px rgba(0,0,0,0.05)"
                      : "0 10px 30px rgba(0,0,0,0.7)",
                    border: isLight ? "1px solid #e2e8f0" : "1px solid rgba(255,255,255,0.1)",
                    padding: "10px 14px",
                  },
                },
              }}
              nodeTooltip={({ node }: any) => (
                <div className="flex flex-col gap-1 min-w-[130px]">
                  <span className={`font-bold text-xs ${isLight ? "text-zinc-900" : "text-white"}`}>
                    {node.label}
                  </span>
                  <div
                    className={`flex justify-between items-center text-xs pt-1 border-t ${
                      isLight ? "border-zinc-100 text-zinc-600" : "border-white/5 text-zinc-300"
                    }`}
                  >
                    <span className={isLight ? "text-zinc-500" : "text-zinc-400"}>Montant total</span>
                    <span
                      className={`font-mono font-bold ${
                        isLight ? "text-indigo-600" : "text-indigo-300"
                      }`}
                    >
                      {formatAmount(Number(node.value || 0))}
                    </span>
                  </div>
                </div>
              )}
              linkTooltip={({ link }: any) => (
                <div className="flex flex-col gap-1 min-w-[150px]">
                  <div
                    className={`flex items-center gap-1.5 text-[11px] ${
                      isLight ? "text-zinc-500" : "text-zinc-400"
                    }`}
                  >
                    <span className="font-medium">{link.source.label}</span>
                    <span>→</span>
                    <span className={`font-semibold ${isLight ? "text-zinc-900" : "text-zinc-200"}`}>
                      {link.target.label}
                    </span>
                  </div>
                  <div
                    className={`flex justify-between items-center text-xs pt-1 border-t ${
                      isLight ? "border-zinc-100 text-zinc-600" : "border-white/5 text-zinc-300"
                    }`}
                  >
                    <span className={isLight ? "text-zinc-500" : "text-zinc-400"}>Flux transféré</span>
                    <span
                      className={`font-mono font-bold ${
                        isLight ? "text-zinc-900" : "text-white"
                      }`}
                    >
                      {formatAmount(Number(link.value || 0))}
                    </span>
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      )}
    </Card>
  )
}
