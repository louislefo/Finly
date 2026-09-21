"use client"

import React, { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getLineFaceAvatarUri } from "@/lib/avatar"
import { useI18n } from "@/components/i18n-context"
import { Dices, Check, User as UserIcon } from "lucide-react"

const DEFAULT_SEEDS = [
  "felix",
  "luna",
  "oliver",
  "maya",
  "alex",
  "chloe",
  "milo",
  "sophie",
]

interface AvatarPickerModalProps {
  isOpen: boolean
  onClose: () => void
  currentSeed?: string
  initials: string
  onSave: (seed: string | null) => void
}

export function AvatarPickerModal({
  isOpen,
  onClose,
  currentSeed,
  initials,
  onSave,
}: AvatarPickerModalProps) {
  const { t } = useI18n()

  const [selectedSeed, setSelectedSeed] = useState<string | null>(currentSeed || null)
  const [seeds, setSeeds] = useState<string[]>(DEFAULT_SEEDS)
  const [customInput, setCustomInput] = useState<string>("")

  // Reset internal state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSelectedSeed(currentSeed || null)
      setCustomInput("")
    }
  }, [isOpen, currentSeed])

  const handleRandomize = () => {
    const fresh = Array.from({ length: 8 }, () =>
      Math.random().toString(36).substring(2, 8)
    )
    setSeeds(fresh)
  }

  const handleCustomChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setCustomInput(val)
    if (val.trim()) {
      setSelectedSeed(val.trim())
    }
  }

  const handleSelectInitials = () => {
    setSelectedSeed(null)
    setCustomInput("")
  }

  const previewUri = useMemo(() => {
    if (!selectedSeed) return null
    return getLineFaceAvatarUri(selectedSeed)
  }, [selectedSeed])

  const handleConfirm = () => {
    onSave(selectedSeed)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md p-6 bg-[#18181B] border-white/10 text-white rounded-3xl shadow-2xl">
        <DialogHeader className="p-0 text-left">
          <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
            <UserIcon className="w-4 h-4 text-indigo-400" />
            <span>{t.accounts.avatarPickerTitle}</span>
          </DialogTitle>
          <p className="text-xs text-zinc-400 mt-1">
            {t.accounts.avatarPickerDesc}
          </p>
        </DialogHeader>

        {/* Selected Avatar Hero Preview */}
        <div className="flex flex-col items-center justify-center py-4 bg-zinc-950/60 rounded-2xl border border-white/5 mt-2">
          <Avatar className="h-20 w-20 ring-2 ring-indigo-500/40 border border-indigo-400/20 shadow-lg">
            {previewUri ? (
              <AvatarImage src={previewUri} alt="Line Face Preview" />
            ) : null}
            <AvatarFallback className="bg-gradient-to-br from-indigo-500 to-indigo-700 text-white font-bold text-xl tracking-wide">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="text-[11px] text-zinc-400 mt-2 font-mono">
            {selectedSeed ? `seed: "${selectedSeed}"` : t.accounts.useInitials}
          </span>
        </div>

        {/* DiceBear Line Face Grid */}
        <div className="flex flex-col gap-2 mt-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-300">
              Suggestions Line Face
            </span>
            <button
              type="button"
              onClick={handleRandomize}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium transition-colors cursor-pointer"
            >
              <Dices className="w-3.5 h-3.5" />
              <span>{t.accounts.randomizeAvatars}</span>
            </button>
          </div>

          <div className="grid grid-cols-4 gap-2.5">
            {seeds.map((seed) => {
              const uri = getLineFaceAvatarUri(seed)
              const isSelected = selectedSeed?.toLowerCase() === seed.toLowerCase()
              return (
                <button
                  key={seed}
                  type="button"
                  onClick={() => {
                    setSelectedSeed(seed)
                    setCustomInput("")
                  }}
                  className={`relative p-2 rounded-2xl border transition-all cursor-pointer flex flex-col items-center justify-center group aspect-square ${
                    isSelected
                      ? "bg-indigo-600/15 border-indigo-500 ring-2 ring-indigo-500/50 shadow-md"
                      : "bg-zinc-900/80 border-white/10 hover:border-white/20 hover:bg-zinc-800"
                  }`}
                >
                  <img
                    src={uri}
                    alt={seed}
                    className="w-12 h-12 object-contain group-hover:scale-105 transition-transform"
                  />
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-indigo-600 flex items-center justify-center text-white">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Custom Seed Input & Initials Fallback */}
        <div className="flex flex-col gap-2.5 mt-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-zinc-400">
              {t.accounts.customSeed}
            </label>
            <Input
              type="text"
              value={customInput}
              onChange={handleCustomChange}
              placeholder={t.accounts.customSeedPlaceholder}
              className="bg-zinc-900 border-white/10 text-white rounded-xl text-xs h-10 focus:border-indigo-500"
            />
          </div>

          <button
            type="button"
            onClick={handleSelectInitials}
            className={`w-full py-2 px-3 rounded-xl border text-xs font-medium transition-all text-center cursor-pointer ${
              selectedSeed === null
                ? "bg-indigo-600/15 border-indigo-500 text-indigo-300 font-semibold"
                : "bg-zinc-900/50 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            {t.accounts.useInitials}
          </button>
        </div>

        <DialogFooter className="mt-4 flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-xl text-xs h-9 px-4 cursor-pointer"
          >
            {t.common.cancel}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 px-5 font-semibold shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            {t.accounts.saveAvatar}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
