"use client"

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import {
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Globe,
  Layers,
  X,
  Sparkles,
} from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { StockLogo } from "@/components/ui/stock-logo"
import { useI18n } from "@/components/i18n-context"
import { usePrivacy } from "@/components/privacy-context"
import { cn } from "@/lib/utils"
import {
  StockAPI,
  PRELOADED_INDICES,
  PRELOADED_STOCKS,
  generateFallbackHistory,
  searchLocalStocks,
} from "@/lib/api/stock-api"
import { StockQuote, StockHistoryPoint } from "@/lib/types/finance"

function formatLargeNumber(num: number | undefined | null, currency: string = "EUR"): string {
  if (num === undefined || num === null) return "-"
  const currSym = currency === "USD" ? "$" : "€"
  if (num >= 1e12) {
    return `${(num / 1e12).toFixed(2)} T${currSym}`
  }
  if (num >= 1e9) {
    return `${(num / 1e9).toFixed(2)} Mrd${currSym}`
  }
  if (num >= 1e6) {
    return `${(num / 1e6).toFixed(2)} M${currSym}`
  }
  return `${num.toLocaleString("fr-FR")} ${currSym}`
}

export function StocksView() {
  const { t, language } = useI18n()
  const { isPrivate } = usePrivacy()

  // State initialized with preloaded rich data for instant rendering
  const [indices, setIndices] = useState<StockQuote[]>(PRELOADED_INDICES)
  const [stocks, setStocks] = useState<StockQuote[]>(PRELOADED_STOCKS)
  const [selectedStock, setSelectedStock] = useState<StockQuote | null>(PRELOADED_STOCKS[0])
  const [history, setHistory] = useState<StockHistoryPoint[]>(
    generateFallbackHistory(PRELOADED_STOCKS[0].symbol, PRELOADED_STOCKS[0].price, "1M")
  )
  const [timeframe, setTimeframe] = useState<string>("1M")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [searchPreviewResults, setSearchPreviewResults] = useState<StockQuote[]>([])
  const [isSearchingLive, setIsSearchingLive] = useState<boolean>(false)
  const [isSearchFocused, setIsSearchFocused] = useState<boolean>(false)
  const [activePreviewIndex, setActivePreviewIndex] = useState<number>(-1)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false)

  const searchContainerRef = useRef<HTMLDivElement>(null)

  // Load live market data
  const loadMarketData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [indicesRes, stocksRes] = await Promise.all([
        StockAPI.getMarketIndices(),
        StockAPI.getStocks(),
      ])
      if (indicesRes.length > 0) setIndices(indicesRes)
      if (stocksRes.length > 0) {
        setStocks(stocksRes)
        if (!selectedStock) {
          const defaultAsset = stocksRes.find((s) => s.symbol === "MC.PA") || stocksRes[0]
          setSelectedStock(defaultAsset)
        }
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedStock])

  // Load history chart whenever selected stock or timeframe changes
  const loadChartData = useCallback(async (symbol: string, tf: string) => {
    setIsChartLoading(true)
    try {
      const data = await StockAPI.getStockHistory(symbol, tf)
      setHistory(data)
    } finally {
      setIsChartLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMarketData()
  }, [loadMarketData])

  useEffect(() => {
    if (selectedStock) {
      loadChartData(selectedStock.symbol, timeframe)
    }
  }, [selectedStock, timeframe, loadChartData])

  // Select a stock from preview or table
  const handleSelectStock = useCallback((stock: StockQuote) => {
    setSelectedStock(stock)
    setIsSearchFocused(false)
    setActivePreviewIndex(-1)
    // Add to stocks list if not present
    setStocks((prev) => {
      if (prev.some((s) => s.symbol.toUpperCase() === stock.symbol.toUpperCase())) {
        return prev
      }
      return [stock, ...prev]
    })
  }, [])

  // Live and local debounced search for preview
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setSearchPreviewResults([])
      setIsSearchingLive(false)
      setActivePreviewIndex(-1)
      return
    }

    // Immediate instant local match
    const instantMatches = searchLocalStocks(q)
    setSearchPreviewResults(instantMatches)
    setActivePreviewIndex(-1)

    // Debounced live search
    const timer = setTimeout(async () => {
      setIsSearchingLive(true)
      try {
        const liveResults = await StockAPI.searchLive(q)
        if (liveResults.length > 0) {
          setSearchPreviewResults(liveResults)
        }
      } finally {
        setIsSearchingLive(false)
      }
    }, 200)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // Click outside listener to close search preview dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        searchContainerRef.current &&
        !searchContainerRef.current.contains(event.target as Node)
      ) {
        setIsSearchFocused(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Keyboard navigation for search preview
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isSearchFocused || searchPreviewResults.length === 0) return

    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActivePreviewIndex((prev) =>
        prev < searchPreviewResults.length - 1 ? prev + 1 : 0
      )
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActivePreviewIndex((prev) => (prev > 0 ? prev - 1 : searchPreviewResults.length - 1))
    } else if (e.key === "Enter") {
      e.preventDefault()
      if (activePreviewIndex >= 0 && activePreviewIndex < searchPreviewResults.length) {
        handleSelectStock(searchPreviewResults[activePreviewIndex])
      } else if (searchPreviewResults.length > 0) {
        handleSelectStock(searchPreviewResults[0])
      }
    } else if (e.key === "Escape") {
      setIsSearchFocused(false)
    }
  }

  // Filtered stocks for the table
  const filteredStocks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return stocks.filter((s) => s.asset_type !== "index")
    const localMatched = searchLocalStocks(q)
    const localSymbols = new Set(localMatched.map((m) => m.symbol.toUpperCase()))
    const result = stocks.filter(
      (s) =>
        s.asset_type !== "index" &&
        (localSymbols.has(s.symbol.toUpperCase()) ||
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q) ||
          (s.sector && s.sector.toLowerCase().includes(q)))
    )
    return result.length > 0 ? result : localMatched.filter((s) => s.asset_type !== "index")
  }, [stocks, searchQuery])

  // Top Gainers and Losers
  const { topGainers, topLosers } = useMemo(() => {
    const nonIndices = stocks.filter((s) => s.asset_type !== "index")
    const sorted = [...nonIndices].sort((a, b) => b.change_percent - a.change_percent)
    return {
      topGainers: sorted.slice(0, 3),
      topLosers: [...sorted].reverse().slice(0, 3),
    }
  }, [stocks])

  const isPositive = (selectedStock?.change_percent ?? 0) >= 0

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Activity className="w-6 h-6 text-indigo-400" />
            {t.stocks.title}
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mt-1">
            {t.stocks.subtitle}
          </p>
        </div>

        {/* Prominent Global Top Search Bar */}
        <div ref={searchContainerRef} className="relative w-full md:w-96 z-[100]">
          <div className="relative flex items-center">
            <Search className="w-4 h-4 absolute left-3.5 text-zinc-400 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setIsSearchFocused(true)
              }}
              onFocus={() => setIsSearchFocused(true)}
              onKeyDown={handleKeyDown}
              placeholder={t.stocks.searchPlaceholder}
              className="bg-[#18181B] border-white/15 text-white pl-9 pr-9 h-10 rounded-xl text-xs placeholder:text-zinc-500 focus-visible:ring-indigo-500 focus-visible:border-indigo-500 shadow-md"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("")
                  setSearchPreviewResults([])
                  setIsSearchFocused(false)
                }}
                className="absolute right-2.5 p-1 rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Live Search Preview Dropdown Overlay Floating Above Everything */}
          {isSearchFocused && searchQuery.trim().length > 0 && (
            <div className="absolute left-0 right-0 top-full mt-2 z-[100] bg-[#18181B] border border-white/20 rounded-2xl shadow-2xl backdrop-blur-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 ring-1 ring-white/10">
              <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-white/10 bg-white/[0.03] text-[11px] text-zinc-400">
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{t.stocks.searchPreview}</span>
                </div>
                <div className="flex items-center gap-1.5 font-mono text-[10px]">
                  {isSearchingLive ? (
                    <span className="flex items-center gap-1 text-indigo-400 font-semibold">
                      <RefreshCw className="w-3 h-3 animate-spin" />
                      {t.stocks.searching}
                    </span>
                  ) : (
                    <span className="text-zinc-500">{searchPreviewResults.length} résultats</span>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto divide-y divide-white/5 p-1.5">
                {searchPreviewResults.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-400">
                    {isSearchingLive ? (
                      <div className="flex items-center justify-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" />
                        <span>{t.stocks.searching}</span>
                      </div>
                    ) : (
                      <span>{t.stocks.noLiveResults}</span>
                    )}
                  </div>
                ) : (
                  searchPreviewResults.map((item, idx) => {
                    const isUp = item.change_percent >= 0
                    const isActive = activePreviewIndex === idx
                    return (
                      <div
                        key={item.symbol}
                        onClick={() => handleSelectStock(item)}
                        onMouseEnter={() => setActivePreviewIndex(idx)}
                        className={cn(
                          "flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all group select-none",
                          isActive
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "hover:bg-white/[0.08] text-zinc-300"
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <StockLogo symbol={item.symbol} name={item.name} size="sm" />
                          <div className="truncate">
                            <div className="flex items-center gap-1.5">
                              <span className={cn(
                                "text-xs font-semibold truncate transition-colors",
                                isActive ? "text-white" : "text-zinc-200 group-hover:text-white"
                              )}>
                                {item.name}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 font-mono shrink-0",
                                  isActive
                                    ? "bg-white/20 border-white/30 text-white"
                                    : "border-white/10 bg-white/5 text-zinc-300"
                                )}
                              >
                                {item.symbol}
                              </Badge>
                            </div>
                            {item.sector && (
                              <span className={cn(
                                "text-[10px] block truncate mt-0.5",
                                isActive ? "text-indigo-100" : "text-zinc-500"
                              )}>
                                {item.sector}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0 font-mono pl-3">
                          <div className="text-xs font-bold text-white">
                            {isPrivate ? "•••" : item.price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {item.currency === "USD" ? "$" : "€"}
                          </div>
                          <div
                            className={cn(
                              "text-[10px] font-semibold",
                              isActive
                                ? "text-white"
                                : isUp
                                ? "text-emerald-400"
                                : "text-rose-400"
                            )}
                          >
                            {isUp ? "+" : ""}
                            {item.change_percent.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMarketData}
            disabled={isLoading}
            className="border-white/10 bg-[#18181B] hover:bg-white/5 text-zinc-300 rounded-xl text-xs h-10 px-3"
          >
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
            {t.common.refresh}
          </Button>
        </div>
      </div>

      {/* World Market Indices Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {indices.map((idx) => {
          const isUp = idx.change_percent >= 0
          const isSelected = selectedStock?.symbol === idx.symbol
          return (
            <div
              key={idx.symbol}
              onClick={() => setSelectedStock(idx)}
              className={cn(
                "p-3 rounded-2xl border transition-all cursor-pointer select-none flex flex-col justify-between",
                isSelected
                  ? "bg-[#18181B] border-indigo-500/50 shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-500/30"
                  : "bg-[#18181B]/70 border-white/5 hover:border-white/15 hover:bg-[#18181B]"
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <StockLogo symbol={idx.symbol} name={idx.name} size="sm" />
                  <span className="text-xs font-semibold text-zinc-300 truncate">{idx.name}</span>
                </div>
                <span
                  className={cn(
                    "text-[11px] font-medium font-mono shrink-0",
                    isUp ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {isUp ? "+" : ""}
                  {idx.change_percent.toFixed(2)}%
                </span>
              </div>
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-base font-bold text-white font-mono">
                  {isPrivate ? "•••" : idx.price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })}
                </span>
                <span className="text-[10px] text-zinc-500 font-mono uppercase">{idx.currency}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Main Stock Interactive Section */}
      {selectedStock && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Chart Card (2 cols) */}
          <Card className="lg:col-span-2 bg-[#18181B] border-white/10 rounded-2xl p-5 space-y-5">
            {/* Header & Price Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/5">
              <div className="flex items-center gap-3.5">
                <StockLogo symbol={selectedStock.symbol} name={selectedStock.name} size="lg" />
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-xl sm:text-2xl font-bold text-white">{selectedStock.name}</h2>
                    <Badge variant="outline" className="border-white/10 bg-white/5 text-zinc-300 font-mono text-xs">
                      {selectedStock.symbol}
                    </Badge>
                    {selectedStock.sector && (
                      <span className="text-xs text-zinc-500 hidden sm:inline">{selectedStock.sector}</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-3 mt-1.5">
                    <span className="text-2xl sm:text-3xl font-bold text-white font-mono">
                      {isPrivate
                        ? "••••••"
                        : `${(history.length > 0 ? history[history.length - 1].price : selectedStock.price).toLocaleString("fr-FR", { minimumFractionDigits: 2 })} ${selectedStock.currency === "USD" ? "$" : "€"}`}
                    </span>
                    {(() => {
                      const startP = history[0]?.price ?? selectedStock.price
                      const currentP = history[history.length - 1]?.price ?? selectedStock.price
                      const is1D = timeframe === "1D"
                      const changeVal = is1D ? selectedStock.change : currentP - startP
                      const changePct = is1D
                        ? selectedStock.change_percent
                        : startP > 0
                        ? ((currentP - startP) / startP) * 100
                        : 0
                      const isUp = is1D ? selectedStock.change_percent >= 0 : changeVal >= 0

                      return (
                        <span
                          className={cn(
                            "flex items-center text-sm font-semibold font-mono",
                            isUp ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {isUp ? (
                            <ArrowUpRight className="w-4 h-4 mr-0.5" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 mr-0.5" />
                          )}
                          {isUp ? "+" : ""}
                          {changeVal.toFixed(2)} ({isUp ? "+" : ""}
                          {changePct.toFixed(2)}%)
                          <span className="text-[11px] text-zinc-500 font-sans ml-1">({timeframe})</span>
                        </span>
                      )
                    })()}
                  </div>
                </div>
              </div>

              {/* Timeframe selector */}
              <div className="flex items-center bg-[#09090B] border border-white/10 rounded-xl p-1 self-start sm:self-auto">
                {["1D", "1W", "1M", "1Y", "5Y", "ALL"].map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => setTimeframe(tf)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer",
                      timeframe === tf
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    {tf}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Chart */}
            <div className="h-[280px] sm:h-[320px] w-full pt-2">
              {isChartLoading ? (
                <div className="h-full flex items-center justify-center">
                  <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
                </div>
              ) : history.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-500 text-xs">
                  {t.stocks.noResults}
                </div>
              ) : (
                (() => {
                  const prices = history.map((h) => h.price).filter((p) => typeof p === "number" && !isNaN(p))
                  const minP = prices.length > 0 ? Math.min(...prices) : 0
                  const maxP = prices.length > 0 ? Math.max(...prices) : 100
                  const span = maxP - minP
                  const pad = span > 0 ? span * 0.05 : maxP * 0.02
                  const yMin = Math.max(0, Math.floor((minP - pad) * 100) / 100)
                  const yMax = Math.ceil((maxP + pad) * 100) / 100

                  const is1D = timeframe === "1D"
                  const startP = history[0]?.price ?? selectedStock.price
                  const endP = history[history.length - 1]?.price ?? selectedStock.price
                  const chartIsPositive = is1D ? selectedStock.change_percent >= 0 : endP >= startP

                  return (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={history} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                        <defs>
                          <linearGradient id="stockGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={chartIsPositive ? "#10b981" : "#f43f5e"}
                              stopOpacity={0.35}
                            />
                            <stop
                              offset="95%"
                              stopColor={chartIsPositive ? "#10b981" : "#f43f5e"}
                              stopOpacity={0.0}
                            />
                          </linearGradient>
                        </defs>
                        <XAxis
                          dataKey="label"
                          axisLine={false}
                          tickLine={false}
                          minTickGap={45}
                          tick={{ fill: "#71717a", fontSize: 11 }}
                        />
                        <YAxis
                          domain={[yMin, yMax]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "#71717a", fontSize: 11 }}
                          tickFormatter={(v) => (v >= 1000 ? `${v.toFixed(0)}` : `${v.toFixed(2)}`)}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload.length) return null
                            const data = payload[0].payload as StockHistoryPoint
                            const diffFromStart = data.price - startP
                            const pctFromStart = startP > 0 ? (diffFromStart / startP) * 100 : 0
                            const candleUp = diffFromStart >= 0

                            return (
                              <div className="bg-[#18181B]/95 border border-white/10 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono space-y-1.5">
                                <div className="text-zinc-400 flex items-center justify-between gap-4">
                                  <span>{data.label}</span>
                                  {data.volume ? (
                                    <span className="text-[10px] text-zinc-500 font-sans">
                                      Vol: {data.volume >= 1e6 ? `${(data.volume / 1e6).toFixed(1)}M` : `${(data.volume / 1e3).toFixed(0)}k`}
                                    </span>
                                  ) : null}
                                </div>
                                <div className="flex items-baseline justify-between gap-4">
                                  <span className="text-white font-bold text-sm">
                                    {data.price.toFixed(2)} {selectedStock.currency === "USD" ? "$" : "€"}
                                  </span>
                                  <span
                                    className={cn(
                                      "text-[11px] font-semibold",
                                      candleUp ? "text-emerald-400" : "text-rose-400"
                                    )}
                                  >
                                    {candleUp ? "+" : ""}
                                    {pctFromStart.toFixed(2)}%
                                  </span>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="price"
                          stroke={chartIsPositive ? "#10b981" : "#f43f5e"}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#stockGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  )
                })()
              )}
            </div>
          </Card>

          {/* Key Statistics Grid Card */}
          <Card className="bg-[#18181B] border-white/10 rounded-2xl p-5 flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-semibold text-white mb-4">
                {t.stocks.marketCap} & Métriques Clés
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#09090B] p-3 rounded-xl border border-white/5">
                  <span className="text-[11px] text-zinc-400 block">{t.stocks.marketCap}</span>
                  <span className="text-sm font-bold text-white font-mono mt-1 block">
                    {formatLargeNumber(selectedStock.market_cap, selectedStock.currency)}
                  </span>
                </div>

                <div className="bg-[#09090B] p-3 rounded-xl border border-white/5">
                  <span className="text-[11px] text-zinc-400 block">{t.stocks.peRatio}</span>
                  <span className="text-sm font-bold text-white font-mono mt-1 block">
                    {selectedStock.pe_ratio ? `${selectedStock.pe_ratio.toFixed(1)}x` : "-"}
                  </span>
                </div>

                <div className="bg-[#09090B] p-3 rounded-xl border border-white/5">
                  <span className="text-[11px] text-zinc-400 block">{t.stocks.dividendYield}</span>
                  <span className="text-sm font-bold text-white font-mono mt-1 block">
                    {selectedStock.dividend_yield !== undefined
                      ? `${selectedStock.dividend_yield.toFixed(2)}%`
                      : "-"}
                  </span>
                </div>

                <div className="bg-[#09090B] p-3 rounded-xl border border-white/5">
                  <span className="text-[11px] text-zinc-400 block">{t.stocks.volume}</span>
                  <span className="text-sm font-bold text-white font-mono mt-1 block">
                    {selectedStock.volume ? selectedStock.volume.toLocaleString("fr-FR") : "-"}
                  </span>
                </div>

                <div className="bg-[#09090B] p-3 rounded-xl border border-white/5">
                  <span className="text-[11px] text-zinc-400 block">{t.stocks.dayRange}</span>
                  <span className="text-xs font-semibold text-white font-mono mt-1 block">
                    {selectedStock.day_low?.toFixed(2)} - {selectedStock.day_high?.toFixed(2)}
                  </span>
                </div>

                <div className="bg-[#09090B] p-3 rounded-xl border border-white/5">
                  <span className="text-[11px] text-zinc-400 block">{t.stocks.range52w}</span>
                  <span className="text-xs font-semibold text-white font-mono mt-1 block">
                    {selectedStock.low_52w?.toFixed(2)} - {selectedStock.high_52w?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Sector / Asset Type badge */}
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs text-zinc-400">
              <span>{t.stocks.sector}</span>
              <span className="text-white font-medium">{selectedStock.sector || "Général"}</span>
            </div>
          </Card>
        </div>
      )}

      {/* Stocks & ETFs Catalog Table */}
      <Card className="bg-[#18181B] border-white/10 rounded-2xl p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-400" />
            <h3 className="text-base font-bold text-white">{t.stocks.popularStocks}</h3>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">
              {filteredStocks.length} {filteredStocks.length > 1 ? "actifs" : "actif"}
            </span>
          </div>
        </div>

        {/* Table list */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/5 text-zinc-400 font-semibold">
                <th className="pb-3 pl-2">Actif</th>
                <th className="pb-3 hidden md:table-cell">Secteur</th>
                <th className="pb-3 text-right">Cours</th>
                <th className="pb-3 text-right">Var. 24h</th>
                <th className="pb-3 text-right hidden sm:table-cell">Cap. Boursière</th>
                <th className="pb-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {filteredStocks.map((stock) => {
                const isUp = stock.change_percent >= 0
                const isSelected = selectedStock?.symbol === stock.symbol
                return (
                  <tr
                    key={stock.symbol}
                    onClick={() => setSelectedStock(stock)}
                    className={cn(
                      "transition-colors cursor-pointer group",
                      isSelected ? "bg-white/[0.04]" : "hover:bg-white/[0.02]"
                    )}
                  >
                    <td className="py-3 pl-2">
                      <div className="flex items-center gap-2.5">
                        <StockLogo symbol={stock.symbol} name={stock.name} size="md" />
                        <div>
                          <div className="font-sans font-semibold text-white group-hover:text-indigo-400 transition-colors">
                            {stock.name}
                          </div>
                          <div className="text-[11px] text-zinc-500">{stock.symbol}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 hidden md:table-cell font-sans text-zinc-400">
                      {stock.sector || "-"}
                    </td>
                    <td className="py-3 text-right font-bold text-white">
                      {isPrivate ? "•••" : stock.price.toLocaleString("fr-FR", { minimumFractionDigits: 2 })} {stock.currency === "USD" ? "$" : "€"}
                    </td>
                    <td className="py-3 text-right">
                      <span
                        className={cn(
                          "inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold",
                          isUp
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-rose-500/10 text-rose-400"
                        )}
                      >
                        {isUp ? "+" : ""}
                        {stock.change_percent.toFixed(2)}%
                      </span>
                    </td>
                    <td className="py-3 text-right hidden sm:table-cell text-zinc-300 font-sans">
                      {formatLargeNumber(stock.market_cap, stock.currency)}
                    </td>
                    <td className="py-3 text-right pr-2 font-sans">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedStock(stock)
                        }}
                        className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg text-xs h-7 px-2.5"
                      >
                        Voir
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Market Movers: Gainers & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top Gainers */}
        <Card className="bg-[#18181B] border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t.stocks.topGainers}</h4>
          </div>
          <div className="space-y-2">
            {topGainers.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => setSelectedStock(stock)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <StockLogo symbol={stock.symbol} name={stock.name} size="sm" />
                  <div className="truncate">
                    <span className="text-xs font-semibold text-white block truncate">{stock.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{stock.symbol}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-white font-mono block">
                    {stock.price.toFixed(2)} {stock.currency === "USD" ? "$" : "€"}
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-400 font-mono">
                    +{stock.change_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Top Losers */}
        <Card className="bg-[#18181B] border-white/10 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-rose-400" />
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">{t.stocks.topLosers}</h4>
          </div>
          <div className="space-y-2">
            {topLosers.map((stock) => (
              <div
                key={stock.symbol}
                onClick={() => setSelectedStock(stock)}
                className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <StockLogo symbol={stock.symbol} name={stock.name} size="sm" />
                  <div className="truncate">
                    <span className="text-xs font-semibold text-white block truncate">{stock.name}</span>
                    <span className="text-[10px] text-zinc-500 font-mono">{stock.symbol}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-xs font-bold text-white font-mono block">
                    {stock.price.toFixed(2)} {stock.currency === "USD" ? "$" : "€"}
                  </span>
                  <span className="text-[11px] font-semibold text-rose-400 font-mono">
                    {stock.change_percent.toFixed(2)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  )
}
