"use client"

import React, { useState, useEffect } from "react"
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
} from "recharts"
import { usePrivacy } from "@/components/privacy-context"

interface BudgetPieChartProps {
  data?: {
    category: string
    spent: number
    monthly_limit: number
    percentage: number
  }[]
  onSelectCategory?: (category: string) => void
  selectedCategory?: string | null
}

const CATEGORY_COLORS: Record<string, string> = {
  "Alimentation": "#10b981", // Emerald
  "Transports": "#3b82f6", // Blue
  "Logement": "#f59e0b", // Amber
  "Abonnements": "#8b5cf6", // Purple
  "Loisirs & Sorties": "#ec4899", // Pink
  "Santé & Bien-être": "#06b6d4", // Cyan
  "Revenus": "#22c55e", // Green
  "Virements & Épargne": "#6366f1", // Indigo
  "Divers": "#71717a", // Zinc
}

const FALLBACK_COLORS = [
  "#818cf8",
  "#14b8a6",
  "#f97316",
  "#a855f7",
  "#e11d48",
  "#0ea5e9",
]

export function BudgetPieChart({
  data = [],
  onSelectCategory,
  selectedCategory,
}: BudgetPieChartProps) {
  const { formatAmount } = usePrivacy()
  const [isMounted, setIsMounted] = useState<boolean>(false)

  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Safe data filtering
  const safeData = Array.isArray(data) ? data : []
  const chartData = safeData
    .filter((d) => d && d.spent > 0)
    .map((d) => ({
      name: d.category,
      value: d.spent,
      limit: d.monthly_limit,
    }))

  const totalSpent = chartData.reduce((sum, d) => sum + d.value, 0)

  if (!isMounted) {
    return (
      <div className="h-64 w-full flex items-center justify-center text-xs text-zinc-500">
        Chargement de la répartition...
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-64 w-full flex flex-col items-center justify-center text-xs text-zinc-500 gap-1.5 p-6 text-center rounded-2xl bg-zinc-950/40 border border-white/5">
        <span className="font-medium text-zinc-400">Aucune dépense enregistrée</span>
        <span className="text-[11px] text-zinc-600">Vos opérations catégorisées apparaîtront ici</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-5 w-full min-w-0">
      {/* Donut Pie Chart with Centered Total */}
      <div className="relative w-full h-[220px] flex items-center justify-center">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0]
                  const percent = totalSpent > 0 ? ((Number(item.value) / totalSpent) * 100).toFixed(1) : "0"

                  return (
                    <div className="bg-[#18181B] border border-white/10 p-3 rounded-2xl shadow-2xl text-xs flex flex-col gap-1 min-w-[140px]">
                      <span className="font-bold text-white">{item.name}</span>
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>Montant</span>
                        <span className="font-mono font-bold text-white">{formatAmount(Number(item.value))}</span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400 text-[11px] pt-1 border-t border-white/5">
                        <span>Part</span>
                        <span className="font-mono">{percent}%</span>
                      </div>
                    </div>
                  )
                }
                return null
              }}
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={62}
              outerRadius={88}
              paddingAngle={3}
              stroke="none"
              onClick={(entry: any) => {
                if (onSelectCategory && entry && entry.name) {
                  onSelectCategory(selectedCategory === entry.name ? "" : entry.name)
                }
              }}
              className="cursor-pointer outline-none"
            >
              {chartData.map((entry, index) => {
                const color =
                  CATEGORY_COLORS[entry.name] ||
                  FALLBACK_COLORS[index % FALLBACK_COLORS.length]
                const isSelected = selectedCategory === entry.name

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    opacity={selectedCategory ? (isSelected ? 1 : 0.35) : 1}
                    className="transition-all duration-200 hover:opacity-85"
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Centered Total in Donut Hole */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
          <span className="text-[10px] uppercase font-semibold text-zinc-400 tracking-wider">
            Total Dépensé
          </span>
          <span className="text-base font-bold font-mono text-white mt-0.5">
            {formatAmount(totalSpent)}
          </span>
        </div>
      </div>

      {/* Clean Vertical Legend List */}
      <div className="flex flex-col gap-1.5 w-full pt-1 border-t border-white/5">
        {chartData.map((item, idx) => {
          const color =
            CATEGORY_COLORS[item.name] ||
            FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
          const percent = totalSpent > 0 ? ((item.value / totalSpent) * 100).toFixed(0) : "0"
          const isSelected = selectedCategory === item.name

          return (
            <button
              key={item.name}
              type="button"
              onClick={() => onSelectCategory && onSelectCategory(isSelected ? "" : item.name)}
              className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all border text-left cursor-pointer w-full ${
                isSelected
                  ? "bg-zinc-900 border-indigo-500/60 text-white shadow-md shadow-indigo-600/20"
                  : "bg-zinc-950/50 border-white/5 text-zinc-300 hover:bg-zinc-900 hover:text-white"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0 pr-2">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                />
                <span className="truncate font-medium text-xs">{item.name}</span>
                <span className="text-[10px] text-zinc-400 font-mono px-1.5 py-0.5 rounded-md bg-white/5">
                  {percent}%
                </span>
              </div>

              <span className="font-bold font-mono text-xs text-white shrink-0">
                {formatAmount(item.value)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
