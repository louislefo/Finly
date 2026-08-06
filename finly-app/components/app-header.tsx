"use client"

import React, { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Wallet,
  Lock,
  Settings,
  LogOut,
  ChevronDown,
  PlusCircle,
  CreditCard,
  LayoutDashboard,
  Receipt,
  Target,
  FileSpreadsheet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { GoCardlessModal } from "@/components/modals/gocardless-modal"
import { ExportDialog } from "@/components/modals/export-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

export function AppHeader() {
  const pathname = usePathname()
  const [isGoCardlessOpen, setIsGoCardlessOpen] = useState<boolean>(false)
  const [isExportDialogOpen, setIsExportDialogOpen] = useState<boolean>(false)
  const [securityModalOpen, setSecurityModalOpen] = useState<boolean>(false)

  const navItems = [
    { href: "/", label: "Accueil", icon: LayoutDashboard },
    { href: "/depenses", label: "Dépenses", icon: Receipt },
    { href: "/projets", label: "Projets", icon: Target },
  ]

  return (
    <>
      <header className="sticky top-0 z-40 w-full bg-[#09090B]/90 backdrop-blur-md border-b border-white/10 px-4 md:px-8 h-16 flex items-center justify-between transition-all">
        {/* Brand Logo & Title */}
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center shadow-md shadow-indigo-500/20">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div className="flex flex-col">
            <span className="font-bold text-lg text-white tracking-tight flex items-center gap-2">
              Finly
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                PWA
              </span>
            </span>
          </div>
        </Link>

        {/* Desktop Top Header Navigation Links (App Router / Next.js Links) */}
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
          <DropdownMenu>
            <DropdownMenuTrigger className="outline-none">
              <div className="flex items-center gap-2.5 p-1.5 pl-2 rounded-xl bg-zinc-900/80 border border-white/10 hover:border-indigo-500/40 hover:bg-zinc-800 transition-all cursor-pointer">
                <Avatar size="sm" className="w-7 h-7">
                  <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                    LL
                  </AvatarFallback>
                </Avatar>
                <span className="text-xs font-semibold text-white hidden sm:inline">
                  Louis
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-zinc-400" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent
              align="end"
              sideOffset={8}
              className="w-64 p-2 bg-[#18181B] border border-white/10 text-white rounded-2xl shadow-2xl"
            >
              {/* User Profile Header */}
              <div className="p-2 flex items-center gap-3 border-b border-white/5 mb-1">
                <Avatar size="default" className="w-9 h-9">
                  <AvatarFallback className="bg-indigo-600 text-white font-bold text-sm">
                    LL
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left">
                  <span className="text-sm font-bold text-white">Louis Lefevre</span>
                  <span className="text-[11px] text-zinc-400">louis@finly.app</span>
                </div>
              </div>

              <DropdownMenuGroup>
                {/* Lier un compte GoCardless */}
                <DropdownMenuItem
                  onClick={() => setIsGoCardlessOpen(true)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-indigo-300 hover:bg-indigo-500/20 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 text-indigo-400" />
                  <div className="flex flex-col text-left">
                    <span>Lier un compte (GoCardless)</span>
                    <span className="text-[10px] text-zinc-400 font-normal">Synchronisation bancaire DSP2</span>
                  </div>
                </DropdownMenuItem>

                {/* Exporter mes données Excel */}
                <DropdownMenuItem
                  onClick={() => setIsExportDialogOpen(true)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-zinc-200 hover:bg-white/5 cursor-pointer"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Exporter mes données Excel</span>
                </DropdownMenuItem>

                {/* Mes Comptes Reliés */}
                <DropdownMenuItem className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
                  <CreditCard className="w-4 h-4 text-zinc-400" />
                  <span>Comptes Reliés (3 actifs)</span>
                </DropdownMenuItem>

                {/* Sécurité & Confidentialité */}
                <DropdownMenuItem
                  onClick={() => setSecurityModalOpen(true)}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-zinc-200 hover:bg-white/5 cursor-pointer"
                >
                  <Lock className="w-4 h-4 text-zinc-400" />
                  <span>Sécurité & Confidentialité</span>
                </DropdownMenuItem>

                {/* Paramètres */}
                <DropdownMenuItem className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs text-zinc-200 hover:bg-white/5 cursor-pointer">
                  <Settings className="w-4 h-4 text-zinc-400" />
                  <span>Paramètres de l'application</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>

              <DropdownMenuSeparator className="bg-white/5 my-1" />

              {/* Déconnexion */}
              <DropdownMenuItem className="flex items-center gap-2.5 p-2.5 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 cursor-pointer">
                <LogOut className="w-4 h-4 text-rose-400" />
                <span>Déconnexion</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* GoCardless Connection Modal */}
      <GoCardlessModal
        isOpen={isGoCardlessOpen}
        onClose={() => setIsGoCardlessOpen(false)}
      />

      {/* Global Excel Export Modal */}
      <ExportDialog
        isOpen={isExportDialogOpen}
        onClose={() => setIsExportDialogOpen(false)}
        defaultScope="all"
        title="Exporter toutes mes données (Excel / CSV)"
      />

      {/* Security & Privacy Dialog Sheet */}
      <Sheet open={securityModalOpen} onOpenChange={setSecurityModalOpen}>
        <SheetContent side="bottom" className="bg-[#18181B] border-t border-white/10 text-white rounded-t-3xl p-6 max-w-lg mx-auto">
          <div className="flex flex-col gap-5">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

            <SheetHeader className="p-0 text-left">
              <SheetTitle className="text-lg font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5 text-indigo-400" /> Sécurité & Confidentialité
              </SheetTitle>
              <SheetDescription className="text-xs text-zinc-400">
                Paramètres de protection des données financières
              </SheetDescription>
            </SheetHeader>

            <div className="flex flex-col gap-3">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Thème Visuel</span>
                  <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300">
                    Dark Mode Forcé
                  </Badge>
                </div>
                <span className="text-[11px] text-zinc-400">
                  L'interface utilise exclusivement le mode sombre OLED Deep Space.
                </span>
              </div>

              <div className="p-4 rounded-2xl bg-zinc-900 border border-white/5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-white">Agrégation DSP2 GoCardless</span>
                  <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">
                    Chiffrement AES-256
                  </Badge>
                </div>
                <span className="text-[11px] text-zinc-400">
                  Vos jetons d'accès bancaires sont chiffrés. Aucun mot de passe bancaire n'est jamais demandé.
                </span>
              </div>
            </div>

            <Button
              onClick={() => setSecurityModalOpen(false)}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium mt-2"
            >
              Fermer
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
