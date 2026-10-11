"use client"

import React, { useState } from "react"
import { useI18n } from "@/components/i18n-context"
import { OllamaStatus, OllamaInstallGuide } from "@/lib/types/finance"
import { AssistantAPI } from "@/lib/api/assistant-api"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Download, RefreshCw, Copy, Check, ExternalLink, Terminal, HardDrive, Play, Power, ShieldCheck } from "lucide-react"

interface OllamaSetupCardProps {
  status: OllamaStatus | null
  installGuide: OllamaInstallGuide | null
  onStatusChange: () => void
}

export function OllamaSetupCard({ status, installGuide, onStatusChange }: OllamaSetupCardProps) {
  const { t } = useI18n()
  const [copied, setCopied] = useState(false)
  const [pulling, setPulling] = useState(false)
  const [starting, setStarting] = useState(false)
  const [progress, setProgress] = useState<{ status: string; percent: number; completed: number; total: number } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const isConnected = status?.connected ?? false
  const isModelReady = status?.is_model_available ?? false
  const isInstalledLocally = status?.is_installed_locally ?? false
  const targetModel = status?.default_model || "qwen2.5:1.5b"

  const handleCopyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setErrorMsg(null)
    try {
      await onStatusChange()
    } finally {
      setTimeout(() => setRefreshing(false), 500)
    }
  }

  const handleStartDaemon = async () => {
    setStarting(true)
    setErrorMsg(null)
    try {
      const res = await AssistantAPI.startDaemon()
      if (res.status === "error") {
        setErrorMsg(res.message || "Impossible de démarrer le moteur IA automatiquement.")
      }
      await onStatusChange()
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors du démarrage du moteur IA.")
    } finally {
      setStarting(false)
    }
  }

  const handleDownloadModel = async () => {
    setPulling(true)
    setErrorMsg(null)
    setProgress({ status: "Démarrage...", percent: 0, completed: 0, total: 0 })

    try {
      await AssistantAPI.streamPullModel(
        targetModel,
        (p) => {
          if (p.error) {
            setErrorMsg(p.error)
            setPulling(false)
          } else {
            setProgress(p)
            if (p.done) {
              setPulling(false)
              onStatusChange()
            }
          }
        },
        status?.base_url
      )
    } catch (err: any) {
      setErrorMsg(err?.message || "Erreur lors du téléchargement")
      setPulling(false)
    }
  }

  return (
    <div className="p-4 rounded-xl bg-zinc-900/90 border border-white/10 space-y-4">
      {!isConnected ? (
        // Case 1: AI Engine is offline / not connected
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h4 className="text-sm font-semibold text-white tracking-tight">
                {t.assistant.engineDisconnectedTitle}
              </h4>
              <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                {isInstalledLocally ? t.assistant.autoStartDesc : t.assistant.engineDisconnectedDesc}
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing || starting}
              className="h-8 px-2.5 text-xs border-white/10 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-300 shrink-0"
              title={t.assistant.refreshStatus}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing || starting ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {isInstalledLocally ? (
            // Engine is installed locally: provide 1-click Start button
            <div className="pt-2">
              <Button
                onClick={handleStartDaemon}
                disabled={starting}
                className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
              >
                {starting ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.assistant.startingDaemon}</span>
                  </>
                ) : (
                  <>
                    <Power className="w-3.5 h-3.5" />
                    <span>{t.assistant.startDaemonBtn}</span>
                  </>
                )}
              </Button>
            </div>
          ) : (
            // Engine is not installed: guide the user smoothly to install
            installGuide && (
              <div className="space-y-2 pt-1 border-t border-white/5">
                <div className="flex items-center justify-between text-xs text-zinc-300">
                  <span className="font-medium text-zinc-200">{installGuide.title}</span>
                  {installGuide.download_url && (
                    <a
                      href={installGuide.download_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 hover:underline"
                    >
                      <span>{t.assistant.installEngineBtn}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                {installGuide.command && (
                  <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-black/40 border border-white/5 font-mono text-[11px] text-zinc-300">
                    <div className="flex items-center gap-1.5 truncate">
                      <Terminal className="w-3 h-3 text-zinc-500 shrink-0" />
                      <span className="truncate">{installGuide.command}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCopyCommand(installGuide.command)}
                      className="h-6 px-2 text-[10px] text-zinc-400 hover:text-white shrink-0"
                    >
                      {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                )}
              </div>
            )
          )}

          {errorMsg && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
              {errorMsg}
            </p>
          )}
        </div>
      ) : !isModelReady ? (
        // Case 2: AI Engine is running, but model needs to be pulled
        <div className="space-y-3">
          <div>
            <h4 className="text-sm font-semibold text-white tracking-tight">
              {t.assistant.engineMissingModelTitle}
            </h4>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {t.assistant.engineMissingModelDesc}
            </p>
          </div>

          <div className="p-2.5 rounded-lg bg-black/40 border border-white/5 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-zinc-200 font-mono">
                <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
                <span>{targetModel}</span>
              </div>
              <span className="text-[11px] text-zinc-400">~980 MB</span>
            </div>

            {pulling && progress && (
              <div className="space-y-1.5 pt-1">
                <Progress value={progress.percent} className="h-1.5 bg-zinc-800" />
                <div className="flex justify-between text-[10px] text-zinc-400 font-mono">
                  <span>{progress.status}</span>
                  <span>{progress.percent}%</span>
                </div>
              </div>
            )}
          </div>

          {errorMsg && (
            <p className="text-xs text-rose-400 bg-rose-500/10 p-2 rounded border border-rose-500/20">
              {errorMsg}
            </p>
          )}

          <Button
            onClick={handleDownloadModel}
            disabled={pulling}
            className="w-full h-9 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-indigo-600/20"
          >
            {pulling ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{t.assistant.downloadingModel}</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>{t.assistant.downloadModelBtn}</span>
              </>
            )}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
