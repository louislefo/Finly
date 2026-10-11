"use client"

import React, { useState, useEffect } from "react"
import { useI18n } from "@/components/i18n-context"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShieldCheck, Cpu } from "lucide-react"

interface OnboardingAssistantPromptProps {
  onEnable: () => void
}

export function OnboardingAssistantPrompt({ onEnable }: OnboardingAssistantPromptProps) {
  const { t } = useI18n()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    const hasSeenPrompt = localStorage.getItem("finly_assistant_prompt_seen")
    if (!hasSeenPrompt) {
      // Show prompt after a short delay on initial visit
      const timer = setTimeout(() => {
        setOpen(true)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [])

  const handleEnable = () => {
    localStorage.setItem("finly_assistant_prompt_seen", "true")
    localStorage.setItem("finly_assistant_enabled", "true")
    setOpen(false)
    onEnable()
  }

  const handleDismiss = () => {
    localStorage.setItem("finly_assistant_prompt_seen", "true")
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md bg-zinc-950 border border-white/10 text-zinc-100 p-6 rounded-2xl shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="size-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Cpu className="w-5 h-5" />
          </div>
          <DialogTitle className="text-lg font-semibold tracking-tight text-white">
            {t.assistant.setupPromptTitle}
          </DialogTitle>
          <DialogDescription className="text-sm text-zinc-400 leading-relaxed">
            {t.assistant.setupPromptDesc}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 rounded-xl bg-zinc-900/60 border border-white/5 text-xs text-zinc-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{t.assistant.privacyBadge}</span>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row items-center gap-2 pt-2 sm:pt-4">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            className="w-full sm:w-auto h-9 text-xs text-zinc-400 hover:text-white"
          >
            {t.assistant.laterBtn}
          </Button>
          <Button
            onClick={handleEnable}
            className="w-full sm:w-auto h-9 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium"
          >
            {t.assistant.enableAssistantBtn}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
