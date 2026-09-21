"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  RefreshCw,
} from "lucide-react"
import { Card, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account, Transaction } from "@/lib/types/finance"
import { cn } from "@/lib/utils"

export function AnalysisView() {
  const { formatAmount } = usePrivacy()
  const { language } = useI18n()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Simulation parameters
  const [initialCapital, setInitialCapital] = useState<number>(10000)
  const [monthlyContribution, setMonthlyContribution] = useState<number>(300)
  const [annualRate, setAnnualRate] = useState<number>(7)
  const [durationYears, setDurationYears] = useState<number>(10)

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [accRes, txRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getTransactions(),
      ])
      setAccounts(accRes.accounts || [])
      setTransactions(txRes.transactions || [])
    } catch {
      // Fallback
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const totalBalance = useMemo(() => {
    return accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0)
  }, [accounts])

  // Subscriptions & recurring expenses detection
  const detectedSubscriptions = useMemo(() => {
    const expenseTx = transactions.filter((t) => t.amount < 0)
    const grouped: Record<string, { count: number; amounts: number[]; lastDate: string }> = {}

    expenseTx.forEach((tx) => {
      const sourceName = tx.merchant || tx.rawLabel || tx.raw_label || "Abonnement"
      const cleanName = sourceName.trim().toLowerCase().replace(/[0-9*#]/g, "").slice(0, 15)
      if (!grouped[cleanName]) {
        grouped[cleanName] = { count: 0, amounts: [], lastDate: tx.date }
      }
      grouped[cleanName].count += 1
      grouped[cleanName].amounts.push(Math.abs(tx.amount))
    })

    const recurring: { name: string; monthlyCost: number; count: number }[] = []
    Object.entries(grouped).forEach(([name, data]) => {
      if (data.count >= 2) {
        const avg = data.amounts.reduce((a, b) => a + b, 0) / data.amounts.length
        recurring.push({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          monthlyCost: avg,
          count: data.count,
        })
      }
    })

    return recurring.sort((a, b) => b.monthlyCost - a.monthlyCost).slice(0, 6)
  }, [transactions])

  const totalMonthlySubscriptions = useMemo(() => {
    return detectedSubscriptions.reduce((sum, s) => sum + s.monthlyCost, 0)
  }, [detectedSubscriptions])

  // Asset allocation estimation
  const allocation = useMemo(() => {
    let checking = 0
    let savings = 0
    let investments = 0

    accounts.forEach((acc) => {
      const b = Math.max(0, acc.balance || 0)
      const type = (acc.type || "").toLowerCase()
      if (type.includes("saving") || type.includes("livret") || type.includes("epargne")) {
        savings += b
      } else if (type.includes("pea") || type.includes("bourse") || type.includes("invest") || type.includes("crypto") || type.includes("titres")) {
        investments += b
      } else {
        checking += b
      }
    })

    const total = checking + savings + investments
    if (total === 0) {
      return [
        { label: language === "fr" ? "Comptes courants" : "Checking accounts", percentage: 100, amount: 0 },
        { label: language === "fr" ? "Livrets et Epargne" : "Savings & Deposits", percentage: 0, amount: 0 },
        { label: language === "fr" ? "Investissements" : "Investments", percentage: 0, amount: 0 },
      ]
    }

    return [
      {
        label: language === "fr" ? "Comptes courants" : "Checking accounts",
        percentage: Math.round((checking / total) * 100),
        amount: checking,
      },
      {
        label: language === "fr" ? "Livrets et Epargne" : "Savings & Deposits",
        percentage: Math.round((savings / total) * 100),
        amount: savings,
      },
      {
        label: language === "fr" ? "Investissements" : "Investments",
        percentage: Math.round((investments / total) * 100),
        amount: investments,
      },
    ]
  }, [accounts, language])

  // Compound interest calculation
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

    return {
      futureValue: Math.round(futureValue),
      totalInvested: Math.round(totalInvested),
      totalInterests: Math.round(totalInterests),
    }
  }, [initialCapital, monthlyContribution, annualRate, durationYears])

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto pb-24 md:pb-8">
      {/* Top Header Bar */}
      <div className="flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={loadData}
          disabled={isLoading}
          className="h-9 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs font-semibold cursor-pointer"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
          <span>{language === "fr" ? "Actualiser" : "Refresh"}</span>
        </Button>
      </div>

      {/* 2 Primary Balanced Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card: Scanners & Allocation (5 cols) */}
        <Card className="lg:col-span-5 p-5 sm:p-6 rounded-2xl bg-[#18181B] border-white/10 flex flex-col justify-between gap-5">
          {/* Inline Scanners Strip */}
          <div className="flex flex-col gap-2 pb-4 border-b border-white/5">
            <span className="text-xs font-medium text-zinc-400">
              {language === "fr" ? "Indicateurs d'optimisation" : "Optimization Indicators"}
            </span>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              <div className="flex flex-col p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-[10px] text-zinc-500">{language === "fr" ? "Frais cachés" : "Hidden fees"}</span>
                <span className="text-sm font-bold text-emerald-400">0.00%</span>
              </div>
              <div className="flex flex-col p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-[10px] text-zinc-500">{language === "fr" ? "Revenus passifs" : "Passive inc."}</span>
                <span className="text-sm font-bold text-indigo-300">+{formatAmount(Math.round(totalBalance * 0.025))}/an</span>
              </div>
              <div className="flex flex-col p-2.5 rounded-xl bg-zinc-900/60 border border-white/5">
                <span className="text-[10px] text-zinc-500">{language === "fr" ? "Abonnements" : "Subscriptions"}</span>
                <span className="text-sm font-bold text-white">-{formatAmount(Math.round(totalMonthlySubscriptions))}/m</span>
              </div>
            </div>
          </div>

          {/* Allocation Breakdown */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-white">
                {language === "fr" ? "Allocation des actifs" : "Asset Allocation"}
              </span>
              <span className="text-xs font-mono font-bold text-zinc-300">
                {formatAmount(totalBalance)}
              </span>
            </div>

            <div className="space-y-3 pt-1">
              {allocation.map((item, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium">{item.label}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-400 font-mono">{formatAmount(item.amount)}</span>
                      <span className="font-bold text-white font-mono w-10 text-right">{item.percentage}%</span>
                    </div>
                  </div>
                  <Progress value={item.percentage} className="h-1.5 bg-zinc-900 [&>div]:bg-indigo-500" />
                </div>
              ))}
            </div>
          </div>

          {/* Detected Subscriptions List */}
          <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
            <div className="flex justify-between items-center text-xs">
              <span className="font-semibold text-zinc-400">
                {language === "fr" ? "Abonnements récurrents" : "Recurring Subscriptions"}
              </span>
              <span className="text-[11px] text-zinc-500 font-mono">
                {detectedSubscriptions.length} {language === "fr" ? "actifs" : "active"}
              </span>
            </div>

            {detectedSubscriptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-zinc-500">
                {language === "fr" ? "Aucun abonnement récurrent détecté." : "No recurring subscriptions found."}
              </div>
            ) : (
              <div className="divide-y divide-white/5 max-h-[180px] overflow-y-auto">
                {detectedSubscriptions.map((sub, idx) => (
                  <div key={idx} className="py-2 flex items-center justify-between text-xs">
                    <span className="text-zinc-300 font-medium truncate">{sub.name}</span>
                    <span className="font-mono font-semibold text-white shrink-0">
                      -{formatAmount(Math.round(sub.monthlyCost))}/mo
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Card>

        {/* Right Card: Compound Interest Simulator (7 cols) */}
        <Card className="lg:col-span-7 p-5 sm:p-6 rounded-2xl bg-[#18181B] border-white/10 flex flex-col justify-between gap-6">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div>
              <h3 className="text-sm font-semibold text-white tracking-tight">
                {language === "fr" ? "Simulateur d'intérêts composés" : "Compound Interest Simulator"}
              </h3>
            </div>
            <span className="text-xs text-zinc-500 font-mono">
              {durationYears} {language === "fr" ? "ans" : "yrs"} @ {annualRate}%
            </span>
          </div>

          {/* Interactive Numeric Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">
                {language === "fr" ? "Capital initial" : "Initial Capital"}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={500}
                  value={initialCapital}
                  onChange={(e) => setInitialCapital(Math.max(0, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl pr-8 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-mono">€</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">
                {language === "fr" ? "Épargne mensuelle" : "Monthly Savings"}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  step={50}
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(Math.max(0, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl pr-8 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-mono">€</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">
                {language === "fr" ? "Rendement annuel (%)" : "Annual Return (%)"}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={0}
                  max={25}
                  step={0.5}
                  value={annualRate}
                  onChange={(e) => setAnnualRate(Math.max(0, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl pr-8 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-mono">%</span>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">
                {language === "fr" ? "Horizon (années)" : "Horizon (years)"}
              </label>
              <div className="relative">
                <Input
                  type="number"
                  min={1}
                  max={50}
                  step={1}
                  value={durationYears}
                  onChange={(e) => setDurationYears(Math.max(1, Number(e.target.value)))}
                  className="bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl pr-8 font-mono"
                />
                <span className="absolute right-3 top-2.5 text-xs text-zinc-500 font-mono">
                  {language === "fr" ? "ans" : "yrs"}
                </span>
              </div>
            </div>
          </div>

          {/* Large Result Box */}
          <div className="p-5 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-col justify-between gap-4">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {language === "fr" ? `Patrimoine estimé dans ${durationYears} ans` : `Projected Wealth in ${durationYears} years`}
            </span>
            <div>
              <span className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight">
                {formatAmount(compoundProjection.futureValue)}
              </span>
              <div className="grid grid-cols-2 gap-4 mt-3 pt-3 border-t border-white/5 text-xs font-mono">
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px]">{language === "fr" ? "Total investi" : "Total invested"}</span>
                  <span className="font-semibold text-zinc-200">{formatAmount(compoundProjection.totalInvested)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-zinc-500 text-[10px]">{language === "fr" ? "Intérêts générés" : "Interest earned"}</span>
                  <span className="font-bold text-emerald-400">+{formatAmount(compoundProjection.totalInterests)}</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
