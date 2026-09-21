"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts"
import {
  ChevronDown,
  PieChart as PieChartIcon,
  LayoutGrid,
  ChevronRight,
  Check,
  Wallet,
  PiggyBank,
  TrendingUp,
  Shield,
  AlertCircle,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import { WoobModal } from "@/components/modals/woob-modal"
import { ImportCredentialsModal, PendingBankConnection } from "@/components/modals/import-credentials-modal"
import { MerchantAvatar } from "@/components/ui/merchant-avatar"
import { ExpensesMap } from "@/components/charts/expenses-map"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account, Transaction, BankConnection } from "@/lib/types/finance"
import { cn } from "@/lib/utils"

type TimeRange = "1J" | "7J" | "1M" | "3M" | "6M" | "YTD" | "1A" | "TOUT"
const TIME_RANGES: TimeRange[] = ["1J", "7J", "1M", "3M", "6M", "YTD", "1A", "TOUT"]

export type CategoryKey = "comptes_courants" | "livrets" | "assurance_vie" | "pea_titres"

interface CategoryDefinition {
  key: CategoryKey
  labelFr: string
  labelEn: string
  color: string
  icon: React.ComponentType<{ className?: string }>
}

const CATEGORIES: CategoryDefinition[] = [
  {
    key: "comptes_courants",
    labelFr: "Comptes courants",
    labelEn: "Checking accounts",
    color: "#3b82f6", // Blue
    icon: Wallet,
  },
  {
    key: "livrets",
    labelFr: "Livrets",
    labelEn: "Savings",
    color: "#10b981", // Emerald
    icon: PiggyBank,
  },
  {
    key: "assurance_vie",
    labelFr: "Assurance vie",
    labelEn: "Life insurance",
    color: "#8b5cf6", // Purple
    icon: Shield,
  },
  {
    key: "pea_titres",
    labelFr: "PEA / Titres",
    labelEn: "PEA / Brokerage",
    color: "#f59e0b", // Amber/Gold
    icon: TrendingUp,
  },
]

// Accurate classifier based on account types, names, and banks
function classifyAccount(acc: Account): CategoryKey {
  const t = (acc.type || "").toLowerCase()
  const n = (acc.name || "").toLowerCase()
  const b = (acc.bank || "").toLowerCase()
  const combined = `${t} ${n} ${b}`

  // 1. Assurance vie & Retraite
  if (
    [
      "assurance",
      "vie",
      "av",
      "per",
      "perp",
      "madelin",
      "capitalisation",
      "retraite",
      "life insurance",
      "boursovie",
      "linxea",
      "spirica",
      "suravenir",
      "generali",
    ].some((k) => combined.includes(k))
  ) {
    return "assurance_vie"
  }

  // 2. PEA / Titres / Bourse / Crypto / Investissement
  if (
    [
      "pea",
      "titre",
      "titres",
      "bourse",
      "cto",
      "broker",
      "brokerage",
      "investment",
      "crypto",
      "action",
      "actions",
      "etf",
      "trading",
      "degiro",
      "trade republic",
      "binance",
      "kraken",
      "coinbase",
    ].some((k) => combined.includes(k))
  ) {
    return "pea_titres"
  }

  // 3. Livrets d'épargne (Livret A, LDDS, LEP, PEL, CEL, Livret Jeune, CSL...)
  if (
    [
      "livret",
      "epargne",
      "épargne",
      "ldd",
      "ldds",
      "lep",
      "pel",
      "cel",
      "savings",
      "csl",
      "distingo",
      "super livret",
    ].some((k) => combined.includes(k))
  ) {
    return "livrets"
  }

  // 4. Par défaut: Comptes courants
  return "comptes_courants"
}

// Treemap Box Definition
interface TreemapRect {
  key: CategoryKey
  name: string
  value: number
  percentage: number
  color: string
  accountsCount: number
  x: number // percentage 0-100
  y: number // percentage 0-100
  w: number // percentage 0-100
  h: number // percentage 0-100
}

