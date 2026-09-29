"use client"

import React, { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useI18n } from "@/components/i18n-context"
import { StockAPI } from "@/lib/api/stock-api"
import { Account } from "@/lib/types/finance"
import { cn } from "@/lib/utils"

const SUGGESTED_ASSETS = [
  { symbol: "MC.PA", name: "LVMH", type: "stock", sector: "Luxury" },
  { symbol: "CW8.PA", name: "MSCI World ETF", type: "etf", sector: "Global Equities" },
  { symbol: "NVDA", name: "NVIDIA", type: "stock", sector: "Semiconductors" },
  { symbol: "AAPL", name: "Apple", type: "stock", sector: "Technology" },
  { symbol: "TTE.PA", name: "TotalEnergies", type: "stock", sector: "Energy" },
  { symbol: "BTC", name: "Bitcoin", type: "crypto", sector: "Digital Assets" },
]

interface AddHoldingModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  accounts?: Account[]
}

export function AddHoldingModal({
  isOpen,
  onClose,
  onSuccess,
  accounts = [],
}: AddHoldingModalProps) {
  const { t } = useI18n()

  const [symbol, setSymbol] = useState("")
  const [name, setName] = useState("")
  const [assetType, setAssetType] = useState<string>("stock")
  const [quantity, setQuantity] = useState<string>("1")
  const [buyPrice, setBuyPrice] = useState<string>("")
  const [currency, setCurrency] = useState<string>("EUR")
  const [sector, setSector] = useState<string>("")
  const [accountId, setAccountId] = useState<string>("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSelectSuggested = (item: typeof SUGGESTED_ASSETS[0]) => {
    setSymbol(item.symbol)
    setName(item.name)
    setAssetType(item.type)
    setSector(item.sector)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    const parsedQty = parseFloat(quantity.replace(",", "."))
    const parsedPrice = parseFloat(buyPrice.replace(",", "."))

    if (!symbol.trim()) {
      setError("Veuillez renseigner le symbole / ticker.")
      return
    }

    if (isNaN(parsedQty) || parsedQty <= 0) {
      setError("La quantité doit être supérieure à 0.")
      return
    }

    if (isNaN(parsedPrice) || parsedPrice < 0) {
      setError("Le prix d'achat (PRU) doit être valide.")
      return
    }

    setIsSubmitting(true)
    try {
      await StockAPI.createHolding({
        symbol: symbol.trim().toUpperCase(),
        name: name.trim() || symbol.trim().toUpperCase(),
        asset_type: assetType,
        quantity: parsedQty,
        buy_price: parsedPrice,
        currency,
        sector: sector.trim() || undefined,
        account_id: accountId || undefined,
      })
      onSuccess()
      onClose()
      // Reset form
      setSymbol("")
      setName("")
      setQuantity("1")
      setBuyPrice("")
      setSector("")
    } catch (err: any) {
      setError(err?.message || "Erreur lors de l'ajout de la position.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#18181B] border border-white/10 text-white rounded-2xl max-w-md p-6">
        <DialogHeader className="pb-2">
          <DialogTitle className="text-lg font-bold text-white">
            {t.investments.addAsset}
          </DialogTitle>
        </DialogHeader>

        {/* Quick Suggestion Chips */}
        <div className="space-y-1.5 mb-3">
          <span className="text-[11px] text-zinc-400 font-medium">Suggestions rapides</span>
          <div className="flex flex-wrap gap-1.5">
            {SUGGESTED_ASSETS.map((item) => (
              <button
                key={item.symbol}
                type="button"
                onClick={() => handleSelectSuggested(item)}
                className="px-2.5 py-1 rounded-lg bg-[#09090B] border border-white/10 text-[11px] font-mono text-zinc-300 hover:text-white hover:border-white/20 transition-colors cursor-pointer"
              >
                {item.symbol}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">{t.investments.symbol}</label>
              <Input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                placeholder="AAPL, MC.PA..."
                className="bg-[#09090B] border-white/10 text-white rounded-xl text-xs h-9 font-mono uppercase"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">{t.investments.assetType}</label>
              <select
                value={assetType}
                onChange={(e) => setAssetType(e.target.value)}
                className="w-full bg-[#09090B] border border-white/10 text-white rounded-xl text-xs h-9 px-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="stock">{t.investments.stock}</option>
                <option value="etf">{t.investments.etf}</option>
                <option value="crypto">{t.investments.crypto}</option>
                <option value="commodity">{t.investments.commodity}</option>
                <option value="fund">{t.investments.fund}</option>
              </select>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs text-zinc-400 font-medium">{t.investments.assetName}</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Apple Inc., LVMH..."
              className="bg-[#09090B] border-white/10 text-white rounded-xl text-xs h-9"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">{t.investments.quantity}</label>
              <Input
                type="text"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="10"
                className="bg-[#09090B] border-white/10 text-white rounded-xl text-xs h-9 font-mono"
                required
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">{t.investments.buyPrice}</label>
              <Input
                type="text"
                value={buyPrice}
                onChange={(e) => setBuyPrice(e.target.value)}
                placeholder="150.00"
                className="bg-[#09090B] border-white/10 text-white rounded-xl text-xs h-9 font-mono"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">Devise</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full bg-[#09090B] border border-white/10 text-white rounded-xl text-xs h-9 px-2.5 outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
              >
                <option value="EUR">EUR (€)</option>
                <option value="USD">USD ($)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">{t.investments.sector}</label>
              <Input
                value={sector}
                onChange={(e) => setSector(e.target.value)}
                placeholder="ex: Technologie, Luxe..."
                className="bg-[#09090B] border-white/10 text-white rounded-xl text-xs h-9"
              />
            </div>
          </div>

          {accounts.length > 0 && (
            <div className="space-y-1">
              <label className="text-xs text-zinc-400 font-medium">{t.investments.account}</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full bg-[#09090B] border border-white/10 text-white rounded-xl text-xs h-9 px-2.5 outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Aucun compte rattaché</option>
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name || acc.bank} ({acc.bank})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-zinc-400 hover:text-white rounded-xl text-xs h-9"
            >
              {t.common.cancel}
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs h-9 font-semibold"
            >
              {isSubmitting ? t.common.saving : t.common.add}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
