"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import { HelpCircle, AlertTriangle, CheckCircle2 } from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account, Transaction, BudgetSummary } from "@/lib/types/finance"
import { detectSubscriptions } from "@/lib/utils/subscription-detector"
import { cn } from "@/lib/utils"

const CATEGORY_CHART_COLORS = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EC4899",
  "#06B6D4",
  "#8B5CF6",
  "#F43F5E",
  "#64748B",
]

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-help p-0.5"
          aria-label="Information"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-zinc-900 text-zinc-200 border border-white/10 text-xs max-w-xs p-2.5 rounded-xl shadow-2xl backdrop-blur-md"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export function AnalysisView() {
  const { formatAmount } = usePrivacy()
  const { t, language } = useI18n()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // FIRE & Compound interest simulation parameters
  const [initialCapital, setInitialCapital] = useState<number>(15000)
  const [monthlyContribution, setMonthlyContribution] = useState<number>(400)
  const [annualRate, setAnnualRate] = useState<number>(7.5)
  const [durationYears, setDurationYears] = useState<number>(15)

  // Active Subscriptions Tab state
  const [subsTab, setSubsTab] = useState<"active" | "cancelled" | "breakdown">("active")

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [accRes, txRes, budgetRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getTransactions(),
        FinlyAPI.getBudgets().catch(() => null),
      ])
      setAccounts(accRes.accounts || [])
      setTransactions(txRes.transactions || [])
      setBudgetSummary(budgetRes)
    } catch (err) {
      console.error("Failed to load analysis data:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Total balance across all accounts
  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  }, [accounts])

  // Checking vs Liquid savings balance
  const liquiditiesBalance = useMemo(() => {
    return accounts
      .filter((a) => {
        const type = (a.type || "").toLowerCase()
        return (
          type.includes("courant") ||
          type.includes("checking") ||
          type.includes("saving") ||
          type.includes("livret") ||
          type.includes("epargne") ||
          type.includes("dépôt")
        )
      })
      .reduce((sum, acc) => sum + Math.max(0, acc.balance || 0), 0)
  }, [accounts])

  // -------------------------------------------------------------
  // 1. Subscription & Recurring Charges Detection (>= 3 occurrences)
  // -------------------------------------------------------------
  const subscriptionsSummary = useMemo(() => {
    return detectSubscriptions(transactions)
  }, [transactions])

  // -------------------------------------------------------------
  // 2. 50 / 30 / 20 Structural Diagnostic & Runway
  // -------------------------------------------------------------
  const rule503020Analysis = useMemo(() => {
    const expenseTx = transactions.filter((t) => (t.amount || 0) < 0)
    const incomeTx = transactions.filter((t) => (t.amount || 0) > 0)

    const totalExpense = expenseTx.reduce((sum, t) => sum + Math.abs(t.amount), 0)
    const totalIncome = incomeTx.reduce((sum, t) => sum + t.amount, 0)

    let needsSpent = 0
    let wantsSpent = 0

    expenseTx.forEach((tx) => {
      const cat = (tx.category || "").toLowerCase()
      const amt = Math.abs(tx.amount)
      if (
        cat.includes("logement") ||
        cat.includes("alimentation") ||
        cat.includes("transport") ||
        cat.includes("santé") ||
        cat.includes("assurance") ||
        cat.includes("électricité") ||
        cat.includes("facture") ||
        cat.includes("abonnements")
      ) {
        needsSpent += amt
      } else {
        wantsSpent += amt
      }
    })

    const effectiveIncome = Math.max(totalIncome, totalExpense || 1)
    const netSavings = Math.max(0, totalIncome - totalExpense)

    const needsPct = Math.round((needsSpent / effectiveIncome) * 100)
    const wantsPct = Math.round((wantsSpent / effectiveIncome) * 100)
    const savingsPct = Math.max(0, 100 - needsPct - wantsPct)

    const monthlyAverageExpense =
      totalExpense > 0
        ? totalExpense / Math.max(1, new Set(expenseTx.map((t) => t.date.slice(0, 7))).size)
        : 1
    const runwayMonths =
      monthlyAverageExpense > 0 ? liquiditiesBalance / monthlyAverageExpense : 0

    const fixedChargesRatio =
      effectiveIncome > 0
        ? Math.round(
            (subscriptionsSummary.totalMonthlyCost /
              (totalIncome > 0 ? totalIncome : effectiveIncome)) *
              100
          )
        : 0

    let score = 70
    if (savingsPct >= 20) score += 15
    if (needsPct <= 55) score += 10
    if (runwayMonths >= 3) score += 10
    if (fixedChargesRatio > 45) score -= 15
    if (totalExpense > totalIncome && totalIncome > 0) score -= 20
    score = Math.min(100, Math.max(20, score))

    return {
      needsSpent,
      wantsSpent,
      netSavings,
      needsPct,
      wantsPct,
      savingsPct,
      runwayMonths: Number(runwayMonths.toFixed(1)),
      fixedChargesRatio,
      score,
      totalIncome,
      totalExpense,
    }
  }, [transactions, liquiditiesBalance, subscriptionsSummary])

  // -------------------------------------------------------------
  // 3. Month-End Forecast & Burn Rate
  // -------------------------------------------------------------
  const monthForecast = useMemo(() => {
    const now = new Date()
    const currentDay = now.getDate()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const daysRemaining = Math.max(0, daysInMonth - currentDay)

    const currentMonthPrefix = now.toISOString().slice(0, 7)
    const currentMonthTxs = transactions.filter((t) => t.date.startsWith(currentMonthPrefix))
    const currentMonthExpenseTxs = currentMonthTxs.filter((t) => t.amount < 0)

    const currentMonthSpent = currentMonthExpenseTxs.reduce(
      (sum, t) => sum + Math.abs(t.amount),
      0
    )
    const dailyBurnRate = currentDay > 0 ? currentMonthSpent / currentDay : 0

    const pendingSubs = subscriptionsSummary.activeSubscriptions.filter((s) => {
      const nextDate = new Date(s.nextEstimatedDate)
      return (
        nextDate.getFullYear() === now.getFullYear() &&
        nextDate.getMonth() === now.getMonth() &&
        nextDate.getDate() > currentDay
      )
    })
    const pendingSubsTotal = pendingSubs.reduce((sum, s) => sum + s.monthlyCost, 0)

    const projectedCheckingBalance = Math.round(
      liquiditiesBalance - daysRemaining * dailyBurnRate - pendingSubsTotal
    )

    const trajectoryData = []
    let simulatedBalance = liquiditiesBalance + currentMonthSpent * 0.7
    const stepBurn = dailyBurnRate || 35

    for (let day = 1; day <= daysInMonth; day++) {
      if (day <= currentDay) {
        simulatedBalance -= stepBurn * (0.8 + Math.sin(day) * 0.2)
        trajectoryData.push({
          day: `${day}`,
          actual: Math.round(simulatedBalance),
          projected: undefined,
        })
      } else {
        if (day === currentDay + 1) {
          trajectoryData.push({
            day: `${day}`,
            actual: Math.round(simulatedBalance),
            projected: Math.round(simulatedBalance),
          })
        }
        simulatedBalance -= stepBurn
        trajectoryData.push({
          day: `${day}`,
          actual: undefined,
          projected: Math.round(simulatedBalance),
        })
      }
    }

    return {
      currentDay,
      daysRemaining,
      dailyBurnRate: Math.round(dailyBurnRate),
      pendingSubsTotal: Math.round(pendingSubsTotal),
      pendingSubsCount: pendingSubs.length,
      projectedCheckingBalance,
      trajectoryData,
    }
  }, [transactions, subscriptionsSummary, liquiditiesBalance])

  // -------------------------------------------------------------
  // 4. Compound Interest & FIRE Simulator
  // -------------------------------------------------------------
  const compoundProjection = useMemo(() => {
    const r = annualRate / 100
    const months = durationYears * 12
    const monthlyR = r / 12

    let futureValue = initialCapital * Math.pow(1 + monthlyR, months)
    if (monthlyR > 0) {
      futureValue += monthlyContribution * ((Math.pow(1 + monthlyR, months) - 1) / monthlyR)
    } else {
      futureValue += monthlyContribution * months
    }

    const totalInvested = initialCapital + monthlyContribution * months
    const totalInterests = Math.max(0, futureValue - totalInvested)
    const passiveMonthlyIncome = Math.round((futureValue * 0.04) / 12)

    const timeline = []
    for (let year = 0; year <= durationYears; year++) {
      const curMonths = year * 12
      let val = initialCapital * Math.pow(1 + monthlyR, curMonths)
      if (monthlyR > 0) {
        val += monthlyContribution * ((Math.pow(1 + monthlyR, curMonths) - 1) / monthlyR)
      } else {
        val += monthlyContribution * curMonths
      }
      const invested = initialCapital + monthlyContribution * curMonths
      const interests = Math.max(0, val - invested)

      timeline.push({
        year: `A${year}`,
        invested: Math.round(invested),
        interests: Math.round(interests),
        total: Math.round(val),
      })
    }

    return {
      futureValue: Math.round(futureValue),
      totalInvested: Math.round(totalInvested),
      totalInterests: Math.round(totalInterests),
      passiveMonthlyIncome,
      timeline,
      interestLeveragePct: futureValue > 0 ? Math.round((totalInterests / futureValue) * 100) : 0,
    }
  }, [initialCapital, monthlyContribution, annualRate, durationYears])

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto pb-24 md:pb-12 text-white select-none">
      {/* ------------------------------------------------------------- */}
      {/* 1. Executive Minimalist KPIs (Compact 4 Cards) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: Subscriptions Monthly Total */}
        <Card className="p-4 rounded-xl bg-[#18181B] border-white/10 flex flex-col justify-between gap-2 shadow-sm hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t.analysis.kpis.monthlySubscriptions}
            </span>
            <InfoTip text={t.analysis.tooltips.monthlySubscriptions} />
          </div>
          <div>
            <div className="text-2xl font-bold font-mono text-white tracking-tight">
              {formatAmount(Math.round(subscriptionsSummary.totalMonthlyCost))}
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400 font-mono">
              <span>
                {subscriptionsSummary.activeCount}{" "}
                {language === "fr" ? "abonnements" : "active subs"}
              </span>
              <span>•</span>
              <span className="text-zinc-500">
                {formatAmount(Math.round(subscriptionsSummary.totalAnnualCost))}/an
              </span>
            </div>
          </div>
        </Card>

        {/* KPI 2: Financial Runway */}
        <Card className="p-4 rounded-xl bg-[#18181B] border-white/10 flex flex-col justify-between gap-2 shadow-sm hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t.analysis.kpis.financialRunway}
            </span>
            <InfoTip text={t.analysis.tooltips.financialRunway} />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-emerald-400 tracking-tight">
                {rule503020Analysis.runwayMonths}
              </span>
              <span className="text-xs text-zinc-400 font-mono">
                {t.analysis.kpis.runwayUnit}
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 mt-1 truncate">
              {formatAmount(liquiditiesBalance)}{" "}
              {language === "fr" ? "disponibles" : "cash available"}
            </p>
          </div>
        </Card>

        {/* KPI 3: Fixed Charges Ratio */}
        <Card className="p-4 rounded-xl bg-[#18181B] border-white/10 flex flex-col justify-between gap-2 shadow-sm hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t.analysis.kpis.fixedChargesRatio}
            </span>
            <InfoTip text={t.analysis.tooltips.fixedChargesRatio} />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={cn(
                  "text-2xl font-bold font-mono tracking-tight",
                  rule503020Analysis.fixedChargesRatio <= 40
                    ? "text-white"
                    : rule503020Analysis.fixedChargesRatio <= 55
                    ? "text-amber-400"
                    : "text-rose-400"
                )}
              >
                {rule503020Analysis.fixedChargesRatio}%
              </span>
              <span className="text-xs text-zinc-400">
                {language === "fr" ? "des revenus" : "of income"}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-zinc-400 font-mono">
              {subscriptionsSummary.priceIncreasesCount > 0 ? (
                <span className="text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {subscriptionsSummary.priceIncreasesCount}{" "}
                  {language === "fr" ? "hausse détectée" : "hike detected"}
                </span>
              ) : (
                <span className="text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  {language === "fr" ? "Tarifs stables" : "Stable pricing"}
                </span>
              )}
            </div>
          </div>
        </Card>

        {/* KPI 4: Financial Health Score */}
        <Card className="p-4 rounded-xl bg-[#18181B] border-white/10 flex flex-col justify-between gap-2 shadow-sm hover:border-white/20 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t.analysis.kpis.healthScore}
            </span>
            <InfoTip text={t.analysis.tooltips.healthScore} />
          </div>
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-2xl font-bold font-mono text-white tracking-tight">
                {rule503020Analysis.score}
              </span>
              <span className="text-xs text-zinc-500 font-mono">/ 100</span>
            </div>
            <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden mt-2">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  rule503020Analysis.score >= 80
                    ? "bg-emerald-500"
                    : rule503020Analysis.score >= 60
                    ? "bg-indigo-500"
                    : "bg-amber-500"
                )}
                style={{ width: `${rule503020Analysis.score}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Primary Analysis Grid (Subscriptions Hub & 50/30/20 Diagnostic) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Column: Subscriptions & Recurring Charges Hub (7 cols) */}
        <Card className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {t.analysis.subscriptions.title}
              </h2>
              <InfoTip text={t.analysis.tooltips.subscriptionsHub} />
            </div>

            {/* Clean Segmented Tab Switcher */}
            <div className="flex p-0.5 bg-zinc-900 border border-white/10 rounded-lg">
              <button
                type="button"
                onClick={() => setSubsTab("active")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  subsTab === "active"
                    ? "bg-white text-zinc-950 shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {t.analysis.subscriptions.tabActive} ({subscriptionsSummary.activeCount})
              </button>
              <button
                type="button"
                onClick={() => setSubsTab("cancelled")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  subsTab === "cancelled"
                    ? "bg-white text-zinc-950 shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {t.analysis.subscriptions.tabCancelled} ({subscriptionsSummary.cancelledCount})
              </button>
              <button
                type="button"
                onClick={() => setSubsTab("breakdown")}
                className={cn(
                  "px-2.5 py-1 text-xs font-medium rounded-md transition-all cursor-pointer",
                  subsTab === "breakdown"
                    ? "bg-white text-zinc-950 shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {t.analysis.subscriptions.tabBreakdown}
              </button>
            </div>
          </div>

          {/* Tab 1: Active Subscriptions List */}
          {subsTab === "active" && (
            <div className="flex flex-col">
              {subscriptionsSummary.activeSubscriptions.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  {t.analysis.subscriptions.noActiveSubs}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-white/5 border border-white/10 rounded-xl bg-zinc-950/60 overflow-hidden max-h-[320px] overflow-y-auto">
                  {subscriptionsSummary.activeSubscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3 sm:px-3.5 flex items-center justify-between gap-2.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex flex-col min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white truncate">
                            {sub.name}
                          </span>
                          {sub.priceIncreased && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300">
                              {t.analysis.subscriptions.priceHikeBadge} (+
                              {formatAmount(sub.priceDifference || 0)})
                            </span>
                          )}
                          <span className="text-[10px] text-zinc-400 font-mono px-1.5 py-0.5 rounded bg-white/5">
                            {sub.cycle === "yearly"
                              ? t.analysis.subscriptions.yearlyCycle
                              : sub.cycle === "weekly"
                              ? t.analysis.subscriptions.weeklyCycle
                              : t.analysis.subscriptions.monthlyCycle}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-400 font-mono">
                          <span>{t.categories[sub.category] || sub.category}</span>
                          <span>•</span>
                          <span>
                            {sub.occurrencesCount}{" "}
                            {language === "fr" ? "prélèvements" : "debits"}
                          </span>
                          <span>•</span>
                          <span className="text-zinc-500">
                            {sub.nextEstimatedDate}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-white">
                          -{formatAmount(Math.round(sub.monthlyCost))}
                          <span className="text-[10px] text-zinc-500 font-normal">/m</span>
                        </span>
                        {sub.cycle === "yearly" && (
                          <div className="text-[10px] text-zinc-500 font-mono">
                            {formatAmount(sub.latestAmount)}/an
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Cancelled Subscriptions List */}
          {subsTab === "cancelled" && (
            <div className="flex flex-col">
              {subscriptionsSummary.cancelledSubscriptions.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-400">
                  {t.analysis.subscriptions.noCancelledSubs}
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-white/5 border border-white/10 rounded-xl bg-zinc-950/60 overflow-hidden max-h-[320px] overflow-y-auto">
                  {subscriptionsSummary.cancelledSubscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-3 sm:px-3.5 flex items-center justify-between gap-2.5 hover:bg-white/[0.02] transition-colors"
                    >
                      <div className="flex flex-col min-w-0 flex-1 pr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-zinc-400 line-through truncate">
                            {sub.name}
                          </span>
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                            {language === "fr" ? "Résilié" : "Cancelled"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-zinc-500 font-mono">
                          <span>{t.categories[sub.category] || sub.category}</span>
                          <span>•</span>
                          <span>
                            {language === "fr" ? "Dernier débit" : "Last debited"}{" "}
                            {sub.lastDate}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-bold font-mono text-emerald-400">
                          +{formatAmount(Math.round(sub.monthlyCost))}/m
                        </span>
                        <div className="text-[10px] text-zinc-500 font-mono">
                          {language === "fr" ? "économisés" : "saved"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Subscriptions Category Breakdown */}
          {subsTab === "breakdown" && (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
              {subscriptionsSummary.categoryBreakdown.map((item, idx) => {
                const color = CATEGORY_CHART_COLORS[idx % CATEGORY_CHART_COLORS.length]
                return (
                  <div
                    key={item.category}
                    className="space-y-1.5 p-2.5 rounded-xl bg-zinc-950/50 border border-white/5"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="font-semibold text-white">
                          {t.categories[item.category] || item.category}
                        </span>
                        <span className="text-[11px] text-zinc-500 font-mono">
                          ({item.count})
                        </span>
                      </div>
                      <div className="flex items-center gap-2 font-mono text-xs">
                        <span className="text-zinc-300 font-bold">
                          -{formatAmount(Math.round(item.monthlyCost))}/m
                        </span>
                        <span className="text-zinc-500 w-8 text-right">
                          {item.percentage}%
                        </span>
                      </div>
                    </div>
                    <Progress
                      value={item.percentage}
                      className="h-1 bg-zinc-900"
                      style={{ "--progress-background": color } as any}
                    />
                  </div>
                )
              })}
            </div>
          )}
        </Card>

        {/* Right Column: 50/30/20 Structural Diagnostic (5 cols) */}
        <Card className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {t.analysis.rule503020.title}
              </h2>
              <InfoTip text={t.analysis.tooltips.rule503020} />
            </div>
          </div>

          {/* 3 Pillars Breakdown */}
          <div className="space-y-3">
            {/* Needs: 50% */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
                  <span className="text-xs font-semibold text-white">
                    {t.analysis.rule503020.needsTitle}
                  </span>
                  <InfoTip text={t.analysis.tooltips.needsHelp} />
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500 text-[10px]">Cible: 50%</span>
                  <span className="font-bold text-rose-400">
                    {rule503020Analysis.needsPct}% ({formatAmount(Math.round(rule503020Analysis.needsSpent))})
                  </span>
                </div>
              </div>
              <Progress
                value={Math.min(100, rule503020Analysis.needsPct)}
                className="h-1 bg-zinc-900 [&>div]:bg-rose-500"
              />
            </div>

            {/* Wants: 30% */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                  <span className="text-xs font-semibold text-white">
                    {t.analysis.rule503020.wantsTitle}
                  </span>
                  <InfoTip text={t.analysis.tooltips.wantsHelp} />
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500 text-[10px]">Cible: 30%</span>
                  <span className="font-bold text-amber-400">
                    {rule503020Analysis.wantsPct}% ({formatAmount(Math.round(rule503020Analysis.wantsSpent))})
                  </span>
                </div>
              </div>
              <Progress
                value={Math.min(100, rule503020Analysis.wantsPct)}
                className="h-1 bg-zinc-900 [&>div]:bg-amber-500"
              />
            </div>

            {/* Savings & Investments: 20% */}
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span className="text-xs font-semibold text-white">
                    {t.analysis.rule503020.savingsTitle}
                  </span>
                  <InfoTip text={t.analysis.tooltips.savingsHelp} />
                </div>
                <div className="flex items-center gap-2 font-mono text-xs">
                  <span className="text-zinc-500 text-[10px]">Cible: 20%</span>
                  <span className="font-bold text-emerald-400">
                    {rule503020Analysis.savingsPct}% ({formatAmount(Math.round(rule503020Analysis.netSavings))})
                  </span>
                </div>
              </div>
              <Progress
                value={Math.min(100, rule503020Analysis.savingsPct)}
                className="h-1 bg-zinc-900 [&>div]:bg-emerald-500"
              />
            </div>
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Forecast & Compound Interest Simulator */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card: Month-End Forecast (5 cols) */}
        <Card className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-3.5 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {t.analysis.forecast.title}
              </h2>
              <InfoTip text={t.analysis.tooltips.forecast} />
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              {t.analysis.forecast.monthEndStatusOnTrack}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2.5 font-mono">
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400">{t.analysis.forecast.currentBalance}</span>
              <span className="text-base font-bold text-white">{formatAmount(liquiditiesBalance)}</span>
            </div>
            <div className="p-3 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-400">{t.analysis.forecast.projectedBalance}</span>
              <span
                className={cn(
                  "text-base font-bold",
                  monthForecast.projectedCheckingBalance >= 0 ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {formatAmount(monthForecast.projectedCheckingBalance)}
              </span>
            </div>
          </div>

          <div className="space-y-1.5 p-3 rounded-xl bg-zinc-950/40 border border-white/5 text-[11px]">
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">{t.analysis.forecast.burnRatePerDay}</span>
              <span className="font-mono font-semibold text-white">
                -{formatAmount(monthForecast.dailyBurnRate)}/j
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">{t.analysis.forecast.daysRemaining}</span>
              <span className="font-mono font-semibold text-zinc-300">
                {monthForecast.daysRemaining} j
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-zinc-400">{t.analysis.forecast.pendingSubscriptions}</span>
              <span className="font-mono font-semibold text-amber-400">
                -{formatAmount(monthForecast.pendingSubsTotal)}
              </span>
            </div>
          </div>

          {/* Mini Trajectory Area Chart */}
          <div className="h-28 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={monthForecast.trajectoryData}
                margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="projGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="day" stroke="#52525B" fontSize={9} tickLine={false} />
                <YAxis stroke="#52525B" fontSize={9} tickLine={false} domain={["auto", "auto"]} />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-[11px] font-mono shadow-xl">
                          <p className="text-zinc-400">Jour {data.day}</p>
                          {data.actual !== undefined && (
                            <p className="text-emerald-400 font-bold">
                              Solde réel: {formatAmount(data.actual)}
                            </p>
                          )}
                          {data.projected !== undefined && (
                            <p className="text-indigo-300 font-bold">
                              Projeté: {formatAmount(data.projected)}
                            </p>
                          )}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="actual"
                  stroke="#10B981"
                  strokeWidth={1.5}
                  fill="url(#actualGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="projected"
                  stroke="#6366F1"
                  strokeWidth={1.5}
                  strokeDasharray="3 3"
                  fill="url(#projGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Right Card: Compound Interest Simulator (7 cols) */}
        <Card className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {t.analysis.simulator.title}
              </h2>
              <InfoTip text={t.analysis.tooltips.simulator} />
            </div>
            <span className="text-[11px] text-zinc-400 font-mono">
              {durationYears} {t.analysis.simulator.yearsUnit} @ {annualRate}%
            </span>
          </div>

          {/* Compact Parameter Controls */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-medium">
                {t.analysis.simulator.initialCapital}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={1000}
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Math.max(0, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-8 rounded-lg pr-6 font-mono focus:border-white/20"
                />
                <span className="absolute right-2.5 top-1.5 text-xs text-zinc-500 font-mono">€</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-medium">
                {t.analysis.simulator.monthlySavings}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-8 rounded-lg pr-6 font-mono focus:border-white/20"
                />
                <span className="absolute right-2.5 top-1.5 text-xs text-zinc-500 font-mono">€</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-medium">
                {t.analysis.simulator.annualReturn} 
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={25}
                  step={0.5}
                  value={annualRate}
                  onChange={(e) => setAnnualRate(Math.max(0, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-8 rounded-lg pr-6 font-mono focus:border-white/20"
                />
                <span className="absolute right-2.5 top-1.5 text-xs text-zinc-500 font-mono">%</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-zinc-400 font-medium">
                {t.analysis.simulator.horizonYears}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={durationYears}
                  onChange={(e) => setDurationYears(Math.max(1, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-8 rounded-lg pr-8 font-mono focus:border-white/20"
                />
                <span className="absolute right-2 top-1.5 text-[10px] text-zinc-500 font-mono">
                  {t.analysis.simulator.yearsUnit}
                </span>
              </div>
            </div>
          </div>

          {/* Results Summary & FIRE Passive Income */}
          <div className="p-3.5 rounded-xl bg-zinc-950/70 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                {t.analysis.simulator.projectedWealth}
              </span>
              <span className="text-2xl sm:text-3xl font-bold font-mono text-white tracking-tight">
                {formatAmount(compoundProjection.futureValue)}
              </span>
              <div className="flex items-center gap-2 text-[11px] font-mono mt-0.5">
                <span className="text-zinc-400">
                  {t.analysis.simulator.totalInvested}:{" "}
                  <strong className="text-zinc-200">
                    {formatAmount(compoundProjection.totalInvested)}
                  </strong>
                </span>
                <span>•</span>
                <span className="text-emerald-400 font-bold">
                  +{formatAmount(compoundProjection.totalInterests)} intérêts
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex flex-col gap-0.5 shrink-0 sm:text-right">
              <div className="flex items-center gap-1 sm:justify-end">
                <span className="text-[10px] font-semibold text-indigo-300 uppercase tracking-wider">
                  {t.analysis.simulator.passiveIncome4Pct}
                </span>
                <InfoTip text={t.analysis.tooltips.fireRule} />
              </div>
              <span className="text-lg font-bold font-mono text-white">
                +{formatAmount(compoundProjection.passiveMonthlyIncome)}/m
              </span>
            </div>
          </div>

          {/* Compact Stacked Area Chart */}
          <div className="h-36 w-full pt-1">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={compoundProjection.timeline}
                margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="investedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#64748B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#64748B" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="interestsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis dataKey="year" stroke="#52525B" fontSize={9} tickLine={false} />
                <YAxis
                  stroke="#52525B"
                  fontSize={9}
                  tickLine={false}
                  tickFormatter={(v) => `${Math.round(v / 1000)}k`}
                />
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-[11px] font-mono shadow-xl space-y-0.5">
                          <p className="text-zinc-400 font-bold">{data.year}</p>
                          <p className="text-white font-bold">Total: {formatAmount(data.total)}</p>
                          <p className="text-zinc-400">Capital: {formatAmount(data.invested)}</p>
                          <p className="text-indigo-400">Intérêts: +{formatAmount(data.interests)}</p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="invested"
                  stackId="1"
                  stroke="#64748B"
                  strokeWidth={1.5}
                  fill="url(#investedGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="interests"
                  stackId="1"
                  stroke="#6366F1"
                  strokeWidth={1.5}
                  fill="url(#interestsGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  )
}
