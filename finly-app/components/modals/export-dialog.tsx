"use client"

import React, { useState, useMemo } from "react"
import {
  FileSpreadsheet,
  Download,
  CheckCircle,
  ShieldCheck,
  Calendar,
  Layers,
  Filter,
  CreditCard,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { executeExport, generateExportFileName, ExportSettings } from "@/lib/export/excel-export"
import { Transaction, Account, Project } from "@/lib/types/finance"

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  defaultScope?: "all" | "transactions" | "projects" | "summary"
  title?: string
  transactions?: Transaction[]
  accounts?: Account[]
  projects?: Project[]
}

export function ExportDialog({
  isOpen,
  onClose,
  defaultScope = "transactions",
  title = "Exportation Excel & Tableaux",
  transactions = [],
  accounts = [],
  projects = [],
}: ExportDialogProps) {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx")
  const [periodMode, setPeriodMode] = useState<"month" | "last_3_months" | "year" | "all">("month")
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    return `${now.getFullYear()}-${month}`
  })
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all")
  const [transactionType, setTransactionType] = useState<"all" | "expense" | "income">("all")
  const [includeFormulas, setIncludeFormulas] = useState<boolean>(true)
  const [includeCategorySummary, setIncludeCategorySummary] = useState<boolean>(true)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportSuccess, setExportSuccess] = useState<boolean>(false)

  // Generate available months list from current date backwards (12 months)
  const availableMonths = useMemo(() => {
    const months: { value: string; label: string }[] = []
    const now = new Date()
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
      const label = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" })
      months.push({
        value: val,
        label: label.charAt(0).toUpperCase() + label.slice(1),
      })
    }
    return months
  }, [])

  // Calculate estimated count of exported transactions
  const previewCount = useMemo(() => {
    let list = [...transactions]
    if (periodMode === "month" && selectedMonth) {
      list = list.filter((t) => (t.date || "").startsWith(selectedMonth))
    } else if (periodMode === "last_3_months") {
      const now = new Date()
      const past = new Date(now)
      past.setMonth(now.getMonth() - 3)
      const pastStr = past.toISOString().slice(0, 10)
      list = list.filter((t) => (t.date || "") >= pastStr)
    } else if (periodMode === "year") {
      const yr = new Date().getFullYear().toString()
      list = list.filter((t) => (t.date || "").startsWith(yr))
    }

    if (selectedAccountId !== "all") {
      list = list.filter((t) => t.account_id === selectedAccountId || t.account === accounts.find(a => a.id === selectedAccountId)?.name)
    }

    if (transactionType === "expense") {
      list = list.filter((t) => t.amount < 0)
    } else if (transactionType === "income") {
      list = list.filter((t) => t.amount > 0)
    }

    return list.length
  }, [transactions, periodMode, selectedMonth, selectedAccountId, transactionType, accounts])

  const handleRunExport = () => {
    setIsExporting(true)
    setTimeout(() => {
      try {
        const settings: ExportSettings = {
          format,
          scope: defaultScope,
          periodMode,
          selectedMonth: periodMode === "month" ? selectedMonth : undefined,
          selectedAccountId,
          transactionType,
          includeFormulas,
          includeCategorySummary,
        }

        executeExport(settings, transactions, projects, accounts)
        setIsExporting(false)
        setExportSuccess(true)
        setTimeout(() => {
          setExportSuccess(false)
          onClose()
        }, 1200)
      } catch {
        setIsExporting(false)
      }
    }, 400)
  }

  const fileName = generateExportFileName(
    {
      format,
      scope: defaultScope,
      periodMode,
      selectedMonth: periodMode === "month" ? selectedMonth : undefined,
      selectedAccountId,
      transactionType,
    },
    format,
    accounts
  )

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-6 max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader className="p-0 text-left">
          <div className="flex justify-between items-start">
            <div>
              <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                {title}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                Personnalisez la période, les filtres et les tableaux du classeur
              </DialogDescription>
            </div>
            <Badge variant="outline" className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] uppercase">
              {format.toUpperCase()}
            </Badge>
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4 mt-3">
          {/* Format Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-zinc-400" />
              Format du fichier
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setFormat("xlsx")}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer text-center ${
                  format === "xlsx"
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20 font-semibold"
                    : "bg-zinc-950/60 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                Excel (.xlsx) Multi-feuilles
              </button>
              <button
                type="button"
                onClick={() => setFormat("csv")}
                className={`py-2 px-3 rounded-xl text-xs font-medium border transition-all cursor-pointer text-center ${
                  format === "csv"
                    ? "bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/20 font-semibold"
                    : "bg-zinc-950/60 border-white/5 text-zinc-400 hover:text-white"
                }`}
              >
                CSV Tableur standard
              </button>
            </div>
          </div>

          {/* Period Mode Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-zinc-400" />
              Période d&apos;exportation
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-zinc-950 p-1 rounded-xl border border-white/5">
              <button
                type="button"
                onClick={() => setPeriodMode("month")}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-center ${
                  periodMode === "month"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Par mois
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("last_3_months")}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-center ${
                  periodMode === "last_3_months"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                3 mois
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("year")}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-center ${
                  periodMode === "year"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Année
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode("all")}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium transition-all cursor-pointer text-center ${
                  periodMode === "all"
                    ? "bg-indigo-600 text-white shadow-sm font-semibold"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Tout
              </button>
            </div>

            {/* If Month mode is selected, show dropdown of months */}
            {periodMode === "month" && (
              <div className="mt-1">
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-white text-xs font-medium focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value} className="bg-zinc-900 text-white">
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Account & Type Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Account Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <CreditCard className="w-3.5 h-3.5 text-zinc-400" />
                Compte bancaire
              </label>
              <select
                value={selectedAccountId}
                onChange={(e) => setSelectedAccountId(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-white text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tous les comptes</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id} className="bg-zinc-900 text-white">
                    {acc.name || acc.bank} ({acc.bank})
                  </option>
                ))}
              </select>
            </div>

            {/* Type Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Filter className="w-3.5 h-3.5 text-zinc-400" />
                Type d&apos;opérations
              </label>
              <select
                value={transactionType}
                onChange={(e) => setTransactionType(e.target.value as any)}
                className="w-full p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-white text-xs focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Toutes (Dépenses & Revenus)</option>
                <option value="expense">Dépenses uniquement</option>
                <option value="income">Revenus uniquement</option>
              </select>
            </div>
          </div>

          {/* Advanced Options */}
          {format === "xlsx" && (
            <div className="flex flex-col gap-2 p-3 rounded-2xl bg-zinc-950/60 border border-white/5">
              <span className="text-xs font-semibold text-zinc-300">Contenu des feuilles Excel</span>
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Feuille de répartition par catégorie</span>
                <input
                  type="checkbox"
                  checked={includeCategorySummary}
                  onChange={(e) => setIncludeCategorySummary(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-zinc-800 text-indigo-600"
                >
                </input>
              </div>
              <div className="flex items-center justify-between text-xs text-zinc-300">
                <span>Formules de calcul automatique (SOMME)</span>
                <input
                  type="checkbox"
                  checked={includeFormulas}
                  onChange={(e) => setIncludeFormulas(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-zinc-800 text-indigo-600"
                >
                </input>
              </div>
            </div>
          )}

          {/* File Name & Preview Info */}
          <div className="p-3 rounded-xl bg-zinc-950/40 border border-white/5 flex items-center justify-between text-xs text-zinc-400">
            <span className="font-mono text-[11px] text-indigo-300 truncate max-w-[240px]">
              {fileName}
            </span>
            <span className="text-[11px] text-zinc-400 font-mono">
              {previewCount > 0 ? `${previewCount} opération(s)` : "Toutes opérations"}
            </span>
          </div>

          {exportSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4" />
              <span>Le fichier {fileName} a été généré avec succès !</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              onClick={handleRunExport}
              disabled={isExporting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 rounded-xl shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? "Génération en cours..." : "Télécharger le Fichier"}</span>
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 rounded-xl cursor-pointer"
            >
              Annuler
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
