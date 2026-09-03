"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import {
  User as UserIcon,
  Mail,
  Lock,
  KeyRound,
  ShieldCheck,
  Check,
  LogOut,
  ArrowLeft,
  Download,
  FileSpreadsheet,
  FileCode,
  HardDrive,
  RefreshCw,
  Database,
} from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { Card, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FinlyAPI } from "@/lib/api/finly-api"
import { executeExport } from "@/lib/export/excel-export"

export function AccountView() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState<string>("")
  const [newPassword, setNewPassword] = useState<string>("")
  const [confirmPassword, setConfirmPassword] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  // Export states
  const [isExportingExcel, setIsExportingExcel] = useState<boolean>(false)
  const [isExportingJSON, setIsExportingJSON] = useState<boolean>(false)
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null)

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U"

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setSuccessMsg(null)

    if (newPassword.length < 6) {
      setErrorMsg("Le nouveau mot de passe doit comporter au moins 6 caractères.")
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("La confirmation ne correspond pas au nouveau mot de passe.")
      return
    }

    setIsLoading(true)
    try {
      await FinlyAPI.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      })
      setSuccessMsg("Votre mot de passe a été modifié avec succès.")
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la modification du mot de passe.")
    } finally {
      setIsLoading(false)
    }
  }

  // Export full JSON backup
  const handleExportJSON = async () => {
    setIsExportingJSON(true)
    setExportSuccessMsg(null)
    try {
      const [accRes, txRes, projRes, catRes, budRes] = await Promise.all([
        FinlyAPI.getAccounts(),
        FinlyAPI.getTransactions(),
        FinlyAPI.getProjects(),
        FinlyAPI.getCategories(),
        FinlyAPI.getBudgets(),
      ])

      const backupData = {
        metadata: {
          app: "Finly",
          version: "1.0.0",
          exported_at: new Date().toISOString(),
          user: {
            id: user?.id,
            email: user?.email,
            full_name: user?.full_name,
          },
          summary: {
            total_accounts: accRes.accounts?.length || 0,
            total_transactions: txRes.transactions?.length || 0,
            total_balance: accRes.total_balance || 0,
          },
        },
        accounts: accRes.accounts || [],
        transactions: txRes.transactions || [],
        projects: projRes || [],
        categories: catRes || [],
        budgets: budRes || {},
      }

      const jsonStr = JSON.stringify(backupData, null, 2)
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      const dateStr = new Date().toISOString().split("T")[0]
      link.href = url
      link.download = `finly_sauvegarde_integrale_${dateStr}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccessMsg("Sauvegarde intégrale JSON générée et téléchargée.")
      setTimeout(() => setExportSuccessMsg(null), 4000)
    } catch (err: any) {
      setErrorMsg(err.message || "Erreur lors de la sauvegarde JSON.")
    } finally {
      setIsExportingJSON(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Top Bar with Back Button */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.back()}
          className="h-8 w-8 p-0 rounded-xl border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Mon Compte</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Paramètres du profil, sécurité, export des données et informations de session
          </p>
        </div>
      </div>

      {/* Profile Summary Card */}
      <Card className="p-6 border-white/10 bg-[#18181B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-3xl">
        <div className="flex items-center gap-4">
          <Avatar size="lg" className="w-14 h-14">
            <AvatarFallback className="bg-indigo-600 text-white font-bold text-lg">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-base font-bold text-white">{user?.full_name || "Utilisateur"}</span>
              <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[10px] py-0 px-2">
                Compte Actif
              </Badge>
            </div>
            <span className="text-xs text-zinc-400 mt-0.5">{user?.email}</span>
          </div>
        </div>

        <Button
          onClick={logout}
          variant="outline"
          size="sm"
          className="border-rose-500/20 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white h-9 px-3.5 gap-1.5 rounded-xl cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Se déconnecter</span>
        </Button>
      </Card>

      {/* Export & Data Backup Card (JSON Only) */}
      <Card className="p-6 border-white/10 bg-[#18181B] flex flex-col gap-4 rounded-3xl">
        <div className="flex items-center justify-between pb-2 border-b border-white/5">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-indigo-400" />
            <CardTitle className="text-sm font-semibold text-white">
              Export & Sauvegarde des Données (JSON)
            </CardTitle>
          </div>
          <Badge variant="outline" className="border-white/10 bg-zinc-900 text-zinc-400 text-[10px] font-mono">
            RGPD & Portabilité
          </Badge>
        </div>

        <p className="text-xs text-zinc-400 leading-relaxed max-w-2xl">
          Téléchargez une copie complète et structurée au format JSON de l&apos;intégralité de vos données financières (soldes, comptes, historique de transactions, budgets, catégories et projets d&apos;épargne). Ce fichier peut être réimporté à tout moment depuis le menu &quot;Ajouter une banque&quot;.
        </p>

        {exportSuccessMsg && (
          <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{exportSuccessMsg}</span>
          </div>
        )}

        <div className="pt-1">
          <Button
            onClick={handleExportJSON}
            disabled={isExportingJSON}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-11 px-6 rounded-2xl font-semibold gap-2 cursor-pointer shadow-md shadow-indigo-600/20"
          >
            {isExportingJSON ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Génération de la sauvegarde...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Exporter toutes mes données (.json)</span>
              </>
            )}
          </Button>
        </div>
      </Card>

      {/* Password & Security Card */}
      <Card className="p-6 border-white/10 bg-[#18181B] flex flex-col gap-4 rounded-3xl">
        <div className="flex items-center gap-2 pb-2 border-b border-white/5">
          <KeyRound className="w-4 h-4 text-indigo-400" />
          <CardTitle className="text-sm font-semibold text-white">
            Sécurité & Mot de Passe
          </CardTitle>
        </div>

        <form onSubmit={handleChangePassword} className="flex flex-col gap-4 max-w-lg">
          {errorMsg && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
              {errorMsg}
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Mot de passe actuel
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="password"
                required
                placeholder="••••••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/10 text-white text-xs h-10 sm:h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Au moins 6 caractères"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/10 text-white text-xs h-10 sm:h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-300">
              Confirmer le nouveau mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="password"
                required
                minLength={6}
                placeholder="Répétez le nouveau mot de passe"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="pl-9 bg-zinc-950 border-white/10 text-white text-xs h-10 sm:h-11 rounded-xl"
              />
            </div>
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={isLoading}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 sm:h-11 px-5 rounded-xl font-semibold cursor-pointer shadow-md shadow-indigo-600/30"
            >
              {isLoading ? "Enregistrement..." : "Mettre à jour le mot de passe"}
            </Button>
          </div>
        </form>
      </Card>

      {/* Local Storage & Privacy Notice */}
      <Card className="p-4 border-white/10 bg-[#18181B] flex items-center justify-between gap-4 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-semibold text-white">Chiffrement AES-256</span>
            <span className="text-[11px] text-zinc-400">
              Vos identifiants bancaires et sessions sont chiffrés et stockés localement sur votre machine.
            </span>
          </div>
        </div>
      </Card>
    </div>
  )
}
