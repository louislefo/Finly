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
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
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
import { FinlyAPI } from "@/lib/api/finly-api"
import { BudgetSummary, BudgetItem, CategoryItem } from "@/lib/types/finance"
import { getBrandLogoUrl } from "@/lib/utils/brand-logos"

type BudgetTxItem = BudgetItem["transactions"][number]

const getInitialMonth = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function BudgetView() {
  const { formatAmount } = usePrivacy()
  const [budgetSummary, setBudgetSummary] = useState<BudgetSummary | null>(null)
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [isSetBudgetOpen, setIsSetBudgetOpen] = useState<boolean>(false)
  const [budgetFormCat, setBudgetFormCat] = useState<string>("")
  const [budgetFormLimit, setBudgetFormLimit] = useState<string>("")
  const [viewTransactionsCat, setViewTransactionsCat] = useState<BudgetItem | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  // Period / Time states
  const [periodMode, setPeriodMode] = useState<"month" | "last_30_days">("month")
  const [selectedMonth, setSelectedMonth] = useState<string>(getInitialMonth())

  // Account Scope & Transfer filter states
  const [accountScope, setAccountScope] = useState<"checking" | "all">("checking")
  const [excludeTransfers, setExcludeTransfers] = useState<boolean>(true)

  const currentRealMonth = useMemo(() => getInitialMonth(), [])

  // Transaction Edit states
  const [editingTx, setEditingTx] = useState<BudgetTxItem | null>(null)
  const [editCategory, setEditCategory] = useState<string>("")
  const [editSubcategory, setEditSubcategory] = useState<string>("")
  const [applyToAllMerchant, setApplyToAllMerchant] = useState<boolean>(false)
  const [isSavingTx, setIsSavingTx] = useState<boolean>(false)
  const [txEditFeedback, setTxEditFeedback] = useState<string | null>(null)

  const formatMonthName = useCallback((monthKey: string) => {
    if (monthKey === "last_30_days") return "30 derniers jours"
    const [yearStr, monthStr] = monthKey.split("-")
    const m = parseInt(monthStr, 10) - 1
    const monthNames = [
      "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
      "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"
    ]
    return `${monthNames[m] || monthStr} ${yearStr}`
  }, [])

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

  const isCurrentMonthActive = periodMode === "month" && selectedMonth === currentRealMonth

  const loadBudgets = useCallback(async () => {
    setIsLoading(true)
    try {
      const activeParam = periodMode === "last_30_days" ? "last_30_days" : selectedMonth
      const [summary, cats] = await Promise.all([
        FinlyAPI.getBudgets({
          month: activeParam,
          account_type: accountScope,
          exclude_transfers: excludeTransfers,
        }),
        FinlyAPI.getCategories(),
      ])
      setBudgetSummary(summary)
      setCategoriesList(cats)
    } finally {
      setIsLoading(false)
    }
  }, [periodMode, selectedMonth, accountScope, excludeTransfers])

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
    if (!budgetFormCat || !budgetFormLimit) return

    try {
      await FinlyAPI.setBudget({
        category: budgetFormCat,
        monthly_limit: parseFloat(budgetFormLimit) || 0,
      })
      await loadBudgets()
      setIsSetBudgetOpen(false)
    } catch (err) {
      console.error("Erreur enregistrement budget:", err)
    }
  }

  const handleOpenEditTx = (tx: BudgetTxItem) => {
    setEditingTx(tx)
    setEditCategory(tx.category || "Divers")
    setEditSubcategory(tx.subcategory || "")
    setApplyToAllMerchant(false)
    setTxEditFeedback(null)
  }

  const handleSaveTxCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingTx || !editCategory) return

    setIsSavingTx(true)
    setTxEditFeedback(null)

    try {
      await FinlyAPI.updateTransactionCategory(editingTx.id, {
        category: editCategory,
        subcategory: editSubcategory.trim() || undefined,
        apply_to_all_merchant: applyToAllMerchant,
      })

      // Refresh budgets immediately
      await loadBudgets()

      // Update current modal transactions list
      if (viewTransactionsCat) {
        if (editCategory === viewTransactionsCat.category) {
          setViewTransactionsCat({
            ...viewTransactionsCat,
            transactions: viewTransactionsCat.transactions.map((t) =>
              t.id === editingTx.id
                ? { ...t, category: editCategory, subcategory: editSubcategory.trim() || undefined }
                : t
            ),
          })
        } else {
          setViewTransactionsCat({
            ...viewTransactionsCat,
            spent: viewTransactionsCat.spent - Math.abs(editingTx.amount),
            transactions: viewTransactionsCat.transactions.filter((t) => t.id !== editingTx.id),
          })
        }
      }

      setTxEditFeedback("Catégorie mise à jour avec succès.")
      setTimeout(() => {
        setEditingTx(null)
        setTxEditFeedback(null)
      }, 700)
    } catch (err: any) {
      setTxEditFeedback(err.message || "Erreur lors de la modification.")
    } finally {
      setIsSavingTx(false)
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

  const filteredItems = useMemo(() => {
    if (!selectedCategory) return items
    return items.filter((i) => i.category === selectedCategory)
  }, [items, selectedCategory])

  const totalBudget = budgetSummary?.total_budget || 0
  const totalSpent = budgetSummary?.total_spent || 0
  const remainingBudget = budgetSummary?.remaining_budget || 0
  const globalPercentage = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0

  // Subcategories available for currently selected category in edit modal
  const activeCategoryObj = categoriesList.find((c) => c.name === editCategory)
  const availableSubcategories = activeCategoryObj?.subcategories || []

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Top Header with Title and Period Navigation Controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-white tracking-tight">Budgets & Répartition</h1>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-zinc-400">
              {accountScope === "checking" ? "Compte de Dépôt uniquement" : "Tous les comptes"} • {periodMode === "last_30_days" ? "30 derniers jours" : formatMonthName(selectedMonth)}
            </span>
            {excludeTransfers && (
              <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] py-0 px-2">
                Virements internes exclus
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
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Par Mois
            </button>
            <button
              type="button"
              onClick={() => setPeriodMode("last_30_days")}
              className={`px-3 py-1.5 rounded-xl font-medium transition-all cursor-pointer ${
                periodMode === "last_30_days"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              30 derniers jours
            </button>
          </div>

          {/* Month Selector Navigation (when in Month mode) */}
          {periodMode === "month" && (
            <div className="flex items-center gap-1.5 bg-zinc-900 border border-white/10 rounded-2xl p-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrevMonth}
                title="Mois précédent"
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
                title="Mois suivant"
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
                  Mois actuel
                </Button>
              )}
            </div>
          )}

          <Button
            onClick={() => handleOpenSetBudget()}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-3.5 gap-1.5 rounded-2xl cursor-pointer shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Définir un Budget</span>
          </Button>
        </div>
      </div>

      {/* Account & Transfer Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl bg-zinc-950/70 border border-white/5 text-xs">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-indigo-400 shrink-0" />
          <span className="text-zinc-400 font-medium">Périmètre du compte :</span>
          <div className="flex items-center p-0.5 rounded-xl bg-zinc-900 border border-white/10">
            <button
              type="button"
              onClick={() => setAccountScope("checking")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                accountScope === "checking"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Compte de Dépôt
            </button>
            <button
              type="button"
              onClick={() => setAccountScope("all")}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                accountScope === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Tous les comptes
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={excludeTransfers}
              onChange={(e) => setExcludeTransfers(e.target.checked)}
              className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0 cursor-pointer"
            />
            <span className="text-zinc-300 font-medium">
              Exclure les virements internes et l&apos;épargne
            </span>
          </label>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-white/10 bg-[#18181B] flex flex-col justify-between rounded-3xl">
          <span className="text-xs text-zinc-400 font-medium">Budget Mensuel Configuré</span>
          <p className="text-xl font-bold font-mono text-white mt-1">
            {formatAmount(totalBudget)}
          </p>
          <div className="mt-2 text-[11px] text-zinc-500">
            {items.filter((i) => i.monthly_limit > 0).length} catégories budgétées
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-[#18181B] flex flex-col justify-between rounded-3xl">
          <span className="text-xs text-zinc-400 font-medium">
            {periodMode === "last_30_days"
              ? "Dépensé (30 derniers jours)"
              : `Dépensé en ${formatMonthName(selectedMonth)}`}
          </span>
          <p className="text-xl font-bold font-mono text-white mt-1">
            {formatAmount(totalSpent)}
          </p>
          <div className="mt-2 text-[11px] text-zinc-500">
            {globalPercentage}% du budget utilisé (hors virements internes)
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-[#18181B] flex flex-col justify-between rounded-3xl">
          <span className="text-xs text-zinc-400 font-medium">Reste Disponible</span>
          <p className={`text-xl font-bold font-mono mt-1 ${remainingBudget < 0 ? "text-rose-400" : "text-emerald-400"}`}>
            {formatAmount(remainingBudget)}
          </p>
          <div className="mt-2 text-[11px] text-zinc-500">
            {remainingBudget < 0 ? "Budget dépassé" : "Disponible sur cette période"}
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
                Répartition des Dépenses
              </CardTitle>
            </div>
            <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-400 text-[10px]">
              {periodMode === "last_30_days" ? "30j" : selectedMonth}
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
                      <span className="text-xs font-bold text-white">{item.category}</span>
                      <span className="text-[11px] text-zinc-400">
                        {item.transactions.length} opération{item.transactions.length > 1 ? "s" : ""}
                      </span>
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
                          ? `Dépassé de ${formatAmount(Math.abs(item.remaining))}`
                          : `Reste ${formatAmount(item.remaining)}`}
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
                      Définissez un montant mensuel pour activer la jauge.
                    </span>
                  </div>
                )}

                {/* Bottom Actions: View Transactions & Edit Limit */}
                <div className="flex justify-between items-center pt-2 border-t border-white/5 text-xs">
                  <button
                    type="button"
                    onClick={() => setViewTransactionsCat(item)}
                    className="text-zinc-400 hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span>Voir opérations</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleOpenSetBudget(item.category, item.monthly_limit)}
                    className="h-7 px-2 text-zinc-400 hover:text-white gap-1 text-xs cursor-pointer rounded-xl"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>{hasLimit ? "Ajuster" : "Définir"}</span>
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Set / Edit Budget Dialog */}
      <Dialog open={isSetBudgetOpen} onOpenChange={setIsSetBudgetOpen}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              Configurer le Budget Mensuel
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveBudget} className="flex flex-col gap-4 mt-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Catégorie</label>
              <select
                value={budgetFormCat}
                onChange={(e) => setBudgetFormCat(e.target.value)}
                className="bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none cursor-pointer"
              >
                {categoriesList.map((cat, idx) => (
                  <option key={cat.id || cat.name || `budget-cat-${idx}`} value={cat.name} className="bg-zinc-950 text-white">
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Plafond mensuel (€)
              </label>
              <Input
                type="number"
                step="10"
                min="0"
                required
                placeholder="Ex: 400"
                value={budgetFormLimit}
                onChange={(e) => setBudgetFormLimit(e.target.value)}
                className="bg-zinc-950 border-white/10 text-white text-sm h-10 rounded-xl font-mono"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 rounded-xl font-semibold cursor-pointer shadow-md shadow-indigo-600/30"
              >
                <Check className="w-4 h-4 mr-1.5" />
                Enregistrer le budget
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsSetBudgetOpen(false)}
                className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 rounded-xl cursor-pointer"
              >
                Annuler
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Category Transactions List Dialog */}
      <Dialog open={!!viewTransactionsCat} onOpenChange={() => setViewTransactionsCat(null)}>
        <DialogContent className="max-w-xl p-6 bg-[#18181B] border-white/10 text-white rounded-3xl max-h-[85vh] overflow-y-auto">
          {viewTransactionsCat && (
            <div className="flex flex-col gap-4">
              <DialogHeader className="p-0 text-left">
                <div className="flex justify-between items-start pr-6">
                  <div>
                    <DialogTitle className="text-base font-bold text-white">
                      Opérations : {viewTransactionsCat.category}
                    </DialogTitle>
                    <span className="text-xs text-zinc-400">
                      {viewTransactionsCat.transactions.length} opération{viewTransactionsCat.transactions.length > 1 ? "s" : ""} • Cliquez sur une ligne pour la modifier
                    </span>
                  </div>

                  <span className="text-base font-bold font-mono text-white">
                    {formatAmount(viewTransactionsCat.spent)}
                  </span>
                </div>
              </DialogHeader>

              <div className="flex flex-col divide-y divide-white/5 border border-white/5 rounded-2xl bg-zinc-950/60 overflow-hidden">
                {viewTransactionsCat.transactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-500">
                    Aucune opération pour cette catégorie sur cette période.
                  </div>
                ) : (
                  viewTransactionsCat.transactions.map((tx) => {
                    const brandLogo = getBrandLogoUrl(tx.merchant, tx.raw_label)

                    return (
                      <div
                        key={tx.id}
                        onClick={() => handleOpenEditTx(tx)}
                        className="p-3 flex justify-between items-center hover:bg-white/5 transition-colors cursor-pointer group"
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
                            <span className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors truncate">
                              {tx.merchant}
                            </span>
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

                        <div className="flex items-center gap-3 shrink-0">
                          <span className="text-xs font-bold font-mono text-white">
                            -{formatAmount(Math.abs(tx.amount))}
                          </span>
                          <div className="w-6 h-6 rounded-lg bg-white/5 flex items-center justify-center text-zinc-500 group-hover:text-white group-hover:bg-indigo-600 transition-all">
                            <Edit2 className="w-3 h-3" />
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="outline"
                  onClick={() => setViewTransactionsCat(null)}
                  className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-9 rounded-xl cursor-pointer"
                >
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Single Transaction Edit Dialog (Category & Subcategory) */}
      <Dialog open={!!editingTx} onOpenChange={() => setEditingTx(null)}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          {editingTx && (
            <form onSubmit={handleSaveTxCategory} className="flex flex-col gap-4">
              <DialogHeader className="p-0 text-left">
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-indigo-400" />
                  Modifier la Catégorie
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

              {/* Category Selection */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">
                  Catégorie principale
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
                  Sous-catégorie (optionnel)
                </label>
                {availableSubcategories.length > 0 ? (
                  <div className="flex flex-col gap-2">
                    <select
                      value={editSubcategory}
                      onChange={(e) => setEditSubcategory(e.target.value)}
                      className="bg-zinc-950 border border-white/10 rounded-xl p-2.5 text-xs text-white outline-none cursor-pointer"
                    >
                      <option value="">Aucune sous-catégorie</option>
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
                    placeholder="Ex: Supermarché, Restaurant, Train..."
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
                  Appliquer automatiquement cette catégorie à tous les futurs achats chez <strong className="text-white">{editingTx.merchant}</strong>
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
                      <span>Enregistrement...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Valider la modification</span>
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingTx(null)}
                  className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 rounded-xl cursor-pointer"
                >
                  Annuler
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
