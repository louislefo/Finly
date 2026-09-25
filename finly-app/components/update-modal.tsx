"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Download,
  Terminal,
  ExternalLink,
  Copy,
  Check,
  Sparkles,
  ArrowUpCircle,
  Monitor,
  Box,
} from "lucide-react"
import { VersionCheckInfo } from "@/lib/types/finance"
import { useI18n } from "@/components/i18n-context"

interface UpdateModalProps {
  isOpen: boolean
  onClose: () => void
  updateInfo: VersionCheckInfo | null
}

export function UpdateModal({ isOpen, onClose, updateInfo }: UpdateModalProps) {
  const { t } = useI18n()
  const [hasCopied, setHasCopied] = useState(false)

  if (!updateInfo) return null

  const handleCopyCommand = () => {
    const cmd = updateInfo.container_update_cmd || "docker compose pull && docker compose up -d"
    navigator.clipboard.writeText(cmd)
    setHasCopied(true)
    setTimeout(() => setHasCopied(false), 2000)
  }

  const handleDownload = () => {
    if (updateInfo.download_url) {
      window.open(updateInfo.download_url, "_blank")
    } else if (updateInfo.release_url) {
      window.open(updateInfo.release_url, "_blank")
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md sm:max-w-lg bg-[#18181B] border border-white/10 text-white rounded-3xl p-6 shadow-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center size-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                <ArrowUpCircle className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white tracking-tight">
                  {t.update.newVersionAvailable}
                </DialogTitle>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-zinc-400 font-mono">
                    v{updateInfo.current_version.replace(/^v/, "")}
                  </span>
                  <span className="text-xs text-zinc-600">→</span>
                  <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-[11px] font-mono font-semibold px-2 py-0.5">
                    {updateInfo.latest_version}
                  </Badge>
                </div>
              </div>
            </div>

            {updateInfo.is_container ? (
              <Badge variant="outline" className="border-white/10 text-zinc-400 flex items-center gap-1 text-[11px]">
                <Box className="w-3 h-3" />
                Docker
              </Badge>
            ) : (
              <Badge variant="outline" className="border-white/10 text-zinc-400 flex items-center gap-1 text-[11px]">
                <Monitor className="w-3 h-3" />
                Desktop
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Content based on environment */}
        <div className="space-y-4 my-2">
          {updateInfo.release_notes ? (
            <div className="space-y-1.5">
              <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                {t.update.whatsNew}
              </span>
              <div className="max-h-40 overflow-y-auto rounded-2xl bg-black/40 border border-white/5 p-3.5 text-xs text-zinc-300 leading-relaxed font-mono whitespace-pre-line select-text">
                {updateInfo.release_notes}
              </div>
            </div>
          ) : null}

          {updateInfo.is_container ? (
            <div className="space-y-2 rounded-2xl bg-zinc-900/60 border border-white/5 p-3.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-zinc-200">
                <Terminal className="w-4 h-4 text-indigo-400" />
                <span>{t.update.containerUpdateTitle}</span>
              </div>
              <p className="text-[11px] text-zinc-400">
                {t.update.containerUpdateDesc}
              </p>
              <div className="flex items-center justify-between gap-2 bg-black/60 border border-white/10 rounded-xl px-3 py-2 mt-1.5">
                <code className="text-xs font-mono text-indigo-300 select-all truncate">
                  {updateInfo.container_update_cmd}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleCopyCommand}
                  className="h-7 px-2 text-xs text-zinc-400 hover:text-white hover:bg-white/10 shrink-0 cursor-pointer"
                >
                  {hasCopied ? (
                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-zinc-900/40 border border-white/5 p-3 text-xs text-zinc-400 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                {t.update.updateAvailable} ({updateInfo.latest_version})
              </span>
            </div>
          )}
        </div>

        <DialogFooter className="flex flex-row items-center justify-between sm:justify-between gap-2 pt-2 border-t border-white/5">
          {updateInfo.release_url ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.open(updateInfo.release_url, "_blank")}
              className="text-xs text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>{t.update.viewOnGithub}</span>
            </Button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-xs text-zinc-400 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              {t.update.dismiss}
            </Button>

            {!updateInfo.is_container && (
              <Button
                size="sm"
                onClick={handleDownload}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1.5 rounded-xl px-3.5 shadow-md shadow-indigo-600/20 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{t.update.downloadAndInstall}</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
