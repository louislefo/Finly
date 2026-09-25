import React from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { MobileNav } from "@/components/mobile-nav"

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <SidebarProvider defaultOpen={true}>
      {/* Official Shadcn Desktop Left Sidebar with User Account at Bottom Left */}
      <AppSidebar />

      {/* Main Content Area */}
      <SidebarInset className="bg-[#09090B] flex flex-col min-h-screen">
        {/* Top Contextual Header with SidebarTrigger, Privacy toggle & Action buttons */}
        <AppHeader />

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3 sm:p-6 md:p-8 overflow-y-auto pb-24 md:pb-8">
          {children}
        </main>

        {/* Mobile Bottom Navigation Bar (Synthèse, Budget, Analyse, Projet) */}
        <MobileNav />
      </SidebarInset>
    </SidebarProvider>
  )
}
