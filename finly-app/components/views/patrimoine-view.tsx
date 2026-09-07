"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Landmark,
  Wallet,
  PiggyBank,
  TrendingUp,
  Building2,
  CreditCard,
  Plus,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Percent,
  Calendar,
  Layers,
  ChevronRight,
  Sliders,
  DollarSign,
  Briefcase,
  Home,
  MapPin,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Edit2,
  Trash2,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { BankLogo } from "@/components/ui/bank-icons"
import { WoobModal } from "@/components/modals/woob-modal"
import { NewProjectModal } from "@/components/modals/new-project-modal"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account, Project, BankConnection, RealEstateData } from "@/lib/types/finance"

export function PatrimoineView() {
  const router = useRouter()
  const { formatAmount } = usePrivacy()

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
    let liquiditiesAccs: Account[] = []

    let savings = 0
    let savingsAccs: Account[] = []

    let investments = 0
    let investmentsAccs: Account[] = []

    for (const a of accounts) {
      const t = (a.type || "").toLowerCase()
      const n = (a.name || "").toLowerCase()

      if (["pea", "titre", "bourse", "placement", "assurance"].some((k) => t.includes(k) || n.includes(k))) {
        investments += a.balance
        investmentsAccs.push(a)
      } else if (["livret", "epargne", "épargne", "ldd", "lep"].some((k) => t.includes(k) || n.includes(k))) {
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

    const financialAssets = liquidities + savings + investments
    const grossAssets = financialAssets + realEstateGrossValue
    const netWorth = financialAssets + realEstateNetEquity

    return {
      liquidities,
      liquiditiesAccs,
      savings,
      savingsAccs,
      investments,
      investmentsAccs,
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
      alert(err.message || "Erreur lors de l'enregistrement.")
    }
  }

  // Delete Real Estate Project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm("Voulez-vous supprimer ce bien immobilier de votre patrimoine ?")) return
    try {
      await FinlyAPI.deleteProject(projectId)
      await loadData()
    } catch (err: any) {
      alert(err.message || "Erreur suppression.")
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
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex flex-col">
          <h1 className="text-xl font-bold text-white tracking-tight">Patrimoine & Allocation</h1>
          <span className="text-xs text-zinc-400 mt-0.5">
            Synthèse de votre situation nette, valorisation immobilière en temps réel et projections financières
          </span>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleSyncAll}
            disabled={isSyncing}
            variant="outline"
            size="sm"
            className="h-9 px-3.5 gap-2 border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 rounded-2xl cursor-pointer text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncing ? "animate-spin" : ""}`} />
            <span>{isSyncing ? "Synchronisation..." : "Actualiser"}</span>
          </Button>

          <Button
            onClick={() => {
              setProjectToEdit(null)
              setIsNewProjectOpen(true)
            }}
            size="sm"
            className="h-9 px-3.5 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl cursor-pointer text-xs font-semibold shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un Bien / Projet</span>
          </Button>
        </div>
      </div>

      {/* Main KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Patrimoine Net Total */}
        <Card className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Patrimoine Net Total</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {formatAmount(assetCategories.netWorth)}
            </span>
            <span className="block text-[11px] text-zinc-500 mt-0.5">
              Actif Brut : {formatAmount(assetCategories.grossAssets)}
            </span>
          </div>
        </Card>

        {/* Immobilier Net & Encours */}
        <Card className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Patrimoine Immobilier (Net)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Home className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {formatAmount(assetCategories.realEstateNetEquity)}
            </span>
            <span className="block text-[11px] text-zinc-500 mt-0.5">
              Valo Brute : {formatAmount(assetCategories.realEstateGrossValue)} {assetCategories.totalRealEstateDebt > 0 && `• Dette : ${formatAmount(assetCategories.totalRealEstateDebt)}`}
            </span>
          </div>
        </Card>

        {/* Épargne Sécurisée & Placements */}
        <Card className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Épargne & Placements</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <PiggyBank className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {formatAmount(assetCategories.savings + assetCategories.investments)}
            </span>
            <span className="block text-[11px] text-zinc-500 mt-0.5">
              {assetCategories.savingsAccs.length + assetCategories.investmentsAccs.length} comptes de placement
            </span>
          </div>
        </Card>

        {/* Liquidités Disponibles */}
        <Card className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-400">Liquidités (Comptes Courants)</span>
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <span className="text-2xl font-bold font-mono tracking-tight text-white">
              {formatAmount(assetCategories.liquidities)}
            </span>
            <span className="block text-[11px] text-zinc-500 mt-0.5">
              {assetCategories.liquiditiesAccs.length} compte{assetCategories.liquiditiesAccs.length > 1 ? "s" : ""} disponible{assetCategories.liquiditiesAccs.length > 1 ? "s" : ""}
            </span>
          </div>
        </Card>
      </div>

      {/* REAL ESTATE PROPERTIES SECTION */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-400" />
            <h2 className="text-base font-bold text-white tracking-tight">Biens Immobiliers & Emprunts Associés</h2>
            <Badge variant="outline" className="border-white/10 text-xs text-zinc-400">
              {realEstateProjects.length} bien{realEstateProjects.length > 1 ? "s" : ""}
            </Badge>
          </div>

          <Button
            onClick={() => {
              setProjectToEdit(null)
              setIsNewProjectOpen(true)
            }}
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs"
          >
            <Plus className="w-3.5 h-3.5 text-indigo-400" />
            <span>Ajouter un Achat Immobilier</span>
          </Button>
        </div>

        {realEstateProjects.length === 0 ? (
          <Card className="p-8 border-white/10 bg-[#18181B] rounded-3xl text-center flex flex-col items-center justify-center gap-3">
            <div className="p-3 rounded-2xl bg-zinc-900 border border-white/10 text-zinc-500">
              <Home className="w-8 h-8 text-indigo-400" />
            </div>
            <div className="flex flex-col gap-1 max-w-sm">
              <h3 className="text-sm font-bold text-white">Aucun bien immobilier enregistré</h3>
              <p className="text-xs text-zinc-400">
                Ajoutez votre résidence principale ou investissement locatif pour suivre sa valeur en temps réel et l&apos;amortissement de votre prêt.
              </p>
            </div>
            <Button
              onClick={() => {
                setProjectToEdit(null)
                setIsNewProjectOpen(true)
              }}
              size="sm"
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-8 px-3.5 font-semibold"
            >
              Ajouter un bien
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {realEstateProjects.map((p) => {
              const re = p.realEstateData!
              const currentVal = re.currentEstimatedValue || re.propertyPrice || 0
              const purchasePrice = re.propertyPrice || 0
              const gain = currentVal - purchasePrice
              const gainPct = purchasePrice > 0 ? Math.round((gain / purchasePrice) * 1000) / 10 : 0
              const debt = re.hasLoan !== false ? re.remainingLoanBalance ?? re.loanAmount ?? 0 : 0
              const netEquity = Math.max(0, currentVal - debt)
              const isUpdating = reEstimatingId === p.id

              return (
                <Card key={p.id} className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between gap-4">
                  {/* Property Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 text-indigo-400">
                        <Home className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-white">{p.name}</span>
                          <Badge variant="outline" className="border-white/10 bg-zinc-900 text-[10px] text-zinc-400">
                            {re.surfaceM2 ? `${re.surfaceM2} m²` : "Immobilier"}
                          </Badge>
                          {re.isRental && (
                            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px]">
                              Locatif ({re.grossYield ? `${re.grossYield}% brut` : "Loué"})
                            </Badge>
                          )}
                        </div>
                        {re.address && (
                          <div className="flex items-center gap-1 text-[11px] text-zinc-400 mt-0.5">
                            <MapPin className="w-3 h-3 text-indigo-400 shrink-0" />
                            <span className="truncate">{re.address}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        onClick={() => handleRefreshPropertyEstimate(p)}
                        disabled={isUpdating}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                        title="Réestimer la valeur en direct"
                      >
                        <Sparkles className={`w-3.5 h-3.5 text-emerald-400 ${isUpdating ? "animate-spin" : ""}`} />
                      </Button>

                      <Button
                        onClick={() => {
                          setProjectToEdit(p)
                          setIsNewProjectOpen(true)
                        }}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                        title="Modifier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        onClick={() => handleDeleteProject(p.id)}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* Valuation & Equity Metrics */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-2xl bg-zinc-900/60 border border-white/5 text-xs">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Valeur Estimée</span>
                      <span className="text-sm font-bold font-mono text-white">{formatAmount(currentVal)}</span>
                      {re.estimatedPricePerM2 && (
                        <span className="text-[10px] text-zinc-400 font-mono">{re.estimatedPricePerM2} €/m²</span>
                      )}
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Prix d&apos;Achat</span>
                      <span className="text-sm font-bold font-mono text-zinc-300">{formatAmount(purchasePrice)}</span>
                      <span className={`text-[10px] font-semibold flex items-center gap-0.5 ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {gain >= 0 ? "+" : ""}{formatAmount(gain)} ({gainPct}%)
                      </span>
                    </div>

                    <div className="flex flex-col">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Valeur Nette Acquis</span>
                      <span className="text-sm font-bold font-mono text-emerald-400">{formatAmount(netEquity)}</span>
                      <span className="text-[10px] text-zinc-500">Hors dette</span>
                    </div>
                  </div>

                  {/* Loan & Mortgage details if active */}
                  {re.hasLoan !== false && re.loanAmount && re.loanAmount > 0 && (
                    <div className="flex flex-col gap-2 pt-2 border-t border-white/5 text-xs">
                      <div className="flex items-center justify-between text-zinc-400">
                        <div className="flex items-center gap-1.5">
                          <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                          <span>Prêt : {formatAmount(re.loanAmount)} ({re.loanDurationYears} ans à {re.interestRate}%)</span>
                        </div>
                        <span className="font-mono font-bold text-white">{re.monthlyPayment} € / mois</span>
                      </div>

                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-zinc-500">Capital restant dû : <strong className="font-mono text-zinc-300">{formatAmount(debt)}</strong></span>
                        <span className="text-emerald-400 font-semibold">Amorti : {formatAmount(re.capitalAmortized || (re.loanAmount - debt))}</span>
                      </div>

                      {/* Progress bar of loan amortization */}
                      <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          style={{ width: `${re.loanAmount > 0 ? Math.min(100, Math.round(((re.loanAmount - debt) / re.loanAmount) * 100)) : 0}%` }}
                          className="bg-emerald-500 h-full rounded-full"
                        />
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>

      {/* Asset Allocation Breakdown Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Visual Allocation Card */}
        <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl lg:col-span-2 flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>Répartition Globale par Classe d&apos;Actifs</span>
            </CardTitle>
            <span className="text-xs font-mono font-semibold text-zinc-400">
              Total Actif Brut : {formatAmount(assetCategories.grossAssets)}
            </span>
          </div>

          {/* Allocation Bar */}
          {assetCategories.grossAssets > 0 ? (
            <div className="flex flex-col gap-3">
              <div className="h-4 w-full rounded-full bg-zinc-900 border border-white/10 overflow-hidden flex">
                {assetCategories.liquidities > 0 && (
                  <div
                    style={{ width: `${(assetCategories.liquidities / assetCategories.grossAssets) * 100}%` }}
                    className="bg-blue-500 h-full transition-all"
                    title={`Liquidités: ${formatAmount(assetCategories.liquidities)}`}
                  />
                )}
                {assetCategories.savings > 0 && (
                  <div
                    style={{ width: `${(assetCategories.savings / assetCategories.grossAssets) * 100}%` }}
                    className="bg-emerald-500 h-full transition-all"
                    title={`Épargne: ${formatAmount(assetCategories.savings)}`}
                  />
                )}
                {assetCategories.investments > 0 && (
                  <div
                    style={{ width: `${(assetCategories.investments / assetCategories.grossAssets) * 100}%` }}
                    className="bg-purple-500 h-full transition-all"
                    title={`Investissements: ${formatAmount(assetCategories.investments)}`}
                  />
                )}
                {assetCategories.realEstateGrossValue > 0 && (
                  <div
                    style={{ width: `${(assetCategories.realEstateGrossValue / assetCategories.grossAssets) * 100}%` }}
                    className="bg-amber-500 h-full transition-all"
                    title={`Immobilier: ${formatAmount(assetCategories.realEstateGrossValue)}`}
                  />
                )}
              </div>

              {/* Legend Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    <span className="text-xs text-zinc-400">Liquidités</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-white">
                    {formatAmount(assetCategories.liquidities)}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {assetCategories.grossAssets > 0 ? Math.round((assetCategories.liquidities / assetCategories.grossAssets) * 100) : 0}% du total
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs text-zinc-400">Épargne</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-white">
                    {formatAmount(assetCategories.savings)}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {assetCategories.grossAssets > 0 ? Math.round((assetCategories.savings / assetCategories.grossAssets) * 100) : 0}% du total
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                    <span className="text-xs text-zinc-400">Bourse & Titres</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-white">
                    {formatAmount(assetCategories.investments)}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {assetCategories.grossAssets > 0 ? Math.round((assetCategories.investments / assetCategories.grossAssets) * 100) : 0}% du total
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs text-zinc-400">Immobilier Brut</span>
                  </div>
                  <span className="text-sm font-bold font-mono text-white">
                    {formatAmount(assetCategories.realEstateGrossValue)}
                  </span>
                  <span className="text-[10px] text-zinc-500">
                    {assetCategories.grossAssets > 0 ? Math.round((assetCategories.realEstateGrossValue / assetCategories.grossAssets) * 100) : 0}% du total
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-zinc-500">
              Aucun actif détecté pour l&apos;instant.
            </div>
          )}

          {/* Underlying Accounts Detail List */}
          <div className="flex flex-col gap-3 pt-2">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Comptes bancaires rattachés</span>
            <div className="divide-y divide-white/5 border border-white/5 rounded-2xl bg-zinc-900/40 overflow-hidden">
              {accounts.map((acc) => (
                <div key={acc.id} className="p-3 flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-zinc-400 font-medium">{acc.bank}</span>
                    <span className="text-zinc-600">•</span>
                    <span className="text-white font-semibold truncate">{acc.name || "Compte"}</span>
                    <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-400 text-[10px] py-0 px-1.5 hidden sm:inline">
                      {acc.type || "Courant"}
                    </Badge>
                  </div>
                  <span className="font-mono font-bold text-white shrink-0">
                    {formatAmount(acc.balance)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Bank Institutions Breakdown Card */}
        <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col gap-5">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-indigo-400" />
              <span>Par Banque</span>
            </CardTitle>
            <span className="text-xs text-zinc-400">{bankBreakdown.length} banques</span>
          </div>

          <div className="flex flex-col gap-3">
            {bankBreakdown.map((b) => {
              const pct = assetCategories.financialAssets > 0 ? Math.round((b.total / assetCategories.financialAssets) * 100) : 0
              return (
                <div key={b.bankName} className="p-3.5 rounded-2xl bg-zinc-900/60 border border-white/5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-lg bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                        <BankLogo bankName={b.bankName} className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-white">{b.bankName}</span>
                        <span className="text-[10px] text-zinc-500">{b.count} compte{b.count > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="text-xs font-bold font-mono text-white">{formatAmount(b.total)}</span>
                      <span className="text-[10px] text-zinc-500">{pct}% des liquidités</span>
                    </div>
                  </div>
                  <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
                    <div style={{ width: `${pct}%` }} className="bg-indigo-500 h-full rounded-full" />
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      </div>

      {/* Wealth Simulator / Projection Section */}
      <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-emerald-400" />
            <CardTitle className="text-base font-bold text-white">
              Simulateur d&apos;Évolution Patrimoniale
            </CardTitle>
          </div>
          <span className="text-xs text-zinc-400">Projection mathématique à intérêts composés</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {/* Controls */}
          <div className="flex flex-col gap-4 md:col-span-2">
            {/* Monthly Savings Input */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-400">Épargne mensuelle ajoutée</span>
                <span className="text-white font-mono font-bold">{simMonthlySavings} € / mois</span>
              </div>
              <input
                type="range"
                min={0}
                max={5000}
                step={50}
                value={simMonthlySavings}
                onChange={(e) => setSimMonthlySavings(Number(e.target.value))}
                className="w-full accent-indigo-500 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Annual Yield Input */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between text-xs font-medium">
                <span className="text-zinc-400">Rendement annuel estimé</span>
                <span className="text-white font-mono font-bold">{simAnnualRate} % / an</span>
              </div>
              <input
                type="range"
                min={1}
                max={12}
                step={0.5}
                value={simAnnualRate}
                onChange={(e) => setSimAnnualRate(Number(e.target.value))}
                className="w-full accent-emerald-500 bg-zinc-800 rounded-lg cursor-pointer"
              />
            </div>

            {/* Time Horizon */}
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-zinc-400">Horizon d&apos;investissement</span>
              <div className="flex items-center gap-2">
                {[1, 3, 5, 10, 15].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSimYears(y)}
                    className={`flex-1 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      simYears === y
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white"
                    }`}
                  >
                    {y} an{y > 1 ? "s" : ""}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Projected Result Card */}
          <div className="p-5 rounded-3xl bg-zinc-900/90 border border-white/10 flex flex-col justify-between gap-4">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Patrimoine Net dans {simYears} an{simYears > 1 ? "s" : ""}
            </span>
            <div className="flex flex-col">
              <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {formatAmount(projectedWealth.futureTotal)}
              </span>
              <div className="flex flex-col gap-1 mt-3 pt-3 border-t border-white/10 text-xs text-zinc-400">
                <div className="flex justify-between">
                  <span>Capital de départ + versements :</span>
                  <span className="font-mono text-zinc-300 font-semibold">{formatAmount(projectedWealth.contributed)}</span>
                </div>
                <div className="flex justify-between text-emerald-400">
                  <span>Intérêts composés générés :</span>
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
