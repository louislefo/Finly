"use client"

import React, { useState } from "react"
import {
  Trash2,
  PlusCircle,
  CreditCard,
  Building2,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BankLogo } from "@/components/ui/bank-icons"
import { FinlyAPI } from "@/lib/api/finly-api"
import { usePrivacy } from "@/components/privacy-context"
import { Account } from "@/lib/types/finance"

interface ConnectedAccountsModalProps {
  isOpen: boolean
  onClose: () => void
  accounts: Account[]
  onAccountsUpdated: () => void
  onOpenAddBank: () => void
}

export function ConnectedAccountsModal({
  isOpen,
  onClose,
  accounts,
  onAccountsUpdated,
  onOpenAddBank,
}: ConnectedAccountsModalProps) {
  const { formatAmount } = usePrivacy()
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmAccountId, setConfirmAccountId] = useState<string | null>(null)
  const [confirmBankName, setConfirmBankName] = useState<string | null>(null)
  const [isDeletingBank, setIsDeletingBank] = useState<boolean>(false)

  // Group accounts by bank
  const bankNames = Array.from(new Set(accounts.map((a) => a.bank).filter(Boolean)))
  const bankGroups = bankNames.map((bankName) => {
    const bankAccs = accounts.filter((a) => a.bank === bankName)
    const bankTotal = bankAccs.reduce((sum, a) => sum + a.balance, 0)
    return {
      bankName,
      accounts: bankAccs,
      totalBalance: bankTotal,
    }
  })

  const handleDeleteAccount = async (account: Account) => {
    setDeletingId(account.id)
    try {
      await FinlyAPI.deleteAccount(account.id)
      onAccountsUpdated()
      setConfirmAccountId(null)
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteBank = async (bankName: string) => {
    setIsDeletingBank(true)
    try {
      await FinlyAPI.deleteBank(bankName)
      onAccountsUpdated()
      setConfirmBankName(null)
    } finally {
      setIsDeletingBank(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
        <div className="flex flex-col gap-5">
          <DialogHeader className="p-0 text-left">
            <div className="flex justify-between items-center pr-6">
              <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-indigo-400" />
                Gestion des Comptes & Banques
              </DialogTitle>
              <Badge variant="outline" className="text-xs border-white/10 text-zinc-300">
                {accounts.length} compte{accounts.length > 1 ? "s" : ""}
              </Badge>
            </div>
          </DialogHeader>

          {/* Bank Groups List */}
          <div className="flex flex-col gap-4 max-h-[420px] overflow-y-auto pr-1">
            {bankGroups.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500 flex flex-col items-center gap-2">
                <Building2 className="w-8 h-8 text-zinc-600" />
                <span>Aucun compte relié dans la base SQLite.</span>
              </div>
            ) : (
              bankGroups.map((group) => (
                <div
                  key={group.bankName}
                  className="p-4 rounded-2xl bg-zinc-900/90 border border-white/10 flex flex-col gap-3"
                >
                  {/* Bank Header */}
                  <div className="flex justify-between items-center pb-2 border-b border-white/5">
                    <div className="flex items-center gap-2.5">
                      <BankLogo bankId={group.bankName} className="w-7 h-7 shrink-0" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-white">{group.bankName}</span>
                        <span className="text-[10px] text-zinc-400">
                          {group.accounts.length} sous-compte{group.accounts.length > 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>

                    <span className="text-sm font-bold font-mono text-white">
                      {formatAmount(group.totalBalance)}
                    </span>
                  </div>

                  {/* Individual Sub-Accounts */}
                  <div className="flex flex-col divide-y divide-white/5">
                    {group.accounts.map((acc) => (
                      <div
                        key={acc.id}
                        className="py-2.5 flex items-center justify-between gap-3 first:pt-1 last:pb-1"
                      >
                        <div className="flex flex-col min-w-0">
                          <span className="text-xs font-medium text-zinc-200 truncate">
                            {acc.name || acc.type}
                          </span>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-white/10 text-zinc-400">
                              {acc.type}
                            </Badge>
                            <span className="text-xs font-mono font-semibold text-white">
                              {formatAmount(acc.balance)}
                            </span>
                          </div>
                        </div>

                        {/* Account Delete Button */}
                        <div>
                          {confirmAccountId === acc.id ? (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                disabled={deletingId === acc.id}
                                onClick={() => handleDeleteAccount(acc)}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-7 px-2"
                              >
                                {deletingId === acc.id ? "..." : "Confirmer"}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setConfirmAccountId(null)}
                                className="text-xs text-zinc-400 h-7 px-1.5"
                              >
                                Annuler
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setConfirmBankName(null)
                                setConfirmAccountId(acc.id)
                              }}
                              className="text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10 h-7 px-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Delete Entire Bank Section */}
                  <div className="pt-2 border-t border-white/5 flex justify-end">
                    {confirmBankName === group.bankName ? (
                      <div className="flex items-center gap-2 w-full">
                        <Button
                          size="sm"
                          disabled={isDeletingBank}
                          onClick={() => handleDeleteBank(group.bankName)}
                          className="flex-1 bg-rose-600 hover:bg-rose-500 text-white text-xs h-8"
                        >
                          {isDeletingBank ? "Suppression en cours..." : `Confirmer la suppression de ${group.bankName}`}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setConfirmBankName(null)}
                          className="text-xs text-zinc-400 h-8"
                        >
                          Annuler
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setConfirmAccountId(null)
                          setConfirmBankName(group.bankName)
                        }}
                        className="text-[11px] text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10 h-7 px-2.5 gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>Supprimer toute la banque {group.bankName}</span>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Actions */}
          <div className="flex gap-2.5 pt-2 border-t border-white/5">
            <Button
              onClick={() => {
                onClose()
                onOpenAddBank()
              }}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs py-4 gap-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Connecter une banque</span>
            </Button>
            <Button
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs py-4"
            >
              Fermer
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
