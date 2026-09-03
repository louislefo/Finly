"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts"
import { usePrivacy } from "@/components/privacy-context"
import { Account, Transaction } from "@/lib/types/finance"
import {
  Settings2,
  Layers,
  LineChart as LineChartIcon,
  Check,
  X,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"

interface EvolutionChartProps {
  accounts?: Account[]
  transactions?: Transaction[]
}

const ACCOUNT_COLORS: string[] = [
  "#818cf8", // Indigo (Courant)
  "#10b981", // Emerald (Livret A)
  "#06b6d4", // Cyan (Livret Jeune)
  "#f59e0b", // Amber (PEA)
  "#ec4899", // Pink (Assurance-Vie)
  "#8b5cf6", // Purple
  "#3b82f6", // Blue
]

export function EvolutionChart({
  accounts = [],
  transactions = [],
}: EvolutionChartProps) {
  const { formatAmount } = usePrivacy()
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [timeRange, setTimeRange] = useState<"7J" | "30J" | "1A" | "Tout">("30J")
  const [viewMode, setViewMode] = useState<"sum" | "separate">("sum")
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([])

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Initialize all accounts selected by default
  useEffect(() => {
    if (accounts.length > 0 && selectedAccountIds.length === 0) {
      setSelectedAccountIds(accounts.map((a) => a.id))
    }
  }, [accounts, selectedAccountIds.length])

  const toggleAccount = (accId: string) => {
    setSelectedAccountIds((prev) => {
      if (prev.includes(accId)) {
        if (prev.length === 1) return prev // Keep at least one
        return prev.filter((id) => id !== accId)
      } else {
        return [...prev, accId]
      }
    })
  }

  const selectAllAccounts = () => {
    setSelectedAccountIds(accounts.map((a) => a.id))
  }

  // Active accounts and names
  const activeAccounts = useMemo(() => {
    return accounts.filter((a) => selectedAccountIds.includes(a.id))
  }, [accounts, selectedAccountIds])

  const selectedAccountNameSet = useMemo(() => {
    return new Set(activeAccounts.map((a) => a.name).filter(Boolean))
  }, [activeAccounts])

  // Filter transactions matching selected accounts & period for real Inflow / Outflow calculation
  const { totalInflow, totalOutflow, chartData } = useMemo(() => {
    const daysCount = timeRange === "7J" ? 7 : timeRange === "30J" ? 30 : timeRange === "1A" ? 365 : 180
    const points = []
    const now = new Date()

    const startDate = new Date(now)
    startDate.setDate(now.getDate() - daysCount)
    const startDateStr = startDate.toISOString().split("T")[0]

    let inflowSum = 0
    let outflowSum = 0

    // Filter transactions by selected accounts and date range
    const txByDateAndAcc: Record<string, Record<string, number>> = {}
    transactions.forEach((tx: any) => {
      const dateKey = (tx.date || "").split("T")[0]
      if (!dateKey) return

      const isAccountMatch =
        selectedAccountIds.includes(tx.account_id) ||
        (tx.account && selectedAccountNameSet.has(tx.account))

      if (isAccountMatch && dateKey >= startDateStr) {
        const val = Number(tx.amount) || 0
        if (val > 0) {
          inflowSum += val
        } else if (val < 0) {
          outflowSum += Math.abs(val)
        }
      }

      if (!txByDateAndAcc[dateKey]) txByDateAndAcc[dateKey] = {}
      const accKey = tx.account_id || tx.account
      txByDateAndAcc[dateKey][accKey] = (txByDateAndAcc[dateKey][accKey] || 0) + (Number(tx.amount) || 0)
      if (tx.account) {
        txByDateAndAcc[dateKey][tx.account] = (txByDateAndAcc[dateKey][tx.account] || 0) + (Number(tx.amount) || 0)
      }
    })

    // Track running balance backwards from today
    const runningBalances: Record<string, number> = {}
    accounts.forEach((acc) => {
      runningBalances[acc.id] = Number(acc.balance) || 0
    })

    // Step day by day backwards
    for (let i = 0; i < daysCount; i++) {
      const targetDate = new Date(now)
      targetDate.setDate(now.getDate() - i)
      const dateKey = targetDate.toISOString().split("T")[0]
      const formattedDate = targetDate.toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: daysCount > 90 ? "short" : "2-digit",
      })

      const point: any = {
        date: formattedDate,
        fullDate: dateKey,
        total: 0,
      }

      accounts.forEach((acc) => {
        if (selectedAccountIds.includes(acc.id)) {
          const currentVal = runningBalances[acc.id] || 0
          point[acc.id] = Math.round(currentVal * 100) / 100
          point.total += currentVal
        }
      })

      point.total = Math.round(point.total * 100) / 100

      // Rewind balance before this day's transactions
      if (txByDateAndAcc[dateKey]) {
        accounts.forEach((acc) => {
          const delta = txByDateAndAcc[dateKey][acc.id] || txByDateAndAcc[dateKey][acc.name || ""] || 0
          runningBalances[acc.id] = (runningBalances[acc.id] || 0) - delta
        })
      }

      points.unshift(point)
    }

    // Downsample if more than 35 points for cleaner rendering
    const finalPoints = points.length > 35
      ? points.filter((_, idx) => idx % Math.ceil(points.length / 30) === 0 || idx === points.length - 1)
      : points

    return {
      totalInflow: Math.round(inflowSum * 100) / 100,
      totalOutflow: Math.round(outflowSum * 100) / 100,
      chartData: finalPoints,
    }
  }, [accounts, transactions, timeRange, selectedAccountIds, selectedAccountNameSet])

  return (
    <div className="flex flex-col gap-4 w-full min-w-0">
      {/* Mobile-Friendly Responsive Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 w-full">
        <div className="flex items-center justify-between w-full sm:w-auto">
          <h3 className="font-bold text-base text-white">Évolution</h3>

          {/* Gear Settings Button for Mobile (Right aligned) */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`sm:hidden h-8 px-2.5 rounded-xl border-white/10 transition-all ${
              isSettingsOpen
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
          {/* Time range selector */}
          <div className="flex bg-zinc-900 rounded-xl p-1 border border-white/5 w-full sm:w-auto justify-between sm:justify-start">
            {(["7J", "30J", "1A", "Tout"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`flex-1 sm:flex-none px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer text-center ${
                  timeRange === range
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                {range}
              </button>
            ))}
          </div>

          {/* Desktop Gear Settings Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`hidden sm:flex h-8 px-2.5 rounded-xl border-white/10 transition-all ${
              isSettingsOpen
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Settings Panel (Opened via gear icon) */}
      {isSettingsOpen && (
        <div className="p-3.5 rounded-2xl bg-zinc-900/95 border border-white/10 flex flex-col gap-3 animate-in fade-in duration-150">
          <div className="flex justify-between items-center pb-2 border-b border-white/5">
            <span className="text-xs font-semibold text-white">Réglages du Graphique</span>
            <button
              onClick={() => setIsSettingsOpen(false)}
              className="text-zinc-400 hover:text-white p-1 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mode Switcher */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-zinc-300">Type d&apos;affichage</span>
            <div className="flex bg-zinc-950 rounded-xl p-1 border border-white/5">
              <button
                onClick={() => setViewMode("sum")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "sum"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Somme</span>
              </button>
              <button
                onClick={() => setViewMode("separate")}
                className={`flex-1 sm:flex-none px-3 py-1.5 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  viewMode === "separate"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <LineChartIcon className="w-3.5 h-3.5" />
                <span>Séparé</span>
              </button>
            </div>
          </div>

          {/* Account Multi-selector */}
          {accounts.length > 1 && (
            <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
              <div className="flex justify-between items-center">
                <span className="text-xs text-zinc-300">Comptes à inclure ({activeAccounts.length}/{accounts.length})</span>
                <button
                  onClick={selectAllAccounts}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300"
                >
                  Tous sélectionner
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {accounts.map((acc, idx) => {
                  const isSelected = selectedAccountIds.includes(acc.id)
                  const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]

                  return (
                    <button
                      key={acc.id}
                      onClick={() => toggleAccount(acc.id)}
                      className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all border text-left cursor-pointer ${
                        isSelected
                          ? "bg-zinc-950 border-white/20 text-white"
                          : "bg-zinc-950/40 border-white/5 text-zinc-500 hover:text-zinc-300"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <span className="truncate">{acc.name || acc.bank}</span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-indigo-400 shrink-0 ml-1" />}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Responsive Chart Area with Dynamic Domain Scaling */}
      <div className="h-64 sm:h-72 w-full min-w-0 pt-1" style={{ minHeight: "240px", minWidth: 0 }}>
        {isMounted && chartData.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
            {viewMode === "sum" ? (
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="finlyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="date"
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.08)" }}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[(dataMin: number) => Math.floor(dataMin * 0.98), (dataMax: number) => Math.ceil(dataMax * 1.02)]}
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}k€`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-[#18181B] border border-white/10 p-3 rounded-xl shadow-xl min-w-[160px]">
                          <p className="text-xs text-zinc-400">{data.date}</p>
                          <p className="text-sm font-bold text-white mt-0.5">
                            {formatAmount(data.total)}
                          </p>
                        </div>
                      )
                    }
                    return null
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#818cf8"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#finlyGradient)"
                />
              </AreaChart>
            ) : (
              <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <XAxis
                  dataKey="date"
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={{ stroke: "rgba(255, 255, 255, 0.08)" }}
                />
                <YAxis
                  stroke="#52525b"
                  fontSize={11}
                  tickLine={false}
                  axisLine={false}
                  domain={[(dataMin: number) => Math.floor(dataMin * 0.95), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                  tickFormatter={(v) => `${(v / 1000).toFixed(1)}k€`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload
                      return (
                        <div className="bg-[#18181B] border border-white/10 p-3 rounded-xl shadow-xl min-w-[180px] flex flex-col gap-1">
                          <p className="text-xs text-zinc-400 pb-1 border-b border-white/5">{data.date}</p>
                          {activeAccounts.map((acc, idx) => {
                            const val = data[acc.id] || 0
                            const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]
                            return (
                              <div key={acc.id} className="flex justify-between items-center text-xs gap-3">
                                <span className="flex items-center gap-1.5 text-zinc-300 truncate max-w-[110px]">
                                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                  <span className="truncate">{acc.name || acc.bank}</span>
                                </span>
                                <span className="font-mono font-bold text-white">{formatAmount(val)}</span>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }
                    return null
                  }}
                />
                {activeAccounts.map((acc, idx) => {
                  const color = ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length]
                  return (
                    <Line
                      key={acc.id}
                      type="monotone"
                      dataKey={acc.id}
                      name={acc.name || acc.bank}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                    />
                  )
                })}
              </LineChart>
            )}
          </ResponsiveContainer>
        ) : (
          <div className="h-full w-full flex items-center justify-center text-xs text-zinc-500">
            Chargement...
          </div>
        )}
      </div>

      {/* Dynamic Flow Indicators (Entrées / Sorties dynamically computed on selected accounts & period) */}
      <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/5">
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex flex-col">
          <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
            <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
            <span>Entrées ({timeRange})</span>
          </span>
          <p className="text-lg font-bold text-emerald-400 font-mono mt-0.5">
            +{formatAmount(totalInflow)}
          </p>
        </div>

        <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex flex-col">
          <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5 text-rose-400" />
            <span>Sorties ({timeRange})</span>
          </span>
          <p className="text-lg font-bold text-white font-mono mt-0.5">
            -{formatAmount(totalOutflow)}
          </p>
        </div>
      </div>
    </div>
  )
}
