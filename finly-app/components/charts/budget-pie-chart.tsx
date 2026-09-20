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
import { useI18n } from "@/components/i18n-context"
import { cn } from "@/lib/utils"

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
  const { t, language } = useI18n()
  const [isMounted, setIsMounted] = useState<boolean>(false)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)

  useEffect(() => {
    setIsMounted(true)
  }, [])

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
      <div className="h-72 w-full flex items-center justify-center text-xs text-zinc-500">
        {t.dashboard.loadingMap}
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="h-72 w-full flex flex-col items-center justify-center text-xs text-zinc-500 gap-1.5 p-6 text-center rounded-2xl bg-zinc-950/40 border border-white/5">
        <span className="font-medium text-zinc-400">{t.dashboard.noExpensesRecorded}</span>
        <span className="text-[11px] text-zinc-600">
          {language === "fr"
            ? "Vos opérations catégorisées apparaîtront ici"
            : "Your categorized transactions will appear here"}
        </span>
      </div>
    )
  }

  const activeItem = hoveredIndex !== null ? chartData[hoveredIndex] : null
  const activeColor = activeItem
    ? CATEGORY_COLORS[activeItem.name] || FALLBACK_COLORS[hoveredIndex! % FALLBACK_COLORS.length]
    : "#6366f1"

  const activePercent = activeItem && totalSpent > 0
    ? ((activeItem.value / totalSpent) * 100).toFixed(1)
    : "0"

  return (
    <div className="flex flex-col items-center justify-center w-full min-w-0 py-2">
      {/* Donut Pie Chart Container with Center Info */}
      <div className="relative w-full max-w-[340px] sm:max-w-[360px] h-[300px] sm:h-[330px] flex items-center justify-center">
        {/* Ambient Glow behind the pie */}
        <div
          className="absolute w-44 h-44 rounded-full blur-3xl opacity-25 pointer-events-none transition-colors duration-500"
          style={{ backgroundColor: activeColor }}
        />

        <ResponsiveContainer
          width="100%"
          height="100%"
          minWidth={0}
          minHeight={0}
          initialDimension={{ width: 340, height: 330 }}
        >
          <PieChart>
            <Tooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const item = payload[0]
                  const percent =
                    totalSpent > 0 ? ((Number(item.value) / totalSpent) * 100).toFixed(1) : "0"
                  const displayName = t.categories[item.name as string] || item.name

                  return (
                    <div className="bg-[#18181B] border border-white/10 p-3 rounded-2xl shadow-2xl text-xs flex flex-col gap-1 min-w-[140px]">
                      <span className="font-bold text-white">{displayName}</span>
                      <div className="flex justify-between items-center text-zinc-300">
                        <span>{language === "fr" ? "Montant" : "Amount"}</span>
                        <span className="font-mono font-bold text-white">
                          {formatAmount(Number(item.value))}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-zinc-400 text-[11px] pt-1 border-t border-white/5">
                        <span>{language === "fr" ? "Part" : "Share"}</span>
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
              innerRadius={94}
              outerRadius={132}
              paddingAngle={3}
              strokeWidth={3}
              stroke="#18181B"
              onMouseEnter={(_, index) => setHoveredIndex(index)}
              onMouseLeave={() => setHoveredIndex(null)}
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
                const isHovered = hoveredIndex === index
                const isDimmed =
                  (selectedCategory && !isSelected) ||
                  (hoveredIndex !== null && !isHovered)

                return (
                  <Cell
                    key={`cell-${index}`}
                    fill={color}
                    opacity={isDimmed ? 0.3 : 1}
                    className="transition-all duration-200 cursor-pointer outline-none"
                  />
                )
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        {/* Dynamic Center Hole Display */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-4">
          {activeItem ? (
            <>
              <span className="text-xs font-semibold text-zinc-300 truncate max-w-[155px] block transition-all">
                {t.categories[activeItem.name] || activeItem.name}
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-0.5 tracking-tight">
                {formatAmount(activeItem.value)}
              </span>
              <span
                className="text-xs font-semibold mt-1 font-mono px-2 py-0.5 rounded-full bg-white/5"
                style={{ color: activeColor }}
              >
                {activePercent}%
              </span>
            </>
          ) : (
            <>
              <span className="text-[11px] uppercase font-semibold text-zinc-400 tracking-wider">
                {language === "fr" ? "Total dépensé" : "Total spent"}
              </span>
              <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-0.5 tracking-tight">
                {formatAmount(totalSpent)}
              </span>
              <span className="text-[11px] text-zinc-500 font-medium mt-1">
                {chartData.length} {language === "fr" ? "catégories" : "categories"}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
