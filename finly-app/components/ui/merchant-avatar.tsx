"use client"

import React, { useState, useMemo } from "react"
import {
  ShoppingBag,
  Car,
  Home as HomeIcon,
  Film,
  ArrowDownRight,
  Tag,
  Compass,
  HeartPulse,
  PiggyBank,
  Building2,
  LucideIcon,
  Camera,
} from "lucide-react"
import { getBrandLogoUrl } from "@/lib/utils/brand-logos"

interface MerchantAvatarProps {
  merchantName?: string | null
  rawLabel?: string | null
  logoUrl?: string | null
  category?: string | null
  isPositive?: boolean
  className?: string
  iconClassName?: string
  editable?: boolean
  onClick?: () => void
}

export function getCategoryIconComponent(category?: string | null): LucideIcon {
  switch (category) {
    case "Alimentation":
      return ShoppingBag
    case "Transports":
      return Car
    case "Logement":
      return HomeIcon
    case "Abonnements":
      return Film
    case "Loisirs & Sorties":
      return Compass
    case "Santé & Bien-être":
      return HeartPulse
    case "Virements & Épargne":
      return PiggyBank
    case "Revenus":
    case "Virement Reçu":
      return ArrowDownRight
    case "Immobilier":
      return Building2
    default:
      return Tag
  }
}

export function MerchantAvatar({
  merchantName,
  rawLabel,
  logoUrl,
  category,
  isPositive = false,
  className = "w-9 h-9 rounded-xl",
  iconClassName = "w-4 h-4",
  editable = false,
  onClick,
}: MerchantAvatarProps) {
  const [imgError, setImgError] = useState<boolean>(false)

  const logoSrc = useMemo(() => {
    return getBrandLogoUrl(merchantName, rawLabel, logoUrl)
  }, [merchantName, rawLabel, logoUrl])

  const IconComponent = getCategoryIconComponent(category)

  const cursorStyle = editable || onClick ? "cursor-pointer group relative" : ""

  if (logoSrc && !imgError) {
    return (
      <div
        onClick={onClick}
        className={`bg-zinc-900 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden p-1.5 shadow-sm transition-all ${
          editable ? "hover:border-indigo-500/50 hover:ring-2 hover:ring-indigo-500/20" : ""
        } ${cursorStyle} ${className}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt={merchantName || "Logo"}
          className="w-full h-full object-contain rounded-md select-none"
          loading="lazy"
          onError={() => setImgError(true)}
        />
        {editable && (
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
            <Camera className="w-3.5 h-3.5 text-white" />
          </div>
        )}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={`flex items-center justify-center shrink-0 transition-all ${
        isPositive
          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
          : "bg-zinc-900 text-zinc-300 border border-white/5"
      } ${editable ? "hover:border-indigo-500/50 hover:ring-2 hover:ring-indigo-500/20" : ""} ${cursorStyle} ${className}`}
    >
      <IconComponent className={iconClassName} />
      {editable && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl">
          <Camera className="w-3.5 h-3.5 text-white" />
        </div>
      )}
    </div>
  )
}
