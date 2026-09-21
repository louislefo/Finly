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
import { cn } from "@/lib/utils"

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
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto -mt-1 sm:-mt-2 pb-24 md:pb-8">
      {/* Top Controls Bar without page title text */}
      <div className="flex flex-col gap-2.5 sm:gap-3 w-full">
        {/* Main controls row */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 w-full">
          {/* Left: Mode Toggle (Par mois / 30 derniers) + Month Selector */}
          <div className="flex items-center gap-2 sm:gap-2.5 w-full sm:w-auto">
            {/* Mode Segmented Toggle */}
            <div className="flex items-center p-0.5 sm:p-1 rounded-xl bg-[#18181B] border border-white/10 text-xs select-none shrink-0">
              <button
                type="button"
                onClick={() => setPeriodMode("month")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                  periodMode === "month"
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {t.budgets.byMonth}
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("last_30_days")}
                className={`px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all cursor-pointer ${
                  periodMode === "last_30_days"
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <span className="sm:hidden">30 j</span>
                <span className="hidden sm:inline">{t.budgets.last30Days}</span>
              </button>
            </div>

            {/* Month Selector Navigation (when in Month mode) */}
            {periodMode === "month" && (
              <div className="flex items-center justify-between gap-0.5 sm:gap-1 bg-[#18181B] border border-white/10 rounded-xl p-0.5 sm:p-1 flex-1 sm:flex-initial min-w-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrevMonth}
                  title={language === "fr" ? "Mois précédent" : "Previous month"}
                  className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>

                <span className="text-[11px] sm:text-xs font-semibold text-white px-1 sm:px-2 min-w-0 truncate text-center capitalize">
                  {formatMonthName(selectedMonth)}
                </span>

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNextMonth}
                  title={language === "fr" ? "Mois suivant" : "Next month"}
                  className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer shrink-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>

                {!isCurrentMonthActive && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleResetCurrentMonth}
                    className="h-6 sm:h-7 px-1.5 sm:px-2 text-[10px] sm:text-[11px] border-white/10 bg-white/5 text-zinc-300 hover:text-white rounded-lg cursor-pointer ml-0.5 shrink-0"
                  >
                    {t.budgets.currentMonth}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Right: Actions Bar (Kept identical: Export PDF & Define Budget) */}
          <div className="flex items-center justify-end gap-2 w-full sm:w-auto shrink-0">
            {excludedTxCount > 0 && (
              <button
                type="button"
                onClick={() => setIsExcludedListModalOpen(true)}
                className="text-amber-400 hover:text-amber-300 text-[11px] sm:text-xs px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-xl border border-amber-500/20 bg-amber-500/10 cursor-pointer font-medium transition-colors"
              >
                {excludedTxCount} {language === "fr" ? "exclue(s)" : "excluded"}
              </button>
            )}

            <Button
              onClick={handleExportPdf}
              disabled={isExportingPdf || !budgetSummary}
              variant="outline"
              size="sm"
              className="bg-[#18181B] border-white/10 hover:bg-white/5 text-zinc-200 hover:text-white text-xs h-8 sm:h-9 px-2.5 sm:px-3 gap-1.5 rounded-xl cursor-pointer"
              title={t.budgets.exportPdf}
            >
              <FileText className="w-3.5 h-3.5 text-zinc-400" />
              <span className="hidden sm:inline">{isExportingPdf ? t.budgets.exportingPdf : t.budgets.exportPdf}</span>
            </Button>

            <Button
              onClick={() => handleOpenSetBudget()}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-8 sm:h-9 px-3 sm:px-3.5 gap-1.5 rounded-xl cursor-pointer shadow-md shadow-indigo-600/20 font-semibold"
            >
              <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span>{t.budgets.defineBudget}</span>
            </Button>
          </div>
        </div>

        {/* Account Filter (Discreet, full-width on mobile if accounts exist) */}
        {depositAccounts.length > 1 && (
          <div className="flex items-center bg-[#18181B] border border-white/10 rounded-xl px-2.5 py-1 text-xs w-full sm:w-fit self-start">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="bg-transparent text-zinc-300 outline-none cursor-pointer text-xs w-full sm:w-auto"
            >
              <option value="all" className="bg-[#18181B] text-white">
                {language === "fr" ? `Tous les comptes (${depositAccounts.length})` : `All accounts (${depositAccounts.length})`}
              </option>
              {depositAccounts.map((acc) => (
                <option key={acc.id} value={acc.id} className="bg-[#18181B] text-white">
                  {acc.bank ? `${acc.bank} - ` : ""}{acc.name || t.accounts.depositAccount}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Main Content: Big Stylish Pie (Left) & Minimalist Category List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch min-w-0">
        {/* Left Column: Big Stylish Pie + Key figures */}
        <Card className="lg:col-span-5 p-6 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between min-w-0 h-full">
          <div className="flex items-center justify-between pb-2">
            <span className="text-sm font-semibold text-white">
              {t.budgets.spendingBreakdown}
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              {periodMode === "last_30_days" ? t.budgets.last30Days : formatMonthName(selectedMonth)}
            </span>
          </div>

          {/* Large Stylish Pie Chart */}
          <BudgetPieChart
            data={items}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
          />

          {/* Minimal 3-part KPI metrics strip */}
          <div className="grid grid-cols-3 gap-1.5 sm:gap-2 pt-4 mt-2 border-t border-white/5 text-center">
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] text-zinc-400 block font-medium truncate">
                {t.budgets.configuredMonthlyBudget}
              </span>
              <span className="text-sm sm:text-lg font-bold font-mono text-white mt-0.5 block truncate">
                {formatAmount(totalBudget)}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] text-zinc-400 block font-medium truncate">
                {t.budgets.spentInPeriod}
              </span>
              <span className="text-sm sm:text-lg font-bold font-mono text-white mt-0.5 block truncate">
                {formatAmount(totalSpent)}
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] text-zinc-400 block font-medium truncate">
                {t.budgets.remainingAvailable}
              </span>
              <span
                className={`text-sm sm:text-lg font-bold font-mono mt-0.5 block truncate ${
                  remainingBudget < 0 ? "text-rose-400" : "text-emerald-400"
                }`}
              >
                {formatAmount(remainingBudget)}
              </span>
            </div>
          </div>
        </Card>

        {/* Right Column: Minimalist Category Budget List (Spacious & Aligned) */}
        <Card className="lg:col-span-7 p-6 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between min-w-0 h-full">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-white/5">
              <span className="text-sm font-semibold text-white">
                {language === "fr" ? "Budgets par catégorie" : "Category budgets"}
              </span>

              {selectedCategory && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  {language === "fr" ? "Afficher tout" : "Show all"}
                </button>
              )}
            </div>

            {/* Minimalist Categories List with generous vertical breathing room */}
            <div className="flex flex-col divide-y divide-white/5">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-zinc-500">
                  {language === "fr" ? "Aucune dépense enregistrée" : "No expenses recorded"}
                </div>
              ) : (
                filteredItems.map((item) => {
                  const hasLimit = item.monthly_limit > 0
                  const isExceeded = hasLimit && item.spent > item.monthly_limit
                  const isNearLimit = hasLimit && item.percentage >= 80 && !isExceeded
                  const activeTxCount = item.transactions.filter((t) => !t.is_excluded_from_budget).length

                  return (
                    <div
                      key={item.category}
                      onClick={() => {
                        if (hasLimit) {
                          setSelectedCategoryModal(item.category)
                        } else {
                          handleOpenSetBudget(item.category, item.monthly_limit)
                        }
                      }}
                      className="py-4 sm:py-5 px-3 hover:bg-white/[0.03] rounded-xl transition-colors cursor-pointer group flex flex-col gap-2.5 select-none"
                    >
                      {/* Top Row: Category name + Count on left, Amounts & % on right */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                            {t.categories[item.category] || item.category}
                          </span>
                          <span className="text-[11px] text-zinc-500 font-medium shrink-0">
                            {activeTxCount} {language === "fr" ? "op." : "tx"}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <div className="text-right">
                            <span className="text-sm font-bold font-mono text-white">
                              {formatAmount(item.spent)}
                            </span>
                            {hasLimit && (
                              <span className="text-[11px] text-zinc-500 font-mono ml-1.5">
                                / {formatAmount(item.monthly_limit)}
                              </span>
                            )}
                          </div>

                          {hasLimit ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenSetBudget(item.category, item.monthly_limit)
                              }}
                              title={language === "fr" ? "Ajuster le plafond" : "Adjust limit"}
                              className={`text-xs font-bold font-mono min-w-[42px] text-right hover:underline cursor-pointer ${
                                isExceeded
                                  ? "text-rose-400"
                                  : isNearLimit
                                  ? "text-amber-400"
                                  : "text-emerald-400"
                              }`}
                            >
                              {item.percentage}%
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenSetBudget(item.category, item.monthly_limit)
                              }}
                              className="text-xs text-indigo-400 hover:text-indigo-300 font-semibold px-3 py-1.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all cursor-pointer shadow-sm"
                            >
                              + {t.budgets.define}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bottom Row: Minimal progress line */}
                      {hasLimit && (
                        <div className="w-full bg-white/5 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-300 ${
                              isExceeded
                                ? "bg-rose-500"
                                : isNearLimit
                                ? "bg-amber-500"
                                : "bg-emerald-500"
                            }`}
                            style={{ width: `${Math.min(100, item.percentage)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Cashflow Sankey Diagram (Incomes -> Hub -> Categories -> Subcategories & Savings) */}
      <CashflowSankeyChart
        budgetSummary={budgetSummary}
        selectedMonth={selectedMonth}
        periodMode={periodMode}
        formatMonthName={formatMonthName}
      />

      {/* Set / Edit Budget Dialog (Ultra-Minimalist & Modern) */}
      <Dialog open={isSetBudgetOpen} onOpenChange={setIsSetBudgetOpen}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border border-white/10 text-white rounded-3xl shadow-2xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-white tracking-tight">
              {t.categories[budgetFormCat] || budgetFormCat || t.budgets.configureMonthlyBudget}
            </DialogTitle>
            <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
              <span>{language === "fr" ? "Dépenses actuelles du mois :" : "Actual month spending:"}</span>
              <span className="font-mono font-bold text-white">
                {formatAmount(items.find((i) => i.category === budgetFormCat)?.spent || 0)}
              </span>
            </div>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="flex flex-col gap-4 mt-2">
            {/* Category selection */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">
                {t.budgets.category}
              </label>
              <select
                value={budgetFormCat}
                onChange={(e) => {
                  setBudgetFormCat(e.target.value)
                  const existingItem = items.find((i) => i.category === e.target.value)
                  setBudgetFormLimit(
                    existingItem && existingItem.monthly_limit > 0
                      ? existingItem.monthly_limit.toString()
                      : ""
                  )
                }}
                className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none cursor-pointer focus:border-white/20 transition-colors"
              >
                {categoriesList.map((cat, idx) => (
                  <option key={cat.id || cat.name || `budget-cat-${idx}`} value={cat.name} className="bg-[#18181B] text-white">
                    {t.categories[cat.name] || cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Big Sleek Numeric Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">
                {t.budgets.monthlyLimit}
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  step="10"
                  min="0"
                  autoFocus
                  required
                  placeholder="0"
                  value={budgetFormLimit}
                  onChange={(e) => setBudgetFormLimit(e.target.value)}
                  className="w-full bg-zinc-900/90 border border-white/10 focus:border-indigo-500/50 rounded-2xl py-3.5 px-4 pr-10 text-2xl font-extrabold font-mono text-white placeholder-zinc-700 outline-none transition-all shadow-inner"
                />
                <span className="absolute right-4 text-base font-bold font-mono text-zinc-500 pointer-events-none">
                  €
                </span>
              </div>
            </div>

            {/* Quick Preset Shortcut Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] text-zinc-500 font-medium mr-1">Suggestions :</span>
              {[100, 250, 500, 800, 1200].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setBudgetFormLimit(preset.toString())}
                  className={cn(
                    "text-[11px] font-mono px-2.5 py-1 rounded-lg border transition-all cursor-pointer",
                    budgetFormLimit === preset.toString()
                      ? "bg-white text-zinc-950 border-white font-bold"
                      : "bg-white/5 border-white/10 text-zinc-300 hover:text-white hover:bg-white/10"
                  )}
                >
                  {preset} €
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-white hover:bg-zinc-200 text-zinc-950 text-xs h-10 rounded-xl font-bold cursor-pointer shadow-md transition-all"
              >
                {t.budgets.saveBudget}
              </Button>

              {items.some((i) => i.category === budgetFormCat && i.monthly_limit > 0) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleDeleteBudget}
                  disabled={isSubmitting}
                  className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 text-xs h-10 px-3 rounded-xl cursor-pointer"
                >
                  {t.budgets.eraseBudget}
                </Button>
              )}

              <Button
                type="button"
                variant="ghost"
                onClick={() => setIsSetBudgetOpen(false)}
                className="text-zinc-400 hover:text-white hover:bg-white/5 text-xs h-10 px-3 rounded-xl cursor-pointer"
              >
                {t.common.cancel}
              </Button>
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
