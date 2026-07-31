"use client"

import React, { useState } from "react"
import {
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Lock,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

interface GoCardlessModalProps {
  isOpen: boolean
  onClose: () => void
}

export function GoCardlessModal({ isOpen, onClose }: GoCardlessModalProps) {
  const [step, setStep] = useState<"select" | "consent" | "connecting" | "success">("select")
  const [selectedBank, setSelectedBank] = useState<string | null>(null)

  const banks = [
    { id: "boursobank", name: "BoursoBank", logo: "B", color: "from-pink-600 to-rose-600" },
    { id: "revolut", name: "Revolut", logo: "R", color: "from-blue-600 to-indigo-600" },
    { id: "bnp", name: "BNP Paribas", logo: "BNP", color: "from-emerald-600 to-teal-600" },
    { id: "ca", name: "Crédit Agricole", logo: "CA", color: "from-green-600 to-emerald-700" },
    { id: "sg", name: "Société Générale", logo: "SG", color: "from-[#18181B] to-[#201f22]" },
    { id: "n26", name: "N26 Bank", logo: "N26", color: "from-teal-600 to-cyan-600" },
  ]

  const handleStartConnect = (bankId: string) => {
    setSelectedBank(bankId)
    setStep("consent")
  }

  const handleConfirmConsent = () => {
    setStep("connecting")
    setTimeout(() => {
      setStep("success")
    }, 2000)
  }

  const handleReset = () => {
    setStep("select")
    setSelectedBank(null)
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleReset}>
      <SheetContent side="bottom" className="bg-[#18181B] border-t border-white/10 text-white rounded-t-3xl p-6 max-w-xl mx-auto">
        <div className="flex flex-col gap-5">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

          <SheetHeader className="p-0 text-left">
            <div className="flex justify-between items-start">
              <div>
                <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-indigo-400" />
                  Connexion Bancaire GoCardless
                </SheetTitle>
                <SheetDescription className="text-xs text-zinc-400 mt-1">
                  Agrégation sécurisée conforme à la norme Européenne DSP2 (Authentification Forte)
                </SheetDescription>
              </div>
              <Badge variant="secondary" className="bg-indigo-500/20 text-indigo-300 border-indigo-500/30">
                180 jours max
              </Badge>
            </div>
          </SheetHeader>

          {/* STEP 1: Select Bank */}
          {step === "select" && (
            <div className="flex flex-col gap-4">
              <span className="text-xs font-semibold text-zinc-300">
                Sélectionnez votre établissement bancaire :
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {banks.map((bank) => (
                  <button
                    key={bank.id}
                    onClick={() => handleStartConnect(bank.id)}
                    className="flex flex-col items-center gap-2 p-3.5 rounded-2xl bg-zinc-900/80 border border-white/10 hover:border-indigo-500/50 hover:bg-zinc-800 transition-all text-center group cursor-pointer"
                  >
                    <div className={`w-10 h-10 rounded-xl bg-gradient-to-tr ${bank.color} flex items-center justify-center font-bold text-white text-xs shadow-md`}>
                      {bank.logo}
                    </div>
                    <span className="text-xs font-medium text-white group-hover:text-indigo-300">
                      {bank.name}
                    </span>
                  </button>
                ))}
              </div>

              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 flex items-center gap-2 text-xs text-zinc-400">
                <Lock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>Aucune coordonnée bancaire n'est stockée sur nos serveurs. Authorization via l'application de votre banque.</span>
              </div>
            </div>
          )}

          {/* STEP 2: Consent Explanation */}
          {step === "consent" && (
            <div className="flex flex-col gap-4">
              <div className="p-4 rounded-2xl bg-zinc-900 border border-white/10 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold">
                    Go
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-bold text-white">Autorisation DSP2 GoCardless</span>
                    <span className="text-xs text-zinc-400">Banque sélectionnée : {banks.find(b => b.id === selectedBank)?.name}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 text-xs text-zinc-300 border-t border-white/5 pt-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Lecture seule des soldes et de l'historique des transactions</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Consentement valide pendant 180 jours (renouvelable)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Redirection sécurisée vers l'application de votre banque</span>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  onClick={handleConfirmConsent}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-2 py-5"
                >
                  Continuer vers {banks.find(b => b.id === selectedBank)?.name} <ExternalLink className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setStep("select")}
                  className="border-white/10 bg-zinc-900 text-zinc-300"
                >
                  Retour
                </Button>
              </div>
            </div>
          )}

          {/* STEP 3: Connecting Simulation */}
          {step === "connecting" && (
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <RefreshCw className="w-10 h-10 text-indigo-400 animate-spin" />
              <div className="flex flex-col gap-1">
                <span className="text-base font-bold text-white">Redirection sécurisée...</span>
                <span className="text-xs text-zinc-400">
                  Synchronisation des comptes et des transactions avec GoCardless
                </span>
              </div>
            </div>
          )}

          {/* STEP 4: Success */}
          {step === "success" && (
            <div className="flex flex-col items-center justify-center py-6 gap-4 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-lg font-bold text-white">Compte Relié avec Succès !</span>
                <span className="text-xs text-zinc-400">
                  Les transactions ont été importées et catégorisées automatiquement.
                </span>
              </div>

              <Button
                onClick={handleReset}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium mt-2"
              >
                Terminer
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
