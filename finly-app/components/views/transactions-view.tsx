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
  ImageOff,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
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
import { FinlyAPI } from "@/lib/api/finly-api"
import { Transaction, Project, Account, CategoryItem } from "@/lib/types/finance"
import { getBrandLogoUrl } from "@/lib/utils/brand-logos"
import { MerchantAvatar } from "@/components/ui/merchant-avatar"

export function TransactionsView() {
  const { formatAmount } = usePrivacy()
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all")
  const [accountFilterType, setAccountFilterType] = useState<"checking" | "savings" | "all">("checking")
  const [selectedCategory, setSelectedCategory] = useState<string>("Toutes")
  const [transactionsList, setTransactionsList] = useState<Transaction[]>([])
  const [projectsList, setProjectsList] = useState<Project[]>([])
  const [accountsList, setAccountsList] = useState<Account[]>([])
  const [categoriesList, setCategoriesList] = useState<CategoryItem[]>([])
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [companyInfo, setCompanyInfo] = useState<any>(null)
  const [isLoadingCompany, setIsLoadingCompany] = useState<boolean>(false)
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [isAssigningProject, setIsAssigningProject] = useState<boolean>(false)
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
      console.error("Erreur chargement transactions:", err)
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
        .filter((a) => !a.type || a.type === "Compte Courant" || a.type.toLowerCase().includes("courant") || a.type.toLowerCase().includes("dépôt") || a.type.toLowerCase().includes("depot"))
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

  const handleAttachProject = async (projectName: string) => {
    if (!selectedTx) return
    setTransactionsList((prev) =>
      prev.map((t) => (t.id === selectedTx.id ? { ...t, project: projectName } : t))
    )
    setSelectedTx((prev) => (prev ? { ...prev, project: projectName } : null))
    setIsAssigningProject(false)
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
            }
          : null
      )
      setIsEditingCategory(false)

      if (res.updated_count > 1) {
        setFeedbackMessage(`Catégorie appliquée à ${res.updated_count} opérations de ${selectedTx.merchant}`)
        setTimeout(() => setFeedbackMessage(null), 4000)
      }
    } catch (err) {
      console.error("Erreur mise a jour categorie:", err)
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
      console.error("Erreur creation categorie:", err)
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
      setFeedbackMessage(`Logo retiré pour ${selectedTx.merchant}`)
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err) {
      console.error("Erreur suppression logo:", err)
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
      setFeedbackMessage(`Logo par défaut rétabli pour ${selectedTx.merchant}`)
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err) {
      console.error("Erreur reset logo:", err)
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
      setFeedbackMessage(`Logo personnalisé enregistré pour ${selectedTx.merchant}`)
      setTimeout(() => setFeedbackMessage(null), 3000)
    } catch (err) {
      console.error("Erreur custom logo:", err)
    }
  }

  const handleManualSync = async () => {
    setIsSyncing(true)
    try {
      await FinlyAPI.triggerSync()
      await loadData()
    } finally {
      setIsSyncing(false)
    }
  }

  const resetFilters = () => {
    setSelectedAccountId("all")
    setAccountFilterType("checking")
    setSelectedCategory("Toutes")
    setSearchQuery("")
  }

  const hasActiveFilters =
    selectedAccountId !== "all" ||
    accountFilterType !== "checking" ||
    selectedCategory !== "Toutes" ||
    searchQuery !== ""

  const activeFilterLabel = useMemo(() => {
    if (selectedAccountId !== "all") {
      const acc = accountsList.find((a) => a.id === selectedAccountId)
      return acc?.name || "Compte spécifique"
    }
    if (accountFilterType === "savings") return "Épargne & Placements"
    if (accountFilterType === "all") return "Tous les comptes"
    return "Compte Courant"
  }, [selectedAccountId, accountFilterType, accountsList])

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Alimentation": return ShoppingBag
      case "Transports": return Car
      case "Logement": return HomeIcon
      case "Abonnements": return Film
      case "Loisirs & Sorties": return Compass
      case "Santé & Bien-être": return HeartPulse
      case "Virements & Épargne": return PiggyBank
      case "Revenus":
      case "Virement Reçu": return ArrowDownRight
      default: return Tag
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Toast Feedback Notification */}
      {feedbackMessage && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-2xl bg-indigo-600 text-white text-xs font-semibold shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4 duration-200">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Minimalist Top Header */}
      <div className="flex justify-between items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Historique des Opérations</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            {activeFilterLabel} • {filteredTransactions.length} opération{filteredTransactions.length > 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={handleManualSync}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="h-8 px-2.5 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline text-xs">{isSyncing ? "Actualisation..." : "Actualiser"}</span>
          </Button>

          <Button
            onClick={() => setIsExportOpen(true)}
            variant="outline"
            size="sm"
            className="h-8 px-2.5 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-xs">Exporter</span>
          </Button>

          {/* Clean Filter Dropdown Menu Button */}
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`h-8 px-2.5 gap-1.5 rounded-xl border flex items-center justify-center transition-all cursor-pointer text-xs font-semibold ${
                hasActiveFilters
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-600/30"
                  : "bg-zinc-900 border-white/10 text-zinc-300 hover:bg-zinc-800"
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Filtres</span>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64 p-2 bg-[#18181B] border border-white/10 text-white rounded-2xl shadow-2xl max-h-[420px] overflow-y-auto"
            >
              <div className="flex items-center justify-between px-2 py-1.5 mb-1 border-b border-white/5">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-indigo-400" /> Filtres
                </span>
                {hasActiveFilters && (
                  <button
                    onClick={resetFilters}
                    className="text-[11px] text-zinc-400 hover:text-white cursor-pointer"
                  >
                    Réinitialiser
                  </button>
                )}
              </div>

              {/* Scope Section */}
              <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 px-2 py-1">
                Périmètre
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
                  <span>Compte Courant</span>
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
                  <span>Épargne & Placements</span>
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
                  <span>Tous les comptes ({transactionsList.length})</span>
                  {selectedAccountId === "all" && accountFilterType === "all" && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
              </DropdownMenuGroup>

              {/* Sub-Accounts Section */}
              {accountsList.length > 1 && (
                <>
                  <DropdownMenuSeparator className="bg-white/5 my-1" />
                  <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 px-2 py-1">
                    Compte spécifique
                  </DropdownMenuLabel>
                  <DropdownMenuGroup>
                    {accountsList.map((acc) => {
                      const count = transactionsList.filter(
                        (t: any) => t.account_id === acc.id || t.account === acc.name
                      ).length
                      const isSelected = selectedAccountId === acc.id

                      return (
                        <DropdownMenuItem
                          key={acc.id}
                          onClick={() => setSelectedAccountId(isSelected ? "all" : acc.id)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                            isSelected ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"
                          }`}
                        >
                          <span className="truncate">{acc.name || acc.bank}</span>
                          <span className="text-[10px] font-mono text-zinc-400">({count})</span>
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuGroup>
                </>
              )}

              {/* Category Filter */}
              <DropdownMenuSeparator className="bg-white/5 my-1" />
              <DropdownMenuLabel className="text-[10px] uppercase font-semibold text-zinc-400 px-2 py-1">
                Catégorie
              </DropdownMenuLabel>
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => setSelectedCategory("Toutes")}
                  className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                    selectedCategory === "Toutes" ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"
                  }`}
                >
                  <span>Toutes les catégories</span>
                  {selectedCategory === "Toutes" && <Check className="w-3.5 h-3.5" />}
                </DropdownMenuItem>
                {categoriesList.map((cat) => (
                  <DropdownMenuItem
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.name)}
                    className={`flex items-center justify-between p-2 rounded-xl text-xs cursor-pointer ${
                      selectedCategory === cat.name ? "bg-indigo-600 text-white" : "text-zinc-300 hover:bg-white/5"
                    }`}
                  >
                    <span>{cat.name}</span>
                    {selectedCategory === cat.name && <Check className="w-3.5 h-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Search Bar & Active Filter Pill */}
      <Card className="p-2.5 border-white/10 bg-[#18181B] flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Rechercher une opération, un commerçant ou une catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900/80 border-white/10 text-white text-xs h-9"
          />
        </div>

        {hasActiveFilters && (
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <Badge
              variant="outline"
              className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-xs py-1 px-2.5 gap-1.5 flex items-center"
            >
              <span>{activeFilterLabel}</span>
              {selectedCategory !== "Toutes" && <span>• {selectedCategory}</span>}
              <button
                onClick={resetFilters}
                className="hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          </div>
        )}
      </Card>

      {/* Grouped Transactions List */}
      <div className="flex flex-col gap-5">
        {Object.keys(groupedByDate).length === 0 ? (
          <Card className="p-10 text-center border-white/10 bg-[#18181B] flex flex-col items-center justify-center gap-2.5">
            <p className="text-sm font-medium text-white">Aucune transaction trouvée</p>
            <p className="text-xs text-zinc-400">
              {transactionsList.length === 0
                ? "Connectez votre banque pour charger vos dépenses."
                : "Aucune opération ne correspond aux filtres sélectionnés."}
            </p>
            {transactionsList.length === 0 && (
              <Button
                onClick={() => setIsWoobOpen(true)}
                size="sm"
                className="mt-2 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" /> Connecter un compte
              </Button>
            )}
          </Card>
        ) : (
          Object.entries(groupedByDate).map(([dateStr, items]) => (
            <div key={dateStr} className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-semibold text-zinc-400">
                  {dateStr}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  {items.length}
                </span>
              </div>

              <Card className="border-white/10 bg-[#18181B] divide-y divide-white/5 overflow-hidden">
                {items.map((tx: any) => {
                  const isPositive = tx.amount > 0
                  const rawBankLabel = tx.rawLabel || tx.raw_label || ""

                  return (
                    <div
                      key={tx.id}
                      onClick={() => {
                        setSelectedTx(tx)
                        setIsAssigningProject(false)
                        setIsEditingCategory(false)
                        setIsCreatingCategory(false)
                      }}
                      className="flex justify-between items-center p-3.5 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3">
                        <MerchantAvatar
                          merchantName={tx.merchant}
                          rawLabel={rawBankLabel}
                          logoUrl={tx.logo_url}
                          category={tx.category}
                          isPositive={isPositive}
                          className="w-9 h-9 rounded-xl"
                        />
                        <div className="flex flex-col min-w-0 pr-2">
                          <span className="text-sm font-medium text-white group-hover:text-indigo-300 transition-colors truncate">
                            {tx.merchant}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                            <span className="text-[11px] text-zinc-400">
                              {tx.category}{tx.subcategory ? ` • ${tx.subcategory}` : ""}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-900 border border-white/5 text-zinc-400 truncate max-w-[120px]">
                              {tx.account}
                            </span>
                            {tx.project && (
                              <Badge variant="outline" className="text-[10px] py-0 border-indigo-500/30 text-indigo-300">
                                {tx.project}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-bold font-mono ${
                          isPositive
                            ? "text-emerald-400"
                            : !tx.is_user_classified
                            ? "text-amber-400"
                            : "text-white"
                        }`}>
                          {isPositive ? "+" : ""}{formatAmount(tx.amount)}
                        </span>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </Card>
            </div>
          ))
        )}
      </div>

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
        title="Exporter les Transactions"
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
                          title="Gérer le logo du commerçant"
                        >
                          <Camera className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="text-xs text-zinc-400">
                        {selectedTx.date} à {selectedTx.time}
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
                      Gestion du logo de l&apos;enseigne
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
                      Préférence mémorisée pour toutes les opérations de <strong className="text-white">{selectedTx.merchant}</strong>.
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
                        <span>Supprimer le logo</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResetDefaultLogo}
                        className="text-xs border-white/10 bg-zinc-800 text-zinc-300 hover:text-white h-9 rounded-xl gap-1.5 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Logo par défaut</span>
                      </Button>
                    </div>

                    <form onSubmit={handleSetCustomLogo} className="flex gap-2 mt-1">
                      <Input
                        type="text"
                        placeholder="Domaine (ex: monoprix.fr)"
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
                        Valider
                      </Button>
                    </form>
                  </div>
                </div>
              )}

              {/* Info Card */}
              <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs">
                {/* Clickable Category Row */}
                <div
                  onClick={() => {
                    setIsEditingCategory(!isEditingCategory)
                    setIsAssigningProject(false)
                  }}
                  className="flex justify-between items-center p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer"
                >
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> Catégorie
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-white">
                      {selectedTx.category}{selectedTx.subcategory ? ` > ${selectedTx.subcategory}` : ""}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-500" />
                  </div>
                </div>

                <div className="flex justify-between items-center px-2 py-1 pt-2 border-t border-white/5">
                  <span className="text-zinc-400">Compte</span>
                  <span className="font-medium text-white">{selectedTx.account}</span>
                </div>

                {selectedTx.project && (
                  <div className="flex justify-between items-center px-2 py-1 pt-1 border-t border-white/5">
                    <span className="text-zinc-400">Projet</span>
                    <span className="font-medium text-indigo-300">{selectedTx.project}</span>
                  </div>
                )}
              </div>

              {/* 1. Category & Subcategory Direct Selectors Panel */}
              {isEditingCategory && (
                <div className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-4 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">Changer la Catégorie</span>
                      <span className="text-[11px] text-zinc-400">Mémorisé automatiquement pour {selectedTx.merchant}</span>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setIsCreatingCategory(!isCreatingCategory)}
                      className="text-xs border-white/10 bg-zinc-800 text-indigo-400 hover:text-white h-7 px-2.5 gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{isCreatingCategory ? "Fermer" : "Nouvelle"}</span>
                    </Button>
                  </div>

                  {/* Form to create a new category/subcategory */}
                  {isCreatingCategory && (
                    <form onSubmit={handleCreateNewCategory} className="p-3.5 rounded-xl bg-zinc-950 border border-white/10 flex flex-col gap-3">
                      <span className="text-xs font-semibold text-white">
                        Ajouter une catégorie personnalisée
                      </span>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-zinc-400">Rattacher à une catégorie parente (Optionnel)</label>
                        <select
                          value={newCatParent}
                          onChange={(e) => setNewCatParent(e.target.value)}
                          className="bg-zinc-900 border border-white/10 rounded-xl p-2 text-xs text-white outline-none cursor-pointer"
                        >
                          <option value="">Aucune (Nouvelle catégorie principale)</option>
                          {categoriesList.map((cat) => (
                            <option key={cat.id} value={cat.name}>
                              {cat.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] font-medium text-zinc-400">Nom</label>
                        <Input
                          type="text"
                          required
                          placeholder="Ex: Boulangerie, Essence, Parking..."
                          value={newCatName}
                          onChange={(e) => setNewCatName(e.target.value)}
                          className="bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl"
                        />
                      </div>

                      <Button type="submit" size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 rounded-xl font-semibold cursor-pointer">
                        Créer et sélectionner
                      </Button>
                    </form>
                  )}

                  {/* Clean Dropdown Selectors */}
                  <div className="flex flex-col gap-3">
                    {/* Selector 1: Main Category */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        Catégorie principale
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
                            {cat.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selector 2: Subcategory */}
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-semibold text-zinc-300">
                        Sous-catégorie (optionnelle)
                      </label>
                      <select
                        value={selectedSubCat}
                        onChange={(e) => setSelectedSubCat(e.target.value)}
                        className="bg-zinc-950 border border-white/10 text-white text-xs rounded-xl p-2.5 outline-none hover:border-indigo-500/50 transition-colors cursor-pointer"
                      >
                        <option value="" className="bg-zinc-950 text-zinc-400">
                          Aucune sous-catégorie
                        </option>
                        {activeSubcategories.map((sub) => (
                          <option key={sub} value={sub} className="bg-zinc-950 text-white">
                            {sub}
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
                      Appliquer la catégorie
                    </Button>
                  </div>
                </div>
              )}

              {/* 2. Official Enterprise Enrichment Info (api.gouv.fr) */}
              {isLoadingCompany && (
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 flex items-center justify-center gap-2 text-xs text-zinc-400">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                  <span>Recherche des informations d&apos;établissement...</span>
                </div>
              )}

              {companyInfo?.found && !isLoadingCompany && (
                <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 text-xs">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-[11px] font-semibold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                      {companyInfo.is_matching_etablissement ? "Établissement Local" : "Informations Entreprise"}
                    </span>
                    {companyInfo.siren && (
                      <a
                        href={`https://annuaire-entreprises.data.gouv.fr/entreprise/${companyInfo.siren}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-zinc-400 hover:text-white flex items-center gap-1 transition-colors"
                      >
                        <span>Fiche officielle</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-zinc-400">Raison sociale</span>
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
                          <Briefcase className="w-3 h-3" /> Activité
                        </span>
                        <span className="text-right text-zinc-300 line-clamp-2">
                          {companyInfo.activite_label}
                        </span>
                      </div>
                    )}

                    {companyInfo.adresse && (
                      <div className="flex justify-between items-start gap-2">
                        <span className="text-zinc-400 shrink-0 flex items-center gap-1">
                          <MapPin className="w-3 h-3" /> {companyInfo.is_matching_etablissement ? "Établissement" : "Siège"}
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

              {/* 3. Assign to Project Panel */}
              {isAssigningProject && (
                <div className="flex flex-col gap-2.5 p-3.5 rounded-2xl bg-zinc-900 border border-white/10 animate-in fade-in duration-150">
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <span className="text-xs font-semibold text-white">
                      Associer à un projet
                    </span>
                    <button onClick={() => setIsAssigningProject(false)} className="text-zinc-400 hover:text-white cursor-pointer">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {projectsList.map((proj) => (
                      <button
                        key={proj.id}
                        onClick={() => handleAttachProject(proj.name)}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-xs text-left transition-all cursor-pointer ${
                          selectedTx.project === proj.name
                            ? "bg-indigo-600 text-white font-medium"
                            : "bg-zinc-950/60 border border-white/5 text-zinc-300 hover:bg-white/5"
                        }`}
                      >
                        <span>{proj.name}</span>
                        {selectedTx.project === proj.name && <Check className="w-3.5 h-3.5" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 4. Raw Label Card with High Contrast & Copy Button */}
              {(() => {
                const rawLabelText = selectedTx.rawLabel || (selectedTx as any).raw_label || ""
                return (
                  <div className="flex flex-col gap-1.5 p-3.5 rounded-2xl bg-zinc-950 border border-white/10">
                    <div className="flex justify-between items-center">
                      <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                        Libellé bancaire d&apos;origine
                      </span>
                      {rawLabelText && (
                        <button
                          type="button"
                          onClick={() => {
                            if (typeof navigator !== "undefined") {
                              navigator.clipboard.writeText(rawLabelText)
                              setFeedbackMessage("Libellé copié dans le presse-papier")
                              setTimeout(() => setFeedbackMessage(null), 3000)
                            }
                          }}
                          className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Copy className="w-3 h-3" />
                          <span>Copier</span>
                        </button>
                      )}
                    </div>
                    <p className="font-mono text-xs sm:text-sm text-zinc-100 select-all break-words leading-relaxed pt-0.5">
                      {rawLabelText || "Non renseigné par la banque"}
                    </p>
                  </div>
                )
              })()}

              {/* Bottom Actions */}
              <div className="flex gap-2.5 mt-1">
                {!isEditingCategory && !isAssigningProject && (
                  <>
                    <Button
                      onClick={() => setIsEditingCategory(true)}
                      className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-white/10 text-white font-medium text-xs py-4 cursor-pointer"
                    >
                      <Tag className="w-3.5 h-3.5 mr-1.5 text-indigo-400" />
                      Modifier Catégorie
                    </Button>
                    <Button
                      onClick={() => setIsAssigningProject(true)}
                      className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-4 cursor-pointer"
                    >
                      <Target className="w-3.5 h-3.5 mr-1.5" />
                      {selectedTx.project ? "Changer Projet" : "Rattacher Projet"}
                    </Button>
                  </>
                )}
                {(isEditingCategory || isAssigningProject) && (
                  <Button
                    variant="outline"
                    className="w-full border-white/10 bg-zinc-900 text-zinc-300 text-xs py-4 cursor-pointer"
                    onClick={() => {
                      setIsEditingCategory(false)
                      setIsAssigningProject(false)
                      setIsCreatingCategory(false)
                    }}
                  >
                    Terminé
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
