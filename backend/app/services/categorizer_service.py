import re

class CategorizerService:
    CATEGORY_RULES = {
        "Revenus": [
            r"SALAIRE", r"PAYE", r"VIREMENT RECU", r"REMBOURSEMENT", r"DIVIDENDE", r"INTERETS"
        ],
        "Alimentation": [
            r"CARREFOUR", r"MONOPRIX", r"FRANPRIX", r"AUCHAN", r"LECLERC", r"LIDL",
            r"INTERMARCHE", r"BOULANGERIE", r"SUPERMARCHE", r"UBER\s*EATS", r"DELIVEROO",
            r"RESTAURANT", r"BISTROT", r"BRASSERIE", r"SUSHI", r"PIZZA", r"BURGER", r"MCDONALD",
            r"PAUL", r"STARBUCKS"
        ],
        "Transports": [
            r"TOTAL", r"BP", r"SHELL", r"ESSENCE", r"STATION", r"SNCF", r"RATP", r"UBER",
            r"BOLT", r"TAXI", r"PEAGE", r"PARKING", r"AVIS", r"HERTZ", r"AIR\s*FRANCE",
            r"EASYJET", r"RYANAIR", r"BLABLACAR"
        ],
        "Logement": [
            r"LOYER", r"EDF", r"ENGIE", r"TOTALENERGIES", r"EAU", r"VEOLIA", r"SYNDIC",
            r"ASSURANCE HABITATION", r"LEROY\s*MERLIN", r"CASTORAMA", r"BRICOLAGE", r"IKEA"
        ],
        "Abonnements": [
            r"NETFLIX", r"SPOTIFY", r"DEEZER", r"AMAZON\s*PRIME", r"DISNEY", r"APPLE\.COM",
            r"GOOGLE", r"ORANGE", r"FREE\s*MOBILE", r"SFR", r"BOUYGUES", r"CANAL\+",
            r"CHATGPT", r"OPENAI", r"YOUTUBE"
        ],
        "High-Tech": [
            r"FNAC", r"DARTY", r"BOULANGER", r"APPLE\s*STORE", r"AMAZON", r"LDLC",
            r"MATERIEL\.NET"
        ],
        "Shopping": [
            r"ZARA", r"H&M", r"UNIQLO", r"GALERIES\s*LAFAYETTE", r"PRINTEMPS", r"DECATHLON",
            r"SEPHORA", r"ASOS", r"MANGO"
        ],
        "Santé": [
            r"PHARMACIE", r"DOCTOLIB", r"LABORATOIRE", r"MEDECIN", r"DENTISTE", r"MUTUELLE",
            r"OPTIQUE"
        ],
    }

    TRANSFER_PATTERNS = [
        r"VIR\s*(INTERNE|COMPTE|LIVRET|EPARGNE|PEA|DE\s+CPTE)",
        r"VIREMENT\s*(INTERNE|EMIS|RECU\s+DE\s+VOTRE|DE\s+VOTRE|VERS\s+VOTRE)",
        r"VERSEMENT\s*(EPARGNE|LIVRET|PEL|CEL|PEA)",
        r"ALIMENTATION\s*(LIVRET|COMPTE|EPARGNE)",
        r"RETRAIT\s*DE\s*LIVRET",
        r"LIVRET\s*[A-Z]?",
    ]

    INCOME_PATTERNS = [
        r"SALAIRE", r"PAYE", r"REMUNERATION", r"ALLOCATION", r"CAF",
        r"POLE\s*EMPLOI", r"FRANCE\s*TRAVAIL", r"CPAM", r"SECU",
        r"REMBOURSEMENT", r"DIVIDENDE", r"INTERETS", r"PENSION",
    ]

    @classmethod
    def categorize(cls, merchant: str, raw_label: str, amount: float) -> str:
        combined_text = f"{merchant} {raw_label}".upper()

        # 1. Check for internal transfer first
        for pat in cls.TRANSFER_PATTERNS:
            if re.search(pat, combined_text, flags=re.IGNORECASE):
                return "Virements & Épargne"

        # 2. Check for genuine income
        if amount > 0:
            for pat in cls.INCOME_PATTERNS:
                if re.search(pat, combined_text, flags=re.IGNORECASE):
                    return "Revenus"
            # If positive amount contains "VIR" without salary keywords, mark as transfer
            if "VIR" in combined_text:
                return "Virements & Épargne"
            return "Revenus"

        # 3. Check for expense categories
        for category, patterns in cls.CATEGORY_RULES.items():
            if category == "Revenus":
                continue
            for pattern in patterns:
                if re.search(pattern, combined_text, flags=re.IGNORECASE):
                    return category

        return "Divers"
