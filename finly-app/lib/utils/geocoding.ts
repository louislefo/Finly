import { Transaction } from "@/lib/types/finance"

export interface GeoLocation {
  lat: number
  lng: number
  address: string
  city: string
  zipCode?: string
  isOnline?: boolean
}

// In-memory cache to prevent repeated geocoding requests across component renders
const geoCache = new Map<string, GeoLocation>()

// Local storage key for persistent caching
const STORAGE_CACHE_KEY = "finly_geo_cache_v5"
const USER_HOME_CITY_KEY = "finly_user_home_city"

/**
 * Returns user configured home city or defaults to Paris
 */
export function getUserHomeCity(): string {
  if (typeof window === "undefined") return "Paris"
  try {
    return localStorage.getItem(USER_HOME_CITY_KEY) || "Paris"
  } catch {
    return "Paris"
  }
}

/**
 * Updates user configured home city
 */
export function setUserHomeCity(city: string): void {
  if (typeof window === "undefined") return
  try {
    const trimmed = city.trim()
    if (trimmed) {
      localStorage.setItem(USER_HOME_CITY_KEY, trimmed)
      // Clear in-memory cache so unanchored transactions recalculate
      geoCache.clear()
    }
  } catch {
    // Ignore storage quota
  }
}

/**
 * Ensures coordinates are strictly located in France (metropolitan or overseas territories)
 */
export function isWithinFrance(lat: number, lng: number): boolean {
  // Metropolitan France
  const isMetro = lat >= 41.2 && lat <= 51.3 && lng >= -5.3 && lng <= 9.8
  // DOM-TOM (Guadeloupe, Martinique, Guyane, Réunion, Mayotte)
  const isDomTom =
    (lat >= 14.3 && lat <= 16.6 && lng >= -61.9 && lng <= -60.7) || // Guadeloupe & Martinique
    (lat >= 2.1 && lat <= 5.8 && lng >= -54.7 && lng <= -51.6) || // Guyane
    (lat >= -21.4 && lat <= -20.8 && lng >= 55.2 && lng <= 55.9) || // Réunion
    (lat >= -13.0 && lat <= -12.6 && lng >= 45.0 && lng <= 45.3) // Mayotte

  return isMetro || isDomTom
}

function getStoredCache(): Record<string, GeoLocation> {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    // Filter out any stale invalid coordinates outside France
    const clean: Record<string, GeoLocation> = {}
    for (const [k, v] of Object.entries(parsed)) {
      const loc = v as GeoLocation
      if (loc && typeof loc.lat === "number" && typeof loc.lng === "number" && isWithinFrance(loc.lat, loc.lng)) {
        clean[k] = loc
      }
    }
    return clean
  } catch {
    return {}
  }
}

function saveToStoredCache(key: string, loc: GeoLocation) {
  if (typeof window === "undefined") return
  try {
    if (!isWithinFrance(loc.lat, loc.lng)) return
    const current = getStoredCache()
    current[key] = loc
    localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(current))
  } catch {
    // Ignore storage quota errors
  }
}

// Online services that do not correspond to a physical in-store visit
const KNOWN_ONLINE_MERCHANTS = [
  "netflix",
  "spotify",
  "deezer",
  "amazon",
  "prime",
  "apple.com/bill",
  "itunes",
  "google *",
  "google storage",
  "youtube",
  "steam",
  "playstation",
  "nintendo",
  "xbox",
  "microsoft",
  "openai",
  "chatgpt",
  "github",
  "anthropic",
  "claude",
  "ovh",
  "scaleway",
  "vercel",
  "stripe",
  "paypal",
  "vinted",
  "leboncoin",
  "deliveroo",
  "uber * eats",
  "airbnb",
  "booking.com",
  "sncf connect",
  "adobe",
  "notion",
  "canva",
]

/**
 * Checks if a transaction is an online/cloud service
 */
export function isOnlineMerchant(merchant: string, rawLabel?: string): boolean {
  const text = `${merchant} ${rawLabel || ""}`.toLowerCase()
  return KNOWN_ONLINE_MERCHANTS.some((m) => text.includes(m))
}

