"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  Wallet,
  ArrowUpDown,
  Compass,
  ChevronDown,
  Building2,
  Lock,
  LogOut,
  User as UserIcon,
  PieChart,
  CreditCard,
  Landmark,
  Plus,
  ShieldCheck,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { WoobModal } from "@/components/modals/woob-modal"
import { ConnectedAccountsModal } from "@/components/modals/connected-accounts-modal"
import { ChangePasswordModal } from "@/components/modals/change-password-modal"
import { FinlyAPI } from "@/lib/api/finly-api"
import { useAuth } from "@/components/auth-context"
import { Account } from "@/lib/types/finance"
import { cn } from "@/lib/utils"

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout, isImpersonating, stopImpersonating } = useAuth()
  const [isWoobOpen, setIsWoobOpen] = useState<boolean>(false)
  const [isConnectedAccountsOpen, setIsConnectedAccountsOpen] = useState<boolean>(false)
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState<boolean>(false)
  const [accounts, setAccounts] = useState<Account[]>([])

  const loadAccounts = async () => {
    try {
      const res = await FinlyAPI.getAccounts()
      setAccounts(res.accounts || [])
    } catch {
      // Offline fallback
    }
  }

  const handleOpenConnectedAccounts = async () => {
    await loadAccounts()
    setIsConnectedAccountsOpen(true)
  }

  const navItems = [
    { label: "Vue Globale", href: "/", icon: Wallet },
    { label: "Dépenses", href: "/depenses", icon: ArrowUpDown },
    { label: "Budgets", href: "/budget", icon: PieChart },
    { label: "Projets", href: "/projets", icon: Compass },
  ]

  // Extract initials
  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  const firstName = user?.full_name ? user.full_name.split(" ")[0] : "Mon Espace"

  // Do not show full header nav on login page
  if (pathname === "/login") {
    return null
  }

  return (
    <>
      {isImpersonating && (
        <div className="sticky top-0 z-50 w-full bg-amber-950/80 backdrop-blur-md border-b border-amber-500/30 px-4 md:px-8 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Mode vue utilisateur : <strong className="text-white">{user?.full_name}</strong> ({user?.email})
            </span>
          </div>
          <button
            onClick={stopImpersonating}
            className="self-start sm:self-auto px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 rounded-lg text-xs font-semibold transition-all cursor-pointer"
          >
            Quitter la vue utilisateur
          </button>
        </div>
      )}
      <header className="sticky top-0 z-40 w-full pt-2.5 sm:pt-3 px-2.5 sm:px-6 pb-2 bg-gradient-to-b from-[#09090B] via-[#09090B]/95 to-transparent backdrop-blur-md">
        <div className="max-w-5xl mx-auto bg-[#18181B]/95 border border-white/10 rounded-full px-3 sm:px-5 h-12 sm:h-14 flex items-center justify-between shadow-2xl shadow-black/60 ring-1 ring-white/5 gap-2 sm:gap-4">
          {/* Brand Title */}
          <Link href="/" className="flex items-center shrink-0 pr-1 group">
            <span className="font-[family-name:var(--font-logo)] text-2xl sm:text-3xl text-zinc-100 tracking-wide select-none group-hover:text-white transition-colors">
              Finly
            </span>
          </Link>

          {/* Desktop Categories Navigation Links */}
          <nav className="hidden md:flex items-center gap-1.5 py-0.5">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer select-none",
                    isActive
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                      : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                  )}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          {/* Right Section: User Account Dropdown Menu */}
          <div className="flex items-center shrink-0">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger className="outline-none">
                  <div className="flex items-center gap-2 sm:gap-2.5 py-1 px-2 sm:px-3 rounded-full bg-zinc-900/90 border border-white/10 hover:border-indigo-500/40 hover:bg-zinc-800 transition-all cursor-pointer shadow-sm group">
                    <Avatar size="sm" className="w-6 h-6 sm:w-7 sm:h-7 shrink-0">
                      <AvatarFallback className="bg-indigo-600 text-white font-bold text-[11px] sm:text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs sm:text-sm font-semibold text-white tracking-tight group-hover:text-zinc-100 transition-colors max-w-[110px] sm:max-w-[180px] truncate">
                      {user.full_name || firstName}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 group-hover:text-zinc-200 transition-colors shrink-0" />
                  </div>
                </DropdownMenuTrigger>

              <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-56 p-1.5 bg-[#18181B] border border-white/10 text-white rounded-2xl shadow-2xl"
              >
                <div
                  onClick={() => router.push("/compte")}
                  className="p-2 flex items-center gap-2.5 border-b border-white/5 mb-1 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                >
                  <Avatar size="default" className="w-8 h-8">
                    <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left truncate">
                    <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                      {user.full_name}
                    </span>
                    <span className="text-[10px] text-zinc-400 truncate">{user.email}</span>
                  </div>
                </div>

                <DropdownMenuGroup>
                  <DropdownMenuItem
                    onClick={() => router.push("/patrimoine")}
                    className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <Landmark className="w-4 h-4 text-emerald-400" />
                    <span>Patrimoine & Actifs</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => router.push("/compte")}
                    className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <Building2 className="w-4 h-4 text-indigo-400" />
                    <span>Banques & Comptes</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setIsWoobOpen(true)}
                    className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                  >
                    <Plus className="w-4 h-4 text-indigo-400" />
                    <span>Connecter une banque</span>
                  </DropdownMenuItem>

                  {user?.role === "admin" && (
                    <DropdownMenuItem
                      onClick={() => router.push("/admin")}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4 text-amber-400" />
                      <span>Administration</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuGroup>

                <DropdownMenuSeparator className="bg-white/5 my-1" />

                <DropdownMenuItem
                  onClick={logout}
                  className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/20 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-rose-400" />
                  <span>Se déconnecter</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => router.push("/login")}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-all shadow-md shadow-indigo-600/20 cursor-pointer"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Connexion</span>
            </button>
          )}
          </div>
        </div>
      </header>

      {/* Woob Bank Connection Sheet */}
      <WoobModal
        isOpen={isWoobOpen}
        onClose={() => setIsWoobOpen(false)}
        onBankConnected={loadAccounts}
      />

      {/* Connected Accounts Management Modal */}
      <ConnectedAccountsModal
        isOpen={isConnectedAccountsOpen}
        onClose={() => setIsConnectedAccountsOpen(false)}
        accounts={accounts}
        onAccountsUpdated={loadAccounts}
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
