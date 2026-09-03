"use client"

import React from "react"
import {
  Wallet,
  PiggyBank,
  TrendingUp,
  Shield,
  ChevronRight,
  ExternalLink,
} from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BankLogo } from "@/components/ui/bank-icons"
import { usePrivacy } from "@/components/privacy-context"
import { Account } from "@/lib/types/finance"

interface BankDetailSheetProps {
  isOpen: boolean
  onClose: () => void
  bankName: string | null
  accounts: Account[]
}

export function BankDetailSheet({
  isOpen,
  onClose,
  bankName,
  accounts,
}: BankDetailSheetProps) {
  const { formatAmount } = usePrivacy()

  if (!bankName) return null

  const bankAccounts = accounts.filter((a) => a.bank === bankName)
  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0)

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "Épargne":
        return PiggyBank
      case "Investissement":
        return TrendingUp
      case "Assurance-Vie":
        return Shield
      default:
        return Wallet
    }
  }

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "Épargne":
        return "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
      case "Investissement":
        return "border-amber-500/30 text-amber-400 bg-amber-500/10"
      case "Assurance-Vie":
        return "border-indigo-500/30 text-indigo-400 bg-indigo-500/10"
      default:
        return "border-white/10 text-zinc-300 bg-white/5"
    }
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-[#18181B] border-t border-white/10 text-white rounded-t-3xl p-6 max-w-lg mx-auto">
        <div className="flex flex-col gap-5">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

          {/* Header */}
          <SheetHeader className="p-0 text-left">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <BankLogo bankId={bankName} className="w-11 h-11 shrink-0" />
                <div className="flex flex-col">
                  <SheetTitle className="text-lg font-bold text-white">
                    {bankName}
                  </SheetTitle>
                  <span className="text-xs text-zinc-400">
                    {bankAccounts.length} compte{bankAccounts.length > 1 ? "s" : ""} rattaché{bankAccounts.length > 1 ? "s" : ""}
                  </span>
                </div>
              </div>

              <div className="flex flex-col items-end">
                <span className="text-[11px] text-zinc-400">Total détenu</span>
                <span className="text-lg font-extrabold font-mono text-white">
                  {formatAmount(totalBankBalance)}
                </span>
              </div>
            </div>
          </SheetHeader>

          {/* Sub-accounts List */}
          <div className="flex flex-col gap-2.5 max-h-[380px] overflow-y-auto pr-1">
            {bankAccounts.map((acc) => {
              const Icon = getTypeIcon(acc.type)
              const badgeStyle = getTypeBadgeColor(acc.type)

              return (
                <div
                  key={acc.id}
                  className="p-3.5 rounded-2xl bg-zinc-900/90 border border-white/10 flex items-center justify-between gap-3 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-zinc-950 border border-white/10 flex items-center justify-center text-zinc-300 shrink-0">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-semibold text-white truncate">
                        {acc.name || acc.type}
                      </span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="outline" className={`text-[10px] py-0 px-2 font-medium ${badgeStyle}`}>
                          {acc.type}
                        </Badge>
                        {acc.iban && (
                          <span className="text-[10px] text-zinc-500 font-mono">
                            {acc.iban.slice(-6)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="text-base font-bold font-mono text-white shrink-0">
                    {formatAmount(acc.balance)}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="pt-2 border-t border-white/5">
            <Button
              variant="outline"
              onClick={onClose}
              className="w-full border-white/10 bg-zinc-900 text-zinc-300 text-xs py-4"
            >
              Fermer
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
