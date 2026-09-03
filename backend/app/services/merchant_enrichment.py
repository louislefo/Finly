import httpx
import re
import urllib.parse
from typing import Optional, Dict, Any

# In-memory cache for merchant company lookups
_ENRICHMENT_CACHE: Dict[str, Dict[str, Any]] = {}

# Common known brand domains for instant logo resolution
KNOWN_DOMAINS: Dict[str, str] = {
    "monoprix": "monoprix.fr",
    "carrefour": "carrefour.fr",
    "auchan": "auchan.fr",
    "leclerc": "e.leclerc",
    "lidl": "lidl.fr",
    "intermarche": "intermarche.com",
    "franprix": "franprix.fr",
    "casino": "supercasino.fr",
    "picard": "picard.fr",
    "naturalia": "naturalia.fr",
    "biocoop": "biocoop.fr",
    "sncf": "sncf-connect.com",
    "ratp": "ratp.fr",
    "uber": "uber.com",
    "bolt": "bolt.eu",
    "total": "totalenergies.fr",
    "totalenergies": "totalenergies.fr",
    "esso": "esso.fr",
    "bp": "bp.com",
    "shell": "shell.fr",
    "netflix": "netflix.com",
    "spotify": "spotify.com",
    "deezer": "deezer.com",
    "apple": "apple.com",
    "google": "google.com",
    "amazon": "amazon.fr",
    "prime": "amazon.fr",
    "disney": "disneyplus.com",
    "canal": "canalplus.com",
    "free": "free.fr",
    "orange": "orange.fr",
    "sfr": "sfr.fr",
    "bouygues": "bouyguestelecom.fr",
    "decathlon": "decathlon.fr",
    "fnac": "fnac.com",
    "darty": "darty.com",
    "ikea": "ikea.com",
    "leroymerlin": "leroymerlin.fr",
    "castorama": "castorama.fr",
    "boulanger": "boulanger.com",
    "zalando": "zalando.fr",
    "sephora": "sephora.fr",
    "starbucks": "starbucks.fr",
    "mcdonalds": "mcdonalds.fr",
    "burgerking": "burgerking.fr",
    "kfc": "kfc.fr",
    "paul": "paul.fr",
    "doctolib": "doctolib.fr",
    "alan": "alan.com",
    "airfrance": "airfrance.fr",
    "easyjet": "easyjet.com",
    "ryanair": "ryanair.com",
    "airbnb": "airbnb.fr",
    "booking": "booking.com",
    "paypal": "paypal.com",
    "stripe": "stripe.com",
    "edf": "edf.fr",
    "engie": "engie.fr",
}

def clean_merchant_query(raw_text: str) -> str:
    """Cleans bank prefixes, card numbers, locations, and codes to get the search query."""
    if not raw_text:
        return ""

    text = raw_text.upper()
    # Strip banking prefixes
    prefixes = [
        "CB ", "CARTE ", "VIR ", "VIREMENT ", "PRLV ", "PRELEVEMENT ", "SEPA ",
        "PAIEMENT PSC ", "ACHAT ", "COTIS ", "CHEQUE ", "RETRAIT DAB ", "RETRAIT "
    ]
    for p in prefixes:
        if text.startswith(p):
            text = text[len(p):]

    # Remove dates and timestamps like 120426, 12/04/2026, 14H30
    text = re.sub(r'\b\d{2}[/-]\d{2}[/-]\d{2,4}\b', ' ', text)
    text = re.sub(r'\b\d{6,8}\b', ' ', text)
    text = re.sub(r'\b\d{1,2}H\d{2}\b', ' ', text)
    text = re.sub(r'\bFACT\b|\bFACTURE\b|\bNUM\b|\bREF\b', ' ', text)

    # Remove special chars except spaces and letters
    text = re.sub(r'[^A-Z0-9\s-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    # Take first 3 meaningful words
    words = [w for w in text.split(' ') if len(w) > 1 and not w.isdigit()]
    return " ".join(words[:3])

async def fetch_company_info(merchant_name: str, raw_label: Optional[str] = None) -> Dict[str, Any]:
    """Queries recherche-entreprises.api.gouv.fr and resolves company details + logo."""
    query = merchant_name or raw_label or ""
    query_clean = clean_merchant_query(query)

    if not query_clean:
        return {"found": False, "merchant": merchant_name}

    cache_key = query_clean.lower()
    if cache_key in _ENRICHMENT_CACHE:
        return _ENRICHMENT_CACHE[cache_key]

    # Check for known logo domain
    domain: Optional[str] = None
    for k, d in KNOWN_DOMAINS.items():
        if k in cache_key:
            domain = d
            break

    logo_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=128" if domain else None

    result: Dict[str, Any] = {
        "found": False,
        "query": query_clean,
        "merchant": merchant_name,
        "nom_complet": merchant_name,
        "siren": None,
        "siret": None,
        "activite_principale": None,
        "activite_label": None,
        "adresse": None,
        "commune": None,
        "code_postal": None,
        "nature_juridique": None,
        "categorie_entreprise": None,
        "date_creation": None,
        "logo_url": logo_url,
        "domain": domain,
    }

    try:
        url = f"https://recherche-entreprises.api.gouv.fr/search?q={urllib.parse.quote(query_clean)}&per_page=1"
        async with httpx.AsyncClient(timeout=4.0) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    etab = results[0]
                    siege = etab.get("siege", {})

                    result["found"] = True
                    result["nom_complet"] = etab.get("nom_complet") or etab.get("nom_raison_sociale") or merchant_name
                    result["siren"] = etab.get("siren")
                    result["siret"] = siege.get("siret")
                    result["activite_principale"] = etab.get("activite_principale")
                    result["activite_label"] = etab.get("libelle_activite_principale") or siege.get("activite_principale")
                    result["nature_juridique"] = etab.get("nature_juridique")
                    result["categorie_entreprise"] = etab.get("categorie_entreprise")
                    result["date_creation"] = etab.get("date_creation")

                    # Address formatting
                    adresse_complete = siege.get("adresse") or siege.get("geo_adresse")
                    result["adresse"] = adresse_complete
                    result["commune"] = siege.get("libelle_commune")
                    result["code_postal"] = siege.get("code_postal")

                    # Try to infer domain if not found yet
                    if not domain:
                        nom_slug = re.sub(r'[^a-zA-Z0-9]', '', etab.get("nom_complet", "").split()[0].lower())
                        if len(nom_slug) >= 3:
                            result["domain"] = f"{nom_slug}.fr"
                            result["logo_url"] = f"https://www.google.com/s2/favicons?domain={nom_slug}.fr&sz=128"
    except Exception as e:
        # Graceful fallback on network timeout or failure
        pass

    _ENRICHMENT_CACHE[cache_key] = result
    return result
