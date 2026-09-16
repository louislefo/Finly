import { Language, TranslationDictionary } from "./types"
import { en } from "./dictionaries/en"
import { fr } from "./dictionaries/fr"

export const dictionaries: Record<Language, TranslationDictionary> = {
  en,
  fr,
}

export function getDictionary(lang: Language): TranslationDictionary {
  return dictionaries[lang] || dictionaries.en
}

export function formatString(template: string, params?: Record<string, string | number>): string {
  if (!params) return template
  let result = template
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(new RegExp(`\\{${key}\\}`, "g"), String(value))
  }
  return result
}

export * from "./types"
