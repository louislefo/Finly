"use client"

import React, { useState, useEffect, useMemo, useCallback } from "react"
import {
  Tag,
  ShoppingBag,
  Car,
  Home as HomeIcon,
  Film,
  Compass,
  HeartPulse,
  PiggyBank,
  Briefcase,
  GraduationCap,
  Utensils,
  Coffee,
  Plane,
  Gift,
  Dumbbell,
  Music,
  Smartphone,
  Zap,
  Book,
  Smile,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Search,
  Check,
  RefreshCw,
  FolderTree,
  AlertTriangle,
} from "lucide-react"
import { FinlyAPI } from "@/lib/api/finly-api"
import { CategoryItem } from "@/lib/types/finance"
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

const ICON_MAP: Record<string, React.ElementType> = {
  Tag,
  ShoppingBag,
  Car,
  Home: HomeIcon,
  Film,
  Compass,
  HeartPulse,
  PiggyBank,
  Briefcase,
  GraduationCap,
  Utensils,
  Coffee,
  Plane,
  Gift,
  Dumbbell,
  Music,
  Smartphone,
  Zap,
  Book,
  Smile,
}

const COLOR_PRESETS = [
  "#10b981", // Emerald
  "#3b82f6", // Blue
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#6366f1", // Indigo
  "#ef4444", // Red
  "#14b8a6", // Teal
  "#f97316", // Orange
  "#71717a", // Zinc
]

const ICON_PRESETS = [
  "Tag",
  "ShoppingBag",
  "Car",
  "Home",
  "Film",
  "Compass",
  "HeartPulse",
  "PiggyBank",
  "Briefcase",
  "GraduationCap",
  "Utensils",
  "Coffee",
  "Plane",
  "Gift",
  "Dumbbell",
  "Music",
  "Smartphone",
  "Zap",
  "Book",
  "Smile",
]

interface CategoryManagerProps {
  onCategoryChanged?: () => void
  isModal?: boolean
  onClose?: () => void
}

