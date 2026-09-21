import { describe, it, expect, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, type, ...props }: any) => (
    <button onClick={onClick} type={type} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: any) => <span {...props}>{children}</span>,
}))

import { fr } from "@/lib/i18n/dictionaries/fr"

vi.mock("@/components/i18n-context", () => ({
  useI18n: () => ({
    t: fr,
    language: "fr",
    setLanguage: vi.fn(),
    format: (s: string) => s,
  }),
}))

import { SyncFeedbackModal } from "@/components/modals/sync-feedback-modal"
import { SyncResult } from "@/lib/types/finance"

describe("SyncFeedbackModal Component", () => {
  it("renders success state when sync succeeds with no errors", () => {
    const successResult: SyncResult = {
      status: "success",
      synced_accounts: 2,
      new_transactions: 5,
      errors: [],
    }

    render(
      <SyncFeedbackModal
        isOpen={true}
        onClose={() => {}}
        syncResult={successResult}
      />
    )

    expect(screen.getByText("Synchronisation réussie")).toBeDefined()
  })

  it("renders error state with bank details and trigger fix button when errors exist", () => {
    const onFixMock = vi.fn()
    const errorResult: SyncResult = {
      status: "error",
      synced_accounts: 0,
      new_transactions: 0,
      errors: [
        {
          connection_id: "conn_bourso_1",
          bank_name: "BoursoBank",
          module_name: "bourso",
          login: "12345678",
          backend_name: "bourso_abc",
          status: "reconnect_required",
          message: "Mot de passe manquant en base (reconnexion requise).",
        },
      ],
    }

    render(
      <SyncFeedbackModal
        isOpen={true}
        onClose={() => {}}
        syncResult={errorResult}
        onFixConnection={onFixMock}
      />
    )

    expect(screen.getByText("Action requise pour votre banque")).toBeDefined()
    expect(screen.getByText("BoursoBank")).toBeDefined()
    expect(
      screen.getByText("Mot de passe manquant en base (reconnexion requise).")
    ).toBeDefined()

    const fixButton = screen.getByText("Corriger")
    expect(fixButton).toBeDefined()
    fireEvent.click(fixButton)

    expect(onFixMock).toHaveBeenCalledTimes(1)
    expect(onFixMock).toHaveBeenCalledWith(errorResult.errors![0])
  })
})
