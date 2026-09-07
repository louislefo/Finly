"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  Target,
  Building2,
  Wallet,
  Calendar,
  DollarSign,
  Layers,
  MapPin,
  Search,
  Sparkles,
  TrendingUp,
  Percent,
  Check,
  CreditCard,
  Home,
  Clock,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Project, Account, RealEstateData, AddressSearchResult, RealEstateEstimate } from "@/lib/types/finance"

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveProject: (project: Partial<Project>) => void
  projectToEdit?: Project | null
  accounts?: Account[]
}

export function NewProjectModal({
  isOpen,
  onClose,
  onSaveProject,
  projectToEdit,
  accounts = [],
}: NewProjectModalProps) {
  // Common project state
  const [name, setName] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [targetAmount, setTargetAmount] = useState<string>("")
  const [currentAmount, setCurrentAmount] = useState<string>("0")
  const [monthlyContribution, setMonthlyContribution] = useState<string>("")
  const [category, setCategory] = useState<string>("Voyage")
  const [deadline, setDeadline] = useState<string>("")
  const [projectType, setProjectType] = useState<Project["projectType"]>("standard")
  const [status, setStatus] = useState<"future" | "in_progress">("in_progress")
  const [linkedAccountId, setLinkedAccountId] = useState<string>("")

  // Real Estate specific state
  const [propertyPrice, setPropertyPrice] = useState<string>("250000")
  const [surfaceM2, setSurfaceM2] = useState<string>("65")
  const [rePropertyType, setRePropertyType] = useState<string>("apartment")
  const [addressInput, setAddressInput] = useState<string>("")
  const [selectedCity, setSelectedCity] = useState<string>("")
  const [selectedPostalCode, setSelectedPostalCode] = useState<string>("")
  const [selectedLat, setSelectedLat] = useState<number | undefined>(undefined)
  const [selectedLon, setSelectedLon] = useState<number | undefined>(undefined)

  // Address search suggestions
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSearchResult[]>([])
  const [isSearchingAddress, setIsSearchingAddress] = useState<boolean>(false)
  const [showSuggestions, setShowSuggestions] = useState<boolean>(false)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Real estate valuation
  const [estimate, setEstimate] = useState<RealEstateEstimate | null>(null)
  const [isEstimating, setIsEstimating] = useState<boolean>(false)
  const [currentValuation, setCurrentValuation] = useState<string>("250000")
  const [purchaseDate, setPurchaseDate] = useState<string>("")

  // Loan / Mortgage state
  const [hasLoan, setHasLoan] = useState<boolean>(true)
  const [loanAmount, setLoanAmount] = useState<string>("200000")
  const [loanDurationYears, setLoanDurationYears] = useState<number>(20)
  const [interestRate, setInterestRate] = useState<string>("3.40")
  const [insuranceRate, setInsuranceRate] = useState<string>("0.30")
  const [loanStartDate, setLoanStartDate] = useState<string>("")

  // Rental investment state
  const [isRental, setIsRental] = useState<boolean>(false)
  const [monthlyRent, setMonthlyRent] = useState<string>("")

  useEffect(() => {
    if (projectToEdit) {
      setName(projectToEdit.name || "")
      setDescription(projectToEdit.description || "")
      setTargetAmount(projectToEdit.targetAmount?.toString() || "")
      setCurrentAmount(projectToEdit.currentAmount?.toString() || "0")
      setMonthlyContribution(projectToEdit.monthlyContribution?.toString() || "")
      setCategory(projectToEdit.category || "Épargne")
      setDeadline(projectToEdit.deadline || "")
      setProjectType(projectToEdit.projectType === "real_estate" ? "real_estate" : "standard")
      setStatus(projectToEdit.status === "future" ? "future" : "in_progress")
      setLinkedAccountId(projectToEdit.linkedAccountId || "")

      const re = projectToEdit.realEstateData
      if (re) {
        setPropertyPrice(re.propertyPrice?.toString() || "250000")
        setSurfaceM2(re.surfaceM2?.toString() || "65")
        setRePropertyType(re.propertyType || "apartment")
        setAddressInput(re.address || "")
        setSelectedCity(re.city || "")
        setSelectedPostalCode(re.postalCode || "")
        setSelectedLat(re.latitude)
        setSelectedLon(re.longitude)
        setCurrentValuation(re.currentEstimatedValue?.toString() || re.propertyPrice?.toString() || "250000")
        setPurchaseDate(re.purchaseDate || "")
        setHasLoan(re.hasLoan !== false)
        setLoanAmount(re.loanAmount?.toString() || "200000")
        setLoanDurationYears(re.loanDurationYears || 20)
        setInterestRate(re.interestRate?.toString() || "3.40")
        setInsuranceRate(re.insuranceRate?.toString() || "0.30")
        setLoanStartDate(re.loanStartDate || "")
        setIsRental(Boolean(re.isRental))
        setMonthlyRent(re.monthlyRent?.toString() || "")
      }
    } else {
      setName("")
      setDescription("")
      setTargetAmount("50000")
      setCurrentAmount("0")
      setMonthlyContribution("")
      setCategory("Voyage")
      setDeadline("")
      setProjectType("standard")
      setStatus("in_progress")
      setLinkedAccountId("")
      setPropertyPrice("250000")
      setSurfaceM2("65")
      setRePropertyType("apartment")
      setAddressInput("")
      setSelectedCity("")
      setSelectedPostalCode("")
      setSelectedLat(undefined)
      setSelectedLon(undefined)
      setEstimate(null)
      setCurrentValuation("250000")
      setPurchaseDate(new Date().toISOString().split("T")[0])
      setHasLoan(true)
      setLoanAmount("200000")
      setLoanDurationYears(20)
      setInterestRate("3.40")
      setInsuranceRate("0.30")
      setLoanStartDate(new Date().toISOString().slice(0, 7))
      setIsRental(false)
      setMonthlyRent("")
    }
  }, [projectToEdit, isOpen])

  // Debounced Address Search
  const handleAddressChange = (text: string) => {
    setAddressInput(text)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)

    if (text.trim().length >= 3) {
      setIsSearchingAddress(true)
      searchTimeoutRef.current = setTimeout(async () => {
        const results = await FinlyAPI.searchAddress(text)
        setAddressSuggestions(results)
        setIsSearchingAddress(false)
        setShowSuggestions(true)
      }, 350)
    } else {
      setAddressSuggestions([])
      setShowSuggestions(false)
      setIsSearchingAddress(false)
    }
  }

  // Handle Select Address Suggestion
  const handleSelectAddress = (item: AddressSearchResult) => {
    setAddressInput(item.label)
    setSelectedCity(item.city)
    setSelectedPostalCode(item.postcode)
    setSelectedLat(item.latitude)
    setSelectedLon(item.longitude)
    setShowSuggestions(false)

    // Trigger valuation estimation
    triggerValuation(item.postcode, item.city, item.latitude, item.longitude)
  }

  // Live Valuation Trigger
  const triggerValuation = useCallback(
    async (postcode?: string, city?: string, lat?: number, lon?: number) => {
      const surf = parseFloat(surfaceM2) || 65
      const pc = postcode || selectedPostalCode
      const c = city || selectedCity
      if (!pc && !c) return

      setIsEstimating(true)
      try {
        const est = await FinlyAPI.estimateRealEstate({
          address: addressInput,
          postal_code: pc,
          city: c,
          surface_m2: surf,
          property_type: rePropertyType,
          lat: lat || selectedLat,
          lon: lon || selectedLon,
        })
        if (est) {
          setEstimate(est)
          setCurrentValuation(est.estimated_value.toString())
        }
      } finally {
        setIsEstimating(false)
      }
    },
    [surfaceM2, selectedPostalCode, selectedCity, addressInput, rePropertyType, selectedLat, selectedLon]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name) return

    let realEstateData: RealEstateData | undefined = undefined

    if (projectType === "real_estate") {
      const price = parseFloat(propertyPrice) || 250000
      const currentVal = parseFloat(currentValuation) || price
      const surf = parseFloat(surfaceM2) || 65
      const loan = hasLoan ? parseFloat(loanAmount) || 0 : 0
      const rate = parseFloat(interestRate) || 3.4
      const insRate = parseFloat(insuranceRate) || 0.30
      const months = loanDurationYears * 12
      const monthlyRate = rate / 100 / 12

      // Monthly payment & amortized capital
      let monthlyPayment = 0
      let remainingLoanBalance = loan
      let capitalAmortized = 0

      if (hasLoan && loan > 0) {
        if (monthlyRate > 0) {
          const principalInterest =
            (loan * (monthlyRate * Math.pow(1 + monthlyRate, months))) /
            (Math.pow(1 + monthlyRate, months) - 1)
          const insMonthly = (loan * (insRate / 100)) / 12
          monthlyPayment = Math.round(principalInterest + insMonthly)
        } else {
          monthlyPayment = Math.round(loan / months)
        }

        // Compute elapsed months and remaining balance
        if (loanStartDate) {
          try {
            const [y, m] = loanStartDate.split("-").map(Number)
            const now = new Date()
            const elapsed = Math.max(0, Math.min(months, (now.getFullYear() - y) * 12 + (now.getMonth() + 1 - m)))
            let bal = loan
            for (let i = 0; i < elapsed; i++) {
              const interest = bal * monthlyRate
              const principalPart = (monthlyPayment - (loan * (insRate / 100)) / 12) - interest
              bal = Math.max(0, bal - principalPart)
            }
            remainingLoanBalance = Math.round(bal)
            capitalAmortized = Math.round(loan - remainingLoanBalance)
          } catch {
            remainingLoanBalance = loan
          }
        }
      }

      // Rental yield
      const rent = isRental ? parseFloat(monthlyRent) || 0 : 0
      const grossYield = price > 0 && rent > 0 ? Math.round(((rent * 12) / price) * 1000) / 10 : 0

      realEstateData = {
        propertyPrice: price,
        currentEstimatedValue: currentVal,
        estimatedPricePerM2: estimate ? estimate.price_per_m2.median : Math.round(currentVal / surf),
        lastValuationDate: new Date().toISOString().split("T")[0],
        surfaceM2: surf,
        propertyType: rePropertyType as any,
        address: addressInput,
        city: selectedCity,
        postalCode: selectedPostalCode,
        latitude: selectedLat,
        longitude: selectedLon,
        purchaseDate,
        notaryFees: Math.round(price * 0.075),
        downPayment: parseFloat(currentAmount) || 0,
        hasLoan,
        loanAmount: loan,
        loanDurationYears,
        interestRate: rate,
        insuranceRate: insRate,
        loanStartDate,
        monthlyPayment,
        remainingLoanBalance,
        capitalAmortized,
        totalCost: monthlyPayment * months,
        isRental,
        monthlyRent: rent,
        grossYield,
      }
    }

    const payload: Partial<Project> = {
      ...(projectToEdit ? { id: projectToEdit.id } : {}),
      name,
      description: description || (projectType === "real_estate" ? "Achat immobilier et gestion d'actif" : "Objectif budgétaire"),
      targetAmount: parseFloat(targetAmount) || 1000,
      currentAmount: parseFloat(currentAmount) || 0,
      monthlyContribution: monthlyContribution ? parseFloat(monthlyContribution) : undefined,
      deadline: deadline || "31 Déc 2026",
      category: projectType === "real_estate" ? "Immobilier" : category,
      projectType,
      status,
      linkedAccountId: linkedAccountId || undefined,
      realEstateData,
    }

    onSaveProject(payload)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl bg-[#18181B] border border-white/10 text-white rounded-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            {projectType === "real_estate" ? (
              <Building2 className="w-5 h-5 text-indigo-400" />
            ) : (
              <Target className="w-5 h-5 text-indigo-400" />
            )}
            <span>{projectToEdit ? "Modifier le Projet" : "Nouveau Projet / Achat"}</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">
          {/* Project Type Segmented Selector */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-zinc-900 rounded-2xl border border-white/5">
            <button
              type="button"
              onClick={() => {
                setProjectType("standard")
                if (category === "Immobilier") setCategory("Voyage")
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                projectType === "standard"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Épargne & Objectif Financier
            </button>
            <button
              type="button"
              onClick={() => {
                setProjectType("real_estate")
                setCategory("Immobilier")
              }}
              className={`py-2 text-xs font-semibold rounded-xl transition-all cursor-pointer ${
                projectType === "real_estate"
                  ? "bg-indigo-600 text-white shadow"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Bien & Achat Immobilier
            </button>
          </div>

          {/* Project Status */}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setStatus("in_progress")}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                status === "in_progress"
                  ? "bg-indigo-500/15 border-indigo-500/50 text-indigo-300"
                  : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              {projectType === "real_estate" ? "Bien acquis / En cours" : "Projet en cours"}
            </button>
            <button
              type="button"
              onClick={() => setStatus("future")}
              className={`p-2.5 rounded-xl border text-xs font-semibold transition-all cursor-pointer text-center ${
                status === "future"
                  ? "bg-amber-500/15 border-amber-500/50 text-amber-300"
                  : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white"
              }`}
            >
              Projet futur / Préparation
            </button>
          </div>

          {/* General Information */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-zinc-300">
                {projectType === "real_estate" ? "Nom du bien immobilier *" : "Nom du projet *"}
              </label>
              <Input
                type="text"
                placeholder={projectType === "real_estate" ? "Ex: Résidence Principale Lyon 6, T2 Locatif Paris 11" : "Ex: Vacances Tokyo, Fonds d'urgence"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-zinc-900 border-white/10 text-white text-sm rounded-xl h-10"
              />
            </div>

            {/* REAL ESTATE SPECIFIC FIELDS */}
            {projectType === "real_estate" ? (
              <div className="flex flex-col gap-4 p-4 rounded-2xl bg-zinc-900/60 border border-white/10">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Home className="w-4 h-4 text-indigo-400" />
                  Caractéristiques & Adresse du Bien
                </span>

                {/* Address Autocomplete Input */}
                <div className="relative flex flex-col gap-1">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Adresse du bien (Recherche BAN officielle gratuite)</span>
                  </label>
                  <div className="relative">
                    <Input
                      type="text"
                      placeholder="Tapez une adresse (ex: 15 rue de la République, Lyon)"
                      value={addressInput}
                      onChange={(e) => handleAddressChange(e.target.value)}
                      className="bg-zinc-950 border-white/10 text-white text-xs rounded-xl h-10 pl-9"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    {isSearchingAddress && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500 animate-pulse">
                        Recherche...
                      </span>
                    )}
                  </div>

                  {/* Autocomplete Suggestions Dropdown */}
                  {showSuggestions && addressSuggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-[#18181B] border border-white/10 rounded-2xl shadow-2xl divide-y divide-white/5 overflow-hidden">
                      {addressSuggestions.map((item, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleSelectAddress(item)}
                          className="p-3 text-xs hover:bg-white/5 cursor-pointer flex items-center justify-between gap-2"
                        >
                          <div className="flex items-center gap-2 truncate">
                            <MapPin className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                            <span className="text-white font-medium truncate">{item.label}</span>
                          </div>
                          <Badge variant="outline" className="border-white/10 text-[10px] text-zinc-400 shrink-0">
                            {item.postcode}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Surface & Property Type */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Surface (m²) *</label>
                    <Input
                      type="number"
                      placeholder="65"
                      value={surfaceM2}
                      onChange={(e) => setSurfaceM2(e.target.value)}
                      className="bg-zinc-950 border-white/10 text-white text-xs rounded-xl font-mono h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Type de bien</label>
                    <select
                      value={rePropertyType}
                      onChange={(e) => setRePropertyType(e.target.value)}
                      className="p-2.5 rounded-xl bg-zinc-950 border border-white/10 text-white text-xs h-10 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="apartment">Appartement</option>
                      <option value="house">Maison / Villa</option>
                      <option value="building">Immeuble entier</option>
                      <option value="parking">Parking / Garage / Box</option>
                      <option value="commercial">Local Commercial</option>
                    </select>
                  </div>
                </div>

                {/* Purchase Price & Real-Time Estimated Valuation */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Prix d&apos;achat initial (€) *</label>
                    <Input
                      type="number"
                      placeholder="250000"
                      value={propertyPrice}
                      onChange={(e) => setPropertyPrice(e.target.value)}
                      className="bg-zinc-950 border-white/10 text-white text-xs rounded-xl font-mono h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center gap-1">
                        <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Valeur actuelle estimée (€)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() => triggerValuation()}
                        disabled={isEstimating}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer font-semibold"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Estimer en direct</span>
                      </button>
                    </div>
                    <Input
                      type="number"
                      placeholder="250000"
                      value={currentValuation}
                      onChange={(e) => setCurrentValuation(e.target.value)}
                      className="bg-zinc-950 border-emerald-500/30 text-emerald-400 text-xs rounded-xl font-mono font-bold h-10"
                    />
                  </div>
                </div>

                {/* Estimate summary banner if available */}
                {estimate && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center justify-between">
                    <span>
                      Prix m² estimé : <strong className="font-mono">{estimate.price_per_m2.median} €/m²</strong> (Fourchette : {estimate.price_range.low} € – {estimate.price_range.high} €)
                    </span>
                    <Badge variant="outline" className="border-emerald-500/30 text-[10px] text-emerald-300">
                      Tendance 1 an : {estimate.market_trend_1y > 0 ? `+${estimate.market_trend_1y}%` : `${estimate.market_trend_1y}%`}
                    </Badge>
                  </div>
                )}

                {/* Loan / Mortgage Section */}
                <div className="pt-3 border-t border-white/5 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={hasLoan}
                        onChange={(e) => setHasLoan(e.target.checked)}
                        className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-white flex items-center gap-1.5">
                        <CreditCard className="w-3.5 h-3.5 text-indigo-400" />
                        Financement & Prêt Immobilier Associé
                      </span>
                    </label>
                  </div>

                  {hasLoan && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400">Montant emprunté (€)</label>
                        <Input
                          type="number"
                          value={loanAmount}
                          onChange={(e) => setLoanAmount(e.target.value)}
                          className="bg-zinc-950 border-white/10 text-white text-xs rounded-lg font-mono h-8"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400">Durée (ans)</label>
                        <select
                          value={loanDurationYears}
                          onChange={(e) => setLoanDurationYears(Number(e.target.value))}
                          className="p-1.5 rounded-lg bg-zinc-950 border border-white/10 text-white text-xs h-8 font-mono cursor-pointer"
                        >
                          <option value={7}>7 ans</option>
                          <option value={10}>10 ans</option>
                          <option value={15}>15 ans</option>
                          <option value={20}>20 ans</option>
                          <option value={25}>25 ans</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400">Taux intérêt (%)</label>
                        <Input
                          type="number"
                          step="0.01"
                          value={interestRate}
                          onChange={(e) => setInterestRate(e.target.value)}
                          className="bg-zinc-950 border-white/10 text-white text-xs rounded-lg font-mono h-8"
                        />
                      </div>

                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400">Début du prêt</label>
                        <Input
                          type="month"
                          value={loanStartDate}
                          onChange={(e) => setLoanStartDate(e.target.value)}
                          className="bg-zinc-950 border-white/10 text-white text-[11px] rounded-lg h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Rental Investment Option */}
                <div className="pt-3 border-t border-white/5 flex flex-col gap-3">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isRental}
                      onChange={(e) => setIsRental(e.target.checked)}
                      className="rounded border-zinc-700 bg-zinc-900 text-indigo-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs font-semibold text-zinc-300">
                      Investissement Locatif (Revenus & Loyer)
                    </span>
                  </label>

                  {isRental && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-zinc-400">Loyer mensuel perçu (€)</label>
                        <Input
                          type="number"
                          placeholder="Ex: 850"
                          value={monthlyRent}
                          onChange={(e) => setMonthlyRent(e.target.value)}
                          className="bg-zinc-950 border-white/10 text-white text-xs rounded-lg font-mono h-8"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* STANDARD PROJECT FIELDS */
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Objectif Cible (€) *</label>
                    <Input
                      type="number"
                      placeholder="Ex: 5000"
                      value={targetAmount}
                      onChange={(e) => setTargetAmount(e.target.value)}
                      required
                      className="bg-zinc-900 border-white/10 text-white text-sm rounded-xl font-mono h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Déjà Épargné (€)</label>
                    <Input
                      type="number"
                      placeholder="0"
                      value={currentAmount}
                      onChange={(e) => setCurrentAmount(e.target.value)}
                      className="bg-zinc-900 border-white/10 text-white text-sm rounded-xl font-mono h-10"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Épargne Mensuelle (€)</label>
                    <Input
                      type="number"
                      placeholder="Ex: 200"
                      value={monthlyContribution}
                      onChange={(e) => setMonthlyContribution(e.target.value)}
                      className="bg-zinc-900 border-white/10 text-white text-sm rounded-xl font-mono h-10"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Catégorie</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs h-10 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="Voyage">Voyage</option>
                      <option value="Épargne">Épargne & Investissement</option>
                      <option value="Logement">Logement & Travaux</option>
                      <option value="Véhicule">Véhicule</option>
                      <option value="Tech">Matériel High-Tech</option>
                      <option value="Sécurité">Fonds d&apos;Urgence</option>
                    </select>
                  </div>
                </div>

                {/* Linked Account Selector */}
                {accounts.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-zinc-300">Compte ou Livret Associé</label>
                    <select
                      value={linkedAccountId}
                      onChange={(e) => setLinkedAccountId(e.target.value)}
                      className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs h-10 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="">Aucun compte associé</option>
                      {accounts.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({acc.bank})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-300">Date cible / Échéance</label>
                <Input
                  type="text"
                  placeholder="Ex: 31 Août 2026"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="bg-zinc-900 border-white/10 text-white text-sm rounded-xl h-10"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-zinc-300">Description / Notes</label>
                <Input
                  type="text"
                  placeholder="Notes..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="bg-zinc-900 border-white/10 text-white text-sm rounded-xl h-10"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2.5 mt-2">
            <Button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl cursor-pointer shadow-lg shadow-indigo-600/20 text-xs h-10"
            >
              {projectToEdit ? "Mettre à jour" : "Enregistrer le Bien / Projet"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-zinc-900 text-zinc-300 rounded-xl cursor-pointer text-xs h-10 px-4"
            >
              Annuler
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
