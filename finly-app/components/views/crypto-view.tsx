"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { RefreshCw, Search, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-context"
import { usePrivacy } from "@/components/privacy-context"
import { cn } from "@/lib/utils"
import {
  BinanceAPI,
  CryptoAsset,
  CryptoKline,
  CryptoTimeframe,
} from "@/lib/api/binance-api"

function CryptoCoinLogo({
  symbol,
  size = "md",
}: {
  symbol: string
  size?: "sm" | "md" | "lg"
}) {
  const [hasError, setHasError] = useState(false)
  const lower = symbol.toLowerCase()

  const dim = size === "sm" ? "w-6 h-6" : size === "lg" ? "w-10 h-10" : "w-7 h-7"
  const textSize = size === "sm" ? "text-[10px]" : size === "lg" ? "text-xs" : "text-[11px]"

  if (hasError) {
    return (
      <div
        className={cn(
          dim,
          "rounded-full bg-zinc-800 border border-white/10 flex items-center justify-center font-mono font-bold text-zinc-300 shrink-0 select-none",
          textSize
        )}
      >
        {symbol.slice(0, 3)}
      </div>
    )
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://assets.coincap.io/assets/icons/${lower}@2x.png`}
      alt={symbol}
      onError={() => setHasError(true)}
      className={cn(dim, "rounded-full object-contain shrink-0 select-none")}
      loading="lazy"
    />
  )
}