export function CategoryManager({
  onCategoryChanged,
  isModal = false,
  onClose,
}: CategoryManagerProps) {
  const { t, language } = useI18n()

  const [categories, setCategories] = useState<CategoryItem[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [searchQuery, setSearchQuery] = useState<string>("")
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({})

  // Creation modal state
  const [isCreateOpen, setIsCreateOpen] = useState<boolean>(false)
  const [createType, setCreateType] = useState<"category" | "subcategory">("category")
  const [targetParent, setTargetParent] = useState<string>("")
  const [newName, setNewName] = useState<string>("")
  const [selectedColor, setSelectedColor] = useState<string>("#6366f1")
  const [selectedIcon, setSelectedIcon] = useState<string>("Tag")
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Deletion modal state
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    isSubcategory: boolean
    parentName?: string
  } | null>(null)
  const [isDeleting, setIsDeleting] = useState<boolean>(false)

  const loadCategories = useCallback(async () => {
    setIsLoading(true)
    try {
      const list = await FinlyAPI.getCategories()
      setCategories(list)
    } catch {
      // offline fallback
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCategories()
  }, [loadCategories])

  const toggleCategoryExpand = (catName: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [catName]: !prev[catName],
    }))
  }

  const handleOpenCreateCategory = () => {
    setCreateType("category")
    setTargetParent("")
    setNewName("")
    setSelectedColor("#6366f1")
    setSelectedIcon("Tag")
    setErrorMessage(null)
    setIsCreateOpen(true)
  }

  const handleOpenCreateSubcategory = (parentName: string) => {
    setCreateType("subcategory")
    setTargetParent(parentName)
    setNewName("")
    const parent = categories.find((c) => c.name === parentName)
    setSelectedColor(parent?.color || "#6366f1")
    setSelectedIcon(parent?.icon || "Tag")
    setErrorMessage(null)
    setIsCreateOpen(true)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanName = newName.trim()
    if (!cleanName) return

    setIsSubmitting(true)
    setErrorMessage(null)

    try {
      await FinlyAPI.createCategory({
        name: cleanName,
        parent_name: createType === "subcategory" ? targetParent : undefined,
        icon: selectedIcon,
        color: selectedColor,
      })

      await loadCategories()
      if (onCategoryChanged) onCategoryChanged()

      if (createType === "subcategory" && targetParent) {
        setExpandedCategories((prev) => ({ ...prev, [targetParent]: true }))
      }

      setSuccessMessage(
        createType === "category"
          ? language === "fr"
            ? "Catégorie créée avec succès."
            : "Category created successfully."
          : language === "fr"
          ? "Sous-catégorie créée avec succès."
          : "Subcategory created successfully."
      )
      setTimeout(() => setSuccessMessage(null), 3000)

      setIsCreateOpen(false)
      setNewName("")
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === "fr"
            ? "Erreur lors de la création."
            : "Error during category creation.")
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setIsDeleting(true)
    setErrorMessage(null)

    try {
      await FinlyAPI.deleteCategory(deleteTarget.id)
      await loadCategories()
      if (onCategoryChanged) onCategoryChanged()

      setSuccessMessage(
        deleteTarget.isSubcategory
          ? language === "fr"
            ? "Sous-catégorie supprimée."
            : "Subcategory deleted."
          : language === "fr"
          ? "Catégorie supprimée."
          : "Category deleted."
      )
      setTimeout(() => setSuccessMessage(null), 3000)

      setDeleteTarget(null)
    } catch (err: any) {
      setErrorMessage(
        err.message ||
          (language === "fr"
            ? "Erreur lors de la suppression."
            : "Error deleting category.")
      )
    } finally {
      setIsDeleting(false)
    }
  }

  // Filter categories and their subcategories by search query
  const filteredCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return categories

    return categories.filter((cat) => {
      const matchName = cat.name.toLowerCase().includes(q)
      const matchSub = cat.subcategories.some((sub) => sub.toLowerCase().includes(q))
      return matchName || matchSub
    })
  }, [categories, searchQuery])

  const totalCategoriesCount = categories.length
  const customCategoriesCount = categories.filter((c) => c.is_custom).length
  const systemCategoriesCount = totalCategoriesCount - customCategoriesCount

  return (
    <div className="flex flex-col gap-6 w-full max-w-4xl">
      {/* Header with Title & Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              {t.accounts.categoriesTitle}
            </h2>
            <Badge
              variant="outline"
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs px-2.5 py-0.5"
            >
              {totalCategoriesCount}
            </Badge>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span>
              {systemCategoriesCount} {t.accounts.systemBadge.toLowerCase()}
            </span>
            <span>•</span>
            <span className="text-indigo-400 font-medium">
              {customCategoriesCount} {t.accounts.customBadge.toLowerCase()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            onClick={handleOpenCreateCategory}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 px-4 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>{t.accounts.addCategoryBtn}</span>
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

      {/* Global Notifications */}
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
          placeholder={
            language === "fr"
              ? "Rechercher une catégorie ou sous-catégorie..."
              : "Search category or subcategory..."
          }
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 pl-9 pr-4 focus:border-indigo-500"
        />
      </div>

      {/* Categories List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-zinc-400 gap-2 text-xs">
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>{t.common.loading}</span>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="p-8 rounded-3xl bg-zinc-900/50 border border-white/5 text-center text-zinc-400 text-xs">
          {language === "fr"
            ? "Aucune catégorie trouvée."
            : "No categories found."}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredCategories.map((category) => {
            const IconComponent = ICON_MAP[category.icon || "Tag"] || Tag
            const isExpanded = expandedCategories[category.name] ?? false
            const subDetails = category.subcategories_details || []
            const subCount = category.subcategories.length

            return (
              <Card
                key={category.id || category.name}
                className="p-4 sm:p-5 border-white/10 bg-[#18181B] rounded-2xl flex flex-col gap-3 shadow-md"
              >
                {/* Category Main Row */}
                <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                  <div
                    onClick={() => toggleCategoryExpand(category.name)}
                    className="flex items-center gap-3.5 min-w-0 cursor-pointer select-none group flex-1"
                  >
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-white/10 shadow-sm"
                      style={{
                        backgroundColor: `${category.color || "#6366f1"}20`,
                        color: category.color || "#818cf8",
                      }}
                    >
                      <IconComponent className="w-5 h-5" />
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm sm:text-base font-bold text-white group-hover:text-indigo-300 transition-colors truncate">
                          {t.categories[category.name] || category.name}
                        </span>
                        {category.is_custom ? (
                          <Badge
                            variant="outline"
                            className="border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-[10px] px-1.5 py-0"
                          >
                            {t.accounts.customBadge}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-white/5 bg-zinc-800/80 text-zinc-400 text-[10px] px-1.5 py-0"
                          >
                            {t.accounts.systemBadge}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-zinc-400 mt-0.5">
                        {subCount}{" "}
                        {language === "fr"
                          ? "sous-catégorie(s)"
                          : "subcategory(ies)"}
                      </span>
                    </div>
                  </div>

                  {/* Right Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenCreateSubcategory(category.name)}
                      className="h-8 px-2.5 text-xs rounded-xl border-white/10 bg-zinc-900 text-zinc-300 hover:text-white hover:bg-zinc-800 gap-1 cursor-pointer"
                      title={t.accounts.addSubcategoryBtn}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">
                        {t.accounts.addSubcategoryBtn}
                      </span>
                    </Button>

                    {category.is_custom && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setDeleteTarget({
                            id: category.id,
                            name: category.name,
                            isSubcategory: false,
                          })
                        }
                        className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer"
                        title={t.accounts.deleteCategoryTitle}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}

                    <button
                      type="button"
                      onClick={() => toggleCategoryExpand(category.name)}
                      className="h-8 w-8 flex items-center justify-center text-zinc-400 hover:text-white rounded-xl hover:bg-zinc-900 cursor-pointer"
                      aria-label="Dérouler"
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Subcategories Accordion / List */}
                {isExpanded && (
                  <div className="pt-3 border-t border-white/5 flex flex-col gap-2">
                    {subCount === 0 ? (
                      <span className="text-xs text-zinc-500 italic py-1">
                        {t.accounts.noSubcategories}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {category.subcategories.map((subName) => {
                          const customDetail = subDetails.find(
                            (d) => d.name === subName && d.is_custom
                          )
                          const isCustomSub = Boolean(customDetail && customDetail.id)

                          return (
                            <div
                              key={subName}
                              className={cn(
                                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs border transition-colors",
                                isCustomSub
                                  ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-200"
                                  : "bg-zinc-900 border-white/10 text-zinc-300"
                              )}
                            >
                              <span>{subName}</span>
                              {isCustomSub && customDetail?.id && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDeleteTarget({
                                      id: customDetail.id as string,
                                      name: subName,
                                      isSubcategory: true,
                                      parentName: category.name,
                                    })
                                  }
                                  className="w-4 h-4 rounded-full flex items-center justify-center text-indigo-300 hover:text-rose-400 hover:bg-rose-500/20 transition-colors ml-0.5 cursor-pointer"
                                  title={t.accounts.deleteSubcategoryTitle}
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )
          })}
        </div>
      )}

      {/* Creation Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl shadow-2xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <FolderTree className="w-4 h-4 text-indigo-400" />
              <span>
                {createType === "category"
                  ? t.accounts.addCategoryBtn
                  : t.accounts.addSubcategoryBtn}
              </span>
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="flex flex-col gap-4 mt-2">
            {errorMessage && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {errorMessage}
              </div>
            )}

            {/* Type selector toggle */}
            <div className="flex items-center p-1 rounded-xl bg-zinc-900 border border-white/10 text-xs select-none">
              <button
                type="button"
                onClick={() => {
                  setCreateType("category")
                  setTargetParent("")
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer text-center",
                  createType === "category"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {t.accounts.createMainCategory}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreateType("subcategory")
                  if (!targetParent && categories.length > 0) {
                    setTargetParent(categories[0].name)
                  }
                }}
                className={cn(
                  "flex-1 py-1.5 rounded-lg font-semibold transition-all cursor-pointer text-center",
                  createType === "subcategory"
                    ? "bg-white text-zinc-950 shadow-sm"
                    : "text-zinc-400 hover:text-white"
                )}
              >
                {t.accounts.createSubCategory}
              </button>
            </div>

            {/* Parent Category Selector (if subcategory) */}
            {createType === "subcategory" && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-400">
                  {t.accounts.parentCategory}
                </label>
                <select
                  value={targetParent}
                  onChange={(e) => setTargetParent(e.target.value)}
                  className="bg-zinc-900 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none cursor-pointer focus:border-indigo-500"
                >
                  {categories.map((cat) => (
                    <option key={cat.id || cat.name} value={cat.name}>
                      {t.categories[cat.name] || cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Name Input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-400">
                {createType === "category"
                  ? t.accounts.categoryName
                  : t.accounts.subcategoryName}
              </label>
              <Input
                type="text"
                placeholder={
                  createType === "category"
                    ? language === "fr"
                      ? "Ex: Animaux, Éducation, Travaux..."
                      : "Ex: Pets, Education, Renovation..."
                    : language === "fr"
                    ? "Ex: Vétérinaire, Croquettes, Livres..."
                    : "Ex: Vet, Pet food, Books..."
                }
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
              />
            </div>

            {/* Color Picker Presets */}
            {createType === "category" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-400">
                  {t.accounts.categoryColor}
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={cn(
                        "w-6 h-6 rounded-full border transition-transform cursor-pointer",
                        selectedColor === color
                          ? "ring-2 ring-white scale-110 border-white"
                          : "border-transparent hover:scale-105"
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Icon Picker Presets */}
            {createType === "category" && (
              <div className="flex flex-col gap-2">
                <label className="text-xs font-semibold text-zinc-400">
                  {t.accounts.categoryIcon}
                </label>
                <div className="grid grid-cols-5 gap-2 max-h-36 overflow-y-auto p-1 bg-zinc-950/60 rounded-xl border border-white/5">
                  {ICON_PRESETS.map((iconKey) => {
                    const PresetIcon = ICON_MAP[iconKey] || Tag
                    const isSelected = selectedIcon === iconKey

                    return (
                      <button
                        key={iconKey}
                        type="button"
                        onClick={() => setSelectedIcon(iconKey)}
                        className={cn(
                          "h-9 rounded-xl flex items-center justify-center transition-colors cursor-pointer border",
                          isSelected
                            ? "bg-indigo-600/20 border-indigo-500 text-indigo-300"
                            : "bg-zinc-900 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                        )}
                      >
                        <PresetIcon className="w-4 h-4" />
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button
                type="submit"
                disabled={isSubmitting || !newName.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-10 rounded-xl font-semibold cursor-pointer shadow-md shadow-indigo-600/30 gap-1.5"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.common.loading}</span>
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    <span>{t.common.save}</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 rounded-xl cursor-pointer"
              >
                {t.common.cancel}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Deletion Confirmation Dialog */}
      <Dialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl shadow-2xl">
          <DialogHeader className="p-0 text-left">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>
                {deleteTarget?.isSubcategory
                  ? t.accounts.deleteSubcategoryTitle
                  : t.accounts.deleteCategoryTitle}
              </span>
            </DialogTitle>
          </DialogHeader>

          <p className="text-xs text-zinc-400 leading-relaxed mt-2">
            {deleteTarget?.isSubcategory
              ? t.accounts.deleteSubcategoryDesc
              : t.accounts.deleteCategoryDesc}
          </p>

          <div className="p-3 rounded-2xl bg-zinc-950 border border-white/10 flex items-center justify-between mt-2">
            <span className="text-xs font-bold text-white">
              {deleteTarget?.name}
            </span>
            {deleteTarget?.parentName && (
              <Badge
                variant="outline"
                className="text-[10px] border-white/10 text-zinc-400"
              >
                {deleteTarget.parentName}
              </Badge>
            )}
          </div>

          <DialogFooter className="flex gap-2 pt-4 sm:justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteTarget(null)}
              className="border-white/10 bg-zinc-900 text-zinc-300 text-xs h-10 rounded-xl cursor-pointer"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              disabled={isDeleting}
              onClick={handleConfirmDelete}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs h-10 px-4 rounded-xl font-semibold shadow-md shadow-rose-600/30 cursor-pointer gap-1.5"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{t.common.loading}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t.common.delete}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
