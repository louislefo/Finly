import httpx
import re
import urllib.parse
from typing import Optional, Dict, Any, Tuple

# In-memory cache for merchant company lookups
_ENRICHMENT_CACHE: Dict[str, Dict[str, Any]] = {}

# Patterns that should NEVER be queried against Sirene/Entreprises
NON_COMMERCIAL_PATTERNS = [
    r'\bVIR\b',
    r'\bVIREMENT\b',
    r'\bSEPA\b',
    r'\bEPARGNE\b',
    r'\bLIVRET\b',
    r'\bVERSEMENT\b',
    r'\bTRANSFERT\b',
    r'\bINTERNE\b',
    r'\bSALAIRE\b',
    r'\bREMISE\b',
    r'\bCHEQUE\b',
    r'\bRETRAIT\b',
    r'\bDISTRIBUTEUR\b',
    r'\bDAB\b',
    r'\bGAB\b',
    r'\bCOTISATION\b',
    r'\bFRAIS\b',
    r'\bINTERETS\b',
    r'\bAGIOS\b',
    r'\bCOMMISSION\b',
    r'\bIMPOT\b',
    r'\bIMPOTS\b',
    r'\bDGFIP\b',
    r'\bCPAM\b',
    r'\bCAF\b',
    r'\bURSSAF\b',
    r'\bPOLE EMPLOI\b',
    r'\bFRANCE TRAVAIL\b',
    r'\bM\.\s+[A-Z]',
    r'\bMME\s+[A-Z]',
    r'\bMR\s+[A-Z]',
    r'\bMONSIEUR\b',
    r'\bMADAME\b',
    r'\bMADEMOISELLE\b',
]

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
    "grand frais": "grandfrais.com",
    "aldi": "aldi.fr",
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
    "netflix": "netflix.com",
    "spotify": "spotify.com",
    "deezer": "deezer.com",
    "apple": "apple.com",
    "google": "google.com",
    "amazon": "amazon.fr",
    "prime": "amazon.fr",
    "disney": "disneyplus.com",
    "canal": "canalplus.com",
    "youtube": "youtube.com",
    "playstation": "playstation.com",
    "sony": "sony.fr",
    "nintendo": "nintendo.fr",
    "xbox": "xbox.com",
    "microsoft": "microsoft.com",
    "steam": "steampowered.com",
    "free": "free.fr",
    "orange": "orange.fr",
    "sfr": "sfr.fr",
    "bouygues": "bouyguestelecom.fr",
    "sosh": "sosh.fr",
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
    "starbucks": "starbucks.fr",
    "mcdonalds": "mcdonalds.fr",
    "burger king": "burgerking.fr",
    "kfc": "kfc.fr",
    "paul": "paul.fr",
    "subway": "subway.com",
    "deliveroo": "deliveroo.fr",
    "uber eats": "ubereats.com",
    "doctolib": "doctolib.fr",
    "alan": "alan.com",
    "airbnb": "airbnb.fr",
    "booking": "booking.com",
    "paypal": "paypal.com",
    "stripe": "stripe.com",
    "revolut": "revolut.com",
    "boursobank": "boursobank.com",
    "edf": "edf.fr",
    "engie": "engie.fr",
}

def is_non_commercial(text: str) -> bool:
    """Returns True if the label represents a transfer, bank fee, tax or personal name."""
    if not text:
        return True
    upper = text.upper()
    for pattern in NON_COMMERCIAL_PATTERNS:
        if re.search(pattern, upper):
            return True
    return False

def extract_postal_code(text: str) -> Optional[str]:
    """Extracts a 5-digit French postal code from the label if present."""
    match = re.search(r'\b(0[1-9]|[1-8]\d|9[0-8]|2[AB])\d{3}\b', text)
    return match.group(0) if match else None

