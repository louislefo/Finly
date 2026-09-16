"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/components/auth-context"
import { useI18n } from "@/components/i18n-context"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Lock, Mail, User as UserIcon, ArrowRight, ShieldCheck, Globe } from "lucide-react"

export default function LoginPage() {
  const router = useRouter()
  const { login, register } = useAuth()
  const { t, language, setLanguage } = useI18n()
  const [isRegisterMode, setIsRegisterMode] = useState<boolean>(false)
  const [fullName, setFullName] = useState<string>("")
  const [email, setEmail] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg(null)
    setIsLoading(true)

    try {
      if (isRegisterMode) {
        if (!fullName.trim()) {
          setErrorMsg(t.auth.invalidEmailFormat || "Please provide your full name.")
          setIsLoading(false)
          return
        }
        await register(email, password, fullName)
      } else {
        await login(email, password)
      }
    } catch (err: any) {
      setErrorMsg(err.message || t.common.error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#09090B] flex flex-col justify-center items-center p-4 relative">
      {/* Top Floating Language Switcher */}
      <div className="absolute top-4 right-4 z-20 flex items-center bg-zinc-900/90 border border-white/10 rounded-full p-0.5 text-xs font-semibold shadow-lg">
        <button
          type="button"
          onClick={() => setLanguage("en")}
          className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
            language === "en" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
          }`}
        >
          English
        </button>
        <button
          type="button"
          onClick={() => setLanguage("fr")}
          className={`px-2.5 py-1 rounded-full transition-all cursor-pointer ${
            language === "fr" ? "bg-indigo-600 text-white shadow-sm" : "text-zinc-400 hover:text-white"
          }`}
        >
          Français
        </button>
      </div>

      {/* Background Subtle Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md flex flex-col gap-6 relative z-10">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-1">
          <span className="font-[family-name:var(--font-logo)] text-5xl md:text-6xl text-zinc-100 tracking-wide select-none drop-shadow-md">
            Finly
          </span>
          <p className="text-xs text-zinc-400 mt-1">
            {isRegisterMode ? t.auth.registerSubtitle : t.auth.loginSubtitle}
          </p>
        </div>

        {/* Auth Card */}
        <Card className="p-6 md:p-8 border-white/10 bg-[#18181B] shadow-2xl rounded-3xl">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs">
                {errorMsg}
              </div>
            )}

            {isRegisterMode && (
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium text-zinc-300">{t.auth.fullName}</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                  <Input
                    type="text"
                    required
                    placeholder={t.auth.fullNamePlaceholder}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-9 bg-zinc-900/80 border-white/10 text-white text-xs h-10"
                  />
                </div>
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">
                {isRegisterMode ? t.auth.emailOrUsername : t.auth.emailOrUsername}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type={isRegisterMode ? "email" : "text"}
                  required
                  placeholder={t.auth.emailPlaceholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 bg-zinc-900/80 border-white/10 text-white text-xs h-10"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-zinc-300">{t.auth.password}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <Input
                  type="password"
                  required
                  placeholder={t.auth.passwordPlaceholder}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 bg-zinc-900/80 border-white/10 text-white text-xs h-10"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="mt-2 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs h-10 rounded-xl shadow-lg shadow-indigo-600/25 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>{isLoading ? t.auth.processing : isRegisterMode ? t.auth.signUp : t.auth.signIn}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </form>

          {/* Toggle Register / Login */}
          <div className="mt-6 pt-4 border-t border-white/5 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null)
                setIsRegisterMode(!isRegisterMode)
              }}
              className="text-xs text-zinc-400 hover:text-white transition-colors cursor-pointer"
            >
              {isRegisterMode ? t.auth.alreadyHaveAccount : t.auth.newUser}
            </button>

            <div className="flex items-center gap-1.5 text-[10px] text-zinc-500">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
              <span>{t.auth.securityNote}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
