"use client"

import React, { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"

const ExpensesMap = dynamic(
  () => import("@/components/charts/expenses-map").then((mod) => mod.ExpensesMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[360px] md:h-[440px] rounded-3xl bg-[#18181B] border border-white/10 flex items-center justify-center text-xs text-zinc-500">
        Chargement de la carte des dépenses...
      </div>
    ),
  }
)
import {
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShoppingBag,
  Car,
  Film,
  FileSpreadsheet,
  PlusCircle,
  CheckCircle2,
  Wallet,
  Building2,
  ChevronRight,
  PiggyBank,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { WoobModal } from "@/components/modals/woob-modal"
import { ConnectedAccountsModal } from "@/components/modals/connected-accounts-modal"
import { BankDetailSheet } from "@/components/modals/bank-detail-sheet"
import { ExportDialog } from "@/components/modals/export-dialog"
import { EvolutionChart } from "@/components/charts/evolution-chart"
import { BankLogo } from "@/components/ui/bank-icons"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account, Transaction, Project } from "@/lib/types/finance"
import { getBrandLogoUrl } from "@/lib/utils/brand-logos"

export function DashboardView() {
  const router = useRouter()
  const { formatAmount } = usePrivacy()
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [isConnectedAccountsOpen, setIsConnectedAccountsOpen] = useState<boolean>(false)
  const [selectedBankForDetail, setSelectedBankForDetail] = useState<string | null>(null)
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)
  const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null)

  const [accounts, setAccounts] = useState<Account[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [totalBalance, setTotalBalance] = useState<number>(0)

  const loadData = useCallback(async () => {
    try {
      const [accRes, txRes, projRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getTransactions(),
        FinlyAPI.getProjects(),
      ])

      setAccounts(accRes.accounts || [])
      setTotalBalance(accRes.total_balance ?? 0)
      setTransactions(txRes.transactions || [])
      setProjects(projRes || [])
    } catch (err) {
      console.error("Erreur chargement données Finly:", err)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Checking accounts (Comptes Courants)
  const checkingAccounts = accounts.filter(
    (a) => !a.type || a.type === "Compte Courant" || a.type.toLowerCase().includes("courant") || a.type.toLowerCase().includes("dépôt") || a.type.toLowerCase().includes("depot")
  )
  const savingsAccounts = accounts.filter(
    (a) => a.type === "Épargne" || a.type.toLowerCase().includes("livret") || a.type.toLowerCase().includes("epargne") || a.type.toLowerCase().includes("épargne")
  )
  const investmentAccounts = accounts.filter(
    (a) => a.type === "Investissement" || a.type === "Assurance-Vie" || a.type.toLowerCase().includes("pea") || a.type.toLowerCase().includes("vie") || a.type.toLowerCase().includes("action")
  )

  const checkingBalance = checkingAccounts.reduce((acc, a) => acc + a.balance, 0)
  const savingsBalance = savingsAccounts.reduce((acc, a) => acc + a.balance, 0)
  const investmentBalance = investmentAccounts.reduce((acc, a) => acc + a.balance, 0)

  // Group accounts by unique Bank name
  const bankNames = Array.from(new Set(accounts.map((a) => a.bank).filter(Boolean)))
  const bankGroups = bankNames.map((bankName) => {
    const bankAccs = accounts.filter((a) => a.bank === bankName)
    const bankTotal = bankAccs.reduce((sum, a) => sum + a.balance, 0)
    return {
      bankName,
      accounts: bankAccs,
      totalBalance: bankTotal,
    }
  })

  // Checking-only transactions for everyday dashboard flow
  const checkingAccountIds = new Set(checkingAccounts.map((a) => a.id))
  const checkingTransactions = transactions.filter(
    (t) => checkingAccountIds.size === 0 || checkingAccountIds.has(t.account) || !accounts.some((a) => a.id === t.account && a.type !== "Compte Courant")
  )

  const recentTransactions = checkingTransactions.slice(0, 4)
  const totalInflow = checkingTransactions.filter((t) => t.amount > 0).reduce((acc, t) => acc + t.amount, 0)
  const totalOutflow = checkingTransactions.filter((t) => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0)

  const handleManualSync = async () => {
    setIsSyncing(true)
    setSyncSuccessMessage(null)

    try {
      const res: any = await FinlyAPI.triggerSync()
      await loadData()
      const newTxCount = res?.result?.new_transactions ?? res?.data?.new_transactions
      if (typeof newTxCount === "number" && newTxCount > 0) {
        setSyncSuccessMessage(`${newTxCount} nouvelle(s) opération(s) synchronisée(s)`)
      } else {
        setSyncSuccessMessage("Soldes et opérations à jour")
      }
      setTimeout(() => {
        setSyncSuccessMessage(null)
      }, 3000)
    } catch {
      await loadData()
      setSyncSuccessMessage("Actualisation terminée")
      setTimeout(() => {
        setSyncSuccessMessage(null)
      }, 2500)
    } finally {
      setIsSyncing(false)
    }
  }

  const handleBankConnected = async () => {
    await loadData()
  }

  const getTxIcon = (category: string) => {
    switch (category) {
      case "Alimentation":
        return ShoppingBag
      case "Transports":
        return Car
      case "Revenus":
      case "Virement Reçu":
        return ArrowDownRight
      default:
        return Film
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Toast Notification */}
      {syncSuccessMessage && (
        <div className="p-3 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs flex items-center justify-between animate-in fade-in duration-200">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{syncSuccessMessage}</span>
          </div>
        </div>
      )}

      {/* Main Balance Banner: Focus on Compte Courant */}
      <Card className="border-white/10 bg-[#18181B] p-6 md:p-8">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              Solde Compte Courant
            </span>
            <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
              {formatAmount(checkingBalance)}
            </h1>

            {accounts.length > 0 && (
              <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-400 flex-wrap">
                <span className="p-1.5 px-2.5 rounded-lg bg-zinc-900/80 border border-white/5">
                  Patrimoine Global : <strong className="text-white font-mono">{formatAmount(totalBalance)}</strong>
                </span>
                <span className="p-1.5 px-2.5 rounded-lg bg-zinc-900/80 border border-white/5">
                  Épargne & Placements : <strong className="text-emerald-400 font-mono">{formatAmount(savingsBalance + investmentBalance)}</strong>
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap sm:flex-nowrap">
            <Button
              onClick={handleManualSync}
              disabled={isSyncing}
              variant="outline"
              size="sm"
              className="gap-2 border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>{isSyncing ? "Actualisation..." : "Actualiser"}</span>
            </Button>

            <Button
              className="flex-1 sm:flex-none gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20"
              size="sm"
              onClick={() => router.push("/depenses")}
            >
              <Plus className="w-4 h-4" /> Dépenses Courantes
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsExportOpen(true)}
              className="gap-2 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" /> Exporter
            </Button>
          </div>
        </div>
      </Card>

      {/* 1. Compte Courant Section */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
            <Wallet className="w-4 h-4 text-indigo-400" /> Compte Courant
          </h2>
          {accounts.length > 0 && (
            <button
              onClick={() => setIsConnectedAccountsOpen(true)}
              className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              Gérer les comptes ({accounts.length})
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {checkingAccounts.length === 0 ? (
            <Card
              onClick={() => setIsWoobOpen(true)}
              className="p-4 border-dashed border-white/15 bg-transparent hover:border-white/30 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 min-h-[105px]"
            >
              <PlusCircle className="w-5 h-5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">
                Connecter un compte courant
              </span>
            </Card>
          ) : (
            checkingAccounts.map((acc) => (
              <Card
                key={acc.id}
                onClick={() => setSelectedBankForDetail(acc.bank)}
                className="p-4 border-white/10 bg-[#18181B] hover:border-indigo-500/40 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex justify-between items-start mb-3">
                  <BankLogo bankId={acc.bank} className="w-9 h-9 shrink-0" />
                  <Badge variant="outline" className="text-[10px] font-normal py-0">
                    {acc.type || "Courant"}
                  </Badge>
                </div>
                <div>
                  <h3 className="text-xs text-zinc-400 group-hover:text-white transition-colors truncate">
                    {acc.name || acc.bank}
                  </h3>
                  <p className="text-2xl font-bold text-white tracking-tight mt-0.5">
                    {formatAmount(acc.balance)}
                  </p>
                </div>
              </Card>
            ))
          )}

          {checkingAccounts.length > 0 && (
            <Card
              onClick={() => setIsWoobOpen(true)}
              className="p-4 border-dashed border-white/15 bg-transparent hover:border-white/30 transition-all cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 min-h-[105px]"
            >
              <PlusCircle className="w-5 h-5 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-300">
                Ajouter une banque
              </span>
            </Card>
          )}
        </div>
      </div>

      {/* 2. Mes Banques & Tous les Sous-Comptes */}
      {bankGroups.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center px-1">
            <h2 className="text-sm font-semibold text-zinc-300 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-emerald-400" /> Mes Banques Connectées
            </h2>
            <span className="text-xs text-zinc-500">
              Cliquez sur une banque pour voir tous ses comptes
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {bankGroups.map((group) => (
              <Card
                key={group.bankName}
                onClick={() => setSelectedBankForDetail(group.bankName)}
                className="p-4 border-white/10 bg-[#18181B] hover:border-emerald-500/40 hover:bg-zinc-900 transition-all cursor-pointer flex flex-col justify-between group"
              >
                <div className="flex justify-between items-start mb-3">
                  <BankLogo bankId={group.bankName} className="w-10 h-10 shrink-0" />
                  <Badge variant="outline" className="text-[10px] py-0 border-white/10 text-zinc-300">
                    {group.accounts.length} compte{group.accounts.length > 1 ? "s" : ""}
                  </Badge>
                </div>

                <div className="flex justify-between items-end">
                  <div>
                    <h3 className="text-sm font-semibold text-white group-hover:text-emerald-300 transition-colors">
                      {group.bankName}
                    </h3>
                    <p className="text-lg font-bold text-white tracking-tight mt-0.5">
                      {formatAmount(group.totalBalance)}
                    </p>
                  </div>
                  <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-white/10 transition-all">
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Bento Grid: Chart & Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Evolution Chart (8 Cols) */}
        <Card className="md:col-span-8 p-6 border-white/10 bg-[#18181B] flex flex-col justify-between">
          <EvolutionChart accounts={accounts} transactions={transactions} />
        </Card>

        {/* Right Bento Widgets (4 Cols) */}
        <div className="md:col-span-4 flex flex-col gap-6">
          {/* Top Expenses Widget */}
          <Card className="p-5 border-white/10 bg-[#18181B] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <CardTitle className="text-sm font-semibold">Dépenses Courantes</CardTitle>
              <Link href="/depenses" className="text-xs text-zinc-400 hover:text-white">
                Voir tout
              </Link>
            </div>

            <div className="flex flex-col divide-y divide-white/5">
              {recentTransactions.length === 0 ? (
                <div className="py-5 text-center text-xs text-zinc-500">
                  Aucune dépense enregistrée
                </div>
              ) : (
                recentTransactions.slice(0, 3).map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center py-2 first:pt-0 last:pb-0">
                    <span className="text-xs text-zinc-300 truncate max-w-[140px]">
                      {tx.merchant}
                    </span>
                    <span className={`text-xs font-bold font-mono ${tx.amount > 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {tx.amount > 0 ? '+' : ''}{formatAmount(tx.amount)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* Projects Widget */}
          <Card className="p-5 border-white/10 bg-[#18181B] flex flex-col justify-between">
            <div className="flex justify-between items-center mb-3">
              <CardTitle className="text-sm font-semibold">Objectifs</CardTitle>
              <Link href="/projets" className="text-xs text-zinc-400 hover:text-white">
                Voir tout
              </Link>
            </div>

            <div className="flex flex-col gap-3">
              {projects.length === 0 ? (
                <div className="py-5 text-center text-xs text-zinc-500">
                  Aucun objectif actif
                </div>
              ) : (
                projects.slice(0, 2).map((proj) => {
                  const percent = Math.round((proj.currentAmount / proj.targetAmount) * 100)
                  return (
                    <div key={proj.id} className="flex flex-col gap-1 p-2.5 rounded-xl bg-zinc-900/40 border border-white/5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-medium text-white">{proj.name}</span>
                        <span className="text-zinc-400 font-mono">{percent}%</span>
                      </div>
                      <Progress value={percent} className="h-1.5 bg-zinc-800" indicatorClassName="bg-indigo-500" />
                    </div>
                  )
                })
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Recent Transactions Section */}
      <Card className="p-6 border-white/10 bg-[#18181B]">
        <div className="flex justify-between items-center mb-4">
          <CardTitle className="text-base font-semibold">Historique Compte Courant</CardTitle>
          <Link href="/depenses">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
            >
              Fil complet
            </Button>
          </Link>
        </div>

        <div className="flex flex-col divide-y divide-white/5">
          {recentTransactions.length === 0 ? (
            <div className="py-6 text-center text-xs text-zinc-500">
              Aucune opération enregistrée sur le compte courant.
            </div>
          ) : (
            recentTransactions.map((tx) => {
              const Icon = getTxIcon(tx.category)
              const isPositive = tx.amount > 0
              const rawText = tx.rawLabel || (tx as any).raw_label || ""
              const brandLogo = getBrandLogoUrl(tx.merchant, rawText)

              return (
                <div key={tx.id} className="flex justify-between items-center py-3 hover:bg-white/[0.02] px-1 rounded-lg transition-colors">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 overflow-hidden ${
                      brandLogo
                        ? "bg-zinc-900 border border-white/10 p-1.5"
                        : "bg-zinc-900 border border-white/5 text-zinc-300"
                    }`}>
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
                        <Icon className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-white">{tx.merchant}</span>
                      <span className="text-[11px] text-zinc-400">{tx.category} • {tx.date}</span>
                    </div>
                  </div>
                  <span className={`text-sm font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-white'}`}>
                    {isPositive ? '+' : ''}{formatAmount(tx.amount)}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* Interactive Expenses Map (mapcn Dark & White) */}
      <ExpensesMap transactions={transactions} />

      {/* Modals & Sheets */}
      <WoobModal
        isOpen={isWoobOpen}
        onClose={() => setIsWoobOpen(false)}
        onBankConnected={handleBankConnected}
      />

      <ConnectedAccountsModal
        isOpen={isConnectedAccountsOpen}
        onClose={() => setIsConnectedAccountsOpen(false)}
        accounts={accounts}
        onAccountsUpdated={loadData}
        onOpenAddBank={() => setIsWoobOpen(true)}
      />

      <BankDetailSheet
        isOpen={!!selectedBankForDetail}
        onClose={() => setSelectedBankForDetail(null)}
        bankName={selectedBankForDetail}
        accounts={accounts}
      />

      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultScope="summary"
        title="Exporter la Synthèse"
        accounts={accounts}
        transactions={transactions}
        projects={projects}
      />
    </div>
  )
}
