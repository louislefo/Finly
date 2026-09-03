"use client"

import React, { useState, useEffect, useMemo } from "react"
import {
  MapPin,
  Utensils,
  Car,
  Film,
  ShoppingBag,
  CreditCard,
  Building2,
} from "lucide-react"
import { Card, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MapControls,
} from "@/components/ui/map"
import { Transaction } from "@/lib/types/finance"
import { usePrivacy } from "@/components/privacy-context"
import { geocodeTransaction, GeoLocation } from "@/lib/utils/geocoding"
import { getBrandLogoUrl } from "@/lib/utils/brand-logos"

interface ExpensesMapProps {
  transactions: Transaction[]
  className?: string
}

interface GeocodedTransaction extends Transaction {
  location?: GeoLocation
}

export function ExpensesMap({ transactions, className = "" }: ExpensesMapProps) {
  const { formatAmount } = usePrivacy()
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [geocodedTxList, setGeocodedTxList] = useState<GeocodedTransaction[]>([])

  // Filter only expense transactions
  const expenseTransactions = useMemo(() => {
    return transactions.filter((t) => t.amount < 0)
  }, [transactions])

  // Geocode transactions asynchronously
  useEffect(() => {
    let isMounted = true

    async function runGeocode() {
      const results: GeocodedTransaction[] = []
      for (const tx of expenseTransactions.slice(0, 40)) {
        const loc = await geocodeTransaction(tx)
        if (loc) {
          results.push({ ...tx, location: loc })
        }
      }
      if (isMounted) {
        setGeocodedTxList(results)
      }
    }

    if (expenseTransactions.length > 0) {
      runGeocode()
    }

    return () => {
      isMounted = false
    }
  }, [expenseTransactions])

  // Categories available in current transactions
  const categories = useMemo(() => {
    const set = new Set(expenseTransactions.map((t) => t.category).filter(Boolean))
    return ["all", ...Array.from(set)]
  }, [expenseTransactions])

  // Filtered transactions for the map
  const filteredList = useMemo(() => {
    if (selectedCategory === "all") return geocodedTxList
    return geocodedTxList.filter((t) => t.category === selectedCategory)
  }, [geocodedTxList, selectedCategory])

  const getCategoryColor = (cat: string) => {
    const c = cat.toLowerCase()
    if (c.includes("aliment") || c.includes("restau") || c.includes("course")) return "border-orange-500/60 text-orange-400"
    if (c.includes("transp") || c.includes("voiture") || c.includes("uber")) return "border-blue-500/60 text-blue-400"
    if (c.includes("loisir") || c.includes("sortie") || c.includes("cin")) return "border-purple-500/60 text-purple-400"
    if (c.includes("shop") || c.includes("achat")) return "border-pink-500/60 text-pink-400"
    if (c.includes("abon") || c.includes("serv")) return "border-indigo-500/60 text-indigo-400"
    return "border-zinc-500/60 text-zinc-300"
  }

  const getCategoryIcon = (cat: string) => {
    const c = cat.toLowerCase()
    if (c.includes("aliment") || c.includes("restau")) return Utensils
    if (c.includes("transp") || c.includes("car")) return Car
    if (c.includes("loisir") || c.includes("film")) return Film
    if (c.includes("shop")) return ShoppingBag
    return CreditCard
  }

  return (
    <Card className={`p-5 md:p-6 bg-[#18181B] border-white/10 rounded-3xl text-white flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white">
              Carte des Dépenses & Magasins
            </CardTitle>
            <Badge variant="outline" className="text-[11px] border-white/10 bg-zinc-900 text-zinc-400 font-mono">
              {filteredList.length} lieux
            </Badge>
          </div>
          <span className="text-xs text-zinc-400 mt-0.5">
            Localisation géographique de vos achats récents
          </span>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all cursor-pointer ${
                selectedCategory === cat
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                  : "bg-zinc-900/80 border border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800"
              }`}
            >
              {cat === "all" ? "Toutes" : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Map Container (Official @mapcn/map Component) */}
      <div className="relative w-full h-[380px] md:h-[450px] rounded-2xl overflow-hidden border border-white/10 bg-zinc-950">
        <Map
          center={[2.3522, 48.8566]}
          zoom={12}
          theme="dark"
          className="w-full h-full"
        >
          <MapControls position="top-right" showZoom showFullscreen showLocate={false} />

          {filteredList.map((tx) => {
            if (!tx.location) return null
            const rawText = tx.rawLabel || (tx as any).raw_label || ""
            const brandLogo = getBrandLogoUrl(tx.merchant, rawText)
            const CatIcon = getCategoryIcon(tx.category)
            const catColor = getCategoryColor(tx.category)

            return (
              <MapMarker
                key={tx.id}
                longitude={tx.location.lng}
                latitude={tx.location.lat}
              >
                <MarkerContent>
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#18181B]/95 backdrop-blur-md border shadow-lg transition-all transform hover:scale-110 cursor-pointer ${catColor} hover:border-white/40`}
                  >
                    <div className="w-4 h-4 rounded-full overflow-hidden flex items-center justify-center shrink-0">
                      {brandLogo ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={brandLogo}
                          alt=""
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none"
                          }}
                        />
                      ) : (
                        <CatIcon className="w-3 h-3 text-zinc-300" />
                      )}
                    </div>
                    <span className="text-[11px] font-bold font-mono text-white whitespace-nowrap">
                      {formatAmount(tx.amount)}
                    </span>
                  </div>
                </MarkerContent>

                <MarkerTooltip>{tx.merchant} — {formatAmount(tx.amount)}</MarkerTooltip>

                <MarkerPopup closeButton className="w-64 bg-[#18181B] text-white border-white/10 rounded-2xl p-3 shadow-xl">
                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                        {brandLogo ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img
                            src={brandLogo}
                            alt=""
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none"
                            }}
                          />
                        ) : (
                          <CatIcon className="w-4 h-4 text-zinc-300" />
                        )}
                      </div>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-xs font-bold text-white truncate">
                          {tx.merchant}
                        </span>
                        <span className="text-[10px] text-zinc-400">
                          {tx.category} • {tx.date}
                        </span>
                      </div>
                    </div>

                    <div className="p-2 rounded-xl bg-zinc-950/80 border border-white/5 flex flex-col gap-1 text-[11px]">
                      <div className="flex items-center gap-1.5 text-zinc-300">
                        <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                        <span className="truncate">{tx.location.address}</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 pl-5">
                        {tx.location.city} {tx.location.zipCode || ""}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                      <span className="text-[11px] text-zinc-400">Montant débité</span>
                      <span className="font-bold font-mono text-rose-400">
                        {formatAmount(tx.amount)}
                      </span>
                    </div>
                  </div>
                </MarkerPopup>
              </MapMarker>
            )
          })}
        </Map>
      </div>
    </Card>
  )
}
