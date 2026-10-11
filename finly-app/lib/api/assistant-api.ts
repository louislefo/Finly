import {
  AssistantStatusResponse,
  QuickPrompt,
  AssistantMessage,
  ProviderTestResponse,
  EngineInstallResponse,
} from "@/lib/types/finance"

const API_BASE_URL = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_API_URL || "/api/v1")
  : (process.env.BACKEND_INTERNAL_URL || "http://127.0.0.1:8000/api/v1")

function getAuthHeaders(): HeadersInit {
  if (typeof window === "undefined") return { "Content-Type": "application/json" }
  const token = localStorage.getItem("finly_token")
  const lang = localStorage.getItem("finly_language") || "fr"
  return {
    "Content-Type": "application/json",
    "Accept-Language": lang,
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export const AssistantAPI = {
  async getStatus(baseUrl?: string): Promise<AssistantStatusResponse> {
    const query = baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : ""
    const res = await fetch(`${API_BASE_URL}/assistant/status${query}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      throw new Error(`Failed to fetch assistant status (${res.status})`)
    }
    return res.json()
  },

  async startDaemon(): Promise<{ status: string; message: string; ollama?: AssistantStatusResponse["ollama"] }> {
    const res = await fetch(`${API_BASE_URL}/assistant/start`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      throw new Error(`Failed to start assistant daemon (${res.status})`)
    }
    return res.json()
  },

  async getQuickPrompts(lang: string = "fr"): Promise<{ prompts: QuickPrompt[] }> {
    const res = await fetch(`${API_BASE_URL}/assistant/quick-prompts?lang=${encodeURIComponent(lang)}`, {
      method: "GET",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      return { prompts: [] }
    }
    return res.json()
  },

  async refreshIndex(): Promise<{ status: string; documents_indexed: number }> {
    const res = await fetch(`${API_BASE_URL}/assistant/index/refresh`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
    if (!res.ok) {
      throw new Error("Failed to refresh financial context index")
    }
    return res.json()
  },

  async streamPullModel(
    modelName: string,
    onProgress: (progress: { status: string; percent: number; completed: number; total: number; done: boolean; error?: string }) => void,
    baseUrl?: string,
  ): Promise<void> {
    const token = typeof window !== "undefined" ? localStorage.getItem("finly_token") : null
    const res = await fetch(`${API_BASE_URL}/assistant/setup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ model_name: modelName, base_url: baseUrl }),
    })

    if (!res.ok || !res.body) {
      throw new Error(`Failed to start model pull (${res.status})`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            onProgress(data)
            if (data.done) return
          } catch {
            // Ignore parse errors on partial frames
          }
        }
      }
    }
  },

  async streamChatMessage(
    message: string,
    history: AssistantMessage[],
    onChunk: (chunk: string) => void,
    onDone: () => void,
    options?: {
      model?: string
      baseUrl?: string
      provider?: string
      apiKey?: string
    },
  ): Promise<void> {
    const token = typeof window !== "undefined" ? localStorage.getItem("finly_token") : null

    const formattedHistory = history.map((m) => ({
      role: m.role,
      content: m.content,
    }))

    const res = await fetch(`${API_BASE_URL}/assistant/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message,
        conversation_history: formattedHistory,
        model: options?.model,
        stream: true,
        base_url: options?.baseUrl,
        provider: options?.provider || "ollama",
        api_key: options?.apiKey,
      }),
    })

    if (!res.ok || !res.body) {
      throw new Error(`Chat error (${res.status})`)
    }

    const reader = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ""

    while (true) {
      const { value, done } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split("\n\n")
      buffer = lines.pop() || ""

      for (const line of lines) {
        const trimmed = line.trim()
        if (trimmed.startsWith("data: ")) {
          try {
            const data = JSON.parse(trimmed.slice(6))
            if (data.chunk) {
              onChunk(data.chunk)
            }
            if (data.done) {
              onDone()
              return
            }
          } catch {
            // Ignore partial parse chunks
          }
        }
      }
    }
    onDone()
  },

  async testProvider(config: {
    provider: string
    apiKey?: string
    model?: string
    baseUrl?: string
  }): Promise<ProviderTestResponse> {
    const res = await fetch(`${API_BASE_URL}/assistant/test-provider`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        provider: config.provider,
        api_key: config.apiKey,
        model: config.model,
        base_url: config.baseUrl,
      }),
    })
    return res.json()
  },

  async installEngine(): Promise<EngineInstallResponse> {
    const res = await fetch(`${API_BASE_URL}/assistant/engine/install`, {
      method: "POST",
      headers: getAuthHeaders(),
    })
    return res.json()
  },
}
