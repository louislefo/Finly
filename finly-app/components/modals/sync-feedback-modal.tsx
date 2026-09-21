"use client"

import React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BankLogo } from "@/components/ui/bank-icons"
import { useI18n } from "@/components/i18n-context"
import { BankSyncError, SyncResult } from "@/lib/types/finance"
import { AlertCircle, CheckCircle2, ShieldAlert, ArrowRight } from "lucide-react"

interface SyncFeedbackModalProps {
  isOpen: boolean
  onClose: () => void
  syncResult: SyncResult | null
  onFixConnection?: (error: BankSyncError) => void
}

export function SyncFeedbackModal({
  isOpen,
  onClose,
  syncResult,
  onFixConnection,
}: SyncFeedbackModalProps) {
  const { t } = useI18n()
  const sf = t.syncFeedback

  if (!syncResult) return null

  const errors = syncResult.errors || []
  const hasErrors = errors.length > 0 || syncResult.status === "error"
  const isSuccess = syncResult.status === "success" && errors.length === 0

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-6 max-w-md">
        <DialogHeader className="p-0 text-left">
          <div className="flex items-center gap-2.5">
            {hasErrors ? (
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
              </div>
            ) : (
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
            )}
            <div>
              <DialogTitle className="text-base font-bold text-white">
                {hasErrors ? sf.syncErrorTitle : sf.syncSuccessTitle}
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-400 mt-0.5">
                {hasErrors ? sf.syncErrorDesc : sf.syncSuccessDesc}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {hasErrors ? (
          <div className="flex flex-col gap-3 mt-2">
            {errors.map((err, idx) => (
              <div
                key={err.connection_id || idx}
                className="flex flex-col gap-2.5 p-3 rounded-2xl bg-zinc-950 border border-white/5"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5 shrink-0">
                      <BankLogo bankName={err.bank_name} className="w-5 h-5" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-white truncate">
                        {err.bank_name}
                      </span>
                      {err.login && (
                        <span className="text-[11px] text-zinc-500 font-mono truncate">
                          {err.login}
                        </span>
                      )}
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className="border-amber-500/30 bg-amber-500/10 text-amber-400 text-[10px] font-semibold shrink-0"
                  >
                    {sf.actionRequired}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-zinc-300 bg-[#18181B] px-2.5 py-1.5 rounded-xl border border-white/5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">
                    {err.message || sf.missingPasswordDesc}
                  </span>
                </div>

                {onFixConnection && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onFixConnection(err)
                      onClose()
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-9 rounded-xl shadow-md shadow-indigo-600/25 flex items-center justify-center gap-1.5 cursor-pointer mt-0.5"
                  >
                    <span>{sf.correctBtn}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-2">
            <div className="p-3.5 rounded-2xl bg-zinc-950 border border-white/5 flex items-center justify-between text-xs">
              <span className="text-zinc-400">{sf.syncSuccessDesc}</span>
              {(syncResult.synced_accounts !== undefined ||
                syncResult.new_transactions !== undefined) && (
                <Badge
                  variant="outline"
                  className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-semibold shrink-0"
                >
                  {syncResult.synced_accounts ?? 0} {t.common.connected.toLowerCase()}
                </Badge>
              )}
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-white/10 bg-zinc-900 text-zinc-300 hover:text-white text-xs h-9 px-4 rounded-xl cursor-pointer"
          >
            {sf.closeBtn}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
