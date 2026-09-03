"use client"

import React, { createContext, useContext, useState, useEffect, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import { User } from "@/lib/types/finance"
import { FinlyAPI } from "@/lib/api/finly-api"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, fullName: string) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  const verifySession = useCallback(async () => {
    try {
      const token = typeof window !== "undefined" ? localStorage.getItem("finly_token") : null
      const storedUser = typeof window !== "undefined" ? localStorage.getItem("finly_user") : null

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
    FinlyAPI.logout()
    setUser(null)
    router.push("/login")
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>
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
