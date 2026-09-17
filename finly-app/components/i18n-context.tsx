"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { Language, TranslationDictionary } from "@/lib/i18n/types"
import { dictionaries, getDictionary, formatString } from "@/lib/i18n"
import { FinlyAPI } from "@/lib/api/finly-api"
import { useAuth } from "@/components/auth-context"

interface I18nContextType {
  language: Language
  setLanguage: (lang: Language) => Promise<void>
  t: TranslationDictionary
  format: (template: string, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType | undefined>(undefined)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [language, setLanguageState] = useState<Language>("en")
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

  // Initialize language from user preference or localStorage (default: en)
  useEffect(() => {
    try {
      const stored = typeof window !== "undefined" ? localStorage.getItem("finly_language") : null
      if (user?.language === "fr" || user?.language === "en") {
        setLanguageState(user.language as Language)
        if (typeof window !== "undefined") {
          localStorage.setItem("finly_language", user.language)
          document.documentElement.lang = user.language
        }
      } else if (stored === "fr" || stored === "en") {
        setLanguageState(stored as Language)
        if (typeof window !== "undefined") {
          document.documentElement.lang = stored
        }
      } else {
        setLanguageState("en")
        if (typeof window !== "undefined") {
          localStorage.setItem("finly_language", "en")
          document.documentElement.lang = "en"
        }
      }
    } catch {
      setLanguageState("en")
    } finally {
      setIsInitialized(true)
    }
  }, [user?.language])

  const setLanguage = useCallback(
    async (newLang: Language) => {
      setLanguageState(newLang)
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("finly_language", newLang)
          document.documentElement.lang = newLang
        }
        if (user) {
          await FinlyAPI.updatePreferences({ language: newLang })
        }
      } catch {
        // Continue with local language change even if offline
      }
    },
    [user]
  )

  const dictionary = getDictionary(language)

  return (
    <I18nContext.Provider
      value={{
        language,
        setLanguage,
        t: dictionary,
        format: formatString,
      }}
    >
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(I18nContext)
  if (!context) {
    // Fallback if rendered outside LanguageProvider
    return {
      language: "en" as Language,
      setLanguage: async () => {},
      t: dictionaries.en,
      format: formatString,
    }
  }
  return context
}
