"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  Eye,
  EyeOff,
  Plus,
  RefreshCw,
  AlertCircle,
  ShieldCheck,
  User as UserIcon,
  Building2,
  Lock,
  LogOut,
  ChevronRight,
  Globe,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getLineFaceAvatarUri } from "@/lib/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { WoobModal } from "@/components/modals/woob-modal"
import { ConnectedAccountsModal } from "@/components/modals/connected-accounts-modal"
import { ChangePasswordModal } from "@/components/modals/change-password-modal"
import { FinlyAPI } from "@/lib/api/finly-api"
import { useAuth } from "@/components/auth-context"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import { Account, BankConnection } from "@/lib/types/finance"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, logout, isImpersonating, stopImpersonating } = useAuth()
  const { isPrivate, togglePrivacy } = usePrivacy()
  const { t, language, setLanguage } = useI18n()

  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [isConnectedAccountsOpen, setIsConnectedAccountsOpen] = useState<boolean>(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [hasSyncError, setHasSyncError] = useState<boolean>(false)
  const [syncErrorCount, setSyncErrorCount] = useState<number>(0)
  const [isSyncing, setIsSyncing] = useState<boolean>(false)

  const checkSyncStatus = useCallback(async () => {
    try {
      const [accRes, connsRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getBankConnections(),
      ])
      setAccounts(accRes.accounts || [])

      if (Array.isArray(connsRes)) {
        const errors = connsRes.filter(
          (c: BankConnection) =>
            c.status &&
            c.status !== "ok" &&
            c.status !== "active" &&
            c.status !== "connected"
        )
        setHasSyncError(errors.length > 0)
        setSyncErrorCount(errors.length)
      }
    } catch {
      // Silent offline fallback
    }
  }, [])

  useEffect(() => {
    checkSyncStatus()
  }, [checkSyncStatus])

  const handleRefresh = async () => {
    if (isSyncing) return
    setIsSyncing(true)
    try {
      await FinlyAPI.triggerSync()
      await checkSyncStatus()
    } catch {
      await checkSyncStatus()
    } finally {
      setIsSyncing(false)
    }
  }

  const handleOpenConnectedAccounts = async () => {
    await checkSyncStatus()
    setIsConnectedAccountsOpen(true)
  }

  if (pathname === "/login") {
    return null
  }

  // Extract first name and initials for mobile profile
  const rawName = user?.full_name || user?.email?.split("@")[0] || ""
  const firstName = rawName.trim().split(/\s+/)[0] || "U"
  const initials = user?.full_name
    ? user.full_name
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : firstName.slice(0, 2).toUpperCase()

  return (
    <>
      {isImpersonating && (
        <div className="sticky top-0 z-50 w-full bg-amber-950/90 backdrop-blur-md px-4 md:px-8 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              {t.nav.userViewMode} : <strong className="text-white">{user?.full_name}</strong> ({user?.email})
            </span>
          </div>
          <button
            onClick={stopImpersonating}
            className="self-start sm:self-auto px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            {t.nav.exitUserView}
          </button>
        </div>
      )}

      {/* Header without any separation line (border-none) */}
      <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2.5 bg-[#09090B]/90 backdrop-blur-md px-4 md:px-8 border-none">
        {/* Left Section on Mobile: Personal Profile Avatar */}
        <div className="flex sm:hidden items-center">
          {user ? (
            <button
              type="button"
              onClick={() => router.push("/compte")}
              className="outline-none flex items-center cursor-pointer active:scale-95 transition-transform"
              aria-label="Mon compte"
            >
              <Avatar className="h-10 w-10 rounded-full ring-2 ring-indigo-500/30 border border-indigo-400/20 shadow-md">
                {user.avatar_seed ? (
                  <AvatarImage
                    src={getLineFaceAvatarUri(user.avatar_seed)}
                    alt={user.full_name || "Avatar"}
                  />
                ) : null}
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xs tracking-wide">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </button>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-medium cursor-pointer"
            >
              {t.nav.login}
            </button>
          )}
        </div>

        {/* Empty placeholder on Desktop to keep Right Controls aligned to the right */}
        <div className="hidden sm:block" />

        {/* Right Section: Sync Alert (if any), Refresh Button, Privacy Visibility Toggle, Add Bank CTA / Square Button */}
        <div className="flex items-center gap-2.5 ml-auto">
          {/* Sync Error Alert Pill (Finary style "Action requise") */}
          {hasSyncError && (
            <button
              type="button"
              onClick={handleOpenConnectedAccounts}
              title={
                language === "fr"
                  ? `${syncErrorCount} connexion bancaire nécessite une action`
                  : `${syncErrorCount} bank connection requires attention`
              }
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
              <span className="hidden sm:inline">{language === "fr" ? "Action requise" : "Action required"}</span>
              <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0 animate-ping" />
            </button>
          )}

          {/* Refresh Button (for both PC and Mobile, icon only) */}
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isSyncing}
            title={language === "fr" ? "Actualiser les données" : "Refresh data"}
            className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            <RefreshCw
              className={cn("w-4 h-4 text-zinc-300", isSyncing && "animate-spin text-indigo-400")}
            />
          </button>

          {/* Visibility Toggle Button (Eye) */}
          <button
            type="button"
            onClick={togglePrivacy}
            title={isPrivate ? "Afficher les montants" : "Masquer les montants"}
            className="h-10 w-10 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 border border-white/10 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            {isPrivate ? (
              <EyeOff className="w-4 h-4 text-amber-400" />
            ) : (
              <Eye className="w-4 h-4 text-zinc-300" />
            )}
          </button>

          {/* Desktop: Add Bank CTA with text */}
          <Button
            size="default"
            onClick={() => setIsWoobOpen(true)}
            className="hidden sm:flex bg-[#27272A] hover:bg-[#323238] border border-white/10 text-white text-xs font-semibold rounded-xl shadow-sm px-4 h-10 cursor-pointer items-center gap-2"
          >
            <Plus className="w-4 h-4 text-white" />
            <span>{language === "fr" ? "Ajouter une banque" : "Add a bank"}</span>
          </Button>

          {/* Mobile: Square '+' Button */}
          <button
            type="button"
            onClick={() => setIsWoobOpen(true)}
            title={language === "fr" ? "Ajouter une banque" : "Add a bank"}
            className="sm:hidden h-10 w-10 rounded-xl bg-[#27272A] hover:bg-[#323238] border border-white/10 flex items-center justify-center text-white cursor-pointer shadow-sm active:scale-95 transition-all shrink-0"
          >
            <Plus className="w-4 h-4 text-white" />
          </button>
        </div>
      </header>

      {/* Woob Bank Connection Sheet */}
      <WoobModal
        isOpen={isWoobOpen}
        onClose={() => setIsWoobOpen(false)}
        onBankConnected={checkSyncStatus}
      />

      {/* Connected Accounts Management Modal */}
      <ConnectedAccountsModal
        isOpen={isConnectedAccountsOpen}
        onClose={() => setIsConnectedAccountsOpen(false)}
        accounts={accounts}
        onAccountsUpdated={checkSyncStatus}
        onOpenAddBank={() => setIsWoobOpen(true)}
      />

      {/* Change Password Modal */}
      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />
    </>
  )
}
