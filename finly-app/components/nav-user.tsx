"use client"

import React from "react"
import { useRouter } from "next/navigation"
import {
  Avatar,
  AvatarFallback,
} from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  User as UserIcon,
  Building2,
  Lock,
  LogOut,
  ShieldCheck,
  MoreVertical,
  ChevronRight,
  Globe,
} from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { useI18n } from "@/components/i18n-context"

export function NavUser() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const { isMobile } = useSidebar()

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            onClick={() => router.push("/login")}
            className="w-full justify-start text-xs font-semibold text-zinc-300 hover:text-white hover:bg-white/5"
          >
            <UserIcon className="w-5 h-5 mr-2 text-indigo-400" />
            <span>{t.nav.login}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    )
  }

  // Extract first name only for intimate personal display
  const rawName = user.full_name || user.email.split("@")[0]
  const firstName = rawName.trim().split(/\s+/)[0]

  const initials = user.full_name
    ? user.full_name
        .split(/\s+/)
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : firstName.slice(0, 2).toUpperCase()

  const handleNavigate = (tab?: string) => {
    if (tab) {
      router.push(`/compte?tab=${tab}`)
    } else {
      router.push("/compte")
    }
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            openOnHover
            delay={120}
            closeDelay={200}
            render={
              <SidebarMenuButton
                size="lg"
                onClick={() => handleNavigate()}
                className="data-[state=open]:bg-white/5 hover:bg-white/5 transition-all p-2 rounded-2xl h-auto flex items-center justify-between group-data-[collapsible=icon]:justify-center group cursor-pointer select-none"
              />
            }
          >
            {/* Prominent Personal Avatar & Name - Clicking goes to /compte */}
            <div
              onClick={(e) => {
                e.stopPropagation()
                handleNavigate()
              }}
              className="flex items-center gap-3 truncate cursor-pointer"
            >
              <Avatar className="h-10 w-10 sm:h-11 sm:w-11 rounded-full ring-2 ring-indigo-500/30 border border-indigo-400/20 shadow-md shrink-0 transition-transform group-hover:scale-105">
                <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-sm tracking-wide">
                  {initials}
                </AvatarFallback>
              </Avatar>

              {/* Only First Name displayed as requested */}
              <div className="flex flex-col text-left truncate group-data-[collapsible=icon]:hidden">
                <span className="font-bold text-white text-base tracking-tight truncate group-hover:text-zinc-100 transition-colors">
                  {firstName}
                </span>
              </div>
            </div>

            {/* Discreet 3-dots Menu Icon */}
            <MoreVertical className="ml-auto w-4 h-4 text-zinc-400 group-hover:text-white group-data-[collapsible=icon]:hidden shrink-0 transition-colors" />
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-64 p-2 bg-[#18181B] border border-white/10 text-white rounded-2xl shadow-2xl backdrop-blur-xl"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={8}
          >
            {/* Profile Header Box */}
            <div className="px-2 pt-1 pb-2 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              {language === "fr" ? "Mon profil" : "My Profile"}
            </div>

            <div
              onClick={() => handleNavigate("profile")}
              className="p-2.5 flex items-center justify-between rounded-xl bg-white/[0.03] hover:bg-white/[0.08] transition-colors cursor-pointer group mb-2 border border-white/5"
            >
              <div className="flex items-center gap-3 truncate">
                <Avatar className="h-9 w-9 rounded-full ring-1 ring-white/10 shrink-0">
                  <AvatarFallback className="bg-indigo-600 text-white font-bold text-xs">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col text-left truncate">
                  <span className="text-xs font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                    {user.full_name || firstName}
                  </span>
                  <span className="text-[10px] text-zinc-400 truncate">{user.email}</span>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-zinc-500 group-hover:text-zinc-200 transition-colors shrink-0 ml-2" />
            </div>

            <DropdownMenuGroup className="space-y-0.5">
              <DropdownMenuItem
                onClick={() => handleNavigate("profile")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <UserIcon className="w-4 h-4 text-zinc-400" />
                <span>{t.nav.myAccount}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleNavigate("banks")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <Building2 className="w-4 h-4 text-zinc-400" />
                <span>{t.nav.connectedAccounts}</span>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => handleNavigate("security")}
                className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer"
              >
                <Lock className="w-4 h-4 text-zinc-400" />
                <span>{t.nav.security}</span>
              </DropdownMenuItem>

              {user.role === "admin" && (
                <DropdownMenuItem
                  onClick={() => handleNavigate("admin")}
                  className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-amber-300 hover:bg-amber-500/10 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>{t.nav.admin}</span>
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="bg-white/5 my-1.5" />

            {/* Language Switcher inside Profile Menu */}
            <div className="px-2 py-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-zinc-400">
                <Globe className="w-3.5 h-3.5" />
                <span>{language === "fr" ? "Langue" : "Language"}</span>
              </div>
              <div className="flex items-center bg-zinc-900 border border-white/10 rounded-full p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                    language === "en" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  EN
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("fr")}
                  className={`px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                    language === "fr" ? "bg-indigo-600 text-white" : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  FR
                </button>
              </div>
            </div>

            <DropdownMenuSeparator className="bg-white/5 my-1.5" />

            <DropdownMenuItem
              onClick={logout}
              className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-medium text-rose-400 hover:bg-rose-500/15 cursor-pointer"
            >
              <LogOut className="w-4 h-4 text-rose-400" />
              <span>{t.nav.logout}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
