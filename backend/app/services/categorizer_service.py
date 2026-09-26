import re
import unicodedata
from difflib import SequenceMatcher
from typing import Optional, Tuple, Dict, Any, List
from sqlalchemy.orm import Session

from app.models.merchant_rule import MerchantRule
from app.services.cleaner_service import CleanerService


class CategorizationResult:
    def __init__(
        self,
        category: str,
        subcategory: Optional[str] = None,
        confidence: float = 1.0,
        is_low_confidence: bool = False,
        match_source: str = "default",
    ):
        self.category = category
        self.subcategory = subcategory
        self.confidence = round(confidence, 2)
        self.is_low_confidence = is_low_confidence or (self.confidence < 0.65)
        self.match_source = match_source

    def __str__(self) -> str:
        return self.category

    def __repr__(self) -> str:
        return f"<CategorizationResult category='{self.category}' sub='{self.subcategory}' conf={self.confidence} low={self.is_low_confidence}>"

    def __eq__(self, other: Any) -> bool:
        if isinstance(other, str):
            return self.category == other
        if isinstance(other, CategorizationResult):
            return self.category == other.category and self.subcategory == other.subcategory
        return False

    def __iter__(self):
        yield self.category
        yield self.subcategory
        yield self.confidence


class CategorizerService:
    # ---------------------------------------------------------
    # 1. High-Precision Curated Merchant Knowledge Base
    # ---------------------------------------------------------
    MERCHANT_DATABASE: Dict[str, Tuple[str, str]] = {
        # Alimentation - Supermarchés & Hypermarchés
        "CARREFOUR": ("Alimentation", "Supermarché"),
        "CARREFOUR MARKET": ("Alimentation", "Supermarché"),
        "CARREFOUR CITY": ("Alimentation", "Supermarché"),
        "CARREFOUR EXPRESS": ("Alimentation", "Supermarché"),
        "CARREFOUR CONTACT": ("Alimentation", "Supermarché"),
        "MONOPRIX": ("Alimentation", "Supermarché"),
        "MONOP": ("Alimentation", "Supermarché"),
        "FRANPRIX": ("Alimentation", "Supermarché"),
        "AUCHAN": ("Alimentation", "Supermarché"),
        "LECLERC": ("Alimentation", "Supermarché"),
        "E.LECLERC": ("Alimentation", "Supermarché"),
        "LIDL": ("Alimentation", "Supermarché"),
        "ALDI": ("Alimentation", "Supermarché"),
        "INTERMARCHE": ("Alimentation", "Supermarché"),
        "SUPER U": ("Alimentation", "Supermarché"),
        "HYPER U": ("Alimentation", "Supermarché"),
        "SYSTEME U": ("Alimentation", "Supermarché"),
        "CASINO": ("Alimentation", "Supermarché"),
        "GEANT CASINO": ("Alimentation", "Supermarché"),
        "CORA": ("Alimentation", "Supermarché"),
        "MATCH": ("Alimentation", "Supermarché"),
        "GRAND FRAIS": ("Alimentation", "Supermarché"),
        "PICARD": ("Alimentation", "Supermarché"),
        "BIOCOOP": ("Alimentation", "Supermarché"),
        "NATURALIA": ("Alimentation", "Supermarché"),
        "LA VIE CLAIRE": ("Alimentation", "Supermarché"),
        "BIO C BON": ("Alimentation", "Supermarché"),
        "NETTO": ("Alimentation", "Supermarché"),
        "LEADER PRICE": ("Alimentation", "Supermarché"),
        "COSTCO": ("Alimentation", "Supermarché"),
        "CARREFOUR DRIVE": ("Alimentation", "Supermarché"),
        "LECLERC DRIVE": ("Alimentation", "Supermarché"),
        "CHRONODRIVE": ("Alimentation", "Supermarché"),

        # Alimentation - Restaurants, Fast-Food & Cafés
        "MCDONALD": ("Alimentation", "Restaurant & Bar"),
        "MCDO": ("Alimentation", "Restaurant & Bar"),
        "BURGER KING": ("Alimentation", "Restaurant & Bar"),
        "KFC": ("Alimentation", "Restaurant & Bar"),
        "SUBWAY": ("Alimentation", "Restaurant & Bar"),
        "QUICK": ("Alimentation", "Restaurant & Bar"),
        "FIVE GUYS": ("Alimentation", "Restaurant & Bar"),
        "DOMINOS PIZZA": ("Alimentation", "Restaurant & Bar"),
        "PIZZA HUT": ("Alimentation", "Restaurant & Bar"),
        "OTAKOS": ("Alimentation", "Restaurant & Bar"),
        "O TACOS": ("Alimentation", "Restaurant & Bar"),
        "BIG MAMMA": ("Alimentation", "Restaurant & Bar"),
        "EAST MAMMA": ("Alimentation", "Restaurant & Bar"),
        "OBER MAMMA": ("Alimentation", "Restaurant & Bar"),
        "MAMMA PRIMI": ("Alimentation", "Restaurant & Bar"),
        "PINK MAMMA": ("Alimentation", "Restaurant & Bar"),
        "POKETTE": ("Alimentation", "Restaurant & Bar"),
        "POKAWA": ("Alimentation", "Restaurant & Bar"),
        "PITAYA": ("Alimentation", "Restaurant & Bar"),
        "JOUR": ("Alimentation", "Restaurant & Bar"),
        "EXKI": ("Alimentation", "Restaurant & Bar"),
        "PRET A MANGER": ("Alimentation", "Restaurant & Bar"),
        "COJEAN": ("Alimentation", "Restaurant & Bar"),
        "STARBUCKS": ("Alimentation", "Restaurant & Bar"),
        "COLUMBUS CAFE": ("Alimentation", "Restaurant & Bar"),
        "PAUL": ("Alimentation", "Boulangerie"),
        "BRIOCHE DOREE": ("Alimentation", "Boulangerie"),
        "BOULANGERIE": ("Alimentation", "Boulangerie"),
        "MAISON KAYSER": ("Alimentation", "Boulangerie"),
        "MARIE BLACHERE": ("Alimentation", "Boulangerie"),
        "FEU DE BOIS": ("Alimentation", "Boulangerie"),
        "BAGEL STEIN": ("Alimentation", "Restaurant & Bar"),
        "HIPPOPOTAMUS": ("Alimentation", "Restaurant & Bar"),
        "COURTEPAILLE": ("Alimentation", "Restaurant & Bar"),
        "BUFFALO GRILL": ("Alimentation", "Restaurant & Bar"),
        "BISTRO REGENT": ("Alimentation", "Restaurant & Bar"),
        "DEL ARTE": ("Alimentation", "Restaurant & Bar"),
        "VAPIANO": ("Alimentation", "Restaurant & Bar"),
        "INDIAN LOUNGE": ("Alimentation", "Restaurant & Bar"),
        "SUSHI SHOP": ("Alimentation", "Restaurant & Bar"),
        "PLANET SUSHI": ("Alimentation", "Restaurant & Bar"),
        "MATSURI": ("Alimentation", "Restaurant & Bar"),
        "COTE SUSHI": ("Alimentation", "Restaurant & Bar"),

        # Alimentation - Livraison de repas
        "UBER EATS": ("Alimentation", "Livraison de repas"),
        "UBEREATS": ("Alimentation", "Livraison de repas"),
        "DELIVEROO": ("Alimentation", "Livraison de repas"),
        "JUST EAT": ("Alimentation", "Livraison de repas"),
        "FRICHTI": ("Alimentation", "Livraison de repas"),
        "HELLOFRESH": ("Alimentation", "Livraison de repas"),
        "QUITOQUE": ("Alimentation", "Livraison de repas"),
        "SEAZON": ("Alimentation", "Livraison de repas"),
        "TOO GOOD TO GO": ("Alimentation", "Livraison de repas"),

        # Transports - Carburant & Énergie Auto
        "TOTAL": ("Transports", "Carburant"),
        "TOTALENERGIES": ("Transports", "Carburant"),
        "TOTAL ACCESS": ("Transports", "Carburant"),
        "BP": ("Transports", "Carburant"),
        "SHELL": ("Transports", "Carburant"),
        "ESSO": ("Transports", "Carburant"),
        "ESSO EXPRESS": ("Transports", "Carburant"),
        "AVIA": ("Transports", "Carburant"),
        "ENI": ("Transports", "Carburant"),
        "IONITY": ("Transports", "Carburant"),
        "TESLA SUPERCHARGER": ("Transports", "Carburant"),
        "FASTNED": ("Transports", "Carburant"),
        "ELECTRA": ("Transports", "Carburant"),

        # Transports - Trains, Métros & Transports en commun
        "SNCF": ("Transports", "Train & Avion"),
        "SNCF CONNECT": ("Transports", "Train & Avion"),
        "OUIGO": ("Transports", "Train & Avion"),
        "EUROSTAR": ("Transports", "Train & Avion"),
        "THALYS": ("Transports", "Train & Avion"),
        "TRENITALIA": ("Transports", "Train & Avion"),
        "RATP": ("Transports", "Transports en commun"),
        "NAVIGO": ("Transports", "Transports en commun"),
        "ILE DE FRANCE MOBILITES": ("Transports", "Transports en commun"),
        "TCL": ("Transports", "Transports en commun"),
        "RTM": ("Transports", "Transports en commun"),
        "TISSEO": ("Transports", "Transports en commun"),
        "CTS STRASBOURG": ("Transports", "Transports en commun"),
        "KEOLIS": ("Transports", "Transports en commun"),
        "TRANSDEV": ("Transports", "Transports en commun"),
        "FLIXBUS": ("Transports", "Transports en commun"),
        "BLABLACAR BUS": ("Transports", "Transports en commun"),
        "BLABLACAR": ("Transports", "Transports en commun"),

        # Transports - Compagnies aériennes
        "AIR FRANCE": ("Transports", "Train & Avion"),
        "EASYJET": ("Transports", "Train & Avion"),
        "RYANAIR": ("Transports", "Train & Avion"),
        "TRANSAVIA": ("Transports", "Train & Avion"),
        "LUFTHANSA": ("Transports", "Train & Avion"),
        "BRITISH AIRWAYS": ("Transports", "Train & Avion"),
        "IBERIA": ("Transports", "Train & Avion"),
        "VUELING": ("Transports", "Train & Avion"),
        "EMIRATES": ("Transports", "Train & Avion"),
        "QATAR AIRWAYS": ("Transports", "Train & Avion"),
        "VOLOTEA": ("Transports", "Train & Avion"),

        # Transports - VTC, Taxis & Micro-mobilité
        "UBER": ("Transports", "Transports en commun"),
        "UBER TRIP": ("Transports", "Transports en commun"),
        "BOLT": ("Transports", "Transports en commun"),
        "FREENOW": ("Transports", "Transports en commun"),
        "FREE NOW": ("Transports", "Transports en commun"),
        "G7": ("Transports", "Transports en commun"),
        "TAXI G7": ("Transports", "Transports en commun"),
        "HEETCH": ("Transports", "Transports en commun"),
        "LIME": ("Transports", "Transports en commun"),
        "DOTT": ("Transports", "Transports en commun"),
        "TIER": ("Transports", "Transports en commun"),
        "CITYSCOOT": ("Transports", "Transports en commun"),
        "VELIB": ("Transports", "Transports en commun"),

        # Transports - Péages, Parkings & Entretien Auto
        "VINCI AUTOROUTES": ("Transports", "Péage & Parking"),
        "APRR": ("Transports", "Péage & Parking"),
        "SANEF": ("Transports", "Péage & Parking"),
        "AREA": ("Transports", "Péage & Parking"),
        "ESCOTA": ("Transports", "Péage & Parking"),
        "COFIROUTE": ("Transports", "Péage & Parking"),
        "TELEPEAGE": ("Transports", "Péage & Parking"),
        "BIP&GO": ("Transports", "Péage & Parking"),
        "ULYS": ("Transports", "Péage & Parking"),
        "INDIGO": ("Transports", "Péage & Parking"),
        "EFFIA": ("Transports", "Péage & Parking"),
        "Q-PARK": ("Transports", "Péage & Parking"),
        "QPARK": ("Transports", "Péage & Parking"),
        "PAYBYPHONE": ("Transports", "Péage & Parking"),
        "FLOWBIRD": ("Transports", "Péage & Parking"),
        "EASYPARK": ("Transports", "Péage & Parking"),
        "OPNGO": ("Transports", "Péage & Parking"),
        "NORAUTO": ("Transports", "Entretien"),
        "FEU VERT": ("Transports", "Entretien"),
        "SPEEDY": ("Transports", "Entretien"),
        "MIDAS": ("Transports", "Entretien"),
        "CARGLASS": ("Transports", "Entretien"),
        "POINT S": ("Transports", "Entretien"),
        "EUROMASTER": ("Transports", "Entretien"),
        "AUTODOC": ("Transports", "Entretien"),
        "OSCARO": ("Transports", "Entretien"),
        "HERTZ": ("Transports", "Transports en commun"),
        "AVIS": ("Transports", "Transports en commun"),
        "SIXT": ("Transports", "Transports en commun"),
        "EUROPCAR": ("Transports", "Transports en commun"),
        "GETAROUND": ("Transports", "Transports en commun"),

        # Logement - Énergie, Eau & Fournisseurs
        "EDF": ("Logement", "Électricité & Gaz"),
        "ENGIE": ("Logement", "Électricité & Gaz"),
        "TOTAL DIRECT ENERGIE": ("Logement", "Électricité & Gaz"),
        "MINT ENERGIE": ("Logement", "Électricité & Gaz"),
        "EKWATEUR": ("Logement", "Électricité & Gaz"),
        "ENI ENERGIE": ("Logement", "Électricité & Gaz"),
        "OHM ENERGIE": ("Logement", "Électricité & Gaz"),
        "VEOLIA": ("Logement", "Eau"),
        "SUEZ": ("Logement", "Eau"),
        "SAUR": ("Logement", "Eau"),
        "EAU DE PARIS": ("Logement", "Eau"),
        "SYNDIC": ("Logement", "Loyer / Prêt"),
        "FONCIA": ("Logement", "Loyer / Prêt"),
        "NEXITY": ("Logement", "Loyer / Prêt"),
        "CITYA": ("Logement", "Loyer / Prêt"),

        # Logement - Bricolage, Meubles & Maison
        "LEROY MERLIN": ("Logement", "Bricolage & Déco"),
        "CASTORAMA": ("Logement", "Bricolage & Déco"),
        "BRICO DEPOT": ("Logement", "Bricolage & Déco"),
        "BRICORAMA": ("Logement", "Bricolage & Déco"),
        "BRICOMARCHE": ("Logement", "Bricolage & Déco"),
        "MANOMANO": ("Logement", "Bricolage & Déco"),
        "IKEA": ("Logement", "Bricolage & Déco"),
        "CONFORAMA": ("Logement", "Bricolage & Déco"),
        "BUT": ("Logement", "Bricolage & Déco"),
        "MAISONS DU MONDE": ("Logement", "Bricolage & Déco"),
        "ALINEA": ("Logement", "Bricolage & Déco"),
        "HABITAT": ("Logement", "Bricolage & Déco"),
        "ZARA HOME": ("Logement", "Bricolage & Déco"),
        "H&M HOME": ("Logement", "Bricolage & Déco"),
        "JYSK": ("Logement", "Bricolage & Déco"),

        # Logement - Assurances
        "MAIF": ("Logement", "Assurance"),
        "MACIF": ("Logement", "Assurance"),
        "AXA": ("Logement", "Assurance"),
        "ALLIANZ": ("Logement", "Assurance"),
        "GROUPAMA": ("Logement", "Assurance"),
        "MATMUT": ("Logement", "Assurance"),
        "GMF": ("Logement", "Assurance"),
        "GENERALI": ("Logement", "Assurance"),
        "DIRECT ASSURANCE": ("Logement", "Assurance"),
        "LEOCARE": ("Logement", "Assurance"),
        "LUKO": ("Logement", "Assurance"),
        "ALAN": ("Santé & Bien-être", "Consultation"),

        # Abonnements - Streaming, Vidéo & Musique
        "NETFLIX": ("Abonnements", "Streaming"),
        "SPOTIFY": ("Abonnements", "Streaming"),
        "DEEZER": ("Abonnements", "Streaming"),
        "AMAZON PRIME": ("Abonnements", "Streaming"),
        "PRIME VIDEO": ("Abonnements", "Streaming"),
        "DISNEY PLUS": ("Abonnements", "Streaming"),
        "DISNEY+": ("Abonnements", "Streaming"),
        "CANAL PLUS": ("Abonnements", "Streaming"),
        "CANAL+": ("Abonnements", "Streaming"),
        "YOUTUBE PREMIUM": ("Abonnements", "Streaming"),
        "APPLE MUSIC": ("Abonnements", "Streaming"),
        "APPLE TV": ("Abonnements", "Streaming"),
        "APPLE.COM/BILL": ("Abonnements", "Logiciels & Cloud"),
        "HBO MAX": ("Abonnements", "Streaming"),
        "MAX": ("Abonnements", "Streaming"),
        "PARAMOUNT PLUS": ("Abonnements", "Streaming"),
        "CRUNCHYROLL": ("Abonnements", "Streaming"),
        "TWITCH": ("Abonnements", "Streaming"),
        "AUDIBLE": ("Abonnements", "Streaming"),

        # Abonnements - Télécom & Internet
        "ORANGE": ("Abonnements", "Internet & Mobile"),
        "SOSH": ("Abonnements", "Internet & Mobile"),
        "FREE MOBILE": ("Abonnements", "Internet & Mobile"),
        "FREE TELECOM": ("Abonnements", "Internet & Mobile"),
        "FREEBOX": ("Abonnements", "Internet & Mobile"),
        "SFR": ("Abonnements", "Internet & Mobile"),
        "RED BY SFR": ("Abonnements", "Internet & Mobile"),
        "BOUYGUES TELECOM": ("Abonnements", "Internet & Mobile"),
        "B&YOU": ("Abonnements", "Internet & Mobile"),
        "CORIOLIS": ("Abonnements", "Internet & Mobile"),
        "PRIXTEL": ("Abonnements", "Internet & Mobile"),

        # Abonnements - Logiciels, IA, Cloud & Presse
        "CHATGPT": ("Abonnements", "Logiciels & Cloud"),
        "OPENAI": ("Abonnements", "Logiciels & Cloud"),
        "CLAUDE.AI": ("Abonnements", "Logiciels & Cloud"),
        "ANTHROPIC": ("Abonnements", "Logiciels & Cloud"),
        "MIDJOURNEY": ("Abonnements", "Logiciels & Cloud"),
        "GITHUB": ("Abonnements", "Logiciels & Cloud"),
        "MICROSOFT 365": ("Abonnements", "Logiciels & Cloud"),
        "MICROSOFT": ("Abonnements", "Logiciels & Cloud"),
        "ADOBE": ("Abonnements", "Logiciels & Cloud"),
        "NOTION": ("Abonnements", "Logiciels & Cloud"),
        "GOOGLE ONE": ("Abonnements", "Logiciels & Cloud"),
        "GOOGLE STORAGE": ("Abonnements", "Logiciels & Cloud"),
        "ICLOUD": ("Abonnements", "Logiciels & Cloud"),
        "DROPBOX": ("Abonnements", "Logiciels & Cloud"),
        "1PASSWORD": ("Abonnements", "Logiciels & Cloud"),
        "NORDVPN": ("Abonnements", "Logiciels & Cloud"),
        "CYBERGHOST": ("Abonnements", "Logiciels & Cloud"),
        "PROTON": ("Abonnements", "Logiciels & Cloud"),
        "LE MONDE": ("Abonnements", "Logiciels & Cloud"),
        "LE FIGARO": ("Abonnements", "Logiciels & Cloud"),
        "MEDIAPART": ("Abonnements", "Logiciels & Cloud"),
        "COURRIER INTERNATIONAL": ("Abonnements", "Logiciels & Cloud"),
        "LES ECHOS": ("Abonnements", "Logiciels & Cloud"),
        "L'EQUIPE": ("Abonnements", "Logiciels & Cloud"),

        # Abonnements - Sport & Fitness
        "BASIC FIT": ("Abonnements", "Salle de sport"),
        "BASIC-FIT": ("Abonnements", "Salle de sport"),
        "FITNESS PARK": ("Abonnements", "Salle de sport"),
        "KEEP COOL": ("Abonnements", "Salle de sport"),
        "NEONESS": ("Abonnements", "Salle de sport"),
        "ON AIR": ("Abonnements", "Salle de sport"),
        "MAGIC FORM": ("Abonnements", "Salle de sport"),
        "L'ORANGE BLEUE": ("Abonnements", "Salle de sport"),
        "CROSSFIT": ("Abonnements", "Salle de sport"),
        "GYMLIB": ("Abonnements", "Salle de sport"),
        "URBAN SPORTS CLUB": ("Abonnements", "Salle de sport"),

        # Loisirs & Sorties - Shopping & Mode
        "ZARA": ("Loisirs & Sorties", "Shopping & Mode"),
        "H&M": ("Loisirs & Sorties", "Shopping & Mode"),
        "HM": ("Loisirs & Sorties", "Shopping & Mode"),
        "UNIQLO": ("Loisirs & Sorties", "Shopping & Mode"),
        "MANGO": ("Loisirs & Sorties", "Shopping & Mode"),
        "BERSHKA": ("Loisirs & Sorties", "Shopping & Mode"),
        "PULL&BEAR": ("Loisirs & Sorties", "Shopping & Mode"),
        "STRADIVARIUS": ("Loisirs & Sorties", "Shopping & Mode"),
        "MASSIMO DUTTI": ("Loisirs & Sorties", "Shopping & Mode"),
        "COS": ("Loisirs & Sorties", "Shopping & Mode"),
        "OTHER STORIES": ("Loisirs & Sorties", "Shopping & Mode"),
        "ASOS": ("Loisirs & Sorties", "Shopping & Mode"),
        "ZALANDO": ("Loisirs & Sorties", "Shopping & Mode"),
        "SHEIN": ("Loisirs & Sorties", "Shopping & Mode"),
        "VINTED": ("Loisirs & Sorties", "Shopping & Mode"),
        "VESTIAIRE COLLECTIVE": ("Loisirs & Sorties", "Shopping & Mode"),
        "DECATHLON": ("Loisirs & Sorties", "Shopping & Mode"),
        "INTERSPORT": ("Loisirs & Sorties", "Shopping & Mode"),
        "GO SPORT": ("Loisirs & Sorties", "Shopping & Mode"),
        "COURIR": ("Loisirs & Sorties", "Shopping & Mode"),
        "FOOT LOCKER": ("Loisirs & Sorties", "Shopping & Mode"),
        "JD SPORTS": ("Loisirs & Sorties", "Shopping & Mode"),
        "NIKE": ("Loisirs & Sorties", "Shopping & Mode"),
        "ADIDAS": ("Loisirs & Sorties", "Shopping & Mode"),
        "PUMA": ("Loisirs & Sorties", "Shopping & Mode"),
        "GALERIES LAFAYETTE": ("Loisirs & Sorties", "Shopping & Mode"),
        "PRINTEMPS": ("Loisirs & Sorties", "Shopping & Mode"),
        "LE BON MARCHE": ("Loisirs & Sorties", "Shopping & Mode"),
        "BHV": ("Loisirs & Sorties", "Shopping & Mode"),
        "SEPHORA": ("Loisirs & Sorties", "Shopping & Mode"),
        "NOCIBE": ("Loisirs & Sorties", "Shopping & Mode"),
        "MARIONNAUD": ("Loisirs & Sorties", "Shopping & Mode"),
        "YVES ROCHER": ("Loisirs & Sorties", "Shopping & Mode"),
        "KIKO": ("Loisirs & Sorties", "Shopping & Mode"),
        "RITUALS": ("Loisirs & Sorties", "Shopping & Mode"),
        "ACTION": ("Loisirs & Sorties", "Shopping & Mode"),
        "NORMAL": ("Loisirs & Sorties", "Shopping & Mode"),
        "PRIMARK": ("Loisirs & Sorties", "Shopping & Mode"),
        "CENTRAKOR": ("Loisirs & Sorties", "Shopping & Mode"),
        "GIFI": ("Loisirs & Sorties", "Shopping & Mode"),
        "NOZ": ("Loisirs & Sorties", "Shopping & Mode"),

        # Loisirs & Sorties - High-Tech & Électronique
        "FNAC": ("Loisirs & Sorties", "High-Tech"),
        "DARTY": ("Loisirs & Sorties", "High-Tech"),
        "BOULANGER": ("Loisirs & Sorties", "High-Tech"),
        "APPLE STORE": ("Loisirs & Sorties", "High-Tech"),
        "APPLE": ("Loisirs & Sorties", "High-Tech"),
        "AMAZON": ("Loisirs & Sorties", "High-Tech"),
        "LDLC": ("Loisirs & Sorties", "High-Tech"),
        "MATERIEL.NET": ("Loisirs & Sorties", "High-Tech"),
        "RUE DU COMMERCE": ("Loisirs & Sorties", "High-Tech"),
        "BACK MARKET": ("Loisirs & Sorties", "High-Tech"),
        "RAKUTEN": ("Loisirs & Sorties", "High-Tech"),
        "CDISCOUNT": ("Loisirs & Sorties", "High-Tech"),
        "ALIEXPRESS": ("Loisirs & Sorties", "High-Tech"),
        "TEMU": ("Loisirs & Sorties", "High-Tech"),

        # Loisirs & Sorties - Culture, Spectacles & Jeux
        "UGC": ("Loisirs & Sorties", "Cinéma & Culture"),
        "PATHE": ("Loisirs & Sorties", "Cinéma & Culture"),
        "GAUMONT": ("Loisirs & Sorties", "Cinéma & Culture"),
        "MK2": ("Loisirs & Sorties", "Cinéma & Culture"),
        "CGR": ("Loisirs & Sorties", "Cinéma & Culture"),
        "KINEPOLIS": ("Loisirs & Sorties", "Cinéma & Culture"),
        "TICKETMASTER": ("Loisirs & Sorties", "Cinéma & Culture"),
        "FNAC SPECTACLES": ("Loisirs & Sorties", "Cinéma & Culture"),
        "BILLETREDUC": ("Loisirs & Sorties", "Cinéma & Culture"),
        "DISNEYLAND": ("Loisirs & Sorties", "Sorties"),
        "PARC ASTERIX": ("Loisirs & Sorties", "Sorties"),
        "FUTUROSCOPE": ("Loisirs & Sorties", "Sorties"),
        "PUY DU FOU": ("Loisirs & Sorties", "Sorties"),
        "STEAM": ("Loisirs & Sorties", "Cinéma & Culture"),
        "PLAYSTATION": ("Loisirs & Sorties", "Cinéma & Culture"),
        "SONY INTERACTIVE": ("Loisirs & Sorties", "Cinéma & Culture"),
        "NINTENDO": ("Loisirs & Sorties", "Cinéma & Culture"),
        "XBOX": ("Loisirs & Sorties", "Cinéma & Culture"),
        "EPIC GAMES": ("Loisirs & Sorties", "Cinéma & Culture"),
        "AIRBNB": ("Loisirs & Sorties", "Vacances & Voyages"),
        "BOOKING.COM": ("Loisirs & Sorties", "Vacances & Voyages"),
        "BOOKING": ("Loisirs & Sorties", "Vacances & Voyages"),
        "HOTELS.COM": ("Loisirs & Sorties", "Vacances & Voyages"),
        "EXPEDIA": ("Loisirs & Sorties", "Vacances & Voyages"),
        "ACCOR": ("Loisirs & Sorties", "Vacances & Voyages"),
        "IBIS": ("Loisirs & Sorties", "Vacances & Voyages"),
        "NOVOTEL": ("Loisirs & Sorties", "Vacances & Voyages"),
        "MERCURE": ("Loisirs & Sorties", "Vacances & Voyages"),

        # Santé & Bien-être - Médical, Pharmacie & Soins
        "DOCTOLIB": ("Santé & Bien-être", "Consultation"),
        "PHARMACIE": ("Santé & Bien-être", "Pharmacie"),
        "CERBALLIANCE": ("Santé & Bien-être", "Consultation"),
        "BIOGROUP": ("Santé & Bien-être", "Consultation"),
        "INOVIE": ("Santé & Bien-être", "Consultation"),
        "LABORATOIRE": ("Santé & Bien-être", "Consultation"),
        "OPTIC 2000": ("Santé & Bien-être", "Soins & Beauté"),
        "ALAIN AFFLELOU": ("Santé & Bien-être", "Soins & Beauté"),
        "KRYS": ("Santé & Bien-être", "Soins & Beauté"),
        "GRANDOPTICAL": ("Santé & Bien-être", "Soins & Beauté"),
        "ATOL": ("Santé & Bien-être", "Soins & Beauté"),
        "GENERALE D OPTIQUE": ("Santé & Bien-être", "Soins & Beauté"),
        "LISSAC": ("Santé & Bien-être", "Soins & Beauté"),
        "AMELI": ("Santé & Bien-être", "Consultation"),
        "CPAM": ("Santé & Bien-être", "Consultation"),
    }

    # ---------------------------------------------------------
    # 2. Semantic Keyword Rules (Weighted Fallback)
    # ---------------------------------------------------------
    SEMANTIC_RULES: List[Tuple[re.Pattern, str, Optional[str], float]] = [
        # Virements internes & Épargne
        (re.compile(r"\b(VIR\s*(INTERNE|COMPTE|LIVRET|EPARGNE|PEA|DE\s+CPTE)|VIREMENT\s*(INTERNE|EMIS|RECU\s+DE\s+VOTRE|DE\s+VOTRE|VERS\s+VOTRE)|VERSEMENT\s*(EPARGNE|LIVRET|PEL|CEL|PEA)|LIVRET\s*[A-Z]?|RETRAIT\s*DE\s*LIVRET)\b", re.I), "Virements & Épargne", "Virement interne", 0.98),

        # Revenus & Salaires
        (re.compile(r"\b(SALAIRE|PAYE|REMUNERATION|APPOINTEMENT|VIR\s*EMPLOYEUR|ALLOCATION|CAF|POLE\s*EMPLOI|FRANCE\s*TRAVAIL|CPAM|SECU|REMBOURSEMENT|DIVIDENDE|INTERETS|PENSION)\b", re.I), "Revenus", "Salaire", 0.95),

        # Alimentation & Restauration
        (re.compile(r"\b(BOULANGERIE|PATISSERIE|SUPERMARCHE|HYPERMARCHE|SUPERETTE|EPICERIE|BOUCHERIE|POISSONNERIE|PRIMEUR|TRAITEUR|DRIVE)\b", re.I), "Alimentation", "Supermarché", 0.88),
        (re.compile(r"\b(RESTAURANT|RESTO|BISTROT|BRASSERIE|PIZZERIA|SUSHI|BURGER|KEBAB|TACOS|SANDWICHERIE|CREPERIE|CAFE|BAR|PUB|CAVE|WOK|TRAITEUR)\b", re.I), "Alimentation", "Restaurant & Bar", 0.88),

        # Transports
        (re.compile(r"\b(STATION\s*SERVICE|CARBURANT|ESSENCE|DIESEL|GAZOLE|GPL|SUPERETHANOL|LAVAGE\s*AUTO|CONTROLE\s*TECHNIQUE|GARAGE|AUTOROUTE|PEAGE|PARKING|PARK)\b", re.I), "Transports", "Carburant", 0.85),
        (re.compile(r"\b(SNCF|TRAIN|GARE|AEROPORT|AIRWAYS|AIRLINES|VOL|TAXI|VTC|NAVIGO|TICKET\s*METRO|BUS|TRAM)\b", re.I), "Transports", "Transports en commun", 0.85),

        # Logement & Énergie
        (re.compile(r"\b(LOYER|CHARGES\s*LOCATIVES|SYNDIC|COPROPRIETE|ELECTRICITE|GAZ|EAU\s*POTABLE|ASSAINISSEMENT|ASSURANCE\s*HABITATION|BRICOLAGE|QUINCAILLERIE)\b", re.I), "Logement", "Loyer / Prêt", 0.85),

        # Abonnements & Multimédia
        (re.compile(r"\b(ABONNEMENT|COTISATION|INTERNET|FIBRE|FORFAIT\s*MOBILE|STREAMING|VOD|PRESSE|JOURNAL|MAGAZINE|CLOUD|VPN|HOSTING|HEBERGEMENT)\b", re.I), "Abonnements", "Internet & Mobile", 0.82),

        # Santé & Médical
        (re.compile(r"\b(PHARMACIE|DOCTEUR|MEDECIN|DENTISTE|CHIRURGIEN|ORTHODONTISTE|OPHTALMO|KINESITHERAPEUTE|KINE|OSTEOPATHE|OSTEO|INFIRMIER|LABORATOIRE\s*ANALYSES|CENTRE\s*RADIOLOGIE|HOSPITAL|HOPITAL|CLINIQUE|MUTUELLE)\b", re.I), "Santé & Bien-être", "Consultation", 0.90),

        # Shopping, Mode & High-Tech
        (re.compile(r"\b(CHAUSSURES|VETEMENTS|PRET\s*A\s*PORTER|LINGERIE|BIJOUTERIE|MAROQUINERIE|COIFFEUR|BARBIER|PARFUMERIE|COSMETIQUE|INFORMATIQUE|ELECTRONIQUE)\b", re.I), "Loisirs & Sorties", "Shopping & Mode", 0.80),

        # Frais bancaires & Impôts
        (re.compile(r"\b(FRAIS\s*BANCAIRE|COTISATION\s*CARTE|COMMISSION\s*INTERVENTION|AGIOS|TENUE\s*DE\s*COMPTE|IMPOT|TRESOR\s*PUBLIC|DGFIP|AMENDE|TAXE|URSSAF)\b", re.I), "Divers", "Frais bancaires", 0.90),
    ]

    @classmethod
    def normalize_text(cls, text: str) -> str:
        """Strip accents, special chars and uppercase for resilient string matching."""
        if not text:
            return ""
        # Remove accents
        nfkd_form = unicodedata.normalize('NFKD', text)
        clean = "".join([c for c in nfkd_form if not unicodedata.combining(c)])
        # Replace punctuation by spaces
        clean = re.sub(r"[^A-Za-z0-9\s]", " ", clean)
        # Collapse multi spaces
        clean = re.sub(r"\s+", " ", clean).strip().upper()
        return clean

    @classmethod
    def categorize(
        cls,
        merchant: str,
        raw_label: str,
        amount: float,
        db: Optional[Session] = None,
        user_id: Optional[str] = None,
    ) -> CategorizationResult:
        """
        Cascade Categorization Engine:
        1. User learned history & custom MerchantRule (Confidence 1.0)
        2. Transfer / Internal Movement & Positive Income Patterns (Confidence 0.95-0.98)
        3. Curated High-Accuracy Merchant Database & Fuzzy Matching (Confidence 0.85-0.98)
        4. Semantic Regex Rules (Confidence 0.75-0.90)
        5. Weak guess fallback marked as Low Confidence (Confidence < 0.65 -> Yellow Badge)
        """
        clean_merchant = CleanerService.clean_merchant_name(merchant or raw_label or "")
        norm_merchant = cls.normalize_text(clean_merchant)
        norm_raw = cls.normalize_text(raw_label or "")
        combined_norm = f"{norm_merchant} {norm_raw}".strip()

        # ------------------------------------------------------------------
        # Step 1: Check User Custom Merchant Rules (100% confidence)
        # ------------------------------------------------------------------
        if db and user_id and clean_merchant:
            try:
                user_rule = db.query(MerchantRule).filter(
                    (MerchantRule.user_id == user_id) &
                    (
                        (MerchantRule.merchant_pattern == clean_merchant) |
                        (MerchantRule.merchant_pattern == merchant)
                    )
                ).first()

                if user_rule:
                    return CategorizationResult(
                        category=user_rule.category,
                        subcategory=user_rule.subcategory,
                        confidence=1.0,
                        is_low_confidence=False,
                        match_source="user_rule",
                    )
            except Exception:
                pass

        # ------------------------------------------------------------------
        # Step 2: Internal Transfers & Genuine Incomes
        # ------------------------------------------------------------------
        # Internal transfer check (top priority for both positive and negative amounts)
        for pattern, cat, subcat, conf in cls.SEMANTIC_RULES:
            if cat == "Virements & Épargne" and pattern.search(combined_norm):
                return CategorizationResult(
                    category=cat,
                    subcategory=subcat,
                    confidence=conf,
                    is_low_confidence=False,
                    match_source="transfer_pattern",
                )

        # Positive amounts (Income / Reimbursements)
        if amount > 0:
            for pattern, cat, subcat, conf in cls.SEMANTIC_RULES:
                if cat == "Revenus" and pattern.search(combined_norm):
                    return CategorizationResult(
                        category=cat,
                        subcategory=subcat,
                        confidence=conf,
                        is_low_confidence=False,
                        match_source="income_pattern",
                    )

            # If positive amount contains VIR without salary, treat as transfer
            if "VIR" in combined_norm:
                return CategorizationResult(
                    category="Virements & Épargne",
                    subcategory="Virement interne",
                    confidence=0.88,
                    is_low_confidence=False,
                    match_source="income_transfer",
                )

            # Default positive amount is classified as Revenus with solid confidence
            return CategorizationResult(
                category="Revenus",
                subcategory="Autre revenu",
                confidence=0.80,
                is_low_confidence=False,
                match_source="positive_amount",
            )

        # ------------------------------------------------------------------
        # Step 3: Curated Merchant Database Match (Exact & Substring)
        # ------------------------------------------------------------------
        # Direct exact or substring match in curated dictionary
        for db_merchant, (cat, subcat) in cls.MERCHANT_DATABASE.items():
            db_norm = cls.normalize_text(db_merchant)
            # Exact equality or word-bounded match
            if db_norm == norm_merchant:
                return CategorizationResult(
                    category=cat,
                    subcategory=subcat,
                    confidence=0.98,
                    is_low_confidence=False,
                    match_source="curated_exact",
                )
            # Substring match in cleaned merchant
            if f" {db_norm} " in f" {norm_merchant} " or f" {db_norm} " in f" {norm_raw} ":
                return CategorizationResult(
                    category=cat,
                    subcategory=subcat,
                    confidence=0.92,
                    is_low_confidence=False,
                    match_source="curated_substring",
                )

        # ------------------------------------------------------------------
        # Step 4: Fuzzy Matcher on Curated Database (Levenshtein ratio)
        # ------------------------------------------------------------------
        best_fuzzy_match = None
        best_fuzzy_score = 0.0

        for db_merchant, (cat, subcat) in cls.MERCHANT_DATABASE.items():
            db_norm = cls.normalize_text(db_merchant)
            ratio = SequenceMatcher(None, norm_merchant, db_norm).ratio()
            if ratio > best_fuzzy_score:
                best_fuzzy_score = ratio
                best_fuzzy_match = (cat, subcat)

        # High fuzzy similarity threshold (>= 0.82)
        if best_fuzzy_match and best_fuzzy_score >= 0.82:
            return CategorizationResult(
                category=best_fuzzy_match[0],
                subcategory=best_fuzzy_match[1],
                confidence=best_fuzzy_score,
                is_low_confidence=False,
                match_source="fuzzy_match",
            )

        # ------------------------------------------------------------------
        # Step 5: Semantic Keyword Regex Rules
        # ------------------------------------------------------------------
        for pattern, cat, subcat, conf in cls.SEMANTIC_RULES:
            if pattern.search(combined_norm):
                return CategorizationResult(
                    category=cat,
                    subcategory=subcat,
                    confidence=conf,
                    is_low_confidence=False,
                    match_source="semantic_rule",
                )

        # Moderate fuzzy similarity (0.65 <= score < 0.82) -> Marked as uncertain!
        if best_fuzzy_match and best_fuzzy_score >= 0.65:
            return CategorizationResult(
                category=best_fuzzy_match[0],
                subcategory=best_fuzzy_match[1],
                confidence=best_fuzzy_score,
                is_low_confidence=True,
                match_source="weak_fuzzy",
            )

        # ------------------------------------------------------------------
        # Step 6: Fallback (Uncertain Category -> Highlighted in Yellow)
        # ------------------------------------------------------------------
        return CategorizationResult(
            category="Divers",
            subcategory=None,
            confidence=0.40,
            is_low_confidence=True,
            match_source="fallback_uncertain",
        )
