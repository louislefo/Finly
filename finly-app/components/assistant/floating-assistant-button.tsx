"use client"

import React, { useState, useEffect, useCallback } from "react"
import { useI18n } from "@/components/i18n-context"
import { AssistantStatus, OllamaInstallGuide } from "@/lib/types/finance"
import { AssistantAPI } from "@/lib/api/assistant-api"
import { AssistantChatPanel } from "./assistant-chat-panel"
import { Button } from "@/components/ui/button"
import { Bot } from "lucide-react"

export function FloatingAssistantButton() {
  const { t } = useI18n()
  const [isEnabled, setIsEnabled] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [aiSettings, setAiSettings] = useState<{ mode?: string; apiKey?: string } | null>(null)
  const [status, setStatus] = useState<AssistantStatus | null>(null)
  const [installGuide, setInstallGuide] = useState<OllamaInstallGuide | null>(null)

  // Synchronize enablement from localStorage & custom events
  useEffect(() => {
    const checkEnabled = () => {
      if (typeof window !== "undefined") {
        const stored = localStorage.getItem("finly_assistant_enabled")
        setIsEnabled(stored === "true")
        const setts = localStorage.getItem("finly_ai_settings")
        if (setts) {
          try {
            setAiSettings(JSON.parse(setts))
          } catch {}
        }
      }
    }
    checkEnabled()
    window.addEventListener("finly_assistant_toggled", checkEnabled)
    window.addEventListener("storage", checkEnabled)
    return () => {
      window.removeEventListener("finly_assistant_toggled", checkEnabled)
      window.removeEventListener("storage", checkEnabled)
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    try {
      const res = await AssistantAPI.getStatus()
      if (res?.ollama) {
        setStatus(res.ollama)
      }
      if (res?.install_guide) {
        setInstallGuide(res.install_guide)
      }
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    if (!isEnabled || aiSettings?.mode === "cloud") return
    fetchStatus()
    // Poll status periodically only when local assistant is active
    const interval = setInterval(fetchStatus, 30000)
    return () => clearInterval(interval)
  }, [isEnabled, aiSettings?.mode, fetchStatus])

  if (!isEnabled) {
    return null
  }

  const isCloudMode = aiSettings?.mode === "cloud"
  const isConnected = status?.connected ?? false
  const isModelReady = status?.is_model_available ?? false
  const isReady = isCloudMode
    ? Boolean(aiSettings?.apiKey && aiSettings.apiKey.trim().length > 0)
    : (isConnected && isModelReady)

  return (
    <>
      {/* Floating Chat Panel */}
      <AssistantChatPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        status={status}
        installGuide={installGuide}
        onStatusRefresh={fetchStatus}
      />

      {/* Floating Trigger Pill */}
      <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-40">
        <Button
          onClick={() => setIsOpen(!isOpen)}
          className={`relative h-11 px-3.5 rounded-full bg-zinc-900/95 hover:bg-zinc-800 text-zinc-100 border border-white/10 hover:border-white/20 shadow-xl backdrop-blur-md flex items-center gap-2 transition-all duration-200 group ${
            isOpen ? "ring-2 ring-indigo-500/50" : ""
          }`}
          title={t.assistant.floatingTooltip}
        >
          <div className="size-6 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-indigo-300">
            <Bot className="w-3.5 h-3.5" />
          </div>

          <span className="text-xs font-medium tracking-tight hidden sm:inline">
            {t.assistant.title}
          </span>

          {/* Status Indicator Dot */}
          <span
            className={`size-2 rounded-full border border-zinc-950 ${
              isReady
                ? "bg-emerald-400"
                : isConnected
                ? "bg-amber-400 animate-pulse"
                : "bg-zinc-500"
            }`}
            title={isReady ? t.assistant.statusConnected : t.assistant.statusDisconnected}
          />
        </Button>
      </div>
    </>
  )
}
