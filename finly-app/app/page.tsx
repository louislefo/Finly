"use client"

import React, { useState } from "react"
import { PrivacyProvider } from "@/components/privacy-context"
import { AppHeader } from "@/components/app-header"
import { MobileNav } from "@/components/mobile-nav"
import { DashboardView } from "@/components/views/dashboard-view"
import { TransactionsView } from "@/components/views/transactions-view"
import { ProjectsView } from "@/components/views/projects-view"

export default function Home() {
  const [activeTab, setActiveTab] = useState<string>("dashboard")

  return (
    <PrivacyProvider>
      <div className="dark min-h-screen bg-[#09090B] text-[#e5e1e4] font-sans flex flex-col selection:bg-indigo-500/30 selection:text-indigo-200">
        {/* Top App Header with PC Navigation Tabs (Accueil, Dépenses, Projets) & Account Dropdown */}
        <AppHeader activeTab={activeTab} setActiveTab={setActiveTab} />

        {/* Main Content View Container */}
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          {activeTab === "dashboard" && <DashboardView onNavigate={setActiveTab} />}
          {activeTab === "transactions" && <TransactionsView />}
          {activeTab === "projects" && <ProjectsView />}
        </main>

        {/* Mobile Navigation Bar */}
        <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      </div>
    </PrivacyProvider>
  )
}
