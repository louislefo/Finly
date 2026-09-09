"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { User } from "@/lib/types/finance"
import { FinlyAPI } from "@/lib/api/finly-api"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isImpersonating: boolean
  impersonatedBy: { id: string; email: string; full_name: string } | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
  impersonateUser: (targetUserId: string) => Promise<void>
  stopImpersonating: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isImpersonating, setIsImpersonating] = useState<boolean>(false)
  const [impersonatedBy, setImpersonatedBy] = useState<{ id: string; email: string; full_name: string } | null>(null)

  const verifySession = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("finly_token") : null
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("finly_user") : null
      const originalToken = typeof window !== "undefined" ? localStorage.getItem("finly_original_token") : null
      const originalUser = typeof window !== "undefined" ? localStorage.getItem("finly_original_user") : null

      if (originalToken && originalUser) {
        setIsImpersonating(true)
        try {
          setImpersonatedBy(JSON.parse(originalUser))
        } catch {
          // ignore
        }
      } else {
        setIsImpersonating(false)
        setImpersonatedBy(null)
      }

      if (!token) {
        setUser(null)
        if (pathname !== "/login") {
          router.push("/login")
        }
        return
      }

      if (storedUser) {
        setUser(JSON.parse(storedUser))
      }

      const remoteUser = await FinlyAPI.getMe()
      if (remoteUser) {
        setUser(remoteUser)
        localStorage.setItem("finly_user", JSON.stringify(remoteUser))
      } else {
        localStorage.removeItem("finly_token")
        localStorage.removeItem("finly_user")
        localStorage.removeItem("finly_original_token")
        localStorage.removeItem("finly_original_user")
        setIsImpersonating(false)
        setUser(null)
        if (pathname !== "/login") {
          router.push("/login")
        }
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false)
    }
  }, [pathname, router])

  useEffect(() => {
    verifySession()
  }, [verifySession])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const res = await FinlyAPI.login({ email, password })
      setUser(res.user)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (email: string, password: string, fullName: string) => {
    setIsLoading(true)
    try {
      const res = await FinlyAPI.register({ email, password, full_name: fullName })
      setUser(res.user)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem("finly_original_token")
    localStorage.removeItem("finly_original_user")
    setIsImpersonating(false)
    setImpersonatedBy(null)
    FinlyAPI.logout()
    setUser(null)
    router.push("/login")
  }

  const impersonateUser = async (targetUserId: string) => {
    setIsLoading(true)
    try {
      const currentToken = localStorage.getItem("finly_token")
      const currentUser = localStorage.getItem("finly_user")
      if (currentToken) {
        localStorage.setItem("finly_original_token", currentToken)
      }
      if (currentUser) {
        localStorage.setItem("finly_original_user", currentUser)
      }

      const res = await FinlyAPI.impersonateUser(targetUserId)
      localStorage.setItem("finly_token", res.access_token)
      localStorage.setItem("finly_user", JSON.stringify(res.user))
      setUser(res.user)
      setIsImpersonating(true)
      setImpersonatedBy(res.impersonated_by)
      router.push("/")
    } finally {
      setIsLoading(false)
    }
  }

  const stopImpersonating = async () => {
    setIsLoading(true)
    try {
      const origToken = localStorage.getItem("finly_original_token")
      const origUser = localStorage.getItem("finly_original_user")
      if (origToken) {
        localStorage.setItem("finly_token", origToken)
      }
      if (origUser) {
        localStorage.setItem("finly_user", origUser)
      }
      localStorage.removeItem("finly_original_token")
      localStorage.removeItem("finly_original_user")
      setIsImpersonating(false)
      setImpersonatedBy(null)

      const remote = await FinlyAPI.getMe()
      setUser(remote || (origUser ? JSON.parse(origUser) : null))
      router.push("/admin")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isImpersonating,
        impersonatedBy,
        login,
        register,
        logout,
        impersonateUser,
        stopImpersonating,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