// Treemap layout with a visual floor to ensure every tile has enough room for text and figures
function computeTreemapLayout(
  items: {
    key: CategoryKey
    name: string
    value: number
    percentage: number
    color: string
    accountsCount: number
  }[]
): TreemapRect[] {
  const valid = items.filter((it) => it.value > 0).sort((a, b) => b.value - a.value)
  if (valid.length === 0) return []

  const total = valid.reduce((sum, it) => sum + it.value, 0)
  if (total === 0) return []

  if (valid.length === 1) {
    return [{ ...valid[0], x: 0, y: 0, w: 100, h: 100 }]
  }

  // Minimum visual weight floor so even a 1% or 2% category remains readable with its text
  const rawP = valid.map((it) => it.value / total)
  const minFloor = valid.length === 2 ? 0.22 : valid.length === 3 ? 0.18 : 0.14
  const adjustedWeights = rawP.map((rp) => Math.max(minFloor, rp))
  const sumWeights = adjustedWeights.reduce((a, b) => a + b, 0)
  const visualP = adjustedWeights.map((w) => w / sumWeights)

  if (valid.length === 2) {
    const w0 = visualP[0] * 100
    const w1 = visualP[1] * 100
    return [
      { ...valid[0], x: 0, y: 0, w: w0, h: 100 },
      { ...valid[1], x: w0, y: 0, w: w1, h: 100 },
    ]
  }

  if (valid.length === 3) {
    const w0 = visualP[0] * 100
    const wRight = (visualP[1] + visualP[2]) * 100
    const h1 = (visualP[1] / (visualP[1] + visualP[2])) * 100
    const h2 = (visualP[2] / (visualP[1] + visualP[2])) * 100

    return [
      { ...valid[0], x: 0, y: 0, w: w0, h: 100 },
      { ...valid[1], x: w0, y: 0, w: wRight, h: h1 },
      { ...valid[2], x: w0, y: h1, w: wRight, h: h2 },
    ]
  }

  // 4 items: partition into 2 columns minimizing deviation from 50%
  let bestDiff = 999
  let bestSubset: number[] = [0]
  const candidateSubsets = [[0], [0, 1], [0, 2], [0, 3]]
  for (const subset of candidateSubsets) {
    const sumSubset = subset.reduce((acc, idx) => acc + visualP[idx], 0)
    const diff = Math.abs(sumSubset - 0.5)
    if (diff < bestDiff) {
      bestDiff = diff
      bestSubset = subset
    }
  }

  const otherSubset = [0, 1, 2, 3].filter((idx) => !bestSubset.includes(idx))
  const sumA = bestSubset.reduce((acc, idx) => acc + visualP[idx], 0)
  const sumB = otherSubset.reduce((acc, idx) => acc + visualP[idx], 0)

  const wA = sumA * 100
  const wB = sumB * 100

  const rects: TreemapRect[] = []

  let currYA = 0
  for (const idx of bestSubset) {
    const h = (visualP[idx] / sumA) * 100
    rects.push({
      ...valid[idx],
      x: 0,
      y: currYA,
      w: wA,
      h: h,
    })
    currYA += h
  }

  let currYB = 0
  for (const idx of otherSubset) {
    const h = (visualP[idx] / sumB) * 100
    rects.push({
      ...valid[idx],
      x: wA,
      y: currYB,
      w: wB,
      h: h,
    })
    currYB += h
  }

  return rects
}

