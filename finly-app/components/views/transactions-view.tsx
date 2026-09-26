"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  Search,
  ShoppingBag,
  Car,
  Home as HomeIcon,
  Film,
  ArrowDownRight,
  ChevronRight,
  FileSpreadsheet,
  Check,
  Target,
  RefreshCw,
  PlusCircle,
  Filter,
  X,
  SlidersHorizontal,
  Tag,
  Plus,
  Compass,
  HeartPulse,
  PiggyBank,
  Sparkles,
  Copy,
  Building2,
  ExternalLink,
  Globe,
  MapPin,
  Briefcase,
  Hash,
  RotateCcw,
  Trash2,
  Camera,
  AlertCircle,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ExportDialog } from "@/components/modals/export-dialog"
import { WoobModal } from "@/components/modals/woob-modal"
import { SyncFeedbackModal } from "@/components/modals/sync-feedback-modal"
import { ImportCredentialsModal, PendingBankConnection } from "@/components/modals/import-credentials-modal"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Transaction, Project, Account, CategoryItem, SyncResult, BankSyncError } from "@/lib/types/finance"
import { MerchantAvatar } from "@/components/ui/merchant-avatar"

export function TransactionsView() {
  const { formatAmount } = usePrivacy()
  const { t, language, format } = useI18n()

  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all")
  const [accountFilterType, setAccountFilterType] = useState<"checking" | "savings" | "all">("checking")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [transactionsList, setTransactionsList] = useState<Transaction[]>([])
  const [projectsList, setProjectsList] = useState<Project[]>([])
  const [accountsList, setAccountsList] = useState<Account[]>([])
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([])
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [isLoadingCompany, setIsLoadingCompany] = useState<boolean>(false)
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<boolean>(false)
  const [isDeletingTx, setIsDeletingTx] = useState<boolean>(false)
  const [isEditingCategory, setIsEditingCategory] = useState<boolean>(false)
  const [isCreatingCategory, setIsCreatingCategory] = useState<boolean>(false)
  const [isEditingLogo, setIsEditingLogo] = useState<boolean>(false)
  const [customLogoInput, setCustomLogoInput] = useState<string>("")
  const [selectedMainCat, setSelectedMainCat] = useState<string>("")
  const [selectedSubCat, setSelectedSubCat] = useState<string>("")
  const [newCatName, setNewCatName] = useState<string>("")
  const [newCatParent, setNewCatParent] = useState<string>("")
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    try {
      const [txRes, projRes, accRes, catRes] = await Promise.all([
        FinlyAPI.getTransactions(),
        FinlyAPI.getProjects(),
        FinlyAPI.getAccounts(),
        FinlyAPI.getCategories(),
      ])
      setTransactionsList(txRes.transactions || [])
      setProjectsList(projRes || [])
      setAccountsList(accRes.accounts || [])
      setCategoriesList(catRes || [])
    } catch (err) {
      console.error("Failed to load transactions:", err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Sync selected category and fetch enterprise enrichment when transaction is opened
  useEffect(() => {
    if (selectedTx) {
      setSelectedMainCat(selectedTx.category || "Divers")
      setSelectedSubCat(selectedTx.subcategory || "")
      setShowDeleteConfirm(false)
      setCompanyInfo(null)
      setIsLoadingCompany(true)

      FinlyAPI.getCompanyInfo(selectedTx.id)
        .then((info) => setCompanyInfo(info))
        .catch(() => setCompanyInfo(null))
        .finally(() => setIsLoadingCompany(false))
    }
  }, [selectedTx])

  // Checking vs Savings Account IDs
  const checkingAccountIds = useMemo(() => {
    return new Set(
      accountsList
        .filter((a) => !a.type || a.type === "Compte Courant" || a.type.toLowerCase().includes("courant") || a.type.toLowerCase().includes("dépôt") || a.type.toLowerCase().includes("checking"))
        .map((a) => a.id)
    )
  }, [accountsList])

  const filteredTransactions = useMemo(() => {
    return transactionsList.filter((tx: any) => {
      const rawText = tx.rawLabel || tx.raw_label || ""
      const matchesSearch =
        tx.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
        rawText.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (tx.subcategory && tx.subcategory.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (tx.account && tx.account.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCategory =
        selectedCategory === "all" ||
        selectedCategory === "Toutes" ||
        tx.category === selectedCategory ||
        tx.subcategory === selectedCategory

      let matchesAccount = true
      if (selectedAccountId !== "all") {
        matchesAccount = tx.account_id === selectedAccountId || tx.account === selectedAccountId
      } else if (accountFilterType === "checking") {
        matchesAccount = checkingAccountIds.has(tx.account_id) || tx.account_type === "Compte Courant"
      } else if (accountFilterType === "savings") {
        matchesAccount = !checkingAccountIds.has(tx.account_id) || tx.account_type !== "Compte Courant"
      }

      return matchesSearch && matchesCategory && matchesAccount
    })
  }, [transactionsList, searchQuery, selectedCategory, selectedAccountId, accountFilterType, checkingAccountIds])

  const groupedByDate: Record<string, Transaction[]> = useMemo(() => {
    const map: Record<string, Transaction[]> = {}
    filteredTransactions.forEach((tx) => {
      if (!map[tx.date]) map[tx.date] = []
      map[tx.date].push(tx)
    })
    return map
  }, [filteredTransactions])

  const handleDeleteTransaction = async () => {
    if (!selectedTx) return
    setIsDeletingTx(true)
    try {
      await FinlyAPI.deleteTransaction(selectedTx.id)
      setTransactionsList((prev) => prev.filter((t) => t.id !== selectedTx.id))
      setSelectedTx(null)
      setShowDeleteConfirm(false)
      setFeedbackMessage(t.transactions.transactionDeleted)
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err) {
      console.error("Error deleting transaction:", err)
      setFeedbackMessage(t.transactions.transactionDeleteError)
      setTimeout(() => setFeedbackMessage(null), 3000)
    } finally {
      setIsDeletingTx(false)
    }
  }

  // Subcategories available for selected main category
  const activeSubcategories = useMemo(() => {
    const found = categoriesList.find((c) => c.name === selectedMainCat)
    return found?.subcategories || []
  }, [categoriesList, selectedMainCat])

  // Save Category & Subcategory via Dropdown Selectors
  const handleSaveCategory = async () => {
    if (!selectedTx || !selectedMainCat) return
    try {
      const res = await FinlyAPI.updateTransactionCategory(selectedTx.id, {
        category: selectedMainCat,
        subcategory: selectedSubCat || undefined,
      })

      // Update in local state for all transactions from the same merchant
      setTransactionsList((prev) =>
        prev.map((t) => {
          if (t.id === selectedTx.id || (selectedTx.merchant && t.merchant === selectedTx.merchant)) {
            return {
              ...t,
              category: selectedMainCat,
              subcategory: selectedSubCat || undefined,
              is_user_classified: true,
              is_low_confidence: false,
              category_confidence: 1.0,
            }
          }
          return t
        })
      )

      setSelectedTx((prev) =>
        prev
          ? {
              ...prev,
              category: selectedMainCat,
              subcategory: selectedSubCat || undefined,
              is_user_classified: true,
              is_low_confidence: false,
              category_confidence: 1.0,
            }
          : null
      )
      setIsEditingCategory(false)

      if (res.updated_count > 1) {
        setFeedbackMessage(
          format(t.transactions.appliedToCount, {
            count: res.updated_count,
            merchant: selectedTx.merchant,
          })
        )
        setTimeout(() => setFeedbackMessage(null), 4000)
      }
    } catch (err) {
      console.error("Error updating category:", err)
    }
  }

  const handleCreateNewCategory = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newCatName.trim()) return

    try {
      await FinlyAPI.createCategory({
        name: newCatName.trim(),
        parent_name: newCatParent ? newCatParent : undefined,
      })
      const updatedCats = await FinlyAPI.getCategories()
      setCategoriesList(updatedCats)

      if (newCatParent) {
        setSelectedMainCat(newCatParent)
        setSelectedSubCat(newCatName.trim())
      } else {
        setSelectedMainCat(newCatName.trim())
        setSelectedSubCat("")
      }

      setNewCatName("")
      setNewCatParent("")
      setIsCreatingCategory(false)
    } catch (err) {
      console.error("Error creating category:", err)
    }
  }

  const handleRemoveLogo = async () => {
    if (!selectedTx) return
    try {
      await FinlyAPI.updateTransactionLogo(selectedTx.id, {
        logo_url: "none",
        apply_to_all_merchant: true,
      })
      setSelectedTx({ ...selectedTx, logo_url: "none" })
      setTransactionsList((prev) =>
        prev.map((t) => (t.merchant === selectedTx.merchant ? { ...t, logo_url: "none" } : t))
      )
      setIsEditingLogo(false)
      setFeedbackMessage(format(t.transactions.logoRemovedFor, { merchant: selectedTx.merchant }))
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err) {
      console.error("Error removing logo:", err)
    }
  }

  const handleResetDefaultLogo = async () => {
    if (!selectedTx) return
    try {
      await FinlyAPI.updateTransactionLogo(selectedTx.id, {
        logo_url: null,
        apply_to_all_merchant: true,
      })
      setSelectedTx({ ...selectedTx, logo_url: undefined })
      setTransactionsList((prev) =>
        prev.map((t) => (t.merchant === selectedTx.merchant ? { ...t, logo_url: undefined } : t))
      )
      setIsEditingLogo(false)
      setFeedbackMessage(format(t.transactions.logoResetFor, { merchant: selectedTx.merchant }))
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err) {
      console.error("Error resetting logo:", err)
    }
  }

  const handleSetCustomLogo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedTx || !customLogoInput.trim()) return
    const raw = customLogoInput.trim()
    const formatted = raw.startsWith("http")
      ? raw
      : `https://www.google.com/s2/favicons?domain=${raw.replace(/^https?:\/\//, "")}&sz=128`

    try {
      await FinlyAPI.updateTransactionLogo(selectedTx.id, {
        logo_url: formatted,
        apply_to_all_merchant: true,
      })
      setSelectedTx({ ...selectedTx, logo_url: formatted })
      setTransactionsList((prev) =>
        prev.map((t) => (t.merchant === selectedTx.merchant ? { ...t, logo_url: formatted } : t))
      )
      setIsEditingLogo(false)
      setCustomLogoInput("")
      setFeedbackMessage(format(t.transactions.logoSavedFor, { merchant: selectedTx.merchant }))
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err) {
      console.error("Error setting custom logo:", err)
    }
  }

  // Sync Result Modal States
  const [syncResultModalData, setSyncResultModalData] = useState<SyncResult | null>(null)
  const [isSyncResultModalOpen, setIsSyncResultModalOpen] = useState<boolean>(false)
  const [pendingBankConnections, setPendingBankConnections] = useState<PendingBankConnection[]>([])
  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState<boolean>(false)

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      const res = await FinlyAPI.triggerSync()
      await loadData()
      setSyncResultModalData(res)
      setIsSyncResultModalOpen(true)
    } catch (err: any) {
      setSyncResultModalData({
        status: "error",
        message: err.message || (language === "fr" ? "Échec de la synchronisation bancaire." : "Banking synchronization failed."),
      })
      setIsSyncResultModalOpen(true)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleFixSyncError = (err: BankSyncError) => {
    setPendingBankConnections([
      {
        id: err.connection_id,
        backend_name: err.backend_name,
        module_name: err.module_name,
        bank_name: err.bank_name,
        login: err.login || "",
      },
    ])
    setIsCredentialsModalOpen(true)
  }

  const resetFilters = () => {
    setSelectedAccountId("all")
    setAccountFilterType("checking")
    setSelectedCategory("all")
    setSearchQuery("")
  }

  const hasActiveFilters =
    selectedAccountId !== "all" ||
    accountFilterType !== "checking" ||
    (selectedCategory !== "all" && selectedCategory !== "Toutes") ||
    searchQuery !== ""

  const activeFilterLabel = useMemo(() => {
    if (selectedAccountId !== "all") {
      const acc = accountsList.find((a) => a.id === selectedAccountId)
      return acc?.name || t.transactions.specificAccount
    }
    if (accountFilterType === "savings") return t.transactions.savingsAndInvestments
    if (accountFilterType === "all") return t.transactions.allAccounts
    return t.transactions.checkingAccount
  }, [selectedAccountId, accountFilterType, accountsList, t])

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto pb-24 md:pb-8">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Top Header & Integrated Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-medium text-zinc-300">{activeFilterLabel}</span>
          <span>•</span>
          <span className="font-mono">{filteredTransactions.length} {language === "fr" ? `opération${filteredTransactions.length > 1 ? "s" : ""}` : `transaction${filteredTransactions.length > 1 ? "s" : ""}`}</span>
          {hasActiveFilters && (
            <>
              <span>•</span>
              <button
                onClick={resetFilters}
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
              >
                {t.common.reset}
              </button>
            </>
          )}
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto">
          {/* Integrated Search Input */}
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <Input
              type="text"
              placeholder={t.transactions.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8.5 bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl focus:border-white/20"
            />
          </div>

          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs">{isSyncing ? t.common.syncing : t.common.refresh}</span>
          </Button>

          <Button
            onClick={() => setIsExportOpen(true)}
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl cursor-pointer shrink-0"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">{t.common.export}</span>
          </Button>

          {/* Clean Filter Dropdown Menu Button */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`h-9 px-3 gap-1.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer text-xs font-semibold shrink-0 ${
                hasActiveFilters
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{t.common.filter}</span>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64 p-2 bg-[#18181B] border border-white/10 text-white rounded-2xl shadow-2xl max-h-[420px] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-white/5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" /> {t.common.filter}
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    {t.common.reset}
                  </button>
                )}
              </div>

              {/* Scope Section */}
              <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 px-2 py-1">
                {t.transactions.scope}
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAccountId("all")
                    setAccountFilterType("checking")
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                    selectedAccountId === "all" && accountFilterType === "checking"
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <span>{t.transactions.checkingAccount}</span>
                  {selectedAccountId === "all" && accountFilterType === "checking" && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAccountId("all")
                    setAccountFilterType("savings")
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                    selectedAccountId === "all" && accountFilterType === "savings"
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <span>{t.transactions.savingsAndInvestments}</span>
                  {selectedAccountId === "all" && accountFilterType === "savings" && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>

                <DropdownMenuItem
                  onClick={() => {
                    setSelectedAccountId("all")
                    setAccountFilterType("all")
                  }}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                    selectedAccountId === "all" && accountFilterType === "all"
                      ? "bg-indigo-600 text-white"
                      : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <span>{t.transactions.allAccounts}</span>
                  {selectedAccountId === "all" && accountFilterType === "all" && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>

              {/* Specific Accounts Section */}
              {accountsList.length > 0 && (
                <>
                  <DropdownMenuSeparator className="bg-white/5 my-1" />
                  <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 px-2 py-1">
                    {t.accounts.title}
                  </DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {accountsList.map((acc) => (
                      <DropdownMenuItem
                        key={acc.id}
                        onClick={() => setSelectedAccountId(acc.id)}
                        className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                          selectedAccountId === acc.id ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"
                        }`}
                      >
                        <span className="truncate pr-2">{acc.name}</span>
                        {selectedAccountId === acc.id && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuGroup>
                </>
              )}

              {/* Category Filter */}
              <DropdownMenuSeparator className="bg-white/5 my-1" />
              <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 px-2 py-1">
                {t.budgets.category}
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setSelectedCategory("all")}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                    selectedCategory === "all" || selectedCategory === "Toutes" ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <span>{t.transactions.allCategories}</span>
                  {(selectedCategory === "all" || selectedCategory === "Toutes") && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                {categoriesList.map((cat) => (
                  <DropdownMenuItem
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                      selectedCategory === cat.name ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <span>{t.categories[cat.name] || cat.name}</span>
                    {selectedCategory === cat.name && <Check className="w-3.5 h-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Unified Transactions Container */}
      <Card className="p-0 border-white/10 bg-[#18181B] rounded-2xl overflow-hidden divide-y divide-white/5">
        {Object.keys(groupedByDate).length === 0 ? (
          <div className="p-12 text-center flex flex-col items-center justify-center gap-2.5">
            <p className="text-sm font-medium text-white">{t.transactions.noTransactionsFound}</p>
            <p className="text-xs text-zinc-400">
              {transactionsList.length === 0
                ? t.transactions.noTransactionsConnectPrompt
                : t.transactions.noTransactionsFilterPrompt}
            </p>
            {transactionsList.length === 0 && (
              <Button
                onClick={() => setIsWoobOpen(true)}
                size="sm"
                className="mt-2 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> {t.transactions.connectAccount}
              </Button>
            )}
          </div>
        ) : (
          Object.entries(groupedByDate).map(([dateStr, items]) => (
            <div key={dateStr}>
              <div className="px-4 sm:px-6 py-2.5 bg-zinc-950/40 flex justify-between items-center border-b border-white/5">
                <span className="text-[11px] font-semibold text-zinc-400 tracking-wider uppercase">
                  {dateStr}
                </span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  {items.length} {language === "fr" ? `opération${items.length > 1 ? "s" : ""}` : `transaction${items.length > 1 ? "s" : ""}`}
                </span>
              </div>

              <div className="divide-y divide-white/5">
                {items.map((tx: any) => {
                  const isPositive = tx.amount > 0
                  const rawBankLabel = tx.rawLabel || tx.raw_label || ""

                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        setSelectedTx(tx)
                        setShowDeleteConfirm(false)
                        setIsEditingCategory(false)
                        setIsCreatingCategory(false)
                      }}
                      className="flex justify-between items-center px-4 sm:px-6 py-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5">
                        <MerchantAvatar
                          merchantName={tx.merchant}
                          rawLabel={rawBankLabel}
                          logoUrl={tx.logo_url}
                          category={tx.category}
                          isPositive={isPositive}
                          className="w-9 h-9 rounded-xl shrink-0"
                        />
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors truncate">
                            {tx.merchant}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-zinc-400">
                              {t.categories[tx.category] || tx.category}
                              {tx.subcategory ? ` • ${t.categories[tx.subcategory] || tx.subcategory}` : ""}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-white/5 text-zinc-400 truncate max-w-[120px]">
                              {tx.account}
                            </span>
                            {tx.is_low_confidence && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-400 font-medium flex items-center gap-1">
                                <span className="size-1 rounded-full bg-amber-400 animate-pulse" />
                                {t.transactions.uncertainBadge}
                              </span>
                            )}
                            {tx.project && (
                              <Badge variant="outline" className="text-[10px] py-0 border-indigo-500/30 text-indigo-300">
                                {tx.project}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm sm:text-base font-bold font-mono tracking-tight ${
                          isPositive ? "text-emerald-400" : "text-white"
                        }`}>
                          {isPositive ? "+" : ""}{formatAmount(tx.amount)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))
        )}
      </Card>

      {/* Modals */}
      <WoobModal
        isOpen={isWoobOpen}
        onClose={() => setIsWoobOpen(false)}
        onBankConnected={loadData}
      />

      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultScope="transactions"
        title={t.transactions.title}
        transactions={transactionsList}
        accounts={accountsList}
        projects={projectsList}
      />

      {/* Transaction Detail Dialog (Centered on PC & Responsive) */}
      <Dialog open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-6 max-w-lg max-h-[88vh] overflow-y-auto">
          {selectedTx && (
            <div className="flex flex-col gap-5">
              <DialogHeader className="p-0 text-left">
                <div className="flex justify-between items-start pr-6">
                  <div className="flex items-center gap-3 min-w-0 pr-2">
                    <MerchantAvatar
                      merchantName={selectedTx.merchant}
                      rawLabel={selectedTx.rawLabel || selectedTx.raw_label}
                      logoUrl={selectedTx.logo_url !== undefined ? selectedTx.logo_url : companyInfo?.logo_url}
                      category={selectedTx.category}
                      isPositive={selectedTx.amount > 0}
                      className="w-10 h-10 rounded-xl"
                      iconClassName="w-5 h-5"
                      editable={true}
                      onClick={() => setIsEditingLogo(!isEditingLogo)}
                    />

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <DialogTitle className="text-lg font-bold text-white truncate">
                          {selectedTx.merchant}
                        </DialogTitle>
                        <button
                          type="button"
                          onClick={() => setIsEditingLogo(!isEditingLogo)}
                          className="text-zinc-500 hover:text-indigo-300 transition-colors p-0.5 rounded cursor-pointer"
                          title={t.transactions.merchantLogoManagement}
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {selectedTx.date} {selectedTx.time ? `• ${selectedTx.time}` : ""}
                      </span>
                    </div>
                  </div>

                  <span className={`text-base font-bold font-mono shrink-0 ${
                    selectedTx.amount > 0
                      ? "text-emerald-400"
                      : !selectedTx.is_user_classified
                      ? "text-amber-400"
                      : "text-white"
                  }`}>
                    {selectedTx.amount > 0 ? "+" : ""}{formatAmount(selectedTx.amount)}
                  </span>
                </div>
              </DialogHeader>

              {/* Logo Editing Panel */}
              {isEditingLogo && (
                <div className="p-3.5 rounded-2xl bg-zinc-900/95 border border-white/10 flex flex-col gap-3 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-xs font-bold text-white flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-indigo-400" />
                      {t.transactions.merchantLogoManagement}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingLogo(false)}
                      className="text-zinc-400 hover:text-white cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] text-zinc-400">
                      {t.transactions.rememberMerchantPreference} <strong className="text-white">{selectedTx.merchant}</strong>.
                    </p>

                    <div className="grid grid-cols-2 gap-2 mt-0.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleRemoveLogo}
                        className="text-xs border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white h-9 rounded-xl gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.transactions.removeLogo}</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetDefaultLogo}
                        className="text-xs border-white/10 bg-zinc-800 text-zinc-300 hover:text-white h-9 rounded-xl gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{t.transactions.resetDefaultLogo}</span>
                      </Button>
                    </div>

                    <form onSubmit={handleSetCustomLogo} className="flex gap-2 mt-1">
                      <Input
                        type="text"
                        placeholder={t.transactions.customLogoUrlOrDomain}
                        value={customLogoInput}
                        onChange={(e) => setCustomLogoInput(e.target.value)}
                        className="bg-zinc-950 border-white/10 text-white text-xs h-9 rounded-xl flex-1 font-mono"
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!customLogoInput.trim()}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl px-3 cursor-pointer"
                      >
                        {t.common.save}
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {/* Uncertainty Warning Banner with 1-Click Confirmation */}
              {selectedTx.is_low_confidence && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in">
                  <div className="flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-amber-300">{t.transactions.uncertainCategory}</span>
                      <span className="text-[11px] text-zinc-400">{t.transactions.lowConfidenceNotice}</span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    type="button"
                    onClick={handleSaveCategory}
                    className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs h-8 px-3 rounded-xl shrink-0 cursor-pointer self-start sm:self-auto"
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    <span>{t.transactions.confirmCategory}</span>
                  </Button>
                </div>
              )}

              {/* Info Card */}
              <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs">
                {/* Clickable Category Row */}
                <div
                  onClick={() => {
                    setIsEditingCategory(!isEditingCategory)
                    setShowDeleteConfirm(false)
                  }}
                  className="flex justify-between items-center p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> {t.budgets.category}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">
                      {t.categories[selectedTx.category] || selectedTx.category}
                      {selectedTx.subcategory ? ` > ${t.categories[selectedTx.subcategory] || selectedTx.subcategory}` : ""}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </div>

                <div className="flex justify-between items-center px-2 py-1 pt-2 border-t border-white/5">
                  <span className="text-zinc-400">{t.projects.linkedAccount}</span>
                  <span className="font-medium text-white">{selectedTx.account}</span>
                </div>

                {selectedTx.project && (
                  <div className="flex justify-between items-center px-2 py-1 pt-1 border-t border-white/5">
                    <span className="text-zinc-400">{t.nav.projects}</span>
                    <span className="font-medium text-indigo-300">{selectedTx.project}</span>
                  </div>
                )}
              </div>

              {/* 1. Category & Subcategory Direct Selectors Panel */}
              {isEditingCategory && (
                <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{t.transactions.categorization}</span>
                      <span className="text-[11px] text-zinc-400">
                        {t.transactions.rememberMerchantPreference} {selectedTx.merchant}
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                      className="text-xs border-white/10 bg-zinc-800 text-indigo-400 hover:text-white h-7 px-2.5 gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isCreatingCategory ? t.common.close : t.transactions.createCategory}</span>
                    </Button>
                  </div>

                  {/* Form to create a new category/subcategory */}
                  {isCreatingCategory && (
                    <form onSubmit={handleCreateNewCategory} className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-3">
                      <span className="text-xs font-semibold text-white">
                        {t.transactions.createCategory}
                      </span>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-zinc-400">{t.transactions.parentCategory}</label>
                        <select
                          value={newCatParent}
                          onChange={(e) => setNewCatParent(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded-xl p-2 text-xs text-white outline-none cursor-pointer"
                        >
                          <option value="">{language === "fr" ? "Aucune (Nouvelle catégorie principale)" : "None (New main category)"}</option>
                          {categoriesList.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {t.categories[cat.name] || cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-zinc-400">{t.transactions.newCategoryName}</label>
                        <Input
                          type="text"
                          required
                          placeholder="Ex: Bakery, Gas, Parking..."
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl"
                        />
                      </div>

                      <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-semibold cursor-pointer">
                        {t.transactions.saveCategory}
                      </Button>
                    </form>
                  )}

                  {/* Clean Dropdown Selectors */}
                  <div className="flex flex-col gap-3">
                    {/* Selector 1: Main Category */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        {t.transactions.mainCategory}
                      </label>
                      <select
                        value={selectedMainCat}
                        onChange={(e) => {
                          setSelectedMainCat(e.target.value)
                          setSelectedSubCat("")
                        }}
                        className="bg-zinc-950 border border-white/10 text-white text-xs rounded-xl p-2.5 outline-none hover:border-indigo-500/50 transition-colors cursor-pointer"
                      >
                        {categoriesList.map((cat) => (
                          <option key={cat.id} value={cat.name} className="bg-zinc-950 text-white">
                            {t.categories[cat.name] || cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selector 2: Subcategory */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        {t.transactions.subcategoryOptional}
                      </label>
                      <select
                        value={selectedSubCat}
                        onChange={(e) => setSelectedSubCat(e.target.value)}
                        className="bg-zinc-950 border border-white/10 text-white text-xs rounded-xl p-2.5 outline-none hover:border-indigo-500/50 transition-colors cursor-pointer"
                      >
                        <option value="" className="bg-zinc-950 text-zinc-400">
                          {language === "fr" ? "Aucune sous-catégorie" : "No subcategory"}
                        </option>
                        {activeSubcategories.map((sub) => (
                          <option key={sub} value={sub} className="bg-zinc-950 text-white">
                            {t.categories[sub] || sub}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Save Button */}
                    <Button
                      type="button"
                      onClick={handleSaveCategory}
                      className="mt-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 rounded-xl font-semibold cursor-pointer shadow-md shadow-indigo-600/30"
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      {t.transactions.saveCategory}
                    </Button>
                  </div>
                </div>
              )}

              {/* 2. Official Enterprise Enrichment Info (api.gouv.fr) */}
              {isLoadingCompany && (
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>{language === "fr" ? "Recherche des informations d'établissement..." : "Looking up merchant details..."}</span>
                </div>
              )}

              {companyInfo?.found && !isLoadingCompany && (
                <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      {companyInfo.is_matching_etablissement ? (language === "fr" ? "Établissement Local" : "Local Branch") : (language === "fr" ? "Informations Entreprise" : "Company Information")}
                    </span>
                    {companyInfo.siren && (
                      <a
                        href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${companyInfo.siren}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <span>{language === "fr" ? "Fiche officielle" : "Official Registry"}</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">{language === "fr" ? "Raison sociale" : "Legal Name"}</span>
                      <span className="font-semibold text-white truncate max-w-[240px]">
                        {companyInfo.nom_complet}
                      </span>
                    </div>

                    {companyInfo.siren && (
                      <div className="flex justify-between items-center">
                        <span className="text-zinc-400 flex items-center gap-1">
                          <Hash className="w-3 h-3" /> SIREN
                        </span>
                        <span className="font-mono text-zinc-300">{companyInfo.siren}</span>
                      </div>
                    )}

                    {companyInfo.activite_label && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-zinc-400 shrink-0 flex items-center gap-1">
                          <Briefcase className="w-3 h-3" /> {language === "fr" ? "Activité" : "Activity"}
                        </span>
                        <span className="text-right text-zinc-300 line-clamp-2">
                          {companyInfo.activite_label}
                        </span>
                      </div>
                    )}

                    {companyInfo.adresse && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-zinc-400 shrink-0 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {companyInfo.is_matching_etablissement ? (language === "fr" ? "Établissement" : "Branch") : (language === "fr" ? "Siège" : "Headquarters")}
                        </span>
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            companyInfo.latitude && companyInfo.longitude
                              ? `${companyInfo.latitude},${companyInfo.longitude}`
                              : companyInfo.adresse
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-right text-indigo-300 hover:text-indigo-200 hover:underline line-clamp-2"
                        >
                          {companyInfo.adresse}
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Raw Label Card with High Contrast & Copy Button */}
              {(() => {
                const rawLabelText = selectedTx.rawLabel || (selectedTx as any).raw_label || ""
                return (
                  <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-zinc-950 border border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        {language === "fr" ? "Libellé bancaire d'origine" : "Original Bank Label"}
                      </span>
                      {rawLabelText && (
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== "undefined") {
                              navigator.clipboard.writeText(rawLabelText)
                              setFeedbackMessage(language === "fr" ? "Libellé copié dans le presse-papier" : "Bank label copied to clipboard")
                              setTimeout(() => setFeedbackMessage(null), 3000)
                            }
                          }}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>{t.common.copy}</span>
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-xs sm:text-sm text-zinc-100 select-all break-words leading-relaxed pt-0.5">
                      {rawLabelText || (language === "fr" ? "Non renseigné par la banque" : "Not provided by bank")}
                    </p>
                  </div>
                )
              })()}

              {/* Bottom Actions */}
              <div className="flex flex-col gap-2 mt-1">
                {showDeleteConfirm ? (
                  <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-red-950/20 border border-red-500/20 animate-in fade-in duration-150">
                    <p className="text-xs text-red-200 font-medium text-center">
                      {t.transactions.deleteTransactionDesc}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setShowDeleteConfirm(false)}
                        disabled={isDeletingTx}
                        className="flex-1 border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs py-3 cursor-pointer"
                      >
                        {t.common.cancel}
                      </Button>
                      <Button
                        type="button"
                        onClick={handleDeleteTransaction}
                        disabled={isDeletingTx}
                        className="flex-1 bg-red-600 hover:bg-red-500 text-white font-medium text-xs py-3 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        {isDeletingTx ? t.common.loading : t.common.confirm}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2.5">
                    {!isEditingCategory && (
                      <>
                        <Button
                          onClick={() => setIsEditingCategory(true)}
                          className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white font-medium text-xs py-4 cursor-pointer"
                        >
                          <Tag className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                          {t.transactions.categorization}
                        </Button>
                        <Button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="flex-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 hover:text-red-300 font-medium text-xs py-4 cursor-pointer transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                          {t.common.delete}
                        </Button>
                      </>
                    )}
                    {isEditingCategory && (
                      <Button
                        variant="outline"
                        className="w-full border-white/10 bg-zinc-900 text-zinc-300 text-xs py-4 cursor-pointer"
                        onClick={() => {
                          setIsEditingCategory(false)
                          setIsCreatingCategory(false)
                        }}
                      >
                        {t.common.save}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Synchronization Feedback & Error Correction Modal */}
      <SyncFeedbackModal
        isOpen={isSyncResultModalOpen}
        onClose={() => setIsSyncResultModalOpen(false)}
        syncResult={syncResultModalData}
        onFixConnection={handleFixSyncError}
      />

      {/* Reconnect Credentials Modal */}
      <ImportCredentialsModal
        isOpen={isCredentialsModalOpen}
        onClose={() => setIsCredentialsModalOpen(false)}
        pendingConnections={pendingBankConnections}
        onSuccess={loadData}
      />
    </div>
  )
}
