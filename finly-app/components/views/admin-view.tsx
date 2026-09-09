"use client"

import React, { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import {
  ShieldCheck,
  Users,
  Database,
  RefreshCw,
  Search,
  KeyRound,
  Trash2,
  CheckCircle2,
  XCircle,
  Activity,
  Layers,
  ArrowRight,
  RotateCcw,
  SlidersHorizontal,
  HardDrive,
  UserCheck,
  UserX,
  Eye,
} from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { usePrivacy } from "@/components/privacy-context"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { FinlyAPI } from "@/lib/api/finly-api"
import { AdminStats, AdminUserItem } from "@/lib/types/finance"

export function AdminView() {
  const router = useRouter()
  const { user, isLoading: authLoading, impersonateUser } = useAuth()
  const { formatAmount } = usePrivacy()

  // State
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "maintenance">("overview")
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [usersList, setUsersList] = useState<AdminUserItem[]>([])
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true)
  const [actionFeedback, setActionFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null)

  // Maintenance actions loading states
  const [isSyncingAll, setIsSyncingAll] = useState<boolean>(false)
  const [isVacuuming, setIsVacuuming] = useState<boolean>(false)

  // User Modals State
  const [userToResetPassword, setUserToResetPassword] = useState<AdminUserItem | null>(null)
  const [newPasswordValue, setNewPasswordValue] = useState<string>("")
  const [isResettingPassword, setIsResettingPassword] = useState<boolean>(false)

  const [userToDelete, setUserToDelete] = useState<AdminUserItem | null>(null)
  const [isDeletingUser, setIsDeletingUser] = useState<boolean>(false)

  const loadData = useCallback(async () => {
    setIsLoadingData(true)
    try {
      const [statsRes, usersRes] = await Promise.all([
        FinlyAPI.getAdminStats(),
        FinlyAPI.getAdminUsers(),
      ])
      setStats(statsRes)
      setUsersList(usersRes.users || [])
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Erreur lors du chargement des données d'administration.",
      })
    } finally {
      setIsLoadingData(false)
    }
  }, [])

  useEffect(() => {
    if (!authLoading && user && user.role === "admin") {
      loadData()
    }
  }, [authLoading, user, loadData])

  // Clear feedback after 5 seconds
  useEffect(() => {
    if (actionFeedback) {
      const timer = setTimeout(() => setActionFeedback(null), 5000)
      return () => clearTimeout(timer)
    }
  }, [actionFeedback])

  // Filtered users
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return usersList
    const q = searchQuery.toLowerCase().trim()
    return usersList.filter(
      (u) =>
        u.email.toLowerCase().includes(q) ||
        u.full_name.toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q)
    )
  }, [usersList, searchQuery])

  // Guard: Not logged in or not admin
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <RefreshCw className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  if (!user || user.role !== "admin") {
    return (
      <div className="max-w-md mx-auto mt-20 p-6 rounded-3xl bg-[#18181B] border border-white/10 text-center flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
          <XCircle className="w-6 h-6" />
        </div>
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-bold text-white">Accès restreint</h2>
          <p className="text-xs text-zinc-400">Ce panneau est réservé aux administrateurs de la plateforme.</p>
        </div>
        <Button
          onClick={() => router.push("/")}
          className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-xl"
        >
          Retour au tableau de bord
        </Button>
      </div>
    )
  }

  // Handlers
  const handleToggleActive = async (targetUser: AdminUserItem) => {
    try {
      const newStatus = !targetUser.is_active
      await FinlyAPI.updateAdminUser(targetUser.id, { is_active: newStatus })
      setActionFeedback({
        type: "success",
        message: `Compte ${targetUser.email} ${newStatus ? "activé" : "désactivé"}.`,
      })
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Erreur lors de la modification du statut.",
      })
    }
  }

  const handleToggleRole = async (targetUser: AdminUserItem) => {
    const newRole = targetUser.role === "admin" ? "member" : "admin"
    try {
      await FinlyAPI.updateAdminUser(targetUser.id, { role: newRole })
      setActionFeedback({
        type: "success",
        message: `Rôle de ${targetUser.email} mis à jour (${newRole}).`,
      })
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Erreur lors de la modification du rôle.",
      })
    }
  }

  const handleResetPasswordSubmit = async () => {
    if (!userToResetPassword || !newPasswordValue.trim()) return
    setIsResettingPassword(true)
    try {
      await FinlyAPI.resetAdminUserPassword(userToResetPassword.id, newPasswordValue)
      setActionFeedback({
        type: "success",
        message: `Mot de passe réinitialisé pour ${userToResetPassword.email}.`,
      })
      setUserToResetPassword(null)
      setNewPasswordValue("")
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Erreur lors de la réinitialisation.",
      })
    } finally {
      setIsResettingPassword(false)
    }
  }

  const handleDeleteUserSubmit = async () => {
    if (!userToDelete) return
    setIsDeletingUser(true)
    try {
      await FinlyAPI.deleteAdminUser(userToDelete.id)
      setActionFeedback({
        type: "success",
        message: `Utilisateur ${userToDelete.email} supprimé.`,
      })
      setUserToDelete(null)
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Erreur lors de la suppression.",
      })
    } finally {
      setIsDeletingUser(false)
    }
  }

  const handleTriggerSyncAll = async () => {
    setIsSyncingAll(true)
    try {
      const res = await FinlyAPI.triggerAdminSyncAll()
      setActionFeedback({
        type: "success",
        message: res.message,
      })
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Erreur lors du déclenchement de la synchronisation.",
      })
    } finally {
      setIsSyncingAll(false)
    }
  }

  const handleTriggerVacuum = async () => {
    setIsVacuuming(true)
    try {
      const res = await FinlyAPI.triggerAdminVacuum()
      setActionFeedback({
        type: "success",
        message: `Base optimisée (${res.database_size_mb} Mo).`,
      })
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || "Erreur lors de l'optimisation VACUUM.",
      })
    } finally {
      setIsVacuuming(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto flex flex-col gap-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <h1 className="text-xl font-bold tracking-tight text-white">Administration</h1>
            <span className="text-xs text-zinc-400">Finly v{stats?.system.version || "1.0.0"}</span>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 bg-zinc-900/80 p-1 rounded-xl border border-white/10 self-start sm:self-auto">
          <button
            onClick={() => setActiveTab("overview")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "overview"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Vue Globale
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "users"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Utilisateurs ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab("maintenance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "maintenance"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Maintenance
          </button>
        </div>
      </div>

      {/* Feedback Banner */}
      {actionFeedback && (
        <div
          className={`p-3 rounded-2xl text-xs flex items-center justify-between transition-all ${
            actionFeedback.type === "success"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-300"
              : "bg-rose-500/10 border border-rose-500/20 text-rose-300"
          }`}
        >
          <span>{actionFeedback.message}</span>
          <button
            onClick={() => setActionFeedback(null)}
            className="text-zinc-400 hover:text-white text-xs cursor-pointer ml-4"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* KPI 1: Users */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Utilisateurs</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.metrics.total_users ?? "-"}</span>
              <span className="text-xs text-emerald-400">
                {stats?.metrics.active_users ?? 0} actifs
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Administrateurs</span>
              <span className="text-white font-semibold">{stats?.metrics.admin_users ?? 0}</span>
            </div>
          </Card>

          {/* KPI 2: Accounts & Banks */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Banques & Comptes</span>
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.metrics.total_accounts ?? "-"}</span>
              <span className="text-xs text-zinc-400">comptes</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Connexions bancaires actives</span>
              <span className="text-white font-semibold">{stats?.metrics.total_bank_connections ?? 0}</span>
            </div>
          </Card>

          {/* KPI 3: Transactions & Balance */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Transactions & Volume</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.metrics.total_transactions ?? "-"}</span>
              <span className="text-xs text-zinc-400">opérations</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Volume d&apos;actifs total</span>
              <span className="text-white font-semibold">
                {formatAmount(stats?.metrics.total_balance ?? 0)}
              </span>
            </div>
          </Card>

          {/* KPI 4: Projects & Budgets */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Budgets & Projets</span>
              <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {(stats?.metrics.total_budgets ?? 0) + (stats?.metrics.total_projects ?? 0)}
              </span>
              <span className="text-xs text-zinc-400">enveloppes et cibles</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Budgets / Projets</span>
              <span className="text-white font-semibold">
                {stats?.metrics.total_budgets ?? 0} / {stats?.metrics.total_projects ?? 0}
              </span>
            </div>
          </Card>

          {/* KPI 5: Database Storage */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Base de Données</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.system.database_size_mb ?? "0"}</span>
              <span className="text-xs text-zinc-400">Mo</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Moteur de stockage</span>
              <span className="text-white font-semibold">SQLite (WAL)</span>
            </div>
          </Card>

          {/* KPI 6: Background Scheduler */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">Planificateur (Cron)</span>
              <RotateCcw className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stats?.system.scheduler_running ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                }`}
              />
              <span className="text-base font-bold text-white">
                {stats?.system.scheduler_running ? "En exécution" : "Arrêté"}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Intervalle de rafraîchissement</span>
              <span className="text-white font-semibold">Toutes les {stats?.system.sync_interval_hours ?? 6}h</span>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 2: Users Management */}
      {activeTab === "users" && (
        <div className="flex flex-col gap-4">
          {/* Search bar */}
          <div className="flex items-center justify-between gap-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <Input
                type="text"
                placeholder="Rechercher par email ou nom..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-zinc-900/80 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>
            <Button
              onClick={loadData}
              variant="outline"
              size="sm"
              disabled={isLoadingData}
              className="border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs rounded-xl"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {/* Users Table */}
          <Card className="bg-[#18181B] border-white/10 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-900/60 text-zinc-400 uppercase tracking-wider font-semibold text-[10px] border-b border-white/5">
                  <tr>
                    <th className="px-4 py-3">Utilisateur</th>
                    <th className="px-4 py-3">Rôle</th>
                    <th className="px-4 py-3">Statut</th>
                    <th className="px-4 py-3">Comptes</th>
                    <th className="px-4 py-3">Transactions</th>
                    <th className="px-4 py-3">Solde Total</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        Aucun utilisateur trouvé.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const isSelf = u.id === user.id
                      return (
                        <tr key={u.id} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <span className="font-semibold text-white flex items-center gap-1.5">
                                {u.full_name}
                                {isSelf && (
                                  <span className="text-[10px] text-indigo-400 font-normal">(Vous)</span>
                                )}
                              </span>
                              <span className="text-[11px] text-zinc-400">{u.email}</span>
                            </div>
                          </td>

                          <td className="px-4 py-3.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold border-0 ${
                                u.role === "admin"
                                  ? "bg-amber-500/10 text-amber-300"
                                  : "bg-zinc-800 text-zinc-300"
                              }`}
                            >
                              {u.role === "admin" ? "Admin" : "Membre"}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5">
                            <Badge
                              variant="outline"
                              className={`text-[10px] font-semibold border-0 ${
                                u.is_active
                                  ? "bg-emerald-500/10 text-emerald-300"
                                  : "bg-rose-500/10 text-rose-300"
                              }`}
                            >
                              {u.is_active ? "Actif" : "Désactivé"}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 text-zinc-300">
                            {u.accounts_count} ({u.bank_connections_count} banques)
                          </td>

                          <td className="px-4 py-3.5 text-zinc-300">
                            {u.transactions_count}
                          </td>

                          <td className="px-4 py-3.5 font-medium text-white">
                            {formatAmount(u.total_balance)}
                          </td>

                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Impersonate User Button */}
                              {!isSelf && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => impersonateUser(u.id)}
                                  title="Passer en mode utilisateur (voir son dashboard)"
                                  className="h-7 px-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg flex items-center gap-1.5 text-[10px] font-medium"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Voir dashboard</span>
                                </Button>
                              )}

                              {/* Toggle Role Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleToggleRole(u)}
                                title={u.role === "admin" ? "Rétrograder en membre" : "Promouvoir en administrateur"}
                                className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg"
                              >
                                {u.role === "admin" ? (
                                  <span className="text-[10px]">Rétrograder</span>
                                ) : (
                                  <span className="text-[10px] text-amber-400">Promouvoir</span>
                                )}
                              </Button>

                              {/* Toggle Active Button */}
                              {!isSelf && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleActive(u)}
                                  title={u.is_active ? "Désactiver le compte" : "Activer le compte"}
                                  className={`h-7 w-7 p-0 rounded-lg ${
                                    u.is_active
                                      ? "text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10"
                                      : "text-emerald-400 hover:bg-emerald-500/10"
                                  }`}
                                >
                                  {u.is_active ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                                </Button>
                              )}

                              {/* Reset Password Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setUserToResetPassword(u)
                                  setNewPasswordValue("")
                                }}
                                title="Réinitialiser le mot de passe"
                                className="h-7 w-7 p-0 text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </Button>

                              {/* Delete User Button */}
                              {!isSelf && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setUserToDelete(u)}
                                  title="Supprimer définitivement"
                                  className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Tab 3: Maintenance & Tools */}
      {activeTab === "maintenance" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Bank Sync Trigger */}
          <Card className="p-6 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <RefreshCw className="w-4 h-4 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">Synchronisation Bancaire Globale</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Déclenche immédiatement la récupération des comptes et transactions pour l&apos;ensemble des établissements connectés.
              </p>
            </div>
            <div className="mt-6">
              <Button
                onClick={handleTriggerSyncAll}
                disabled={isSyncingAll}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9 rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin" : ""}`} />
                <span>{isSyncingAll ? "Synchronisation en cours..." : "Lancer la synchronisation"}</span>
              </Button>
            </div>
          </Card>

          {/* Card 2: SQLite Vacuum */}
          <Card className="p-6 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Maintenance Base SQLite</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Exécute l&apos;instruction VACUUM pour compacter le fichier de base de données, défragmenter les pages et reconstruire les index.
              </p>
            </div>
            <div className="mt-6">
              <Button
                onClick={handleTriggerVacuum}
                disabled={isVacuuming}
                variant="outline"
                className="w-full border-white/10 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold h-9 rounded-xl flex items-center justify-center gap-2"
              >
                <HardDrive className={`w-3.5 h-3.5 ${isVacuuming ? "animate-spin" : ""}`} />
                <span>{isVacuuming ? "Optimisation en cours..." : "Compacter la base (VACUUM)"}</span>
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Modal: Reset Password */}
      <Dialog open={!!userToResetPassword} onOpenChange={(open) => !open && setUserToResetPassword(null)}>
        <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-white">
              Réinitialiser le mot de passe
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-xs text-zinc-400">
              Définir un nouveau mot de passe pour l&apos;utilisateur <span className="text-white font-semibold">{userToResetPassword?.email}</span>.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-300 font-medium">Nouveau mot de passe</label>
              <Input
                type="password"
                placeholder="Au moins 6 caractères"
                value={newPasswordValue}
                onChange={(e) => setNewPasswordValue(e.target.value)}
                className="bg-zinc-900/80 border-white/10 text-white text-xs h-10 rounded-xl"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="ghost"
              onClick={() => setUserToResetPassword(null)}
              className="text-xs text-zinc-400 hover:text-white rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleResetPasswordSubmit}
              disabled={isResettingPassword || newPasswordValue.length < 6}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl"
            >
              {isResettingPassword ? "Enregistrement..." : "Confirmer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Delete User Confirmation */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-400">
              Supprimer l&apos;utilisateur
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs text-zinc-300 leading-relaxed">
              Êtes-vous sûr de vouloir supprimer définitivement le compte de <span className="text-white font-bold">{userToDelete?.email}</span> ?
            </p>
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] leading-relaxed">
              Cette action est irréversible. L&apos;ensemble de ses comptes, transactions, budgets et connexions bancaires associées seront purgés.
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="ghost"
              onClick={() => setUserToDelete(null)}
              className="text-xs text-zinc-400 hover:text-white rounded-xl"
            >
              Annuler
            </Button>
            <Button
              onClick={handleDeleteUserSubmit}
              disabled={isDeletingUser}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl"
            >
              {isDeletingUser ? "Suppression..." : "Supprimer définitivement"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
