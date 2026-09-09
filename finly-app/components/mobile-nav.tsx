"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Wallet, ArrowUpDown, PieChart, Compass } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const pathname = usePathname()

  if (pathname === "/login") {
    return null
  }

  const items = [
    { href: "/", label: "Vue Globale", icon: Wallet },
    { href: "/depenses", label: "Dépenses", icon: ArrowUpDown },
    { href: "/budget", label: "Budgets", icon: PieChart },
    { href: "/projets", label: "Projets", icon: Compass },
  ]

  return (
    <div className="md:hidden fixed bottom-5 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
      <nav className="pointer-events-auto w-full max-w-sm bg-[#18181B]/95 backdrop-blur-xl border border-white/10 p-1.5 rounded-full shadow-2xl flex items-center justify-between gap-1 ring-1 ring-white/5">
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
                "flex-1 flex flex-col items-center justify-center py-2 px-1 rounded-full transition-all cursor-pointer text-[10px] font-semibold gap-1 select-none",
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              )}
            >
              <Icon className="w-4 h-4" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
