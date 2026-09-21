"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
} from "recharts"
import {
  RefreshCw,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  ArrowLeftRight,
  HelpCircle,
  TrendingUp,
} from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip"
import { useI18n } from "@/components/i18n-context"
import { usePrivacy } from "@/components/privacy-context"
import { cn } from "@/lib/utils"
import {
  ForexAPI,
  ForexRatesResponse,
  ForexTimeSeriesPoint,
  ForexTimeframe,
  POPULAR_CURRENCIES,
  CURRENCY_SYMBOLS,
  CURRENCY_FLAGS,
} from "@/lib/api/forex-api"

function InfoTip({ text }: { text: string }) {
  return (
    <TooltipProvider delay={100}>
      <Tooltip>
        <TooltipTrigger
          className="inline-flex items-center justify-center text-zinc-500 hover:text-zinc-300 transition-colors cursor-help p-0.5"
          aria-label="Information"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-zinc-900 text-zinc-200 border border-white/10 text-xs max-w-xs p-2.5 rounded-xl shadow-2xl backdrop-blur-md"
        >
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function CurrencyBadge({ code }: { code: string }) {
  const flagCode = CURRENCY_FLAGS[code] || code.slice(0, 2)
  return (
    <div className="flex items-center gap-1.5 font-mono">
      <span className="w-5 h-3.5 rounded-sm bg-white/10 border border-white/10 flex items-center justify-center text-[9px] font-bold text-zinc-300 uppercase tracking-tighter">
        {flagCode}
      </span>
      <span className="font-bold text-white text-xs">{code}</span>
    </div>
  )
}

export function ForexView() {
  const { t, language } = useI18n()
  const { isPrivate } = usePrivacy()

  const [currenciesMap, setCurrenciesMap] = useState<Record<string, string>>({})
  const [baseCurrency, setBaseCurrency] = useState<string>("EUR")
  const [targetCurrency, setTargetCurrency] = useState<string>("USD")
  const [amount, setAmount] = useState<number>(100)

  const [ratesData, setRatesData] = useState<ForexRatesResponse | null>(null)
  const [timeSeries, setTimeSeries] = useState<ForexTimeSeriesPoint[]>([])
  const [timeframe, setTimeframe] = useState<ForexTimeframe>("1M")

  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isChartLoading, setIsChartLoading] = useState<boolean>(false)

  // Load available currencies and latest rates
  const loadRates = useCallback(async (base: string) => {
    setIsLoading(true)
    try {
      const [currs, rates] = await Promise.all([
        ForexAPI.getCurrencies(),
        ForexAPI.getLatestRates(base),
      ])
      setCurrenciesMap(currs)
      setRatesData(rates)
    } catch (err) {
      console.error("Failed to load forex rates:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Load chart time-series
  const loadChart = useCallback(async (base: string, target: string, tf: ForexTimeframe) => {
    setIsChartLoading(true)
    try {
      const points = await ForexAPI.getTimeSeries(base, target, tf)
      setTimeSeries(points)
    } catch (err) {
      console.error("Failed to load forex time-series:", err)
    } finally {
      setIsChartLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRates(baseCurrency)
  }, [baseCurrency, loadRates])

  useEffect(() => {
    if (baseCurrency && targetCurrency && baseCurrency !== targetCurrency) {
      loadChart(baseCurrency, targetCurrency, timeframe)
    } else {
      setTimeSeries([])
    }
  }, [baseCurrency, targetCurrency, timeframe, loadChart])

  // Conversion calculation
  const currentRate = useMemo(() => {
    if (!ratesData || !ratesData.rates) return 1
    if (baseCurrency === targetCurrency) return 1
    return ratesData.rates[targetCurrency] || 1
  }, [ratesData, baseCurrency, targetCurrency])

  const convertedResult = useMemo(() => {
    return amount * currentRate
  }, [amount, currentRate])

  const inverseRate = useMemo(() => {
    return currentRate > 0 ? 1 / currentRate : 0
  }, [currentRate])

  // Swap currencies handler
  const handleSwap = () => {
    const prevBase = baseCurrency
    const prevTarget = targetCurrency
    setBaseCurrency(prevTarget)
    setTargetCurrency(prevBase)
  }

  // All currencies list with names & rates
  const currencyList = useMemo(() => {
    const codes = Object.keys(currenciesMap).length > 0
      ? Object.keys(currenciesMap)
      : Object.keys(ratesData?.rates || {})

    return codes
      .filter((code) => code !== baseCurrency)
      .map((code) => {
        const name = currenciesMap[code] || code
        const rate = ratesData?.rates?.[code] || 0
        const inv = rate > 0 ? 1 / rate : 0
        const symbol = CURRENCY_SYMBOLS[code] || code
        return {
          code,
          name,
          rate,
          inverseRate: inv,
          symbol,
        }
      })
      .sort((a, b) => a.code.localeCompare(b.code))
  }, [currenciesMap, ratesData, baseCurrency])

  // Filtered currency list by search
  const filteredCurrencies = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return currencyList
    return currencyList.filter(
      (c) => c.code.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)
    )
  }, [currencyList, searchQuery])

  // Time-series stats (High, Low, Average, Variation)
  const chartStats = useMemo(() => {
    if (timeSeries.length === 0) {
      return { min: 0, max: 0, avg: 0, variation: 0, isPositive: true }
    }
    const rates = timeSeries.map((p) => p.rate)
    const min = Math.min(...rates)
    const max = Math.max(...rates)
    const avg = rates.reduce((sum, r) => sum + r, 0) / rates.length
    const firstRate = rates[0]
    const lastRate = rates[rates.length - 1]
    const variation = firstRate > 0 ? ((lastRate - firstRate) / firstRate) * 100 : 0
    return {
      min,
      max,
      avg,
      variation,
      isPositive: variation >= 0,
    }
  }, [timeSeries])

  // Benchmark pairs
  const benchmarkPairs = useMemo(() => {
    const targets = ["USD", "GBP", "CHF", "JPY"].filter((t) => t !== baseCurrency)
    return targets.slice(0, 4).map((target) => {
      const rate = ratesData?.rates?.[target] || 0
      const name = currenciesMap[target] || target
      return {
        pair: `${baseCurrency}/${target}`,
        target,
        name,
        rate,
      }
    })
  }, [baseCurrency, ratesData, currenciesMap])

  const timeframes: ForexTimeframe[] = ["7D", "1M", "3M", "1Y", "5Y"]

  const formatRate = (rate: number, decimals = 4) => {
    if (isPrivate) return "••••••"
    return new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(rate)
  }

  const formatConverted = (val: number, targetCode: string) => {
    if (isPrivate) return "••••••"
    const symbol = CURRENCY_SYMBOLS[targetCode] || targetCode
    const formatted = new Intl.NumberFormat(language === "fr" ? "fr-FR" : "en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val)
    return `${formatted} ${symbol}`
  }

  const chartStrokeColor = chartStats.isPositive ? "#10B981" : "#F43F5E"
  const gradientId = chartStats.isPositive ? "forexGreen" : "forexRed"

  return (
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto pb-24 md:pb-12 text-white select-none">
      {/* ------------------------------------------------------------- */}
      {/* Top Header Bar */}
      {/* ------------------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-2 text-xs text-zinc-400">
          <span className="font-semibold text-white">{t.forexMarket.title}</span>
          <span>•</span>
          <span className="font-mono">
            {Object.keys(currenciesMap).length || 30}{" "}
            {language === "fr" ? "devises mondiales" : "global currencies"}
          </span>
          <span>•</span>
          <span className="text-[11px] text-zinc-500 hidden md:inline">
            {ratesData?.date ? `${t.forexMarket.referenceDate}: ${ratesData.date}` : ""}
          </span>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 self-end sm:self-auto">
          <Button
            onClick={() => loadRates(baseCurrency)}
            disabled={isLoading}
            variant="outline"
            size="sm"
            className="h-8 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-lg cursor-pointer text-xs font-semibold"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isLoading && "animate-spin")} />
            <span>{isLoading ? t.common.syncing : t.common.refresh}</span>
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 1. Benchmark Pairs (Top 4 Compact Cards) */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {benchmarkPairs.map((b) => {
          const isSelected = targetCurrency === b.target
          return (
            <Card
              key={b.pair}
              onClick={() => setTargetCurrency(b.target)}
              className={cn(
                "p-3.5 rounded-xl bg-[#18181B] border transition-all cursor-pointer flex flex-col justify-between gap-2 shadow-sm",
                isSelected
                  ? "border-indigo-500/50 bg-indigo-950/10 ring-1 ring-indigo-500/30"
                  : "border-white/10 hover:border-white/20 hover:bg-white/[0.02]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold font-mono text-zinc-400 tracking-wider">
                  {b.pair}
                </span>
                <span className="text-[10px] text-zinc-500 truncate max-w-[90px]">
                  {b.name}
                </span>
              </div>
              <div>
                <span className="text-xl font-bold font-mono text-white tracking-tight">
                  {formatRate(b.rate)}
                </span>
                <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                  1 {baseCurrency} = {formatRate(b.rate, 4)} {b.target}
                </div>
              </div>
            </Card>
          )
        })}
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 2. Interactive Converter & Historical Chart */}
      {/* ------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Left: Converter Card (5 cols) */}
        <Card className="lg:col-span-5 p-4 sm:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4 shadow-sm">
          <div className="flex items-center justify-between pb-3 border-b border-white/5">
            <div className="flex items-center gap-1.5">
              <h2 className="text-sm font-semibold text-white tracking-tight">
                {t.forexMarket.converterTitle}
              </h2>
              <InfoTip text={t.forexMarket.tooltips.converter} />
            </div>
            <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded bg-white/5">
              Spot BCE
            </span>
          </div>

          {/* Amount Input */}
          <div className="space-y-1.5">
            <label className="text-[11px] text-zinc-400 font-medium">
              {t.forexMarket.amount}
            </label>
            <div className="relative">
              <Input
                type="number"
                min={0}
                step={10}
                value={amount}
                onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
                className="bg-zinc-900 border-white/10 text-white text-base font-bold font-mono h-11 rounded-xl px-3.5 focus:border-white/20"
              />
              <span className="absolute right-3.5 top-3 text-xs text-zinc-500 font-mono font-bold">
                {baseCurrency}
              </span>
            </div>
          </div>

          {/* Base & Target Currencies with Swap Button */}
          <div className="grid grid-cols-1 sm:grid-cols-9 items-center gap-2">
            {/* From */}
            <div className="sm:col-span-4 space-y-1">
              <label className="text-[10px] text-zinc-400 font-medium">
                {t.forexMarket.fromCurrency}
              </label>
              <Select
                value={baseCurrency}
                onValueChange={(val) => {
                  if (val) setBaseCurrency(val)
                }}
              >
                <SelectTrigger className="w-full bg-zinc-900 border-white/10 text-white text-xs h-10 rounded-xl font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white max-h-56">
                  {POPULAR_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400">{c.code}</span>
                        <span className="text-zinc-300 truncate">{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Swap Button */}
            <div className="sm:col-span-1 flex justify-center pt-4">
              <button
                type="button"
                onClick={handleSwap}
                title={t.forexMarket.swapCurrencies}
                className="p-2 rounded-xl bg-zinc-900 border border-white/10 text-zinc-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer active:scale-90"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* To */}
            <div className="sm:col-span-4 space-y-1">
              <label className="text-[10px] text-zinc-400 font-medium">
                {t.forexMarket.toCurrency}
              </label>
              <Select
                value={targetCurrency}
                onValueChange={(val) => {
                  if (val) setTargetCurrency(val)
                }}
              >
                <SelectTrigger className="w-full bg-zinc-900 border-white/10 text-white text-xs h-10 rounded-xl font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-zinc-900 border-white/10 text-white max-h-56">
                  {POPULAR_CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs font-mono">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-zinc-400">{c.code}</span>
                        <span className="text-zinc-300 truncate">{c.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Result Highlight Box */}
          <div className="p-4 rounded-xl bg-zinc-950/80 border border-white/5 flex flex-col gap-1.5">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
              {t.forexMarket.convertedAmount}
            </span>
            <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 tracking-tight">
              {formatConverted(convertedResult, targetCurrency)}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono text-zinc-400 pt-1 border-t border-white/5 mt-1">
              <span>1 {baseCurrency} = {formatRate(currentRate, 4)} {targetCurrency}</span>
              <span className="text-zinc-500">1 {targetCurrency} = {formatRate(inverseRate, 4)} {baseCurrency}</span>
            </div>
          </div>
        </Card>

        {/* Right: Selected Pair Historical Chart (7 cols) */}
        <Card className="lg:col-span-7 p-4 sm:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col justify-between gap-4 shadow-sm">
          {/* Chart Header */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-white/5">
            <div className="flex items-center gap-2.5">
              <CurrencyBadge code={baseCurrency} />
              <span className="text-zinc-500 font-mono text-xs">/</span>
              <CurrencyBadge code={targetCurrency} />
              <div className="flex items-baseline gap-2 ml-2">
                <span className="text-xl font-bold font-mono text-white">
                  {formatRate(currentRate, 4)}
                </span>
                {timeSeries.length > 0 && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-0.5 font-mono text-xs font-bold",
                      chartStats.isPositive ? "text-emerald-400" : "text-rose-400"
                    )}
                  >
                    {chartStats.isPositive ? (
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    ) : (
                      <ArrowDownRight className="w-3.5 h-3.5" />
                    )}
                    {chartStats.isPositive ? "+" : ""}
                    {chartStats.variation.toFixed(2)}%
                  </span>
                )}
              </div>
            </div>

            {/* Timeframe selector */}
            <div className="flex items-center bg-zinc-900 p-0.5 rounded-lg border border-white/10 self-start sm:self-auto">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  type="button"
                  onClick={() => setTimeframe(tf)}
                  className={cn(
                    "px-2.5 py-1 text-[11px] font-mono font-medium rounded-md transition-all cursor-pointer",
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

          {/* Period Statistics Summary */}
          <div className="grid grid-cols-4 gap-2 font-mono text-center">
            <div className="p-2 rounded-lg bg-zinc-950/50 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">{t.forexMarket.high}</span>
              <span className="text-xs font-bold text-white">{formatRate(chartStats.max)}</span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950/50 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">{t.forexMarket.low}</span>
              <span className="text-xs font-bold text-white">{formatRate(chartStats.min)}</span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950/50 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">{t.forexMarket.average}</span>
              <span className="text-xs font-bold text-white">{formatRate(chartStats.avg)}</span>
            </div>
            <div className="p-2 rounded-lg bg-zinc-950/50 border border-white/5 flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">{t.forexMarket.variation}</span>
              <span
                className={cn(
                  "text-xs font-bold",
                  chartStats.isPositive ? "text-emerald-400" : "text-rose-400"
                )}
              >
                {chartStats.isPositive ? "+" : ""}
                {chartStats.variation.toFixed(2)}%
              </span>
            </div>
          </div>

          {/* Area Chart */}
          <div className="h-44 w-full pt-1">
            {isChartLoading ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500 font-mono">
                {t.common.loading}
              </div>
            ) : timeSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-zinc-500">
                {t.cryptoMarket.noData}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={timeSeries}
                  margin={{ top: 5, right: 5, left: -20, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={chartStrokeColor} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={chartStrokeColor} stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#52525B"
                    fontSize={9}
                    tickLine={false}
                    tickFormatter={(d) => (d ? d.slice(5) : "")}
                  />
                  <YAxis
                    stroke="#52525B"
                    fontSize={9}
                    tickLine={false}
                    domain={["auto", "auto"]}
                    tickFormatter={(v) => v.toFixed(3)}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload as ForexTimeSeriesPoint
                        return (
                          <div className="p-2 rounded-lg bg-zinc-900 border border-white/10 text-[11px] font-mono shadow-xl space-y-0.5">
                            <p className="text-zinc-400">{data.date}</p>
                            <p className="text-white font-bold">
                              1 {baseCurrency} = {formatRate(data.rate, 4)} {targetCurrency}
                            </p>
                          </div>
                        )
                      }
                      return null
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="rate"
                    stroke={chartStrokeColor}
                    strokeWidth={1.8}
                    fill={`url(#${gradientId})`}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </Card>
      </div>

      {/* ------------------------------------------------------------- */}
      {/* 3. Global ECB Currencies Directory & Cross-Rates Table */}
      {/* ------------------------------------------------------------- */}
      <Card className="p-4 sm:p-5 rounded-2xl bg-[#18181B] border border-white/10 flex flex-col gap-3.5 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 pb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-white tracking-tight">
              {t.forexMarket.allCurrencies} ({filteredCurrencies.length})
            </h3>
            <InfoTip text={t.forexMarket.tooltips.ecbRate} />
          </div>

          {/* Search bar */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.forexMarket.searchPlaceholder}
              className="bg-zinc-900 border-white/10 text-white text-xs h-8 pl-8 rounded-lg font-mono focus:border-white/20"
            />
          </div>
        </div>

        {/* Currency List */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
          {filteredCurrencies.map((c) => {
            const isSelected = targetCurrency === c.code
            return (
              <div
                key={c.code}
                onClick={() => setTargetCurrency(c.code)}
                className={cn(
                  "p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3",
                  isSelected
                    ? "bg-indigo-950/20 border-indigo-500/40 ring-1 ring-indigo-500/20"
                    : "bg-zinc-950/50 border-white/5 hover:border-white/15 hover:bg-white/[0.02]"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <CurrencyBadge code={c.code} />
                  <div className="flex flex-col min-w-0">
                    <span className="text-xs font-semibold text-zinc-300 truncate">
                      {c.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      1 {c.code} = {formatRate(c.inverseRate, 4)} {baseCurrency}
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className="text-xs font-bold text-white">
                    {formatRate(c.rate, 4)}
                  </div>
                  <div className="text-[10px] text-zinc-500">
                    {c.symbol}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}
