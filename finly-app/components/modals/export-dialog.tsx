"use client"

import React, { useState } from "react"
import {
  FileSpreadsheet,
  Download,
  CheckCircle,
  ShieldCheck,
  Table as TableIcon,
  X,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { executeExportSimulation, generateExportFileName } from "@/lib/export/excel-export"

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  defaultScope?: "all" | "transactions" | "projects" | "summary"
  title?: string
}

export function ExportDialog({
  isOpen,
  onClose,
  defaultScope = "transactions",
  title = "Exportation Excel & CSV",
}: ExportDialogProps) {
  const [format, setFormat] = useState<"xlsx" | "csv">("xlsx")
  const [period, setPeriod] = useState<string>("current_month")
  const [includeFormulas, setIncludeFormulas] = useState<boolean>(true)
  const [isExporting, setIsExporting] = useState<boolean>(false)
  const [exportSuccess, setExportSuccess] = useState<boolean>(false)

  const handleRunExport = () => {
    setIsExporting(true)
    executeExportSimulation(
      {
        format,
        period: period as any,
        includeFormulas,
        scope: defaultScope,
      },
      () => {
        setIsExporting(false)
        setExportSuccess(true)
        setTimeout(() => {
          setExportSuccess(false)
          onClose()
        }, 1500)
      }
    )
  }

  const fileName = generateExportFileName(defaultScope, format)

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-[#18181B] border-t border-white/10 text-white rounded-t-3xl p-6 max-w-xl mx-auto">
        <div className="flex flex-col gap-5">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

          <SheetHeader className="p-0 text-left">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                  {title}
                </SheetTitle>
                <SheetDescription className="text-xs text-zinc-400 mt-1">
                  Génération d'un classeur avec formules dynamiques (SOMME, SOMME.SI)
                </SheetDescription>
              </div>
              <Badge variant="outline" className="text-xs">
                {defaultScope.toUpperCase()}
              </Badge>
            </div>
          </SheetHeader>

          {/* Configuration Options */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-300">Format d'Export</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant={format === "xlsx" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("xlsx")}
                  className={format === "xlsx" ? "bg-indigo-600 text-white" : "border-white/10 bg-zinc-900 text-zinc-300"}
                >
                  Excel (.xlsx)
                </Button>
                <Button
                  variant={format === "csv" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFormat("csv")}
                  className={format === "csv" ? "bg-indigo-600 text-white" : "border-white/10 bg-zinc-900 text-zinc-300"}
                >
                  CSV standard
                </Button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-semibold text-zinc-300">Plage de Dates</label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs focus:ring-indigo-500"
              >
                <option value="current_month">Mois en cours (Juillet 2026)</option>
                <option value="last_3_months">3 Derniers Mois</option>
                <option value="year_2026">Année 2026 complète</option>
                <option value="all">Historique Global</option>
              </select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/60 border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">Formules Dynamiques Excel</span>
                <span className="text-[10px] text-zinc-400">Génère les fonctions SOMME et SOMME.SI</span>
              </div>
              <input
                type="checkbox"
                checked={includeFormulas}
                onChange={(e) => setIncludeFormulas(e.target.checked)}
                className="w-4 h-4 rounded border-white/20 bg-zinc-800 text-indigo-600 focus:ring-indigo-500"
              />
            </div>

            <div className="p-3 rounded-xl bg-zinc-900/30 border border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span className="font-mono text-[11px] text-indigo-300">{fileName}</span>
              <span className="flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" /> Export Sécurisé
              </span>
            </div>
          </div>

          {exportSuccess && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Le fichier {fileName} a été généré et téléchargé !
            </div>
          )}

          <div className="flex gap-3 mt-2">
            <Button
              onClick={handleRunExport}
              disabled={isExporting}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-2 py-5 shadow-lg shadow-indigo-600/20"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "Génération..." : "Télécharger Fichier"}
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-zinc-900 text-zinc-300"
            >
              Annuler
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
