"use client"

import React, { useState, useEffect, useMemo, useRef } from "react"
import * as MapLibreGL from "maplibre-gl"
import {
  MapPin,
  Layers,
  SlidersHorizontal,
  Navigation,
  Check,
  Utensils,
  Car,
  Film,
  ShoppingBag,
  CreditCard,
  Building2,
  Globe,
  Store,
} from "lucide-react"
import { Card, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Map,
  MapMarker,
  MarkerContent,
  MarkerPopup,
  MarkerTooltip,
  MapControls,
  MapClusterLayer,
  MapPopup,
} from "@/components/ui/map"
import { Transaction } from "@/lib/types/finance"
import { usePrivacy } from "@/components/privacy-context"
import { useI18n } from "@/components/i18n-context"
import {
  geocodeTransaction,
  getInstantGeoLocation,
  isWithinFrance,
  isPhysicalExpense,
  getUserHomeCity,
  setUserHomeCity,
  GeoLocation,
} from "@/lib/utils/geocoding"
import { getBrandLogoUrl } from "@/lib/utils/brand-logos"

interface ExpensesMapProps {
  transactions: Transaction[]
  className?: string
}

interface GeocodedTransaction extends Transaction {
  location?: GeoLocation
}

const POPULAR_CITIES = [
  "Paris",
  "Nantes",
  "Lyon",
  "Marseille",
  "Bordeaux",
  "Toulouse",
  "Lille",
  "Rennes",
  "Strasbourg",
  "Nice",
  "Montpellier",
]

