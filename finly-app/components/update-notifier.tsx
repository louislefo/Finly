"use client"

import React, { useState, useEffect } from "react"
import { ArrowUpCircle, Sparkles } from "lucide-react"
import { FinlyAPI } from "@/lib/api/finly-api"
import { VersionCheckInfo } from "@/lib/types/finance"
import { useI18n } from "@/components/i18n-context"
import { UpdateModal } from "@/components/update-modal"
import { cn } from "@/lib/utils"

export function UpdateNotifier() {
  const { t } = useI18n()
  const [updateInfo, setUpdateInfo] = useState<VersionCheckInfo | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)

  useEffect(() => {
    let isMounted = true

    const checkForUpdates = async () => {
      try {
        const info = await FinlyAPI.checkAppVersion()
        if (isMounted && info && info.has_update) {
          setUpdateInfo(info)
        }
      } catch {
        // Silently fail if offline or API unavailable
      }
    }

    checkForUpdates()

    // Poll every 30 minutes in background
    const interval = setInterval(checkForUpdates, 30 * 60 * 1000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [])

  if (!updateInfo || !updateInfo.has_update) {
    return null
  }

  return (
    <>
      {/* Expanded Sidebar View */}
      <div className="group-data-[collapsible=icon]:hidden mb-2 px-1">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className={cn(
            "w-full flex items-center justify-between p-2.5 rounded-2xl",
            "bg-gradient-to-r from-indigo-950/40 via-purple-950/30 to-indigo-900/30",
            "border border-indigo-500/30 hover:border-indigo-400/60",
            "transition-all duration-200 cursor-pointer shadow-sm hover:shadow-indigo-500/10",
            "text-left group/update active:scale-[0.98]"
          )}
        >
          <div className="flex items-center gap-2.5 truncate">
            <div className="relative flex items-center justify-center size-7 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
              <Sparkles className="w-3.5 h-3.5 animate-pulse" />
              <span className="absolute -top-0.5 -right-0.5 size-2 bg-emerald-400 rounded-full ring-2 ring-zinc-950 animate-ping" />
              <span className="absolute -top-0.5 -right-0.5 size-2 bg-emerald-400 rounded-full ring-2 ring-zinc-950" />
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-bold text-white group-hover/update:text-indigo-200 transition-colors truncate">
                {t.update.newVersionAvailable}
              </span>
              <span className="text-[10px] text-zinc-400 font-mono">
                {updateInfo.latest_version}
              </span>
            </div>
          </div>

          <div className="size-6 rounded-lg bg-white/5 group-hover/update:bg-indigo-500/20 flex items-center justify-center text-zinc-400 group-hover/update:text-white transition-colors shrink-0">
            <ArrowUpCircle className="w-3.5 h-3.5" />
          </div>
        </button>
      </div>

      {/* Collapsed Sidebar View (Emblem Icon Only with badge) */}
      <div className="hidden group-data-[collapsible=icon]:flex justify-center mb-2">
        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          title={`${t.update.newVersionAvailable} (${updateInfo.latest_version})`}
          className={cn(
            "relative flex items-center justify-center size-10 rounded-2xl",
            "bg-indigo-500/15 border border-indigo-500/40 text-indigo-300 hover:text-white hover:bg-indigo-500/25",
            "transition-all duration-200 cursor-pointer active:scale-95 shadow-sm"
          )}
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
          <span className="absolute -top-1 -right-1 size-2.5 bg-emerald-400 rounded-full ring-2 ring-zinc-950 animate-ping" />
          <span className="absolute -top-1 -right-1 size-2.5 bg-emerald-400 rounded-full ring-2 ring-zinc-950" />
        </button>
      </div>

      {/* Update Detail & Action Modal */}
      <UpdateModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        updateInfo={updateInfo}
      />
    </>
  )
}
