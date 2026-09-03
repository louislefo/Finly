export const MAJOR_BRANDS: Record<string, string> = {
  // Supermarchés & Alimentation
  "monoprix": "monoprix.fr",
  "carrefour": "carrefour.fr",
  "auchan": "auchan.fr",
  "leclerc": "e.leclerc",
  "e leclerc": "e.leclerc",
  "e.leclerc": "e.leclerc",
  "lidl": "lidl.fr",
  "intermarche": "intermarche.com",
  "intermarché": "intermarche.com",
  "franprix": "franprix.fr",
  "casino": "supercasino.fr",
  "picard": "picard.fr",
  "naturalia": "naturalia.fr",
  "biocoop": "biocoop.fr",
  "grand frais": "grandfrais.com",
  "aldi": "aldi.fr",

  // Transports & Carburant
  "sncf": "sncf-connect.com",
  "ratp": "ratp.fr",
  "uber": "uber.com",
  "bolt": "bolt.eu",
  "blablacar": "blablacar.fr",
  "total": "totalenergies.fr",
  "totalenergies": "totalenergies.fr",
  "esso": "esso.fr",
  "bp": "bp.com",
  "shell": "shell.fr",
  "air france": "airfrance.fr",
  "easyjet": "easyjet.com",
  "ryanair": "ryanair.com",
  "transavia": "transavia.com",

  // Abonnements & Divertissement
  "netflix": "netflix.com",
  "spotify": "spotify.com",
  "deezer": "deezer.com",
  "apple": "apple.com",
  "google": "google.com",
  "amazon": "amazon.fr",
  "prime": "amazon.fr",
  "disney": "disneyplus.com",
  "canal": "canalplus.com",
  "canal+": "canalplus.com",
  "youtube": "youtube.com",
  "playstation": "playstation.com",
  "sony": "sony.fr",
  "nintendo": "nintendo.fr",
  "xbox": "xbox.com",
  "microsoft": "microsoft.com",
  "openai": "openai.com",
  "chatgpt": "openai.com",

  // Télécoms & Box
  "free": "free.fr",
  "orange": "orange.fr",
  "sfr": "sfr.fr",
  "bouygues": "bouyguestelecom.fr",
  "sosh": "sosh.fr",

  // Shopping, Maison & Sport
  "decathlon": "decathlon.fr",
  "fnac": "fnac.com",
  "darty": "darty.com",
  "ikea": "ikea.com",
  "leroy merlin": "leroymerlin.fr",
  "castorama": "castorama.fr",
  "boulanger": "boulanger.com",
  "zalando": "zalando.fr",
  "sephora": "sephora.fr",
  "zara": "zara.com",
  "h&m": "hm.com",
  "uniqlo": "uniqlo.com",
  "vinted": "vinted.fr",
  "asos": "asos.com",

  // Restauration, Fast-food & Livraison
  "starbucks": "starbucks.fr",
  "mcdonalds": "mcdonalds.fr",
  "mcdonald's": "mcdonalds.fr",
  "burger king": "burgerking.fr",
  "kfc": "kfc.fr",
  "paul": "paul.fr",
  "subway": "subway.com",
  "domino's": "dominos.fr",
  "deliveroo": "deliveroo.fr",
  "uber eats": "ubereats.com",
  "just eat": "just-eat.fr",

  // Santé & Assurances
  "doctolib": "doctolib.fr",
  "alan": "alan.com",
  "axa": "axa.fr",
  "allianz": "allianz.fr",
  "maif": "maif.fr",
  "macif": "macif.fr",

  // Voyages & Hébergement
  "airbnb": "airbnb.fr",
  "booking": "booking.com",
  "booking.com": "booking.com",
  "expedia": "expedia.fr",
  "accor": "all.accor.com",
  "ibis": "ibis.accor.com",

  // Paiement & Fintech
  "paypal": "paypal.com",
  "stripe": "stripe.com",
  "revolut": "revolut.com",
  "n26": "n26.com",
  "lydia": "lydia-app.com",
  "wise": "wise.com",

  // Énergie
  "edf": "edf.fr",
  "engie": "engie.fr",
}

export function getBrandLogoUrl(merchantName: string, rawLabel?: string): string | null {
  if (!merchantName && !rawLabel) return null

  const target = `${merchantName || ""} ${rawLabel || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // remove accents

  for (const [brand, domain] of Object.entries(MAJOR_BRANDS)) {
    const brandClean = brand.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    // Match word boundaries or substring
    if (target.includes(brandClean)) {
      return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
    }
  }

  return null
}
