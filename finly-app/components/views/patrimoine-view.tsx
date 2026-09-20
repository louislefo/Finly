"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Plus,
  RefreshCw,
  MapPin,
  Sparkles,
  Edit2,
  Trash2,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { WoobModal } from "@/components/modals/woob-modal"
import { NewProjectModal } from "@/components/modals/new-project-modal"
import { FinlyAPI } from "@/lib/api/finly-api"
import { cn } from "@/lib/utils"
import { Account, Project, BankConnection, RealEstateData } from "@/lib/types/finance"

export type WealthCategoryMode = "all" | "liquidities" | "savings" | "investments" | "crypto" | "real_estate"

export function PatrimoineView() {
  const router = useRouter()
  const { formatAmount } = usePrivacy()
  const { t, language, format } = useI18n()

  // Data States
  const [accounts, setAccounts] = useState<Account[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([])
  const [totalBalance, setTotalBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false)
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [reEstimatingId, setReEstimatingId] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<WealthCategoryMode>("all")

  // Simulation parameters
  const [simMonthlySavings, setSimMonthlySavings] = useState<number>(500)
  const [simAnnualRate, setSimAnnualRate] = useState<number>(4)
  const [simYears, setSimYears] = useState<number>(5)

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [accRes, projRes, connsRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getProjects(),
        FinlyAPI.getBankConnections(),
      ])
      setAccounts(accRes.accounts || [])
      setTotalBalance(accRes.total_balance || 0)
      setProjects(projRes || [])
      setBankConnections(connsRes || [])
    } catch {
      // Fallback
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Real estate projects list
  const realEstateProjects = useMemo(() => {
    return projects.filter((p) => p.projectType === "real_estate" && p.realEstateData)
  }, [projects])

  // Asset Class Calculations
  const assetCategories = useMemo(() => {
    let liquidities = 0
    const liquiditiesAccs: Account[] = []

    let savings = 0
    const savingsAccs: Account[] = []

    let investments = 0
    const investmentsAccs: Account[] = []

    let crypto = 0
    const cryptoAccs: Account[] = []

    for (const a of accounts) {
      const tStr = (a.type || "").toLowerCase()
      const n = (a.name || "").toLowerCase()
      const combined = `${tStr} ${n}`

      if (["crypto", "binance", "coinbase", "kraken", "ledger", "bitget", "bybit", "metamask", "btc", "eth"].some((k) => combined.includes(k))) {
        crypto += a.balance
        cryptoAccs.push(a)
      } else if (["pea", "titre", "bourse", "placement", "assurance", "brokerage", "investment", "cto", "action", "trading"].some((k) => combined.includes(k))) {
        investments += a.balance
        investmentsAccs.push(a)
      } else if (["livret", "epargne", "épargne", "ldd", "lep", "pel", "cel", "savings"].some((k) => combined.includes(k))) {
        savings += a.balance
        savingsAccs.push(a)
      } else {
        liquidities += a.balance
        liquiditiesAccs.push(a)
      }
    }

    // Real estate / Projects valuation & loans
    let realEstateGrossValue = 0
    let totalRealEstateDebt = 0
    let realEstateNetEquity = 0

    for (const p of realEstateProjects) {
      const re = p.realEstateData!
      const val = re.currentEstimatedValue || re.propertyPrice || 0
      const debt = re.hasLoan !== false ? re.remainingLoanBalance ?? re.loanAmount ?? 0 : 0

      realEstateGrossValue += val
      totalRealEstateDebt += debt
      realEstateNetEquity += Math.max(0, val - debt)
    }

    const financialAssets = liquidities + savings + investments + crypto
    const grossAssets = financialAssets + realEstateGrossValue
    const netWorth = financialAssets + realEstateNetEquity

    return {
      liquidities,
      liquiditiesAccs,
      savings,
      savingsAccs,
      investments,
      investmentsAccs,
      crypto,
      cryptoAccs,
      financialAssets,
      realEstateGrossValue,
      totalRealEstateDebt,
      realEstateNetEquity,
      grossAssets,
      netWorth,
    }
  }, [accounts, realEstateProjects])

  // Bank Breakdown
  const bankBreakdown = useMemo(() => {
    const map = new Map<string, { bankName: string; total: number; count: number }>()
    for (const a of accounts) {
      const b = a.bank || "Banque"
      const cur = map.get(b) || { bankName: b, total: 0, count: 0 }
      cur.total += a.balance
      cur.count++
      map.set(b, cur)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [accounts])

  // Category accounts according to active selection
  const currentCategoryAccounts = useMemo(() => {
    switch (selectedCategory) {
      case "liquidities":
        return assetCategories.liquiditiesAccs
      case "savings":
        return assetCategories.savingsAccs
      case "investments":
        return assetCategories.investmentsAccs
      case "crypto":
        return assetCategories.cryptoAccs
      default:
        return accounts
    }
  }, [selectedCategory, assetCategories, accounts])

  const currentCategoryTotal = useMemo(() => {
    switch (selectedCategory) {
      case "liquidities":
        return assetCategories.liquidities
      case "savings":
        return assetCategories.savings
      case "investments":
        return assetCategories.investments
      case "crypto":
        return assetCategories.crypto
      case "real_estate":
        return assetCategories.realEstateNetEquity
      default:
        return assetCategories.netWorth
    }
  }, [selectedCategory, assetCategories])

  const categoryTabs = useMemo(() => [
    { id: "all" as const, label: language === "fr" ? "Tout" : "All" },
    { id: "liquidities" as const, label: language === "fr" ? "Liquidités" : "Cash" },
    { id: "savings" as const, label: language === "fr" ? "Épargne" : "Savings" },
    { id: "investments" as const, label: language === "fr" ? "Investissements" : "Investments" },
    { id: "crypto" as const, label: "Crypto" },
    { id: "real_estate" as const, label: language === "fr" ? "Immobilier" : "Real Estate" },
  ], [language])

  // Synchronize All
  const handleSyncAll = async () => {
    setIsSyncing(true)
    try {
      await FinlyAPI.triggerSync()
      await loadData()
    } finally {
      setIsSyncing(false)
    }
  }

  // Refresh Real-Time Valuation for a Property
  const handleRefreshPropertyEstimate = async (project: Project) => {
    if (!project.realEstateData) return
    const re = project.realEstateData
    const surf = re.surfaceM2 || 65

    setReEstimatingId(project.id)
    try {
      const est = await FinlyAPI.estimateRealEstate({
        address: re.address,
        postal_code: re.postalCode,
        city: re.city,
        surface_m2: surf,
        property_type: re.propertyType || "apartment",
        lat: re.latitude,
        lon: re.longitude,
      })

      if (est) {
        const updatedReData: RealEstateData = {
          ...re,
          currentEstimatedValue: est.estimated_value,
          estimatedPricePerM2: est.price_per_m2.median,
          lastValuationDate: est.valuation_date,
        }

        await FinlyAPI.updateProject(project.id, {
          realEstateData: updatedReData,
        })
        await loadData()
      }
    } finally {
      setReEstimatingId(null)
    }
  }

  // Save / Update Project
  const handleSaveProject = async (projPayload: Partial<Project>) => {
    try {
      if (projPayload.id) {
        await FinlyAPI.updateProject(projPayload.id, projPayload)
      } else {
        await FinlyAPI.createProject(projPayload)
      }
      await loadData()
    } catch (err: any) {
      alert(err.message || (language === "fr" ? "Erreur lors de l'enregistrement." : "Error saving property."))
    }
  }

  // Delete Real Estate Project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm(language === "fr" ? "Voulez-vous supprimer ce bien immobilier de votre patrimoine ?" : "Do you want to delete this real estate property?")) return
    try {
      await FinlyAPI.deleteProject(projectId)
      await loadData()
    } catch (err: any) {
      alert(err.message || (language === "fr" ? "Erreur suppression." : "Error deleting property."))
    }
  }

  // Projection Calculation
  const projectedWealth = useMemo(() => {
    const principal = assetCategories.netWorth
    const r = simAnnualRate / 100
    const months = simYears * 12
    const monthlyRate = r / 12

    let total = principal
    for (let m = 0; m < months; m++) {
      total = total * (1 + monthlyRate) + simMonthlySavings
    }

    const totalContributed = principal + simMonthlySavings * months
    const interestEarned = Math.max(0, total - totalContributed)

    return {
      futureTotal: Math.round(total),
      contributed: Math.round(totalContributed),
      interest: Math.round(interestEarned),
    }
  }, [assetCategories.netWorth, simMonthlySavings, simAnnualRate, simYears])

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto pb-24 md:pb-8">
      {/* Top Header: Left = Category Mode Selector, Right = Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        {/* Left: Mode Selector (Tout, Liquidités, Épargne, Investissements, Crypto, Immobilier) */}
        <div className="flex items-center bg-[#18181B] p-1 rounded-xl border border-white/10 w-fit select-none shrink-0 overflow-x-auto max-w-full scrollbar-none">
          {categoryTabs.map((tab) => {
            const isActive = selectedCategory === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedCategory(tab.id)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold transition-all cursor-pointer select-none whitespace-nowrap",
                  isActive
                    ? "bg-white text-zinc-950 font-bold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            onClick={handleSyncAll}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? t.common.syncing : t.common.refresh}</span>
          </Button>

          {selectedCategory === "all" || selectedCategory === "real_estate" ? (
            <Button
              onClick={() => {
                setProjectToEdit(null)
                setIsNewProjectOpen(true)
              }}
              size="sm"
              className="h-9 px-3.5 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{t.wealth.addProperty}</span>
            </Button>
          ) : (
            <Button
              onClick={() => router.push("/compte")}
              size="sm"
              className="h-9 px-3.5 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{language === "fr" ? "Gérer les comptes" : "Manage accounts"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2 Primary Balanced Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card: Total Wealth & Asset Allocation (5 cols) */}
        <Card className="lg:col-span-5 p-5 sm:p-6 rounded-2xl border-white/10 bg-[#18181B] flex flex-col justify-between gap-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-zinc-400">
              {selectedCategory === "all" && t.wealth.totalNetWorth}
              {selectedCategory === "liquidities" && (language === "fr" ? "Total Liquidités" : "Total Cash")}
              {selectedCategory === "savings" && (language === "fr" ? "Total Épargne" : "Total Savings")}
              {selectedCategory === "investments" && (language === "fr" ? "Total Investissements" : "Total Investments")}
              {selectedCategory === "crypto" && (language === "fr" ? "Total Crypto-actifs" : "Total Crypto")}
              {selectedCategory === "real_estate" && (language === "fr" ? "Équité Nette Immobilière" : "Real Estate Net Equity")}
            </span>
            <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
              {selectedCategory === "all" && formatAmount(assetCategories.netWorth)}
              {selectedCategory === "liquidities" && formatAmount(assetCategories.liquidities)}
              {selectedCategory === "savings" && formatAmount(assetCategories.savings)}
              {selectedCategory === "investments" && formatAmount(assetCategories.investments)}
              {selectedCategory === "crypto" && formatAmount(assetCategories.crypto)}
              {selectedCategory === "real_estate" && formatAmount(assetCategories.realEstateNetEquity)}
            </span>
            <span className="text-[11px] text-zinc-500 font-mono mt-0.5">
              {selectedCategory === "all" && `${t.wealth.grossAssets} : ${formatAmount(assetCategories.grossAssets)}`}
              {selectedCategory === "liquidities" && `${Math.round((assetCategories.liquidities / (assetCategories.grossAssets || 1)) * 100)}% de l'actif brut • ${assetCategories.liquiditiesAccs.length} comptes`}
              {selectedCategory === "savings" && `${Math.round((assetCategories.savings / (assetCategories.grossAssets || 1)) * 100)}% de l'actif brut • ${assetCategories.savingsAccs.length} livrets`}
              {selectedCategory === "investments" && `${Math.round((assetCategories.investments / (assetCategories.grossAssets || 1)) * 100)}% de l'actif brut • ${assetCategories.investmentsAccs.length} comptes`}
              {selectedCategory === "crypto" && `${Math.round((assetCategories.crypto / (assetCategories.grossAssets || 1)) * 100)}% de l'actif brut • ${assetCategories.cryptoAccs.length} comptes`}
              {selectedCategory === "real_estate" && `${language === "fr" ? "Valeur brute" : "Gross value"}: ${formatAmount(assetCategories.realEstateGrossValue)} • ${language === "fr" ? "Dettes" : "Debt"}: -${formatAmount(assetCategories.totalRealEstateDebt)}`}
            </span>
          </div>

          {/* Allocation Bar */}
          {assetCategories.grossAssets > 0 && (
            <div className="flex flex-col gap-3">
              <div className="h-2.5 w-full rounded-full bg-zinc-900 border border-white/5 overflow-hidden flex">
                {assetCategories.liquidities > 0 && (
                  <div
                    style={{ width: `${(assetCategories.liquidities / assetCategories.grossAssets) * 100}%` }}
                    className={cn(
                      "bg-blue-500 h-full transition-all",
                      selectedCategory !== "all" && selectedCategory !== "liquidities" && "opacity-25"
                    )}
                  />
                )}
                {assetCategories.savings > 0 && (
                  <div
                    style={{ width: `${(assetCategories.savings / assetCategories.grossAssets) * 100}%` }}
                    className={cn(
                      "bg-emerald-500 h-full transition-all",
                      selectedCategory !== "all" && selectedCategory !== "savings" && "opacity-25"
                    )}
                  />
                )}
                {assetCategories.investments > 0 && (
                  <div
                    style={{ width: `${(assetCategories.investments / assetCategories.grossAssets) * 100}%` }}
                    className={cn(
                      "bg-purple-500 h-full transition-all",
                      selectedCategory !== "all" && selectedCategory !== "investments" && "opacity-25"
                    )}
                  />
                )}
                {assetCategories.crypto > 0 && (
                  <div
                    style={{ width: `${(assetCategories.crypto / assetCategories.grossAssets) * 100}%` }}
                    className={cn(
                      "bg-amber-500 h-full transition-all",
                      selectedCategory !== "all" && selectedCategory !== "crypto" && "opacity-25"
                    )}
                  />
                )}
                {assetCategories.realEstateGrossValue > 0 && (
                  <div
                    style={{ width: `${(assetCategories.realEstateGrossValue / assetCategories.grossAssets) * 100}%` }}
                    className={cn(
                      "bg-indigo-500 h-full transition-all",
                      selectedCategory !== "all" && selectedCategory !== "real_estate" && "opacity-25"
                    )}
                  />
                )}
              </div>

              {/* Minimalist Allocation List */}
              <div className="flex flex-col divide-y divide-white/5 pt-1">
                {/* Liquidités */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory("liquidities")}
                  className={cn(
                    "flex items-center justify-between py-2 text-xs w-full text-left rounded-lg transition-colors px-1 cursor-pointer",
                    selectedCategory === "liquidities" ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                    <span className={selectedCategory === "liquidities" ? "text-white font-semibold" : "text-zinc-300"}>
                      {t.wealth.liquidities}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {Math.round((assetCategories.liquidities / assetCategories.grossAssets) * 100)}%
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatAmount(assetCategories.liquidities)}
                    </span>
                  </div>
                </button>

                {/* Épargne */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory("savings")}
                  className={cn(
                    "flex items-center justify-between py-2 text-xs w-full text-left rounded-lg transition-colors px-1 cursor-pointer",
                    selectedCategory === "savings" ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                    <span className={selectedCategory === "savings" ? "text-white font-semibold" : "text-zinc-300"}>
                      {t.wealth.savings}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {Math.round((assetCategories.savings / assetCategories.grossAssets) * 100)}%
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatAmount(assetCategories.savings)}
                    </span>
                  </div>
                </button>

                {/* Investissements */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory("investments")}
                  className={cn(
                    "flex items-center justify-between py-2 text-xs w-full text-left rounded-lg transition-colors px-1 cursor-pointer",
                    selectedCategory === "investments" ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                    <span className={selectedCategory === "investments" ? "text-white font-semibold" : "text-zinc-300"}>
                      {t.wealth.investments}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {Math.round((assetCategories.investments / assetCategories.grossAssets) * 100)}%
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatAmount(assetCategories.investments)}
                    </span>
                  </div>
                </button>

                {/* Crypto */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory("crypto")}
                  className={cn(
                    "flex items-center justify-between py-2 text-xs w-full text-left rounded-lg transition-colors px-1 cursor-pointer",
                    selectedCategory === "crypto" ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className={selectedCategory === "crypto" ? "text-white font-semibold" : "text-zinc-300"}>
                      {t.wealth.crypto}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {Math.round((assetCategories.crypto / assetCategories.grossAssets) * 100)}%
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatAmount(assetCategories.crypto)}
                    </span>
                  </div>
                </button>

                {/* Immobilier */}
                <button
                  type="button"
                  onClick={() => setSelectedCategory("real_estate")}
                  className={cn(
                    "flex items-center justify-between py-2 text-xs w-full text-left rounded-lg transition-colors px-1 cursor-pointer",
                    selectedCategory === "real_estate" ? "bg-white/10" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
                    <span className={selectedCategory === "real_estate" ? "text-white font-semibold" : "text-zinc-300"}>
                      {t.wealth.realEstate}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] text-zinc-500 font-mono">
                      {Math.round((assetCategories.realEstateGrossValue / assetCategories.grossAssets) * 100)}%
                    </span>
                    <span className="font-mono font-bold text-white">
                      {formatAmount(assetCategories.realEstateGrossValue)}
                    </span>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Linked Bank Accounts */}
          <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                {t.wealth.linkedBankAccounts} ({currentCategoryAccounts.length})
              </span>
              {selectedCategory !== "all" && (
                <button
                  type="button"
                  onClick={() => setSelectedCategory("all")}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                >
                  {language === "fr" ? "Voir tout" : "View all"}
                </button>
              )}
            </div>
            <div className="divide-y divide-white/5 max-h-[180px] overflow-y-auto">
              {currentCategoryAccounts.slice(0, 6).map((acc) => (
                <div key={acc.id} className="py-2 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-white font-medium truncate">{acc.name || acc.bank}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-[11px] text-zinc-500">{acc.bank}</span>
                  </div>
                  <span className="font-mono font-semibold text-zinc-200 shrink-0">
                    {formatAmount(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Right Card: Dynamic content according to selected category */}
        {selectedCategory === "all" || selectedCategory === "real_estate" ? (
          <Card className="lg:col-span-7 p-5 sm:p-6 rounded-2xl border-white/10 bg-[#18181B] flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {t.wealth.realEstateProperties}
              </h2>
              <span className="text-xs text-zinc-500 font-mono">
                {realEstateProjects.length} {language === "fr" ? `bien${realEstateProjects.length > 1 ? "s" : ""}` : `propert${realEstateProjects.length > 1 ? "ies" : "y"}`}
              </span>
            </div>

            {realEstateProjects.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-2 text-zinc-500">
                <span className="text-sm font-medium text-zinc-300">{t.wealth.noRealEstate}</span>
                <p className="text-xs max-w-sm">{t.wealth.noRealEstateDesc}</p>
                <Button
                  onClick={() => {
                    setProjectToEdit(null)
                    setIsNewProjectOpen(true)
                  }}
                  size="sm"
                  className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-8 px-3.5 font-semibold"
                >
                  {t.wealth.addProperty}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-white/5">
                {realEstateProjects.map((p) => {
                  const re = p.realEstateData!
                  const currentVal = re.currentEstimatedValue || re.propertyPrice || 0
                  const purchasePrice = re.propertyPrice || 0
                  const gain = currentVal - purchasePrice
                  const debt = re.hasLoan !== false ? re.remainingLoanBalance ?? re.loanAmount ?? 0 : 0
                  const netEquity = Math.max(0, currentVal - debt)
                  const isUpdating = reEstimatingId === p.id

                  return (
                    <div key={p.id} className="py-4 flex flex-col gap-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold text-white">{p.name}</span>
                            {re.surfaceM2 && (
                              <span className="text-[11px] text-zinc-400 font-mono">{re.surfaceM2} m²</span>
                            )}
                            {re.isRental && (
                              <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                                {language === "fr" ? "Locatif" : "Rental"}
                              </span>
                            )}
                          </div>
                          {re.address && (
                            <span className="text-xs text-zinc-500 truncate mt-0.5">{re.address}</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            onClick={() => handleRefreshPropertyEstimate(p)}
                            disabled={isUpdating}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-emerald-400 cursor-pointer"
                            title={t.wealth.reestimateLive}
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isUpdating ? "animate-spin text-emerald-400" : ""}`} />
                          </Button>
                          <Button
                            onClick={() => {
                              setProjectToEdit(p)
                              setIsNewProjectOpen(true)
                            }}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-white cursor-pointer"
                            title={t.projects.editProject}
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button
                            onClick={() => handleDeleteProject(p.id)}
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 rounded-lg text-zinc-400 hover:text-rose-400 cursor-pointer"
                            title={t.projects.deleteProject}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>

                      {/* Inline Property Metrics */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500">{t.wealth.estimatedValue}</span>
                          <span className="font-bold text-white">{formatAmount(currentVal)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500">{t.wealth.purchasePrice}</span>
                          <span className="text-zinc-300">{formatAmount(purchasePrice)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500">{t.wealth.netEquity}</span>
                          <span className="font-bold text-emerald-400">{formatAmount(netEquity)}</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[10px] text-zinc-500">{language === "fr" ? "Plus-value" : "Gain"}</span>
                          <span className={`font-semibold ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {gain >= 0 ? "+" : ""}{formatAmount(gain)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>{t.wealth.propertiesCount}: {realEstateProjects.length}</span>
              <Button
                onClick={() => {
                  setProjectToEdit(null)
                  setIsNewProjectOpen(true)
                }}
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer"
              >
                + {t.wealth.addProperty}
              </Button>
            </div>
          </Card>
        ) : (
          <Card className="lg:col-span-7 p-5 sm:p-6 rounded-2xl border-white/10 bg-[#18181B] flex flex-col justify-between gap-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/5">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {selectedCategory === "liquidities" && (language === "fr" ? "Comptes courants & Liquidités" : "Cash & Checking Accounts")}
                {selectedCategory === "savings" && (language === "fr" ? "Comptes d'épargne & Livrets" : "Savings Accounts & Books")}
                {selectedCategory === "investments" && (language === "fr" ? "Comptes d'investissement (PEA, CTO, Assurance-vie)" : "Investment & Brokerage Accounts")}
                {selectedCategory === "crypto" && (language === "fr" ? "Portefeuilles & Comptes Crypto" : "Crypto Accounts & Wallets")}
              </h2>
              <span className="text-xs text-zinc-500 font-mono">
                {currentCategoryAccounts.length} {language === "fr" ? `compte${currentCategoryAccounts.length > 1 ? "s" : ""}` : `account${currentCategoryAccounts.length > 1 ? "s" : ""}`}
              </span>
            </div>

            {currentCategoryAccounts.length === 0 ? (
              <div className="py-16 text-center flex flex-col items-center justify-center gap-2 text-zinc-500">
                <span className="text-sm font-medium text-zinc-300">
                  {language === "fr" ? "Aucun compte détecté dans cette catégorie" : "No accounts found in this category"}
                </span>
                <p className="text-xs max-w-sm">
                  {selectedCategory === "crypto"
                    ? (language === "fr" ? "Connectez vos plateformes crypto (Binance, Kraken, Coinbase) ou synchronisez vos comptes dans Outils." : "Connect your crypto exchanges or wallets in Tools.")
                    : (language === "fr" ? "Rattachez vos établissements bancaires pour faire apparaître vos comptes ici." : "Link your bank accounts to see them here.")}
                </p>
                <Button
                  onClick={() => router.push("/compte")}
                  size="sm"
                  className="mt-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-8 px-3.5 font-semibold"
                >
                  {language === "fr" ? "Gérer mes comptes" : "Manage accounts"}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col divide-y divide-white/5">
                {currentCategoryAccounts.map((acc) => (
                  <div key={acc.id} className="py-3.5 flex items-center justify-between gap-3">
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-white truncate">{acc.name || acc.bank}</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 mt-0.5">
                        <span>{acc.bank}</span>
                        {acc.accountNumber && (
                          <>
                            <span>•</span>
                            <span className="font-mono">{acc.accountNumber}</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-base font-bold font-mono text-white">
                        {formatAmount(acc.balance)}
                      </span>
                      <Button
                        onClick={() => router.push(`/depenses?accountId=${acc.id}`)}
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs text-zinc-400 hover:text-white rounded-lg cursor-pointer"
                      >
                        {language === "fr" ? "Opérations" : "Transactions"}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>
                {language === "fr" ? "Total catégorie" : "Category total"}:{" "}
                <strong className="text-white font-mono">{formatAmount(currentCategoryTotal)}</strong>
              </span>
              <button
                type="button"
                onClick={() => router.push("/compte")}
                className="text-indigo-400 hover:text-indigo-300 font-semibold cursor-pointer transition-colors"
              >
                {language === "fr" ? "Gérer les banques & comptes →" : "Manage banks & accounts →"}
              </button>
            </div>
          </Card>
        )}
      </div>

      {/* Wealth Simulator Section */}
      <Card className="p-5 sm:p-6 rounded-2xl border-white/10 bg-[#18181B] flex flex-col gap-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-white/5">
          <h3 className="text-sm font-semibold text-white tracking-tight">
            {t.wealth.wealthEvolutionSimulator}
          </h3>
          <span className="text-xs text-zinc-500">{t.wealth.compoundInterestProjection}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Controls */}
          <div className="flex flex-col gap-4 md:col-span-2">
            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-400">{t.wealth.monthlySavingsAdded}</span>
                <span className="text-white font-mono font-bold">{simMonthlySavings} € {language === "fr" ? "/ mois" : "/ mo"}</span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={simMonthlySavings}
                onChange={(e) => setSimMonthlySavings(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-400">{t.wealth.estimatedAnnualYield}</span>
                <span className="text-white font-mono font-bold">{simAnnualRate} % {language === "fr" ? "/ an" : "/ yr"}</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={0.5}
                value={simAnnualRate}
                onChange={(e) => setSimAnnualRate(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-800 rounded-lg cursor-pointer h-1.5"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-zinc-400">{t.wealth.investmentHorizon}</span>
              <div className="flex items-center gap-2">
                {[1, 3, 5, 10, 15].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSimYears(y)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      simYears === y
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {y} {language === "fr" ? `an${y > 1 ? "s" : ""}` : `yr${y > 1 ? "s" : ""}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Projected Result Box */}
          <div className="p-4 sm:p-5 rounded-xl bg-zinc-950/60 border border-white/5 flex flex-col justify-between gap-3">
            <span className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
              {format(t.wealth.projectedWealthInYears, { count: simYears })}
            </span>
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {formatAmount(projectedWealth.futureTotal)}
              </span>
              <div className="flex flex-col gap-1 mt-2.5 pt-2.5 border-t border-white/5 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>{t.wealth.totalContributed} :</span>
                  <span className="font-mono text-zinc-300 font-semibold">{formatAmount(projectedWealth.contributed)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>{t.wealth.generatedInterest} :</span>
                  <span className="font-mono font-bold">+{formatAmount(projectedWealth.interest)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Woob Bank Connection Flow Modal */}
      <WoobModal
        isOpen={isWoobOpen}
        onClose={() => setIsWoobOpen(false)}
        onBankConnected={loadData}
      />

      {/* New Project / Real Estate Modal */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => {
          setIsNewProjectOpen(false)
          setProjectToEdit(null)
        }}
        onSaveProject={handleSaveProject}
        projectToEdit={projectToEdit}
        accounts={accounts}
      />
    </div>
  )
}
