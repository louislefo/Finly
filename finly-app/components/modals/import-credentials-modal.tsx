"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { BankLogo } from "@/components/ui/bank-icons"
import { FinlyAPI } from "@/lib/api/finly-api"
import { Lock, Smartphone, ShieldCheck, Loader2 } from "lucide-react"

export interface PendingBankConnection {
  id?: string
  backend_name?: string
  module_name: string
  bank_name: string
  login: string
}

interface ImportCredentialsModalProps {
  isOpen: boolean
  onClose: () => void
  pendingConnections: PendingBankConnection[]
  onSuccess?: () => void
}

export function ImportCredentialsModal({
  isOpen,
  onClose,
  pendingConnections,
  onSuccess,
}: ImportCredentialsModalProps) {
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [login, setLogin] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const [is2FARequired, setIs2FARequired] = useState<boolean>(false)

  const currentConn = pendingConnections[currentIndex]

  React.useEffect(() => {
    if (currentConn) {
      setLogin(currentConn.login || "")
      setPassword("")
      setErrorMessage(null)
      setStatusMessage(null)
      setIs2FARequired(false)
    }
  }, [currentConn, currentIndex])

  if (!currentConn) return null

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim() || !login.trim()) {
      setErrorMessage("Veuillez renseigner votre identifiant et mot de passe.")
      return
    }

    setIsLoading(true)
    setErrorMessage(null)
    setStatusMessage("Authentification auprès de la banque...")

    try {
      const res = await FinlyAPI.connectWoobBank({
        module: currentConn.module_name,
        login: login.trim(),
        password: password.trim(),
        custom_params: currentConn.backend_name ? { backend_name: currentConn.backend_name } : undefined,
      })

      if (res.status === "2fa_required") {
        setIs2FARequired(true)
        setStatusMessage(res.message || "Validation requise sur l'application mobile de votre banque.")
        setIsLoading(false)
        return
      }

      setIsLoading(false)

      if (currentIndex + 1 < pendingConnections.length) {
        setCurrentIndex((prev) => prev + 1)
      } else {
        if (onSuccess) onSuccess()
        onClose()
      }
    } catch (err: any) {
      setIsLoading(false)
      setErrorMessage(err.message || "Identifiant ou mot de passe incorrect.")
    }
  }

  const handleSkip = () => {
    if (currentIndex + 1 < pendingConnections.length) {
      setCurrentIndex((prev) => prev + 1)
    } else {
      if (onSuccess) onSuccess()
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-6 max-w-md">
        <DialogHeader className="p-0 text-left">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-indigo-400" />
              Accès bancaire
            </DialogTitle>
            {pendingConnections.length > 1 && (
              <Badge variant="outline" className="border-white/10 text-zinc-400 text-xs">
                {currentIndex + 1} / {pendingConnections.length}
              </Badge>
            )}
          </div>
          <DialogDescription className="text-xs text-zinc-400 mt-1">
            Renseignez le mot de passe pour activer la synchronisation automatique en direct.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleConnect} className="flex flex-col gap-4 mt-2">
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-zinc-950 border border-white/5">
            <div className="w-10 h-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-white/5 shrink-0">
              <BankLogo bankName={currentConn.bank_name} className="w-6 h-6" />
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-white truncate">{currentConn.bank_name}</span>
              <span className="text-xs text-zinc-400 font-mono truncate">{currentConn.module_name}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">Identifiant</label>
            <Input
              type="text"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="Numéro de compte ou identifiant"
              className="bg-zinc-950 border-white/10 text-white text-xs h-10 rounded-xl focus-visible:ring-indigo-500"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">Mot de passe</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mot de passe ou code secret"
              className="bg-zinc-950 border-white/10 text-white text-xs h-10 rounded-xl focus-visible:ring-indigo-500"
              autoFocus
              required
            />
            <span className="text-[11px] text-zinc-500 flex items-center gap-1 mt-0.5">
              <Lock className="w-3 h-3 text-emerald-500" />
              Chiffré localement en AES-256
            </span>
          </div>

          {is2FARequired && (
            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-xs flex items-center gap-2.5">
              <Smartphone className="w-4 h-4 shrink-0 text-indigo-400 animate-pulse" />
              <span>{statusMessage}</span>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 rounded-xl shadow-md shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connexion...</span>
                </>
              ) : (
                <span>Activer la synchronisation</span>
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={handleSkip}
              className="border-white/10 bg-zinc-900 text-zinc-400 hover:text-white text-xs h-10 rounded-xl cursor-pointer"
            >
              Plus tard
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}