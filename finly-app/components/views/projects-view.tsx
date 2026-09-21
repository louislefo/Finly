"use client"

import React, { useState, useEffect, useCallback } from "react"
import {
  Plus,
  FileSpreadsheet,
} from "lucide-react"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
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
  const { t, language } = useI18n()
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
      console.error("Error loading projects:", err)
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
      console.error("Error saving project:", err)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      await FinlyAPI.deleteProject(projectId)
      setProjectsList((prev) => prev.filter((p) => p.id !== projectId))
    } catch (err) {
      console.error("Error deleting project:", err)
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
      console.error("Error adding funds:", err)
    }
  }

  const handleCreateFromSimulator = async (simulatedProject: Partial<Project>) => {
    try {
      const created = await FinlyAPI.createProject(simulatedProject)
      setProjectsList((prev) => [created, ...prev])
      setSelectedFilter("real_estate")
    } catch (err) {
      console.error("Error creating real estate project:", err)
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
    <div className="flex flex-col gap-5 w-full max-w-[1600px] mx-auto pb-24 md:pb-8">
      {/* Header with Inline Metrics and Discrete Filter Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="text-zinc-400">
            {t.projects.totalSaved} : <strong className="text-white font-bold">{formatAmount(totalCurrent)}</strong> / {formatAmount(totalTarget)} ({overallProgress}%)
          </span>
          <span className="text-zinc-700 hidden sm:inline">•</span>
          <span className="text-emerald-400 font-semibold hidden sm:inline">
            +{formatAmount(totalMonthlySavings)} {language === "fr" ? "/ mois" : "/ mo"}
          </span>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {/* Minimalist Native View Selector (No filter pills) */}
          <select
            value={selectedFilter}
            onChange={(e) => setSelectedFilter(e.target.value as FilterTab)}
            className="h-9 px-3 bg-zinc-900 border border-white/10 text-xs text-zinc-300 hover:text-white rounded-xl outline-none cursor-pointer appearance-none transition-colors font-medium"
          >
            <option value="all" className="bg-zinc-900 text-white">{t.projects.allFilter} ({projectsList.length})</option>
            <option value="in_progress" className="bg-zinc-900 text-white">{t.projects.inProgressFilter} ({inProgressCount})</option>
            <option value="future" className="bg-zinc-900 text-white">{t.projects.futureFilter} ({futureCount})</option>
            <option value="real_estate" className="bg-zinc-900 text-white">{t.projects.realEstateFilter} ({projectsList.filter((p) => p.projectType === "real_estate").length})</option>
            <option value="completed" className="bg-zinc-900 text-white">{t.projects.completedFilter} ({projectsList.filter((p) => p.status === "completed" || p.currentAmount >= p.targetAmount).length})</option>
            <option value="simulator" className="bg-zinc-900 text-white">{t.projects.simulatorFilter}</option>
          </select>

          <Button
            onClick={() => setIsExportOpen(true)}
            variant="outline"
            size="sm"
            className="h-9 px-3 gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.common.export}</span>
          </Button>

          <Button
            onClick={() => {
              setProjectToEdit(null)
              setIsNewProjectOpen(true)
            }}
            size="sm"
            className="h-9 px-3.5 gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold cursor-pointer shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.projects.newProject}</span>
          </Button>
        </div>
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
              <div className="flex flex-col gap-1">
                <p className="text-sm font-semibold text-white">{t.projects.noProjectsInCategory}</p>
                <p className="text-xs text-zinc-400">
                  {t.projects.noProjectsDesc}
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
                  <span>{t.projects.createProjectBtn}</span>
                </Button>
                <Button
                  onClick={() => setSelectedFilter("simulator")}
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-white/10 bg-zinc-900 text-zinc-300 text-xs rounded-xl cursor-pointer hover:bg-zinc-800"
                >
                  <span>{t.projects.loanSimulatorBtn}</span>
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
        title={t.projects.exportProjects}
        projects={projectsList}
      />
    </div>
  )
}
