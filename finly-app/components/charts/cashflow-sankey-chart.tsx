"use client"

import React, { useState, useEffect, useMemo } from "react"
import { ResponsiveSankey } from "@nivo/sankey"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import { Card } from "@/components/ui/card"
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

// Dark color mappings for categories
const CATEGORY_STYLE_MAP: Record<string, string> = {
  "Logement": "#94a3b8",
  "Abonnements": "#a1a1aa",
  "Alimentation": "#f97316",
  "Transports": "#fb923c",
  "Loisirs & Sorties": "#c084fc",
  "Shopping": "#c084fc",
  "Santé & Bien-être": "#38bdf8",
  "Impôts & Taxes": "#94a3b8",
  "Assurances": "#94a3b8",
  "Divers": "#eab308",
  "Épargne & Investissements": "#34d399",
  "Virements & Épargne": "#34d399",
  "Épargne": "#34d399",
}

export function CashflowSankeyChart({
  budgetSummary,
  selectedMonth,
  periodMode,
  formatMonthName,
}: CashflowSankeyChartProps) {
  const { formatAmount } = usePrivacy()
  const { t } = useI18n()
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [detailLevel, setDetailLevel] = useState<"standard" | "detailed">("detailed")

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Raw totals
  const totalIncome = budgetSummary?.total_income || 0
  const totalSpent = budgetSummary?.total_spent || 0
  const totalSavingsTxs = budgetSummary?.total_savings_transfers || 0
  const netCashflow = totalIncome - totalSpent - totalSavingsTxs
  const isSurplus = netCashflow >= 0

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

        const nodeColor = isPassiveOrRefund ? "#fb923c" : "#38bdf8"

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
        color: "#38bdf8",
      })
    }

    // Sort inflows by amount descending for consistent top-to-bottom layout
    allInflows.sort((a, b) => b.amount - a.amount)

    // Stage 1: Central Hub
    const HUB_ID = "hub_central"
    const hubColor = "#818cf8"
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
    const deficitColor = "#f87171"
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
      const catColor = CATEGORY_STYLE_MAP[catItem.category] || "#94a3b8"
      const catDisplay = t.categories[catItem.category] || catItem.category
      addNode(catNodeId, catDisplay, catColor, "category", catItem.spent)
      addLink(HUB_ID, catNodeId, catItem.spent)
    }

    // Savings Transfers (if any)
    if (totalSavingsTxs > 0) {
      const savStyle = "#34d399"
      const savTxCatId = "cat_epargne_virements"
      addNode(savTxCatId, t.categories["Virements Épargne"] || "Virements Épargne", savStyle, "category", totalSavingsTxs)
      addLink(HUB_ID, savTxCatId, totalSavingsTxs)
    }

    // Remaining Cashflow / Surplus (if any)
    if (netCashflow > 0) {
      const surplusColor = "#38bdf8"
      const savSurplusCatId = "cat_epargne_reste"
      addNode(savSurplusCatId, t.categories["Reste Disponible"] || "Reste Disponible", surplusColor, "category", netCashflow)
      addLink(HUB_ID, savSurplusCatId, netCashflow)
    }

    // Stage 4: Subcategory Nodes (in detailed mode, branching cleanly from each category)
    if (detailLevel === "detailed") {
      for (const catItem of activeCategories) {
        const catNodeId = `cat_${catItem.category.replace(/\s+/g, "_")}`
        const catColor = CATEGORY_STYLE_MAP[catItem.category] || "#94a3b8"

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
        const savStyle = "#34d399"
        const savSubId = "sub_epargne_livrets"
        addNode(savSubId, t.categories["Livrets & Épargne"] || "Livrets & Épargne", savStyle, "sub", totalSavingsTxs)
        addLink("cat_epargne_virements", savSubId, totalSavingsTxs)
      }

      if (netCashflow > 0) {
        const surplusColor = "#38bdf8"
        const surplusSubId = "sub_reste_tresorerie"
        addNode(surplusSubId, t.categories["Épargne / Trésorerie"] || "Épargne / Trésorerie", surplusColor, "sub", netCashflow)
        addLink("cat_epargne_reste", surplusSubId, netCashflow)
      }
    }

    return {
      nodes: nodesList,
      links: linksList,
    }
  }, [budgetSummary, totalIncome, totalSpent, totalSavingsTxs, netCashflow, detailLevel, t])

  if (!isMounted) {
    return (
      <Card className="p-6 border-white/10 bg-[#18181B] rounded-2xl flex items-center justify-center min-h-[350px]">
        <span className="text-xs text-zinc-500">{t.cashflow.loadingChart}</span>
      </Card>
    )
  }

  const hasData = sankeyData.nodes.length > 0 && sankeyData.links.length > 0

  return (
    <Card className="p-4 sm:p-5 md:p-6 rounded-2xl flex flex-col gap-4 w-full overflow-hidden bg-[#18181B] text-white border-white/10">
      {/* Minimalist Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/5">
        <div>
          <h3 className="text-sm font-semibold text-white tracking-tight">
            {t.cashflow.title}
          </h3>
          <span className="text-[11px] text-zinc-500">
            {periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth)}
          </span>
        </div>

        {/* Minimalist Controls & Inline Summary */}
        <div className="flex flex-wrap items-center gap-3 sm:gap-4 self-stretch sm:self-auto justify-between sm:justify-end">
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-[11px]">{t.cashflow.totalInflow}</span>
              <span className="text-emerald-400 font-medium">+{formatAmount(totalIncome)}</span>
            </div>
            <span className="text-zinc-700">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-[11px]">{t.cashflow.totalSpent}</span>
              <span className="text-zinc-200 font-medium">-{formatAmount(totalSpent)}</span>
            </div>
            <span className="text-zinc-700">•</span>
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-500 text-[11px]">
                {isSurplus ? t.cashflow.netRemainingSavings : t.cashflow.monthlyDeficit}
              </span>
              <span className={`font-medium ${isSurplus ? "text-indigo-400" : "text-amber-400"}`}>
                {isSurplus ? "+" : ""}{formatAmount(netCashflow + totalSavingsTxs)}
              </span>
            </div>
          </div>

          {/* Minimalist Dropdown Selector */}
          <select
            value={detailLevel}
            onChange={(e) => setDetailLevel(e.target.value as "standard" | "detailed")}
            className="h-7 px-2.5 bg-zinc-900 border border-white/10 text-[11px] text-zinc-300 hover:text-white rounded-lg outline-none cursor-pointer appearance-none transition-colors font-medium"
          >
            <option value="detailed" className="bg-zinc-900 text-white">{t.cashflow.detailedView}</option>
            <option value="standard" className="bg-zinc-900 text-white">{t.cashflow.summaryView}</option>
          </select>
        </div>
      </div>

      {/* Sankey Chart Responsive Touch Container */}
      {!hasData || totalSpent + totalIncome === 0 ? (
        <div className="h-48 w-full flex items-center justify-center text-xs text-zinc-500">
          <span>{t.cashflow.noData}</span>
        </div>
      ) : (
        <div className="w-full relative overflow-x-auto overflow-y-hidden">
          <div
            id="finly-cashflow-sankey-container"
            className="min-w-[700px] sm:min-w-[800px] lg:min-w-full h-[460px] sm:h-[520px] md:h-[580px] p-2 sm:p-4"
          >
            <ResponsiveSankey
              data={sankeyData}
              margin={{ top: 20, right: 165, bottom: 20, left: 165 }}
              align="start"
              sort="auto"
              colors={(node: any) => node.nodeColor || "#38bdf8"}
              nodeOpacity={1}
              nodeHoverOthersOpacity={0.25}
              nodeThickness={14}
              nodeSpacing={16}
              nodeBorderWidth={0}
              nodeBorderRadius={4}
              linkBlendMode="normal"
              linkOpacity={0.5}
              linkHoverOpacity={0.85}
              linkContract={0}
              enableLinkGradient={true}
              labelPosition="outside"
              labelOrientation="horizontal"
              labelPadding={8}
              label={(node: any) => node.label || node.id}
              labelTextColor="#f4f4f5"
              theme={{
                text: {
                  fontSize: 11,
                  fontWeight: 600,
                  fill: "#f4f4f5",
                  fontFamily: "inherit",
                },
                tooltip: {
                  container: {
                    background: "#18181b",
                    color: "#ffffff",
                    fontSize: 12,
                    borderRadius: 12,
                    boxShadow: "0 10px 30px rgba(0,0,0,0.7)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    padding: "10px 14px",
                  },
                },
              }}
              nodeTooltip={({ node }: any) => (
                <div className="flex flex-col gap-1 min-w-[130px]">
                  <span className="font-bold text-xs text-white">
                    {node.label}
                  </span>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5 text-zinc-300">
                    <span className="text-zinc-400">{t.cashflow.totalAmount}</span>
                    <span className="font-mono font-bold text-indigo-300">
                      {formatAmount(Number(node.value || 0))}
                    </span>
                  </div>
                </div>
              )}
              linkTooltip={({ link }: any) => (
                <div className="flex flex-col gap-1 min-w-[150px]">
                  <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className="font-medium">{link.source.label}</span>
                    <span>→</span>
                    <span className="font-semibold text-zinc-200">
                      {link.target.label}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs pt-1 border-t border-white/5 text-zinc-300">
                    <span className="text-zinc-400">{t.cashflow.transferredFlow}</span>
                    <span className="font-mono font-bold text-white">
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
