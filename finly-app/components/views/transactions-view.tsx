"use client"

import React, { useState } from "react"
import {
  Search,
  ShoppingBag,
  Car,
  Home as HomeIcon,
  Film,
  Utensils,
  ArrowDownRight,
  ChevronRight,
  Building2,
  Tag,
  Clock,
  FileSpreadsheet,
  Download,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { ExportDialog } from "@/components/modals/export-dialog"
import { MOCK_TRANSACTIONS } from "@/lib/data/mock-finance"
import { Transaction } from "@/lib/types/finance"

export function TransactionsView() {
  const { formatAmount } = usePrivacy()
  const [period, setPeriod] = useState<string>("month")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [selectedAccount, setSelectedAccount] = useState<string>("all")
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)

  const transactionsData = MOCK_TRANSACTIONS

  const filteredTransactions = transactionsData.filter((tx) => {
    const matchesSearch =
      tx.merchant.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.category.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesAccount =
      selectedAccount === "all" || tx.account === selectedAccount
    return matchesSearch && matchesAccount
  })

  // Group by date
  const groupedByDate: Record<string, Transaction[]> = {}
  filteredTransactions.forEach((tx) => {
    if (!groupedByDate[tx.date]) {
      groupedByDate[tx.date] = []
    }
    groupedByDate[tx.date].push(tx)
  })

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Alimentation":
        return ShoppingBag
      case "Transports":
        return Car
      case "Logement":
        return HomeIcon
      case "Abonnements":
        return Film
      case "Revenus":
        return ArrowDownRight
      default:
        return ShoppingBag
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Header Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Fil des Dépenses</h1>
          <p className="text-xs text-zinc-400">
            Historique complet et catégorisé des transactions
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Integrated Excel Export Button */}
          <Button
            onClick={() => setIsExportOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Exporter en Excel</span>
          </Button>

          {/* Granularity Tabs */}
          <Tabs value={period} onValueChange={setPeriod} className="w-full md:w-auto">
            <TabsList className="w-full md:w-auto grid grid-cols-3">
              <TabsTrigger value="day">Jour</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
              <TabsTrigger value="year">Année</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Search and Filters bar */}
      <Card className="p-4 border-white/10 bg-[#18181B] flex flex-col md:flex-row items-center gap-3">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <Input
            type="text"
            placeholder="Rechercher un marchand, catégorie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 bg-zinc-900/80 border-white/10 text-white text-sm placeholder:text-zinc-500 focus-visible:ring-indigo-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Button
            variant={selectedAccount === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedAccount("all")}
            className={selectedAccount === "all" ? "bg-indigo-600 text-white" : "border-white/10 bg-zinc-900 text-zinc-300"}
          >
            Tous les comptes
          </Button>
          <Button
            variant={selectedAccount === "BoursoBank" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedAccount("BoursoBank")}
            className={selectedAccount === "BoursoBank" ? "bg-indigo-600 text-white" : "border-white/10 bg-zinc-900 text-zinc-300"}
          >
            BoursoBank
          </Button>
          <Button
            variant={selectedAccount === "Revolut" ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedAccount("Revolut")}
            className={selectedAccount === "Revolut" ? "bg-indigo-600 text-white" : "border-white/10 bg-zinc-900 text-zinc-300"}
          >
            Revolut
          </Button>
        </div>
      </Card>

      {/* Grouped Transactions List */}
      <div className="flex flex-col gap-6">
        {Object.keys(groupedByDate).length === 0 ? (
          <Card className="p-12 text-center border-white/10 bg-[#18181B]">
            <p className="text-sm text-zinc-400">Aucune transaction trouvée.</p>
          </Card>
        ) : (
          Object.entries(groupedByDate).map(([dateStr, items]) => (
            <div key={dateStr} className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
                  {dateStr}
                </span>
                <span className="text-xs text-zinc-500 font-mono">
                  {items.length} opérations
                </span>
              </div>

              <Card className="border-white/10 bg-[#18181B] divide-y divide-white/5 overflow-hidden">
                {items.map((tx) => {
                  const Icon = getCategoryIcon(tx.category)
                  const isPositive = tx.amount > 0

                  return (
                    <div
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className="flex justify-between items-center p-4 hover:bg-white/[0.03] transition-colors cursor-pointer group"
                    >
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isPositive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                              : "bg-zinc-900 text-zinc-300 border border-white/5"
                          }`}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                            {tx.merchant}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[10px] py-0">
                              {tx.category}
                            </Badge>
                            <span className="text-xs text-zinc-500">• {tx.account}</span>
                            {tx.project && (
                              <Badge variant="default" className="text-[10px] py-0 bg-indigo-500/20 text-indigo-300">
                                {tx.project}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`text-base font-bold font-mono ${
                            isPositive ? "text-emerald-400" : "text-white"
                          }`}
                        >
                          {isPositive ? "+" : ""}
                          {formatAmount(tx.amount)}
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

      {/* Embedded Export Dialog */}
      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultScope="transactions"
        title="Exporter les Transactions (Excel / CSV)"
      />

      {/* Transaction Detail Sheet / Drawer (iOS style) */}
      <Sheet open={!!selectedTx} onOpenChange={() => setSelectedTx(null)}>
        <SheetContent side="bottom" className="bg-[#18181B] border-t border-white/10 text-white rounded-t-3xl p-6 max-w-2xl mx-auto">
          {selectedTx && (
            <div className="flex flex-col gap-6">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

              <SheetHeader className="p-0 text-left">
                <div className="flex justify-between items-start">
                  <div>
                    <SheetTitle className="text-xl font-bold text-white">
                      {selectedTx.merchant}
                    </SheetTitle>
                    <SheetDescription className="text-xs text-zinc-400 mt-1">
                      Détails de la transaction bancaire GoCardless
                    </SheetDescription>
                  </div>
                  <Badge variant={selectedTx.amount > 0 ? "secondary" : "destructive"} className="text-sm px-3 py-1 font-mono">
                    {selectedTx.amount > 0 ? "+" : ""}{formatAmount(selectedTx.amount)}
                  </Badge>
                </div>
              </SheetHeader>

              <div className="flex flex-col gap-3 p-4 rounded-2xl bg-zinc-900/60 border border-white/5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-400" /> Catégorie
                  </span>
                  <span className="font-semibold text-white">{selectedTx.category}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5 text-indigo-400" /> Compte source
                  </span>
                  <span className="font-semibold text-white">{selectedTx.account}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" /> Date & Heure
                  </span>
                  <span className="font-semibold text-white">{selectedTx.date} à {selectedTx.time}</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Libellé Bancaire Brut
                </span>
                <p className="p-3 rounded-xl bg-zinc-950 font-mono text-xs text-zinc-300 border border-white/5 break-all">
                  {selectedTx.rawLabel}
                </p>
              </div>

              <div className="flex gap-3 mt-2">
                <Button className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium">
                  Rattacher à un Projet
                </Button>
                <Button variant="outline" className="border-white/10 bg-zinc-900 text-zinc-300" onClick={() => setSelectedTx(null)}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
