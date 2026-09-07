"use client"

import React, { useState, useMemo } from "react"
import { Building2, Calculator, Percent, Sparkles, TrendingUp, Shield, HelpCircle, ArrowRight, Check } from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { MortgageRatesSummary, RealEstateData, Project } from "@/lib/types/finance"

interface MortgageSimulatorCardProps {
  ratesData?: MortgageRatesSummary | null
  ratesSummary?: MortgageRatesSummary | null
  onSaveAsProject?: (data: RealEstateData, name: string) => void
  onCreateProject?: (project: Partial<Project>) => void
}

export function MortgageSimulatorCard({
  ratesData: propRatesData,
  ratesSummary,
  onSaveAsProject,
  onCreateProject,
}: MortgageSimulatorCardProps) {
  const ratesData = ratesSummary || propRatesData
  const { formatAmount } = usePrivacy()

  // Simulator state
  const [propertyPrice, setPropertyPrice] = useState<number>(250000)
  const [downPayment, setDownPayment] = useState<number>(40000)
  const [loanDurationYears, setLoanDurationYears] = useState<number>(20)
  const [propertyType, setPropertyType] = useState<"old" | "new">("old")
  const [customRate, setCustomRate] = useState<string>("")
  const [insuranceRatePercent, setInsuranceRatePercent] = useState<number>(0.30)
  const [monthlyIncome, setMonthlyIncome] = useState<number>(3500)

  // Current market rate for selected duration
  const marketRateObj = useMemo(() => {
    if (!ratesData?.market_rates) return null
    return ratesData.market_rates.find((r) => r.duration_years === loanDurationYears) || ratesData.market_rates[3]
  }, [ratesData, loanDurationYears])

  const effectiveRate = useMemo(() => {
    if (customRate !== "") {
      const parsed = parseFloat(customRate)
      if (!isNaN(parsed) && parsed >= 0) return parsed
    }
    return marketRateObj?.rate_good || 3.40
  }, [customRate, marketRateObj])

  // Calculation logic
  const simulation = useMemo(() => {
    const notaryRate = propertyType === "old" ? 0.075 : 0.025
    const notaryFees = Math.round(propertyPrice * notaryRate)
    const totalProjectCost = propertyPrice + notaryFees
    const loanAmount = Math.max(0, totalProjectCost - downPayment)

    const numberOfMonths = loanDurationYears * 12
    const monthlyRate = effectiveRate / 100 / 12

    let monthlyLoanPayment = 0
    if (loanAmount > 0) {
      if (monthlyRate > 0) {
        monthlyLoanPayment = (loanAmount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -numberOfMonths))
      } else {
        monthlyLoanPayment = loanAmount / numberOfMonths
      }
    }

    const monthlyInsurance = (loanAmount * (insuranceRatePercent / 100)) / 12
    const totalMonthlyPayment = Math.round((monthlyLoanPayment + monthlyInsurance) * 100) / 100

    const totalInterest = Math.round((monthlyLoanPayment * numberOfMonths - loanAmount) * 100) / 100
    const totalInsurance = Math.round((monthlyInsurance * numberOfMonths) * 100) / 100
    const totalCost = Math.round((totalProjectCost + totalInterest + totalInsurance) * 100) / 100

    return {
      propertyPrice,
      downPayment,
      loanAmount,
      loanDurationYears,
      interestRate: effectiveRate,
      insuranceRate: insuranceRatePercent,
      propertyType,
      notaryFees,
      monthlyPayment: totalMonthlyPayment,
      totalInterest,
      totalInsurance,
      totalCost,
    }
  }, [propertyPrice, downPayment, loanDurationYears, effectiveRate, insuranceRatePercent, propertyType])

  // Debt ratio check
  const debtRatio = useMemo(() => {
    if (monthlyIncome <= 0) return 0
    return Math.round(((simulation.monthlyPayment || 0) / monthlyIncome) * 100)
  }, [simulation.monthlyPayment, monthlyIncome])

  const isDebtRatioOk = debtRatio <= 35

  return (
    <div className="flex flex-col gap-5 w-full">
      {/* Real-time Market Rates Bar */}
      <Card className="p-4 sm:p-5 border-white/10 bg-[#18181B] rounded-3xl flex flex-col gap-3">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-bold text-white tracking-wide">
              Barème des Taux Immobiliers en Direct
            </span>
          </div>
          <span className="text-[10px] text-zinc-500 font-mono">
            {ratesData?.source || "Banque de France & Marché"} • {ratesData?.last_updated || "Mars 2026"}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          {(ratesData?.market_rates || [
            { duration_years: 7, rate_good: 3.00 },
            { duration_years: 10, rate_good: 3.10 },
            { duration_years: 15, rate_good: 3.25 },
            { duration_years: 20, rate_good: 3.40 },
            { duration_years: 25, rate_good: 3.55 },
          ]).map((r) => {
            const isSelected = loanDurationYears === r.duration_years
            return (
              <button
                key={r.duration_years}
                type="button"
                onClick={() => {
                  setLoanDurationYears(r.duration_years)
                  setCustomRate("")
                }}
                className={`p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col gap-0.5 ${
                  isSelected
                    ? "bg-indigo-600/15 border-indigo-500/50 shadow-sm"
                    : "bg-zinc-950/60 border-white/5 hover:border-white/20"
                }`}
              >
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-zinc-300">
                    {r.duration_years} ans
                  </span>
                  {isSelected && <Badge variant="outline" className="text-[9px] py-0 px-1 border-indigo-400 text-indigo-300">Actif</Badge>}
                </div>
                <span className="text-sm font-bold font-mono text-white">
                  {r.rate_good.toFixed(2)}%
                </span>
                <span className="text-[9px] text-zinc-500 font-mono">
                  Taux moyen constaté
                </span>
              </button>
            )
          })}
        </div>
      </Card>

      {/* Simulator Inputs & Output Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Left: Interactive Input Controls (7 cols) */}
        <Card className="lg:col-span-7 p-5 md:p-6 border-white/10 bg-[#18181B] rounded-3xl flex flex-col gap-4">
          <div className="flex items-center gap-2 pb-2 border-b border-white/5">
            <Calculator className="w-4 h-4 text-indigo-400" />
            <CardTitle className="text-sm font-bold text-white">
              Paramètres du Projet Immobilier
            </CardTitle>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Property Price */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Prix du bien (€)
              </label>
              <Input
                type="number"
                step="5000"
                min="10000"
                value={propertyPrice}
                onChange={(e) => setPropertyPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                className="bg-zinc-950 border-white/10 text-white font-mono text-sm h-10 rounded-xl"
              />
            </div>

            {/* Down Payment */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Apport personnel (€)
              </label>
              <Input
                type="number"
                step="5000"
                min="0"
                value={downPayment}
                onChange={(e) => setDownPayment(Math.max(0, parseFloat(e.target.value) || 0))}
                className="bg-zinc-950 border-white/10 text-white font-mono text-sm h-10 rounded-xl"
              />
            </div>

            {/* Property Type */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Type de bien
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPropertyType("old")}
                  className={`p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    propertyType === "old"
                      ? "bg-indigo-600 text-white border-indigo-500 font-semibold"
                      : "bg-zinc-950 border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  Ancien (~7,5%)
                </button>
                <button
                  type="button"
                  onClick={() => setPropertyType("new")}
                  className={`p-2 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
                    propertyType === "new"
                      ? "bg-indigo-600 text-white border-indigo-500 font-semibold"
                      : "bg-zinc-950 border-white/10 text-zinc-400 hover:text-white"
                  }`}
                >
                  Neuf (~2,5%)
                </button>
              </div>
            </div>

            {/* Loan Duration */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Durée d&apos;emprunt
              </label>
              <select
                value={loanDurationYears}
                onChange={(e) => {
                  setLoanDurationYears(parseInt(e.target.value, 10))
                  setCustomRate("")
                }}
                className="h-10 px-3 bg-zinc-950 border border-white/10 rounded-xl text-xs text-white outline-none cursor-pointer"
              >
                <option value={7}>7 ans (84 mois)</option>
                <option value={10}>10 ans (120 mois)</option>
                <option value={15}>15 ans (180 mois)</option>
                <option value={20}>20 ans (240 mois)</option>
                <option value={25}>25 ans (300 mois)</option>
              </select>
            </div>

            {/* Interest Rate */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Taux d&apos;intérêt annuel (%)
              </label>
              <Input
                type="number"
                step="0.05"
                min="0.1"
                placeholder={`${effectiveRate.toFixed(2)}%`}
                value={customRate}
                onChange={(e) => setCustomRate(e.target.value)}
                className="bg-zinc-950 border-white/10 text-white font-mono text-sm h-10 rounded-xl"
              />
            </div>

            {/* Insurance Rate */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">
                Taux assurance emprunteur (%)
              </label>
              <Input
                type="number"
                step="0.05"
                min="0.0"
                value={insuranceRatePercent}
                onChange={(e) => setInsuranceRatePercent(Math.max(0, parseFloat(e.target.value) || 0))}
                className="bg-zinc-950 border-white/10 text-white font-mono text-sm h-10 rounded-xl"
              />
            </div>

            {/* Monthly Income for Debt Ratio */}
            <div className="sm:col-span-2 flex flex-col gap-1.5 pt-1 border-t border-white/5">
              <label className="text-xs font-semibold text-zinc-300">
                Revenus nets mensuels du foyer (€) — pour le taux d&apos;endettement
              </label>
              <Input
                type="number"
                step="100"
                min="500"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Math.max(0, parseFloat(e.target.value) || 0))}
                className="bg-zinc-950 border-white/10 text-white font-mono text-sm h-10 rounded-xl"
              />
            </div>
          </div>
        </Card>

        {/* Right: Simulation Financial Output (5 cols) */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="p-5 md:p-6 border-indigo-500/30 bg-gradient-to-b from-indigo-950/20 to-[#18181B] rounded-3xl flex flex-col gap-4">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <span className="text-xs font-semibold text-zinc-300">Mensualité Estimée</span>
              <Badge
                variant="outline"
                className={`text-[10px] font-mono ${
                  isDebtRatioOk
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-rose-500/30 bg-rose-500/10 text-rose-300"
                }`}
              >
                {debtRatio}% endettement
              </Badge>
            </div>

            <div className="flex flex-col">
              <span className="text-3xl font-extrabold font-mono text-white tracking-tight">
                {formatAmount(simulation.monthlyPayment)}
                <span className="text-xs text-zinc-400 font-normal ml-1">/ mois</span>
              </span>
              <span className="text-[11px] text-zinc-400 mt-1 font-mono">
                Assurance incluse ({formatAmount((simulation.loanAmount * (simulation.insuranceRate / 100)) / 12)}/mois)
              </span>
            </div>

            {/* Financial Breakdown Table */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5 text-xs">
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Montant emprunté</span>
                <span className="font-mono font-bold text-white">{formatAmount(simulation.loanAmount)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Frais de notaire estimés</span>
                <span className="font-mono text-zinc-200">{formatAmount(simulation.notaryFees)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Coût total des intérêts</span>
                <span className="font-mono text-amber-300">{formatAmount(simulation.totalInterest)}</span>
              </div>
              <div className="flex justify-between items-center text-zinc-300">
                <span className="text-zinc-400">Coût total de l&apos;assurance</span>
                <span className="font-mono text-zinc-200">{formatAmount(simulation.totalInsurance)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-white/5 font-semibold text-white">
                <span>Coût global de l&apos;opération</span>
                <span className="font-mono text-indigo-300">{formatAmount(simulation.totalCost)}</span>
              </div>
            </div>

            {/* Action button */}
            {(onCreateProject || onSaveAsProject) && (
              <Button
                type="button"
                onClick={() => {
                  const name = `Achat Immobilier (${Math.round(simulation.propertyPrice / 1000)}k€)`
                  if (onCreateProject) {
                    onCreateProject({
                      name,
                      projectType: "real_estate",
                      status: "future",
                      targetAmount: simulation.downPayment,
                      currentAmount: 0,
                      monthlyContribution: simulation.monthlyPayment,
                      category: "Immobilier",
                      deadline: "31 Déc 2026",
                      realEstateData: {
                        ...simulation,
                        debtRatioEstimated: debtRatio,
                      },
                    })
                  } else if (onSaveAsProject) {
                    onSaveAsProject(simulation, name)
                  }
                }}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 rounded-xl cursor-pointer shadow-md shadow-indigo-600/30 gap-1.5 mt-1"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer en Projet Immobilier</span>
              </Button>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
