"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, KeyRound, Check } from "lucide-react"
import { FinlyAPI } from "@/lib/api/finly-api"
import { useI18n } from "@/components/i18n-context"

interface ChangePasswordModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const { t } = useI18n()
  const tc = t.common
  const tm = t.changePasswordModal
  const [currentPassword, setCurrentPassword] = useState<string>("")
  const [newPassword, setNewPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (newPassword.length < 6) {
      setErrorMsg(tm.errorMinLength)
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg(tm.errorMismatch)
      return
    }

    setIsLoading(true)
    try {
      await FinlyAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setSuccessMsg(tm.success)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
      setTimeout(() => {
        onClose()
        setSuccessMsg(null)
      }, 1500)
    } catch (err: any) {
      setErrorMsg(err.message || tc.error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    setErrorMsg(null)
    setSuccessMsg(null)
    setCurrentPassword("")
    setNewPassword("")
    setConfirmPassword("")
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl">
        <DialogHeader className="p-0 text-left">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <KeyRound className="w-4 h-4 text-indigo-400" />
            {tm.title}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 mt-2">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              {tm.currentPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="password"
                required
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              {tm.newPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="password"
                required
                minLength={6}
                placeholder={tm.minCharacters}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              {tm.confirmPasswordLabel}
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="password"
                required
                minLength={6}
                placeholder={tm.repeatPassword}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 rounded-xl font-semibold cursor-pointer shadow-md shadow-indigo-600/30"
            >
              {isLoading ? tc.saving : tc.save}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 rounded-xl cursor-pointer"
            >
              {tc.cancel}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
