import re
from typing import Tuple

class CleanerService:
    # Common prefixes in French and European bank statements
    PREFIX_PATTERNS = [
        r"^(CB|CARTE|PAIEMENT PAR CARTE|ACHAT CB|RETRAIT DAB|RETRAIT GAB)\s+",
        r"^(VIR|VIREMENT|VIR SEPA|VIR RECU|VIR INST|PRLV|PRELEVEMENT|PRELEVEMENT SEPA)\s+",
        r"^(COTIS|COTISATION|COMMISSION|FRAIS|CHEQUE|REMISE CHEQUE)\s+",
    ]

    # Trailing dates, card numbers, locations, and codes
    SUFFIX_PATTERNS = [
        r"\s+\d{2}/\d{2}(/\d{2,4})?(\s+\d{2}H\d{2})?.*$",  # Dates like 28/07 or 28/07/2026 14H20
        r"\s+CARTE\s+\*+\d+.*$",                           # CARTE **1234
        r"\s+PARIS\s+\d{1,2}.*$",                          # PARIS 15
        r"\s+(FR|FRA|FRANCE|PARIS|LYON|MARSEILLE)\s*$",   # Country/City codes at end
        r"\s+\d{5}\s+[A-Z\s]+$",                           # Postal codes e.g. 75015 PARIS
        r"\s+REF\s*:?\s*[A-Z0-9_-]+.*$",                   # Reference codes
        r"\s+MOTIF\s*:?.*$",                               # SEPA motifs
        r"\s+EMETTEUR\s*:?.*$",                            # Emetteur tags
    ]

    @classmethod
    def clean_merchant_name(cls, raw_label: str) -> str:
        if not raw_label:
            return "Inconnu"

        text = raw_label.strip()

        # Remove prefixes
        for pattern in cls.PREFIX_PATTERNS:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()

        # Remove suffixes
        for pattern in cls.SUFFIX_PATTERNS:
            text = re.sub(pattern, "", text, flags=re.IGNORECASE).strip()

        # Specific merchant cleanups
        known_merchants = {
            r"CARREFOUR.*": "Carrefour",
            r"MONOPRIX.*": "Monoprix",
            r"FRANPRIX.*": "Franprix",
            r"AUCHAN.*": "Auchan",
            r"LECLERC.*": "E.Leclerc",
            r"LIDL.*": "Lidl",
            r"INTERMARCHE.*": "Intermarché",
            r"UBER\s*EATS.*": "Uber Eats",
            r"DELIVEROO.*": "Deliveroo",
            r"UBER.*TRIP.*": "Uber",
            r"SNCF.*": "SNCF Connect",
            r"RATP.*": "RATP",
            r"TOTAL.*": "TotalEnergies",
            r"BP\s+.*": "BP",
            r"SHELL.*": "Shell",
            r"NETFLIX.*": "Netflix",
            r"SPOTIFY.*": "Spotify",
            r"AMAZON.*PRIME.*": "Amazon Prime",
            r"AMAZON.*": "Amazon",
            r"APPLE.*": "Apple",
            r"GOOGLE.*": "Google",
            r"FNAC.*": "Fnac",
            r"DARTY.*": "Darty",
            r"LEROY\s*MERLIN.*": "Leroy Merlin",
            r"IKEA.*": "IKEA",
            r"SALAIRE.*": "Virement Salaire",
            r"LOYER.*": "Loyer",
        }

        for pattern, replacement in known_merchants.items():
            if re.search(pattern, text, flags=re.IGNORECASE):
                return replacement

        # Capitalize nicely if all uppercase
        if text.isupper():
            text = text.title()

        return text or raw_label
