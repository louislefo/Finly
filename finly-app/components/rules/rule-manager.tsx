"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Wand2,
  Plus,
  Trash2,
  Edit2,
  Play,
  ArrowUp,
  ArrowDown,
  Search,
  Check,
  RefreshCw,
  AlertTriangle,
  Tag,
  Hash,
  Filter,
  CheckCircle2,
  Sliders,
  Layers,
  Building2,
  Eye,
  X,
} from "lucide-react"
import { FinlyAPI } from "@/lib/api/finly-api"
import {
  CategorizationRule,
  CategoryItem,
  Account,
  RuleMatchType,
  RuleApplyField,
  RuleAmountType,
  RuleTestResponse,
} from "@/lib/types/finance"
import { useI18n } from "@/components/i18n-context"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

interface RuleManagerProps {
  onRulesChanged?: () => void
  isModal?: boolean
  onClose?: () => void
  initialTransaction?: {
    raw_label?: string
    merchant_name?: string
    category?: string
    subcategory?: string
    amount?: number
    account_id?: string
  } | null
}

export function RuleManager({
  onRulesChanged,
  isModal = false,
  onClose,
  initialTransaction,
}: RuleManagerProps) {
  const { t, language } = useI18n()

  const [rules, setRules] = useState<CategorizationRule[]>([])
  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [accounts, setAccounts] = useState<Account[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")

  // Create / Edit modal state
  const [isEditorOpen, setIsEditorOpen] = useState<boolean>(false)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [ruleName, setRuleName] = useState<string>("")
  const [pattern, setPattern] = useState<string>("")
  const [matchType, setMatchType] = useState<RuleMatchType>("contains")
  const [applyToField, setApplyToField] = useState<RuleApplyField>("all")
  const [accountId, setAccountId] = useState<string>("")
  const [amountType, setAmountType] = useState<RuleAmountType>("any")
  const [minAmount, setMinAmount] = useState<string>("")
  const [maxAmount, setMaxAmount] = useState<string>("")
  const [category, setCategory] = useState<string>("Divers")
  const [subcategory, setSubcategory] = useState<string>("")
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState<string>("")
  const [isExcludedFromBudget, setIsExcludedFromBudget] = useState<boolean>(false)
  const [markAsTransfer, setMarkAsTransfer] = useState<boolean>(false)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)

  // Test rule preview state
  const [isTesting, setIsTesting] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<RuleTestResponse | null>(null)

  // Batch apply state
  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false)
  const [batchRuleId, setBatchRuleId] = useState<string | null>(null)
  const [overwriteManual, setOverwriteManual] = useState<boolean>(false)
  const [isApplyingBatch, setIsApplyingBatch] = useState<boolean>(false)

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<CategorizationRule | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  // Notification banners
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg)
    setTimeout(() => setSuccessMessage(null), 4000)
  }

  const showError = (msg: string) => {
    setErrorMessage(msg)
    setTimeout(() => setErrorMessage(null), 5000)
  }

  const loadData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [rulesList, catsList, accsList] = await Promise.all([
        FinlyAPI.getRules(),
        FinlyAPI.getCategories(),
        FinlyAPI.getAccounts(),
      ])
      setRules(rulesList)
      setCategories(catsList)
      setAccounts(accsList?.accounts || [])
    } catch (err: any) {
      showError(err.message || "Erreur lors du chargement des données.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle prefilling if an initial transaction was passed (e.g. from transaction detail)
  useEffect(() => {
    if (initialTransaction) {
      const initName = initialTransaction.merchant_name || initialTransaction.raw_label || "Nouvelle Règle"
      const initPattern = initialTransaction.merchant_name || initialTransaction.raw_label || ""
      setEditingRuleId(null)
      setRuleName(initName)
      setPattern(initPattern)
      setMatchType("contains")
      setApplyToField("all")
      setAccountId(initialTransaction.account_id || "")
      setAmountType(
        initialTransaction.amount
          ? initialTransaction.amount > 0
            ? "income"
            : "expense"
          : "any"
      )
      setMinAmount("")
      setMaxAmount("")
      setCategory(initialTransaction.category || "Divers")
      setSubcategory(initialTransaction.subcategory || "")
      setTags([])
      setTagInput("")
      setIsExcludedFromBudget(false)
      setMarkAsTransfer(false)
      setTestResult(null)
      setIsEditorOpen(true)
    }
  }, [initialTransaction])

  const openCreateModal = () => {
    setEditingRuleId(null)
    setRuleName("")
    setPattern("")
    setMatchType("contains")
    setApplyToField("all")
    setAccountId("")
    setAmountType("any")
    setMinAmount("")
    setMaxAmount("")
    setCategory(categories[0]?.name || "Alimentation")
    setSubcategory("")
    setTags([])
    setTagInput("")
    setIsExcludedFromBudget(false)
    setMarkAsTransfer(false)
    setTestResult(null)
    setIsEditorOpen(true)
  }

  const openEditModal = (rule: CategorizationRule) => {
    setEditingRuleId(rule.id)
    setRuleName(rule.name)
    setPattern(rule.pattern)
    setMatchType(rule.match_type || "contains")
    setApplyToField(rule.apply_to_field || "all")
    setAccountId(rule.account_id || "")
    setAmountType(rule.amount_type || "any")
    setMinAmount(rule.min_amount != null ? String(rule.min_amount) : "")
    setMaxAmount(rule.max_amount != null ? String(rule.max_amount) : "")
    setCategory(rule.category)
    setSubcategory(rule.subcategory || "")
    setTags(rule.tags || [])
    setTagInput("")
    setIsExcludedFromBudget(bool(rule.is_excluded_from_budget))
    setMarkAsTransfer(bool(rule.mark_as_transfer))
    setTestResult(null)
    setIsEditorOpen(true)
  }

  const bool = (val: any) => Boolean(val)

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      let clean = tagInput.trim().replace(/^,+|,+$/g, "")
      if (clean) {
        if (!clean.startsWith("#")) clean = `#${clean}`
        if (!tags.includes(clean)) {
          setTags((prev) => [...prev, clean])
        }
        setTagInput("")
      }
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove))
  }

  const handleTestRule = async () => {
    const cleanPattern = pattern.trim()
    if (!cleanPattern) {
      showError("Veuillez saisir un motif pour le test.")
      return
    }

    setIsTesting(true)
    try {
      const res = await FinlyAPI.testRule({
        pattern: cleanPattern,
        match_type: matchType,
        apply_to_field: applyToField,
        account_id: accountId || null,
        amount_type: amountType,
        min_amount: minAmount ? parseFloat(minAmount) : null,
        max_amount: maxAmount ? parseFloat(maxAmount) : null,
      })
      setTestResult(res)
    } catch (err: any) {
      showError(err.message || "Erreur lors du test de la règle.")
    } finally {
      setIsTesting(false)
    }
  }

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPattern = pattern.trim()
    if (!cleanPattern) {
      showError("Le motif de correspondance est obligatoire.")
      return
    }

    setIsSubmitting(true)
    try {
      const payload: Partial<CategorizationRule> = {
        name: ruleName.trim() || cleanPattern,
        pattern: cleanPattern,
        match_type: matchType,
        apply_to_field: applyToField,
        account_id: accountId || null,
        amount_type: amountType,
        min_amount: minAmount ? parseFloat(minAmount) : null,
        max_amount: maxAmount ? parseFloat(maxAmount) : null,
        category: category.trim() || "Divers",
        subcategory: subcategory.trim() || null,
        tags: tags.length > 0 ? tags : undefined,
        is_excluded_from_budget: isExcludedFromBudget,
        mark_as_transfer: markAsTransfer,
      }

      if (editingRuleId) {
        await FinlyAPI.updateRule(editingRuleId, payload)
        showSuccess(t.rules.ruleUpdatedSuccess)
      } else {
        await FinlyAPI.createRule(payload)
        showSuccess(t.rules.ruleCreatedSuccess)
      }

      await loadData()
      if (onRulesChanged) onRulesChanged()
      setIsEditorOpen(false)
    } catch (err: any) {
      showError(err.message || "Erreur lors de l'enregistrement de la règle.")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleToggleRule = async (ruleId: string) => {
    try {
      await FinlyAPI.toggleRule(ruleId)
      setRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, is_active: !r.is_active } : r))
      )
      showSuccess(t.rules.ruleToggledSuccess)
      if (onRulesChanged) onRulesChanged()
    } catch (err: any) {
      showError(err.message || "Erreur lors de la modification du statut.")
    }
  }

  const handleDeleteRule = async () => {
    if (!deleteTarget) return
    setIsDeleting(true)
    try {
      await FinlyAPI.deleteRule(deleteTarget.id)
      setRules((prev) => prev.filter((r) => r.id !== deleteTarget.id))
      showSuccess(t.rules.ruleDeletedSuccess)
      setDeleteTarget(null)
      if (onRulesChanged) onRulesChanged()
    } catch (err: any) {
      showError(err.message || "Erreur lors de la suppression.")
    } finally {
      setIsDeleting(false)
    }
  }

  const handleMovePriority = async (index: number, direction: "up" | "down") => {
    const targetIndex = direction === "up" ? index - 1 : index + 1
    if (targetIndex < 0 || targetIndex >= rules.length) return

    const newRules = [...rules]
    const temp = newRules[index]
    newRules[index] = newRules[targetIndex]
    newRules[targetIndex] = temp

    setRules(newRules)

    try {
      await FinlyAPI.reorderRules(newRules.map((r) => r.id))
    } catch (err: any) {
      showError("Erreur lors de la mise à jour de l'ordre.")
      loadData()
    }
  }

  const handleOpenBatchApply = (singleRuleId?: string) => {
    setBatchRuleId(singleRuleId || null)
    setOverwriteManual(false)
    setIsBatchModalOpen(true)
  }

  const handleExecuteBatchApply = async () => {
    setIsApplyingBatch(true)
    try {
      let res
      if (batchRuleId) {
        res = await FinlyAPI.applyRule(batchRuleId, {
          overwrite_user_classified: overwriteManual,
        })
      } else {
        res = await FinlyAPI.batchApplyRules({
          overwrite_user_classified: overwriteManual,
        })
      }

      showSuccess(
        language === "fr"
          ? `${res.updated_count} opération(s) mise(s) à jour sur ${res.matched_count} correspondance(s).`
          : `${res.updated_count} transaction(s) updated across ${res.matched_count} matches.`
      )
      setIsBatchModalOpen(false)
      await loadData()
      if (onRulesChanged) onRulesChanged()
    } catch (err: any) {
      showError(err.message || "Erreur lors de l'application des règles.")
    } finally {
      setIsApplyingBatch(false)
    }
  }

  // Selected category's available subcategories
  const selectedCategoryObj = useMemo(() => {
    return categories.find((c) => c.name === category)
  }, [categories, category])

  const filteredRules = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return rules

    return rules.filter((r) => {
      const matchName = r.name.toLowerCase().includes(q)
      const matchPat = r.pattern.toLowerCase().includes(q)
      const matchCat = r.category.toLowerCase().includes(q)
      const matchSub = r.subcategory ? r.subcategory.toLowerCase().includes(q) : false
      const matchTag = r.tags ? r.tags.some((t) => t.toLowerCase().includes(q)) : false
      return matchName || matchPat || matchCat || matchSub || matchTag
    })
  }, [rules, searchQuery])

  const totalRulesCount = rules.length
  const activeRulesCount = rules.filter((r) => r.is_active).length

  return (
    <div className="flex flex-col gap-6 w-full max-w-5xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {t.rules.title}
            </h2>
            <Badge
              variant="outline"
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs px-2.5 py-0.5"
            >
              {totalRulesCount}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="text-emerald-400 font-medium">
              {activeRulesCount} {t.rules.activeRule.toLowerCase()}
            </span>
            <span>•</span>
            <span>
              {totalRulesCount - activeRulesCount} {t.rules.inactiveRule.toLowerCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenBatchApply()}
            disabled={activeRulesCount === 0 || isLoading}
            className="border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 text-xs h-9 px-3.5 rounded-xl cursor-pointer gap-2 font-medium"
          >
            <Play className="w-3.5 h-3.5 text-indigo-400" />
            <span>{t.rules.batchApplyBtn}</span>
          </Button>

          <Button
            type="button"
            onClick={openCreateModal}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.rules.addRuleBtn}</span>
          </Button>

          {isModal && onClose && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-9 px-3 rounded-xl cursor-pointer"
            >
              {t.common.close}
            </Button>
          )}
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
          <Check className="w-4 h-4 shrink-0" />
          <span>{successMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative w-full">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <Input
          type="text"
          placeholder={t.rules.searchPlaceholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 pl-9 pr-4 focus:border-indigo-500"
        />
      </div>

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400 gap-2 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>{t.common.loading}</span>
        </div>
      ) : filteredRules.length === 0 ? (
        <div className="p-10 rounded-3xl bg-zinc-900/50 border border-white/5 flex flex-col items-center justify-center text-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Wand2 className="w-6 h-6" />
          </div>
          <span className="text-sm font-bold text-white">{t.rules.noRulesFound}</span>
          <span className="text-xs text-zinc-400 max-w-md">{t.rules.noRulesDesc}</span>
          <Button
            type="button"
            onClick={openCreateModal}
            className="mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 px-4 font-semibold cursor-pointer gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.rules.addRuleBtn}</span>
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredRules.map((rule, index) => {
            const isFirst = index === 0
            const isLast = index === filteredRules.length - 1

            return (
              <Card
                key={rule.id}
                className={cn(
                  "p-4 sm:p-5 border-white/10 bg-[#18181B] rounded-2xl flex flex-col gap-3 shadow-md transition-all",
                  !rule.is_active && "opacity-60 bg-zinc-900/40"
                )}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap sm:flex-nowrap">
                  {/* Left: Reorder controls + Rule Info */}
                  <div className="flex items-start gap-3 min-w-0">
                    {/* Priority / Reorder Buttons */}
                    <div className="flex flex-col gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => handleMovePriority(index, "up")}
                        disabled={isFirst}
                        className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                        title={t.rules.priorityUp}
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMovePriority(index, "down")}
                        disabled={isLast}
                        className="p-1 rounded-md text-zinc-500 hover:text-white hover:bg-white/5 disabled:opacity-20 disabled:hover:bg-transparent cursor-pointer"
                        title={t.rules.priorityDown}
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-white truncate">
                          {rule.name}
                        </span>

                        <Badge
                          variant="outline"
                          className="border-white/10 bg-zinc-900 text-zinc-300 text-[10px] py-0.5 px-2 uppercase font-mono"
                        >
                          {rule.match_type === "regex"
                            ? "Regex"
                            : rule.match_type === "exact"
                            ? "Exact"
                            : rule.match_type === "starts_with"
                            ? "Prefix"
                            : rule.match_type === "ends_with"
                            ? "Suffix"
                            : "Contains"}
                        </Badge>

                        {rule.matched_count !== undefined && rule.matched_count > 0 && (
                          <Badge
                            variant="outline"
                            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] py-0.5 px-2"
                          >
                            {t.rules.matchesCount.replace("{count}", String(rule.matched_count))}
                          </Badge>
                        )}
                      </div>

                      {/* Pattern text */}
                      <div className="flex items-center gap-2 text-xs font-mono text-zinc-400 break-all">
                        <span className="text-zinc-500">Pattern:</span>
                        <span className="bg-zinc-950 px-2 py-0.5 rounded-lg border border-white/5 text-zinc-200">
                          {rule.pattern}
                        </span>
                      </div>

                      {/* Conditions Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-zinc-400 mt-1">
                        {rule.apply_to_field !== "all" && (
                          <span className="bg-zinc-900 px-2 py-0.5 rounded-md border border-white/5">
                            {rule.apply_to_field === "raw_label"
                              ? t.rules.applyToRawLabel
                              : t.rules.applyToMerchant}
                          </span>
                        )}

                        {rule.account_name && (
                          <span className="bg-zinc-900 px-2 py-0.5 rounded-md border border-white/5 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-zinc-400" />
                            <span>{rule.account_name}</span>
                          </span>
                        )}

                        {rule.amount_type !== "any" && (
                          <span className="bg-zinc-900 px-2 py-0.5 rounded-md border border-white/5">
                            {rule.amount_type === "expense"
                              ? t.rules.amountTypeExpense
                              : t.rules.amountTypeIncome}
                          </span>
                        )}

                        {(rule.min_amount != null || rule.max_amount != null) && (
                          <span className="bg-zinc-900 px-2 py-0.5 rounded-md border border-white/5 font-mono">
                            {rule.min_amount != null && `min ${rule.min_amount}€`}
                            {rule.min_amount != null && rule.max_amount != null && " • "}
                            {rule.max_amount != null && `max ${rule.max_amount}€`}
                          </span>
                        )}
                      </div>

                      {/* Actions & Target Badges */}
                      <div className="flex items-center gap-2 flex-wrap text-xs mt-1.5">
                        <div className="flex items-center gap-1.5 bg-zinc-900/90 border border-white/10 px-2.5 py-1 rounded-xl text-white font-medium">
                          <Tag className="w-3.5 h-3.5 text-indigo-400" />
                          <span>{rule.category}</span>
                          {rule.subcategory && (
                            <>
                              <span className="text-zinc-500">/</span>
                              <span className="text-zinc-300 font-normal">{rule.subcategory}</span>
                            </>
                          )}
                        </div>

                        {rule.tags &&
                          rule.tags.map((tg) => (
                            <span
                              key={tg}
                              className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-lg text-[11px] font-mono"
                            >
                              {tg}
                            </span>
                          ))}

                        {rule.is_excluded_from_budget && (
                          <span className="bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded-lg text-[11px]">
                            {t.rules.isExcludedFromBudget}
                          </span>
                        )}

                        {rule.mark_as_transfer && (
                          <span className="bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-lg text-[11px]">
                            {t.rules.markAsTransfer}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-start sm:self-center">
                    {/* Active toggle button */}
                    <button
                      type="button"
                      onClick={() => handleToggleRule(rule.id)}
                      className={cn(
                        "text-xs px-2.5 py-1 rounded-xl border transition-all font-medium cursor-pointer",
                        rule.is_active
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                          : "bg-zinc-900 border-white/10 text-zinc-400 hover:text-white"
                      )}
                    >
                      {rule.is_active ? t.rules.activeRule : t.rules.inactiveRule}
                    </button>

                    {/* Apply single rule to past */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => handleOpenBatchApply(rule.id)}
                      className="h-8 px-2.5 rounded-xl text-zinc-400 hover:text-indigo-300 hover:bg-indigo-500/10 cursor-pointer text-xs gap-1"
                      title={t.rules.applyToPastBtn}
                    >
                      <Play className="w-3.5 h-3.5" />
                    </Button>

                    {/* Edit button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => openEditModal(rule)}
                      className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
                      title={t.rules.editRule}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>

                    {/* Delete button */}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(rule)}
                      className="h-8 w-8 p-0 rounded-xl text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                      title={t.rules.deleteRuleTitle}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* Editor Modal (Create / Edit Rule) */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-6 sm:p-7 max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="p-0 pb-4 border-b border-white/5">
            <DialogTitle className="text-base sm:text-lg font-bold text-white">
              {editingRuleId ? t.rules.editRule : t.rules.createRule}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveRule} className="flex flex-col gap-4 pt-2">
            {/* Rule Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">{t.rules.ruleName}</label>
              <Input
                type="text"
                placeholder={t.rules.ruleNamePlaceholder}
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
              />
            </div>

            {/* Pattern & Match Type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-zinc-400">
                  {t.rules.pattern} <span className="text-rose-400">*</span>
                </label>
                <Input
                  type="text"
                  placeholder={t.rules.patternPlaceholder}
                  value={pattern}
                  onChange={(e) => setPattern(e.target.value)}
                  required
                  className="bg-zinc-900 border-white/10 text-white font-mono rounded-xl text-xs h-10 focus:border-indigo-500"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{t.rules.matchType}</label>
                <select
                  value={matchType}
                  onChange={(e) => setMatchType(e.target.value as RuleMatchType)}
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="contains">{t.rules.matchTypeContains}</option>
                  <option value="exact">{t.rules.matchTypeExact}</option>
                  <option value="regex">{t.rules.matchTypeRegex}</option>
                  <option value="starts_with">{t.rules.matchTypeStartsWith}</option>
                  <option value="ends_with">{t.rules.matchTypeEndsWith}</option>
                </select>
              </div>
            </div>

            {/* Apply To Field & Account Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{t.rules.applyToField}</label>
                <select
                  value={applyToField}
                  onChange={(e) => setApplyToField(e.target.value as RuleApplyField)}
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="all">{t.rules.applyToAll}</option>
                  <option value="raw_label">{t.rules.applyToRawLabel}</option>
                  <option value="merchant_name">{t.rules.applyToMerchant}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{t.rules.accountFilter}</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">{t.rules.allAccounts}</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.bank_name || a.bank})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Amount Conditions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{t.rules.amountCondition}</label>
                <select
                  value={amountType}
                  onChange={(e) => setAmountType(e.target.value as RuleAmountType)}
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="any">{t.rules.amountTypeAny}</option>
                  <option value="expense">{t.rules.amountTypeExpense}</option>
                  <option value="income">{t.rules.amountTypeIncome}</option>
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{t.rules.minAmount}</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{t.rules.maxAmount}</label>
                <Input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500 font-mono"
                />
              </div>
            </div>

            {/* Category & Subcategory */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">
                  {t.rules.category} <span className="text-rose-400">*</span>
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value)
                    setSubcategory("")
                  }}
                  required
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  {categories.map((c) => (
                    <option key={c.id || c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">{t.rules.subcategory}</label>
                <select
                  value={subcategory}
                  onChange={(e) => setSubcategory(e.target.value)}
                  className="bg-zinc-900 border border-white/10 text-white rounded-xl text-xs h-10 px-3 focus:border-indigo-500 outline-none cursor-pointer"
                >
                  <option value="">Aucune</option>
                  {selectedCategoryObj?.subcategories?.map((sub) => (
                    <option key={sub} value={sub}>
                      {sub}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Tags */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">{t.rules.tags}</label>
              <Input
                type="text"
                placeholder={t.rules.tagsPlaceholder}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
              />
              {tags.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap mt-1">
                  {tags.map((tg) => (
                    <span
                      key={tg}
                      className="bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs px-2.5 py-0.5 rounded-lg flex items-center gap-1 font-mono"
                    >
                      <span>{tg}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tg)}
                        className="hover:text-white cursor-pointer ml-0.5"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Options Checkboxes */}
            <div className="flex flex-col gap-2.5 pt-2 border-t border-white/5">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={isExcludedFromBudget}
                  onChange={(e) => setIsExcludedFromBudget(e.target.checked)}
                  className="rounded bg-zinc-900 border-white/10 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>{t.rules.isExcludedFromBudget}</span>
              </label>

              <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-300">
                <input
                  type="checkbox"
                  checked={markAsTransfer}
                  onChange={(e) => setMarkAsTransfer(e.target.checked)}
                  className="rounded bg-zinc-900 border-white/10 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                />
                <span>{t.rules.markAsTransfer}</span>
              </label>
            </div>

            {/* Test Simulation Button & Preview */}
            <div className="flex flex-col gap-2 pt-2 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-400">Simulation</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestRule}
                  disabled={isTesting || !pattern.trim()}
                  className="border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 text-xs h-8 px-3 rounded-xl cursor-pointer gap-1.5"
                >
                  <Eye className="w-3.5 h-3.5 text-indigo-400" />
                  <span>{isTesting ? t.common.loading : t.rules.testRuleBtn}</span>
                </Button>
              </div>

              {testResult && (
                <div className="p-3 rounded-xl bg-zinc-950 border border-white/5 flex flex-col gap-2 text-xs">
                  <div className="flex items-center justify-between text-zinc-300 font-semibold">
                    <span>
                      {testResult.matched_count > 0
                        ? t.rules.testMatchesCount.replace("{count}", String(testResult.matched_count))
                        : t.rules.noTestMatches}
                    </span>
                  </div>

                  {testResult.samples.length > 0 && (
                    <div className="flex flex-col gap-1 max-h-36 overflow-y-auto pr-1">
                      {testResult.samples.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-zinc-900/60 text-zinc-400"
                        >
                          <span className="font-mono text-zinc-300 truncate max-w-[200px]">
                            {s.raw_label}
                          </span>
                          <span className="font-mono font-bold text-white shrink-0">
                            {s.amount.toFixed(2)} €
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <DialogFooter className="p-0 pt-4 border-t border-white/5 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditorOpen(false)}
                className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 px-4 rounded-xl cursor-pointer font-semibold"
              >
                {t.common.cancel}
              </Button>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-10 px-5 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                {isSubmitting ? t.common.loading : t.common.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* Batch Apply Confirmation Modal */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={isBatchModalOpen} onOpenChange={setIsBatchModalOpen}>
        <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-6 sm:p-7 max-w-md">
          <DialogHeader className="p-0 pb-3">
            <DialogTitle className="text-base sm:text-lg font-bold text-white">
              {t.rules.batchApplyConfirmTitle}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-2">
            <span className="text-xs text-zinc-300 leading-relaxed">
              {t.rules.batchApplyConfirmDesc}
            </span>

            <label className="flex items-center gap-2.5 cursor-pointer text-xs text-zinc-300 p-3 rounded-xl bg-zinc-950 border border-white/5">
              <input
                type="checkbox"
                checked={overwriteManual}
                onChange={(e) => setOverwriteManual(e.target.checked)}
                className="rounded bg-zinc-900 border-white/10 text-indigo-600 focus:ring-indigo-500 h-4 w-4"
              />
              <span>{t.rules.overwriteManualLabel}</span>
            </label>
          </div>

          <DialogFooter className="p-0 pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsBatchModalOpen(false)}
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 px-4 rounded-xl cursor-pointer font-semibold"
            >
              {t.common.cancel}
            </Button>

            <Button
              type="button"
              onClick={handleExecuteBatchApply}
              disabled={isApplyingBatch}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-10 px-5 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer gap-1.5"
            >
              {isApplyingBatch ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>{t.common.loading}</span>
                </>
              ) : (
                <span>{t.rules.batchApplyBtn}</span>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ------------------------------------------------------------- */}
      {/* Delete Rule Modal */}
      {/* ------------------------------------------------------------- */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent className="bg-[#18181B] border-white/10 text-white rounded-3xl p-6 sm:p-7 max-w-sm">
          <DialogHeader className="p-0 pb-3">
            <DialogTitle className="text-base font-bold text-white">
              {t.rules.deleteRuleTitle}
            </DialogTitle>
          </DialogHeader>

          <span className="text-xs text-zinc-300 py-2 leading-relaxed">
            {t.rules.deleteRuleDesc}
          </span>

          <DialogFooter className="p-0 pt-3 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 px-4 rounded-xl cursor-pointer font-semibold"
            >
              {t.common.cancel}
            </Button>

            <Button
              type="button"
              onClick={handleDeleteRule}
              disabled={isDeleting}
              className="bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs h-10 px-5 font-semibold shadow-md shadow-rose-600/20 cursor-pointer"
            >
              {isDeleting ? t.common.loading : t.common.delete}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
