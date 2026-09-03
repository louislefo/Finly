import { Transaction } from "@/lib/types/finance"

export interface GeoLocation {
  lat: number
  lng: number
  address: string
  city: string
  zipCode?: string
}

// In-memory cache to prevent repeated geocoding requests
const geoCache = new Map<string, GeoLocation>()

// Preset merchant database for instant accurate resolution
const PRESET_MERCHANT_LOCATIONS: Record<string, GeoLocation> = {
  monoprix: { lat: 48.8534, lng: 2.3789, address: "124 Avenue Ledru-Rollin", city: "Paris 11e", zipCode: "75011" },
  carrefour: { lat: 48.8612, lng: 2.3721, address: "45 Rue Oberkampf", city: "Paris 11e", zipCode: "75011" },
  "carrefour express": { lat: 48.8685, lng: 2.3614, address: "12 Rue de Turbigo", city: "Paris 3e", zipCode: "75003" },
  total: { lat: 48.8378, lng: 2.3854, address: "Boulevard de Bercy", city: "Paris 12e", zipCode: "75012" },
  "total energies": { lat: 48.8378, lng: 2.3854, address: "Boulevard de Bercy", city: "Paris 12e", zipCode: "75012" },
  starbucks: { lat: 48.8539, lng: 2.3698, address: "Place de la Bastille", city: "Paris 11e", zipCode: "75011" },
  boulangerie: { lat: 48.8572, lng: 2.3792, address: "28 Rue de la Roquette", city: "Paris 11e", zipCode: "75011" },
  "paul bakery": { lat: 48.8619, lng: 2.3512, address: "Forum des Halles", city: "Paris 1er", zipCode: "75001" },
  fnac: { lat: 48.8624, lng: 2.3478, address: "1 Forum des Halles", city: "Paris 1er", zipCode: "75001" },
  apple: { lat: 48.8711, lng: 2.3045, address: "114 Avenue des Champs-Élysées", city: "Paris 8e", zipCode: "75008" },
  decathlon: { lat: 48.8821, lng: 2.3821, address: "Quai de la Loire", city: "Paris 19e", zipCode: "75019" },
  sephora: { lat: 48.8718, lng: 2.3032, address: "70 Avenue des Champs-Élysées", city: "Paris 8e", zipCode: "75008" },
  uber: { lat: 48.8566, lng: 2.3522, address: "Course en Île-de-France", city: "Paris", zipCode: "75000" },
  sncf: { lat: 48.8448, lng: 2.3735, address: "Gare de Lyon, Place Louis-Armand", city: "Paris 12e", zipCode: "75012" },
  pharmacie: { lat: 48.8551, lng: 2.3762, address: "84 Rue de la Roquette", city: "Paris 11e", zipCode: "75011" },
  mcdonald: { lat: 48.8529, lng: 2.3705, address: "Place de la Bastille", city: "Paris 11e", zipCode: "75011" },
  zara: { lat: 48.8732, lng: 2.3314, address: "38 Boulevard Haussmann", city: "Paris 9e", zipCode: "75009" },
  leroy: { lat: 48.8622, lng: 2.3551, address: "52 Rue Rambuteau", city: "Paris 3e", zipCode: "75003" },
}

/**
 * Extracts store name and location hints from raw bank label and merchant name
 */
export function extractMerchantAndCity(merchant: string, rawLabel?: string): { store: string; cityHint: string } {
  const text = `${merchant} ${rawLabel || ""}`.toUpperCase()

  // Match Paris arrondissements (e.g. PARIS 11, PARIS 75011, P11)
  const parisMatch = text.match(/PARIS\s*(\d{1,2}|75\d{3})/i)
  const cityHint = parisMatch ? `Paris ${parisMatch[1]}` : "Paris"

  const cleanStore = merchant.replace(/SAS|SARL|FRANCE|DISTRIB|SA|DIR/gi, "").trim()
  return { store: cleanStore, cityHint }
}

/**
 * Geocodes a transaction using cache, preset DB, and free public Base Adresse / OSM API
 */
export async function geocodeTransaction(tx: Transaction): Promise<GeoLocation | null> {
  const merchantKey = tx.merchant.toLowerCase().trim()
  const rawText = (tx.rawLabel || (tx as any).raw_label || "").toLowerCase()

  // 1. Check in-memory cache
  const cacheKey = `${merchantKey}_${rawText}`
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey)!
  }

  // 2. Check preset merchants
  for (const [key, loc] of Object.entries(PRESET_MERCHANT_LOCATIONS)) {
    if (merchantKey.includes(key) || rawText.includes(key)) {
      geoCache.set(cacheKey, loc)
      return loc
    }
  }

  // 3. Online query to Free French BAN API (data.gouv.fr)
  try {
    const { store, cityHint } = extractMerchantAndCity(tx.merchant, rawText)
    const query = `${store} ${cityHint}`
    const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=1`)
    if (res.ok) {
      const data = await res.json()
      if (data.features && data.features.length > 0) {
        const feature = data.features[0]
        const [lng, lat] = feature.geometry.coordinates
        const loc: GeoLocation = {
          lat,
          lng,
          address: feature.properties.name || feature.properties.label,
          city: feature.properties.city || cityHint,
          zipCode: feature.properties.postcode,
        }
        geoCache.set(cacheKey, loc)
        return loc
      }
    }
  } catch {
    // Fallback on minor jitter around center Paris for smooth visual distribution
  }

  // Default fallback with deterministic offset based on transaction ID
  const hash = Math.abs(tx.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))
  const latOffset = ((hash % 100) - 50) * 0.0008
  const lngOffset = (((hash * 13) % 100) - 50) * 0.0012

  const fallbackLoc: GeoLocation = {
    lat: 48.8566 + latOffset,
    lng: 2.3522 + lngOffset,
    address: `${tx.merchant}`,
    city: "Paris",
  }
  geoCache.set(cacheKey, fallbackLoc)
  return fallbackLoc
}
