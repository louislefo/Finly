"use client"

import React, { useState, useRef, useEffect } from "react"
import {
  FileSpreadsheet,
  Upload,
  ClipboardPaste,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  Edit2,
  Check,
  Building2,
  Wallet,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account } from "@/lib/types/finance"
import { usePrivacy } from "@/components/privacy-context"

interface CsvImportModalProps {
  isOpen: boolean
  onClose: () => void
  onImportSuccess?: () => void
}

const ACCOUNT_TYPES = [
  "Compte Courant",
  "Épargne / Livret",
  "Investissement / Bourse",
  "Carte de Crédit",
  "Autre",
]

export function CsvImportModal({ isOpen, onClose, onImportSuccess }: CsvImportModalProps) {
  const { formatAmount } = usePrivacy()
  const [step, setStep] = useState<"input" | "preview" | "success">("input")
  const [inputMode, setInputMode] = useState<"file" | "paste">("file")
  const [csvText, setCsvText] = useState<string>("")
  const [fileName, setFileName] = useState<string>("")
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false)
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string>("")

  // Accounts & Custom Title / Type state
  const [accounts, setAccounts] = useState<Account[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<string>("")
  const [customAccountTitle, setCustomAccountTitle] = useState<string>("")
  const [customAccountType, setCustomAccountType] = useState<string>("Compte Courant")
  const [isCreatingNewAccount, setIsCreatingNewAccount] = useState<boolean>(true)

  // Preview / Mapping state
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [editableTransactions, setEditableTransactions] = useState<any[]>([])
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null)
  const [dateCol, setDateCol] = useState<number>(0)
  const [amountCol, setAmountCol] = useState<number>(1)
  const [labelCol, setLabelCol] = useState<number | undefined>(undefined)
  const [categoryCol, setCategoryCol] = useState<number | undefined>(undefined)

  // Success summary
  const [importSummary, setImportSummary] = useState<{
    imported_count: number
    updated_count: number
    account_name: string
  } | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing accounts
  useEffect(() => {
    if (isOpen) {
      FinlyAPI.getAccounts()
        .then((res) => {
          setAccounts(res.accounts || [])
          if (res.accounts && res.accounts.length > 0) {
            setSelectedAccountId(res.accounts[0].id)
          } else {
            setIsCreatingNewAccount(true)
          }
        })
        .catch(() => {})
    }
  }, [isOpen])

  const handleReset = () => {
    setStep("input")
    setCsvText("")
    setFileName("")
    setErrorMessage("")
    setAnalysisResult(null)
    setEditableTransactions([])
    setEditingRowIdx(null)
    setImportSummary(null)
    onClose()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setErrorMessage("")
    // Propose file name without extension as default account title if not set
    const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ")
    if (!customAccountTitle) {
      setCustomAccountTitle(baseName)
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const content = (event.target?.result as string) || ""
      setCsvText(content)
      handleAnalyze(content)
    }
    reader.onerror = () => {
      setErrorMessage("Erreur lors de la lecture du fichier.")
    }
    reader.readAsText(file)
  }

  const handleAnalyze = async (textToAnalyze: string, customMap?: any) => {
    if (!textToAnalyze.trim()) {
      setErrorMessage("Veuillez fournir du contenu CSV ou un relevé de compte.")
      return
    }

    setIsAnalyzing(true)
    setErrorMessage("")
    try {
      const res = await FinlyAPI.previewCsvTransactions({
        csv_text: textToAnalyze,
        custom_mapping: customMap,
      })

      if (res.status === "error" || res.total_count === 0) {
        setErrorMessage(res.message || "Aucune transaction valide n'a pu être extraite.")
        setIsAnalyzing(false)
        return
      }

      setAnalysisResult(res)
      setEditableTransactions(res.all_transactions || [])
      setDateCol(res.detected_mapping.date_col ?? 0)
      setAmountCol(res.detected_mapping.amount_col ?? 1)
      setLabelCol(res.detected_mapping.label_cols?.[0])
      setCategoryCol(res.detected_mapping.category_col)
      setStep("preview")
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'analyse du CSV.")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleMappingChange = (type: "date" | "amount" | "label" | "category", value: number) => {
    const newMap: any = {
      date_col: type === "date" ? value : dateCol,
      amount_col: type === "amount" ? value : amountCol,
      label_col: type === "label" ? (value === -1 ? undefined : value) : labelCol,
      category_col: type === "category" ? (value === -1 ? undefined : value) : categoryCol,
    }
    if (type === "date") setDateCol(value)
    if (type === "amount") setAmountCol(value)
    if (type === "label") setLabelCol(value === -1 ? undefined : value)
    if (type === "category") setCategoryCol(value === -1 ? undefined : value)

    handleAnalyze(csvText, newMap)
  }

  const handleUpdateTxTitle = (idx: number, newTitle: string) => {
    const updated = [...editableTransactions]
    if (updated[idx]) {
      updated[idx] = {
        ...updated[idx],
        merchant_name: newTitle,
        raw_label: newTitle,
      }
      setEditableTransactions(updated)
    }
  }

  const handleConfirmImport = async () => {
    if (!editableTransactions || editableTransactions.length === 0) return

    setIsImporting(true)
    setErrorMessage("")
    try {
      const targetName = customAccountTitle.trim() || "Relevé Importé"
      const res = await FinlyAPI.importCsvTransactions({
        account_id: isCreatingNewAccount ? "new" : selectedAccountId,
        account_name: isCreatingNewAccount ? targetName : undefined,
        account_type: isCreatingNewAccount ? customAccountType : undefined,
        transactions: editableTransactions,
      })

      setImportSummary({
        imported_count: res.imported_count,
        updated_count: res.updated_count,
        account_name: res.account_name || targetName,
      })
      setStep("success")
      if (onImportSuccess) onImportSuccess()
    } catch (err: any) {
      setErrorMessage(err.message || "Erreur lors de l'enregistrement des dépenses.")
    } finally {
      setIsImporting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleReset}>
      <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-5 sm:p-7 max-w-lg sm:max-w-2xl w-[94vw] sm:w-full max-h-[90vh] overflow-y-auto overscroll-contain flex flex-col gap-4">
        {/* Header */}
        <DialogHeader className="p-0 text-left shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex flex-col pr-4">
              <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400 shrink-0" />
                {step === "input" && "Importer mes dépenses en CSV"}
                {step === "preview" && "Type de compte et aperçu"}
                {step === "success" && "Importation terminée"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-1">
                {step === "input" && "Déposez un relevé bancaire (CSV/TSV) ou collez directement vos lignes d'opérations."}
                {step === "preview" && "Définissez le titre et le type de compte, puis validez vos opérations."}
                {step === "success" && "Vos dépenses ont été intégrées et catégorisées dans votre espace Finly."}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2 shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* STEP 1: Input / File / Paste */}
        {step === "input" && (
          <div className="flex flex-col gap-4">
            {/* Input Mode Selector */}
            <div className="flex rounded-xl bg-zinc-950 p-1 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setInputMode("file")}
                className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  inputMode === "file" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Fichier CSV / Excel</span>
              </button>
              <button
                type="button"
                onClick={() => setInputMode("paste")}
                className={`flex-1 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  inputMode === "paste" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-400 hover:text-white"
                }`}
              >
                <ClipboardPaste className="w-3.5 h-3.5" />
                <span>Copier-Coller du texte</span>
              </button>
            </div>

            {inputMode === "file" && (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-white/15 hover:border-emerald-500/50 bg-zinc-950/60 hover:bg-zinc-900/60 transition-all rounded-2xl p-8 flex flex-col items-center justify-center gap-3 text-center cursor-pointer group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-6 h-6" />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-sm font-bold text-white">
                    {fileName ? fileName : "Cliquez ou glissez votre fichier CSV ici"}
                  </span>
                  <span className="text-xs text-zinc-400">
                    Prend en charge tous les formats bancaires (.csv, .tsv, .txt)
                  </span>
                </div>
              </div>
            )}

            {inputMode === "paste" && (
              <div className="flex flex-col gap-2">
                <textarea
                  rows={7}
                  placeholder={`Collez vos lignes d'opérations ici...
Exemple :
01/05/2026	62,82	Achat Magasin
05/05/2026	-25,00	Virement Loyer	Divers`}
                  value={csvText}
                  onChange={(e) => setCsvText(e.target.value)}
                  className="w-full bg-zinc-950 border border-white/10 rounded-2xl p-3.5 text-xs text-zinc-200 font-mono focus:outline-none focus:border-emerald-500/50 resize-none leading-relaxed"
                />
                <Button
                  onClick={() => handleAnalyze(csvText)}
                  disabled={isAnalyzing || !csvText.trim()}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-11 rounded-xl cursor-pointer gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyse en cours...</span>
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      <span>Analyser le relevé</span>
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Preview, Account Details & Column Mapping */}
        {step === "preview" && analysisResult && (
          <div className="flex flex-col gap-4">
            {/* Account Title & Type Section */}
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/10 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-semibold text-white flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-400" />
                  {isCreatingNewAccount ? "Nouveau compte / Banque personnalisée" : "Compte de destination"}
                </span>
                {accounts.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setIsCreatingNewAccount(!isCreatingNewAccount)}
                    className="text-[11px] text-zinc-400 hover:text-white underline cursor-pointer"
                  >
                    {isCreatingNewAccount ? "Rattacher à un compte existant" : "+ Créer un nouveau compte"}
                  </button>
                )}
              </div>

              {isCreatingNewAccount ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-semibold">Titre du compte / Relevé</label>
                    <Input
                      type="text"
                      value={customAccountTitle}
                      onChange={(e) => setCustomAccountTitle(e.target.value)}
                      placeholder="Ex: Relevé Trade Republic, Livret..."
                      className="bg-zinc-900 border-white/10 text-white text-xs h-9 rounded-xl"
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] text-zinc-400 uppercase font-semibold">Type de compte</label>
                    <select
                      value={customAccountType}
                      onChange={(e) => setCustomAccountType(e.target.value)}
                      className="w-full bg-zinc-900 border border-white/10 text-white text-xs h-9 px-3 rounded-xl cursor-pointer"
                    >
                      {ACCOUNT_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] text-zinc-400 uppercase font-semibold">Sélectionner un compte existant</label>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => setSelectedAccountId(e.target.value)}
                    className="w-full bg-zinc-900 border border-white/10 text-white text-xs h-9 px-3 rounded-xl cursor-pointer"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name || a.bank} ({a.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Column Recognition Summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Date</span>
                <select
                  value={dateCol}
                  onChange={(e) => handleMappingChange("date", Number(e.target.value))}
                  className="bg-zinc-900 border border-white/10 text-white text-xs h-8 px-2 rounded-lg"
                >
                  {analysisResult.columns.map((c: string, i: number) => (
                    <option key={i} value={i}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Montant</span>
                <select
                  value={amountCol}
                  onChange={(e) => handleMappingChange("amount", Number(e.target.value))}
                  className="bg-zinc-900 border border-white/10 text-white text-xs h-8 px-2 rounded-lg"
                >
                  {analysisResult.columns.map((c: string, i: number) => (
                    <option key={i} value={i}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Libellé</span>
                <select
                  value={labelCol ?? -1}
                  onChange={(e) => handleMappingChange("label", Number(e.target.value))}
                  className="bg-zinc-900 border border-white/10 text-white text-xs h-8 px-2 rounded-lg"
                >
                  <option value={-1}>Auto-détection</option>
                  {analysisResult.columns.map((c: string, i: number) => (
                    <option key={i} value={i}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col gap-1">
                <span className="text-[10px] text-zinc-400 uppercase font-semibold">Catégorie</span>
                <select
                  value={categoryCol ?? -1}
                  onChange={(e) => handleMappingChange("category", Number(e.target.value))}
                  className="bg-zinc-900 border border-white/10 text-white text-xs h-8 px-2 rounded-lg"
                >
                  <option value={-1}>Auto-catégorisation IA</option>
                  {analysisResult.columns.map((c: string, i: number) => (
                    <option key={i} value={i}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Extracted Transactions List Preview */}
            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold text-white">
                  Aperçu des opérations ({editableTransactions.length})
                </span>
                <span className="text-[11px] text-zinc-400">
                  Cliquez sur un libellé pour le modifier
                </span>
              </div>

              <div className="max-h-[220px] overflow-y-auto overscroll-contain rounded-2xl bg-zinc-950 border border-white/5 divide-y divide-white/5 text-xs">
                {editableTransactions.map((t: any, idx: number) => {
                  const isPositive = t.amount > 0
                  const isEditing = editingRowIdx === idx

                  return (
                    <div key={idx} className="p-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-3 min-w-0 flex-1 pr-2">
                        <span className="font-mono text-[11px] text-zinc-400 shrink-0">{t.date}</span>
                        
                        <div className="flex flex-col min-w-0 flex-1">
                          {isEditing ? (
                            <div className="flex items-center gap-1.5">
                              <Input
                                autoFocus
                                type="text"
                                value={t.merchant_name}
                                onChange={(e) => handleUpdateTxTitle(idx, e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") setEditingRowIdx(null)
                                }}
                                className="bg-zinc-900 border-white/20 text-white text-xs h-7 rounded-lg py-1 px-2"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingRowIdx(null)}
                                className="h-7 w-7 p-0 text-emerald-400 hover:text-white"
                              >
                                <Check className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div
                              onClick={() => setEditingRowIdx(idx)}
                              className="group flex items-center gap-1.5 cursor-pointer"
                            >
                              <span className="font-semibold text-white truncate group-hover:text-emerald-300 transition-colors">
                                {t.merchant_name || t.raw_label || "Opération"}
                              </span>
                              <Edit2 className="w-3 h-3 text-zinc-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                          )}
                          <span className="text-[10px] text-zinc-500 font-mono truncate">{t.raw_label}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5 shrink-0">
                        {t.category && (
                          <Badge variant="outline" className="hidden sm:inline-flex text-[10px] border-white/10 text-zinc-400">
                            {t.category}
                          </Badge>
                        )}
                        <span className={`font-mono font-bold text-xs ${isPositive ? "text-emerald-400" : "text-white"}`}>
                          {isPositive ? "+" : ""}{formatAmount(t.amount)} €
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex gap-2.5 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("input")}
                disabled={isImporting}
                className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-11 px-4 rounded-xl cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Retour
              </Button>
              <Button
                type="button"
                onClick={handleConfirmImport}
                disabled={isImporting}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-11 rounded-xl shadow-md shadow-emerald-600/25 cursor-pointer gap-2"
              >
                {isImporting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Importation en cours...</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Valider l&apos;importation ({editableTransactions.length} opérations)</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 3: Success */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-base font-bold text-white">Dépenses importées avec succès</span>
            <p className="text-xs text-zinc-400 max-w-sm">
              Vos opérations ont été enregistrées sous le compte <span className="text-white font-semibold">{importSummary?.account_name}</span>.
            </p>

            {importSummary && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs my-2 text-left">
                <div className="p-3 rounded-xl bg-zinc-950 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-500">Nouvelles opérations</span>
                  <span className="text-sm font-bold text-emerald-400 font-mono">{importSummary.imported_count}</span>
                </div>
                <div className="p-3 rounded-xl bg-zinc-950 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-500">Mises à jour / Dédupliquées</span>
                  <span className="text-sm font-bold text-zinc-300 font-mono">{importSummary.updated_count}</span>
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={handleReset}
              className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs h-10 px-6 rounded-xl cursor-pointer"
            >
              Fermer
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