// Recurring non-physical markers (rent, utilities, taxes, recurring debits)
const NON_PHYSICAL_PATTERNS: RegExp[] = [
  /\bVIR\b/i,
  /\bVIREMENT\b/i,
  /\bSEPA\b/i,
  /\bEPARGNE\b/i,
  /\bLIVRET\b/i,
  /\bVERSEMENT\b/i,
  /\bTRANSFERT\b/i,
  /\bSALAIRE\b/i,
  /\bPRLV\b/i,
  /\bPRELEVEMENT\b/i,
  /\bCOTISATION\b/i,
  /\bCOTIS\b/i,
  /\bASSURANCE\b/i,
  /\bMUTUELLE\b/i,
  /\bEDF\b/i,
  /\bENGIE\b/i,
  /\bTOTALENERGIES ELEC\b/i,
  /\bLOYER\b/i,
  /\bGESTION IMMOBILIERE\b/i,
  /\bFREE FIBRE\b/i,
  /\bFREEBOX\b/i,
  /\bORANGE\b/i,
  /\bSFR\b/i,
  /\bBOUYGUES TELECOM\b/i,
  /\bIMPOT\b/i,
  /\bIMPOTS\b/i,
  /\bDGFIP\b/i,
  /\bCPAM\b/i,
  /\bCAF\b/i,
  /\bURSSAF\b/i,
  /\bFRAIS BANCAIRE\b/i,
  /\bAGIOS\b/i,
  /\bINTERETS\b/i,
]

/**
 * Determines whether a transaction is a genuine physical in-store expense
 * (Option 1: filters out rent, direct debits, digital subscriptions, salaries, transfers)
 */
export function isPhysicalExpense(tx: Transaction): boolean {
  // Exclude incomes & non-expenses
  if (tx.amount > 0) return false

  const cat = (tx.category || "").toLowerCase()
  if (cat.includes("revenu") || cat.includes("salaire") || cat.includes("épargne") || cat.includes("epargne") || cat.includes("invest")) {
    return false
  }

  // Exclude digital online services
  if (isOnlineMerchant(tx.merchant, tx.rawLabel || (tx as any).raw_label)) {
    return false
  }

  const raw = `${tx.merchant} ${tx.rawLabel || (tx as any).raw_label || ""}`
  for (const pattern of NON_PHYSICAL_PATTERNS) {
    if (pattern.test(raw)) {
      return false
    }
  }

  return true
}

/**
 * Extracts 5-digit French postal code if present
 */
export function extractPostalCode(text: string): string | null {
  const match = text.match(/\b(0[1-9]|[1-8]\d|9[0-8]|2[AB])\d{3}\b/)
  return match ? match[0] : null
}

const MAJOR_FRENCH_CITIES = [
  "PARIS",
  "MARSEILLE",
  "LYON",
  "TOULOUSE",
  "NICE",
  "NANTES",
  "STRASBOURG",
  "MONTPELLIER",
  "BORDEAUX",
  "LILLE",
  "RENNES",
  "REIMS",
  "TOULON",
  "SAINT-ETIENNE",
  "LE HAVRE",
  "GRENOBLE",
  "DIJON",
  "ANGERS",
  "VILLEURBANNE",
  "NIMES",
  "CLERMONT-FERRAND",
  "AIX-EN-PROVENCE",
  "BREST",
  "LIMOGES",
  "TOURS",
  "AMIENS",
  "PERPIGNAN",
  "METZ",
  "BESANCON",
  "BOULOGNE-BILLANCOURT",
  "ORLEANS",
  "MULHOUSE",
  "CAEN",
  "ROUEN",
  "NANCY",
  "ARGENTEUIL",
  "MONTREUIL",
  "SAINT-DENIS",
  "ROUBAIX",
  "AVIGNON",
  "TOURCOING",
  "POITIERS",
  "NANTERRE",
  "VERSAILLES",
  "COURBEVOIE",
  "PAU",
  "VITRY-SUR-SEINE",
  "ASNIERES-SUR-SEINE",
  "COLOMBES",
  "AULNAY-SOUS-BOIS",
  "LA ROCHELLE",
  "RUEIL-MALMAISON",
  "ANTIBES",
  "SAINT-MAUR-DES-FOSSES",
  "CALAIS",
  "CHAMPIGNY-SUR-MARNE",
  "AUBERVILLIERS",
  "BEZIERS",
  "BOURGES",
  "CANNES",
  "SAINT-NAZAIRE",
  "DUNKERQUE",
  "QUIMPER",
  "VALENCE",
  "COLMAR",
]

