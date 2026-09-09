"use client"

import React, { useState, useMemo, useRef } from "react"
import {
  CheckCircle2,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  Smartphone,
  Search,
  Building2,
  Lock,
  User,
  ShieldCheck,
  ChevronRight,
  X,
  FileCode,
  FileSpreadsheet,
  Upload,
  Database,
  Check,
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
import { BankLogo } from "@/components/ui/bank-icons"
import { CsvImportModal } from "@/components/modals/csv-import-modal"
import { FinlyAPI } from "@/lib/api/finly-api"

interface BankItem {
  id: string
  name: string
  desc: string
  loginLabel: string
  loginPlaceholder: string
}

interface WoobModalProps {
  isOpen: boolean
  onClose: () => void
  onBankConnected?: (account?: any) => void
}

export function WoobModal({ isOpen, onClose, onBankConnected }: WoobModalProps) {
  const [step, setStep] = useState<"select" | "credentials" | "2fa" | "connecting" | "success" | "success_import">("select")
  const [selectedBank, setSelectedBank] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [login, setLogin] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [otpCode, setOtpCode] = useState<string>("")
  const [errorMessage, setErrorMessage] = useState<string>("")
  const [statusMessage, setStatusMessage] = useState<string>("")
  const [isImporting, setIsImporting] = useState<boolean>(false)
  const [importSummary, setImportSummary] = useState<{
    accounts: number
    transactions: number
    projects: number
    budgets: number
  } | null>(null)
  const [pendingImportedBanks, setPendingImportedBanks] = useState<any[]>([])
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const banks: BankItem[] = [
    { id: "bourso", name: "BoursoBank", desc: "Banque en ligne", loginLabel: "Identifiant client (8 chiffres)", loginPlaceholder: "Ex: 12345678" },
    { id: "bnporc", name: "BNP Paribas", desc: "Banque de détail", loginLabel: "Numéro client (10 chiffres)", loginPlaceholder: "Ex: 0123456789" },
    { id: "fortuneo", name: "Fortuneo", desc: "Banque en ligne & Bourse", loginLabel: "Identifiant d'accès", loginPlaceholder: "Identifiant Fortuneo" },
    { id: "cragr", name: "Crédit Agricole", desc: "Banque régionale", loginLabel: "Identifiant à 11 chiffres", loginPlaceholder: "Ex: 12345678901" },
    { id: "sg", name: "Société Générale", desc: "Banque de détail", loginLabel: "Code client (8 chiffres)", loginPlaceholder: "Ex: 12345678" },
    { id: "n26", name: "N26 Bank", desc: "Néobanque européenne", loginLabel: "Adresse email N26", loginPlaceholder: "nom@exemple.com" },
    { id: "creditmutuel", name: "Crédit Mutuel", desc: "Banque coopérative", loginLabel: "Identifiant de connexion", loginPlaceholder: "Identifiant Crédit Mutuel" },
    { id: "cic", name: "CIC", desc: "Banque de détail", loginLabel: "Identifiant client", loginPlaceholder: "Identifiant CIC" },
    { id: "bp", name: "Banque Populaire", desc: "Banque coopérative", loginLabel: "Identifiant Cyberplus", loginPlaceholder: "Identifiant Cyberplus" },
    { id: "ce", name: "Caisse d'Épargne", desc: "Banque régionale", loginLabel: "Identifiant client", loginPlaceholder: "Ex: 12345678" },
    { id: "hellobank", name: "Hello bank!", desc: "Banque mobile", loginLabel: "Numéro client (10 chiffres)", loginPlaceholder: "Ex: 0123456789" },
    { id: "lcl", name: "LCL", desc: "Banque de détail", loginLabel: "Identifiant client LCL", loginPlaceholder: "Ex: 12345678" },
    { id: "labanquepostale", name: "La Banque Postale", desc: "Banque publique", loginLabel: "Identifiant (10 chiffres)", loginPlaceholder: "Ex: 0123456789" },
    { id: "bforbank", name: "BforBank", desc: "Banque 100% en ligne", loginLabel: "Identifiant client", loginPlaceholder: "Identifiant BforBank" },
    { id: "monabanq", name: "Monabanq", desc: "Banque en ligne", loginLabel: "Identifiant client", loginPlaceholder: "Identifiant Monabanq" },
    { id: "shine", name: "Shine", desc: "Compte pro & indépendant", loginLabel: "Numéro de mobile", loginPlaceholder: "+33 6 12 34 56 78" },
    { id: "qonto", name: "Qonto", desc: "Compte pro & PME", loginLabel: "Adresse email Qonto", loginPlaceholder: "email@entreprise.fr" },
  ]

  const filteredBanks = useMemo(() => {
    if (!searchQuery.trim()) return banks
    const q = searchQuery.toLowerCase()
    return banks.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.desc && b.desc.toLowerCase().includes(q))
    )
  }, [searchQuery])

  const currentBankObj = banks.find((b) => b.id === selectedBank)

  const handleStartConnect = (bankId: string) => {
    setSelectedBank(bankId)
    setErrorMessage("")
    setStatusMessage("")
    setStep("credentials")
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setErrorMessage("")

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content)

        if (!parsed || (!parsed.accounts && !parsed.transactions)) {
          throw new Error("Format de sauvegarde JSON non reconnu.")
        }

        const res = await FinlyAPI.importJsonBackup(parsed)
        setImportSummary(res.imported)
        if (res.pending_connections && res.pending_connections.length > 0) {
          setPendingImportedBanks(res.pending_connections)
        }
        setStep("success_import")
        if (onBankConnected) {
          onBankConnected()
        }
      } catch (err: any) {
        setErrorMessage(err.message || "Fichier JSON invalide ou corrompu.")
      } finally {
        setIsImporting(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    }
    reader.onerror = () => {
      setErrorMessage("Erreur lors de la lecture du fichier.")
      setIsImporting(false)
    }
    reader.readAsText(file)
  }

  const handleSubmitCredentials = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!login || !selectedBank) return

    setErrorMessage("")
    setStatusMessage("Connexion sécurisée en cours avec la banque...")
    setStep("connecting")

    try {
      const res = await FinlyAPI.connectWoobBank({
        module: selectedBank,
        login: login.trim(),
        password,
      })

      if (res.status === "2fa_required") {
        setStatusMessage(
          res.message || "Veuillez valider la notification sur l'application mobile de votre banque."
        )
        setStep("2fa")
      } else {
        if (onBankConnected) {
          onBankConnected()
        }
        setStep("success")
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Identifiants invalides ou connexion refusée par l'établissement.")
      setStep("credentials")
    }
  }

  const handleSubmit2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    setStep("connecting")
    setStatusMessage("Synchronisation des comptes après validation...")

    try {
      await FinlyAPI.triggerSync()
      if (onBankConnected) {
        onBankConnected()
      }
      setStep("success")
    } catch (err: any) {
      setErrorMessage(err.message || "Validation non confirmée.")
      setStep("2fa")
    }
  }

  const handleReset = () => {
    setStep("select")
    setSelectedBank(null)
    setSearchQuery("")
    setLogin("")
    setPassword("")
    setOtpCode("")
    setErrorMessage("")
    setStatusMessage("")
    setImportSummary(null)
    onClose()
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleReset}>
      <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-5 sm:p-7 max-w-lg sm:max-w-2xl w-[94vw] sm:w-full max-h-[90vh] overflow-y-auto overscroll-contain flex flex-col gap-4">
        {/* Header */}
        <DialogHeader className="p-0 text-left shrink-0">
          <div className="flex justify-between items-start">
            <div className="flex flex-col pr-4">
              <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-400 shrink-0" />
                {step === "select" && "Ajouter une banque ou importer"}
                {step === "credentials" && `${currentBankObj?.name}`}
                {step === "2fa" && "Validation Requise"}
                {step === "connecting" && "Synchronisation Sécurisée"}
                {step === "success" && "Établissement Relié"}
                {step === "success_import" && "Sauvegarde Restaurée"}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-1">
                {step === "select" && "Reliez un compte bancaire en direct ou restaurez une sauvegarde JSON."}
                {step === "credentials" && "Identifiants chiffrés en local (AES-256) sur votre machine."}
                {step === "2fa" && "Validez l'accès sur votre application bancaire mobile."}
                {step === "connecting" && "Négociation de session et récupération sécurisée des soldes."}
                {step === "success" && "Vos comptes et opérations sont prêts."}
                {step === "success_import" && "Vos données financières ont été importées avec succès."}
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

        {/* STEP 1: Select Bank or Import CSV */}
        {step === "select" && (
          <div className="flex flex-col gap-3.5">
            {/* Search Input */}
            <div className="relative shrink-0">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Rechercher une banque..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 bg-zinc-950 border-white/10 text-white text-xs h-10 sm:h-11 rounded-xl"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Banks List */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5 max-h-[38vh] sm:max-h-[290px] overflow-y-auto overscroll-contain pr-1 touch-pan-y">
              {filteredBanks.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => handleStartConnect(bank.id)}
                  className="flex items-center justify-between p-3 sm:p-3.5 rounded-2xl bg-zinc-950/60 border border-white/5 hover:border-indigo-500/50 hover:bg-zinc-900/90 transition-all text-left cursor-pointer group touch-pan-y"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <BankLogo bankId={bank.id} className="w-9 h-9 sm:w-10 sm:h-10 shrink-0" />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="text-sm font-semibold text-white group-hover:text-indigo-300 truncate">
                        {bank.name}
                      </span>
                      <span className="text-xs text-zinc-500 truncate">
                        {bank.desc}
                      </span>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 shrink-0 sm:hidden" />
                </button>
              ))}

              {filteredBanks.length === 0 && (
                <div className="col-span-full py-8 text-center text-xs text-zinc-500">
                  Aucun établissement trouvé pour cette recherche.
                </div>
              )}
            </div>

            {/* CSV Import Button Below Banks */}
            <button
              type="button"
              onClick={() => setIsCsvModalOpen(true)}
              className="w-full p-3.5 rounded-2xl bg-zinc-950 border border-emerald-500/30 hover:border-emerald-500/60 hover:bg-zinc-900 transition-all flex items-center justify-between cursor-pointer group shadow-lg shadow-emerald-950/20"
            >
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 shrink-0 group-hover:scale-105 transition-transform">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-white group-hover:text-emerald-300">
                    Ajouter mes dépenses en CSV
                  </span>
                  <span className="text-[11px] text-zinc-400 leading-relaxed">
                    Reconnaissance automatique des colonnes depuis n&apos;importe quel relevé bancaire
                  </span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 shrink-0" />
            </button>

            <div className="shrink-0 p-2.5 sm:p-3 rounded-xl bg-zinc-950/50 border border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                Connexion locale chiffrée AES-256
              </span>
              <span className="text-zinc-500">
                {banks.length} banques certifiées
              </span>
            </div>
          </div>
        )}

        {/* STEP 2: Credentials Form */}
        {step === "credentials" && currentBankObj && (
          <form onSubmit={handleSubmitCredentials} className="flex flex-col flex-1 min-h-0 mt-4 gap-4 overflow-y-auto pr-1">
            <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950 border border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <BankLogo bankId={currentBankObj.id} className="w-10 h-10 shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">{currentBankObj.name}</span>
                  <span className="text-xs text-zinc-400">{currentBankObj.desc}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                {currentBankObj.loginLabel}
              </label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="text"
                  required
                  placeholder={currentBankObj.loginPlaceholder}
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  className="pl-10 bg-zinc-950 border-white/10 text-white text-xs h-11 rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Code secret / Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10 bg-zinc-950 border-white/10 text-white text-xs h-11 rounded-xl"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 mt-auto pt-2">
              <Button
                type="submit"
                className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-11 rounded-xl shadow-md shadow-indigo-600/25 cursor-pointer"
              >
                Se connecter
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("select")}
                className="w-full sm:w-auto border-white/10 bg-zinc-900 text-zinc-300 text-xs h-11 rounded-xl cursor-pointer"
              >
                Retour
              </Button>
            </div>
          </form>
        )}

        {/* STEP 3: 2FA Validation */}
        {step === "2fa" && (
          <form onSubmit={handleSubmit2FA} className="flex flex-col flex-1 min-h-0 mt-4 gap-4 overflow-y-auto pr-1">
            <div className="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-start gap-3">
              <Smartphone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
              <div className="flex flex-col gap-1">
                <span className="font-semibold text-white">Validation requise</span>
                <span className="text-zinc-300 text-[11px] leading-relaxed">
                  {statusMessage || "Veuillez accepter la demande de connexion sur votre application mobile bancaire."}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Code OTP (facultatif si notification in-app)
              </label>
              <Input
                type="text"
                placeholder="Code SMS / OTP (si applicable)"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className="bg-zinc-950 border-white/10 text-white text-center font-mono text-sm h-11 rounded-xl"
              />
            </div>

            <div className="flex flex-col sm:flex-row gap-2.5 mt-auto pt-2">
              <Button
                type="submit"
                className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-11 rounded-xl shadow-md shadow-indigo-600/25 cursor-pointer"
              >
                J&apos;ai validé sur mon téléphone
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setStep("credentials")}
                className="w-full sm:w-auto border-white/10 bg-zinc-900 text-zinc-300 text-xs h-11 rounded-xl cursor-pointer"
              >
                Retour
              </Button>
            </div>
          </form>
        )}

        {/* STEP 4: Connecting */}
        {step === "connecting" && (
          <div className="flex flex-col items-center justify-center flex-1 py-10 gap-3 text-center">
            <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
            <span className="text-sm font-semibold text-white">
              {statusMessage || "Connexion et négociation de session..."}
            </span>
            <span className="text-xs text-zinc-500">
              Veuillez patienter quelques instants pendant la synchronisation
            </span>
          </div>
        )}

        {/* STEP 5: Success Live Connection */}
        {step === "success" && (
          <div className="flex flex-col items-center justify-center flex-1 py-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <span className="text-base font-bold text-white">Compte bancaire relié avec succès</span>
            <p className="text-xs text-zinc-400 max-w-sm">
              Vos soldes et dernières opérations ont été importés et chiffrés en local dans votre espace Finly.
            </p>

            <Button
              onClick={handleReset}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-11 px-8 rounded-xl mt-2 cursor-pointer shadow-md shadow-indigo-600/25"
            >
              Voir mes comptes
            </Button>
          </div>
        )}

        {/* STEP 6: Success JSON Import */}
        {step === "success_import" && (
          <div className="flex flex-col items-center justify-center flex-1 py-8 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Check className="w-6 h-6" />
            </div>
            <span className="text-base font-bold text-white">Sauvegarde JSON restaurée</span>
            <p className="text-xs text-zinc-400 max-w-sm">
              L&apos;intégralité de vos comptes, transactions, projets et budgets ont été réintégrés avec succès.
            </p>

            {importSummary && (
              <div className="grid grid-cols-2 gap-2 w-full max-w-xs my-2 text-left">
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-500">Comptes</span>
                  <span className="text-sm font-bold text-white font-mono">{importSummary.accounts}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-500">Transactions</span>
                  <span className="text-sm font-bold text-white font-mono">{importSummary.transactions}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-500">Projets</span>
                  <span className="text-sm font-bold text-white font-mono">{importSummary.projects}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-zinc-950 border border-white/5 flex flex-col">
                  <span className="text-[10px] text-zinc-500">Budgets</span>
                  <span className="text-sm font-bold text-white font-mono">{importSummary.budgets}</span>
                </div>
              </div>
            )}

            {pendingImportedBanks.length > 0 ? (
              <div className="w-full max-w-xs flex flex-col gap-2 my-2">
                <Button
                  onClick={() => {
                    const first = pendingImportedBanks[0]
                    setSelectedBank(first.module_name)
                    setLogin(first.login || "")
                    setPassword("")
                    setStep("credentials")
                  }}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 rounded-xl shadow-md shadow-indigo-600/25 cursor-pointer"
                >
                  Activer la synchronisation ({pendingImportedBanks[0].bank_name})
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full border-white/10 bg-zinc-900 text-zinc-400 hover:text-white text-xs h-9 rounded-xl cursor-pointer"
                >
                  Terminer sans synchronisation directe
                </Button>
              </div>
            ) : (
              <Button
                onClick={handleReset}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-11 px-8 rounded-xl mt-2 cursor-pointer shadow-md shadow-indigo-600/25"
              >
                Terminer et voir mon tableau de bord
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    <CsvImportModal
      isOpen={isCsvModalOpen}
      onClose={() => setIsCsvModalOpen(false)}
      onImportSuccess={() => {
        setIsCsvModalOpen(false)
        handleReset()
        if (onBankConnected) onBankConnected()
      }}
    />
  </>
  )
}
