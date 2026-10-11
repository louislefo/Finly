"use client"

import React, { useState, useEffect, useRef } from "react"
import { useI18n } from "@/components/i18n-context"
import {
  AssistantStatus,
  OllamaInstallGuide,
  AssistantMessage,
  QuickPrompt,
  AISettingsConfig,
} from "@/lib/types/finance"
import { AssistantAPI } from "@/lib/api/assistant-api"
import { OllamaSetupCard } from "./ollama-setup-card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import {
  X,
  Send,
  Sparkles,
  RotateCcw,
  Bot,
  User,
  Settings,
  ArrowLeft,
  Check,
  Power,
  RefreshCw,
  Cpu,
  ShieldCheck,
  Download,
  Key,
} from "lucide-react"

interface AssistantChatPanelProps {
  isOpen: boolean
  onClose: () => void
  status: AssistantStatus | null
  installGuide: OllamaInstallGuide | null
  onStatusRefresh: () => void
}

export function AssistantChatPanel({
  isOpen,
  onClose,
  status,
  installGuide,
  onStatusRefresh,
}: AssistantChatPanelProps) {
  const { t, language } = useI18n()
  const [messages, setMessages] = useState<AssistantMessage[]>([])
  const [inputMessage, setInputMessage] = useState("")
  const [loading, setLoading] = useState(false)
  const [quickPrompts, setQuickPrompts] = useState<QuickPrompt[]>([])
  const [viewMode, setViewMode] = useState<"chat" | "settings">("chat")
  
  // Settings state
  const [selectedModel, setSelectedModel] = useState<string>("")
  const [isStartingDaemon, setIsStartingDaemon] = useState(false)
  const [isReindexing, setIsReindexing] = useState(false)
  const [reindexFeedback, setReindexFeedback] = useState<string | null>(null)
  const [pullingCustomModel, setPullingCustomModel] = useState(false)
  const [pullProgress, setPullProgress] = useState<{ status: string; percent: number } | null>(null)

  const messagesEndRef = useRef<HTMLDivElement | null>(null)

  const [aiSettings, setAiSettings] = useState<AISettingsConfig | null>(null)

  useEffect(() => {
    const loadSettings = () => {
      if (typeof window === "undefined") return
      try {
        const stored = localStorage.getItem("finly_ai_settings")
        if (stored) {
          setAiSettings(JSON.parse(stored))
        }
      } catch {}
    }
    loadSettings()
    window.addEventListener("finly_assistant_toggled", loadSettings)
    return () => window.removeEventListener("finly_assistant_toggled", loadSettings)
  }, [])

  const isCloudMode = aiSettings?.mode === "cloud"
  const isConnected = status?.connected ?? false
  const isModelReady = status?.is_model_available ?? false
  const isReady = isCloudMode
    ? Boolean(aiSettings?.apiKey && aiSettings.apiKey.trim().length > 0)
    : (isConnected && isModelReady)

  const activeModel = isCloudMode
    ? (aiSettings?.model || "gpt-4o-mini")
    : (selectedModel || status?.active_model || status?.default_model || "qwen2.5:1.5b")

  // Load selected model from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const savedModel = localStorage.getItem("finly_selected_ai_model")
      if (savedModel) {
        setSelectedModel(savedModel)
      } else if (status?.active_model) {
        setSelectedModel(status.active_model)
      }
    } catch {}
  }, [status?.active_model])

  // Save selected model changes
  const handleSelectModel = (modelName: string) => {
    setSelectedModel(modelName)
    try {
      localStorage.setItem("finly_selected_ai_model", modelName)
    } catch {}
  }

  // Load quick prompts on mount or language change
  useEffect(() => {
    AssistantAPI.getQuickPrompts(language || "fr")
      .then((res) => {
        if (res?.prompts) setQuickPrompts(res.prompts)
      })
      .catch(() => {})
  }, [language])

  // Scroll to bottom on new messages
  useEffect(() => {
    if (isOpen && viewMode === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages, isOpen, loading, viewMode])

  // Load saved history on mount
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const saved = localStorage.getItem("finly_assistant_chat_history")
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed)
        }
      }
    } catch {}
  }, [])

  // Persist history on updates
  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (messages.length > 0) {
        const trimmed = messages.slice(-50)
        localStorage.setItem("finly_assistant_chat_history", JSON.stringify(trimmed))
      }
    } catch {}
  }, [messages])

  // Clear chat
  const handleClearChat = () => {
    setMessages([])
    try {
      localStorage.removeItem("finly_assistant_chat_history")
    } catch {}
  }

  // Handle start daemon from settings
  const handleStartDaemon = async () => {
    setIsStartingDaemon(true)
    try {
      await AssistantAPI.startDaemon()
      await onStatusRefresh()
    } catch {} finally {
      setIsStartingDaemon(false)
    }
  }

  // Handle re-indexing context
  const handleReindex = async () => {
    setIsReindexing(true)
    setReindexFeedback(null)
    try {
      const res = await AssistantAPI.refreshIndex()
      setReindexFeedback(`${res.documents_indexed} documents indexés`)
    } catch {
      setReindexFeedback("Erreur lors de l'indexation")
    } finally {
      setIsReindexing(false)
      setTimeout(() => setReindexFeedback(null), 3500)
    }
  }

  // Handle pulling extra model
  const handlePullCustomModel = async (modelToPull: string) => {
    const target = modelToPull.trim()
    if (!target) return
    setPullingCustomModel(true)
    setPullProgress({ status: "Démarrage...", percent: 0 })

    try {
      await AssistantAPI.streamPullModel(
        target,
        (p) => {
          if (p.error) {
            setPullingCustomModel(false)
          } else {
            setPullProgress({ status: p.status, percent: p.percent })
            if (p.done) {
              setPullingCustomModel(false)
              onStatusRefresh()
              handleSelectModel(target)
            }
          }
        },
        status?.base_url
      )
    } catch {
      setPullingCustomModel(false)
    }
  }

  // Handle submit query
  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputMessage).trim()
    if (!query || loading || !isReady) return

    setInputMessage("")
    const userMsg: AssistantMessage = {
      id: `usr_${Date.now()}`,
      role: "user",
      content: query,
      timestamp: new Date().toISOString(),
    }

    const assistantMsgId = `ast_${Date.now()}`
    const initialAssistantMsg: AssistantMessage = {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, initialAssistantMsg])
    setLoading(true)

    try {
      await AssistantAPI.streamChatMessage(
        query,
        messages,
        (chunk) => {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsgId ? { ...m, content: m.content + chunk } : m))
          )
        },
        () => {
          setLoading(false)
        },
        {
          model: activeModel,
          baseUrl: isCloudMode ? aiSettings?.baseUrl : status?.base_url,
          provider: isCloudMode ? (aiSettings?.provider || "openai") : "ollama",
          apiKey: isCloudMode ? aiSettings?.apiKey : undefined,
        }
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? { ...m, content: m.content || t.assistant.errorStreaming }
            : m
        )
      )
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  if (!isOpen) return null

  return (
    <Card className="fixed bottom-20 md:bottom-24 right-3 sm:right-6 left-3 sm:left-auto w-[calc(100vw-1.5rem)] sm:w-[420px] max-h-[calc(100dvh-6.5rem)] sm:max-h-[calc(100vh-8rem)] h-[580px] bg-zinc-950/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden text-zinc-100 animate-in fade-in slide-in-from-bottom-4 duration-200">
      {/* 1. Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-zinc-900/60">
        <div className="flex items-center gap-2.5 min-w-0">
          {viewMode === "settings" ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("chat")}
              className="size-7 p-0 text-zinc-400 hover:text-white"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
          ) : (
            <div className="size-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Bot className="w-4 h-4" />
            </div>
          )}

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white tracking-tight truncate">
                {viewMode === "settings" ? t.assistant.settingsTitle : t.assistant.title}
              </h3>
              {viewMode === "chat" && (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.2 rounded font-mono truncate max-w-[130px] ${
                    isReady
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                  }`}
                  title={isCloudMode ? `${aiSettings?.provider}: ${activeModel}` : activeModel}
                >
                  <span className={`size-1.5 rounded-full shrink-0 ${isReady ? "bg-emerald-400" : "bg-amber-400 animate-pulse"}`} />
                  <span className="truncate">
                    {isReady
                      ? (isCloudMode ? `${aiSettings?.provider || "cloud"}: ${activeModel}` : activeModel)
                      : "Offline"}
                  </span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-zinc-400 truncate">
              {viewMode === "settings" ? t.assistant.privacyBadge : t.assistant.subtitle}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {viewMode === "chat" ? (
            <>
              {messages.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClearChat}
                  className="size-7 p-0 text-zinc-400 hover:text-zinc-200"
                  title={t.assistant.newChatBtn}
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setViewMode("settings")}
                className="size-7 p-0 text-zinc-400 hover:text-white"
                title={t.assistant.openSettings}
              >
                <Settings className="w-3.5 h-3.5" />
              </Button>
            </>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewMode("chat")}
              className="size-7 p-0 text-zinc-400 hover:text-white"
              title={t.assistant.closeSettings}
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          {viewMode === "chat" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="size-7 p-0 text-zinc-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 2. Main Content Area: Chat or Settings */}
      {viewMode === "settings" ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-5 text-xs text-zinc-300">
          {/* Engine Status Card */}
          <div className="p-3.5 rounded-xl bg-zinc-900/80 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-medium text-white flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                <span>Statut du Moteur IA</span>
              </span>
              <span className={`inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded ${
                isConnected
                  ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
              }`}>
                <span className={`size-1.5 rounded-full ${isConnected ? "bg-emerald-400" : "bg-amber-400"}`} />
                {isConnected ? t.assistant.statusConnected : t.assistant.statusDisconnected}
              </span>
            </div>

            {!isConnected && status?.is_installed_locally && (
              <Button
                onClick={handleStartDaemon}
                disabled={isStartingDaemon}
                className="w-full h-8 mt-1 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-1.5"
              >
                {isStartingDaemon ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>{t.assistant.startingDaemon}</span>
                  </>
                ) : (
                  <>
                    <Power className="w-3 h-3" />
                    <span>{t.assistant.startDaemonBtn}</span>
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Model Selector */}
          <div className="space-y-2">
            <label className="font-medium text-white block">
              {t.assistant.selectModel}
            </label>
            <p className="text-[11px] text-zinc-400 leading-tight">
              {t.assistant.selectModelDesc}
            </p>

            {status?.models && status.models.length > 0 ? (
              <div className="space-y-1.5 pt-1">
                {status.models.map((modelName) => {
                  const isCurrent = (selectedModel || status.active_model) === modelName
                  return (
                    <button
                      key={modelName}
                      type="button"
                      onClick={() => handleSelectModel(modelName)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all duration-150 ${
                        isCurrent
                          ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                          : "bg-zinc-900/60 border-white/5 hover:border-white/10 text-zinc-300"
                      }`}
                    >
                      <span className="font-mono text-xs">{modelName}</span>
                      {isCurrent && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 text-zinc-400 text-center text-xs">
                {t.assistant.noModelsInstalled}
              </div>
            )}
          </div>

          {/* Download Extra Model */}
          {isConnected && (
            <div className="space-y-2 pt-1">
              <label className="font-medium text-white block">
                {t.assistant.downloadModelTitle}
              </label>
              <div className="flex gap-1.5 flex-wrap">
                {["qwen2.5:1.5b", "llama3.2:1b", "qwen2.5:0.5b"].map((quickModel) => (
                  <Button
                    key={quickModel}
                    variant="outline"
                    size="sm"
                    disabled={pullingCustomModel || status?.models?.includes(quickModel)}
                    onClick={() => handlePullCustomModel(quickModel)}
                    className="h-7 px-2.5 text-[11px] border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200"
                  >
                    <Download className="w-3 h-3 mr-1 text-indigo-400" />
                    {quickModel}
                  </Button>
                ))}
              </div>

              {pullingCustomModel && pullProgress && (
                <div className="p-2.5 rounded-xl bg-zinc-900 border border-white/10 space-y-1.5">
                  <div className="flex justify-between text-[10px] text-zinc-400">
                    <span>{pullProgress.status}</span>
                    <span>{pullProgress.percent}%</span>
                  </div>
                  <Progress value={pullProgress.percent} className="h-1.5 bg-zinc-800" />
                </div>
              )}
            </div>
          )}

          {/* Context Vector Refresh */}
          <div className="space-y-2 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-white block">Base de connaissances</span>
                <span className="text-[11px] text-zinc-400">Synchronise vos comptes, transactions et budgets</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReindex}
                disabled={isReindexing}
                className="h-8 px-3 text-xs border-white/10 bg-zinc-900 hover:bg-zinc-800 text-zinc-200 shrink-0"
              >
                <RefreshCw className={`w-3 h-3 mr-1.5 ${isReindexing ? "animate-spin" : ""}`} />
                <span>{isReindexing ? t.assistant.reindexing : "Actualiser"}</span>
              </Button>
            </div>
            {reindexFeedback && (
              <p className="text-[11px] text-emerald-400 bg-emerald-500/10 p-2 rounded-lg border border-emerald-500/20">
                {reindexFeedback}
              </p>
            )}
          </div>

          {/* Privacy Footnote */}
          <div className="p-3 rounded-xl bg-zinc-900/40 border border-white/5 flex items-start gap-2.5 text-zinc-400 text-[11px]">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <span>Vos informations financières sont traitées exclusivement sur votre appareil et ne sont jamais téléversées sur des serveurs externes.</span>
          </div>
        </div>
      ) : (
        /* Chat View */
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {!isReady ? (
              isCloudMode ? (
                <div className="p-5 rounded-2xl bg-zinc-900/90 border border-white/10 space-y-3 text-center my-auto mx-2 shadow-xl">
                  <div className="size-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 mx-auto flex items-center justify-center text-amber-400">
                    <Key className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-semibold text-white">{t.assistant.apiKeyLabel} requise</h4>
                  <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                    Veuillez configurer votre clé API pour le fournisseur Cloud sélectionné ({aiSettings?.provider || "OpenAI"}) dans les Préférences.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => {
                      onClose()
                      window.location.href = "/compte?tab=preferences"
                    }}
                    className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-xs h-9 cursor-pointer rounded-xl font-medium"
                  >
                    Ouvrir les Préférences
                  </Button>
                </div>
              ) : (
                <OllamaSetupCard
                  status={status}
                  installGuide={installGuide}
                  onStatusChange={onStatusRefresh}
                />
              )
            ) : (
              <>
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col justify-center space-y-4 py-4">
                    <div className="text-center space-y-1.5 px-4">
                      <div className="size-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 mx-auto flex items-center justify-center text-indigo-400">
                        <Sparkles className="w-5 h-5" />
                      </div>
                      <h4 className="text-sm font-medium text-white">{t.assistant.title}</h4>
                      <p className="text-xs text-zinc-400 leading-relaxed max-w-xs mx-auto">
                        {t.assistant.inputPlaceholder}
                      </p>
                    </div>

                    {quickPrompts.length > 0 && (
                      <div className="space-y-1.5 px-2">
                        <span className="text-[11px] font-medium text-zinc-400 px-1">
                          {t.assistant.quickPromptsTitle}
                        </span>
                        <div className="grid grid-cols-1 gap-1.5">
                          {quickPrompts.map((qp, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => handleSendMessage(qp.prompt)}
                              className="w-full text-left text-xs p-2.5 rounded-xl bg-zinc-900/70 hover:bg-zinc-800/90 border border-white/5 hover:border-white/10 text-zinc-300 hover:text-white transition-all duration-150 flex items-center justify-between group"
                            >
                              <span className="truncate">{qp.label}</span>
                              <span className="text-[10px] text-zinc-500 group-hover:text-indigo-300 font-mono shrink-0 ml-2">
                                →
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {messages.map((msg) => {
                      const isUser = msg.role === "user"
                      return (
                        <div
                          key={msg.id}
                          className={`flex gap-2.5 ${isUser ? "justify-end" : "justify-start"}`}
                        >
                          {!isUser && (
                            <div className="size-6 rounded-md bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0 mt-0.5">
                              <Bot className="w-3.5 h-3.5" />
                            </div>
                          )}

                          <div
                            className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                              isUser
                                ? "bg-indigo-600 text-white rounded-br-sm"
                                : "bg-zinc-900 border border-white/10 text-zinc-200 rounded-bl-sm"
                            }`}
                          >
                            <div className="whitespace-pre-wrap font-sans break-words">
                              {msg.content || (
                                <span className="inline-flex items-center gap-1 text-zinc-400 italic">
                                  <span className="size-1 rounded-full bg-indigo-400 animate-pulse" />
                                  {t.assistant.thinking}
                                </span>
                              )}
                            </div>
                          </div>

                          {isUser && (
                            <div className="size-6 rounded-md bg-zinc-800 border border-white/10 flex items-center justify-center text-zinc-400 shrink-0 mt-0.5">
                              <User className="w-3.5 h-3.5" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </>
            )}
          </div>

          {/* 3. Input Bar */}
          {isReady && (
            <div className="p-3 border-t border-white/10 bg-zinc-900/60">
              <div className="flex items-center gap-2">
                <Input
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={t.assistant.inputPlaceholder}
                  disabled={loading}
                  className="h-9 text-xs bg-zinc-950 border-white/10 focus-visible:ring-indigo-500 text-zinc-100 placeholder:text-zinc-500"
                />
                <Button
                  size="sm"
                  onClick={() => handleSendMessage()}
                  disabled={loading || !inputMessage.trim()}
                  className="h-9 px-3 bg-indigo-600 hover:bg-indigo-500 text-white shrink-0"
                  title={t.assistant.sendBtn}
                >
                  <Send className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  )
}
