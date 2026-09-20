"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutGrid, PieChart, TrendingUp, Compass } from "lucide-react"
import { useI18n } from "@/components/i18n-context"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const pathname = usePathname()
  const { t, language } = useI18n()

  if (pathname === "/login") {
    return null
  }

  // Exact 4 categories requested: Synthèse, Budget, Analyse, Projet
  const items = [
    {
      href: "/",
      label: t.nav.overview, // "Synthèse" in French, "Overview" in English
      icon: LayoutGrid,
    },
    {
      href: "/budget",
      label: t.nav.budgets, // "Budget" / "Budgets"
      icon: PieChart,
    },
    {
      href: "/analyse",
      label: t.nav.analysis, // "Analyse" / "Analysis"
      icon: TrendingUp,
    },
    {
      href: "/projets",
      label: language === "fr" ? "Projet" : t.nav.projects,
      icon: Compass,
    },
  ]

  return (
    <div className="md:hidden fixed bottom-5 left-0 right-0 z-40 flex justify-center pointer-events-none px-4 pb-[env(safe-area-inset-bottom)]">
      <nav className="pointer-events-auto w-full max-w-[350px] bg-[#121215]/85 backdrop-blur-2xl border border-white/[0.12] p-1.5 rounded-full shadow-[0_12px_40px_rgba(0,0,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.15)] ring-1 ring-black/50 flex items-center justify-between gap-1">
        {items.map((item) => {
          const Icon = item.icon
          const isActive =
            pathname === item.href ||
            (item.href !== "/" && pathname?.startsWith(item.href))

          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              className={cn(
                "flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all duration-200 cursor-pointer text-[10px] tracking-tight select-none active:scale-95 gap-0.5",
                isActive
                  ? "bg-indigo-600 text-white shadow-[0_4px_16px_rgba(79,70,229,0.35),inset_0_1px_0_rgba(255,255,255,0.2)] font-semibold"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/[0.04] font-medium"
              )}
            >
              <Icon
                className={cn(
                  "w-[18px] h-[18px] shrink-0 transition-transform duration-150",
                  isActive ? "scale-105" : "scale-100"
                )}
                strokeWidth={isActive ? 2.3 : 1.8}
              />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
