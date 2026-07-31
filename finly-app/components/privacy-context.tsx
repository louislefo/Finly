"use client"

import React, { createContext, useContext, useState, useEffect } from "react"

interface PrivacyContextType {
  isPrivate: boolean
  togglePrivacy: () => void
  formatAmount: (amount: number, currency?: string) => string
}

const PrivacyContext = createContext<PrivacyContextType | undefined>(undefined)

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivate, setIsPrivate] = useState<boolean>(false)

  const togglePrivacy = () => {
    setIsPrivate((prev) => !prev)
  }

  const formatAmount = (amount: number, currency: string = "€"): string => {
    if (isPrivate) {
      return `•••• ${currency}`
    }
    const formatted = new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
    return `${formatted} ${currency}`
  }

  return (
    <PrivacyContext.Provider value={{ isPrivate, togglePrivacy, formatAmount }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  const context = useContext(PrivacyContext)
  if (!context) {
    throw new Error("usePrivacy must be used within PrivacyProvider")
  }
  return context
}
