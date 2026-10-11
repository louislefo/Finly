"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  X,
  Calendar,
  Percent,
  Clock,
  Landmark,
  TrendingDown,
  Sparkles,
  ArrowRight,
  Edit2,
  Trash2,
  FileSpreadsheet,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import { useI18n } from "@/components/i18n-context"
import { usePrivacy } from "@/components/privacy-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loan, AmortizationScheduleItem, EarlyRepaymentSimulationResult } from "@/lib/types/finance"
import { FinlyAPI } from "@/lib/api/finly-api"
import { cn } from "@/lib/utils"

interface LoanDetailsModalProps {
  isOpen: boolean
  loan: Loan | null
  onClose: () => void
  onEdit: (loan: Loan) => void
  onDelete: (loanId: string) => void
}

export function LoanDetailsModal({
  isOpen,
  loan,
  onClose,
  onEdit,
  onDelete,
}: LoanDetailsModalProps) {
  const { t, language } = useI18n()
  const { formatAmount } = usePrivacy()

  const [activeTab, setActiveTab] = useState<"schedule" | "simulator">("schedule")
  const [schedule, setSchedule] = useState<AmortizationScheduleItem[]>([])
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false)
  const [scheduleSearchYear, setScheduleSearchYear] = useState<string>("all")

  // Simulator state
  const [simAmount, setSimAmount] = useState<number>(10000)
  const [simStrategy, setSimStrategy] = useState<"reduce_duration" | "reduce_payment">("reduce_duration")
  const [simPenaltyPct, setSimPenaltyPct] = useState<number>(0.0)
  const [simResult, setSimResult] = useState<EarlyRepaymentSimulationResult | null>(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [simError, setSimError] = useState<string | null>(null)

  // Fetch schedule when loan opens
  useEffect(() => {
    if (isOpen && loan) {
      setIsLoadingSchedule(true)
      FinlyAPI.getLoanSchedule(loan.id)
        .then((res) => {
          setSchedule(res.schedule || [])
        })
        .catch(() => {
          setSchedule([])
        })
        .finally(() => {
          setIsLoadingSchedule(false)
        })
    }
  }, [isOpen, loan])

  // Run simulation on parameter changes
  useEffect(() => {
    if (isOpen && loan && simAmount > 0) {
      setIsSimulating(true)
      setSimError(null)
      FinlyAPI.simulateLoanEarlyRepayment(loan.id, {
        repayment_amount: simAmount,
        strategy: simStrategy,
        penalty_rate_pct: simPenaltyPct,
      })
        .then((res) => {
          setSimResult(res)
        })
        .catch((err) => {
          setSimError(err.message || "Simulation error")
          setSimResult(null)
        })
        .finally(() => {
          setIsSimulating(false)
        })
    }
  }, [isOpen, loan, simAmount, simStrategy, simPenaltyPct])

  // Extract available years for schedule filtering
  const availableYears = useMemo(() => {
    const years = new Set<string>()
    for (const item of schedule) {
      const y = item.date.split("-")[0]
      if (y) years.add(y)
    }
    return Array.from(years).sort()
  }, [schedule])

  const filteredSchedule = useMemo(() => {
    if (scheduleSearchYear === "all") return schedule
    return schedule.filter((s) => s.date.startsWith(scheduleSearchYear))
  }, [schedule, scheduleSearchYear])

  if (!isOpen || !loan) return null

  const loanTypeLabels: Record<string, string> = {
    mortgage: t.loans.mortgage,
    student: t.loans.student,
    auto: t.loans.auto,
    consumer: t.loans.consumer,
    personal: t.loans.personal,
    other: t.loans.other,
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#18181B] border border-white/10 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-white/10 shrink-0 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">{loan.name}</h2>
                <Badge variant="outline" className="text-[10px] px-2 py-0.5 border-white/10 text-zinc-300 bg-white/5">
                  {loanTypeLabels[loan.loan_type] || loan.loan_type}
                </Badge>
              </div>
              <p className="text-xs text-zinc-400">
                {loan.lender_name ? `${loan.lender_name} • ` : ""}
                {loan.interest_rate}% • {Math.round(loan.duration_months / 12)} ans • {t.loans.startDate}: {loan.start_date}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEdit(loan)}
              className="h-8 px-3 gap-1.5 border-white/10 text-zinc-300 hover:text-white rounded-xl text-xs cursor-pointer"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>{language === "fr" ? "Modifier" : "Edit"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(loan.id)}
              className="h-8 px-3 gap-1.5 border-rose-500/20 text-rose-400 hover:bg-rose-500/10 rounded-xl text-xs cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t.loans.deleteLoan}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-zinc-400 hover:text-white rounded-xl h-8 w-8 cursor-pointer ml-1"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Top Key Metrics Banner */}
        <div className="p-4 sm:p-5 bg-zinc-950/50 border-b border-white/5 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
          <div>
            <span className="text-[11px] text-zinc-400 block">{t.loans.remainingBalance}</span>
            <span className="text-lg font-bold font-mono text-white">
              {formatAmount(loan.remaining_balance)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block">{t.loans.monthlyPayment}</span>
            <span className="text-lg font-bold font-mono text-indigo-400">
              {loan.monthly_payment.toLocaleString("fr-FR")} €
              <span className="text-[10px] text-zinc-500 font-normal">/mois</span>
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block">{t.loans.capitalAmortized}</span>
            <span className="text-lg font-bold font-mono text-emerald-400">
              {formatAmount(loan.capital_amortized)}
            </span>
          </div>

          <div>
            <span className="text-[11px] text-zinc-400 block">{t.loans.progress}</span>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={loan.completion_percentage} className="h-2 flex-1 bg-zinc-800" />
              <span className="text-xs font-mono font-bold text-zinc-300">
                {loan.completion_percentage}%
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="px-5 pt-3 border-b border-white/10 flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("schedule")}
            className={cn(
              "pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer",
              activeTab === "schedule"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            {t.loans.scheduleTitle} ({schedule.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            className={cn(
              "pb-2.5 text-xs font-semibold border-b-2 transition-all cursor-pointer flex items-center gap-1.5",
              activeTab === "simulator"
                ? "border-indigo-500 text-white"
                : "border-transparent text-zinc-400 hover:text-zinc-200"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.loans.simulatorTitle}</span>
          </button>
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 overflow-y-auto p-5 text-xs">
          {activeTab === "schedule" ? (
            <div className="space-y-3">
              {/* Filter controls */}
              <div className="flex items-center justify-between gap-3 pb-1">
                <span className="text-[11px] text-zinc-400">
                  {language === "fr"
                    ? `${filteredSchedule.length} échéances affichées`
                    : `${filteredSchedule.length} payments displayed`}
                </span>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-zinc-400">{language === "fr" ? "Année :" : "Year:"}</span>
                  <select
                    value={scheduleSearchYear}
                    onChange={(e) => setScheduleSearchYear(e.target.value)}
                    className="h-8 rounded-xl border border-white/10 bg-zinc-900 px-2.5 text-xs text-white focus:outline-none"
                  >
                    <option value="all">{language === "fr" ? "Toutes les années" : "All years"}</option>
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule Table */}
              {isLoadingSchedule ? (
                <div className="p-8 text-center text-zinc-500">
                  {language === "fr" ? "Calcul du tableau d'amortissement..." : "Loading amortization schedule..."}
                </div>
              ) : (
                <div className="border border-white/10 rounded-xl overflow-hidden overflow-x-auto bg-zinc-950/40">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="border-b border-white/10 bg-white/5 text-zinc-400 font-medium">
                        <th className="p-2.5">{t.loans.period}</th>
                        <th className="p-2.5">{t.loans.date}</th>
                        <th className="p-2.5 text-right">{t.loans.beginningBalance}</th>
                        <th className="p-2.5 text-right">{t.loans.principalPayment}</th>
                        <th className="p-2.5 text-right">{t.loans.interestPayment}</th>
                        <th className="p-2.5 text-right">{t.loans.insurancePayment}</th>
                        <th className="p-2.5 text-right font-bold text-white">{t.loans.monthlyPayment}</th>
                        <th className="p-2.5 text-right">{t.loans.endingBalance}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 font-mono">
                      {filteredSchedule.map((item) => (
                        <tr
                          key={item.period}
                          className={cn(
                            "hover:bg-white/5 transition-colors",
                            item.is_past ? "opacity-60 bg-white/[0.02]" : "text-zinc-200"
                          )}
                        >
                          <td className="p-2.5 font-sans">
                            <span className="flex items-center gap-1.5">
                              {item.is_past && <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />}
                              #{item.period}
                            </span>
                          </td>
                          <td className="p-2.5 font-sans font-medium text-white">{item.date}</td>
                          <td className="p-2.5 text-right text-zinc-400">
                            {item.beginning_balance.toLocaleString("fr-FR")} €
                          </td>
                          <td className="p-2.5 text-right text-emerald-400 font-semibold">
                            {item.principal_payment.toLocaleString("fr-FR")} €
                          </td>
                          <td className="p-2.5 text-right text-amber-400">
                            {item.interest_payment.toLocaleString("fr-FR")} €
                          </td>
                          <td className="p-2.5 text-right text-zinc-400">
                            {item.insurance_payment.toLocaleString("fr-FR")} €
                          </td>
                          <td className="p-2.5 text-right text-white font-bold">
                            {item.total_payment.toLocaleString("fr-FR")} €
                          </td>
                          <td className="p-2.5 text-right text-zinc-300 font-bold">
                            {item.ending_balance.toLocaleString("fr-FR")} €
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* Simulator Tab */
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Inputs Column */}
                <div className="md:col-span-1 space-y-4 bg-zinc-950/40 p-4 rounded-xl border border-white/5">
                  <div className="space-y-1.5">
                    <label className="text-zinc-300 font-medium block">{t.loans.repaymentAmount} (€)</label>
                    <Input
                      type="number"
                      min="500"
                      step="1000"
                      value={simAmount}
                      onChange={(e) => setSimAmount(Number(e.target.value))}
                      className="bg-zinc-900 border-white/10 text-white rounded-xl h-9 font-mono text-sm"
                    />

                    {/* Quick presets */}
                    <div className="flex gap-1.5 pt-1">
                      {[5000, 10000, 25000].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setSimAmount(preset)}
                          className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-[10px] text-zinc-300 font-mono transition-colors cursor-pointer"
                        >
                          +{preset.toLocaleString("fr-FR")} €
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Strategy Choice */}
                  <div className="space-y-2">
                    <label className="text-zinc-300 font-medium block">{t.loans.strategy}</label>
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setSimStrategy("reduce_duration")}
                        className={cn(
                          "w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          simStrategy === "reduce_duration"
                            ? "bg-indigo-600/10 border-indigo-500 text-white"
                            : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                        )}
                      >
                        <span className="font-semibold block text-xs">{t.loans.reduceDuration}</span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">{t.loans.reduceDurationDesc}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSimStrategy("reduce_payment")}
                        className={cn(
                          "w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer",
                          simStrategy === "reduce_payment"
                            ? "bg-indigo-600/10 border-indigo-500 text-white"
                            : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                        )}
                      >
                        <span className="font-semibold block text-xs">{t.loans.reducePayment}</span>
                        <span className="text-[10px] text-zinc-400 block mt-0.5">{t.loans.reducePaymentDesc}</span>
                      </button>
                    </div>
                  </div>

                  {/* Penalty IRA */}
                  <div className="space-y-1.5">
                    <label className="text-zinc-300 font-medium block">{t.loans.penaltyRate}</label>
                    <Input
                      type="number"
                      min="0"
                      max="3"
                      step="0.5"
                      value={simPenaltyPct}
                      onChange={(e) => setSimPenaltyPct(Number(e.target.value))}
                      className="bg-zinc-900 border-white/10 text-white rounded-xl h-9 font-mono"
                    />
                    <span className="text-[10px] text-zinc-500 block">
                      {language === "fr" ? "Plafonné à 6 mois d'intérêts ou 3% par la loi." : "Legally capped in France."}
                    </span>
                  </div>
                </div>

                {/* Simulation Output Column */}
                <div className="md:col-span-2 space-y-3">
                  {simError && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
                      {simError}
                    </div>
                  )}

                  {simResult && (
                    <div className="space-y-3 animate-in fade-in duration-150">
                      {/* Big KPI Net Savings Banner */}
                      <div className="p-4 sm:p-5 bg-gradient-to-br from-indigo-950/40 via-zinc-900 to-zinc-950 border border-indigo-500/30 rounded-2xl flex items-center justify-between">
                        <div>
                          <span className="text-xs text-indigo-300 font-semibold uppercase tracking-wider block">
                            {t.loans.netSavings}
                          </span>
                          <span className="text-2xl sm:text-3xl font-extrabold font-mono text-white mt-1 block">
                            +{simResult.net_savings.toLocaleString("fr-FR")} €
                          </span>
                          <span className="text-[11px] text-zinc-400 mt-0.5 block">
                            {language === "fr" ? "Gain net après déduction des frais éventuels." : "Net financial gain."}
                          </span>
                        </div>

                        {simStrategy === "reduce_duration" ? (
                          <div className="text-right">
                            <span className="text-xs text-emerald-400 font-semibold block">{t.loans.yearsSaved}</span>
                            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
                              {simResult.years_saved} {language === "fr" ? "ans" : "yrs"}
                            </span>
                            <span className="text-[11px] text-zinc-400 block">
                              ({simResult.months_saved} {t.loans.durationMonths})
                            </span>
                          </div>
                        ) : (
                          <div className="text-right">
                            <span className="text-xs text-emerald-400 font-semibold block">{t.loans.monthlyDrop}</span>
                            <span className="text-2xl sm:text-3xl font-extrabold font-mono text-emerald-400">
                              {simResult.monthly_payment_change} €
                            </span>
                            <span className="text-[11px] text-zinc-400 block">
                              {language === "fr" ? "par mois" : "per month"}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Detail Metric Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl">
                          <span className="text-[11px] text-zinc-400 block">{t.loans.interestSaved}</span>
                          <span className="text-base font-bold font-mono text-amber-400">
                            {simResult.interest_saved.toLocaleString("fr-FR")} €
                          </span>
                        </div>

                        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl">
                          <span className="text-[11px] text-zinc-400 block">{t.loans.insuranceSaved}</span>
                          <span className="text-base font-bold font-mono text-zinc-300">
                            {simResult.insurance_saved.toLocaleString("fr-FR")} €
                          </span>
                        </div>

                        <div className="p-3 bg-zinc-950/60 border border-white/5 rounded-xl">
                          <span className="text-[11px] text-zinc-400 block">{t.loans.newMonthlyPayment}</span>
                          <span className="text-base font-bold font-mono text-white">
                            {simResult.new_monthly_payment.toLocaleString("fr-FR")} €
                          </span>
                        </div>
                      </div>

                      {/* Before / After Comparison */}
                      <div className="p-3.5 bg-zinc-950/40 border border-white/5 rounded-xl text-xs space-y-2">
                        <div className="flex items-center justify-between text-zinc-400 pb-1 border-b border-white/5">
                          <span>{language === "fr" ? "Indicateur" : "Metric"}</span>
                          <div className="flex gap-8 font-mono">
                            <span>{language === "fr" ? "Actuel" : "Current"}</span>
                            <span>{language === "fr" ? "Après Versement" : "After Repayment"}</span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-zinc-300 font-mono">
                          <span className="font-sans text-zinc-400">{t.loans.remainingBalance}</span>
                          <div className="flex gap-8">
                            <span className="line-through text-zinc-500">
                              {simResult.balance_before.toLocaleString("fr-FR")} €
                            </span>
                            <span className="text-white font-bold">
                              {simResult.balance_after.toLocaleString("fr-FR")} €
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-zinc-300 font-mono">
                          <span className="font-sans text-zinc-400">{t.loans.duration} restante</span>
                          <div className="flex gap-8">
                            <span className="text-zinc-400">
                              {simResult.original_remaining_months} {t.loans.durationMonths}
                            </span>
                            <span className="text-emerald-400 font-bold">
                              {simResult.new_remaining_months} {t.loans.durationMonths}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
