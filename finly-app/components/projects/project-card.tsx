"use client"

import React from "react"
import {
  Building2,
  Calendar,
  Car,
  CheckCircle2,
  Clock,
  Edit2,
  Home,
  Laptop,
  MoreVertical,
  PiggyBank,
  Plane,
  Plus,
  Shield,
  Trash2,
  Wallet,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Project } from "@/lib/types/finance"

interface ProjectCardProps {
  project: Project
  onAddFunds: (project: Project) => void
  onEdit: (project: Project) => void
  onDelete: (projectId: string) => void
}

export function ProjectCard({
  project,
  onAddFunds,
  onEdit,
  onDelete,
}: ProjectCardProps) {
  const { formatAmount } = usePrivacy()

  const isRealEstate = project.projectType === "real_estate"
  const isFuture = project.status === "future"
  const isCompleted = project.status === "completed" || project.currentAmount >= project.targetAmount
  const progressPercent = Math.min(100, Math.round((project.currentAmount / Math.max(1, project.targetAmount)) * 100))

  const getCategoryIcon = () => {
    if (isRealEstate) return Building2
    switch (project.category) {
      case "Voyage": return Plane
      case "Logement": return Home
      case "Véhicule": return Car
      case "Tech": return Laptop
      case "Sécurité": return Shield
      default: return PiggyBank
    }
  }

  const IconComponent = getCategoryIcon()

  return (
    <Card className="p-4 sm:p-5 border-white/10 bg-[#18181B] rounded-3xl flex flex-col justify-between gap-4 transition-all hover:border-white/20">
      {/* Top Header: Icon, Name, Badges & Actions */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border ${
              isRealEstate
                ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                : isCompleted
                ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                : isFuture
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-zinc-900 border-white/10 text-indigo-400"
            }`}
          >
            <IconComponent className="w-5 h-5" />
          </div>

          <div className="flex flex-col min-w-0">
            <span className="text-sm font-bold text-white truncate tracking-tight">
              {project.name}
            </span>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge
                variant="outline"
                className={`text-[9px] py-0 px-1.5 font-medium ${
                  isCompleted
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : isFuture
                    ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                    : "border-indigo-500/30 bg-indigo-500/10 text-indigo-300"
                }`}
              >
                {isCompleted ? "Atteint" : isFuture ? "Projet Futur" : "En cours"}
              </Badge>

              {isRealEstate && (
                <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-white/10 text-zinc-400">
                  Prêt Immo
                </Badge>
              )}

              {project.linkedAccountName && (
                <span className="text-[10px] text-zinc-400 flex items-center gap-1 truncate max-w-[130px]">
                  <Wallet className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                  <span className="truncate">{project.linkedAccountName}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Action icons */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onEdit(project)}
            title="Modifier le projet"
            className="h-8 w-8 p-0 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl cursor-pointer"
          >
            <Edit2 className="w-3.5 h-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onDelete(project.id)}
            title="Supprimer le projet"
            className="h-8 w-8 p-0 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Real estate parameters preview (if real estate) */}
      {isRealEstate && project.realEstateData && (
        <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-zinc-950/70 border border-white/5 text-[11px] font-mono">
          <div className="flex flex-col">
            <span className="text-[9px] text-zinc-500">Bien / Emprunt</span>
            <span className="text-white font-semibold">{formatAmount(project.realEstateData.propertyPrice || 0)}</span>
          </div>
          <div className="flex flex-col items-end">
            <span className="text-[9px] text-zinc-500">Mensualité estimée</span>
            <span className="text-indigo-300 font-semibold">{formatAmount(project.realEstateData.monthlyPayment || 0)}/m</span>
          </div>
        </div>
      )}

      {/* Progress & Target Stats */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex justify-between items-baseline text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] text-zinc-400 font-medium">
              {isRealEstate ? "Apport constitué" : "Épargne actuelle"}
            </span>
            <span className="text-base font-bold font-mono text-white">
              {formatAmount(project.currentAmount)}
            </span>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[10px] text-zinc-500 font-medium">
              {isRealEstate ? "Apport cible" : "Objectif"}
            </span>
            <span className="text-xs font-mono font-semibold text-zinc-400">
              {formatAmount(project.targetAmount)}
            </span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col gap-1">
          <div className="flex justify-between items-center text-[10px] font-mono text-zinc-400">
            <span>{progressPercent}%</span>
            <span>Reste {formatAmount(Math.max(0, project.targetAmount - project.currentAmount))}</span>
          </div>
          <Progress
            value={progressPercent}
            className={`h-2 bg-zinc-900 ${
              isCompleted
                ? "[&>div]:bg-emerald-500"
                : isFuture
                ? "[&>div]:bg-amber-500"
                : "[&>div]:bg-indigo-500"
            }`}
          />
        </div>
      </div>

      {/* Bottom Footer Info & Quick Add Funds Button */}
      <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-xs">
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <Calendar className="w-3 h-3 text-zinc-500" />
          <span>{project.deadline}</span>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={() => onAddFunds(project)}
          className="h-7 px-2.5 text-xs gap-1 border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-200 rounded-xl cursor-pointer"
        >
          <Plus className="w-3 h-3" />
          <span>Alimenter</span>
        </Button>
      </div>
    </Card>
  )
}
