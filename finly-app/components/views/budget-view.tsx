"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  PieChart as PieIcon,
  Plus,
  Edit2,
  ChevronRight,
  ChevronLeft,
  Calendar,
  CalendarDays,
  History,
  ShoppingBag,
  Car,
  Home as HomeIcon,
  Film,
  Compass,
  HeartPulse,
  PiggyBank,
  Tag,
  SlidersHorizontal,
  X,
  Check,
  Building2,
  CreditCard,
  RefreshCw,
  Sparkles,
  ArrowLeftRight,
  Wallet,
  Layers,
  EyeOff,
  Eye,
  Trash2,
  AlertCircle,
  RotateCcw,
  FileText,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { useAuth } from "@/components/auth-context"
import { useI18n } from "@/components/i18n-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { BudgetPieChart } from "@/components/charts/budget-pie-chart"
import { CashflowSankeyChart } from "@/components/charts/cashflow-sankey-chart"
import { FinlyAPI } from "@/lib/api/finly-api"
import { BudgetSummary, BudgetItem, CategoryItem, Account } from "@/lib/types/finance"
import { getBrandLogoUrl } from "@/lib/utils/brand-logos"
import { downloadBudgetPdf } from "@/lib/export/budget-pdf-export"

type BudgetTxItem = BudgetItem["transactions"][number]

const getInitialMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function BudgetView() {
  const { user } = useAuth()
  const { formatAmount } = usePrivacy()
  const { t, language, format } = useI18n()

  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([])
  const [accountsList, setAccountsList] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all")
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isSetBudgetOpen, setIsSetBudgetOpen] = useState<boolean>(false)
  const [budgetFormCat, setBudgetFormCat] = useState<string>("")
  const [budgetFormLimit, setBudgetFormLimit] = useState<string>("")
  const [selectedCategoryModal, setSelectedCategoryModal] = useState<string | null>(null)
  const [isExcludedListModalOpen, setIsExcludedListModalOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Period / Time states
  const [periodMode, setPeriodMode] = useState<"month" | "last_30_days">("month")
  const [selectedMonth, setSelectedMonth] = useState<string>(getInitialMonth())

  const currentRealMonth = useMemo(() => getInitialMonth(), [])
  const isCurrentMonthActive = periodMode === "month" && selectedMonth === currentRealMonth

  // Transaction Edit states
  const [editingTx, setEditingTx] = useState<BudgetTxItem | null>(null)
  const [editCategory, setEditCategory] = useState<string>("")
  const [editSubcategory, setEditSubcategory] = useState<string>("")
  const [editIsExcluded, setEditIsExcluded] = useState<boolean>(false)
  const [applyToAllMerchant, setApplyToAllMerchant] = useState<boolean>(false)
  const [isSavingTx, setIsSavingTx] = useState<boolean>(false)
  const [txEditFeedback, setTxEditFeedback] = useState<string | null>(null)
  const [isExcludingTxId, setIsExcludingTxId] = useState<string | null>(null)

  const formatMonthName = useCallback((monthKey: string) => {
    if (monthKey === "last_30_days") return t.budgets.last30Days
    const [yearStr, monthStr] = monthKey.split("-")
    const m = parseInt(monthStr, 10) - 1
    const d = new Date(parseInt(yearStr, 10), m, 1)
    return d.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "long", year: "numeric" })
  }, [language, t.budgets.last30Days])

  const handlePrevMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split("-")
    let y = parseInt(yearStr, 10)
    let m = parseInt(monthStr, 10) - 1
    if (m < 1) {
      m = 12
      y -= 1
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`)
  }

  const handleNextMonth = () => {
    const [yearStr, monthStr] = selectedMonth.split("-")
    let y = parseInt(yearStr, 10)
    let m = parseInt(monthStr, 10) + 1
    if (m > 12) {
      m = 1
      y += 1
    }
    setSelectedMonth(`${y}-${String(m).padStart(2, "0")}`)
  }

  const handleResetCurrentMonth = () => {
    setPeriodMode("month")
    setSelectedMonth(currentRealMonth)
  }

  const depositAccounts = useMemo(() => {
    return accountsList.filter((a) => {
      const tStr = (a.type || "").toLowerCase()
      const name = (a.name || "").toLowerCase()
      if (["livret", "epargne", "épargne", "ldd", "lep", "pea", "assurance", "titre", "placement", "savings", "investment"].some((k) => tStr.includes(k) || name.includes(k))) {
        return false
      }
      return true
    })
  }, [accountsList])

  const loadBudgets = useCallback(async () => {
    setIsLoading(true)
    try {
      const activeParam = periodMode === "last_30_days" ? "last_30_days" : selectedMonth
      const [summary, cats, accsRes] = await Promise.all([
        FinlyAPI.getBudgets({
          month: activeParam,
          account_type: "checking",
          account_id: selectedAccountId !== "all" ? selectedAccountId : undefined,
          exclude_transfers: true,
        }),
        FinlyAPI.getCategories(),
        FinlyAPI.getAccounts().catch(() => ({ total_balance: 0, accounts: [] })),
      ])
      setBudgetSummary(summary)
      setCategoriesList(cats)
      setAccountsList(accsRes.accounts || [])
    } catch (err) {
      console.error("Error loading budgets:", err)
    } finally {
      setIsLoading(false)
    }
  }, [periodMode, selectedMonth, selectedAccountId])

  useEffect(() => {
    loadBudgets()
  }, [loadBudgets])

  const handleOpenSetBudget = (categoryName?: string, currentLimit?: number) => {
    setBudgetFormCat(categoryName || categoriesList[0]?.name || "Alimentation")
    setBudgetFormLimit(currentLimit ? currentLimit.toString() : "")
    setIsSetBudgetOpen(true)
  }

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!budgetFormCat) return

    setIsSubmitting(true)
    try {
      await FinlyAPI.setBudget({
        category: budgetFormCat,
        monthly_limit: parseFloat(budgetFormLimit) || 0,
      })
      await loadBudgets()
      setIsSetBudgetOpen(false)
    } catch (err) {
      console.error("Error saving budget:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteBudget = async (catName?: string | React.MouseEvent) => {
    const targetCat = typeof catName === "string" ? catName : budgetFormCat
    if (!targetCat) return

    setIsSubmitting(true)
    try {
      await FinlyAPI.deleteBudget(targetCat)
      await loadBudgets()
      setIsSetBudgetOpen(false)
    } catch (err) {
      console.error("Error deleting budget:", err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Toggle single transaction exclusion from budget
  const handleToggleExcludeTx = async (txId: string, currentExcludedState: boolean, e?: React.MouseEvent) => {
    if (e) e.stopPropagation()
    setIsExcludingTxId(txId)
    try {
      await FinlyAPI.toggleExcludeTransactionFromBudget(txId, !currentExcludedState)
      await loadBudgets()
    } catch (err) {
      console.error("Error toggling exclusion:", err)
    } finally {
      setIsExcludingTxId(null)
    }
  }

  const handleOpenEditTx = (tx: BudgetTxItem) => {
    setEditingTx(tx)
    setEditCategory(tx.category || "Divers")
    setEditSubcategory(tx.subcategory || "")
    setEditIsExcluded(Boolean(tx.is_excluded_from_budget))
    setApplyToAllMerchant(false)
    setTxEditFeedback(null)
  }

  const handleSaveTxCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTx || !editCategory) return

    setIsSavingTx(true)
    setTxEditFeedback(null)

    try {
      // 1. Update category & subcategory
      await FinlyAPI.updateTransactionCategory(editingTx.id, {
        category: editCategory,
        subcategory: editSubcategory.trim() || undefined,
        apply_to_all_merchant: applyToAllMerchant,
      })

      // 2. Update exclusion state if changed
      if (Boolean(editingTx.is_excluded_from_budget) !== editIsExcluded) {
        await FinlyAPI.toggleExcludeTransactionFromBudget(editingTx.id, editIsExcluded)
      }

      // 3. Reload budgets
      await loadBudgets()

      setTxEditFeedback(language === "fr" ? "Opération mise à jour avec succès." : "Operation updated successfully.")
      setTimeout(() => {
        setEditingTx(null)
        setTxEditFeedback(null)
      }, 700)
    } catch (err: any) {
      setTxEditFeedback(err.message || (language === "fr" ? "Erreur lors de la modification." : "Error modifying operation."))
    } finally {
      setIsSavingTx(false)
    }
  }

  const [isExportingPdf, setIsExportingPdf] = useState<boolean>(false)

  const handleExportPdf = async () => {
    if (!budgetSummary) return
    setIsExportingPdf(true)
    try {
      const activePeriodName = periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth)
      const selectedAccountObj = accountsList.find((a) => a.id === selectedAccountId)
      const activeAccountName = selectedAccountId === "all" ? (language === "fr" ? "Tous les comptes de dépôt" : "All checking accounts") : (selectedAccountObj?.name || selectedAccountObj?.bank || "Account")

      await downloadBudgetPdf({
        summary: budgetSummary,
        periodName: activePeriodName,
        accountName: activeAccountName,
        userName: user?.full_name || user?.email || (language === "fr" ? "Utilisateur Finly" : "Finly User"),
        currency: "EUR",
        language: language,
      })
    } catch (err) {
      console.error("Error generating budget PDF:", err)
    } finally {
      setIsExportingPdf(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Alimentation": return ShoppingBag
      case "Transports": return Car
      case "Logement": return HomeIcon
      case "Abonnements": return Film
      case "Loisirs & Sorties": return Compass
      case "Santé & Bien-être": return HeartPulse
      case "Virements & Épargne": return PiggyBank
      default: return Tag
    }
  }

  const items = budgetSummary?.items || []

  const viewTransactionsCat = useMemo(() => {
    if (!selectedCategoryModal || !budgetSummary) return null
    return budgetSummary.items.find((i) => i.category === selectedCategoryModal) || {
      category: selectedCategoryModal,
      monthly_limit: 0,
      spent: 0,
      remaining: 0,
      percentage: 0,
      transactions_count: 0,
      transactions: [],
    }
  }, [budgetSummary, selectedCategoryModal])

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items
    return items.filter((i) => i.category === selectedCategory)
  }, [items, selectedCategory])

  const totalBudget = budgetSummary?.total_budget || 0
  const totalSpent = budgetSummary?.total_spent || 0
  const remainingBudget = budgetSummary?.remaining_budget || 0
  const totalExcludedAmount = budgetSummary?.total_excluded_amount || 0
  const excludedTxCount = budgetSummary?.excluded_transactions_count || 0
  const globalPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0

  // All excluded transactions of the selected month
  const allMonthExcludedTransactions = useMemo(() => {
    const list: BudgetTxItem[] = []
    for (const item of items) {
      for (const tx of item.transactions) {
        if (tx.is_excluded_from_budget) {
          list.push(tx)
        }
      }
    }
    return list
  }, [items])

  // Subcategories available for currently selected category in edit modal
  const activeCategoryObj = categoriesList.find((c) => c.name === editCategory)
  const availableSubcategories = activeCategoryObj?.subcategories || []

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Top Header with Title and Period Navigation Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-white tracking-tight">{t.budgets.title}</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-zinc-400">
              {periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth)}
            </span>
            {depositAccounts.length > 1 && (
              <>
                <span className="text-zinc-600">•</span>
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-3.5 h-3.5 text-indigo-400" />
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="bg-zinc-900 text-zinc-200 border border-white/10 rounded-lg text-xs px-2 py-1 outline-none focus:border-indigo-500 cursor-pointer"
                  >
                    <option value="all">
                      {language === "fr" ? `Tous les comptes de dépôt (${depositAccounts.length})` : `All deposit accounts (${depositAccounts.length})`}
                    </option>
                    {depositAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.bank ? `${acc.bank} - ` : ""}{acc.name || t.accounts.depositAccount}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}
            {excludedTxCount > 0 && (
              <Badge variant="outline" className="border-amber-500/30 bg-amber-500/10 text-amber-300 text-[10px] py-0 px-2">
                {excludedTxCount} {language === "fr" ? `opération${excludedTxCount > 1 ? "s" : ""} exclue${excludedTxCount > 1 ? "s" : ""}` : `excluded transaction${excludedTxCount > 1 ? "s" : ""}`}
              </Badge>
            )}
          </div>
        </div>

        {/* Period Switcher & Actions Bar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Mode Segmented Toggle: Par Mois vs 30 jours */}
          <div className="flex items-center p-1 rounded-2xl bg-zinc-900 border border-white/10 text-xs">
            <button
              type="button"
              onClick={() => setPeriodMode("month")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                periodMode === "month"
                  ? "bg-indigo-600 text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.budgets.byMonth}
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("last_30_days")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                periodMode === "last_30_days"
                  ? "bg-indigo-600 text-white shadow-sm font-semibold"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {t.budgets.last30Days}
            </button>
          </div>

          {/* Month Selector Navigation (when in Month mode) */}
          {periodMode === "month" && (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 rounded-2xl p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                title={language === "fr" ? "Mois précédent" : "Previous month"}
                className="h-7 w-7 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>

              <span className="text-xs font-semibold text-white px-2 min-w-[110px] text-center">
                {formatMonthName(selectedMonth)}
              </span>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleNextMonth}
                title={language === "fr" ? "Mois suivant" : "Next month"}
                className="h-7 w-7 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>

              {!isCurrentMonthActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetCurrentMonth}
                  className="h-7 px-2 text-[11px] border-white/10 bg-zinc-800 text-indigo-300 hover:text-white rounded-xl cursor-pointer ml-1"
                >
                  {t.budgets.currentMonth}
                </Button>
              )}
            </div>
          )}

          <Button
            onClick={handleExportPdf}
            disabled={isExportingPdf || !budgetSummary}
            variant="outline"
            size="sm"
            className="bg-zinc-900 border-white/10 hover:bg-white/5 text-zinc-200 hover:text-white text-xs h-9 px-3.5 gap-1.5 rounded-2xl cursor-pointer"
            title={t.budgets.exportPdf}
          >
            <FileText className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isExportingPdf ? t.budgets.exportingPdf : t.budgets.exportPdf}</span>
          </Button>

          <Button
            onClick={() => handleOpenSetBudget()}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3.5 gap-1.5 rounded-2xl cursor-pointer shadow-md shadow-indigo-600/20 font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.budgets.defineBudget}</span>
          </Button>
        </div>
      </div>

      {/* Excluded Transactions Banner (Month by Month) */}
      {excludedTxCount > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in duration-200">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <EyeOff className="w-4 h-4" />
            </div>
            <span className="leading-relaxed">
              {format(t.budgets.excludedTransactionsBanner, {
                count: excludedTxCount,
                period: periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth),
                amount: formatAmount(totalExcludedAmount),
              })}
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsExcludedListModalOpen(true)}
            className="h-8 px-3 text-xs border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 rounded-xl cursor-pointer shrink-0 font-medium"
          >
            {t.budgets.manageExclusions}
          </Button>
        </div>
      )}

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-white/10 bg-[#18181B] flex flex-col justify-between rounded-3xl">
          <span className="text-xs text-zinc-400 font-medium">{t.budgets.configuredMonthlyBudget}</span>
          <p className="text-xl font-bold font-mono text-white mt-1">
            {formatAmount(totalBudget)}
          </p>
          <div className="mt-2 text-[11px] text-zinc-500">
            {items.filter((i) => i.monthly_limit > 0).length} {t.budgets.budgetedCategories}
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-[#18181B] flex flex-col justify-between rounded-3xl">
          <span className="text-xs text-zinc-400 font-medium">
            {periodMode === "last_30_days"
              ? `${t.budgets.spentInPeriod} (${t.budgets.last30Days})`
              : `${t.budgets.spentInPeriod} (${formatMonthName(selectedMonth)})`}
          </span>
          <p className="text-xl font-bold font-mono text-white mt-1">
            {formatAmount(totalSpent)}
          </p>
          <div className="mt-2 text-[11px] text-zinc-500 flex items-center justify-between">
            <span>{globalPercentage}% {t.budgets.budgetUsed}</span>
            {totalExcludedAmount > 0 && (
              <span className="text-amber-400 font-mono text-[10px]">
                (-{formatAmount(totalExcludedAmount)} {t.budgets.excludedFromBudget})
              </span>
            )}
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-[#18181B] flex flex-col justify-between rounded-3xl">
          <span className="text-xs text-zinc-400 font-medium">{t.budgets.remainingAvailable}</span>
          <p className={`text-xl font-bold font-mono mt-1 ${remainingBudget < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {formatAmount(remainingBudget)}
          </p>
          <div className="mt-2 text-[11px] text-zinc-500">
            {remainingBudget < 0 ? t.budgets.budgetExceeded : t.budgets.availableInPeriod}
          </div>
        </Card>
      </div>

      {/* Visual Chart & Categories Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Pie Chart Card */}
        <Card className="p-5 md:p-6 border-white/10 bg-[#18181B] flex flex-col gap-4 rounded-3xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-indigo-400" />
              <CardTitle className="text-sm font-semibold text-white">
                {t.budgets.spendingBreakdown}
              </CardTitle>
            </div>
            <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-400 text-[10px]">
              {periodMode === "last_30_days" ? "30d" : selectedMonth}
            </Badge>
          </div>

          <BudgetPieChart
            data={items}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />
        </Card>

        {/* Category Budget Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredItems.map((item) => {
            const CatIcon = getCategoryIcon(item.category)
            const hasLimit = item.monthly_limit > 0
            const isExceeded = hasLimit && item.spent > item.monthly_limit
            const isNearLimit = hasLimit && item.percentage >= 80 && !isExceeded
            const activeTxCount = item.transactions.filter((t) => !t.is_excluded_from_budget).length
            const excludedCount = item.transactions.filter((t) => t.is_excluded_from_budget).length

            return (
              <Card
                key={item.category}
                className={`p-4 border-white/10 bg-[#18181B] flex flex-col justify-between gap-3 transition-all rounded-3xl ${
                  selectedCategory === item.category ? "ring-2 ring-indigo-500" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-indigo-400">
                      <CatIcon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-white">{t.categories[item.category] || item.category}</span>
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
                        <span>{activeTxCount} {language === "fr" ? `opération${activeTxCount > 1 ? "s" : ""}` : `operation${activeTxCount > 1 ? "s" : ""}`}</span>
                        {excludedCount > 0 && (
                          <span className="text-amber-400 text-[10px]">({excludedCount} {language === "fr" ? "exclue(s)" : "excluded"})</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-xs font-bold font-mono text-white">
                      {formatAmount(item.spent)}
                    </span>
                    {hasLimit && (
                      <span className="text-[10px] text-zinc-500 font-mono">
                        / {formatAmount(item.monthly_limit)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar & Status */}
                {hasLimit ? (
                  <div className="flex flex-col gap-1.5 pt-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span
                        className={`font-semibold ${
                          isExceeded
                            ? "text-rose-400"
                            : isNearLimit
                            ? "text-amber-400"
                            : "text-emerald-400"
                        }`}
                      >
                        {item.percentage}%
                      </span>
                      <span className="text-zinc-500 font-mono text-[10px]">
                        {isExceeded
                          ? `${language === "fr" ? "Dépassé de" : "Exceeded by"} ${formatAmount(Math.abs(item.remaining))}`
                          : `${language === "fr" ? "Reste" : "Remaining"} ${formatAmount(item.remaining)}`}
                      </span>
                    </div>
                    <Progress
                      value={Math.min(100, item.percentage)}
                      className={`h-2 bg-zinc-900 ${
                        isExceeded
                          ? "[&>div]:bg-rose-500"
                          : isNearLimit
                          ? "[&>div]:bg-amber-500"
                          : "[&>div]:bg-emerald-500"
                      }`}
                    />
                  </div>
                ) : (
                  <div className="pt-1">
                    <span className="text-[11px] text-zinc-500 italic">
                      {t.budgets.defineMonthlyBudgetPrompt}
                    </span>
                  </div>
                )}

                {/* Bottom Actions: View Transactions & Edit Limit */}
                <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryModal(item.category)}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>{t.budgets.viewTransactions}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenSetBudget(item.category, item.monthly_limit)}
                    className="h-7 px-2 text-zinc-400 hover:text-white gap-1 text-xs cursor-pointer rounded-xl"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{hasLimit ? t.budgets.adjust : t.budgets.define}</span>
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Cashflow Sankey Diagram (Incomes -> Hub -> Categories -> Subcategories & Savings) */}
      <CashflowSankeyChart
        budgetSummary={budgetSummary}
        selectedMonth={selectedMonth}
        periodMode={periodMode}
        formatMonthName={formatMonthName}
      />

      {/* Set / Edit Budget Dialog */}
      <Dialog open={isSetBudgetOpen} onOpenChange={setIsSetBudgetOpen}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              {t.budgets.configureMonthlyBudget}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">{t.budgets.category}</label>
              <select
                value={budgetFormCat}
                onChange={(e) => {
                  setBudgetFormCat(e.target.value)
                  const existingItem = items.find((i) => i.category === e.target.value)
                  if (existingItem) {
                    setBudgetFormLimit(existingItem.monthly_limit > 0 ? existingItem.monthly_limit.toString() : "")
                  }
                }}
                className="bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none cursor-pointer"
              >
                {categoriesList.map((cat, idx) => (
                  <option key={cat.id || cat.name || `budget-cat-${idx}`} value={cat.name} className="bg-zinc-950 text-white">
                    {t.categories[cat.name] || cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                {t.budgets.monthlyLimit}
              </label>
              <Input
                type="number"
                step="10"
                min="0"
                required
                placeholder="Ex: 500"
                value={budgetFormLimit}
                onChange={(e) => setBudgetFormLimit(e.target.value)}
                className="bg-zinc-950 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 rounded-xl font-medium cursor-pointer shadow-lg shadow-indigo-600/20"
              >
                {t.budgets.saveBudget}
              </Button>
              {items.some((i) => i.category === budgetFormCat && i.monthly_limit > 0) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleDeleteBudget}
                  disabled={isSubmitting}
                  className="border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 text-xs h-10 rounded-xl cursor-pointer"
                >
                  {t.budgets.eraseBudget}
                </Button>
              )}
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Transactions List Dialog */}
      <Dialog open={Boolean(selectedCategoryModal)} onOpenChange={(open) => { if (!open) setSelectedCategoryModal(null) }}>
        <DialogContent className="max-w-xl p-6 bg-[#18181B] border-white/10 text-white rounded-3xl max-h-[85vh] overflow-y-auto">
          {viewTransactionsCat && (
            <div className="flex flex-col gap-4">
              <DialogHeader className="p-0 text-left">
                <div className="flex justify-between items-start pr-6">
                  <div>
                    <DialogTitle className="text-base font-bold text-white">
                      {t.budgets.categoryOperations} : {t.categories[viewTransactionsCat.category] || viewTransactionsCat.category}
                    </DialogTitle>
                    <span className="text-xs text-zinc-400">
                      {viewTransactionsCat.transactions.length} {language === "fr" ? `opération${viewTransactionsCat.transactions.length > 1 ? "s" : ""}` : `operation${viewTransactionsCat.transactions.length > 1 ? "s" : ""}`} ({periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth)})
                    </span>
                  </div>

                  <div className="flex flex-col items-end">
                    <span className="text-base font-bold font-mono text-white">
                      {formatAmount(viewTransactionsCat.spent)}
                    </span>
                    {viewTransactionsCat.transactions.some((t) => t.is_excluded_from_budget) && (
                      <span className="text-[10px] text-amber-400 font-mono">
                        ({language === "fr" ? "hors opérations exclues" : "excluding excluded transactions"})
                      </span>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <div className="flex flex-col divide-y divide-white/5 border border-white/5 rounded-2xl bg-zinc-950/60 overflow-hidden">
                {viewTransactionsCat.transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    {t.budgets.noOperationsForCategory}
                  </div>
                ) : (
                  viewTransactionsCat.transactions.map((tx) => {
                    const brandLogo = getBrandLogoUrl(tx.merchant, tx.raw_label)
                    const isExcluded = Boolean(tx.is_excluded_from_budget)
                    const isExcluding = isExcludingTxId === tx.id

                    return (
                      <div
                        key={tx.id}
                        className={`p-3 flex justify-between items-center transition-colors group ${
                          isExcluded
                            ? "bg-zinc-950/30 opacity-60 hover:opacity-90"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div
                          onClick={() => handleOpenEditTx(tx)}
                          className="flex items-center gap-3 min-w-0 pr-2 cursor-pointer flex-1"
                        >
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                            {brandLogo ? (
                              /* eslint-disable-next-line @next/next/no-img-element */
                              <img
                                src={brandLogo}
                                alt=""
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = "none"
                                }}
                              />
                            ) : (
                              <CreditCard className="w-4 h-4 text-zinc-400" />
                            )}
                          </div>

                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-semibold group-hover:text-indigo-300 transition-colors truncate ${
                                isExcluded ? "line-through text-zinc-400" : "text-white"
                              }`}>
                                {tx.merchant}
                              </span>
                              {isExcluded && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-amber-500/30 bg-amber-500/10 text-amber-300">
                                  {language === "fr" ? "Exclue du budget" : "Excluded from budget"}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-zinc-400">{tx.date}</span>
                              {tx.subcategory && (
                                <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-white/10 text-zinc-400">
                                  {tx.subcategory}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Amount & Exclusion Action */}
                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className={`text-xs font-bold font-mono ${
                            isExcluded ? "line-through text-zinc-500" : "text-white"
                          }`}>
                            -{formatAmount(Math.abs(tx.amount))}
                          </span>

                          {/* Quick Toggle Exclude Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={isExcluding}
                            onClick={(e) => handleToggleExcludeTx(tx.id, isExcluded, e)}
                            title={isExcluded ? t.budgets.restoreToBudget : t.budgets.excludeFromBudget}
                            className={`h-7 px-2 text-xs gap-1 rounded-xl cursor-pointer ${
                              isExcluded
                                ? "bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300"
                                : "text-zinc-400 hover:text-amber-300 hover:bg-amber-500/10"
                            }`}
                          >
                            {isExcluding ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : isExcluded ? (
                              <>
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-[11px]">{t.budgets.restoreToBudget}</span>
                              </>
                            ) : (
                              <>
                                <EyeOff className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline text-[11px]">{t.budgets.excludeFromBudget}</span>
                              </>
                            )}
                          </Button>

                          {/* Edit Category Button */}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditTx(tx)}
                            title={t.transactions.categorization}
                            className="h-7 w-7 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl cursor-pointer"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setSelectedCategoryModal(null)}
                  className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-9 rounded-xl cursor-pointer"
                >
                  {t.common.close}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Month Excluded Transactions Manager Modal */}
      <Dialog open={isExcludedListModalOpen} onOpenChange={setIsExcludedListModalOpen}>
        <DialogContent className="max-w-xl p-6 bg-[#18181B] border-white/10 text-white rounded-3xl max-h-[85vh] overflow-y-auto">
          <div className="flex flex-col gap-4">
            <DialogHeader className="p-0 text-left">
              <div className="flex justify-between items-start pr-6">
                <div>
                  <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                    <EyeOff className="w-4 h-4 text-amber-400" />
                    {t.budgets.excludedListTitle}
                  </DialogTitle>
                  <span className="text-xs text-zinc-400">
                    {periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth)} • {allMonthExcludedTransactions.length} {language === "fr" ? `opération${allMonthExcludedTransactions.length > 1 ? "s" : ""}` : `transaction${allMonthExcludedTransactions.length > 1 ? "s" : ""}`}
                  </span>
                </div>

                <span className="text-base font-bold font-mono text-amber-300">
                  {formatAmount(totalExcludedAmount)}
                </span>
              </div>
            </DialogHeader>

            <div className="flex flex-col divide-y divide-white/5 border border-white/5 rounded-2xl bg-zinc-950/60 overflow-hidden">
              {allMonthExcludedTransactions.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-500">
                  {t.budgets.noExcludedTransactions}
                </div>
              ) : (
                allMonthExcludedTransactions.map((tx) => {
                  const brandLogo = getBrandLogoUrl(tx.merchant, tx.raw_label)
                  const isExcluding = isExcludingTxId === tx.id

                  return (
                    <div
                      key={tx.id}
                      className="p-3 flex justify-between items-center hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 pr-2">
                        <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                          {brandLogo ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={brandLogo}
                              alt=""
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none"
                              }}
                            />
                          ) : (
                            <CreditCard className="w-4 h-4 text-zinc-400" />
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-semibold text-white truncate">
                            {tx.merchant}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-zinc-400">{tx.date}</span>
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-white/10 text-zinc-400">
                              {tx.category}
                            </Badge>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-xs font-bold font-mono text-zinc-400 line-through">
                          -{formatAmount(Math.abs(tx.amount))}
                        </span>

                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isExcluding}
                          onClick={() => handleToggleExcludeTx(tx.id, true)}
                          className="h-7 px-2.5 text-xs border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 rounded-xl cursor-pointer gap-1"
                        >
                          {isExcluding ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <>
                              <RotateCcw className="w-3 h-3" />
                              <span>{t.budgets.restoreToBudget}</span>
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setIsExcludedListModalOpen(false)}
                className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-9 rounded-xl cursor-pointer"
              >
                {t.common.close}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Single Transaction Edit Dialog (Category, Subcategory, Exclusion) */}
      <Dialog open={Boolean(editingTx)} onOpenChange={(open) => { if (!open) { setEditingTx(null); setTxEditFeedback(null) } }}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          {editingTx && (
            <form onSubmit={handleSaveTxCategory} className="flex flex-col gap-4">
              <DialogHeader className="p-0 text-left">
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-400" />
                  {t.transactions.transactionDetails}
                </DialogTitle>
              </DialogHeader>

              {/* Transaction Summary Preview */}
              <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between">
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="text-xs font-bold text-white truncate">
                    {editingTx.merchant}
                  </span>
                  <span className="text-[10px] text-zinc-400 mt-0.5">
                    {editingTx.date}
                  </span>
                </div>
                <span className="text-sm font-bold font-mono text-rose-400 shrink-0">
                  -{formatAmount(Math.abs(editingTx.amount))}
                </span>
              </div>

              {txEditFeedback && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{txEditFeedback}</span>
                </div>
              )}

              {/* Exclusion from Budget Checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-zinc-950/70 border border-amber-500/20 cursor-pointer">
                <input
                  type="checkbox"
                  checked={editIsExcluded}
                  onChange={(e) => setEditIsExcluded(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-amber-500 focus:ring-0 cursor-pointer"
                />
                <div className="flex flex-col text-[11px] leading-relaxed">
                  <span className="font-semibold text-amber-300 flex items-center gap-1">
                    <EyeOff className="w-3.5 h-3.5" />
                    {t.budgets.excludeFromBudget}
                  </span>
                  <span className="text-zinc-400 mt-0.5">
                    {language === "fr" ? "Cette dépense ponctuelle ne sera pas comptabilisée dans votre budget de ce mois." : "This one-time expense will not count toward this month's budget."}
                  </span>
                </div>
              </label>

              {/* Category Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {t.transactions.mainCategory}
                </label>
                <select
                  value={editCategory}
                  onChange={(e) => {
                    setEditCategory(e.target.value)
                    setEditSubcategory("")
                  }}
                  className="bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none cursor-pointer"
                >
                  {categoriesList.map((cat, idx) => (
                    <option key={cat.id || cat.name || `edit-cat-${idx}`} value={cat.name} className="bg-zinc-950 text-white">
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Subcategory Input / Select */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  {t.transactions.subcategoryOptional}
                </label>
                {availableSubcategories.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <select
                      value={editSubcategory}
                      onChange={(e) => setEditSubcategory(e.target.value)}
                      className="bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="">{language === "fr" ? "Aucune sous-catégorie" : "No subcategory"}</option>
                      {availableSubcategories.map((sub, idx) => (
                        <option key={`sub-${sub}-${idx}`} value={sub}>
                          {sub}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <Input
                    type="text"
                    placeholder="Ex: Supermarket, Restaurant, Train..."
                    value={editSubcategory}
                    onChange={(e) => setEditSubcategory(e.target.value)}
                    className="bg-zinc-950 border-white/10 text-white text-xs h-10 rounded-xl"
                  />
                )}
              </div>

              {/* Auto rule checkbox */}
              <label className="flex items-start gap-2.5 p-3 rounded-2xl bg-zinc-950/50 border border-white/5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyToAllMerchant}
                  onChange={(e) => setApplyToAllMerchant(e.target.checked)}
                  className="mt-0.5 rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-[11px] text-zinc-300 leading-relaxed">
                  {t.transactions.rememberMerchantPreference} <strong className="text-white">{editingTx.merchant}</strong>
                </span>
              </label>

              <div className="flex gap-2 pt-2">
                <Button
                  type="submit"
                  disabled={isSavingTx}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 rounded-xl font-semibold cursor-pointer shadow-md shadow-indigo-600/30 gap-1.5"
                >
                  {isSavingTx ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.common.loading}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{t.common.save}</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingTx(null)}
                  className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 rounded-xl cursor-pointer"
                >
                  {t.common.cancel}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
