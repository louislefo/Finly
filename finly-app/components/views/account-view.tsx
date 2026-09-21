"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import Image from "next/image"
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
  HardDrive,
  Database,
  AlertTriangle,
  Globe,
  X,
  LogOut,
  ChevronRight,
  ArrowLeft,
  HelpCircle,
} from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
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
import { ImportCredentialsModal, PendingBankConnection } from "@/components/modals/import-credentials-modal"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Account, BankConnection } from "@/lib/types/finance"
import { cn } from "@/lib/utils"

type AccountTab = "profile" | "security" | "preferences" | "banks" | "backup"

export function AccountView() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { formatAmount } = usePrivacy()
  const { t, language, setLanguage } = useI18n()

  // Navigation Tab State
  const [activeTab, setActiveTab] = useState<AccountTab>("profile")
  const [mobileSubView, setMobileSubView] = useState<"menu" | AccountTab>("menu")

  // Check URL param on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const tabParam = params.get("tab") as AccountTab | null
      if (tabParam && ["profile", "security", "preferences", "banks", "backup"].includes(tabParam)) {
        setActiveTab(tabParam)
        setMobileSubView(tabParam)
      }
    }
  }, [])

  // Close handler (X button or Escape key)
  const handleClose = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back()
    } else {
      router.push("/")
    }
  }, [router])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [handleClose])

  // Data States
  const [accounts, setAccounts] = useState<Account[]>([])
  const [bankConnections, setBankConnections] = useState<BankConnection[]>([])
  const [totalBalance, setTotalBalance] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false)
  const [syncFeedback, setSyncFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Profile Edit States
  const [firstName, setFirstName] = useState<string>("")
  const [lastName, setLastName] = useState<string>("")
  const [isSavingProfile, setIsSavingProfile] = useState<boolean>(false)
  const [profileSuccessMsg, setProfileSuccessMsg] = useState<string | null>(null)

  useEffect(() => {
    if (user?.full_name) {
      const parts = user.full_name.trim().split(/\s+/)
      setFirstName(parts[0] || "")
      setLastName(parts.slice(1).join(" ") || "")
    } else if (user?.email) {
      setFirstName(user.email.split("@")[0])
      setLastName("")
    }
  }, [user])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingProfile(true)
    try {
      const updatedFullName = `${firstName} ${lastName}`.trim()
      if (user && typeof window !== "undefined") {
        const updatedUser = { ...user, full_name: updatedFullName }
        localStorage.setItem("finly_user", JSON.stringify(updatedUser))
      }
      setProfileSuccessMsg(language === "fr" ? "Profil mis à jour avec succès." : "Profile updated successfully.")
      setTimeout(() => setProfileSuccessMsg(null), 3500)
    } catch {
      // Offline fallback
    } finally {
      setIsSavingProfile(false)
    }
  }

  // Modals & Actions States
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [editName, setEditName] = useState<string>("")
  const [editType, setEditType] = useState<string>("")
  const [isSavingAccount, setIsSavingAccount] = useState<boolean>(false)

  // Deletion Confirmation States
  const [accountToDelete, setAccountToDelete] = useState<Account | null>(null)
  const [bankToDelete, setBankToDelete] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  // Copy Feedback
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const handleCopyEmail = (emailText: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(emailText)
      setCopiedId("email")
      setTimeout(() => setCopiedId(null), 2000)
    }
  }

  // Password Update States
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

  // Sync Settings States
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(false)
  const [syncInterval, setSyncInterval] = useState<number>(12)
  const [syncTime, setSyncTime] = useState<string>("08:00")
  const [isSavingSyncSettings, setIsSavingSyncSettings] = useState<boolean>(false)
  const [syncSettingsSuccessMsg, setSyncSettingsSuccessMsg] = useState<string | null>(null)

  const [isCredentialsModalOpen, setIsCredentialsModalOpen] = useState<boolean>(false)
  const [pendingBankConnections, setPendingBankConnections] = useState<PendingBankConnection[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

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
  const { checkingTotal, savingsTotal } = useMemo(() => {
    let chkSum = 0
    let savSum = 0

    for (const a of accounts) {
      const t = (a.type || "").toLowerCase()
      const n = (a.name || "").toLowerCase()
      const isSav = ["livret", "epargne", "épargne", "ldd", "lep", "pea", "assurance", "titre", "placement", "savings", "investment"].some(
        (k) => t.includes(k) || n.includes(k)
      )

      if (isSav) {
        savSum += a.balance
      } else {
        chkSum += a.balance
      }
    }

    return {
      checkingTotal: chkSum,
      savingsTotal: savSum,
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

    return Array.from(map.values()).sort((a, b) => b.totalBalance - a.totalBalance)
  }, [accounts, bankConnections])

  // Global Sync Action
  const handleSyncAll = async () => {
    setIsSyncingAll(true)
    setSyncFeedback(null)
    try {
      const res = await FinlyAPI.triggerSync()
      await loadData()
      setSyncFeedback({
        type: "success",
        message: res.message || (language === "fr" ? "Synchronisation bancaire effectuée avec succès." : "Banking synchronization completed successfully."),
      })
    } catch (err: any) {
      setSyncFeedback({
        type: "error",
        message: err.message || (language === "fr" ? "Échec de la synchronisation bancaire globale." : "Failed to synchronize connected banks."),
      })
    } finally {
      setIsSyncingAll(false)
      setTimeout(() => setSyncFeedback(null), 6000)
    }
  }

  // Edit Account
  const handleOpenEditAccount = (account: Account) => {
    setEditingAccount(account)
    setEditName(account.name || "")
    setEditType(account.type || "")
  }

  const handleSaveAccount = async () => {
    if (!editingAccount) return
    setIsSavingAccount(true)
    try {
      await FinlyAPI.updateAccount(editingAccount.id, {
        name: editName,
        account_type: editType,
      })
      await loadData()
      setEditingAccount(null)
    } catch (err: any) {
      alert(err.message || (language === "fr" ? "Erreur lors de la mise à jour du compte." : "Error updating account."))
    } finally {
      setIsSavingAccount(false)
    }
  }

  // Delete Account
  const handleConfirmDeleteAccount = async () => {
    if (!accountToDelete) return
    setIsDeleting(true)
    try {
      await FinlyAPI.deleteAccount(accountToDelete.id)
      await loadData()
      setAccountToDelete(null)
    } catch (err: any) {
      alert(err.message || (language === "fr" ? "Erreur lors de la suppression du compte." : "Error deleting account."))
    } finally {
      setIsDeleting(false)
    }
  }

  // Disconnect Bank
  const handleConfirmDeleteBank = async () => {
    if (!bankToDelete) return
    setIsDeleting(true)
    try {
      await FinlyAPI.deleteBank(bankToDelete)
      await loadData()
      setBankToDelete(null)
    } catch (err: any) {
      alert(err.message || (language === "fr" ? "Erreur lors de la déconnexion de l'établissement." : "Error disconnecting bank."))
    } finally {
      setIsDeleting(false)
    }
  }

  // Copy IBAN
  const handleCopyIban = (iban: string, id: string) => {
    navigator.clipboard.writeText(iban)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2500)
  }

  // Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPwdErrorMsg(null)
    setPwdSuccessMsg(null)

    if (newPassword.length < 6) {
      setPwdErrorMsg(language === "fr" ? "Le nouveau mot de passe doit contenir au moins 6 caractères." : "New password must be at least 6 characters.")
      return
    }

    if (newPassword !== confirmPassword) {
      setPwdErrorMsg(t.accounts.passwordMismatch)
      return
    }

    setIsUpdatingPwd(true)
    try {
      await FinlyAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setPwdSuccessMsg(t.accounts.passwordModifiedSuccess)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setPwdErrorMsg(err.message || (language === "fr" ? "Erreur lors de la modification du mot de passe." : "Error modifying password."))
    } finally {
      setIsUpdatingPwd(false)
    }
  }

  // Populate user sync preferences
  useEffect(() => {
    if (user) {
      if (user.auto_sync_enabled !== undefined) setAutoSyncEnabled(Boolean(user.auto_sync_enabled))
      if (user.sync_interval_hours) setSyncInterval(user.sync_interval_hours)
      if (user.sync_time) setSyncTime(user.sync_time)
    }
  }, [user])

  // Save Auto-Sync Settings
  const handleSaveSyncSettings = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSyncSettings(true)
    setSyncSettingsSuccessMsg(null)
    try {
      await FinlyAPI.updateSyncSettings({
        auto_sync_enabled: autoSyncEnabled,
        sync_interval_hours: Number(syncInterval),
        sync_time: syncTime,
      })
      setSyncSettingsSuccessMsg(t.accounts.preferencesSavedSuccess)
      setTimeout(() => setSyncSettingsSuccessMsg(null), 3500)
    } catch {
      // Error handling
    } finally {
      setIsSavingSyncSettings(false)
    }
  }

  // Export JSON Backup
  const handleExportJSON = async () => {
    setIsExportingJSON(true)
    setExportSuccessMsg(null)
    try {
      const data = await FinlyAPI.exportJsonBackup()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      const dateStr = new Date().toISOString().split("T")[0]
      a.href = url
      a.download = `finly_backup_${dateStr}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      setExportSuccessMsg(language === "fr" ? "Fichier de sauvegarde exporté avec succès." : "Backup file exported successfully.")
      setTimeout(() => setExportSuccessMsg(null), 4000)
    } catch (err: any) {
      alert(err.message || (language === "fr" ? "Erreur lors de l'exportation." : "Error exporting backup."))
    } finally {
      setIsExportingJSON(false)
    }
  }

  // Import JSON Backup
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          throw new Error(language === "fr" ? "Format de sauvegarde JSON non reconnu ou données manquantes." : "Unrecognized JSON backup format or missing data.")
        }

        const res = await FinlyAPI.importJsonBackup(parsed)
        setImportSummary(res.imported)
        setImportSuccessMsg(t.accounts.restoreSuccess)
        await loadData()

        if (res.pending_connections && res.pending_connections.length > 0) {
          setPendingBankConnections(res.pending_connections)
          setIsCredentialsModalOpen(true)
        }

        setTimeout(() => setImportSuccessMsg(null), 8000)
      } catch (err: any) {
        setImportErrorMsg(err.message || (language === "fr" ? "Fichier JSON invalide ou corrompu." : "Invalid or corrupt JSON file."))
      } finally {
        setIsImportingJSON(false)
        if (fileInputRef.current) {
          fileInputRef.current.value = ""
        }
      }
    }
    reader.onerror = () => {
      setImportErrorMsg(language === "fr" ? "Erreur lors de la lecture du fichier." : "Error reading file.")
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

  const memberSinceText = useMemo(() => {
    if (user?.created_at) {
      try {
        const date = new Date(user.created_at)
        if (!isNaN(date.getTime())) {
          const monthYear = date.toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
            month: "long",
            year: "numeric",
          })
          return t.accounts.memberSince.replace("{date}", monthYear)
        }
      } catch {
        // fallback
      }
    }
    return t.accounts.memberSince.replace("{date}", "2024")
  }, [user?.created_at, language, t.accounts.memberSince])

  // Mobile Finary Menu (docs/finary/mobile/setting.png)
  const renderMobileMenu = () => (
    <div className="flex flex-col w-full pb-16">
      {/* Top Bar with Back Arrow and Help Button */}
      <div className="flex items-center justify-between pb-6">
        <button
          type="button"
          onClick={handleClose}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
          aria-label="Retour"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <button
          type="button"
          className="px-3.5 py-1.5 rounded-full bg-[#fde68a]/15 border border-[#fde68a]/30 text-[#fde68a] text-xs font-semibold flex items-center gap-1.5 cursor-pointer hover:bg-[#fde68a]/25 transition-colors"
        >
          <span>{t.accounts.needHelp}</span>
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Profile Hero Block (Avatar + Name + Member Since) */}
      <div className="flex items-center gap-4 pt-2">
        <div className="h-16 w-16 rounded-full bg-zinc-800/90 border border-white/10 flex items-center justify-center text-white text-xl font-bold shrink-0 shadow-lg">
          {initials}
        </div>
        <div className="flex flex-col justify-center min-w-0">
          <span className="text-xl font-bold text-white tracking-tight leading-tight truncate">
            {user?.full_name || (language === "fr" ? "Utilisateur" : "User")}
          </span>
          <span className="text-xs text-zinc-400 mt-1">
            {memberSinceText}
          </span>
        </div>
      </div>

      {/* Finary-style Referral Card */}
      <div className="relative overflow-hidden p-5 rounded-2xl bg-gradient-to-r from-zinc-900 to-zinc-850 border border-white/10 mt-6 mb-7 flex flex-col gap-3 shadow-xl">
        <div className="max-w-[75%]">
          <span className="text-sm font-semibold text-white block leading-snug">
            {language === "fr"
              ? "Invitez vos proches, gérez vos finances en toute sérénité"
              : "Invite your peers, manage your finances with serenity"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => handleCopyEmail(typeof window !== "undefined" ? window.location.origin : "")}
          className="px-4 py-2 rounded-full bg-[#fde68a] hover:bg-[#fcd34d] text-zinc-950 font-bold text-xs w-fit cursor-pointer transition-colors shadow-sm"
        >
          {language === "fr" ? "En savoir plus" : "Learn more"}
        </button>
      </div>

      {/* Section Title: Mon Finly */}
      <h2 className="text-2xl font-extrabold text-white tracking-tight mb-2">
        {t.accounts.myFinly}
      </h2>

      {/* Settings Navigation List (iOS / Finary style) */}
      <div className="flex flex-col divide-y divide-white/5">
        <button
          type="button"
          onClick={() => {
            setMobileSubView("profile")
            setActiveTab("profile")
          }}
          className="flex items-center justify-between py-4 text-left cursor-pointer group active:opacity-75 transition-opacity"
        >
          <div className="flex items-center gap-3.5">
            <UserIcon className="w-5 h-5 text-zinc-400" />
            <span className="text-base font-medium text-white">{t.accounts.profileNav}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileSubView("banks")
            setActiveTab("banks")
          }}
          className="flex items-center justify-between py-4 text-left cursor-pointer group active:opacity-75 transition-opacity"
        >
          <div className="flex items-center gap-3.5">
            <RefreshCw className="w-5 h-5 text-zinc-400" />
            <span className="text-base font-medium text-white">{t.accounts.banksNav}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileSubView("security")
            setActiveTab("security")
          }}
          className="flex items-center justify-between py-4 text-left cursor-pointer group active:opacity-75 transition-opacity"
        >
          <div className="flex items-center gap-3.5">
            <Lock className="w-5 h-5 text-zinc-400" />
            <span className="text-base font-medium text-white">{t.accounts.securityNav}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileSubView("preferences")
            setActiveTab("preferences")
          }}
          className="flex items-center justify-between py-4 text-left cursor-pointer group active:opacity-75 transition-opacity"
        >
          <div className="flex items-center gap-3.5">
            <Globe className="w-5 h-5 text-zinc-400" />
            <span className="text-base font-medium text-white">{t.accounts.preferencesNav}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </button>

        <button
          type="button"
          onClick={() => {
            setMobileSubView("backup")
            setActiveTab("backup")
          }}
          className="flex items-center justify-between py-4 text-left cursor-pointer group active:opacity-75 transition-opacity"
        >
          <div className="flex items-center gap-3.5">
            <Database className="w-5 h-5 text-zinc-400" />
            <span className="text-base font-medium text-white">{t.accounts.backupNav}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </button>

        <button
          type="button"
          onClick={logout}
          className="flex items-center justify-between py-4 text-left cursor-pointer group active:opacity-75 transition-opacity"
        >
          <div className="flex items-center gap-3.5">
            <LogOut className="w-5 h-5 text-rose-400" />
            <span className="text-base font-medium text-rose-400">{t.auth.logout}</span>
          </div>
          <ChevronRight className="w-5 h-5 text-rose-400/40" />
        </button>
      </div>
    </div>
  )

  // Mobile Finary Profile Details (docs/finary/mobile/setting_setting.png)
  const renderMobileProfile = () => (
    <div className="flex flex-col w-full pb-16">
      {/* Top Bar with Back Arrow and Centered Title */}
      <div className="flex items-center justify-between pb-6">
        <button
          type="button"
          onClick={() => setMobileSubView("menu")}
          className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
          aria-label="Retour"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>

        <h1 className="text-base font-bold text-white text-center">
          {t.accounts.profileNav}
        </h1>

        <div className="w-10" />
      </div>

      {/* Form Fields corresponding directly to setting_setting.png */}
      <form onSubmit={handleSaveProfile} className="flex flex-col gap-6 pt-2">
        {profileSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{profileSuccessMsg}</span>
          </div>
        )}

        {/* Prénom */}
        <div className="flex flex-col gap-1 border-b border-white/10 pb-3">
          <label className="text-xs text-zinc-500 font-medium">
            {t.accounts.firstName}
          </label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder={t.accounts.firstName}
            className="bg-transparent text-white font-semibold text-base outline-none w-full placeholder:text-zinc-600"
          />
        </div>

        {/* Nom */}
        <div className="flex flex-col gap-1 border-b border-white/10 pb-3">
          <label className="text-xs text-zinc-500 font-medium">
            {t.accounts.lastName}
          </label>
          <input
            type="text"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder={t.accounts.lastName}
            className="bg-transparent text-white font-semibold text-base outline-none w-full placeholder:text-zinc-600"
          />
        </div>

        {/* Email */}
        <div className="flex flex-col gap-1.5 border-b border-white/10 pb-3">
          <label className="text-xs text-zinc-500 font-medium">
            {t.accounts.email}
          </label>
          <div className="flex items-center justify-between gap-2">
            <span className="text-base text-zinc-300 font-medium truncate">{user?.email}</span>
            <button
              type="button"
              onClick={() => handleCopyEmail(user?.email || "")}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors cursor-pointer shrink-0"
              title="Copier l'email"
            >
              {copiedId === "email" ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-zinc-400" />}
            </button>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-md w-fit mt-1">
            <Check className="w-3.5 h-3.5" />
            <span>{t.accounts.verifiedBadge}</span>
          </div>
        </div>

        {/* Langue */}
        <button
          type="button"
          onClick={() => setLanguage(language === "fr" ? "en" : "fr")}
          className="flex items-center justify-between py-3.5 border-b border-white/10 w-full text-left cursor-pointer group"
        >
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-500 font-medium">
              {language === "fr" ? "Langue" : "Language"}
            </span>
            <span className="text-base text-white font-semibold">
              {language === "fr" ? "Français" : "English"}
            </span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
        </button>

        {/* Devise */}
        <div className="flex items-center justify-between py-3.5 border-b border-white/10 w-full">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-zinc-500 font-medium">
              {t.accounts.currency}
            </span>
            <span className="text-base text-white font-semibold">€ - EUR</span>
          </div>
          <ChevronRight className="w-5 h-5 text-zinc-500" />
        </div>

        {/* Supprimer mon compte */}
        <div className="flex flex-col gap-1 pt-4">
          <span className="text-base font-bold text-white">
            {t.accounts.deleteAccountTitle}
          </span>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {t.accounts.deleteAccountDesc}
          </p>
        </div>

        {/* Valider Button */}
        <div className="pt-6">
          <Button
            type="submit"
            disabled={isSavingProfile}
            className="w-full py-3.5 h-12 rounded-2xl bg-[#27272A] hover:bg-[#3F3F46] text-white font-semibold text-sm transition-all cursor-pointer shadow-lg active:scale-[0.99]"
          >
            {isSavingProfile
              ? (language === "fr" ? "Enregistrement..." : "Saving...")
              : t.accounts.validateBtn}
          </Button>
        </div>
      </form>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] bg-[#09090B] overflow-y-auto min-h-screen text-white">
      <div className="max-w-6xl mx-auto px-5 py-6 sm:px-10 sm:py-8 flex flex-col min-h-full">
        {/* MOBILE LAYOUT (Directly matching Finary setting.png & setting_setting.png) */}
        <div className="block md:hidden w-full">
          {mobileSubView === "menu" && renderMobileMenu()}
          {mobileSubView === "profile" && renderMobileProfile()}
          {mobileSubView !== "menu" && mobileSubView !== "profile" && (
            <div className="flex items-center justify-between pb-4 border-b border-white/5 mb-6">
              <button
                type="button"
                onClick={() => setMobileSubView("menu")}
                className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-zinc-300 hover:text-white transition-colors cursor-pointer"
                aria-label="Retour"
              >
                <ArrowLeft className="w-6 h-6" />
              </button>
              <h1 className="text-base font-bold text-white text-center">
                {mobileSubView === "banks" && t.accounts.banksNav}
                {mobileSubView === "security" && t.accounts.securityNav}
                {mobileSubView === "preferences" && t.accounts.preferencesNav}
                {mobileSubView === "backup" && t.accounts.backupNav}
              </h1>
              <div className="w-10" />
            </div>
          )}
        </div>

        {/* DESKTOP Top Header Bar */}
        <header className="hidden md:flex w-full items-center justify-between pb-8">
          <div className="flex items-center gap-2">
            <Image
              src="/logo-full.png"
              alt="Finly"
              width={140}
              height={39}
              className="h-7 sm:h-8 w-auto object-contain"
              priority
            />
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fermer"
            className="w-10 h-10 rounded-full bg-zinc-900 border border-white/10 hover:border-white/20 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-white transition-all cursor-pointer shadow-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* DESKTOP Page Title */}
        <div className="hidden md:block mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            {t.accounts.manageAccount || "Gérer mon compte"}
          </h1>
        </div>

        {/* Content Layout: Responsive between mobile subviews and desktop two-column */}
        <div className={cn(
          "w-full flex-1 pb-16",
          mobileSubView === "menu" || mobileSubView === "profile"
            ? "hidden md:flex md:flex-row items-start gap-8 lg:gap-12"
            : "flex flex-col md:flex-row items-start gap-8 lg:gap-12"
        )}>
          {/* Left Navigation Sidebar (Desktop only) */}
          <aside className="hidden md:flex w-full md:w-64 lg:w-72 shrink-0 flex-col gap-6">
            {/* Group 1: Gérer mon compte */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-1.5">
                {t.accounts.groupAccount || "Gérer mon compte"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("profile")
                  setMobileSubView("profile")
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer",
                  activeTab === "profile"
                    ? "bg-zinc-800 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                )}
              >
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span>{t.accounts.profileNav || "Mon profil"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("security")
                  setMobileSubView("security")
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer",
                  activeTab === "security"
                    ? "bg-zinc-800 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                )}
              >
                <Lock className="w-4 h-4 text-zinc-400" />
                <span>{t.accounts.securityNav || "Sécurité"}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab("preferences")
                  setMobileSubView("preferences")
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer",
                  activeTab === "preferences"
                    ? "bg-zinc-800 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                )}
              >
                <Globe className="w-4 h-4 text-zinc-400" />
                <span>{t.accounts.preferencesNav || "Préférences"}</span>
              </button>
            </div>

            {/* Group 2: Comptes & Banques */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-1.5">
                {t.accounts.groupBanks || "Comptes & Banques"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("banks")
                  setMobileSubView("banks")
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer",
                  activeTab === "banks"
                    ? "bg-zinc-800 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                )}
              >
                <Building2 className="w-4 h-4 text-zinc-400" />
                <span>{t.accounts.banksNav || "Comptes synchronisés"}</span>
              </button>
            </div>

            {/* Group 3: Sauvegarde & Données */}
            <div className="flex flex-col gap-1">
              <div className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-1.5">
                {t.accounts.groupData || "Données & Sécurité"}
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("backup")
                  setMobileSubView("backup")
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer",
                  activeTab === "backup"
                    ? "bg-zinc-800 text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white hover:bg-zinc-900/60"
                )}
              >
                <Database className="w-4 h-4 text-zinc-400" />
                <span>{t.accounts.backupNav || "Sauvegarde & Données"}</span>
              </button>
            </div>

            {/* Logout Button */}
            <div className="pt-4 border-t border-white/5">
              <button
                type="button"
                onClick={logout}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors w-full text-left cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>{t.auth.logout || "Se déconnecter"}</span>
              </button>
            </div>
          </aside>

          {/* Right Content Panel */}
          <main className="flex-1 min-w-0 w-full">
            {/* TAB 1: MON PROFIL */}
            {activeTab === "profile" && (
              <div className="flex flex-col gap-6 max-w-2xl">
                <Card className="p-6 sm:p-8 border-white/10 bg-[#18181B] rounded-3xl shadow-xl">
                  <div className="flex flex-col gap-6">
                    {/* Header with Avatar and User Information */}
                    <div className="flex items-center gap-5 pb-6 border-b border-white/5">
                      <Avatar className="h-16 w-16 ring-2 ring-indigo-500/30">
                        <AvatarFallback className="bg-indigo-600 text-white font-bold text-xl">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="text-lg font-bold text-white">
                            {user?.full_name || (language === "fr" ? "Utilisateur" : "User")}
                          </span>
                          <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] py-0.5 px-2">
                            {t.accounts.verifiedBadge || "VÉRIFIÉ"}
                          </Badge>
                        </div>
                        <span className="text-xs text-zinc-400">{user?.email}</span>
                      </div>
                    </div>

                    {/* Form Fields: Prénom, Nom, Email */}
                    <form onSubmit={handleSaveProfile} className="flex flex-col gap-5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-zinc-400">
                            {t.accounts.firstName || "Prénom"}
                          </label>
                          <Input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-zinc-400">
                            {t.accounts.lastName || "Nom"}
                          </label>
                          <Input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5 sm:col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-zinc-400">
                              {t.accounts.email || "Adresse email"}
                            </label>
                            <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              {t.accounts.verifiedBadge || "Vérifié"}
                            </span>
                          </div>
                          <Input
                            type="email"
                            value={user?.email || ""}
                            disabled
                            className="bg-zinc-900/60 border-white/5 text-zinc-300 rounded-xl text-xs h-10 cursor-not-allowed opacity-80"
                          />
                        </div>
                      </div>

                      {profileSuccessMsg && (
                        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{profileSuccessMsg}</span>
                        </div>
                      )}

                      <div className="flex justify-end pt-2">
                        <Button
                          type="submit"
                          disabled={isSavingProfile}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-10 px-5 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          {isSavingProfile ? t.common.loading : (language === "fr" ? "Enregistrer les modifications" : "Save changes")}
                        </Button>
                      </div>
                    </form>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 2: SÉCURITÉ */}
            {activeTab === "security" && (
              <div className="flex flex-col gap-6 max-w-2xl">
                <Card className="p-6 sm:p-8 border-white/10 bg-[#18181B] rounded-3xl shadow-xl">
                  <CardHeader className="p-0 pb-5">
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <Lock className="w-4 h-4 text-indigo-400" />
                      <span>{t.accounts.changePasswordTitle}</span>
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
                        <label className="text-xs font-semibold text-zinc-400">{t.accounts.currentPassword}</label>
                        <Input
                          type="password"
                          placeholder="••••••••"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          required
                          className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-zinc-400">{t.accounts.newPassword}</label>
                          <Input
                            type="password"
                            placeholder={language === "fr" ? "Au moins 6 caractères" : "At least 6 characters"}
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                            className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
                          />
                        </div>

                        <div className="flex flex-col gap-1.5">
                          <label className="text-xs font-semibold text-zinc-400">{t.accounts.confirmPassword}</label>
                          <Input
                            type="password"
                            placeholder={language === "fr" ? "Répéter le mot de passe" : "Repeat new password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                            className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end mt-2">
                        <Button
                          type="submit"
                          disabled={isUpdatingPwd}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-10 px-5 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          {isUpdatingPwd ? t.common.loading : t.accounts.savePassword}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                {/* Security Guarantee Box */}
                <Card className="p-5 border-white/10 bg-zinc-900/40 rounded-2xl flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-white">
                      {language === "fr" ? "Chiffrement AES-256 local & Sessions sécurisées" : "AES-256 local encryption & Secure sessions"}
                    </span>
                    <span className="text-[11px] text-zinc-400 mt-0.5">
                      {language === "fr"
                        ? "Vos identifiants et clés bancaires ne transitent jamais en clair."
                        : "Your credentials and banking keys are never stored or transmitted in plain text."}
                    </span>
                  </div>
                </Card>
              </div>
            )}

            {/* TAB 3: PRÉFÉRENCES */}
            {activeTab === "preferences" && (
              <div className="flex flex-col gap-6 max-w-2xl">
                <Card className="p-6 sm:p-8 border-white/10 bg-[#18181B] rounded-3xl shadow-xl">
                  <CardHeader className="p-0 pb-5">
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <Globe className="w-4 h-4 text-indigo-400" />
                      <span>{t.accounts.languagePreference}</span>
                    </CardTitle>
                    <p className="text-xs text-zinc-400 mt-1">
                      {t.accounts.languagePreferenceDesc}
                    </p>
                  </CardHeader>
                  <CardContent className="p-0">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-2">
                      <button
                        type="button"
                        onClick={() => setLanguage("en")}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                          language === "en"
                            ? "bg-indigo-600/15 border-indigo-500 text-white font-semibold shadow-sm"
                            : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{t.accounts.english}</span>
                          <span className="text-xs text-zinc-400 mt-0.5">English</span>
                        </div>
                        {language === "en" && <Check className="w-4 h-4 text-indigo-400" />}
                      </button>

                      <button
                        type="button"
                        onClick={() => setLanguage("fr")}
                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all cursor-pointer text-left ${
                          language === "fr"
                            ? "bg-indigo-600/15 border-indigo-500 text-white font-semibold shadow-sm"
                            : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white hover:border-white/20"
                        }`}
                      >
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-white">{t.accounts.french}</span>
                          <span className="text-xs text-zinc-400 mt-0.5">Français (France)</span>
                        </div>
                        {language === "fr" && <Check className="w-4 h-4 text-indigo-400" />}
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* TAB 4: COMPTES SYNCHRONISÉS */}
            {activeTab === "banks" && (
              <div className="flex flex-col gap-6">
                {/* Actions & Summary Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400 font-mono">
                      {bankGroups.length} {language === "fr" ? `établissement${bankGroups.length > 1 ? "s" : ""} relié${bankGroups.length > 1 ? "s" : ""}` : `connected institution${bankGroups.length > 1 ? "s" : ""}`} • {accounts.length} {language === "fr" ? `compte${accounts.length > 1 ? "s" : ""} actif${accounts.length > 1 ? "s" : ""}` : `active account${accounts.length > 1 ? "s" : ""}`}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button
                      onClick={handleSyncAll}
                      disabled={isSyncingAll}
                      variant="outline"
                      size="sm"
                      className="h-9 px-3.5 gap-1.5 border-white/10 bg-zinc-900 text-zinc-200 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs font-semibold"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-indigo-400 ${isSyncingAll ? "animate-spin" : ""}`} />
                      <span>{isSyncingAll ? t.common.syncing : t.accounts.syncAll}</span>
                    </Button>

                    <Button
                      onClick={() => setIsWoobOpen(true)}
                      size="sm"
                      className="h-9 px-4 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl cursor-pointer text-xs font-semibold shadow-md shadow-indigo-600/20"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{t.accounts.connectBank}</span>
                    </Button>
                  </div>
                </div>

                {/* Sync Feedback Toast */}
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
                      {t.common.close}
                    </button>
                  </div>
                )}

                {/* Summary KPI Strip */}
                <div className="flex flex-wrap items-center gap-4 p-4 rounded-2xl bg-zinc-950/60 border border-white/5 font-mono text-xs">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{t.accounts.aggregatedWealth} :</span>
                    <strong className="text-base font-bold text-white">{formatAmount(totalBalance)}</strong>
                  </div>
                  <span className="text-zinc-700 hidden sm:inline">•</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{t.accounts.checkingDeposits} :</span>
                    <span className="font-semibold text-zinc-300">{formatAmount(checkingTotal)}</span>
                  </div>
                  <span className="text-zinc-700 hidden sm:inline">•</span>
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">{t.accounts.savingsAndPlacements} :</span>
                    <span className="font-semibold text-emerald-400">{formatAmount(savingsTotal)}</span>
                  </div>
                </div>

                {/* Bank Institutions Cards List */}
                {bankGroups.length === 0 ? (
                  <Card className="p-12 border-white/10 bg-[#18181B] rounded-3xl text-center flex flex-col items-center justify-center gap-4">
                    <div className="p-4 rounded-3xl bg-zinc-900 border border-white/10 text-zinc-500">
                      <Building2 className="w-10 h-10 text-indigo-400" />
                    </div>
                    <div className="flex flex-col gap-1 max-w-sm">
                      <h3 className="text-base font-bold text-white">{t.accounts.noConnectedBank}</h3>
                      <p className="text-xs text-zinc-400">
                        {t.accounts.noConnectedBankDesc}
                      </p>
                    </div>
                    <Button
                      onClick={() => setIsWoobOpen(true)}
                      className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl text-xs h-9 px-4 gap-2 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>{t.accounts.connectBank}</span>
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
                                  {t.accounts.connectedBadge}
                                </Badge>
                                {group.connection?.last_synced_at && (
                                  <span className="text-[10px] text-zinc-500">
                                    {t.accounts.lastSynced} : {new Date(group.connection.last_synced_at).toLocaleTimeString(language === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                )}
                              </div>
                              <span className="text-xs text-zinc-400 mt-0.5">
                                {group.accounts.length} {language === "fr" ? `compte${group.accounts.length > 1 ? "s" : ""}` : `account${group.accounts.length > 1 ? "s" : ""}`}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 self-end sm:self-auto">
                            <div className="text-right hidden sm:flex flex-col">
                              <span className="text-[11px] text-zinc-500">{t.accounts.institutionBalance}</span>
                              <span className="font-mono text-sm font-bold text-white">
                                {formatAmount(group.totalBalance)}
                              </span>
                            </div>

                            <Button
                              onClick={() => setBankToDelete(group.bankName)}
                              variant="ghost"
                              size="sm"
                              className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 h-8 px-2.5 rounded-xl text-xs gap-1.5 cursor-pointer"
                              title={t.accounts.disconnectBank}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span className="hidden sm:inline">{t.accounts.disconnectBank}</span>
                            </Button>
                          </div>
                        </div>

                        {/* Accounts List */}
                        <div className="divide-y divide-white/5">
                          {group.accounts.map((acc) => (
                            <div
                              key={acc.id}
                              className="p-4 sm:px-6 hover:bg-white/[0.02] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-zinc-900 border border-white/5 text-zinc-400 shrink-0">
                                  {acc.type?.toLowerCase().includes("livret") || acc.type?.toLowerCase().includes("epargne") ? (
                                    <PiggyBank className="w-4 h-4 text-emerald-400" />
                                  ) : acc.type?.toLowerCase().includes("carte") ? (
                                    <CreditCard className="w-4 h-4 text-amber-400" />
                                  ) : acc.type?.toLowerCase().includes("titre") || acc.type?.toLowerCase().includes("pea") ? (
                                    <Landmark className="w-4 h-4 text-cyan-400" />
                                  ) : (
                                    <Wallet className="w-4 h-4 text-indigo-400" />
                                  )}
                                </div>

                                <div className="flex flex-col">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-sm font-semibold text-white">{acc.name}</span>
                                    <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-400 text-[10px] py-0 px-2">
                                      {acc.type || t.accounts.depositAccount}
                                    </Badge>
                                  </div>

                                  {acc.iban && (
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="font-mono text-[11px] text-zinc-500 tracking-wider">
                                        {acc.iban.slice(0, 4)} •••• {acc.iban.slice(-4)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyIban(acc.iban!, acc.id)}
                                        className="text-zinc-500 hover:text-zinc-300 p-0.5 cursor-pointer transition-colors"
                                        title={t.accounts.copyIban}
                                      >
                                        {copiedId === acc.id ? (
                                          <Check className="w-3 h-3 text-emerald-400" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                      {copiedId === acc.id && (
                                        <span className="text-[10px] text-emerald-400 font-medium">
                                          {t.accounts.ibanCopied}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                <span className="font-mono text-sm font-bold text-white">
                                  {formatAmount(acc.balance)}
                                </span>

                                <div className="flex items-center gap-1">
                                  <Button
                                    onClick={() => handleOpenEditAccount(acc)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                                    title={t.accounts.editAccount}
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>

                                  <Button
                                    onClick={() => setAccountToDelete(acc)}
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                                    title={t.accounts.deleteAccount}
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

            {/* TAB 5: SAUVEGARDE & DONNÉES */}
            {activeTab === "backup" && (
              <div className="flex flex-col gap-6 max-w-2xl">
                {/* Export JSON Card */}
                <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-white">{t.accounts.jsonBackupTitle}</span>
                      <span className="text-xs text-zinc-400 mt-0.5">
                        {t.accounts.jsonBackupDesc}
                      </span>
                    </div>
                  </div>

                  <Button
                    onClick={handleExportJSON}
                    disabled={isExportingJSON}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 px-5 rounded-xl cursor-pointer font-semibold shrink-0 shadow-md shadow-indigo-600/20"
                  >
                    {isExportingJSON ? t.common.loading : t.accounts.downloadBackup}
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
                      <span className="text-sm font-bold text-white">{t.accounts.restoreBackupTitle}</span>
                      <span className="text-xs text-zinc-400 mt-0.5">
                        {t.accounts.restoreBackupDesc}
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
                      className="border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs h-10 px-5 rounded-xl cursor-pointer font-semibold"
                    >
                      {isImportingJSON ? t.common.loading : t.accounts.selectJsonFile}
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
                          {importSummary.accounts} {language === "fr" ? "comptes" : "accounts"}, {importSummary.transactions} transactions, {importSummary.projects} {language === "fr" ? "projets importés" : "goals imported"}.
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

                {/* Auto-Sync Settings Card */}
                <Card className="p-6 border-white/10 bg-[#18181B] rounded-3xl shadow-xl">
                  <CardHeader className="p-0 pb-4">
                    <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 text-indigo-400" />
                      <span>{t.accounts.autoSyncTitle}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <form onSubmit={handleSaveSyncSettings} className="flex flex-col gap-4">
                      {syncSettingsSuccessMsg && (
                        <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                          <Check className="w-4 h-4 shrink-0" />
                          <span>{syncSettingsSuccessMsg}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between p-3.5 rounded-2xl bg-zinc-950 border border-white/5">
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-white">{t.accounts.periodicRefresh}</span>
                          <span className="text-[11px] text-zinc-500">
                            {t.accounts.periodicRefreshDesc}
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={autoSyncEnabled}
                            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      {autoSyncEnabled && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-zinc-400">{t.accounts.syncFrequency}</label>
                            <select
                              value={syncInterval}
                              onChange={(e) => setSyncInterval(Number(e.target.value))}
                              className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 outline-none focus:border-indigo-500 cursor-pointer"
                            >
                              <option value={6}>{t.accounts.every6Hours}</option>
                              <option value={12}>{t.accounts.every12Hours}</option>
                              <option value={24}>{t.accounts.every24Hours}</option>
                            </select>
                          </div>

                          <div className="flex flex-col gap-1.5">
                            <label className="text-xs font-semibold text-zinc-400">{t.accounts.referenceTime}</label>
                            <Input
                              type="time"
                              value={syncTime}
                              onChange={(e) => setSyncTime(e.target.value)}
                              className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
                            />
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end mt-2">
                        <Button
                          type="submit"
                          disabled={isSavingSyncSettings}
                          className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-10 px-5 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
                        >
                          {isSavingSyncSettings ? t.common.loading : t.accounts.savePreferences}
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* MODAL: EDIT ACCOUNT */}
      <Dialog open={Boolean(editingAccount)} onOpenChange={(open) => !open && setEditingAccount(null)}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-indigo-400" />
              <span>{t.accounts.editAccount}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 mt-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">{t.accounts.accountName}</label>
              <Input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Ex: Main Checking Account"
                className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">{t.accounts.accountType}</label>
              <select
                value={editType}
                onChange={(e) => setEditType(e.target.value)}
                className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 outline-none focus:border-indigo-500 cursor-pointer"
              >
                <option value="Compte Courant">{t.accounts.checkingType}</option>
                <option value="Livret d'Épargne">{t.accounts.savingsType}</option>
                <option value="Carte Bancaire">{t.accounts.cardType}</option>
                <option value="Compte Titres / PEA">{t.accounts.investmentType}</option>
                <option value="Assurance-Vie">{t.accounts.lifeInsuranceType}</option>
                <option value="Autre">{t.accounts.otherType}</option>
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
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleSaveAccount}
              disabled={isSavingAccount}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              {isSavingAccount ? t.common.loading : t.common.save}
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
              <span>{t.accounts.confirmDeleteAccountTitle}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-zinc-300 leading-relaxed">
            {language === "fr" ? (
              <>
                Êtes-vous sûr de vouloir supprimer le compte <strong className="text-white">{accountToDelete?.name || accountToDelete?.bank}</strong> ({accountToDelete?.iban || accountToDelete?.type}) ?
                <br /><br />
                <span className="text-rose-400 font-medium">Toutes les transactions associées à ce compte seront également supprimées.</span>
              </>
            ) : (
              <>
                Are you sure you want to delete the account <strong className="text-white">{accountToDelete?.name || accountToDelete?.bank}</strong> ({accountToDelete?.iban || accountToDelete?.type})?
                <br /><br />
                <span className="text-rose-400 font-medium">{t.accounts.confirmDeleteAccountDesc}</span>
              </>
            )}
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setAccountToDelete(null)}
              className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs h-9 px-3.5"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDeleteAccount}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isDeleting ? t.common.loading : t.common.delete}
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
              <span>{t.accounts.confirmDeleteBankTitle}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-xs text-zinc-300 leading-relaxed">
            {language === "fr" ? (
              <>
                Êtes-vous sûr de vouloir déconnecter <strong className="text-white">{bankToDelete}</strong> ?
                <br /><br />
                <span className="text-rose-400 font-medium">
                  Tous les sous-comptes et l&apos;ensemble des opérations rattachés à cette banque seront définitivement retirés de votre profil.
                </span>
              </>
            ) : (
              <>
                Are you sure you want to disconnect <strong className="text-white">{bankToDelete}</strong>?
                <br /><br />
                <span className="text-rose-400 font-medium">
                  {t.accounts.confirmDeleteBankDesc}
                </span>
              </>
            )}
          </div>

          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setBankToDelete(null)}
              className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs h-9 px-3.5"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              onClick={handleConfirmDeleteBank}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isDeleting ? t.common.loading : t.accounts.disconnectBank}
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

      {/* Post-Import Bank Credentials Modal */}
      <ImportCredentialsModal
        isOpen={isCredentialsModalOpen}
        onClose={() => setIsCredentialsModalOpen(false)}
        pendingConnections={pendingBankConnections}
        onSuccess={loadData}
      />
    </div>
  )
}
