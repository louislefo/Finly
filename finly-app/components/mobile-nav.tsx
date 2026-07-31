"use client"

import React from "react"
import { Home, Receipt, Target } from "lucide-react"
import { cn } from "@/lib/utils"

interface MobileNavProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export function MobileNav({ activeTab, setActiveTab }: MobileNavProps) {
  const items = [
    { id: "dashboard", label: "Accueil", icon: Home },
    { id: "transactions", label: "Dépenses", icon: Receipt },
    { id: "projects", label: "Projets", icon: Target },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090B]/90 backdrop-blur-lg border-t border-white/10 px-4 py-2 flex items-center justify-around shadow-2xl">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = activeTab === item.id

        return (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={cn(
              "flex flex-col items-center gap-1 py-1 px-4 rounded-xl transition-all cursor-pointer",
              isActive
                ? "text-indigo-400 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            )}
          >
            <div
              className={cn(
                "p-1.5 rounded-xl transition-all",
                isActive ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30" : ""
              )}
            >
              <Icon className="w-5 h-5" />
            </div>
            <span className="text-[11px]">{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
