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
  XCircle,
  Activity,
  Layers,
  RotateCcw,
  SlidersHorizontal,
  HardDrive,
  UserCheck,
  UserX,
  Eye,
} from "lucide-react"
import { useAuth } from "@/components/auth-context"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
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
  const { t, language } = useI18n()

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
        message: err.message || (language === "fr" ? "Erreur lors du chargement des données d'administration." : "Error loading admin data."),
      })
    } finally {
      setIsLoadingData(false)
    }
  }, [language])

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
          <h2 className="text-lg font-bold text-white">{t.admin.restrictedAccess}</h2>
          <p className="text-xs text-zinc-400">{t.admin.restrictedAccessDesc}</p>
        </div>
        <Button
          onClick={() => router.push("/")}
          className="mt-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs rounded-xl"
        >
          {t.admin.backToDashboard}
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
        message: language === "fr" ? `Compte ${targetUser.email} ${newStatus ? "activé" : "désactivé"}.` : `Account ${targetUser.email} ${newStatus ? "activated" : "disabled"}.`,
      })
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || (language === "fr" ? "Erreur lors de la modification du statut." : "Error modifying status."),
      })
    }
  }

  const handleToggleRole = async (targetUser: AdminUserItem) => {
    const newRole = targetUser.role === "admin" ? "member" : "admin"
    try {
      await FinlyAPI.updateAdminUser(targetUser.id, { role: newRole })
      setActionFeedback({
        type: "success",
        message: language === "fr" ? `Rôle de ${targetUser.email} mis à jour (${newRole}).` : `Role for ${targetUser.email} updated to (${newRole}).`,
      })
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || (language === "fr" ? "Erreur lors de la modification du rôle." : "Error modifying role."),
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
        message: language === "fr" ? `Mot de passe réinitialisé pour ${userToResetPassword.email}.` : `Password reset for ${userToResetPassword.email}.`,
      })
      setUserToResetPassword(null)
      setNewPasswordValue("")
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || (language === "fr" ? "Erreur lors de la réinitialisation." : "Error resetting password."),
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
        message: language === "fr" ? `Utilisateur ${userToDelete.email} supprimé.` : `User ${userToDelete.email} deleted.`,
      })
      setUserToDelete(null)
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || (language === "fr" ? "Erreur lors de la suppression." : "Error deleting user."),
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
        message: err.message || (language === "fr" ? "Erreur lors du déclenchement de la synchronisation." : "Error triggering bank sync."),
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
        message: language === "fr" ? `Base optimisée (${res.database_size_mb} Mo).` : `Database optimized (${res.database_size_mb} MB).`,
      })
      await loadData()
    } catch (err: any) {
      setActionFeedback({
        type: "error",
        message: err.message || (language === "fr" ? "Erreur lors de l'optimisation VACUUM." : "Error during VACUUM optimization."),
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
          <span className="text-xs text-zinc-400 font-mono">Finly Admin v{stats?.system.version || "1.0.0"}</span>
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
            {t.admin.overviewTab}
          </button>
          <button
            onClick={() => setActiveTab("users")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "users"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.admin.usersTab} ({usersList.length})
          </button>
          <button
            onClick={() => setActiveTab("maintenance")}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              activeTab === "maintenance"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {t.admin.maintenanceTab}
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
            {t.common.close}
          </button>
        </div>
      )}

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* KPI 1: Users */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">{t.admin.usersMetric}</span>
              <Users className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.metrics.total_users ?? "-"}</span>
              <span className="text-xs text-emerald-400">
                {stats?.metrics.active_users ?? 0} {t.admin.activeUsersCount}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t.admin.adminUsersCount}</span>
              <span className="text-white font-semibold">{stats?.metrics.admin_users ?? 0}</span>
            </div>
          </Card>

          {/* KPI 2: Accounts & Banks */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">{t.admin.banksAndAccountsMetric}</span>
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.metrics.total_accounts ?? "-"}</span>
              <span className="text-xs text-zinc-400">{t.admin.accountsCount}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t.admin.activeBankConnections}</span>
              <span className="text-white font-semibold">{stats?.metrics.total_bank_connections ?? 0}</span>
            </div>
          </Card>

          {/* KPI 3: Transactions & Balance */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">{t.admin.transactionsAndVolumeMetric}</span>
              <Activity className="w-4 h-4 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.metrics.total_transactions ?? "-"}</span>
              <span className="text-xs text-zinc-400">{t.transactions.operationsCount}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t.admin.totalAssetVolume}</span>
              <span className="text-white font-semibold">
                {formatAmount(stats?.metrics.total_balance ?? 0)}
              </span>
            </div>
          </Card>

          {/* KPI 4: Projects & Budgets */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">{t.admin.budgetsAndProjectsMetric}</span>
              <SlidersHorizontal className="w-4 h-4 text-blue-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">
                {(stats?.metrics.total_budgets ?? 0) + (stats?.metrics.total_projects ?? 0)}
              </span>
              <span className="text-xs text-zinc-400">{language === "fr" ? "enveloppes et cibles" : "targets & envelopes"}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>Budgets / Projects</span>
              <span className="text-white font-semibold">
                {stats?.metrics.total_budgets ?? 0} / {stats?.metrics.total_projects ?? 0}
              </span>
            </div>
          </Card>

          {/* KPI 5: Database Storage */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">{t.admin.databaseMetric}</span>
              <Database className="w-4 h-4 text-purple-400" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white">{stats?.system.database_size_mb ?? "0"}</span>
              <span className="text-xs text-zinc-400">MB</span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t.admin.storageEngine}</span>
              <span className="text-white font-semibold">SQLite (WAL)</span>
            </div>
          </Card>

          {/* KPI 6: Background Scheduler */}
          <Card className="p-5 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex items-center justify-between text-zinc-400 mb-3">
              <span className="text-xs font-medium uppercase tracking-wider">{t.admin.schedulerMetric}</span>
              <RotateCcw className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  stats?.system.scheduler_running ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                }`}
              />
              <span className="text-base font-bold text-white">
                {stats?.system.scheduler_running ? t.admin.schedulerRunning : t.admin.schedulerStopped}
              </span>
            </div>
            <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-400">
              <span>{t.admin.refreshInterval}</span>
              <span className="text-white font-semibold">{language === "fr" ? `Toutes les ${stats?.system.sync_interval_hours ?? 6}h` : `Every ${stats?.system.sync_interval_hours ?? 6}h`}</span>
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
                placeholder={t.admin.searchUsersPlaceholder}
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
                    <th className="px-4 py-3">{t.admin.userColumn}</th>
                    <th className="px-4 py-3">{t.admin.roleColumn}</th>
                    <th className="px-4 py-3">{t.admin.statusColumn}</th>
                    <th className="px-4 py-3">{t.admin.accountsColumn}</th>
                    <th className="px-4 py-3">{t.admin.transactionsColumn}</th>
                    <th className="px-4 py-3">{t.admin.totalBalanceColumn}</th>
                    <th className="px-4 py-3 text-right">{t.admin.actionsColumn}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                        {language === "fr" ? "Aucun utilisateur trouvé." : "No users found."}
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
                                  <span className="text-[10px] text-indigo-400 font-normal">({t.admin.youBadge})</span>
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
                              {u.role === "admin" ? t.admin.adminRole : t.admin.memberRole}
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
                              {u.is_active ? t.admin.activeStatus : t.admin.inactiveStatus}
                            </Badge>
                          </td>

                          <td className="px-4 py-3.5 text-zinc-300">
                            {u.accounts_count} ({u.bank_connections_count} {language === "fr" ? "banques" : "banks"})
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
                                  title={t.admin.viewDashboardAction}
                                  className="h-7 px-2 text-indigo-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg flex items-center gap-1.5 text-[10px] font-medium cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{t.admin.viewDashboardAction}</span>
                                </Button>
                              )}

                              {/* Toggle Role Button */}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleToggleRole(u)}
                                title={u.role === "admin" ? t.admin.demoteAction : t.admin.promoteAction}
                                className="h-7 px-2 text-zinc-400 hover:text-white hover:bg-white/5 rounded-lg cursor-pointer"
                              >
                                {u.role === "admin" ? (
                                  <span className="text-[10px]">{t.admin.demoteAction}</span>
                                ) : (
                                  <span className="text-[10px] text-amber-400">{t.admin.promoteAction}</span>
                                )}
                              </Button>

                              {/* Toggle Active Button */}
                              {!isSelf && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleToggleActive(u)}
                                  title={u.is_active ? t.admin.deactivateAction : t.admin.activateAction}
                                  className={`h-7 w-7 p-0 rounded-lg cursor-pointer ${
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
                                title={t.admin.resetPasswordAction}
                                className="h-7 w-7 p-0 text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 rounded-lg cursor-pointer"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </Button>

                              {/* Delete User Button */}
                              {!isSelf && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setUserToDelete(u)}
                                  title={t.admin.deleteUserAction}
                                  className="h-7 w-7 p-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg cursor-pointer"
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
                <h3 className="text-sm font-bold text-white">{t.admin.globalBankSyncTitle}</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t.admin.globalBankSyncDesc}
              </p>
            </div>
            <div className="mt-6">
              <Button
                onClick={handleTriggerSyncAll}
                disabled={isSyncingAll}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold h-9 rounded-xl shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncingAll ? "animate-spin" : ""}`} />
                <span>{isSyncingAll ? t.common.syncing : t.admin.triggerSyncBtn}</span>
              </Button>
            </div>
          </Card>

          {/* Card 2: SQLite Vacuum */}
          <Card className="p-6 bg-[#18181B] border-white/10 rounded-2xl flex flex-col justify-between">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2.5">
                <HardDrive className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">{t.admin.sqliteMaintenanceTitle}</h3>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                {t.admin.sqliteMaintenanceDesc}
              </p>
            </div>
            <div className="mt-6">
              <Button
                onClick={handleTriggerVacuum}
                disabled={isVacuuming}
                variant="outline"
                className="w-full border-white/10 bg-zinc-900 hover:bg-zinc-800 text-white text-xs font-semibold h-9 rounded-xl flex items-center justify-center gap-2 cursor-pointer"
              >
                <HardDrive className={`w-3.5 h-3.5 ${isVacuuming ? "animate-spin" : ""}`} />
                <span>{isVacuuming ? t.common.loading : t.admin.vacuumBtn}</span>
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
              {t.admin.resetPasswordModalTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-2">
            <p className="text-xs text-zinc-400">
              {language === "fr" ? `Définir un nouveau mot de passe pour l'utilisateur ` : `Set a new password for user `}
              <span className="text-white font-semibold">{userToResetPassword?.email}</span>.
            </p>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-300 font-medium">{t.accounts.newPassword}</label>
              <Input
                type="password"
                placeholder={language === "fr" ? "Au moins 6 caractères" : "At least 6 characters"}
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
              className="text-xs text-zinc-400 hover:text-white rounded-xl cursor-pointer"
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleResetPasswordSubmit}
              disabled={isResettingPassword || newPasswordValue.length < 6}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              {isResettingPassword ? t.common.loading : t.common.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Delete User Confirmation */}
      <Dialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
        <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-400">
              {t.admin.deleteUserModalTitle}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3 py-2">
            <p className="text-xs text-zinc-300 leading-relaxed">
              {language === "fr" ? `Êtes-vous sûr de vouloir supprimer définitivement le compte de ` : `Are you sure you want to permanently delete the account of `}
              <span className="text-white font-bold">{userToDelete?.email}</span> ?
            </p>
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] leading-relaxed">
              {t.admin.deleteUserModalDesc}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="ghost"
              onClick={() => setUserToDelete(null)}
              className="text-xs text-zinc-400 hover:text-white rounded-xl cursor-pointer"
            >
              {t.common.cancel}
            </Button>
            <Button
              onClick={handleDeleteUserSubmit}
              disabled={isDeletingUser}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold rounded-xl cursor-pointer"
            >
              {isDeletingUser ? t.common.loading : t.admin.deleteUserAction}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