export function ExpensesMap({ transactions, className = "" }: ExpensesMapProps) {
  const { formatAmount } = usePrivacy()
  const { t, language } = useI18n()
  const [viewMode, setViewMode] = useState<"clusters" | "markers">("clusters")
  const [selectedCategory, setSelectedCategory] = useState<string>("all")
  const [geocodedTxList, setGeocodedTxList] = useState<GeocodedTransaction[]>([])
  const [selectedClusterPoint, setSelectedClusterPoint] = useState<{
    coordinates: [number, number]
    properties: any
  } | null>(null)

  // Settings state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false)
  const [onlyPhysical, setOnlyPhysical] = useState<boolean>(() => {
    if (typeof window === "undefined") return true
    try {
      const val = localStorage.getItem("finly_map_only_physical")
      return val !== null ? val === "true" : true
    } catch {
      return true
    }
  })
  const [homeCity, setHomeCityState] = useState<string>(() => getUserHomeCity())
  const [customCityInput, setCustomCityInput] = useState<string>("")
  const [isLocating, setIsLocating] = useState<boolean>(false)

  const mapRef = useRef<MapLibreGL.Map | null>(null)

  // Filter expenses: Physical in-store only (default Option 1) or all debits
  const expenseTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (onlyPhysical) {
        return isPhysicalExpense(t)
      }
      return (
        t.amount < 0 ||
        (t.category && !["Revenus", "Salaire", "Épargne", "Investissements"].includes(t.category))
      )
    })
  }, [transactions, onlyPhysical])

  // Geocode transactions: Instant baseline + parallel background async enrichment
  useEffect(() => {
    let isMounted = true

    // 1. Instant baseline so markers display immediately with zero delay
    const initialList: GeocodedTransaction[] = expenseTransactions.map((tx) => ({
      ...tx,
      location: getInstantGeoLocation(tx),
    }))
    setGeocodedTxList(initialList)

    // 2. Parallel background async enrichment
    async function enrichAsync() {
      const enriched = await Promise.all(
        expenseTransactions.slice(0, 60).map(async (tx) => {
          try {
            const loc = await geocodeTransaction(tx)
            return { ...tx, location: loc }
          } catch {
            return { ...tx, location: getInstantGeoLocation(tx) }
          }
        })
      )
      if (isMounted) {
        setGeocodedTxList(enriched)
      }
    }

    if (expenseTransactions.length > 0) {
      enrichAsync()
    }

    return () => {
      isMounted = false
    }
  }, [expenseTransactions, homeCity])

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

  // GeoJSON data structure for MapClusterLayer (Zones d'achats)
  const clusterGeoJson = useMemo<GeoJSON.FeatureCollection<GeoJSON.Point>>(() => {
    return {
      type: "FeatureCollection",
      features: filteredList
        .filter((tx) => Boolean(tx.location && isWithinFrance(tx.location.lat, tx.location.lng)))
        .map((tx) => ({
          type: "Feature" as const,
          id: tx.id,
          geometry: {
            type: "Point" as const,
            coordinates: [tx.location!.lng, tx.location!.lat],
          },
          properties: {
            id: tx.id,
            merchant: tx.merchant,
            amount: tx.amount,
            formattedAmount: formatAmount(tx.amount),
            category: tx.category,
            city: tx.location!.city || "France",
            address: tx.location!.address || tx.merchant,
            date: tx.date,
            isOnline: Boolean(tx.location!.isOnline),
            logoUrl: getBrandLogoUrl(tx.merchant, tx.rawLabel || (tx as any).raw_label || ""),
          },
        })),
    }
  }, [filteredList, formatAmount])

  // Dynamic center computation based on active markers
  const mapCenter = useMemo<[number, number]>(() => {
    const validLocations = filteredList
      .map((t) => t.location)
      .filter((loc): loc is GeoLocation => Boolean(loc && isWithinFrance(loc.lat, loc.lng)))
    if (validLocations.length === 0) return [2.3522, 48.8566]

    const sumLng = validLocations.reduce((acc, loc) => acc + loc.lng, 0)
    const sumLat = validLocations.reduce((acc, loc) => acc + loc.lat, 0)
    return [sumLng / validLocations.length, sumLat / validLocations.length]
  }, [filteredList])

  // Auto-fit map viewport to active markers
  useEffect(() => {
    if (!mapRef.current || filteredList.length === 0) return
    const valid = filteredList
      .map((t) => t.location)
      .filter((loc): loc is GeoLocation => Boolean(loc && isWithinFrance(loc.lat, loc.lng)))
    if (valid.length === 0) return

    try {
      if (valid.length === 1) {
        mapRef.current.flyTo({ center: [valid[0].lng, valid[0].lat], zoom: 13, duration: 600 })
      } else {
        const bounds = new MapLibreGL.LngLatBounds()
        valid.forEach((l) => bounds.extend([l.lng, l.lat]))
        mapRef.current.fitBounds(bounds, { padding: 50, maxZoom: 14, duration: 600 })
      }
    } catch {
      // MapLibre is initializing
    }
  }, [filteredList])

  const handleUpdateHomeCity = (newCity: string) => {
    const trimmed = newCity.trim()
    if (!trimmed) return
    setUserHomeCity(trimmed)
    setHomeCityState(trimmed)
    setCustomCityInput("")
  }

  const handleGeolocate = () => {
    if (!navigator.geolocation) return
    setIsLocating(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `https://api-adresse.data.gouv.fr/reverse/?lon=${pos.coords.longitude}&lat=${pos.coords.latitude}`
          )
          if (res.ok) {
            const data = await res.json()
            const foundCity = data.features?.[0]?.properties?.city
            if (foundCity) {
              handleUpdateHomeCity(foundCity)
            }
          }
        } catch {
          // Keep current
        } finally {
          setIsLocating(false)
        }
      },
      () => {
        setIsLocating(false)
      },
      { timeout: 5000 }
    )
  }

  const handleTogglePhysicalOnly = (checked: boolean) => {
    setOnlyPhysical(checked)
    try {
      localStorage.setItem("finly_map_only_physical", String(checked))
    } catch {
      // Ignore
    }
  }

  const getCategoryColor = (cat: string) => {
    const c = (cat || "").toLowerCase()
    if (c.includes("aliment") || c.includes("restau") || c.includes("course")) return "border-orange-500/60 text-orange-400"
    if (c.includes("transp") || c.includes("voiture") || c.includes("uber")) return "border-blue-500/60 text-blue-400"
    if (c.includes("loisir") || c.includes("sortie") || c.includes("cin")) return "border-purple-500/60 text-purple-400"
    if (c.includes("shop") || c.includes("achat")) return "border-pink-500/60 text-pink-400"
    if (c.includes("abon") || c.includes("serv")) return "border-indigo-500/60 text-indigo-400"
    return "border-zinc-500/60 text-zinc-300"
  }

  const getCategoryIcon = (cat: string) => {
    const c = (cat || "").toLowerCase()
    if (c.includes("aliment") || c.includes("restau")) return Utensils
    if (c.includes("transp") || c.includes("car")) return Car
    if (c.includes("loisir") || c.includes("film")) return Film
    if (c.includes("shop")) return ShoppingBag
    return CreditCard
  }

  return (
    <Card className={`p-5 md:p-6 bg-[#18181B] border-white/10 rounded-3xl text-white flex flex-col gap-4 ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-indigo-400" />
            <CardTitle className="text-base font-bold text-white">
              {language === "fr" ? "Carte des Dépenses & Magasins" : "Expenses & Merchants Map"}
            </CardTitle>
            <Badge variant="outline" className="text-[11px] border-white/10 bg-zinc-900 text-zinc-400 font-mono">
              {filteredList.length} {language === "fr" ? "lieux" : "locations"}
            </Badge>
          </div>
          <span className="text-xs text-zinc-400 mt-0.5">
            {language === "fr"
              ? viewMode === "clusters"
                ? "Zones et pôles de dépenses par ville"
                : "Localisation des achats individuels en magasin"
              : viewMode === "clusters"
              ? "Expense clusters by city"
              : "Individual in-store purchases"}
          </span>
        </div>

        {/* Controls Bar: Category Dropdown + Mode Switch with Symbols + Settings Button */}
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Category Dropdown */}
          <div className="w-full sm:w-44">
            <Select
              value={selectedCategory}
              onValueChange={(val) => {
                if (val) setSelectedCategory(val)
              }}
            >
              <SelectTrigger
                className="w-full h-8 px-3 rounded-xl border border-white/10 bg-zinc-900 text-xs text-zinc-200 hover:bg-zinc-800 transition-colors focus:ring-1 focus:ring-indigo-500 cursor-pointer"
              >
                <SelectValue
                  placeholder={language === "fr" ? "Toutes les catégories" : "All categories"}
                />
              </SelectTrigger>
              <SelectContent
                className="bg-[#18181B] border border-white/10 text-white rounded-2xl p-1 shadow-2xl max-h-60 overflow-y-auto"
              >
                {categories.map((cat) => (
                  <SelectItem
                    key={cat}
                    value={cat}
                    className="rounded-xl text-xs text-zinc-300 hover:bg-white/5 cursor-pointer py-1.5 px-2.5"
                  >
                    {cat === "all"
                      ? language === "fr"
                        ? "Toutes les catégories"
                        : "All categories"
                      : t.categories[cat] || cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode Switch with Symbols */}
          <div className="flex items-center bg-zinc-900/90 p-0.5 rounded-xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => {
                setViewMode("clusters")
                setSelectedClusterPoint(null)
              }}
              title={language === "fr" ? "Zones d'achats (Clusters)" : "Purchase Zones (Clusters)"}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "clusters"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <Layers className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setViewMode("markers")
                setSelectedClusterPoint(null)
              }}
              title={language === "fr" ? "Achats individuels (Marqueurs)" : "Individual Purchases (Markers)"}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "markers"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
              }`}
            >
              <MapPin className="w-4 h-4" />
            </button>
          </div>

          {/* Settings Button (Option 2) */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsSettingsOpen(true)}
            title={language === "fr" ? "Réglages de localisation" : "Location settings"}
            className="h-8 w-8 p-0 rounded-xl border-white/10 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white shrink-0 cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[380px] md:h-[450px] rounded-2xl overflow-hidden border border-white/10 bg-zinc-950">
        <Map
          ref={mapRef}
          center={mapCenter}
          zoom={viewMode === "clusters" ? 6 : 12}
          theme="dark"
          className="w-full h-full"
        >
          <MapControls position="top-right" showZoom showFullscreen showLocate={false} />

          {/* Mode 1: Clusters Layer (Default) */}
          {viewMode === "clusters" && (
            <MapClusterLayer
              data={clusterGeoJson}
              clusterRadius={45}
              clusterMaxZoom={13}
              clusterColors={["#6366f1", "#4f46e5", "#3730a3"]}
              clusterThresholds={[4, 12]}
              pointColor="#6366f1"
              onPointClick={(feature, coordinates) => {
                setSelectedClusterPoint({
                  coordinates,
                  properties: feature.properties,
                })
              }}
              onClusterClick={(_clusterId, coordinates) => {
                if (mapRef.current) {
                  const currentZoom = mapRef.current.getZoom() || 6
                  mapRef.current.easeTo({
                    center: coordinates,
                    zoom: Math.min(currentZoom + 2.5, 15),
                    duration: 500,
                  })
                }
              }}
            />
          )}

          {/* Popup on point click in cluster mode */}
          {viewMode === "clusters" && selectedClusterPoint && (
            <MapPopup
              key={`${selectedClusterPoint.coordinates[0]}-${selectedClusterPoint.coordinates[1]}-${selectedClusterPoint.properties?.id}`}
              longitude={selectedClusterPoint.coordinates[0]}
              latitude={selectedClusterPoint.coordinates[1]}
              onClose={() => setSelectedClusterPoint(null)}
              closeOnClick={false}
              focusAfterOpen={false}
              closeButton
              className="w-64 bg-[#18181B] text-white border-white/10 rounded-2xl p-3 shadow-2xl"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/10 p-1 flex items-center justify-center shrink-0 overflow-hidden">
                    {selectedClusterPoint.properties?.logoUrl ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={selectedClusterPoint.properties.logoUrl}
                        alt=""
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none"
                        }}
                      />
                    ) : (
                      <Store className="w-4 h-4 text-zinc-300" />
                    )}
                  </div>
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className="text-xs font-bold text-white truncate">
                      {selectedClusterPoint.properties?.merchant}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      {t.categories[selectedClusterPoint.properties?.category] || selectedClusterPoint.properties?.category} • {selectedClusterPoint.properties?.date}
                    </span>
                  </div>
                </div>

                <div className="p-2 rounded-xl bg-zinc-950/80 border border-white/5 flex flex-col gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5 text-zinc-300">
                    {selectedClusterPoint.properties?.isOnline ? (
                      <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    ) : (
                      <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                    )}
                    <span className="truncate">{selectedClusterPoint.properties?.address}</span>
                  </div>
                  <span className="text-[10px] text-zinc-500 pl-5">
                    {selectedClusterPoint.properties?.city}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                  <span className="text-[11px] text-zinc-400">
                    {language === "fr" ? "Montant débité" : "Debited amount"}
                  </span>
                  <span className="font-bold font-mono text-rose-400">
                    {selectedClusterPoint.properties?.formattedAmount}
                  </span>
                </div>
              </div>
            </MapPopup>
          )}

          {/* Mode 2: Individual Markers Layer */}
          {viewMode === "markers" &&
            filteredList.map((tx) => {
              if (!tx.location || !isWithinFrance(tx.location.lat, tx.location.lng)) return null
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
                            <CatIcon className="w-3 h-3 text-zinc-300" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0 flex-1">
                          <span className="text-xs font-bold text-white truncate">
                            {tx.merchant}
                          </span>
                          <span className="text-[10px] text-zinc-400">
                            {t.categories[tx.category] || tx.category} • {tx.date}
                          </span>
                        </div>
                      </div>

                      <div className="p-2 rounded-xl bg-zinc-950/80 border border-white/5 flex flex-col gap-1 text-[11px]">
                        <div className="flex items-center gap-1.5 text-zinc-300">
                          {tx.location.isOnline ? (
                            <Globe className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          ) : (
                            <Building2 className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
                          )}
                          <span className="truncate">{tx.location.address}</span>
                        </div>
                        <span className="text-[10px] text-zinc-500 pl-5">
                          {tx.location.city} {tx.location.zipCode || ""}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-white/5 text-xs">
                        <span className="text-[11px] text-zinc-400">
                          {language === "fr" ? "Montant débité" : "Debited amount"}
                        </span>
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

      {/* Settings Modal (Option 2 & Option 1) */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="max-w-md bg-[#18181B] border-white/10 text-white rounded-3xl p-6 shadow-2xl">
          <DialogHeader className="flex flex-col gap-1">
            <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
              <SlidersHorizontal className="w-4 h-4 text-indigo-400" />
              {language === "fr" ? "Réglages de la carte" : "Map Settings"}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-5 py-2">
            {/* Section: Residence Anchoring (Option 2) */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-zinc-200">
                  {language === "fr" ? "Ville de résidence (ancrage)" : "Home City (Anchor)"}
                </span>
                <button
                  type="button"
                  onClick={handleGeolocate}
                  disabled={isLocating}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Navigation className={`w-3 h-3 ${isLocating ? "animate-spin" : ""}`} />
                  {isLocating ? "Recherche..." : "Me géolocaliser"}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: Nantes, Lyon, Paris..."
                  value={customCityInput}
                  onChange={(e) => setCustomCityInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customCityInput.trim()) {
                      handleUpdateHomeCity(customCityInput)
                    }
                  }}
                  className="flex-1 h-8 px-3 rounded-xl border border-white/10 bg-zinc-950 text-xs text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500"
                />
                <Button
                  size="sm"
                  onClick={() => handleUpdateHomeCity(customCityInput)}
                  disabled={!customCityInput.trim()}
                  className="h-8 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs text-white cursor-pointer"
                >
                  Appliquer
                </Button>
              </div>

              {/* Quick suggestions pills */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {POPULAR_CITIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => handleUpdateHomeCity(c)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer border ${
                      homeCity.toLowerCase() === c.toLowerCase()
                        ? "bg-indigo-600 text-white border-indigo-500 shadow-sm"
                        : "bg-zinc-950/80 border-white/5 text-zinc-400 hover:text-white hover:bg-zinc-800"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {/* Section: Physical Purchases Only Filter (Option 1) */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-zinc-950/70 border border-white/5">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-zinc-200">
                  {language === "fr" ? "Achats physiques en magasin uniquement" : "In-store physical purchases only"}
                </span>
                <span className="text-[11px] text-zinc-500">
                  {language === "fr"
                    ? "Exclut automatiquement loyers, EDF, abonnements et virements"
                    : "Excludes rent, utilities, subscriptions, and transfers"}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleTogglePhysicalOnly(!onlyPhysical)}
                className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${
                  onlyPhysical ? "bg-indigo-600" : "bg-zinc-800 border border-white/10"
                }`}
              >
                <div
                  className={`w-4 h-4 rounded-full bg-white transition-transform absolute top-1 ${
                    onlyPhysical ? "right-1" : "left-1"
                  }`}
                />
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}