/**
 * Parses raw banking label and merchant name to extract store name, postal code, city, and location tokens
 */
export function extractMerchantAndLocationInfo(
  merchant: string,
  rawLabel?: string
): {
  cleanStore: string
  postalCode: string | null
  cityHint: string | null
  locationQuery: string
  isOnline: boolean
} {
  const isOnline = isOnlineMerchant(merchant, rawLabel)
  const fullRaw = `${merchant} ${rawLabel || ""}`
  const postalCode = extractPostalCode(fullRaw)

  let text = fullRaw.toUpperCase()

  // Clean bank prefixes
  const bankPrefixes = [
    "PAIEMENT CARTE ",
    "PAIEMENT PSC ",
    "ACHAT CB ",
    "CARTE ",
    "CB ",
    "ACHAT ",
    "PRLV SEPA ",
    "PRLV ",
    "COTIS ",
    "FACTURE ",
    "VIR SEPA ",
    "VIR ",
    "RETRAIT DAB ",
    "RETRAIT GAB ",
    "RETRAIT ",
    "DAB ",
    "GAB ",
  ]
  for (const p of bankPrefixes) {
    if (text.startsWith(p)) {
      text = text.slice(p.length)
    }
  }

  // Remove dates (e.g. 12/04/26, 12-04-2026, 120426) and timestamps (14H30)
  text = text.replace(/\b\d{2}[/-]\d{2}[/-]\d{2,4}\b/g, " ")
  text = text.replace(/\b\d{1,2}H\d{2}\b/g, " ")
  text = text.replace(/\b(NUM|REF|FACT|FACTURE|DOSSIER|CARTE)\s*:\s*\S+/gi, " ")

  // Detect Paris/Lyon/Marseille arrondissements from text or postal code
  let cityHint: string | null = null

  if (postalCode) {
    if (postalCode.startsWith("750") || postalCode.startsWith("751")) {
      const num = parseInt(postalCode.slice(3), 10)
      if (num >= 1 && num <= 20) {
        cityHint = `PARIS ${num}e`
      }
    } else if (postalCode.startsWith("6900")) {
      const num = parseInt(postalCode.slice(4), 10)
      if (num >= 1 && num <= 9) {
        cityHint = `LYON ${num}e`
      }
    } else if (postalCode.startsWith("130")) {
      const num = parseInt(postalCode.slice(3), 10)
      if (num >= 1 && num <= 16) {
        cityHint = `MARSEILLE ${num}e`
      }
    }
  }

  if (!cityHint) {
    const arrMatch = text.match(/\b(PARIS|LYON|MARSEILLE)\s*(\d{1,2})(E|EME|ER)?\b/i)
    if (arrMatch) {
      cityHint = `${arrMatch[1]} ${arrMatch[2]}e`
    }
  }

  // Detect major French cities in label
  if (!cityHint) {
    for (const city of MAJOR_FRENCH_CITIES) {
      const regex = new RegExp(`\\b${city}\\b`, "i")
      if (regex.test(text)) {
        cityHint = city
        break
      }
    }
  }

  // Anchor to user's home city if no explicit city or postal code is present (Option 2)
  if (!cityHint && !postalCode) {
    cityHint = getUserHomeCity()
  }

  // Strip legal suffixes
  let cleanStore = merchant.replace(/\b(SAS|SARL|SA|EURL|SNC|FRANCE|DISTRIB|DIR|SERVICES|HOLDING)\b/gi, "").trim()
  if (!cleanStore) cleanStore = merchant

  // Build high-accuracy geographic query
  const queryParts: string[] = [cleanStore]
  if (postalCode) {
    queryParts.push(postalCode)
  }
  if (cityHint && (!postalCode || !postalCode.startsWith("75"))) {
    queryParts.push(cityHint)
  }

  const locationQuery = queryParts.join(" ").trim()

  return {
    cleanStore,
    postalCode,
    cityHint,
    locationQuery,
    isOnline,
  }
}

