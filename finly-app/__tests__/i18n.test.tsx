import { describe, it, expect } from "vitest"
import { dictionaries, getDictionary, formatString } from "@/lib/i18n"
import { en } from "@/lib/i18n/dictionaries/en"
import { fr } from "@/lib/i18n/dictionaries/fr"

describe("i18n Dictionaries", () => {
  it("should have default dictionaries for en and fr", () => {
    expect(dictionaries.en).toBeDefined()
    expect(dictionaries.fr).toBeDefined()
  })

  it("should return correct dictionary via getDictionary", () => {
    expect(getDictionary("en")).toEqual(en)
    expect(getDictionary("fr")).toEqual(fr)
    expect(getDictionary("es" as any)).toEqual(en) // fallback to en
  })

  it("should format string templates with parameters", () => {
    const template = "Hello {name}, welcome to {app}!"
    const formatted = formatString(template, { name: "Alice", app: "Finly" })
    expect(formatted).toBe("Hello Alice, welcome to Finly!")
  })

  it("should have matching top-level keys between en and fr dictionaries", () => {
    const enKeys = Object.keys(en).sort()
    const frKeys = Object.keys(fr).sort()
    expect(enKeys).toEqual(frKeys)
  })

  it("should have matching subkeys for all modal dictionaries", () => {
    expect(Object.keys(en.newProjectModal).sort()).toEqual(Object.keys(fr.newProjectModal).sort())
    expect(Object.keys(en.woobModal).sort()).toEqual(Object.keys(fr.woobModal).sort())
    expect(Object.keys(en.connectedAccountsModal).sort()).toEqual(Object.keys(fr.connectedAccountsModal).sort())
    expect(Object.keys(en.bankDetailSheet).sort()).toEqual(Object.keys(fr.bankDetailSheet).sort())
    expect(Object.keys(en.changePasswordModal).sort()).toEqual(Object.keys(fr.changePasswordModal).sort())
    expect(Object.keys(en.csvImportModal).sort()).toEqual(Object.keys(fr.csvImportModal).sort())
    expect(Object.keys(en.importCredentialsModal).sort()).toEqual(Object.keys(fr.importCredentialsModal).sort())
  })
})
