import { describe, it, expect, vi } from "vitest"
import React from "react"
import { render, screen, fireEvent } from "@testing-library/react"
import { fr } from "@/lib/i18n/dictionaries/fr"

vi.mock("@/components/i18n-context", () => ({
  useI18n: () => ({
    t: fr,
    language: "fr",
    setLanguage: vi.fn(),
    format: (s: string) => s,
  }),
}))

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button onClick={onClick} {...props}>
      {children}
    </button>
  ),
}))

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className} data-testid="card">
      {children}
    </div>
  ),
}))

vi.mock("@/components/ui/progress", () => ({
  Progress: ({ value }: { value: number }) => <div data-testid="progress" data-value={value} />,
}))

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open?: boolean }) =>
    open ? <div data-testid="dialog">{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
  DialogFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { OllamaSetupCard } from "@/components/assistant/ollama-setup-card"
import { AssistantChatPanel } from "@/components/assistant/assistant-chat-panel"
import { OllamaStatus, OllamaInstallGuide } from "@/lib/types/finance"

describe("Assistant Components", () => {
  it("renders OllamaSetupCard when AI engine is offline", () => {
    const status: OllamaStatus = {
      connected: false,
      base_url: "http://127.0.0.1:11434",
      models: [],
      default_model: "qwen2.5:1.5b",
      fallback_model: "llama3.2:1b",
      is_model_available: false,
      os: "windows",
    }

    const installGuide: OllamaInstallGuide = {
      os: "windows",
      title: "Installation pour Windows",
      download_url: "https://ollama.com/download/OllamaSetup.exe",
      command: "winget install Ollama.Ollama",
      instructions: "Téléchargez et exécutez l'installeur",
    }

    render(
      <OllamaSetupCard
        status={status}
        installGuide={installGuide}
        onStatusChange={vi.fn()}
      />
    )

    expect(screen.getByText(fr.assistant.engineDisconnectedTitle)).toBeDefined()
    expect(screen.getByText("winget install Ollama.Ollama")).toBeDefined()
  })

  it("renders OllamaSetupCard model pull prompt when connected but model is missing", () => {
    const status: OllamaStatus = {
      connected: true,
      base_url: "http://127.0.0.1:11434",
      models: [],
      default_model: "qwen2.5:1.5b",
      fallback_model: "llama3.2:1b",
      is_model_available: false,
      os: "windows",
    }

    render(
      <OllamaSetupCard
        status={status}
        installGuide={null}
        onStatusChange={vi.fn()}
      />
    )

    expect(screen.getByText(fr.assistant.engineMissingModelTitle)).toBeDefined()
    expect(screen.getByText("qwen2.5:1.5b")).toBeDefined()
  })

  it("renders AssistantChatPanel when open and allows opening settings", () => {
    const status: OllamaStatus = {
      connected: true,
      base_url: "http://127.0.0.1:11434",
      models: ["qwen2.5:1.5b", "llama3.2:1b"],
      default_model: "qwen2.5:1.5b",
      fallback_model: "llama3.2:1b",
      is_model_available: true,
      os: "windows",
    }

    render(
      <AssistantChatPanel
        isOpen={true}
        onClose={vi.fn()}
        status={status}
        installGuide={null}
        onStatusRefresh={vi.fn()}
      />
    )

    expect(screen.getAllByText(fr.assistant.title).length).toBeGreaterThanOrEqual(1)
    expect(screen.getByPlaceholderText(fr.assistant.inputPlaceholder)).toBeDefined()

    // Click settings button
    const settingsBtn = screen.getByTitle(fr.assistant.openSettings)
    fireEvent.click(settingsBtn)

    expect(screen.getByText(fr.assistant.settingsTitle)).toBeDefined()
    expect(screen.getByText(fr.assistant.selectModel)).toBeDefined()
    expect(screen.getAllByText("llama3.2:1b").length).toBeGreaterThanOrEqual(1)
  })
})
