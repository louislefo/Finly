import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { FinlyAPI } from "@/lib/api/finly-api"

describe("FinlyAPI Client", () => {
  const originalFetch = global.fetch
  const mockLocalStorage: Record<string, string> = {}

  beforeEach(() => {
    Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k])
    
    // Mock localStorage
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => mockLocalStorage[key] || null,
      setItem: (key: string, value: string) => {
        mockLocalStorage[key] = value
      },
      removeItem: (key: string) => {
        delete mockLocalStorage[key]
      },
      clear: () => {
        Object.keys(mockLocalStorage).forEach((k) => delete mockLocalStorage[k])
      },
    })
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it("handles login successfully and stores token and user in localStorage", async () => {
    const mockUser = {
      id: "usr_123",
      email: "test@finly.local",
      role: "member" as const,
      full_name: "Test User",
      createdAt: "2026-09-01",
    }
    const mockResponse = {
      access_token: "jwt_token_sample_abc123",
      user: mockUser,
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    } as Response)

    const result = await FinlyAPI.login({
      email: "test@finly.local",
      password: "SecretPassword123!",
    })

    expect(result.access_token).toBe("jwt_token_sample_abc123")
    expect(result.user.email).toBe("test@finly.local")
    expect(localStorage.getItem("finly_token")).toBe("jwt_token_sample_abc123")
    expect(JSON.parse(localStorage.getItem("finly_user") || "{}").email).toBe("test@finly.local")
  })

  it("throws error when login fails", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ detail: "Identifiants invalides." }),
    } as Response)

    await expect(
      FinlyAPI.login({
        email: "wrong@finly.local",
        password: "WrongPassword",
      })
    ).rejects.toThrow("Identifiants invalides.")
  })

  it("returns null on getMe when user is unauthenticated or error occurs", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: "Unauthorized" }),
    } as Response)

    const me = await FinlyAPI.getMe()
    expect(me).toBeNull()
  })

  it("fetches current user profile with auth headers", async () => {
    mockLocalStorage["finly_token"] = "valid_token"
    const mockUser = {
      id: "usr_456",
      email: "admin@finly.local",
      role: "admin" as const,
      full_name: "Admin User",
      createdAt: "2026-09-01",
    }

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockUser,
    } as Response)

    const me = await FinlyAPI.getMe()
    expect(me).toEqual(mockUser)
  })
})
