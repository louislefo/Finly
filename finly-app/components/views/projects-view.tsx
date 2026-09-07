"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Plus,
  PiggyBank,
  FileSpreadsheet,
  Building2,
  Calculator,
  Layers,
  Sparkles,
  TrendingUp,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { ExportDialog } from "@/components/modals/export-dialog"
import { NewProjectModal } from "@/components/modals/new-project-modal"
import { AddFundsModal } from "@/components/modals/add-funds-modal"
import { ProjectCard } from "@/components/projects/project-card"
import { MortgageSimulatorCard } from "@/components/projects/mortgage-simulator-card"
import { Project, Account, MortgageRatesSummary } from "@/lib/types/finance"
import { FinlyAPI } from "@/lib/api/finly-api"

type FilterTab = "all" | "in_progress" | "future" | "real_estate" | "simulator" | "completed"

export function ProjectsView() {
  const { formatAmount } = usePrivacy()
  const [projectsList, setProjectsList] = useState<Project[]>([])
  const [accountsList, setAccountsList] = useState<Account[]>([])
  const [ratesSummary, setRatesSummary] = useState<MortgageRatesSummary | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const [selectedFilter, setSelectedFilter] = useState<FilterTab>("all")
  const [isExportOpen, setIsExportOpen] = useState<boolean>(false)
  const [isNewProjectOpen, setIsNewProjectOpen] = useState<boolean>(false)
  const [projectToEdit, setProjectToEdit] = useState<Project | null>(null)
  const [fundProject, setFundProject] = useState<Project | null>(null)

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [projectsData, accountsRes, ratesData] = await Promise.all([
        FinlyAPI.getProjects(),
        FinlyAPI.getAccounts().catch(() => ({ total_balance: 0, accounts: [] })),
        FinlyAPI.getMortgageRates().catch(() => null),
      ])
      setProjectsList(projectsData)
      setAccountsList(accountsRes?.accounts || [])
      setRatesSummary(ratesData)
    } catch (err) {
      console.error("Erreur lors du chargement des projets:", err)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSaveProject = async (projectData: Partial<Project>) => {
    try {
      if (projectData.id) {
        const updated = await FinlyAPI.updateProject(projectData.id, projectData)
        setProjectsList((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        )
      } else {
        const created = await FinlyAPI.createProject(projectData)
        setProjectsList((prev) => [created, ...prev])
      }
    } catch (err) {
      console.error("Erreur lors de l'enregistrement du projet:", err)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await FinlyAPI.deleteProject(projectId)
      setProjectsList((prev) => prev.filter((p) => p.id !== projectId))
    } catch (err) {
      console.error("Erreur lors de la suppression du projet:", err)
    }
  }

  const handleAddFunds = async (projectId: string, amount: number, sourceAccountId?: string) => {
    try {
      const updated = await FinlyAPI.addFundsToProject(projectId, amount, sourceAccountId)
      setProjectsList((prev) =>
        prev.map((p) => (p.id === updated.id ? updated : p))
      )
      // Refresh accounts if source account was debited
      if (sourceAccountId) {
        FinlyAPI.getAccounts()
          .then((res) => setAccountsList(res?.accounts || []))
          .catch(() => {})
      }
    } catch (err) {
      console.error("Erreur lors de l'ajout de fonds:", err)
    }
  }

  const handleCreateFromSimulator = async (simulatedProject: Partial<Project>) => {
    try {
      const created = await FinlyAPI.createProject(simulatedProject)
      setProjectsList((prev) => [created, ...prev])
      setSelectedFilter("real_estate")
    } catch (err) {
      console.error("Erreur création projet immobilier:", err)
    }
  }

  // Filter projects
  const filteredProjects = projectsList.filter((p) => {
    if (selectedFilter === "all") return true
    if (selectedFilter === "in_progress") return p.status === "in_progress"
    if (selectedFilter === "future") return p.status === "future"
    if (selectedFilter === "real_estate") return p.projectType === "real_estate"
    if (selectedFilter === "completed") {
      return p.status === "completed" || p.currentAmount >= p.targetAmount
    }
    return true
  })

  // Global calculations
  const totalTarget = projectsList.reduce((acc, p) => acc + (p.targetAmount || 0), 0)
  const totalCurrent = projectsList.reduce((acc, p) => acc + (p.currentAmount || 0), 0)
  const totalMonthlySavings = projectsList.reduce((acc, p) => acc + (p.monthlyContribution || 0), 0)
  const inProgressCount = projectsList.filter((p) => p.status === "in_progress").length
  const futureCount = projectsList.filter((p) => p.status === "future").length
  const overallProgress = totalTarget > 0 ? Math.round((totalCurrent / totalTarget) * 100) : 0

  return (
    <div className="flex flex-col gap-5 w-full max-w-7xl mx-auto pb-24 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Projets & Objectifs</h1>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Button
            onClick={() => setIsExportOpen(true)}
            variant="outline"
            size="sm"
            className="gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl h-9 text-xs cursor-pointer flex-1 sm:flex-none"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Exporter</span>
          </Button>

          <Button
            onClick={() => {
              setProjectToEdit(null)
              setIsNewProjectOpen(true)
            }}
            size="sm"
            className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-md shadow-indigo-600/20 rounded-xl h-9 text-xs cursor-pointer flex-1 sm:flex-none"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Projet</span>
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="p-4 border-white/10 bg-[#18181B] rounded-3xl flex flex-col justify-between gap-3">
          <div className="flex justify-between items-start">
            <span className="text-xs text-zinc-400 font-medium">Total Épargné</span>
            <span className="text-xs font-mono font-semibold text-zinc-400">
              Cible: {formatAmount(totalTarget)}
            </span>
          </div>
          <div>
            <span className="text-2xl font-bold text-white font-mono">
              {formatAmount(totalCurrent)}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="flex justify-between text-[11px] font-mono text-zinc-400">
              <span>Progression globale</span>
              <span className="text-white font-semibold">{overallProgress}%</span>
            </div>
            <Progress value={overallProgress} className="h-1.5 bg-zinc-900 [&>div]:bg-indigo-500" />
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-[#18181B] rounded-3xl flex flex-col justify-between gap-3">
          <div className="flex justify-between items-start">
            <span className="text-xs text-zinc-400 font-medium">Effort Mensuel d'Épargne</span>
            <Badge variant="outline" className="text-[10px] py-0 border-indigo-500/30 text-indigo-300">
              Actif
            </Badge>
          </div>
          <div>
            <span className="text-2xl font-bold text-white font-mono">
              {formatAmount(totalMonthlySavings)}
            </span>
            <span className="text-xs text-zinc-400 font-mono ml-1">/ mois</span>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-zinc-400">
            <TrendingUp className="w-3.5 h-3.5 text-indigo-400" />
            <span>Réparti sur les projets en cours</span>
          </div>
        </Card>

        <Card className="p-4 border-white/10 bg-[#18181B] rounded-3xl flex flex-col justify-between gap-3">
          <div className="flex justify-between items-start">
            <span className="text-xs text-zinc-400 font-medium">Statut des Projets</span>
            <span className="text-xs text-zinc-400 font-mono">{projectsList.length} au total</span>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 font-mono">
            <div className="flex flex-col p-2 rounded-xl bg-zinc-900/60 border border-white/5">
              <span className="text-[10px] text-indigo-300 font-medium">En cours</span>
              <span className="text-base font-bold text-white">{inProgressCount}</span>
            </div>
            <div className="flex flex-col p-2 rounded-xl bg-zinc-900/60 border border-white/5">
              <span className="text-[10px] text-amber-300 font-medium">Futurs</span>
              <span className="text-base font-bold text-white">{futureCount}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Navigation Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {[
          { id: "all" as FilterTab, label: "Tous", count: projectsList.length },
          { id: "in_progress" as FilterTab, label: "En cours", count: inProgressCount },
          { id: "future" as FilterTab, label: "Futurs", count: futureCount },
          {
            id: "real_estate" as FilterTab,
            label: "Immobilier",
            count: projectsList.filter((p) => p.projectType === "real_estate").length,
          },
          { id: "simulator" as FilterTab, label: "Simulateur Taux & Prêt" },
          {
            id: "completed" as FilterTab,
            label: "Terminés",
            count: projectsList.filter((p) => p.status === "completed" || p.currentAmount >= p.targetAmount).length,
          },
        ].map((tab) => {
          const isActive = selectedFilter === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setSelectedFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer flex items-center gap-1.5 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20"
                  : "bg-zinc-900/80 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {tab.id === "simulator" && <Calculator className="w-3.5 h-3.5 text-indigo-300" />}
              {tab.id === "real_estate" && <Building2 className="w-3.5 h-3.5 text-indigo-300" />}
              <span>{tab.label}</span>
              {typeof tab.count === "number" && (
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                    isActive ? "bg-white/20 text-white" : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Main Content Area: Simulator vs Grid */}
      {selectedFilter === "simulator" ? (
        <div className="w-full">
          <MortgageSimulatorCard
            ratesSummary={ratesSummary}
            onCreateProject={handleCreateFromSimulator}
          />
        </div>
      ) : (
        <>
          {filteredProjects.length === 0 ? (
            <Card className="p-8 sm:p-12 text-center border-white/10 bg-[#18181B] rounded-3xl flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-white/5 flex items-center justify-center text-zinc-400">
                <PiggyBank className="w-6 h-6" />
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-white">Aucun projet dans cette catégorie</p>
                <p className="text-xs text-zinc-400">
                  Créez un projet d'épargne ou lancez une simulation immobilière.
                </p>
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  onClick={() => {
                    setProjectToEdit(null)
                    setIsNewProjectOpen(true)
                  }}
                  size="sm"
                  className="gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs rounded-xl cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Créer un Projet</span>
                </Button>
                <Button
                  onClick={() => setSelectedFilter("simulator")}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 text-xs rounded-xl cursor-pointer hover:bg-zinc-800"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Simulateur Prêt</span>
                </Button>
              </div>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  onAddFunds={(proj) => setFundProject(proj)}
                  onEdit={(proj) => {
                    setProjectToEdit(proj)
                    setIsNewProjectOpen(true)
                  }}
                  onDelete={handleDeleteProject}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Modals */}
      <NewProjectModal
        isOpen={isNewProjectOpen}
        onClose={() => {
          setIsNewProjectOpen(false)
          setProjectToEdit(null)
        }}
        onSaveProject={handleSaveProject}
        projectToEdit={projectToEdit}
        accounts={accountsList}
      />

      <AddFundsModal
        project={fundProject}
        isOpen={!!fundProject}
        onClose={() => setFundProject(null)}
        onAddFunds={handleAddFunds}
        accounts={accountsList}
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