// Department centers for instant postal code resolution
const DEPT_COORDINATES: Record<string, { lat: number; lng: number; name: string }> = {
  "75": { lat: 48.8566, lng: 2.3522, name: "Paris" },
  "69": { lat: 45.764, lng: 4.8357, name: "Lyon" },
  "13": { lat: 43.2965, lng: 5.3698, name: "Marseille" },
  "31": { lat: 43.6047, lng: 1.4442, name: "Toulouse" },
  "06": { lat: 43.7102, lng: 7.262, name: "Nice" },
  "44": { lat: 47.2184, lng: -1.5536, name: "Nantes" },
  "67": { lat: 48.5734, lng: 7.7521, name: "Strasbourg" },
  "34": { lat: 43.6108, lng: 3.8767, name: "Montpellier" },
  "33": { lat: 44.8378, lng: -0.5792, name: "Bordeaux" },
  "59": { lat: 50.6292, lng: 3.0573, name: "Lille" },
  "35": { lat: 48.1173, lng: -1.6778, name: "Rennes" },
  "51": { lat: 49.2583, lng: 4.0317, name: "Reims" },
  "83": { lat: 43.1242, lng: 5.928, name: "Toulon" },
  "42": { lat: 45.4397, lng: 4.3872, name: "Saint-Étienne" },
  "76": { lat: 49.4432, lng: 1.0999, name: "Rouen" },
  "38": { lat: 45.1885, lng: 5.7245, name: "Grenoble" },
  "21": { lat: 47.322, lng: 5.0415, name: "Dijon" },
  "49": { lat: 47.4784, lng: -0.5632, name: "Angers" },
  "30": { lat: 43.8367, lng: 4.3601, name: "Nîmes" },
  "29": { lat: 48.3904, lng: -4.4861, name: "Brest" },
  "63": { lat: 45.7772, lng: 3.087, name: "Clermont-Ferrand" },
  "87": { lat: 45.8336, lng: 1.2611, name: "Limoges" },
  "37": { lat: 47.3941, lng: 0.6848, name: "Tours" },
  "80": { lat: 49.8941, lng: 2.2958, name: "Amiens" },
  "66": { lat: 42.6887, lng: 2.8948, name: "Perpignan" },
  "57": { lat: 49.1193, lng: 6.1757, name: "Metz" },
  "25": { lat: 47.2378, lng: 6.0241, name: "Besançon" },
  "45": { lat: 47.9029, lng: 1.9093, name: "Orléans" },
  "68": { lat: 47.7508, lng: 7.3359, name: "Mulhouse" },
  "14": { lat: 49.1829, lng: -0.3707, name: "Caen" },
  "54": { lat: 48.6921, lng: 6.1844, name: "Nancy" },
  "84": { lat: 43.9493, lng: 4.8055, name: "Avignon" },
  "86": { lat: 46.5802, lng: 0.3404, name: "Poitiers" },
  "78": { lat: 48.8049, lng: 2.1204, name: "Versailles" },
  "17": { lat: 46.1603, lng: -1.1511, name: "La Rochelle" },
  "64": { lat: 43.2951, lng: -0.3708, name: "Pau" },
  "92": { lat: 48.8835, lng: 2.2296, name: "Hauts-de-Seine" },
  "93": { lat: 48.9137, lng: 2.4836, name: "Seine-Saint-Denis" },
  "94": { lat: 48.7904, lng: 2.4556, name: "Val-de-Marne" },
  "95": { lat: 49.0362, lng: 2.0772, name: "Val-d'Oise" },
  "77": { lat: 48.6056, lng: 2.8948, name: "Seine-et-Marne" },
  "91": { lat: 48.5318, lng: 2.2396, name: "Essonne" },
}

