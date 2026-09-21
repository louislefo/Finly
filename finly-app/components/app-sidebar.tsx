"use client"

import React, { useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname, useRouter } from "next/navigation"
import {
  LayoutGrid,
  Landmark,
  TrendingUp,
  PieChart,
  Compass,
  ArrowUpDown,
  Wrench,
  ChevronRight,
  Coins,
  ArrowLeftRight,
  PanelLeft,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { NavUser } from "@/components/nav-user"
import { useI18n } from "@/components/i18n-context"
import { cn } from "@/lib/utils"

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const pathname = usePathname()
  const { t } = useI18n()
  const { toggleSidebar } = useSidebar()

  const isToolsActive =
    pathname?.startsWith("/crypto") || pathname?.startsWith("/devises") || false
  const [isToolsOpen, setIsToolsOpen] = useState(isToolsActive)

  if (pathname === "/login") {
    return null
  }

  const navItems = [
    {
      title: t.nav.overview,
      url: "/",
      icon: LayoutGrid,
      isActive: pathname === "/",
    },
    {
      title: t.nav.wealth,
      url: "/patrimoine",
      icon: Landmark,
      isActive: pathname?.startsWith("/patrimoine"),
    },
    {
      title: t.nav.analysis,
      url: "/analyse",
      icon: TrendingUp,
      isActive: pathname?.startsWith("/analyse"),
    },
    {
      title: t.nav.budgets,
      url: "/budget",
      icon: PieChart,
      isActive: pathname?.startsWith("/budget"),
    },
    {
      title: t.nav.projects,
      url: "/projets",
      icon: Compass,
      isActive: pathname?.startsWith("/projets"),
    },
    {
      title: t.nav.expenses,
      url: "/depenses",
      icon: ArrowUpDown,
      isActive: pathname?.startsWith("/depenses"),
    },
  ]

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-white/10 bg-[#09090B] text-zinc-300"
      {...props}
    >
      {/* Brand Header */}
      <SidebarHeader className="border-b border-white/5 py-3.5 px-3 flex flex-row items-center justify-between group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2.5">
        {/* Expanded Mode: Full Logo with text */}
        <Link
          href="/"
          className="flex items-center group transition-transform duration-150 active:scale-95 group-data-[collapsible=icon]:hidden pl-1"
        >
          <Image
            src="/logo-full.png"
            alt="Finly"
            width={120}
            height={34}
            className="h-7 sm:h-[30px] w-auto object-contain"
            priority
          />
        </Link>

        {/* Expanded Mode: Close Sidebar Trigger */}
        <SidebarTrigger
          title={t.nav.closeSidebar}
          className="text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer size-10 [&_svg]:size-5 group-data-[collapsible=icon]:hidden"
        />

        {/* Collapsed Mode: Logo that reveals sidebar open icon on hover and reopens sidebar on click */}
        <button
          type="button"
          onClick={toggleSidebar}
          aria-label={t.nav.openSidebar}
          title={t.nav.openSidebar}
          className="hidden group-data-[collapsible=icon]:flex relative items-center justify-center size-11 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer group/toggle active:scale-95"
        >
          {/* Default state: Emblem logo */}
          <Image
            src="/logo-icon.png"
            alt="Finly"
            width={34}
            height={20}
            className="h-5 w-auto object-contain transition-all duration-200 group-hover/toggle:opacity-0 group-hover/toggle:scale-75 pointer-events-none"
            priority
          />

          {/* Hover state: Sidebar open panel icon takes over */}
          <PanelLeft className="w-5 h-5 absolute transition-all duration-200 opacity-0 scale-75 group-hover/toggle:opacity-100 group-hover/toggle:scale-100 text-zinc-200 pointer-events-none" />
        </button>
      </SidebarHeader>

      {/* Navigation Links - Bigger, Cleaner without useless section labels */}
      <SidebarContent className="px-3 py-4">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      isActive={item.isActive}
                      tooltip={item.title}
                      render={<Link href={item.url} />}
                      className={cn(
                        "rounded-xl px-3.5 py-3 text-[14px] sm:text-[15px] font-semibold transition-all cursor-pointer select-none flex items-center gap-3.5 h-auto",
                        item.isActive
                          ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                          : "text-zinc-400 hover:text-white hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-5 h-5 group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:h-6 shrink-0 transition-transform duration-150" />
                      <span className="truncate">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {/* Outils - Collapsible / Dropdown with sub-tools */}
              <SidebarMenuItem>
                {/* Collapsed Mode: Flyout Dropdown */}
                <div className="hidden group-data-[collapsible=icon]:block">
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      render={
                        <SidebarMenuButton
                          isActive={isToolsActive}
                          className={cn(
                            "rounded-xl px-3.5 py-3 text-[14px] sm:text-[15px] font-semibold transition-all cursor-pointer select-none flex items-center gap-3.5 h-auto w-full outline-none",
                            isToolsActive
                              ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          )}
                        />
                      }
                    >
                      <Wrench className="w-5 h-5 group-data-[collapsible=icon]:w-6 group-data-[collapsible=icon]:h-6 shrink-0 transition-transform duration-150" />
                      <span className="truncate">{t.nav.tools}</span>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side="right"
                      align="start"
                      sideOffset={8}
                      className="w-56 bg-[#18181B] border border-white/10 text-white rounded-2xl p-1.5 text-xs shadow-2xl space-y-1"
                    >
                      <div className="px-2.5 py-1.5 text-zinc-400 text-[11px] font-semibold">
                        {t.nav.tools}
                      </div>
                      <DropdownMenuSeparator className="bg-white/5 my-1" />
                      <DropdownMenuItem
                        onClick={() => router.push("/crypto")}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-white/5 text-xs font-medium",
                          pathname?.startsWith("/crypto")
                            ? "text-indigo-400 font-bold bg-white/5"
                            : "text-zinc-300"
                        )}
                      >
                        <Coins className="w-4 h-4 text-zinc-400" />
                        <span>{t.nav.crypto}</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => router.push("/devises")}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-xl cursor-pointer hover:bg-white/5 text-xs font-medium",
                          pathname?.startsWith("/devises")
                            ? "text-indigo-400 font-bold bg-white/5"
                            : "text-zinc-300"
                        )}
                      >
                        <ArrowLeftRight className="w-4 h-4 text-zinc-400" />
                        <span>{t.nav.forex}</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Expanded Mode: Accordion Sub-menu */}
                <div className="group-data-[collapsible=icon]:hidden">
                  <SidebarMenuButton
                    isActive={isToolsActive}
                    onClick={() => setIsToolsOpen(!isToolsOpen)}
                    className={cn(
                      "rounded-xl px-3.5 py-3 text-[14px] sm:text-[15px] font-semibold transition-all cursor-pointer select-none flex items-center justify-between w-full h-auto",
                      isToolsActive
                        ? "bg-indigo-600/15 text-indigo-300 border border-indigo-500/30 font-bold"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <Wrench className="w-5 h-5 shrink-0" />
                      <span className="truncate">{t.nav.tools}</span>
                    </div>
                    <ChevronRight
                      className={cn(
                        "w-4 h-4 text-zinc-400 transition-transform duration-200",
                        isToolsOpen && "rotate-90"
                      )}
                    />
                  </SidebarMenuButton>

                  {isToolsOpen && (
                    <SidebarMenuSub className="ml-5 pl-3 border-l border-white/10 my-1 space-y-1">
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          render={<Link href="/crypto" />}
                          isActive={pathname?.startsWith("/crypto")}
                          className={cn(
                            "px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer",
                            pathname?.startsWith("/crypto")
                              ? "bg-indigo-600 text-white font-bold shadow-sm"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <Coins className="w-4 h-4" />
                          <span>{t.nav.crypto}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                      <SidebarMenuSubItem>
                        <SidebarMenuSubButton
                          render={<Link href="/devises" />}
                          isActive={pathname?.startsWith("/devises")}
                          className={cn(
                            "px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-2.5 transition-colors cursor-pointer",
                            pathname?.startsWith("/devises")
                              ? "bg-indigo-600 text-white font-bold shadow-sm"
                              : "text-zinc-400 hover:text-white hover:bg-white/5"
                          )}
                        >
                          <ArrowLeftRight className="w-4 h-4" />
                          <span>{t.nav.forex}</span>
                        </SidebarMenuSubButton>
                      </SidebarMenuSubItem>
                    </SidebarMenuSub>
                  )}
                </div>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Account Footer in Bottom Left */}
      <SidebarFooter className="border-t border-white/5 p-3">
        <NavUser />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}
