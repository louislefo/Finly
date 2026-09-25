"use client"

import React, { useState, useEffect, useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import {
  Terminal,
  ExternalLink,
  Copy,
  Check,
  ArrowUpCircle,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react"
import { VersionCheckInfo, UpdateDownloadStatus } from "@/lib/types/finance"
import { FinlyAPI } from "@/lib/api/finly-api"
import { useI18n } from "@/components/i18n-context"

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  updateInfo: VersionCheckInfo | null
}

export function UpdateModal({ isOpen, onClose, updateInfo }: UpdateModalProps) {
  const { t } = useI18n()
  const [hasCopied, setHasCopied] = useState(false)
  const [downloadStatus, setDownloadStatus] = useState<UpdateDownloadStatus | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updatePhase, setUpdatePhase] = useState<"idle" | "downloading" | "installing">("idle")
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    }
  }, [])

  if (!updateInfo) return null

  const handleCopyCommand = () => {
    const cmd = updateInfo.container_update_cmd || "docker compose pull && docker compose up -d"
    navigator.clipboard.writeText(cmd)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  const handleStartUpdate = async () => {
    try {
      setIsUpdating(true)
      setUpdatePhase("downloading")
      const initialStatus = await FinlyAPI.startUpdateDownload()
      setDownloadStatus(initialStatus)

      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = setInterval(async () => {
        try {
          const status = await FinlyAPI.getUpdateDownloadStatus()
          setDownloadStatus(status)

          if (status.status === "ready") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            setUpdatePhase("installing")
            // Automatically apply update, close app, run setup and relaunch
            await FinlyAPI.applyUpdate()
          } else if (status.status === "error") {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
            setUpdatePhase("idle")
            setIsUpdating(false)
            if (updateInfo.download_url) {
              window.open(updateInfo.download_url, "_blank")
            }
          }
        } catch {
          // ignore transient errors
        }
      }, 500)
    } catch {
      setIsUpdating(false)
      setUpdatePhase("idle")
      if (updateInfo.download_url) {
        window.open(updateInfo.download_url, "_blank")
      }
    }
  }

  const progress = downloadStatus?.progress_percent ?? 0

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && !isUpdating && onClose()}>
      <DialogContent className="max-w-[340px] sm:max-w-[360px] bg-[#18181B] border border-white/10 text-white rounded-3xl p-5 shadow-2xl">
        <DialogHeader className="space-y-2 text-center items-center">
          <div className="flex items-center justify-center size-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 mb-1">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>

          <DialogTitle className="text-base font-bold text-white tracking-tight">
            {t.update.updateAvailable}
          </DialogTitle>

          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-zinc-400 font-mono">
              v{updateInfo.current_version.replace(/^v/, "")}
            </span>
            <span className="text-xs text-zinc-600">→</span>
            <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-semibold px-2 py-0.5">
              {updateInfo.latest_version}
            </Badge>
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="my-2 space-y-3">
          {updateInfo.is_container ? (
            <div className="space-y-2 rounded-2xl bg-black/40 border border-white/5 p-3">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-zinc-300">
                <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                <span>Docker</span>
              </div>
              <div className="flex items-center justify-between gap-1.5 bg-zinc-900 border border-white/10 rounded-xl px-2.5 py-1.5">
                <code className="text-[11px] font-mono text-indigo-300 truncate select-all">
                  {updateInfo.container_update_cmd}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyCommand}
                  className="h-6 px-1.5 text-xs text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                >
                  {hasCopied ? (
                    <Check className="w-3 h-3 text-emerald-400" />
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {updatePhase === "downloading" && (
                <div className="space-y-2 rounded-2xl bg-black/40 border border-white/5 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-zinc-300 flex items-center gap-1.5 font-medium text-[11px]">
                      <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                      {t.update.downloadingUpdate}
                    </span>
                    <span className="text-indigo-400 font-mono font-bold text-xs">{progress}%</span>
                  </div>
                  <Progress value={progress} className="h-1.5 bg-zinc-800" />
                </div>
              )}

              {updatePhase === "installing" && (
                <div className="rounded-2xl bg-indigo-500/10 border border-indigo-500/20 p-3 text-center space-y-1">
                  <RefreshCw className="w-4 h-4 animate-spin text-indigo-400 mx-auto" />
                  <span className="text-xs text-indigo-300 font-semibold block">Lancement du programme...</span>
                  <span className="text-[10px] text-zinc-400 block">Finly va redémarrer automatiquement.</span>
                </div>
              )}

              {updatePhase === "idle" && (
                <Button
                  onClick={handleStartUpdate}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold py-2.5 rounded-xl shadow-md shadow-indigo-600/20 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <ArrowUpCircle className="w-4 h-4" />
                  <span>Mettre à jour maintenant</span>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Minimal Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px]">
          {updateInfo.release_url ? (
            <button
              type="button"
              onClick={() => window.open(updateInfo.release_url, "_blank")}
              className="text-zinc-500 hover:text-zinc-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>GitHub</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          ) : (
            <div />
          )}

          {!isUpdating && (
            <button
              type="button"
              onClick={onClose}
              className="text-zinc-500 hover:text-zinc-300 transition-colors cursor-pointer"
            >
              {t.update.dismiss}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