def clean_merchant_query(raw_text: str) -> Tuple[str, Optional[str]]:
    """
    Cleans bank prefixes, card numbers, locations, and codes.
    Returns (cleaned_query, postal_code).
    """
    if not raw_text:
        return ("", None)

    postal_code = extract_postal_code(raw_text)
    text = raw_text.upper()

    # Strip banking prefixes
    prefixes = [
        "CB ", "CARTE ", "PAIEMENT PSC ", "PAIEMENT CARTE ", "ACHAT CB ",
        "ACHAT ", "COTIS ", "FACTURE ", "PRLV ", "PRELEVEMENT "
    ]
    for p in prefixes:
        if text.startswith(p):
            text = text[len(p):]

    # Remove dates and timestamps like 120426, 12/04/2026, 14H30
    text = re.sub(r'\b\d{2}[/-]\d{2}[/-]\d{2,4}\b', ' ', text)
    text = re.sub(r'\b\d{6,8}\b', ' ', text)
    text = re.sub(r'\b\d{1,2}H\d{2}\b', ' ', text)
    text = re.sub(r'\bFACT\b|\bFACTURE\b|\bNUM\b|\bREF\b', ' ', text)

    # Remove postal code from name query if extracted
    if postal_code:
        text = text.replace(postal_code, ' ')

    # Remove special chars except spaces and letters
    text = re.sub(r'[^A-Z0-9\s-]', ' ', text)
    text = re.sub(r'\s+', ' ', text).strip()

    # Take first 3 meaningful words (length >= 2)
    words = [w for w in text.split(' ') if len(w) > 1 and not w.isdigit()]
    cleaned = " ".join(words[:3])
    return (cleaned, postal_code)

async def fetch_company_info(merchant_name: str, raw_label: Optional[str] = None) -> Dict[str, Any]:
    """
    Queries recherche-entreprises.api.gouv.fr strictly for genuine commercial operations.
    Never invents random domains. Matches local establishment if postal code / location exists.
    """
    full_text = f"{merchant_name or ''} {raw_label or ''}".strip()

    # 1. Guard against non-commercial / transfers / personal operations
    if is_non_commercial(merchant_name) or is_non_commercial(raw_label or ""):
        return {
            "found": False,
            "is_non_commercial": True,
            "merchant": merchant_name,
            "nom_complet": merchant_name,
            "logo_url": None,
            "domain": None,
        }

    query_clean, postal_code = clean_merchant_query(merchant_name or raw_label or "")
    if len(query_clean) < 3:
        return {"found": False, "merchant": merchant_name, "logo_url": None, "domain": None}

    cache_key = f"{query_clean.lower()}_{postal_code or ''}"
    if cache_key in _ENRICHMENT_CACHE:
        return _ENRICHMENT_CACHE[cache_key]

    # 2. Check for known verified logo domain
    domain: Optional[str] = None
    cache_lookup = query_clean.lower()
    for k, d in KNOWN_DOMAINS.items():
        if k in cache_lookup:
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
        "is_matching_etablissement": False,
        "latitude": None,
        "longitude": None,
        "logo_url": logo_url,
        "domain": domain,
    }

    try:
        # Build URL with optional postal code filter if available
        params = f"q={urllib.parse.quote(query_clean)}&per_page=1"
        if postal_code:
            params += f"&code_postal={postal_code}"

        url = f"https://recherche-entreprises.api.gouv.fr/search?{params}"
        async with httpx.AsyncClient(timeout=3.5) as client:
            resp = await client.get(url)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    etab = results[0]
                    siege = etab.get("siege", {})

                    # Check for local establishment match
                    matching_etabs = etab.get("matching_etablissements", [])
                    target_etab = matching_etabs[0] if matching_etabs else siege
                    is_local = bool(matching_etabs)

                    result["found"] = True
                    result["nom_complet"] = etab.get("nom_complet") or etab.get("nom_raison_sociale") or merchant_name
                    result["siren"] = etab.get("siren")
                    result["siret"] = target_etab.get("siret") or siege.get("siret")
                    result["activite_principale"] = etab.get("activite_principale")
                    result["activite_label"] = etab.get("libelle_activite_principale") or target_etab.get("activite_principale")
                    result["nature_juridique"] = etab.get("nature_juridique")
                    result["categorie_entreprise"] = etab.get("categorie_entreprise")
                    result["date_creation"] = etab.get("date_creation")
                    result["is_matching_etablissement"] = is_local

                    # Address formatting & GPS coordinates
                    adresse_complete = target_etab.get("adresse") or target_etab.get("geo_adresse") or siege.get("adresse")
                    result["adresse"] = adresse_complete
                    result["commune"] = target_etab.get("libelle_commune") or siege.get("libelle_commune")
                    result["code_postal"] = target_etab.get("code_postal") or siege.get("code_postal")
                    result["latitude"] = target_etab.get("latitude") or siege.get("latitude")
                    result["longitude"] = target_etab.get("longitude") or siege.get("longitude")
    except Exception:
        # Graceful network error handling
        pass

    _ENRICHMENT_CACHE[cache_key] = result
    return result
