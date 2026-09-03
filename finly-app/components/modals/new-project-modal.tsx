"use client"

import React, { useState } from "react"
import { Target, Calendar, DollarSign, Tag, Check } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Project } from "@/lib/types/finance"

interface NewProjectModalProps {
  isOpen: boolean
  onClose: () => void
  onAddProject: (project: Project) => void
}

export function NewProjectModal({ isOpen, onClose, onAddProject }: NewProjectModalProps) {
  const [name, setName] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  const [targetAmount, setTargetAmount] = useState<string>("")
  const [category, setCategory] = useState<string>("Voyage")
  const [deadline, setDeadline] = useState<string>("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name || !targetAmount) return

    const newProj: Project = {
      id: `proj_${Date.now()}`,
      name,
      description: description || "Objectif budgétaire personnalisé",
      targetAmount: parseFloat(targetAmount) || 1000,
      currentAmount: 0,
      deadline: deadline || "31 Déc 2026",
      category,
      status: "in_progress",
    }

    onAddProject(newProj)
    setName("")
    setDescription("")
    setTargetAmount("")
    onClose()
  }

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-[#18181B] border-t border-white/10 text-white rounded-t-3xl p-6 max-w-lg mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="w-10 h-1 bg-white/20 rounded-full mx-auto -mt-2" />

          <SheetHeader className="p-0 text-left">
            <SheetTitle className="text-xl font-bold text-white flex items-center gap-2">
              <Target className="w-5 h-5 text-indigo-400" />
              Créer un Projet Budgétaire
            </SheetTitle>
            <SheetDescription className="text-xs text-zinc-400">
              Définissez un objectif financier et suivez son avancement en temps réel
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Nom du projet *</label>
              <Input
                type="text"
                placeholder="Ex: Vacances au Japon, Apport Immo..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="bg-zinc-900 border-white/10 text-white text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">Budget Cible (€) *</label>
                <Input
                  type="number"
                  placeholder="Ex: 5000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  required
                  className="bg-zinc-900 border-white/10 text-white text-sm"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-zinc-300">Catégorie</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 text-white text-xs h-10 focus:ring-indigo-500"
                >
                  <option value="Voyage">Voyage</option>
                  <option value="Épargne">Épargne & Investissement</option>
                  <option value="Logement">Logement & Travaux</option>
                  <option value="Véhicule">Véhicule</option>
                  <option value="Tech">Matériel High-Tech</option>
                  <option value="Sécurité">Fonds d'Urgence</option>
                </select>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Date d'échéance prévisionnelle</label>
              <Input
                type="text"
                placeholder="Ex: 31 Août 2026"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="bg-zinc-900 border-white/10 text-white text-sm"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-zinc-300">Description (optionnel)</label>
              <Input
                type="text"
                placeholder="Détails, notes ou objectifs particuliers..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-zinc-900 border-white/10 text-white text-sm"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-2">
            <Button
              type="submit"
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-5 shadow-lg shadow-indigo-600/20"
            >
              Créer le Projet
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-white/10 bg-zinc-900 text-zinc-300"
            >
              Annuler
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  )
}