export function DashboardView() {
  const router = useRouter()
  const { formatAmount } = usePrivacy()
  const { t, language } = useI18n()

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([])
  const [fixingConnection, setFixingConnection] = useState<PendingBankConnection | null>(null)
  const [isFixModalOpen, setIsFixModalOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Filters & Controls
  const [viewMode, setViewMode] = useState<"patrimoine" | "everyday">("patrimoine")
  const [selectedRange, setSelectedRange] = useState<TimeRange>("TOUT")
  const [selectedCategoryKeys, setSelectedCategoryKeys] = useState<CategoryKey[]>([
    "comptes_courants",
    "livrets",
    "assurance_vie",
    "pea_titres",
  ])
  const [allocationView, setAllocationView] = useState<"chart" | "treemap">("chart")
  const [hoveredSliceIndex, setHoveredSliceIndex] = useState<number | null>(null)
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [accRes, txRes, connsRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getTransactions(),
        FinlyAPI.getBankConnections(),
      ])
      setAccounts(accRes.accounts || [])
      setTransactions(txRes.transactions || [])
      setBankConnections(connsRes || [])
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const actionRequiredConnections = useMemo(() => {
    return bankConnections.filter(
      (c) =>
        (c.status && c.status !== "connected" && c.status !== "ok" && c.status !== "active") ||
        c.has_password === false
    )
  }, [bankConnections])

  const handleOpenFix = (conn: BankConnection) => {
    setFixingConnection({
      id: conn.id,
      backend_name: conn.backend_name,
      module_name: conn.module_name,
      bank_name: conn.bank_name,
      login: conn.login || "",
    })
    setIsFixModalOpen(true)
  }

  // Current formatted date
  const currentDateFormatted = useMemo(() => {
    const d = new Date()
    return d.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  }, [language])

  // Group accounts by the 4 target categories
  const accountsByCategory = useMemo(() => {
    const map: Record<CategoryKey, Account[]> = {
      comptes_courants: [],
      livrets: [],
      assurance_vie: [],
      pea_titres: [],
    }
    accounts.forEach((acc) => {
      const cat = classifyAccount(acc)
      map[cat].push(acc)
    })
    return map
  }, [accounts])

  // Balances by category
  const categoryBalances = useMemo(() => {
    const b: Record<CategoryKey, number> = {
      comptes_courants: 0,
      livrets: 0,
      assurance_vie: 0,
      pea_titres: 0,
    }
    CATEGORIES.forEach((cat) => {
      b[cat.key] = accountsByCategory[cat.key].reduce(
        (sum, a) => sum + (Number(a.balance) || 0),
        0
      )
    })
    return b
  }, [accountsByCategory])

  // Filtered active accounts matching selected categories
  const activeAccounts = useMemo(() => {
    return accounts.filter((acc) => {
      const cat = classifyAccount(acc)
      return selectedCategoryKeys.includes(cat)
    })
  }, [accounts, selectedCategoryKeys])

  // Total balance of selected categories
  const selectedTotalBalance = useMemo(() => {
    return activeAccounts.reduce((sum, a) => sum + (Number(a.balance) || 0), 0)
  }, [activeAccounts])

  // Mode Selector handlers (Patrimoine vs Vie de tous les jours)
  const handleSelectViewMode = (mode: "patrimoine" | "everyday") => {
    setViewMode(mode)
    if (mode === "patrimoine") {
      setSelectedCategoryKeys(["comptes_courants", "livrets", "assurance_vie", "pea_titres"])
    } else {
      setSelectedCategoryKeys(["comptes_courants"])
    }
  }

  // Category Toggle handlers
  const toggleCategory = (key: CategoryKey) => {
    setSelectedCategoryKeys((prev) => {
      let next: CategoryKey[]
      if (prev.includes(key)) {
        if (prev.length === 1) {
          next = ["comptes_courants", "livrets", "assurance_vie", "pea_titres"]
        } else {
          next = prev.filter((k) => k !== key)
        }
      } else {
        next = [...prev, key]
      }

      if (next.length === 1 && next[0] === "comptes_courants") {
        setViewMode("everyday")
      } else if (next.length === 4) {
        setViewMode("patrimoine")
      }
      return next
    })
  }

  const selectAllCategories = () => {
    setViewMode("patrimoine")
    setSelectedCategoryKeys(["comptes_courants", "livrets", "assurance_vie", "pea_titres"])
  }

  // Asset Allocation data for Donut and Treemap
  const allocationData = useMemo(() => {
    const items = CATEGORIES.filter((cat) => selectedCategoryKeys.includes(cat.key)).map(
      (cat) => {
        const val = categoryBalances[cat.key]
        const positiveVal = Math.max(0, val)
        const pct =
          selectedTotalBalance > 0
            ? Math.round((positiveVal / selectedTotalBalance) * 100)
            : 0
        return {
          key: cat.key,
          name: language === "fr" ? cat.labelFr : cat.labelEn,
          value: positiveVal,
          realBalance: val,
          color: cat.color,
          percentage: pct,
          accountsCount: accountsByCategory[cat.key].length,
        }
      }
    )

    const nonZeroItems = items.filter((item) => item.value > 0)
    if (nonZeroItems.length > 0) {
      return nonZeroItems
    }

    return items.length > 0
      ? items
      : [
          {
            key: "comptes_courants" as CategoryKey,
            name: language === "fr" ? "Total" : "Total",
            value: 1,
            realBalance: 0,
            color: "#3b82f6",
            percentage: 100,
            accountsCount: 0,
          },
        ]
  }, [selectedCategoryKeys, categoryBalances, selectedTotalBalance, language, accountsByCategory])

  // Treemap rectangles layout
  const treemapRectangles = useMemo(() => {
    return computeTreemapLayout(allocationData)
  }, [allocationData])

  // Realistic Historical Chart points built from actual accounts and transactions backwards
  const chartPoints = useMemo(() => {
    let days = 365
    if (selectedRange === "1J") days = 1
    else if (selectedRange === "7J") days = 7
    else if (selectedRange === "1M") days = 30
    else if (selectedRange === "3M") days = 90
    else if (selectedRange === "6M") days = 180
    else if (selectedRange === "YTD") {
      const now = new Date()
      const startOfYear = new Date(now.getFullYear(), 0, 1)
      days = Math.max(1, Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)))
    } else if (selectedRange === "1A") days = 365
    else if (selectedRange === "TOUT") days = 730

    const pointsCount = Math.min(35, Math.max(7, days))
    const now = new Date()
    const activeAccountIds = new Set(activeAccounts.map((a) => a.id))
    const activeAccountNames = new Set(activeAccounts.map((a) => a.name).filter(Boolean))

    const txDeltaByDate: Record<string, number> = {}
    transactions.forEach((tx) => {
      const dateKey = (tx.date || "").split("T")[0]
      if (!dateKey) return
      const isMatch =
        (tx.account_id && activeAccountIds.has(tx.account_id)) ||
        (tx.account && activeAccountNames.has(tx.account))
      if (isMatch) {
        txDeltaByDate[dateKey] = (txDeltaByDate[dateKey] || 0) + (Number(tx.amount) || 0)
      }
    })

    let runningBalance = selectedTotalBalance
    const rawPoints: { date: string; value: number }[] = []

    for (let i = 0; i < pointsCount; i++) {
      const targetDate = new Date(now)
      targetDate.setDate(now.getDate() - Math.round((i * days) / pointsCount))
      const dateKey = targetDate.toISOString().split("T")[0]
      const formattedDate = targetDate.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
        day: "2-digit",
        month: days > 90 ? "short" : "2-digit",
        year: i === 0 || i === pointsCount - 1 ? "2-digit" : undefined,
      })

      rawPoints.unshift({
        date: formattedDate,
        value: Math.max(0, Math.round(runningBalance * 100) / 100),
      })

      const delta = txDeltaByDate[dateKey] || 0
      runningBalance -= delta
    }

    return rawPoints
  }, [selectedRange, activeAccounts, selectedTotalBalance, transactions, language])

  // Axis bounds
  const maxValue = useMemo(() => {
    const max = Math.max(...chartPoints.map((p) => p.value), selectedTotalBalance)
    return max === 0 ? 100 : Math.ceil(max * 1.15)
  }, [chartPoints, selectedTotalBalance])

  // Donut center display calculation
  const hoveredItem =
    hoveredSliceIndex !== null && allocationData[hoveredSliceIndex]
      ? allocationData[hoveredSliceIndex]
      : null

  const centerAmount = hoveredItem
    ? formatAmount(hoveredItem.realBalance)
    : formatAmount(selectedTotalBalance)

  const centerLabel = hoveredItem
    ? `${hoveredItem.name} • ${hoveredItem.percentage}%`
    : selectedCategoryKeys.length === 4
    ? language === "fr" ? "Total" : "Total"
    : language === "fr" ? "Sélection" : "Selection"

  // Dynamic font size adaptation so amount NEVER overflows donut hole (diameter 180px)
  const amountFontSize = useMemo(() => {
    const len = centerAmount.length
    if (len > 16) return "text-sm sm:text-base font-bold"
    if (len > 13) return "text-base sm:text-lg font-bold"
    if (len > 10) return "text-lg sm:text-xl font-bold"
    if (len > 8) return "text-xl sm:text-2xl font-extrabold"
    return "text-2xl sm:text-3xl font-extrabold"
  }, [centerAmount])

  // Recent transactions list (last 5)
  const recentTransactions = useMemo(() => {
    return [...transactions]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  }, [transactions])

  return (
    <div className="flex flex-col gap-4 sm:gap-5 w-full max-w-[1600px] mx-auto -mt-1 sm:-mt-2">
      {/* Top Center: Action Required Alert Banner */}
      {actionRequiredConnections.length > 0 && (
        <div className="w-full flex justify-center -mb-1">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-2.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 w-full max-w-3xl text-xs backdrop-blur-sm shadow-sm">
            <div className="flex items-center gap-2.5 min-w-0">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span className="truncate">
                <strong className="font-bold">{t.syncFeedback.actionRequired} : </strong>
                {actionRequiredConnections.length === 1
                  ? t.syncFeedback.reconnectPrompt.replace("{bank}", actionRequiredConnections[0].bank_name)
                  : t.syncFeedback.reconnectMultiplePrompt.replace("{count}", String(actionRequiredConnections.length))}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={() => handleOpenFix(actionRequiredConnections[0])}
              className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs h-7 px-3.5 rounded-xl shrink-0 cursor-pointer shadow-sm transition-colors"
            >
              {t.syncFeedback.updateCredentialsBtn}
            </Button>
          </div>
        </div>
      )}

      {/* Top Bar: Left = Mode Selector (Patrimoine vs Vie de tous les jours), Right = Period Selector */}
      <div className="flex items-center justify-between gap-2.5">
        {/* Left: Mode Selector (Patrimoine / Vie de tous les jours) */}
        <div className="flex items-center bg-[#18181B] p-1 rounded-xl border border-white/10 w-fit select-none shrink-0">
          <button
            type="button"
            onClick={() => handleSelectViewMode("patrimoine")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none",
              viewMode === "patrimoine"
                ? "bg-white text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {language === "fr" ? "Patrimoine" : "Wealth"}
          </button>
          <button
            type="button"
            onClick={() => handleSelectViewMode("everyday")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none",
              viewMode === "everyday"
                ? "bg-white text-zinc-950 font-bold shadow-sm"
                : "text-zinc-400 hover:text-white"
            )}
          >
            {language === "fr" ? "Vie de tous les jours" : "Everyday life"}
          </button>
        </div>

        {/* Right on Mobile: Native OS Dropdown (<select>) for pure Apple / Android wheel */}
        <div className="sm:hidden">
          <select
            value={selectedRange}
            onChange={(e) => setSelectedRange(e.target.value as TimeRange)}
            className="bg-[#18181B] text-white text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-white/10 focus:outline-none cursor-pointer"
          >
            {TIME_RANGES.map((range) => (
              <option key={range} value={range} className="bg-[#18181B] text-white">
                {range}
              </option>
            ))}
          </select>
        </div>

        {/* Right on Desktop: Frameless Period Selector (no enclosing box) */}
        <div className="hidden sm:flex items-center gap-0.5 sm:gap-1 overflow-x-auto scrollbar-none py-0.5">
          {TIME_RANGES.map((range) => {
            const isActive = selectedRange === range
            return (
              <button
                key={range}
                type="button"
                onClick={() => setSelectedRange(range)}
                className={cn(
                  "px-2 sm:px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer whitespace-nowrap rounded-lg",
                  isActive
                    ? "text-white font-bold bg-white/10"
                    : "text-zinc-400 hover:text-zinc-200"
                )}
              >
                {range}
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Grid: Evolution Chart (Left) & Allocation (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-w-0">
        {/* Left Card: Evolution Chart */}
        <Card className="lg:col-span-7 xl:col-span-8 p-6 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between min-w-0">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <span className="text-xs text-zinc-400 font-medium">
                {currentDateFormatted}
              </span>
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight mt-0.5 font-mono">
                {formatAmount(selectedTotalBalance)}
              </div>
            </div>

            {/* Category Multi-Select Dropdown Filter (Without colored dots) */}
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <div className="flex items-center gap-2 px-3.5 py-2 rounded-full bg-[#121215] border border-white/10 hover:border-white/20 transition-all text-xs font-semibold text-zinc-300 cursor-pointer shadow-sm select-none">
                  <span>
                    {selectedCategoryKeys.length === 4
                      ? language === "fr" ? "Toutes les catégories" : "All categories"
                      : selectedCategoryKeys.length === 1
                      ? CATEGORIES.find((c) => c.key === selectedCategoryKeys[0])?.[
                          language === "fr" ? "labelFr" : "labelEn"
                        ]
                      : `${selectedCategoryKeys.length} ${
                          language === "fr" ? "catégories" : "categories"
                        }`}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                </div>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-72 bg-[#18181B] border border-white/10 text-white rounded-2xl p-2 text-xs shadow-2xl space-y-1"
              >
                <div className="flex items-center justify-between px-2.5 py-1.5 text-zinc-400 text-[11px] font-semibold">
                  <span>{language === "fr" ? "Catégories de comptes" : "Account categories"}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      if (selectedCategoryKeys.length === 4) {
                        setSelectedCategoryKeys(["comptes_courants"])
                      } else {
                        selectAllCategories()
                      }
                    }}
                    className="text-indigo-400 hover:text-indigo-300 text-[11px] font-semibold cursor-pointer"
                  >
                    {selectedCategoryKeys.length === 4
                      ? language === "fr" ? "Désélectionner" : "Reset"
                      : language === "fr" ? "Tout cocher" : "Select all"}
                  </button>
                </div>
                <DropdownMenuSeparator className="bg-white/5 my-1" />
                {CATEGORIES.map((cat) => {
                  const isChecked = selectedCategoryKeys.includes(cat.key)
                  const bal = categoryBalances[cat.key]
                  const accsCount = accountsByCategory[cat.key].length
                  return (
                    <div
                      key={cat.key}
                      onClick={(e) => {
                        e.preventDefault()
                        toggleCategory(cat.key)
                      }}
                      className={cn(
                        "flex items-center justify-between p-2 rounded-xl cursor-pointer transition-all hover:bg-white/5 select-none",
                        isChecked ? "text-white" : "text-zinc-500 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className={cn(
                            "w-4 h-4 rounded-md flex items-center justify-center border transition-all shrink-0",
                            isChecked
                              ? "bg-indigo-600 border-indigo-500 text-white"
                              : "border-zinc-700 bg-zinc-900"
                          )}
                        >
                          {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                        <div>
                          <div className="font-semibold text-xs leading-tight">
                            {language === "fr" ? cat.labelFr : cat.labelEn}
                          </div>
                          <div className="text-[10px] text-zinc-400">
                            {accsCount} {language === "fr" ? "compte(s)" : "account(s)"}
                          </div>
                        </div>
                      </div>
                      <span className="font-mono text-xs font-semibold">
                        {formatAmount(bal)}
                      </span>
                    </div>
                  )
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Line & Area Chart in warm gold/amber tone like Finary */}
          <div className="w-full min-w-0 h-64 sm:h-72 mt-2">
            {isMounted ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 500, height: 280 }}>
                <AreaChart data={chartPoints} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="finaryGoldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    stroke="#52525b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    dy={8}
                  />
                  <YAxis
                    stroke="#52525b"
                    fontSize={10}
                    tickLine={false}
                    axisLine={false}
                    domain={[0, maxValue]}
                    tickFormatter={(val) => {
                      if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)} k€`
                      return `${val} €`
                    }}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload
                        return (
                          <div className="bg-[#121215] border border-white/10 p-2.5 rounded-xl shadow-xl text-xs">
                            <span className="text-zinc-400 text-[11px] block">{data.date}</span>
                            <span className="font-bold text-white font-mono text-sm mt-0.5 block">
                              {formatAmount(data.value)}
                            </span>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#d97706"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#finaryGoldGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : null}
          </div>
        </Card>

        {/* Right Card: Allocation with Donut Chart and Treemap (Diagramme de carrés proportionnels) */}
        <Card className="lg:col-span-5 xl:col-span-4 p-6 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between min-w-0">
          {/* Card Header with Controls */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 text-white font-bold text-base">
              <span>{language === "fr" ? "Allocation" : "Allocation"}</span>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Donut Toggle Button */}
              <button
                type="button"
                onClick={() => setAllocationView("chart")}
                title={language === "fr" ? "Graphique en anneau" : "Donut chart"}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors cursor-pointer",
                  allocationView === "chart"
                    ? "bg-white/10 text-white border-white/20"
                    : "text-zinc-400 hover:text-white border-transparent"
                )}
              >
                <PieChartIcon className="w-3.5 h-3.5" />
              </button>

              {/* Treemap (Carrés proportionnels) Toggle Button */}
              <button
                type="button"
                onClick={() => setAllocationView("treemap")}
                title={language === "fr" ? "Diagramme en carrés (Treemap)" : "Treemap"}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors cursor-pointer",
                  allocationView === "treemap"
                    ? "bg-white/10 text-white border-white/20"
                    : "text-zinc-400 hover:text-white border-transparent"
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/patrimoine")}
                className="text-xs text-zinc-300 hover:text-white hover:bg-white/5 h-8 px-2 rounded-lg cursor-pointer"
              >
                {language === "fr" ? "Voir plus" : "View more"}
              </Button>
            </div>
          </div>

          {/* Content: Donut Chart or Treemap (Carrés proportionnels avec taille minimale garantie) */}
          {allocationView === "chart" ? (
            <div className="relative flex items-center justify-center my-auto py-1 min-w-0">
              <div className="w-64 h-64 sm:w-68 sm:h-68 max-h-[272px] min-w-0 relative">
                {isMounted ? (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0} initialDimension={{ width: 270, height: 270 }}>
                    <PieChart>
                      <Pie
                        data={allocationData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={90}
                        outerRadius={122}
                        strokeWidth={3}
                        stroke="#18181B"
                        startAngle={90}
                        endAngle={-270}
                        onMouseEnter={(_, index) => setHoveredSliceIndex(index)}
                        onMouseLeave={() => setHoveredSliceIndex(null)}
                        onClick={(_, index) => {
                          const item = allocationData[index]
                          if (item) toggleCategory(item.key)
                        }}
                      >
                        {allocationData.map((entry, index) => {
                          const isDimmed =
                            hoveredSliceIndex !== null && hoveredSliceIndex !== index
                          return (
                            <Cell
                              key={`cell-${index}`}
                              fill={entry.color}
                              opacity={isDimmed ? 0.35 : 1}
                              className="transition-opacity duration-200 cursor-pointer outline-none"
                            />
                          )
                        })}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                ) : null}

                {/* Center Content: Adaptive Amount & Category Label inside Donut Hole */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-4 text-center">
                  <span
                    className={cn(
                      amountFontSize,
                      "text-white tracking-tight font-mono truncate max-w-[155px] block transition-all"
                    )}
                  >
                    {centerAmount}
                  </span>
                  <span className="text-[11px] text-zinc-400 font-medium mt-1 truncate max-w-[155px] block">
                    {centerLabel}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            /* Treemap Diagram: Carrés imbriqués lisibles et proportionnels */
            <div className="relative w-full h-64 sm:h-72 my-auto p-1 bg-[#121215]/50 rounded-2xl border border-white/5 overflow-hidden">
              {treemapRectangles.map((rect) => {
                return (
                  <div
                    key={rect.key}
                    style={{
                      left: `${rect.x}%`,
                      top: `${rect.y}%`,
                      width: `${rect.w}%`,
                      height: `${rect.h}%`,
                    }}
                    className="absolute p-1 transition-all duration-300"
                  >
                    <div
                      onClick={() => toggleCategory(rect.key)}
                      title={`${rect.name} : ${formatAmount(rect.value)} (${rect.percentage}%)`}
                      className="w-full h-full rounded-xl border border-white/10 hover:border-white/30 transition-all p-2 sm:p-2.5 flex flex-col justify-between cursor-pointer select-none group relative overflow-hidden shadow-sm active:scale-[0.98]"
                      style={{
                        backgroundColor: `${rect.color}18`,
                      }}
                    >
                      {/* Subtle Glow Effect */}
                      <div
                        className="absolute -right-6 -bottom-6 w-20 h-20 rounded-full blur-xl pointer-events-none opacity-40 group-hover:opacity-75 transition-opacity"
                        style={{ backgroundColor: rect.color }}
                      />

                      {/* Header: Name + % */}
                      <div className="flex items-start justify-between gap-1 z-10">
                        <span className="font-semibold text-[11px] sm:text-xs text-white truncate max-w-[75%] leading-tight group-hover:text-zinc-100">
                          {rect.name}
                        </span>
                        <span className="font-mono text-[11px] sm:text-xs font-bold text-zinc-300 group-hover:text-white shrink-0">
                          {rect.percentage}%
                        </span>
                      </div>

                      {/* Footer: Amount & accounts count */}
                      <div className="z-10 mt-auto pt-1">
                        <span className="font-mono text-xs sm:text-sm font-extrabold text-white block truncate leading-tight">
                          {formatAmount(rect.value)}
                        </span>
                        {rect.h > 35 && (
                          <span className="text-[10px] text-zinc-400 block truncate mt-0.5">
                            {rect.accountsCount} {language === "fr" ? "compte(s)" : "account(s)"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Card>
      </div>

      {/* Bottom Section: Aperçu des Dépenses Récentes & Carte Interactive des Dépenses */}
      <div className="pt-2 space-y-6">
        {/* Recent Expenses Overview Card */}
        <Card className="p-6 bg-[#18181B] border-white/10 rounded-2xl">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                {language === "fr" ? "Aperçu des dépenses" : "Recent expenses"}
              </h2>
            </div>
            <Link href="/depenses">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-zinc-300 hover:text-white hover:bg-white/5 h-8 px-3 rounded-xl cursor-pointer"
              >
                <span>{language === "fr" ? "Voir tout" : "View all"}</span>
                <ChevronRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </Link>
          </div>

          <div className="divide-y divide-white/5">
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                {language === "fr"
                  ? "Aucune dépense récente enregistrée"
                  : "No recent expenses recorded"}
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const isPositive = tx.amount > 0
                const rawText = tx.rawLabel || (tx as any).raw_label || ""
                const dateStr = new Date(tx.date).toLocaleDateString(
                  language === "fr" ? "fr-FR" : "en-US",
                  { day: "numeric", month: "short" }
                )

                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between py-3 hover:bg-white/[0.02] px-2 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <MerchantAvatar
                        merchantName={tx.merchant}
                        rawLabel={rawText}
                        logoUrl={tx.logo_url}
                        category={tx.category}
                        isPositive={isPositive}
                        className="w-9 h-9 rounded-xl shrink-0"
                        iconClassName="w-4 h-4"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs sm:text-sm font-semibold text-white truncate">
                          {tx.merchant || rawText || (language === "fr" ? "Opération" : "Transaction")}
                        </span>
                        <span className="text-[11px] text-zinc-400 truncate">
                          {tx.category || (language === "fr" ? "Autre" : "Other")} • {dateStr}
                        </span>
                      </div>
                    </div>

                    <span
                      className={cn(
                        "text-xs sm:text-sm font-bold font-mono shrink-0 ml-3",
                        isPositive ? "text-emerald-400" : "text-white"
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {formatAmount(tx.amount)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </Card>

        {/* Interactive Expenses Map */}
        <ExpensesMap transactions={transactions} />
      </div>

      {/* Woob Bank Connection Sheet */}
      <WoobModal
        isOpen={isWoobOpen}
        onClose={() => setIsWoobOpen(false)}
        onBankConnected={loadData}
      />

      {/* Reconnect Credentials Modal */}
      {fixingConnection && (
        <ImportCredentialsModal
          isOpen={isFixModalOpen}
          onClose={() => {
            setIsFixModalOpen(false)
            setFixingConnection(null)
          }}
          pendingConnections={[fixingConnection]}
          onSuccess={loadData}
        />
      )}
    </div>
  )
}
