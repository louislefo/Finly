"use client"

import React, { useState } from "react"
import {
  FileSpreadsheet,
  Download,
  Calendar,
  Filter,
  CheckCircle,
  Table as TableIcon,
  ShieldCheck,
  FileCheck,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table"

export function ExportView() {
  const { formatAmount } = usePrivacy()
  const [selectedFormat, setSelectedFormat] = useState<string>("xlsx")
  const [includeFormulas, setIncludeFormulas] = useState<boolean>(true)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportDone, setExportDone] = useState<boolean>(false)

  const previewData = [
    { date: "31/07/2026", label: "Carrefour Express", category: "Alimentation", account: "BoursoBank", amount: -42.80 },
    { date: "30/07/2026", label: "Virement Salaire TechCorp", category: "Revenus", account: "BoursoBank", amount: 2850.00 },
    { date: "28/07/2026", label: "TotalEnergies Relais", category: "Transports", account: "Revolut", amount: -65.00 },
    { date: "28/07/2026", label: "Uber Eats", category: "Alimentation", account: "Revolut", amount: -29.90 },
    { date: "25/07/2026", label: "Netflix Subscription", category: "Abonnements", account: "BoursoBank", amount: -17.99 },
    { date: "22/07/2026", label: "Fnac Montparnasse", category: "High-Tech", account: "BoursoBank", amount: -149.00 },
  ]

  const handleExport = () => {
    setIsExporting(true)
    setTimeout(() => {
      setIsExporting(false)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 4000)
    }, 1200)
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Centre d'Exportation Excel</h1>
          <p className="text-xs text-zinc-400">
            Génération de classeurs .xlsx avec formules dynamiques nativement interprétables
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Configuration Panel */}
        <Card className="md:col-span-4 p-6 border-white/10 bg-[#18181B] flex flex-col justify-between">
          <div className="flex flex-col gap-6">
            <div>
              <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" /> Options de Génération
              </CardTitle>
              <CardDescription className="text-xs text-zinc-400 mt-1">
                Configurez le périmètre du fichier exporté
              </CardDescription>
            </div>

            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300">Format de fichier</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={selectedFormat === "xlsx" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFormat("xlsx")}
                    className={selectedFormat === "xlsx" ? "bg-indigo-600 text-white" : "border-white/10 bg-zinc-900 text-zinc-300"}
                  >
                    Excel (.xlsx)
                  </Button>
                  <Button
                    variant={selectedFormat === "csv" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setSelectedFormat("csv")}
                    className={selectedFormat === "csv" ? "bg-indigo-600 text-white" : "border-white/10 bg-zinc-900 text-zinc-300"}
                  >
                    CSV standard
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-300">Période concernée</label>
                <select className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:ring-indigo-500">
                  <option value="current_month">Mois en cours (Juillet 2026)</option>
                  <option value="last_3_months">3 Derniers Mois</option>
                  <option value="year_2026">Année 2026 complète</option>
                  <option value="all">Historique Global</option>
                </select>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5">
                <div className="flex flex-col">
                  <span className="text-xs font-semibold text-white">Formules Dynamiques</span>
                  <span className="text-[11px] text-zinc-400">Insère SOMME et SOMME.SI</span>
                </div>
                <input
                  type="checkbox"
                  checked={includeFormulas}
                  onChange={(e) => setIncludeFormulas(e.target.checked)}
                  className="w-4 h-4 rounded border-white/20 bg-zinc-800 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="pt-6 mt-6 border-t border-white/5 flex flex-col gap-3">
            {exportDone && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
                <CheckCircle className="w-4 h-4" /> Fichier finly_export_2026.xlsx généré !
              </div>
            )}

            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20 py-5"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Génération en cours..." : "Télécharger le classeur Excel"}
            </Button>
          </div>
        </Card>

        {/* Data Preview Table */}
        <Card className="md:col-span-8 p-6 border-white/10 bg-[#18181B] flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                  <TableIcon className="w-5 h-5 text-indigo-400" /> Prévisualisation des Données
                </CardTitle>
                <CardDescription className="text-xs text-zinc-400 mt-0.5">
                  Aperçu structuré des 6 premières lignes exportées
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                6 lignes sélectionnées
              </Badge>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Libellé / Commerçant</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Compte</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((row, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-mono text-xs text-zinc-400">{row.date}</TableCell>
                    <TableCell className="font-semibold text-white">{row.label}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">
                        {row.category}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-zinc-400">{row.account}</TableCell>
                    <TableCell className={`text-right font-mono font-bold text-xs ${row.amount > 0 ? 'text-emerald-400' : 'text-white'}`}>
                      {row.amount > 0 ? '+' : ''}{formatAmount(row.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div className="p-4 rounded-xl bg-zinc-900/40 border border-white/5 mt-6 flex items-center justify-between text-xs text-zinc-400">
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> Données 100% stockées localement
            </span>
            <span>Onglets: Synthèse, Fil_Transactions, Budgets</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
