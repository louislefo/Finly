"use client"

import React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Home, Receipt, Target } from "lucide-react"
import { cn } from "@/lib/utils"

export function MobileNav() {
  const pathname = usePathname()

  const items = [
    { href: "/", label: "Accueil", icon: Home },
    { href: "/depenses", label: "Dépenses", icon: Receipt },
    { href: "/projets", label: "Projets", icon: Target },
  ]

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#09090B]/90 backdrop-blur-lg border-t border-white/10 px-4 py-2 flex items-center justify-around shadow-2xl">
      {items.map((item) => {
        const Icon = item.icon
        const isActive = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))

        return (
          <Link
            key={item.href}
            href={item.href}
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
          </Link>
        )
      })}
    </nav>
  )
}
