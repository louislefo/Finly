"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  Building2,
  CreditCard,
  Wallet,
  PiggyBank,
  Landmark,
  Plus,
  RefreshCw,
  Edit2,
  Trash2,
  Copy,
  Check,
  ShieldCheck,
  User as UserIcon,
  Mail,
  Lock,
  Download,
  FileSpreadsheet,
  FileCode,
  HardDrive,
  Database,
  ArrowLeft,
  ChevronRight,
  AlertTriangle,
  Sparkles,
  ExternalLink,
} from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { BankLogo } from "@/components/ui/bank-icons"
import { WoobModal } from "@/components/modals/woob-modal"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account, BankConnection } from "@/lib/types/finance"

export function AccountView() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { formatAmount } = usePrivacy()

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<"banks" | "profile" | "backup">("banks")

  // Data States
  const [accounts, setAccounts] = useState<Account[]>([])
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([])
  const [totalBalance, setTotalBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false)
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Modals & Actions States
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editName, setEditName] = useState<string>("")
  const [editType, setEditType] = useState<string>("")
  const [editColor, setEditColor] = useState<string>("")
  const [isSavingAccount, setIsSavingAccount] = useState<boolean>(false)

  // Deletion Confirmation States
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)
  const [bankToDelete, setBankToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  // Profile / Password States
  const [currentPassword, setCurrentPassword] = useState<string>("")
  const [newPassword, setNewPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [pwdErrorMsg, setPwdErrorMsg] = useState<string | null>(null)
  const [pwdSuccessMsg, setPwdSuccessMsg] = useState<string | null>(null)
  const [isUpdatingPwd, setIsUpdatingPwd] = useState<boolean>(false)

  // Backup / Export States
  const [isExportingJSON, setIsExportingJSON] = useState<boolean>(false)
  const [isImportingJSON, setIsImportingJSON] = useState<boolean>(false)
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null)
  const [importSuccessMsg, setImportSuccessMsg] = useState<string | null>(null)
  const [importErrorMsg, setImportErrorMsg] = useState<string | null>(null)
  const [importSummary, setImportSummary] = useState<{
    accounts: number
    transactions: number
    projects: number
    budgets: number
  } | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement | null>(null)

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [accRes, connsRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getBankConnections(),
      ])
      setAccounts(accRes.accounts || [])
      setTotalBalance(accRes.total_balance || 0)
      setBankConnections(connsRes || [])
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Aggregate KPI Calculations
  const { checkingTotal, checkingCount, savingsTotal, savingsCount } = useMemo(() => {
    let chkSum = 0
    let chkCnt = 0
    let savSum = 0
    let savCnt = 0

    for (const a of accounts) {
      const t = (a.type || "").toLowerCase()
      const n = (a.name || "").toLowerCase()
      const isSav = ["livret", "epargne", "épargne", "ldd", "lep", "pea", "assurance", "titre", "placement"].some(
        (k) => t.includes(k) || n.includes(k)
      )

      if (isSav) {
        savSum += a.balance
        savCnt++
      } else {
        chkSum += a.balance
        chkCnt++
      }
    }

    return {
      checkingTotal: chkSum,
      checkingCount: chkCnt,
      savingsTotal: savSum,
      savingsCount: savCnt,
    }
  }, [accounts])

  // Group accounts by bank
  const bankGroups = useMemo(() => {
    const map = new Map<string, { bankName: string; accounts: Account[]; totalBalance: number; connection?: BankConnection }>()

    for (const a of accounts) {
      const bName = a.bank || "Banque"
      const existing = map.get(bName) || {
        bankName: bName,
        accounts: [],
        totalBalance: 0,
        connection: bankConnections.find((c) => c.bank_name.toLowerCase() === bName.toLowerCase()),
      }
      existing.accounts.push(a)
      existing.totalBalance += a.balance
      map.set(bName, existing)
    }

    return Array.from(map.values())
  }, [accounts, bankConnections])

  // Trigger Immediate Synchronization
  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    setSyncFeedback(null)
    try {
      const res = await FinlyAPI.triggerSync()
      await loadData()
      setSyncFeedback({
        type: "success",
        message: res.message || "Synchronisation bancaire réussie.",
      })
      setTimeout(() => setSyncFeedback(null), 5000)
    } catch (err: any) {
      setSyncFeedback({
        type: "error",
        message: err.message || "Erreur lors de la synchronisation.",
      })
    } finally {
      setIsSyncingAll(false)
    }
  }

  // Open Edit Account Modal
  const handleOpenEditAccount = (acc: Account) => {
    setEditingAccount(acc)
    setEditName(acc.name || "")
    setEditType(acc.type || "Compte Courant")
    setEditColor(acc.color || "from-indigo-600 to-blue-600")
  }

  // Save Account Edit
  const handleSaveAccount = async () => {
    if (!editingAccount) return
    setIsSavingAccount(true)
    try {
      await FinlyAPI.updateAccount(editingAccount.id, {
        name: editName,
        account_type: editType,
        color: editColor,
      })
      await loadData()
      setEditingAccount(null)
    } catch (err: any) {
      alert(err.message || "Erreur lors de la mise à jour du compte.")
    } finally {
      setIsSavingAccount(false)
    }
  }

  // Delete Single Account
  const handleConfirmDeleteAccount = async () => {
    if (!accountToDelete) return
    setIsDeleting(true)
    try {
      await FinlyAPI.deleteAccount(accountToDelete.id)
      await loadData()
      setAccountToDelete(null)
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression.")
    } finally {
      setIsDeleting(false)
    }
  }

  // Delete Entire Bank
  const handleConfirmDeleteBank = async () => {
    if (!bankToDelete) return
    setIsDeleting(true)
    try {
      await FinlyAPI.deleteBank(bankToDelete)
      await loadData()
      setBankToDelete(null)
    } catch (err: any) {
      alert(err.message || "Erreur lors de la suppression de la banque.")
    } finally {
      setIsDeleting(false)
    }
  }

  // Copy IBAN
  const handleCopyIban = (iban: string, accId: string) => {
    navigator.clipboard.writeText(iban)
    setCopiedId(accId)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // Account Type Icon Helper
  const getAccountIcon = (type: string, name?: string) => {
    const t = (type || "").toLowerCase()
    const n = (name || "").toLowerCase()
    if (["livret", "epargne", "épargne", "ldd", "lep"].some((k) => t.includes(k) || n.includes(k))) {
      return <PiggyBank className="w-4 h-4 text-emerald-400" />
    }
    if (["carte", "credit", "crédit", "debit"].some((k) => t.includes(k) || n.includes(k))) {
      return <CreditCard className="w-4 h-4 text-amber-400" />
    }
    if (["pea", "titre", "bourse", "placement", "assurance"].some((k) => t.includes(k) || n.includes(k))) {
      return <Landmark className="w-4 h-4 text-violet-400" />
    }
    return <Wallet className="w-4 h-4 text-indigo-400" />
  }

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdErrorMsg(null)
    setPwdSuccessMsg(null)

    if (newPassword.length < 6) {
      setPwdErrorMsg("Le nouveau mot de passe doit comporter au moins 6 caractères.")
      return
    }
    if (newPassword !== confirmPassword) {
      setPwdErrorMsg("La confirmation ne correspond pas au nouveau mot de passe.")
      return
    }

    setIsUpdatingPwd(true)
    try {
      await FinlyAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPwdSuccessMsg("Votre mot de passe a été modifié avec succès.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setPwdErrorMsg(err.message || "Erreur lors de la modification du mot de passe.")
    } finally {
      setIsUpdatingPwd(false)
    }
  }

  // Export JSON Backup
  const handleExportJSON = async () => {
    setIsExportingJSON(true)
    setExportSuccessMsg(null)
    setImportErrorMsg(null)
    try {
      const backupData = await FinlyAPI.exportJsonBackup()
      const jsonStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const dateStr = new Date().toISOString().split("T")[0]
      link.href = url
      link.download = `finly_sauvegarde_integrale_${dateStr}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccessMsg("Sauvegarde intégrale JSON générée et téléchargée.")
      setTimeout(() => setExportSuccessMsg(null), 5000)
    } catch (err: any) {
      setImportErrorMsg(err.message || "Erreur lors de l'exportation.")
    } finally {
      setIsExportingJSON(false)
    }
  }

  // Import JSON Backup
  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsImportingJSON(true)
    setImportErrorMsg(null)
    setImportSuccessMsg(null)
    setImportSummary(null)
    setExportSuccessMsg(null)

    const reader = new FileReader()
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string
        const parsed = JSON.parse(content)

        if (!parsed || (!parsed.accounts && !parsed.transactions && !parsed.categories && !parsed.projects)) {
          throw new Error("Format de sauvegarde JSON non reconnu ou données manquantes.")
        }

        const res = await FinlyAPI.importJsonBackup(parsed)
        setImportSummary(res.imported)
        setImportSuccessMsg("Sauvegarde intégrale restaurée avec succès.")
        await loadData()
        setTimeout(() => setImportSuccessMsg(null), 8000)
      } catch (err: any) {
        setImportErrorMsg(err.message || "Fichier JSON invalide ou corrompu.")
      } finally {
        setIsImportingJSON(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    }
    reader.onerror = () => {
      setImportErrorMsg("Erreur lors de la lecture du fichier.")
      setIsImportingJSON(false)
    }
    reader.readAsText(file)
  }

  // User initials
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/")}
            className="h-9 w-9 p-0 rounded-2xl border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-white tracking-tight">Gestion des Banques & Comptes</h1>
            <span className="text-xs text-zinc-400 mt-0.5">
              {bankGroups.length} établissement{bankGroups.length > 1 ? "s" : ""} relié{bankGroups.length > 1 ? "s" : ""} • {accounts.length} compte{accounts.length > 1 ? "s" : ""} actif{accounts.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>

        {/* Global Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            onClick={handleSyncAll}
            disabled={isSyncingAll}
            variant="outline"
            size="sm"
            className="h-9 px-3.5 gap-2 border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 rounded-2xl cursor-pointer text-xs font-semibold"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncingAll ? "animate-spin" : ""}`} />
            <span>{isSyncingAll ? "Synchronisation..." : "Actualiser tout"}</span>
          </Button>

          <Button
            onClick={() => setIsWoobOpen(true)}
            size="sm"
            className="h-9 px-3.5 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl cursor-pointer text-xs font-semibold shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Connecter une Banque</span>
          </Button>
        </div>
      </div>

      {/* Sync Feedback Toast Banner */}
      {syncFeedback && (
        <div
          className={`p-3.5 rounded-2xl border text-xs flex items-center justify-between gap-3 animate-in fade-in duration-200 ${
            syncFeedback.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border-rose-500/20 text-rose-300"
          }`}
        >
          <span>{syncFeedback.message}</span>
          <button
            type="button"
            onClick={() => setSyncFeedback(null)}
            className="text-zinc-400 hover:text-white text-xs cursor-pointer font-bold"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center p-1 rounded-2xl bg-zinc-900 border border-white/10 text-xs w-fit">
        <button
          type="button"
          onClick={() => setActiveTab("banks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
            activeTab === "banks"
              ? "bg-indigo-600 text-white shadow-sm font-semibold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>Banques & Comptes</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
            activeTab === "profile"
              ? "bg-indigo-600 text-white shadow-sm font-semibold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <UserIcon className="w-3.5 h-3.5" />
          <span>Profil & Sécurité</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("backup")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium transition-all cursor-pointer ${
            activeTab === "backup"
              ? "bg-indigo-600 text-white shadow-sm font-semibold"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Sauvegarde & Données</span>
        </button>
      </div>

      {/* TAB 1: BANQUES & COMPTES */}
      {activeTab === "banks" && (
        <div className="flex flex-col gap-6">
          {/* Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Patrimoine Agrégé</span>
                <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
                  <Landmark className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {formatAmount(totalBalance)}
                </span>
                <span className="block text-[11px] text-zinc-500 mt-0.5">
                  {accounts.length} compte{accounts.length > 1 ? "s" : ""} dans {bankGroups.length} banque{bankGroups.length > 1 ? "s" : ""}
                </span>
              </div>
            </Card>

            <Card className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Comptes de Dépôt / Courants</span>
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
                  <Wallet className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {formatAmount(checkingTotal)}
                </span>
                <span className="block text-[11px] text-zinc-500 mt-0.5">
                  {checkingCount} compte{checkingCount > 1 ? "s" : ""} de liquidités
                </span>
              </div>
            </Card>

            <Card className="p-5 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Épargne & Placements</span>
                <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
                  <PiggyBank className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-bold font-mono tracking-tight text-white">
                  {formatAmount(savingsTotal)}
                </span>
                <span className="block text-[11px] text-zinc-500 mt-0.5">
                  {savingsCount} compte{savingsCount > 1 ? "s" : ""} d&apos;épargne
                </span>
              </div>
            </Card>
          </div>

          {/* Bank Institutions Cards List */}
          {bankGroups.length === 0 ? (
            <Card className="p-12 border-white/10 bg-[#18181B] rounded-3xl text-center flex flex-col items-center justify-center gap-4">
              <div className="p-4 rounded-3xl bg-zinc-900 border border-white/10 text-zinc-500">
                <Building2 className="w-10 h-10 text-indigo-400" />
              </div>
              <div className="flex flex-col gap-1 max-w-sm">
                <h3 className="text-base font-bold text-white">Aucun compte bancaire relié</h3>
                <p className="text-xs text-zinc-400">
                  Connectez votre première banque via Woob pour synchroniser automatiquement vos comptes et opérations.
                </p>
              </div>
              <Button
                onClick={() => setIsWoobOpen(true)}
                className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs h-9 px-4 gap-2 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Connecter une banque</span>
              </Button>
            </Card>
          ) : (
            <div className="flex flex-col gap-5">
              {bankGroups.map((group) => (
                <Card key={group.bankName} className="border-white/10 bg-[#18181B] rounded-3xl shadow-xl overflow-hidden">
                  {/* Bank Header */}
                  <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-zinc-900/40">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 shadow-sm">
                        <BankLogo bankName={group.bankName} className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-base font-bold text-white">{group.bankName}</span>
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] py-0 px-2">
                            Connecté
                          </Badge>
                          {group.connection?.last_synced_at && (
                            <span className="text-[10px] text-zinc-500">
                              Dernière synchro : {new Date(group.connection.last_synced_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-zinc-400 mt-0.5">
                          {group.accounts.length} sous-compte{group.accounts.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-3">
                      <div className="flex flex-col items-start sm:items-end">
                        <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Solde Établissement</span>
                        <span className="text-lg font-bold font-mono text-white">
                          {formatAmount(group.totalBalance)}
                        </span>
                      </div>

                      <Button
                        onClick={() => setBankToDelete(group.bankName)}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer text-xs gap-1.5 transition-colors"
                        title={`Supprimer ${group.bankName}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline text-[11px]">Déconnecter</span>
                      </Button>
                    </div>
                  </div>

                  {/* Sub-Accounts List */}
                  <div className="divide-y divide-white/5">
                    {group.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
                            {getAccountIcon(acc.type, acc.name)}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-white truncate">
                                {acc.name || "Compte de dépôt"}
                              </span>
                              <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-400 text-[10px] py-0 px-2">
                                {acc.type || "Compte Courant"}
                              </Badge>
                            </div>

                            {/* IBAN / Account ID */}
                            {acc.iban && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-[11px] font-mono text-zinc-500 truncate">
                                  {acc.iban}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCopyIban(acc.iban!, acc.id)}
                                  className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
                                  title="Copier l'IBAN"
                                >
                                  {copiedId === acc.id ? (
                                    <Check className="w-3 h-3 text-emerald-400" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Account Balance & Action Controls */}
                        <div className="flex items-center justify-between sm:justify-end gap-3 pl-12 sm:pl-0">
                          <span className="text-base font-bold font-mono text-white">
                            {formatAmount(acc.balance)}
                          </span>

                          <div className="flex items-center gap-1">
                            <Button
                              onClick={() => handleOpenEditAccount(acc)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                              title="Modifier le compte"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </Button>

                            <Button
                              onClick={() => setAccountToDelete(acc)}
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                              title="Supprimer ce compte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROFIL & SECURITE */}
      {activeTab === "profile" && (
        <div className="flex flex-col gap-6 max-w-3xl">
          {/* User Profile Details Card */}
          <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Avatar size="lg" className="w-14 h-14">
                <AvatarFallback className="bg-indigo-600 text-white font-bold text-lg">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-white">{user?.full_name || "Utilisateur"}</span>
                  <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] py-0 px-2">
                    Actif
                  </Badge>
                </div>
                <span className="text-xs text-zinc-400 mt-0.5">{user?.email}</span>
              </div>
            </div>

            <Button
              onClick={logout}
              variant="outline"
              size="sm"
              className="border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white h-9 px-3.5 gap-1.5 rounded-xl cursor-pointer font-semibold text-xs"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Se déconnecter</span>
            </Button>
          </Card>

          {/* Change Password Card */}
          <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl">
            <CardHeader className="p-0 pb-4">
              <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-400" />
                <span>Modifier mon mot de passe</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                {pwdErrorMsg && (
                  <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                    {pwdErrorMsg}
                  </div>
                )}
                {pwdSuccessMsg && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                    <Check className="w-4 h-4 shrink-0" />
                    <span>{pwdSuccessMsg}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-zinc-400">Mot de passe actuel</label>
                  <Input
                    type="password"
                    placeholder="••••••••"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-9 focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Nouveau mot de passe</label>
                    <Input
                      type="password"
                      placeholder="Au moins 6 caractères"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-9 focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-semibold text-zinc-400">Confirmation</label>
                    <Input
                      type="password"
                      placeholder="Répéter le mot de passe"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-9 focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end mt-2">
                  <Button
                    type="submit"
                    disabled={isUpdatingPwd}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
                  >
                    {isUpdatingPwd ? "Modification..." : "Enregistrer le mot de passe"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* TAB 3: SAUVEGARDE & DONNEES */}
      {activeTab === "backup" && (
        <div className="flex flex-col gap-6 max-w-3xl">
          {/* Export JSON Card */}
          <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                <Download className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Sauvegarde intégrale JSON</span>
                <span className="text-xs text-zinc-400 mt-0.5">
                  Exporte l&apos;ensemble de vos comptes, transactions, projets, budgets et règles.
                </span>
              </div>
            </div>

            <Button
              onClick={handleExportJSON}
              disabled={isExportingJSON}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 px-4 rounded-xl cursor-pointer font-semibold shrink-0 shadow-md shadow-indigo-600/20"
            >
              {isExportingJSON ? "Génération..." : "Télécharger la sauvegarde"}
            </Button>
          </Card>

          {exportSuccessMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}

          {/* Import JSON Card */}
          <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 shrink-0">
                <HardDrive className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">Restaurer une sauvegarde JSON</span>
                <span className="text-xs text-zinc-400 mt-0.5">
                  Importez un fichier de sauvegarde Finly pour restaurer votre historique.
                </span>
              </div>
            </div>

            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />

            <div className="flex justify-start">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={isImportingJSON}
                variant="outline"
                className="border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs h-9 px-4 rounded-xl cursor-pointer font-semibold"
              >
                {isImportingJSON ? "Restauration en cours..." : "Sélectionner un fichier JSON"}
              </Button>
            </div>

            {importSuccessMsg && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span className="font-semibold">{importSuccessMsg}</span>
                </div>
                {importSummary && (
                  <span className="text-[11px] text-emerald-400/80 pl-6">
                    {importSummary.accounts} comptes, {importSummary.transactions} transactions, {importSummary.projects} projets importés.
                  </span>
                )}
              </div>
            )}

            {importErrorMsg && (
              <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {importErrorMsg}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* MODAL: EDIT ACCOUNT */}
      <Dialog open={Boolean(editingAccount)} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-400" />
              <span>Modifier le compte</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Nom du compte</label>
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Compte Courant Principal"
                className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-9 focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">Type de compte</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-9 px-3 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Compte Courant">Compte Courant / Dépôt</option>
                <option value="Livret d'Épargne">Livret d&apos;Épargne (Livret A, LDDS, LEP)</option>
                <option value="Carte Bancaire">Carte Bancaire / Débit différé</option>
                <option value="Compte Titres / PEA">Compte Titres / PEA / Bourse</option>
                <option value="Assurance-Vie">Assurance-Vie / Placement</option>
                <option value="Autre">Autre compte</option>
              </select>
            </div>
          </div>

          <DialogFooter className="mt-6 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditingAccount(null)}
              className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs h-9 px-3.5"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleSaveAccount}
              disabled={isSavingAccount}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isSavingAccount ? "Enregistrement..." : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CONFIRM DELETE ACCOUNT */}
      <Dialog open={Boolean(accountToDelete)} onOpenChange={(open) => !open && setAccountToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Supprimer ce compte</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-zinc-300 leading-relaxed">
            Êtes-vous sûr de vouloir supprimer le compte <strong className="text-white">{accountToDelete?.name || accountToDelete?.bank}</strong> ({accountToDelete?.iban || accountToDelete?.type}) ?
            <br /><br />
            <span className="text-rose-400 font-medium">Toutes les transactions associées à ce compte seront également supprimées.</span>
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccountToDelete(null)}
              className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs h-9 px-3.5"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDeleteAccount}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isDeleting ? "Suppression..." : "Confirmer la suppression"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG: CONFIRM DELETE BANK */}
      <Dialog open={Boolean(bankToDelete)} onOpenChange={(open) => !open && setBankToDelete(null)}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-rose-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
              <span>Déconnecter l&apos;établissement bancaire</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-zinc-300 leading-relaxed">
            Êtes-vous sûr de vouloir déconnecter <strong className="text-white">{bankToDelete}</strong> ?
            <br /><br />
            <span className="text-rose-400 font-medium">
              Tous les sous-comptes et l&apos;ensemble des opérations rattachés à cette banque seront définitivement retirés de votre profil.
            </span>
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBankToDelete(null)}
              className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs h-9 px-3.5"
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDeleteBank}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isDeleting ? "Déconnexion..." : "Déconnecter la banque"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Woob Bank Connection Flow Modal */}
      <WoobModal
        isOpen={isWoobOpen}
        onClose={() => setIsWoobOpen(false)}
        onBankConnected={loadData}
      />
    </div>
  )
}
