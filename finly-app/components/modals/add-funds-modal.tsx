"use client"

import React, { useState } from "react"
import { DollarSign, ArrowDownRight, Wallet } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Project } from "@/lib/types/finance"
import { usePrivacy } from "@/components/privacy-context"

interface AddFundsModalProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
  onAddFunds: (projectId: string, amount: number) => void
}

export function AddFundsModal({ project, isOpen, onClose, onAddFunds }: AddFundsModalProps) {
  const { formatAmount } = usePrivacy()
  const [amount, setAmount] = useState<string>("")
  const [sourceAccount, setSourceAccount] = useState<string>("BoursoBank")

  if (!project) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseFloat(amount)
    if (!numeric || numeric <= 0) return

    onAddFunds(project.id, numeric)
    setAmount("")
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-[#18181B] border-t border-white/10 text-white rounded-t-3xl p-6 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

          <SheetHeader className="p-0 text-left">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-indigo-400" />
              Ajouter des Fonds au Projet
            </SheetTitle>
            <SheetDescription className="text-xs text-zinc-400">
              Projet : <strong className="text-white">{project.name}</strong> (Objectif : {formatAmount(project.targetAmount)})
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Montant à allouer (€) *</label>
              <Input
                type="number"
                placeholder="Ex: 250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="bg-zinc-900 border-white/10 text-white text-base font-bold"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Compte Source</label>
              <select
                value={sourceAccount}
                onChange={(e) => setSourceAccount(e.target.value)}
                className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs h-10 focus:ring-indigo-500"
              >
                <option value="BoursoBank">BoursoBank (4 200,00 €)</option>
                <option value="Revolut">Revolut (1 850,20 €)</option>
                <option value="BNP Paribas">BNP Paribas (6 400,00 €)</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <Button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-5 shadow-lg shadow-indigo-600/20"
            >
              Confirmer l'allocation
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-zinc-900 text-zinc-300"
            >
              Annuler
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
