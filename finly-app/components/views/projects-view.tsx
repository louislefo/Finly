"use client"

import React, { useState } from "react"
import {
  Plus,
  Calendar,
  PiggyBank,
  CheckCircle2,
  ArrowRight,
  FileSpreadsheet,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ExportDialog } from "@/components/modals/export-dialog"
import { MOCK_PROJECTS } from "@/lib/data/mock-finance"

export function ProjectsView() {
  const { formatAmount } = usePrivacy()
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)

  const projectsList = MOCK_PROJECTS

  const totalTarget = projectsList.reduce((acc, p) => acc + p.targetAmount, 0)
  const totalCurrent = projectsList.reduce((acc, p) => acc + p.currentAmount, 0)
  const overallProgress = Math.round((totalCurrent / totalTarget) * 100)

  return (
    <div className="flex flex-col gap-6 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Header section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Projets & Budgets</h1>
          <p className="text-xs text-zinc-400">
            Suivi personnalisé des objectifs d'épargne et prévisions
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            onClick={() => setIsExportOpen(true)}
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 bg-zinc-900/80 hover:bg-zinc-800 text-zinc-200"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Exporter Rapport Projets</span>
          </Button>

          <Button className="gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-lg shadow-indigo-600/20">
            <Plus className="w-4 h-4" /> Nouveau Projet
          </Button>
        </div>
      </div>

      {/* Global Progress Banner */}
      <Card className="p-6 border-white/10 bg-gradient-to-r from-zinc-900 via-[#18181B] to-indigo-950/40">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="flex flex-col gap-2 flex-1">
            <div className="flex items-center gap-2">
              <PiggyBank className="w-5 h-5 text-indigo-400" />
              <span className="text-sm font-bold text-white">Progression Globale des Objectifs</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-extrabold text-white font-mono">
                {formatAmount(totalCurrent)}
              </span>
              <span className="text-xs text-zinc-400">
                sur un objectif total de {formatAmount(totalTarget)}
              </span>
            </div>
          </div>

          <div className="w-full md:w-64 flex flex-col gap-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-zinc-400">Progression globale</span>
              <span className="font-bold text-indigo-300 font-mono">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-3 bg-zinc-800" indicatorClassName="bg-indigo-500" />
          </div>
        </div>
      </Card>

      {/* Grid of Projects */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {projectsList.map((project) => {
          const percent = Math.min(100, Math.round((project.currentAmount / project.targetAmount) * 100))
          const remaining = Math.max(0, project.targetAmount - project.currentAmount)
          const isCompleted = project.status === "completed"

          return (
            <Card
              key={project.id}
              className={`p-6 border-white/10 bg-[#18181B] flex flex-col justify-between hover:border-indigo-500/40 transition-all ${
                isCompleted ? "border-emerald-500/30 bg-emerald-950/10" : ""
              }`}
            >
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold text-white">{project.name}</h3>
                      {isCompleted && (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      )}
                    </div>
                    <Badge variant="outline" className="w-fit text-[11px] mt-1">
                      {project.category}
                    </Badge>
                  </div>

                  <span className="text-xs text-zinc-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" /> {project.deadline}
                  </span>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  {project.description}
                </p>

                <div className="flex flex-col gap-2 mt-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-zinc-400 font-medium">Avancement</span>
                    <span className="font-bold font-mono text-white">{percent}%</span>
                  </div>

                  <Progress
                    value={percent}
                    className="h-2.5 bg-zinc-800"
                    indicatorClassName={isCompleted ? "bg-emerald-500" : "bg-indigo-500"}
                  />

                  <div className="flex justify-between items-center text-xs font-mono mt-1">
                    <span className="text-white font-bold">{formatAmount(project.currentAmount)}</span>
                    <span className="text-zinc-400">Cible: {formatAmount(project.targetAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-center pt-6 mt-6 border-t border-white/5">
                <span className="text-xs text-zinc-400 font-mono">
                  Reste à épargner: <strong className="text-white">{formatAmount(remaining)}</strong>
                </span>

                <Button
                  variant="outline"
                  size="sm"
                  disabled={isCompleted}
                  className="text-xs border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 gap-1"
                >
                  Ajouter des fonds <ArrowRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          )
        })}
      </div>

      {/* Export Dialog for Projects */}
      <ExportDialog
        isOpen={isExportOpen}
        onClose={() => setIsExportOpen(false)}
        defaultScope="projects"
        title="Exporter le Rapport Budgets & Projets"
      />
    </div>
  )
}
