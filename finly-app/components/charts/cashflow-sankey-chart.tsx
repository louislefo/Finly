"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ResponsiveSankey } from "@nivo/sankey"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
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

// Light & Dark color mappings for individual categories
const CATEGORY_STYLE_MAP: Record<string, { light: string; dark: string }> = {
  "Logement": { light: "#94a3b8", dark: "#94a3b8" },
  "Abonnements": { light: "#cbd5e1", dark: "#a1a1aa" },
  "Alimentation": { light: "#fb923c", dark: "#f97316" },
  "Transports": { light: "#fdba74", dark: "#fb923c" },
  "Loisirs & Sorties": { light: "#c084fc", dark: "#c084fc" },
  "Shopping": { light: "#c084fc", dark: "#c084fc" },
  "Santé & Bien-être": { light: "#38bdf8", dark: "#38bdf8" },
  "Impôts & Taxes": { light: "#94a3b8", dark: "#94a3b8" },
  "Assurances": { light: "#94a3b8", dark: "#94a3b8" },
  "Divers": { light: "#fed7aa", dark: "#eab308" },
  "Épargne & Investissements": { light: "#4ade80", dark: "#34d399" },
  "Virements & Épargne": { light: "#4ade80", dark: "#34d399" },
  "Épargne": { light: "#4ade80", dark: "#34d399" },
}

