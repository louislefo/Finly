"use client"

import * as React from "react"
import {
  LayoutDashboard,
  Receipt,
  Target,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  Wallet,
} from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from "@/components/ui/sidebar"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  activeTab?: string
  setActiveTab?: (tab: string) => void
}

export function AppSidebar({ activeTab = "dashboard", setActiveTab, ...props }: AppSidebarProps) {
  const mainNav = [
    { id: "dashboard", title: "Dashboard / Synthèse", icon: LayoutDashboard },
    { id: "transactions", title: "Fil des Dépenses", icon: Receipt },
    { id: "projects", title: "Projets & Budgets", icon: Target },
    { id: "export", title: "Centre d'Exportation", icon: FileSpreadsheet },
  ]

  return (
    <Sidebar collapsible="icon" className="border-r border-white/10 bg-[#09090B]" {...props}>
      <SidebarHeader className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center">
            <Wallet className="w-4 h-4 text-white" />
          </div>
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="font-bold text-base text-white tracking-tight">Finly</span>
            <span className="text-[10px] text-zinc-400">Finance Personnelle PWA</span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mb-2 group-data-[collapsible=icon]:hidden">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const Icon = item.icon
                const isActive = activeTab === item.id

                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      onClick={() => setActiveTab?.(item.id)}
                      isActive={isActive}
                      className={`gap-3 py-2.5 px-3 rounded-xl transition-all cursor-pointer ${
                        isActive
                          ? "bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/30"
                          : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? "text-indigo-400" : ""}`} />
                      <span className="text-xs">{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-white/10 p-4 group-data-[collapsible=icon]:hidden">
        <div className="p-3 rounded-xl bg-zinc-900/60 border border-white/5 flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <div className="flex flex-col text-left">
            <span className="text-xs font-semibold text-white">GoCardless Sync</span>
            <span className="text-[10px] text-zinc-400">Consentement: 142d restants</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