const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  PARIS: { lat: 48.8566, lng: 2.3522 },
  MARSEILLE: { lat: 43.2965, lng: 5.3698 },
  LYON: { lat: 45.764, lng: 4.8357 },
  TOULOUSE: { lat: 43.6047, lng: 1.4442 },
  NICE: { lat: 43.7102, lng: 7.262 },
  NANTES: { lat: 47.2184, lng: -1.5536 },
  STRASBOURG: { lat: 48.5734, lng: 7.7521 },
  MONTPELLIER: { lat: 43.6108, lng: 3.8767 },
  BORDEAUX: { lat: 44.8378, lng: -0.5792 },
  LILLE: { lat: 50.6292, lng: 3.0573 },
  RENNES: { lat: 48.1173, lng: -1.6778 },
  REIMS: { lat: 49.2583, lng: 4.0317 },
  TOULON: { lat: 43.1242, lng: 5.928 },
  "SAINT-ETIENNE": { lat: 45.4397, lng: 4.3872 },
  "LE HAVRE": { lat: 49.4944, lng: 0.1079 },
  GRENOBLE: { lat: 45.1885, lng: 5.7245 },
  DIJON: { lat: 47.322, lng: 5.0415 },
  ANGERS: { lat: 47.4784, lng: -0.5632 },
  NIMES: { lat: 43.8367, lng: 4.3601 },
  "AIX-EN-PROVENCE": { lat: 43.5297, lng: 5.4474 },
  BREST: { lat: 48.3904, lng: -4.4861 },
  "CLERMONT-FERRAND": { lat: 45.7772, lng: 3.087 },
  LIMOGES: { lat: 45.8336, lng: 1.2611 },
  TOURS: { lat: 47.3941, lng: 0.6848 },
  AMIENS: { lat: 49.8941, lng: 2.2958 },
  PERPIGNAN: { lat: 42.6887, lng: 2.8948 },
  METZ: { lat: 49.1193, lng: 6.1757 },
  BESANCON: { lat: 47.2378, lng: 6.0241 },
  ORLEANS: { lat: 47.9029, lng: 1.9093 },
  MULHOUSE: { lat: 47.7508, lng: 7.3359 },
  CAEN: { lat: 49.1829, lng: -0.3707 },
  ROUEN: { lat: 49.4432, lng: 1.0999 },
  NANCY: { lat: 48.6921, lng: 6.1844 },
  AVIGNON: { lat: 43.9493, lng: 4.8055 },
  POITIERS: { lat: 46.5802, lng: 0.3404 },
  VERSAILLES: { lat: 48.8049, lng: 2.1204 },
  CANNES: { lat: 43.5528, lng: 7.0174 },
  "LA ROCHELLE": { lat: 46.1603, lng: -1.1511 },
  PAU: { lat: 43.2951, lng: -0.3708 },
  "SAINT-NAZAIRE": { lat: 47.2735, lng: -2.2137 },
  DUNKERQUE: { lat: 51.0343, lng: 2.3768 },
  QUIMPER: { lat: 47.9975, lng: -4.0979 },
  VALENCE: { lat: 44.9334, lng: 4.8924 },
  COLMAR: { lat: 48.0794, lng: 7.3585 },
}

/**
 * Returns an instant synchronous location estimate without waiting for network requests
 */
export function getInstantGeoLocation(tx: Transaction): GeoLocation {
  const merchantKey = (tx.merchant || "").toLowerCase().trim()
  const rawText = (tx.rawLabel || (tx as any).raw_label || "").toLowerCase().trim()
  const cacheKey = `${merchantKey}__${rawText}`

  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey)!
  }

  const stored = getStoredCache()
  if (stored[cacheKey]) {
    geoCache.set(cacheKey, stored[cacheKey])
    return stored[cacheKey]
  }

  const { cleanStore, postalCode, cityHint, isOnline } = extractMerchantAndLocationInfo(
    tx.merchant,
    rawText
  )

  // Jitter offset so nearby points don't stack directly on top of each other
  const hash = Math.abs((tx.id || merchantKey + rawText).split("").reduce((acc, char) => acc + char.charCodeAt(0), 0))
  const latOffset = ((hash % 100) - 50) * 0.0006
  const lngOffset = (((hash * 17) % 100) - 50) * 0.0008

  // 1. Resolve from postal code department
  if (postalCode) {
    const dept = postalCode.slice(0, 2)
    if (DEPT_COORDINATES[dept]) {
      const { lat, lng, name } = DEPT_COORDINATES[dept]
      const loc: GeoLocation = {
        lat: lat + latOffset,
        lng: lng + lngOffset,
        address: cleanStore,
        city: cityHint || name,
        zipCode: postalCode,
        isOnline,
      }
      return loc
    }
  }

  // 2. Resolve from city hint
  if (cityHint) {
    const cleanCityKey = cityHint.split(" ")[0].toUpperCase()
    if (CITY_COORDINATES[cleanCityKey]) {
      const { lat, lng } = CITY_COORDINATES[cleanCityKey]
      const loc: GeoLocation = {
        lat: lat + latOffset,
        lng: lng + lngOffset,
        address: cleanStore,
        city: cityHint,
        zipCode: postalCode || undefined,
        isOnline,
      }
      return loc
    }
  }

  // 3. Resolve from user's configured home city (Option 2)
  const homeCity = getUserHomeCity()
  const cleanHomeCity = homeCity.split(" ")[0].toUpperCase()
  let baseLat = 48.8566
  let baseLng = 2.3522
  if (CITY_COORDINATES[cleanHomeCity]) {
    baseLat = CITY_COORDINATES[cleanHomeCity].lat
    baseLng = CITY_COORDINATES[cleanHomeCity].lng
  }

  const fallbackLoc: GeoLocation = {
    lat: baseLat + latOffset,
    lng: baseLng + lngOffset,
    address: cleanStore,
    city: cityHint || homeCity,
    zipCode: postalCode || undefined,
    isOnline,
  }

  return fallbackLoc
}

