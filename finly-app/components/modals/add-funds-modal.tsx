"use client"

import React, { useState } from "react"
import { DollarSign, Wallet } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Project, Account } from "@/lib/types/finance"
import { usePrivacy } from "@/components/privacy-context"

interface AddFundsModalProps {
  project: Project | null
  isOpen: boolean
  onClose: () => void
  onAddFunds: (projectId: string, amount: number, sourceAccountId?: string) => void
  accounts?: Account[]
}

export function AddFundsModal({
  project,
  isOpen,
  onClose,
  onAddFunds,
  accounts = [],
}: AddFundsModalProps) {
  const { formatAmount } = usePrivacy()
  const [amount, setAmount] = useState<string>("")
  const [sourceAccountId, setSourceAccountId] = useState<string>("")

  if (!project) return null

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const numeric = parseFloat(amount)
    if (!numeric || numeric <= 0) return

    onAddFunds(project.id, numeric, sourceAccountId || undefined)
    setAmount("")
    setSourceAccountId("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-[#18181B] border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-indigo-400" />
            <span>Alimenter le Projet</span>
          </DialogTitle>
          <div className="flex items-center justify-between text-xs text-zinc-400 pt-1 font-mono">
            <span className="text-zinc-300 font-semibold">{project.name}</span>
            <span>
              {formatAmount(project.currentAmount)} / {formatAmount(project.targetAmount)}
            </span>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Montant à verser (€) *</label>
              <Input
                type="number"
                step="any"
                placeholder="Ex: 250"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
                className="bg-zinc-900 border-white/10 text-white text-base font-bold font-mono rounded-xl h-11"
              />
            </div>

            {accounts.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">Compte Source Débité</label>
                <select
                  value={sourceAccountId}
                  onChange={(e) => setSourceAccountId(e.target.value)}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs h-10 focus:ring-indigo-500"
                >
                  <option value="">Sélectionner un compte (optionnel)</option>
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.bank}) - {formatAmount(acc.balance)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex gap-2.5 mt-2">
            <Button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-indigo-600/20 cursor-pointer text-xs h-10"
            >
              Confirmer le versement
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