export function CashflowSankeyChart({
  budgetSummary,
  selectedMonth,
  periodMode,
  formatMonthName,
}: CashflowSankeyChartProps) {
  const { formatAmount } = usePrivacy()
  const { t, language, format } = useI18n()
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

    // 1. Inflow Classification & Ordering
    // All incomes flow directly into the Central Hub without intermediary crossing pillars
    const allInflows: { id: string; label: string; amount: number; color: string }[] = []

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
          cleanLabel = t.cashflow.salaryTransfer
        } else if (nameUpper.includes("WERO")) {
          cleanLabel = t.cashflow.weroTransfer
        } else if (nameUpper.includes("INSTANTANE")) {
          cleanLabel = t.cashflow.receivedTransfer
        }

        const nodeColor = isPassiveOrRefund
          ? (isLight ? "#f97316" : "#fb923c")
          : (isLight ? "#3b82f6" : "#38bdf8")

        allInflows.push({
          id: `inc_src_${inc.category.replace(/\s+/g, "_")}`,
          label: cleanLabel,
          amount: inc.amount,
          color: nodeColor,
        })
      }
    } else {
      const fallbackAmount = Math.max(totalSpent, budgetSummary.total_budget || 1000)
      allInflows.push({
        id: "inc_src_default",
        label: t.cashflow.estimatedIncome,
        amount: fallbackAmount,
        color: isLight ? "#3b82f6" : "#38bdf8",
      })
    }

    // Sort inflows by amount descending for consistent top-to-bottom layout
    allInflows.sort((a, b) => b.amount - a.amount)

    // Stage 1: Central Hub
    const HUB_ID = "hub_central"
    const hubColor = isLight ? "#6366f1" : "#818cf8"
    const hubLabel = totalIncome > 0 ? t.cashflow.totalIncome : t.cashflow.monthlyInflows
    addNode(HUB_ID, hubLabel, hubColor, "hub")

    // Stage 2: Direct Inflow Sources -> Central Hub (zero link crossing)
    for (const inc of allInflows) {
      addNode(inc.id, inc.label, inc.color, "source", inc.amount)
      addLink(inc.id, HUB_ID, inc.amount)
    }

    // Deficit Inflow (placed cleanly in source layer if budget is in deficit)
    const hasDeficit = totalSpent + totalSavingsTxs > totalIncome && totalIncome > 0
    const deficitAmount = hasDeficit ? (totalSpent + totalSavingsTxs) - totalIncome : 0
    const deficitId = "inflow_deficit"
    const deficitColor = isLight ? "#dc2626" : "#f87171"
    if (hasDeficit) {
      addNode(deficitId, t.cashflow.savingsDraw, deficitColor, "source", deficitAmount)
      addLink(deficitId, HUB_ID, deficitAmount)
    }

    // 2. Outflow Structure: Direct Hub -> Categories & Savings (eliminates all intermediate pillar crossings)
    const activeCategories = rawCategories
      .filter((c) => c.spent > 0)
      .sort((a, b) => b.spent - a.spent)

    // Stage 3: Add Category Nodes in strict sequence
    for (const catItem of activeCategories) {
      const catNodeId = `cat_${catItem.category.replace(/\s+/g, "_")}`
      const style = CATEGORY_STYLE_MAP[catItem.category] || { light: "#64748b", dark: "#94a3b8" }
      const catColor = isLight ? style.light : style.dark
      const catDisplay = t.categories[catItem.category] || catItem.category
      addNode(catNodeId, catDisplay, catColor, "category", catItem.spent)
      addLink(HUB_ID, catNodeId, catItem.spent)
    }

    // Savings Transfers (if any)
    if (totalSavingsTxs > 0) {
      const savStyle = isLight ? "#16a34a" : "#34d399"
      const savTxCatId = "cat_epargne_virements"
      addNode(savTxCatId, t.categories["Virements Épargne"] || "Virements Épargne", savStyle, "category", totalSavingsTxs)
      addLink(HUB_ID, savTxCatId, totalSavingsTxs)
    }

    // Remaining Cashflow / Surplus (if any)
    if (netCashflow > 0) {
      const surplusColor = isLight ? "#0284c7" : "#38bdf8"
      const savSurplusCatId = "cat_epargne_reste"
      addNode(savSurplusCatId, t.categories["Reste Disponible"] || "Reste Disponible", surplusColor, "category", netCashflow)
      addLink(HUB_ID, savSurplusCatId, netCashflow)
    }

    // Stage 4: Subcategory Nodes (in detailed mode, branching cleanly from each category)
    if (detailLevel === "detailed") {
      for (const catItem of activeCategories) {
        const catNodeId = `cat_${catItem.category.replace(/\s+/g, "_")}`
        const style = CATEGORY_STYLE_MAP[catItem.category] || { light: "#64748b", dark: "#94a3b8" }
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
            const subDisplay = t.categories[cleanSub] || cleanSub
            addNode(subNodeId, subDisplay, catColor, "sub", subAmt)
            addLink(catNodeId, subNodeId, subAmt)
          }

          if (remainder > 0) {
            const otherNodeId = `sub_${catItem.category.replace(/\s+/g, "_")}_Autres`
            addNode(otherNodeId, t.categories["Autres"] || "Autres", catColor, "sub", remainder)
            addLink(catNodeId, otherNodeId, remainder)
          }
        }
      }

      if (totalSavingsTxs > 0) {
        const savStyle = isLight ? "#16a34a" : "#34d399"
        const savSubId = "sub_epargne_livrets"
        addNode(savSubId, t.categories["Livrets & Épargne"] || "Livrets & Épargne", savStyle, "sub", totalSavingsTxs)
        addLink("cat_epargne_virements", savSubId, totalSavingsTxs)
      }

      if (netCashflow > 0) {
        const surplusColor = isLight ? "#0284c7" : "#38bdf8"
        const surplusSubId = "sub_reste_tresorerie"
        addNode(surplusSubId, t.categories["Épargne / Trésorerie"] || "Épargne / Trésorerie", surplusColor, "sub", netCashflow)
        addLink("cat_epargne_reste", surplusSubId, netCashflow)
      }
    }

    return {
      nodes: nodesList,
      links: linksList,
    }
  }, [budgetSummary, totalIncome, totalSpent, totalSavingsTxs, netCashflow, detailLevel, isLight, t])

  if (!isMounted) {
    return (
      <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl flex items-center justify-center min-h-[350px]">
        <span className="text-xs text-zinc-500">{t.cashflow.loadingChart}</span>
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
            <span>{t.cashflow.title}</span>
            <Badge
              variant="outline"
              className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] font-normal"
            >
              {periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth)}
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
            title={isLight ? t.cashflow.switchDarkCanvas : t.cashflow.switchLightCanvas}
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
              <option value="detailed" className="bg-zinc-900 text-white">{t.cashflow.detailedView}</option>
              <option value="standard" className="bg-zinc-900 text-white">{t.cashflow.summaryView}</option>
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
              <span className="text-[10px] text-zinc-400">{t.cashflow.totalInflow}</span>
              <span className="text-xs font-bold font-mono text-emerald-400">
                +{formatAmount(totalIncome)}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {budgetSummary?.incomes?.length || 0} {t.cashflow.sourcesCount}
          </span>
        </div>

        <div className="p-3 sm:p-3.5 rounded-2xl border flex items-center justify-between bg-zinc-950/60 border-white/5">
          <div className="flex items-center gap-2 sm:gap-2.5">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl border flex items-center justify-center bg-rose-500/10 border-rose-500/20 text-rose-400 shrink-0">
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-400">{t.cashflow.totalSpent}</span>
              <span className="text-xs font-bold font-mono text-white">
                -{formatAmount(totalSpent)}
              </span>
            </div>
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {budgetSummary?.items?.filter((i) => i.spent > 0).length || 0} {t.cashflow.categoriesCount}
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
                {isSurplus ? t.cashflow.netRemainingSavings : t.cashflow.monthlyDeficit}
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
            {isSurplus ? format(t.cashflow.savedRate, { rate: savingsRate }) : t.cashflow.overspent}
          </Badge>
        </div>
      </div>

      {/* Sankey Chart Responsive Touch Container */}
      {!hasData || totalSpent + totalIncome === 0 ? (
        <div className="h-48 w-full flex flex-col items-center justify-center text-xs p-6 text-center rounded-2xl border bg-zinc-950/40 border-white/5 text-zinc-500">
          <span className="font-semibold text-zinc-400">
            {t.cashflow.noData}
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
              align="start"
              sort="auto"
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
                    <span className={isLight ? "text-zinc-500" : "text-zinc-400"}>{t.cashflow.totalAmount}</span>
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
                    <span className={isLight ? "text-zinc-500" : "text-zinc-400"}>{t.cashflow.transferredFlow}</span>
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
