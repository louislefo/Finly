"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Receipt, PieChart, Target } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const pathname = usePathname()

  if (pathname === "/login") {
    return null
  }

  const items = [
    { href: "/", label: "Accueil", icon: Home },
    { href: "/depenses", label: "Dépenses", icon: Receipt },
    { href: "/budget", label: "Budgets", icon: PieChart },
    { href: "/projets", label: "Projets", icon: Target },
  ]

  return (
    <div className="md:hidden fixed bottom-6 left-0 right-0 z-40 flex justify-center pointer-events-none px-4">
      <nav className="pointer-events-auto w-full max-w-sm bg-[#18181B]/90 backdrop-blur-xl border border-white/10 p-2 rounded-full shadow-2xl flex items-center justify-between gap-1.5 ring-1 ring-white/5">
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
                "flex-1 flex items-center justify-center transition-all cursor-pointer rounded-full py-3",
                isActive
                  ? "bg-zinc-800 text-indigo-400 border border-white/10 shadow-sm scale-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-white/5"
              )}
            >
              <Icon className="w-6 h-6" />
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