/**
 * Geocodes a transaction using:
 * 1. Cache (Memory & LocalStorage)
 * 2. Photon API (OpenStreetMap POI database for exact shop/store branch matching)
 * 3. French Base Adresse Nationale (BAN) for street/postcode verification
 * 4. Instant heuristic fallback
 */
export async function geocodeTransaction(tx: Transaction): Promise<GeoLocation> {
  const merchantKey = (tx.merchant || "").toLowerCase().trim()
  const rawText = (tx.rawLabel || (tx as any).raw_label || "").toLowerCase().trim()
  const cacheKey = `${merchantKey}__${rawText}`

  // 1. Check in-memory cache
  if (geoCache.has(cacheKey)) {
    return geoCache.get(cacheKey)!
  }

  // 2. Check persistent browser storage cache
  const stored = getStoredCache()
  if (stored[cacheKey]) {
    geoCache.set(cacheKey, stored[cacheKey])
    return stored[cacheKey]
  }

  const instantLoc = getInstantGeoLocation(tx)
  const { cleanStore, postalCode, cityHint, locationQuery, isOnline } = extractMerchantAndLocationInfo(
    tx.merchant,
    rawText
  )

  // 3. Base Adresse Nationale API (data.gouv.fr) for official French addresses / cities
  try {
    const banQuery = postalCode
      ? `${cleanStore} ${postalCode}`
      : cityHint
      ? `${cleanStore} ${cityHint}`
      : `${cleanStore} ${locationQuery}`
    const banUrl = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(banQuery)}&limit=1`
    const res = await fetch(banUrl, { signal: AbortSignal.timeout(1800) })
    if (res.ok) {
      const data = await res.json()
      if (data.features && data.features.length > 0) {
        const feat = data.features[0]
        const [lng, lat] = feat.geometry.coordinates
        const props = feat.properties || {}

        if (isWithinFrance(lat, lng)) {
          const loc: GeoLocation = {
            lat,
            lng,
            address: props.name || props.label || cleanStore,
            city: props.city || cityHint || "France",
            zipCode: props.postcode || postalCode || undefined,
            isOnline,
          }

          geoCache.set(cacheKey, loc)
          saveToStoredCache(cacheKey, loc)
          return loc
        }
      }
    }
  } catch {
    // Proceed to Photon fallback
  }

  // 4. Photon Geocoding API (OpenStreetMap POI Search with France bbox constraint)
  try {
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(locationQuery)}&limit=1&lang=fr&lat=48.8566&lon=2.3522&bbox=-5.5,41.0,9.7,51.5`
    const res = await fetch(photonUrl, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(1800),
    })
    if (res.ok) {
      const data = await res.json()
      if (data.features && data.features.length > 0) {
        const feat = data.features[0]
        const [lng, lat] = feat.geometry.coordinates
        const props = feat.properties || {}

        if (isWithinFrance(lat, lng)) {
          const street = [props.housenumber, props.street || props.name].filter(Boolean).join(" ")
          const city = props.city || props.town || props.village || cityHint || props.county || "France"
          const zip = props.postcode || postalCode || undefined

          const loc: GeoLocation = {
            lat,
            lng,
            address: street || props.name || cleanStore,
            city,
            zipCode: zip,
            isOnline,
          }

          geoCache.set(cacheKey, loc)
          saveToStoredCache(cacheKey, loc)
          return loc
        }
      }
    }
  } catch {
    // Proceed to fallback
  }

  geoCache.set(cacheKey, instantLoc)
  saveToStoredCache(cacheKey, instantLoc)
  return instantLoc
}


