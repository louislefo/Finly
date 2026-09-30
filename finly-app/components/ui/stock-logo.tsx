"use client"

import React, { useState } from "react"
import { cn } from "@/lib/utils"

const STOCK_DOMAIN_MAP: Record<string, string> = {
  // US Tech & Equities
  AAPL: "apple.com",
  NVDA: "nvidia.com",
  MSFT: "microsoft.com",
  AMZN: "amazon.com",
  GOOGL: "google.com",
  GOOG: "google.com",
  TSLA: "tesla.com",
  META: "meta.com",
  "BRK-B": "berkshirehathaway.com",

  // European Equities
  "MC.PA": "lvmh.com",
  "TTE.PA": "totalenergies.com",
  "ASML.AS": "asml.com",
  "SAN.PA": "sanofi.com",
  "SAP.DE": "sap.com",
  "AI.PA": "airliquide.com",
  "RMS.PA": "hermes.com",
  "BNP.PA": "bnpparibas.com",
  "AIR.PA": "airbus.com",
  "OR.PA": "loreal.com",
  "SU.PA": "se.com",
  "KER.PA": "kering.com",

  // ETFs
  "CW8.PA": "amundi.fr",
  "VUAA.PA": "vanguard.com",
  "UST.PA": "lyxoretf.com",
  "EM.PA": "amundietf.fr",
  "ESE.PA": "bnpparibas-am.com",

  // Indices
  "^FCHI": "euronext.com",
  "^GSPC": "spglobal.com",
  "^IXIC": "nasdaq.com",
  "^GDAXI": "deutsche-boerse.com",
  "^STOXX50E": "stoxx.com",
}

const CRYPTO_ICONS: Record<string, string> = {
  BTC: "https://assets.coincap.io/assets/icons/btc@2x.png",
  ETH: "https://assets.coincap.io/assets/icons/eth@2x.png",
  SOL: "https://assets.coincap.io/assets/icons/sol@2x.png",
  BNB: "https://assets.coincap.io/assets/icons/bnb@2x.png",
  XRP: "https://assets.coincap.io/assets/icons/xrp@2x.png",
}

interface StockLogoProps {
  symbol: string
  name?: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

export function StockLogo({
  symbol,
  name,
  size = "md",
  className,
}: StockLogoProps) {
  const [hasError, setHasError] = useState(false)
  const cleanSymbol = (symbol || "").trim().toUpperCase()

  const sizeClasses = {
    sm: "w-6 h-6 text-[10px] rounded-lg",
    md: "w-8 h-8 text-xs rounded-xl",
    lg: "w-11 h-11 text-sm rounded-2xl",
    xl: "w-14 h-14 text-base rounded-2xl",
  }

  // Check Crypto icon first
  if (CRYPTO_ICONS[cleanSymbol]) {
    if (!hasError) {
      return (
        <div
          className={cn(
            "shrink-0 bg-[#18181B] border border-white/10 flex items-center justify-center p-1 overflow-hidden select-none",
            sizeClasses[size],
            className
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={CRYPTO_ICONS[cleanSymbol]}
            alt={cleanSymbol}
            onError={() => setHasError(true)}
            className="w-full h-full object-contain rounded-full"
            loading="lazy"
          />
        </div>
      )
    }
  }

  // Get domain for stock or index
  const domain = STOCK_DOMAIN_MAP[cleanSymbol]
  const logoUrl = domain
    ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    : null

  if (logoUrl && !hasError) {
    return (
      <div
        className={cn(
          "shrink-0 bg-white p-1 flex items-center justify-center overflow-hidden border border-white/10 shadow-sm select-none",
          sizeClasses[size],
          className
        )}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoUrl}
          alt={name || cleanSymbol}
          onError={() => setHasError(true)}
          className="w-full h-full object-contain"
          loading="lazy"
        />
      </div>
    )
  }

  // Fallback Initials Avatar
  const initials = cleanSymbol.replace(/[^A-Z0-9]/g, "").slice(0, 3) || "STK"
  return (
    <div
      className={cn(
        "shrink-0 bg-zinc-800 border border-white/10 flex items-center justify-center font-mono font-bold text-zinc-300 select-none shadow-sm",
        sizeClasses[size],
        className
      )}
    >
      {initials}
    </div>
  )
}
