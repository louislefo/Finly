"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
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

export function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
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
      <header className="sticky top-0 z-40 w-full bg-[#09090B]/90 backdrop-blur-md border-b border-white/10 px-4 md:px-8 h-16 flex items-center justify-between transition-all">
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="relative w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center shrink-0">
            <Image
              src="/logo_sombre.png"
              alt="Finly"
              width={32}
              height={32}
              style={{ width: "auto", height: "auto" }}
              className="object-contain"
              priority
            />
          </div>
          <span className="font-bold text-lg text-white tracking-tight group-hover:text-zinc-200 transition-colors">
            Finly
          </span>
        </Link>

        {/* Desktop Top Header Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 bg-zinc-900/60 p-1.5 rounded-xl border border-white/10">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Right Section: User Account Dropdown Menu */}
        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="outline-none">
                <div className="flex items-center gap-2 p-1.5 pl-2 rounded-xl bg-zinc-900/80 border border-white/10 hover:border-indigo-500/40 hover:bg-zinc-800 transition-all cursor-pointer">
                  <Avatar size="sm" className="w-7 h-7">
                    <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-xs font-semibold text-white hidden sm:inline">
                    {firstName}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
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
                    onClick={() => router.push("/compte")}
                    className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <UserIcon className="w-4 h-4 text-zinc-400" />
                    <span>Mon compte & sécurité</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => setIsWoobOpen(true)}
                    className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                  >
                    <Landmark className="w-4 h-4 text-indigo-400" />
                    <span>Connecter une banque</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={handleOpenConnectedAccounts}
                    className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
                  >
                    <CreditCard className="w-4 h-4 text-zinc-400" />
                    <span>Gestion des comptes</span>
                  </DropdownMenuItem>
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
