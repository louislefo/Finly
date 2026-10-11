"use client"

import React, { useState, useEffect, useMemo } from "react"
import { X, Calculator, Shield, Clock, Landmark } from "lucide-react"
import { useI18n } from "@/components/i18n-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loan, LoanType } from "@/lib/types/finance"
import { FinlyAPI } from "@/lib/api/finly-api"

interface LoanModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  loanToEdit?: Loan | null
}

export function LoanModal({ isOpen, onClose, onSuccess, loanToEdit }: LoanModalProps) {
  const { t, language } = useI18n()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields
  const [name, setName] = useState("")
  const [loanType, setLoanType] = useState<LoanType>("mortgage")
  const [lenderName, setLenderName] = useState("")
  const [principalAmount, setPrincipalAmount] = useState<number>(200000)
  const [interestRate, setInterestRate] = useState<number>(3.2)
  const [insuranceRate, setInsuranceRate] = useState<number>(0.30)
  const [durationYears, setDurationYears] = useState<number>(20)
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
  })
  const [notes, setNotes] = useState("")

  useEffect(() => {
    if (loanToEdit) {
      setName(loanToEdit.name)
      setLoanType(loanToEdit.loan_type)
      setLenderName(loanToEdit.lender_name || "")
      setPrincipalAmount(loanToEdit.principal_amount)
      setInterestRate(loanToEdit.interest_rate)
      setInsuranceRate(loanToEdit.insurance_rate)
      setDurationYears(Math.round(loanToEdit.duration_months / 12))
      setStartDate(loanToEdit.start_date || "")
      setNotes(loanToEdit.notes || "")
    } else {
      setName("")
      setLoanType("mortgage")
      setLenderName("")
      setPrincipalAmount(200000)
      setInterestRate(3.2)
      setInsuranceRate(0.30)
      setDurationYears(20)
      const d = new Date()
      setStartDate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`)
      setNotes("")
    }
    setError(null)
  }, [loanToEdit, isOpen])

  // Live client-side calculation preview
  const liveCalculation = useMemo(() => {
    const p = Number(principalAmount) || 0
    const r = (Number(interestRate) || 0) / 100 / 12
    const n = Math.max(1, (Number(durationYears) || 1) * 12)
    const insRate = (Number(insuranceRate) || 0) / 100 / 12
    const monthlyIns = p * insRate

    let monthlyPI = 0
    if (r > 0) {
      const factor = Math.pow(1 + r, n)
      monthlyPI = p * (r * factor) / (factor - 1)
    } else {
      monthlyPI = p / n
    }

    const totalPI = monthlyPI * n
    const totalInterest = Math.max(0, totalPI - p)
    const totalInsurance = monthlyIns * n
    const totalPayment = monthlyPI + monthlyIns

    return {
      monthlyPayment: Math.round(totalPayment * 100) / 100,
      monthlyPI: Math.round(monthlyPI * 100) / 100,
      monthlyIns: Math.round(monthlyIns * 100) / 100,
      totalInterest: Math.round(totalInterest),
      totalCost: Math.round(p + totalInterest + totalInsurance),
    }
  }, [principalAmount, interestRate, insuranceRate, durationYears])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError(language === "fr" ? "Veuillez renseigner un nom pour l'emprunt." : "Please enter a name for the loan.")
      return
    }
    if (principalAmount <= 0) {
      setError(language === "fr" ? "Le montant emprunté doit être supérieur à zéro." : "Principal amount must be greater than zero.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const payload: Partial<Loan> = {
        name: name.trim(),
        loan_type: loanType,
        lender_name: lenderName.trim() || undefined,
        principal_amount: Number(principalAmount),
        interest_rate: Number(interestRate),
        insurance_rate: Number(insuranceRate),
        duration_months: Math.max(1, Number(durationYears) * 12),
        start_date: startDate.trim(),
        notes: notes.trim() || undefined,
      }

      if (loanToEdit) {
        await FinlyAPI.updateLoan(loanToEdit.id, payload)
      } else {
        await FinlyAPI.createLoan(payload)
      }

      onSuccess()
      onClose()
    } catch (err: any) {
      setError(err.message || (language === "fr" ? "Erreur lors de l'enregistrement de l'emprunt." : "Failed to save loan."))
    } finally {
      setIsSubmitting(false)
    }
  }

  const loanTypesList: { id: LoanType; label: string }[] = [
    { id: "mortgage", label: t.loans.mortgage },
    { id: "student", label: t.loans.student },
    { id: "auto", label: t.loans.auto },
    { id: "consumer", label: t.loans.consumer },
    { id: "personal", label: t.loans.personal },
    { id: "other", label: t.loans.other },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#18181B] border border-white/10 rounded-2xl w-full max-w-xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl">
              <Landmark className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-tight">
                {loanToEdit ? t.loans.editLoan : t.loans.addLoan}
              </h2>
              <p className="text-xs text-zinc-400">
                {loanToEdit ? loanToEdit.name : t.loans.subtitle}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-zinc-400 hover:text-white rounded-xl h-8 w-8 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl">
              {error}
            </div>
          )}

          {/* Name & Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{language === "fr" ? "Nom du prêt" : "Loan Name"}</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={language === "fr" ? "ex: Crédit Immobilier RP" : "e.g. Primary Mortgage"}
                required
                className="bg-zinc-900 border-white/10 text-white rounded-xl h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{t.loans.loanType}</label>
              <select
                value={loanType}
                onChange={(e) => setLoanType(e.target.value as LoanType)}
                className="w-full h-9 rounded-xl border border-white/10 bg-zinc-900 px-3 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {loanTypesList.map((lt) => (
                  <option key={lt.id} value={lt.id}>
                    {lt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Lender & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{t.loans.lender}</label>
              <Input
                value={lenderName}
                onChange={(e) => setLenderName(e.target.value)}
                placeholder={language === "fr" ? "ex: BNP Paribas, Boursorama..." : "e.g. Bank of America, Chase..."}
                className="bg-zinc-900 border-white/10 text-white rounded-xl h-9"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{t.loans.startDate}</label>
              <Input
                type="month"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                required
                className="bg-zinc-900 border-white/10 text-white rounded-xl h-9"
              />
            </div>
          </div>

          {/* Principal & Duration */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{t.loans.principalAmount} (€)</label>
              <Input
                type="number"
                min="1"
                step="1000"
                value={principalAmount}
                onChange={(e) => setPrincipalAmount(Number(e.target.value))}
                required
                className="bg-zinc-900 border-white/10 text-white rounded-xl h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{t.loans.duration} ({t.loans.durationYears})</label>
              <Input
                type="number"
                min="1"
                max="50"
                step="1"
                value={durationYears}
                onChange={(e) => setDurationYears(Number(e.target.value))}
                required
                className="bg-zinc-900 border-white/10 text-white rounded-xl h-9 font-mono"
              />
            </div>
          </div>

          {/* Rates: Interest & Insurance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{t.loans.interestRate}</label>
              <Input
                type="number"
                min="0"
                max="25"
                step="0.05"
                value={interestRate}
                onChange={(e) => setInterestRate(Number(e.target.value))}
                required
                className="bg-zinc-900 border-white/10 text-white rounded-xl h-9 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-zinc-300 font-medium">{t.loans.insuranceRate}</label>
              <Input
                type="number"
                min="0"
                max="5"
                step="0.02"
                value={insuranceRate}
                onChange={(e) => setInsuranceRate(Number(e.target.value))}
                className="bg-zinc-900 border-white/10 text-white rounded-xl h-9 font-mono"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-zinc-300 font-medium">{language === "fr" ? "Notes / Détails (optionnel)" : "Notes (optional)"}</label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={language === "fr" ? "Taux fixe, apport personnel, délégation d'assurance..." : "Fixed rate, down payment, specific terms..."}
              className="bg-zinc-900 border-white/10 text-white rounded-xl h-9"
            />
          </div>


          {/* Live Calculation Preview Card */}
          <div className="bg-zinc-950/70 border border-white/5 rounded-xl p-3.5 space-y-2">
            <div className="flex items-center justify-between text-zinc-400 text-[11px]">
              <span className="flex items-center gap-1.5">
                <Calculator className="w-3.5 h-3.5 text-indigo-400" />
                <span>{language === "fr" ? "Mensualité tout compris estimée" : "Estimated Total Monthly Payment"}</span>
              </span>
              <span className="text-base font-bold font-mono text-white">
                {liveCalculation.monthlyPayment.toLocaleString("fr-FR")} €
                <span className="text-xs font-normal text-zinc-400">/mois</span>
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-1 border-t border-white/5 text-[10px] text-zinc-400 font-mono">
              <div>
                <span className="block text-zinc-500">{t.loans.principalPayment} + {t.loans.interestPayment}</span>
                <span className="text-zinc-300 font-semibold">{liveCalculation.monthlyPI} €</span>
              </div>
              <div>
                <span className="block text-zinc-500">{t.loans.insurancePayment}</span>
                <span className="text-zinc-300 font-semibold">{liveCalculation.monthlyIns} €</span>
              </div>
              <div>
                <span className="block text-zinc-500">{language === "fr" ? "Coût intérêts" : "Total Interest"}</span>
                <span className="text-amber-400 font-semibold">{liveCalculation.totalInterest.toLocaleString("fr-FR")} €</span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="h-9 px-4 border-white/10 bg-transparent text-zinc-300 hover:bg-zinc-800 rounded-xl cursor-pointer"
            >
              {t.loans.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="h-9 px-5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-semibold cursor-pointer"
            >
              {isSubmitting ? (language === "fr" ? "Enregistrement..." : "Saving...") : t.loans.saveLoan}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