export function CryptoView() {
  const { t, language } = useI18n()
  const { isPrivate } = usePrivacy()

  const [cryptos, setCryptos] = useState<CryptoAsset[]>([])
  const [selectedCrypto, setSelectedCrypto] = useState<CryptoAsset | null>(null)
  const [klines, setKlines] = useState<CryptoKline[]>([])
  const [timeframe, setTimeframe] = useState<CryptoTimeframe>("24H")
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false)

  // Load top cryptos list
  const loadMarketData = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await BinanceAPI.getTopCryptos()
      setCryptos(data)
      if (data.length > 0 && !selectedCrypto) {
        setSelectedCrypto(data[0])
      } else if (selectedCrypto) {
        // Refresh selected crypto data
        const updated = data.find((c) => c.symbol === selectedCrypto.symbol)
        if (updated) setSelectedCrypto(updated)
      }
    } finally {
      setIsLoading(false)
    }
  }, [selectedCrypto])

  // Load klines when selected crypto or timeframe changes
  const loadKlinesData = useCallback(async (symbol: string, tf: CryptoTimeframe) => {
    setIsChartLoading(true)
    try {
      const data = await BinanceAPI.getKlines(symbol, tf)
      setKlines(data)
    } finally {
      setIsChartLoading(false)
    }
  }, [])

  useEffect(() => {
    loadMarketData()
  }, [])

  useEffect(() => {
    if (selectedCrypto) {
      loadKlinesData(selectedCrypto.symbol, timeframe)
    }
  }, [selectedCrypto?.symbol, timeframe, loadKlinesData])

  // Filtered cryptos list based on search
  const filteredCryptos = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return cryptos
    return cryptos.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.baseAsset.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    )
  }, [cryptos, searchQuery])

  // Format currency
  const formatCryptoPrice = (price: number) => {
    if (isPrivate) return "••••••"
    if (price >= 1000) {
      return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
      }).format(price)
    }
    if (price >= 1) {
      return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 4,
      }).format(price)
    }
    return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 6,
    }).format(price)
  }

  const formatVolume = (vol: number) => {
    if (isPrivate) return "••••"
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(2)}B`
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(2)}M`
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(2)}K`
    return `$${vol.toFixed(2)}`
  }

  const isPositiveChange = (selectedCrypto?.priceChangePercent ?? 0) >= 0
  const chartStrokeColor = isPositiveChange ? "#10B981" : "#F43F5E"
  const chartFillGradientId = isPositiveChange ? "cryptoGreen" : "cryptoRed"

  // Min / Max for chart Y axis
  const [minPrice, maxPrice] = useMemo(() => {
    if (klines.length === 0) return [0, 100]
    const prices = klines.map((k) => k.close)
    const min = Math.min(...prices)
    const max = Math.max(...prices)
    const padding = (max - min) * 0.08 || min * 0.02
    return [Math.max(0, min - padding), max + padding]
  }, [klines])

  const timeframes: CryptoTimeframe[] = ["24H", "7J", "1M", "1A"]

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto pb-24 md:pb-8">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-semibold text-white">{t.cryptoMarket.title}</span>
          <span>•</span>
          <span className="font-mono">{cryptos.length} {language === "fr" ? "actifs suivis" : "tracked assets"}</span>
          <span>•</span>
          <span className="text-[11px] text-zinc-500">{t.cryptoMarket.poweredBy}</span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            onClick={loadMarketData}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl cursor-pointer text-xs font-semibold"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            <span>{isLoading ? t.common.syncing : t.common.refresh}</span>
          </Button>
        </div>
      </div>

      {/* 2 Primary Balanced Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left Card: Selected Crypto Interactive Chart & Key Stats (Col 7) */}
        <Card className="lg:col-span-7 p-5 sm:p-6 rounded-2xl border-white/10 bg-[#18181B] flex flex-col justify-between gap-6">
          {selectedCrypto ? (
            <>
              {/* Header: Price, Symbol, Name & Timeframe Selector */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3.5">
                  <CryptoCoinLogo symbol={selectedCrypto.baseAsset} size="lg" />
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                        {selectedCrypto.name}
                      </span>
                      <span className="text-xs font-mono font-bold text-zinc-500 bg-white/5 px-2 py-0.5 rounded">
                        {selectedCrypto.baseAsset}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-3 mt-1 flex-wrap">
                      <span className="text-3xl sm:text-4xl font-extrabold font-mono tracking-tight text-white">
                        {formatCryptoPrice(selectedCrypto.lastPrice)}
                      </span>
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-mono text-sm font-bold",
                          isPositiveChange ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {isPositiveChange ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                        {isPositiveChange ? "+" : ""}
                        {selectedCrypto.priceChangePercent.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Frameless Timeframe Tabs */}
                <div className="flex items-center bg-zinc-900/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
                  {timeframes.map((tf) => (
                    <button
                      key={tf}
                      type="button"
                      onClick={() => setTimeframe(tf)}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer select-none",
                        timeframe === tf
                          ? "bg-white text-zinc-950 font-bold shadow-sm"
                          : "text-zinc-400 hover:text-white"
                      )}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </div>

              {/* Chart Container */}
              <div className="w-full h-64 sm:h-72 my-1">
                {isChartLoading ? (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                    <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                    <span>{language === "fr" ? "Chargement des cotations..." : "Loading chart data..."}</span>
                  </div>
                ) : klines.length === 0 ? (
                  <div className="w-full h-full flex items-center justify-center text-zinc-500 text-xs">
                    <span>{t.cryptoMarket.noData}</span>
                  </div>
                ) : (
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                    initialDimension={{ width: 600, height: 260 }}
                  >
                    <AreaChart
                      data={klines}
                      margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="cryptoGreen" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#10B981" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#10B981" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="cryptoRed" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F43F5E" stopOpacity={0.35} />
                          <stop offset="100%" stopColor="#F43F5E" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="dateStr"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#71717A", fontSize: 11 }}
                        dy={8}
                      />
                      <YAxis
                        domain={[minPrice, maxPrice]}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "#71717A", fontSize: 11 }}
                        tickFormatter={(v) =>
                          v >= 1000
                            ? `$${(v / 1000).toFixed(0)}k`
                            : `$${v.toFixed(1)}`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#18181B",
                          borderColor: "rgba(255, 255, 255, 0.1)",
                          borderRadius: "0.75rem",
                          color: "#FFFFFF",
                          fontSize: "12px",
                          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5)",
                        }}
                        formatter={(value: any) => [formatCryptoPrice(Number(value)), t.cryptoMarket.price]}
                        labelFormatter={(label) => `${label}`}
                      />
                      <Area
                        type="monotone"
                        dataKey="close"
                        stroke={chartStrokeColor}
                        strokeWidth={2.5}
                        fill={`url(#${chartFillGradientId})`}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Key Statistics Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 border-t border-white/5 font-mono text-xs">
                <div className="flex flex-col p-2 rounded-xl bg-zinc-900/60 border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase">{t.cryptoMarket.high24h}</span>
                  <span className="font-bold text-white mt-0.5">
                    {formatCryptoPrice(selectedCrypto.highPrice)}
                  </span>
                </div>
                <div className="flex flex-col p-2 rounded-xl bg-zinc-900/60 border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase">{t.cryptoMarket.low24h}</span>
                  <span className="font-bold text-white mt-0.5">
                    {formatCryptoPrice(selectedCrypto.lowPrice)}
                  </span>
                </div>
                <div className="flex flex-col p-2 rounded-xl bg-zinc-900/60 border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase">{t.cryptoMarket.volume24h}</span>
                  <span className="font-bold text-white mt-0.5">
                    {formatVolume(selectedCrypto.quoteVolume)}
                  </span>
                </div>
                <div className="flex flex-col p-2 rounded-xl bg-zinc-900/60 border border-white/5">
                  <span className="text-[10px] text-zinc-500 uppercase">{t.cryptoMarket.rank}</span>
                  <span className="font-bold text-indigo-300 mt-0.5">
                    #{selectedCrypto.rank}
                  </span>
                </div>
              </div>
            </>
          ) : (
            <div className="py-20 text-center text-zinc-500 text-xs">
              {t.cryptoMarket.noData}
            </div>
          )}
        </Card>

        {/* Right Card: Top Cryptos Ranking List (Col 5) */}
        <Card className="lg:col-span-5 p-5 sm:p-6 rounded-2xl border-white/10 bg-[#18181B] flex flex-col justify-between gap-4">
          <div>
            {/* Header & Integrated Search Bar */}
            <div className="flex items-center justify-between pb-3 border-b border-white/5 gap-2">
              <span className="text-sm font-semibold text-white tracking-tight shrink-0">
                {t.cryptoMarket.topCryptos}
              </span>
              <div className="relative flex-1 max-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
                <Input
                  type="text"
                  placeholder={t.cryptoMarket.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 bg-zinc-900 border-white/10 text-white text-xs h-8 rounded-xl focus:border-white/20"
                />
              </div>
            </div>

            {/* Cryptos Table / List */}
            <div className="divide-y divide-white/5 max-h-[500px] overflow-y-auto mt-1 scrollbar-none">
              {filteredCryptos.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">
                  {language === "fr" ? "Aucune cryptomonnaie trouvée." : "No cryptocurrencies found."}
                </div>
              ) : (
                filteredCryptos.map((crypto) => {
                  const isSelected = selectedCrypto?.symbol === crypto.symbol
                  const isPos = crypto.priceChangePercent >= 0

                  return (
                    <button
                      key={crypto.symbol}
                      type="button"
                      onClick={() => setSelectedCrypto(crypto)}
                      className={cn(
                        "w-full text-left py-3 px-2 rounded-xl flex items-center justify-between gap-3 transition-colors cursor-pointer",
                        isSelected ? "bg-white/10" : "hover:bg-white/5"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CryptoCoinLogo symbol={crypto.baseAsset} size="md" />
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-white truncate">
                            {crypto.name}
                          </span>
                          <span className="text-[11px] font-mono text-zinc-400">
                            {crypto.baseAsset}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-sm font-bold font-mono text-white">
                          {formatCryptoPrice(crypto.lastPrice)}
                        </span>
                        <span
                          className={cn(
                            "text-xs font-mono font-semibold",
                            isPos ? "text-emerald-400" : "text-rose-400"
                          )}
                        >
                          {isPos ? "+" : ""}
                          {crypto.priceChangePercent.toFixed(2)}%
                        </span>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </div>

          {/* Footer note */}
          <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500 font-mono">
            <span>{t.cryptoMarket.liveRates}</span>
            <span>USDT Pair</span>
          </div>
        </Card>
      </div>
    </div>
  )
}
