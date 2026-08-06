"use client"

import React, { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  TrendingUp,
  Building2,
  CreditCard,
  Plus,
  RefreshCw,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  ShoppingBag,
  Car,
  Film,
  FileSpreadsheet,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { GoCardlessModal } from "@/components/modals/gocardless-modal"
import { ExportDialog } from "@/components/modals/export-dialog"
import { MOCK_ACCOUNTS, MOCK_TRANSACTIONS, MOCK_PROJECTS } from "@/lib/data/mock-finance"

export function DashboardView() {
  const router = useRouter()
  const { formatAmount } = usePrivacy()
  const [isGoCardlessOpen, setIsGoCardlessOpen] = useState<boolean>(false)
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)

  const accounts = MOCK_ACCOUNTS
  const recentTransactions = MOCK_TRANSACTIONS.slice(0, 4)
  const projects = MOCK_PROJECTS.slice(0, 3)

  const totalBalance = accounts.reduce((acc, curr) => acc + curr.balance, 0)

  const getTxIcon = (category: string) => {
    switch (category) {
      case "Alimentation":
        return ShoppingBag
      case "Transports":
        return Car
      case "Revenus":
        return ArrowDownRight
      default:
        return Film
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Top Banner - Total Balance */}
      <Card className="relative overflow-hidden border-white/10 bg-gradient-to-br from-[#18181B] via-[#18181B] to-indigo-950/30 p-6 md:p-8">
        <div className="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Solde Consolidé Global
              </span>
              <Badge variant="secondary" className="gap-1 text-[11px]">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> GoCardless Connecté
              </Badge>
            </div>

            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight">
                {formatAmount(totalBalance)}
              </h1>
            </div>

            <div className="flex items-center gap-3 mt-1">
              <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-500/20">
                <TrendingUp className="w-3.5 h-3.5" /> +2.4% ce mois
              </span>
              <span className="text-xs text-zinc-400">
                Mis à jour à l'instant
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Button
              className="flex-1 md:flex-none gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20"
              onClick={() => router.push("/depenses")}
            >
              <Plus className="w-4 h-4" /> Nouvelle Dépense
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsExportOpen(true)}
              className="gap-2 border-white/10 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Excel
            </Button>
            <Button
              variant="outline"
              onClick={() => setIsGoCardlessOpen(true)}
              className="gap-2 border-white/10 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-300"
            >
              <RefreshCw className="w-4 h-4 text-zinc-400" /> Synchro
            </Button>
          </div>
        </div>
      </Card>

      {/* Linked Bank Accounts Carousel/Grid */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center px-1">
          <h2 className="text-lg font-bold text-white tracking-tight">Comptes Reliés</h2>
          <span className="text-xs text-zinc-400">3 comptes synchronisés</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {accounts.map((acc) => {
            const Icon = acc.bank === "Revolut" ? CreditCard : Building2
            return (
              <Card
                key={acc.id}
                className="p-5 border-white/10 bg-[#18181B] hover:border-indigo-500/40 transition-all cursor-pointer group relative overflow-hidden"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${acc.color} flex items-center justify-center shadow-md`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <Badge variant="outline" className="text-[11px]">
                    {acc.type}
                  </Badge>
                </div>
                <h3 className="text-sm font-medium text-zinc-400 group-hover:text-zinc-200 transition-colors">
                  {acc.bank}
                </h3>
                <p className="text-2xl font-bold text-white tracking-tight mt-1">
                  {formatAmount(acc.balance)}
                </p>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Bento Grid layout for Analytics, Transactions & Projects */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Main Expenses Graph & Summary */}
        <Card className="md:col-span-8 p-6 border-white/10 bg-[#18181B] flex flex-col justify-between">
          <div className="flex justify-between items-center mb-6">
            <div>
              <CardTitle className="text-lg font-bold">Aperçu des Flux Mensuels</CardTitle>
              <CardDescription className="text-xs text-zinc-400">
                Comparatif des entrées et sorties sur les 30 derniers jours
              </CardDescription>
            </div>
            <Link href="/depenses">
              <Button
                variant="outline"
                size="sm"
                className="text-xs border-white/10 bg-zinc-900 text-zinc-300"
              >
                Détails
              </Button>
            </Link>
          </div>

          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                  <ArrowDownRight className="w-4 h-4" /> Entrées totales
                </span>
                <p className="text-xl font-bold text-white mt-1">
                  {formatAmount(2850.0)}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20">
                <span className="text-xs text-rose-400 font-medium flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" /> Sorties totales
                </span>
                <p className="text-xl font-bold text-white mt-1">
                  {formatAmount(1425.79)}
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-zinc-900/60 border border-white/5 flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Consommation du budget mensuel</span>
                <span className="font-semibold text-indigo-300">50% utilisé</span>
              </div>
              <Progress value={50} className="h-2.5 bg-zinc-800" indicatorClassName="bg-indigo-500" />
            </div>
          </div>
        </Card>

        {/* Top Projects Widget */}
        <Card className="md:col-span-4 p-6 border-white/10 bg-[#18181B] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <CardTitle className="text-lg font-bold">Projets Actifs</CardTitle>
              <Link href="/projets">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-indigo-400 hover:text-indigo-300 p-0"
                >
                  Voir tout
                </Button>
              </Link>
            </div>

            <div className="flex flex-col gap-4">
              {projects.map((proj) => {
                const percent = Math.round((proj.currentAmount / proj.targetAmount) * 100)
                const color = proj.id === "proj_1" ? "bg-emerald-500" : proj.id === "proj_2" ? "bg-indigo-500" : "bg-amber-500"
                return (
                  <div key={proj.id} className="flex flex-col gap-1.5 p-3 rounded-xl bg-zinc-900/40 border border-white/5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-white">{proj.name}</span>
                      <span className="text-zinc-400 font-mono">{percent}%</span>
                    </div>
                    <Progress value={percent} className="h-2 bg-zinc-800" indicatorClassName={color} />
                    <div className="flex justify-between items-center text-[11px] text-zinc-400 mt-0.5">
                      <span>{formatAmount(proj.currentAmount)}</span>
                      <span>Objectif: {formatAmount(proj.targetAmount)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Transactions List */}
      <Card className="p-6 border-white/10 bg-[#18181B]">
        <div className="flex justify-between items-center mb-4">
          <div>
            <CardTitle className="text-lg font-bold">Dernières Transactions</CardTitle>
            <CardDescription className="text-xs text-zinc-400">
              Flux récents agrégés depuis vos comptes
            </CardDescription>
          </div>
          <Link href="/depenses">
            <Button
              variant="outline"
              size="sm"
              className="text-xs border-white/10 bg-zinc-900 text-zinc-300"
            >
              Fil complet
            </Button>
          </Link>
        </div>

        <div className="flex flex-col divide-y divide-white/5">
          {recentTransactions.map((tx) => {
            const Icon = getTxIcon(tx.category)
            const isPositive = tx.amount > 0

            return (
              <div key={tx.id} className="flex justify-between items-center py-3.5 hover:bg-white/[0.02] px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isPositive ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-800 text-zinc-300'}`}>
                    <Icon className="w-4.5 h-4.5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-white">{tx.merchant}</span>
                    <span className="text-xs text-zinc-400">{tx.category} • {tx.date}</span>
                  </div>
                </div>
                <span className={`text-sm font-bold font-mono ${isPositive ? 'text-emerald-400' : 'text-zinc-200'}`}>
                  {isPositive ? '+' : ''}{formatAmount(tx.amount)}
                </span>
              </div>
            )
          })}
        </div>
      </Card>

      {/* GoCardless Modal */}
      <GoCardlessModal
        isOpen={isGoCardlessOpen}
        onClose={() => setIsGoCardlessOpen(false)}
      />

      {/* Export Dialog */}
      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultScope="summary"
        title="Exporter la Synthèse Financière"
      />
    </div>
  )
}
