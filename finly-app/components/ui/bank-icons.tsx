"use client"

import React, { useState } from "react"

interface BankLogoProps {
  bankId?: string
  bankName?: string
  className?: string
  size?: number
}

const BANK_DOMAINS: Record<string, string> = {
  bourso: "boursobank.com",
  boursobank: "boursobank.com",
  revolut: "revolut.com",
  bnporc: "mabanque.bnpparibas",
  bnp: "mabanque.bnpparibas",
  bnp_paribas: "mabanque.bnpparibas",
  fortuneo: "fortuneo.fr",
  cragr: "credit-agricole.fr",
  ca: "credit-agricole.fr",
  credit_agricole: "credit-agricole.fr",
  sg: "particuliers.sg.fr",
  societe_generale: "particuliers.sg.fr",
  n26: "n26.com",
  creditmutuel: "creditmutuel.fr",
  cm: "creditmutuel.fr",
  cic: "cic.fr",
  ce: "caisse-epargne.fr",
  caissedepargne: "caisse-epargne.fr",
  bp: "banquepopulaire.fr",
  banquepopulaire: "banquepopulaire.fr",
  lcl: "lcl.fr",
  hellobank: "hellobank.fr",
}

export function BankLogo({ bankId, bankName, className = "w-10 h-10", size = 128 }: BankLogoProps) {
  const [hasError, setHasError] = useState(false)
  const targetId = bankId || bankName || "bank"
  const normalizedId = targetId.toLowerCase().replace(/[^a-z0-9_]/g, "")
  const domain = BANK_DOMAINS[normalizedId] || (targetId.includes(".") ? targetId : `${normalizedId}.fr`)
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`

  if (hasError) {
    return (
      <div className={`rounded-xl bg-zinc-800 border border-white/10 flex items-center justify-center font-bold text-white text-xs ${className}`}>
        {targetId.slice(0, 3).toUpperCase()}
      </div>
    )
  }

  return (
    <div className={`rounded-2xl bg-zinc-900/90 border border-white/10 p-2 flex items-center justify-center overflow-hidden shadow-md shrink-0 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={faviconUrl}
        alt={`${targetId} logo`}
        className="w-full h-full object-contain rounded-lg"
        onError={() => setHasError(true)}
      />
    </div>
  )
}
