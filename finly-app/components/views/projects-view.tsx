"use client"

import React, { useState } from "react"
import {
  Plus,
  PiggyBank,
  CheckCheck,
  ArrowRight,
  FileSpreadsheet,
  Plane,
  Home,
  Car,
  Laptop,
  Shield,
  Clock,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ExportDialog } from "@/components/modals/export-dialog"
import { NewProjectModal } from "@/components/modals/new-project-modal"
import { AddFundsModal } from "@/components/modals/add-funds-modal"
import { MOCK_PROJECTS } from "@/lib/data/mock-finance"
import { Project } from "@/lib/types/finance"

export function ProjectsView() {
  const { formatAmount } = usePrivacy()
  const [projectsList, setProjectsList] = useState<Project[]>(MOCK_PROJECTS)
  const [selectedFilter, setSelectedFilter] = useState<"all" | "in_progress" | "near" | "completed">("all")
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false)
  const [fundProject, setFundProject] = useState<Project | null>(null)

  const handleAddProject = (newProj: Project) => {
    setProjectsList((prev) => [newProj, ...prev])
  }

  const handleAddFunds = (projectId: string, amount: number) => {
    setProjectsList((prev) =>
      prev.map((p) => {
        if (p.id === projectId) {
          const updated = p.currentAmount + amount
          const isCompleted = updated >= p.targetAmount
          return {
            ...p,
            currentAmount: updated,
            status: isCompleted ? "completed" : p.status,
          }
        }
        return p
      })
    )
  }

  const filteredProjects = projectsList.filter((p) => {
    if (selectedFilter === "all") return true
    return p.status === selectedFilter
  })

  const totalTarget = projectsList.reduce((acc, p) => acc + p.targetAmount, 0)
  const totalCurrent = projectsList.reduce((acc, p) => acc + p.currentAmount, 0)
  const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0

  const getProjectIcon = (category: string) => {
    switch (category) {
      case "Voyage": return Plane
      case "Logement": return Home
      case "Véhicule": return Car
      case "Tech": return Laptop
      case "Sécurité": return Shield
      default: return PiggyBank
    }
  }

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Projets</h1>
        </div>

        <div className="flex items-center gap-2.5 w-full md:w-auto flex-wrap sm:flex-nowrap">
          <Button
            onClick={() => setIsExportOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </Button>

          <Button
            onClick={() => setIsNewProjectOpen(true)}
            size="sm"
            className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20"
          >
            <Plus className="w-4 h-4" /> Nouveau Projet
          </Button>
        </div>
      </div>

      {/* Global Progress */}
      {projectsList.length > 0 && (
        <Card className="p-5 border-white/10 bg-[#18181B]">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-400">Total Épargné</span>
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-white font-mono">
                  {formatAmount(totalCurrent)}
                </span>
                <span className="text-xs text-zinc-400">
                  / {formatAmount(totalTarget)}
                </span>
              </div>
            </div>

            <div className="w-full md:w-56 flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-xs">
                <span className="text-zinc-400">Progression</span>
                <span className="font-semibold text-white font-mono">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-2 bg-zinc-800" indicatorClassName="bg-indigo-500" />
            </div>
          </div>
        </Card>
      )}

      {/* Filters Bar */}
      {projectsList.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {(["all", "in_progress", "near", "completed"] as const).map((filterKey) => (
            <Button
              key={filterKey}
              variant={selectedFilter === filterKey ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedFilter(filterKey)}
              className={selectedFilter === filterKey
                ? "bg-indigo-600 text-white h-8 text-xs"
                : "border-white/10 bg-zinc-900 text-zinc-300 h-8 text-xs hover:bg-zinc-800"
              }
            >
              {filterKey === "all" ? "Tous" : filterKey === "in_progress" ? "En cours" : filterKey === "near" ? "Presque atteint" : "Terminés"}
            </Button>
          ))}
        </div>
      )}

      {/* Projects Grid or Empty State */}
      {filteredProjects.length === 0 ? (
        <Card className="p-10 text-center border-white/10 bg-[#18181B] flex flex-col items-center justify-center gap-2.5">
          <p className="text-sm font-medium text-white">Aucun projet budgétaire</p>
          <p className="text-xs text-zinc-400">
            Définissez votre premier objectif d'épargne.
          </p>
          <Button
            onClick={() => setIsNewProjectOpen(true)}
            size="sm"
            className="mt-2 gap-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs"
          >
            <Plus className="w-4 h-4" /> Créer un Projet
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProjects.map((project) => {
            const Icon = getProjectIcon(project.category)
            const percent = project.targetAmount > 0 ? Math.round((project.currentAmount / project.targetAmount) * 100) : 0
            const isCompleted = project.status === "completed" || percent >= 100

            return (
              <Card
                key={project.id}
                className="p-5 border-white/10 bg-[#18181B] flex flex-col justify-between hover:border-white/20 transition-all"
              >
                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-300">
                        <Icon className="w-4.5 h-4.5" />
                      </div>
                      <div className="flex flex-col">
                        <h3 className="text-base font-bold text-white leading-snug">{project.name}</h3>
                        <span className="text-[11px] text-zinc-400">{project.category}</span>
                      </div>
                    </div>

                    {isCompleted && (
                      <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-400 border-0 text-[10px] py-0">
                        <CheckCheck className="w-3 h-3 mr-1" /> Atteint
                      </Badge>
                    )}
                  </div>

                  {project.description && (
                    <p className="text-xs text-zinc-400">
                      {project.description}
                    </p>
                  )}

                  {/* Progress Numbers */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold text-white font-mono">
                        {formatAmount(project.currentAmount)}
                      </span>
                      <span className="text-zinc-400 font-mono">
                        {formatAmount(project.targetAmount)}
                      </span>
                    </div>

                    <Progress
                      value={Math.min(100, percent)}
                      className="h-2 bg-zinc-800"
                      indicatorClassName={isCompleted ? "bg-emerald-500" : "bg-indigo-500"}
                    />
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex justify-between items-center pt-3.5 mt-3.5 border-t border-white/5">
                  <span className="text-[11px] text-zinc-400 flex items-center gap-1">
                    <Clock className="w-3 h-3 text-zinc-500" /> {project.deadline}
                  </span>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFundProject(project)}
                    className="text-xs border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 h-7 px-2.5"
                  >
                    <span>Allouer</span>
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => setIsNewProjectOpen(false)}
        onAddProject={handleAddProject}
      />

      <AddFundsModal
        project={fundProject}
        isOpen={!!fundProject}
        onClose={() => setFundProject(null)}
        onAddFunds={handleAddFunds}
      />

      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultScope="projects"
        title="Exporter les Projets"
        projects={projectsList}
      />
    </div>
  )
}
