import uuid
from datetime import datetime
from typing import List, Tuple
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.core.config import settings
from app.core.security import hash_user_password
from app.models.user import User
from app.models.account import Account
from app.models.bank_connection import BankConnection
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.project import Project
from app.models.investment import InvestmentHolding
from app.models.loan import Loan

MONTHS_TO_SEED: List[Tuple[int, int]] = [
    # 2025 (late previous year)
    (2025, 10), (2025, 11), (2025, 12),
    # 2026 (full current year)
    (2026, 1), (2026, 2), (2026, 3), (2026, 4), (2026, 5), (2026, 6),
    (2026, 7), (2026, 8), (2026, 9), (2026, 10), (2026, 11), (2026, 12),
]

def _generate_month_transactions(
    user_id: str,
    acc_courant_id: str,
    acc_epargne_id: str,
    acc_pea_id: str,
    year: int,
    month: int,
) -> List[Transaction]:
    """Génère un ensemble réaliste et complet de transactions pour un mois donné."""
    txs: List[Transaction] = []

    # Petites variations déterministes par mois
    v1 = round(((month * 7) % 9) - 4, 2)
    v2 = round(((month * 5) % 7) - 3, 2)
    v3 = round(((month * 3) % 5) - 2, 2)
    edf_extra = 12.0 if month in (1, 2, 11, 12) else (-8.0 if month in (6, 7, 8) else 0.0)

    # 1. Jour 1: Navigo
    d1 = datetime(year, month, 1, 8, 30)
    d1_str = d1.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d1_str,
        value_date=d1_str,
        booking_datetime=d1,
        amount=-86.40,
        currency="EUR",
        raw_label="PRLV SEPA ILE DE FRANCE MOBILITES NAVIGO",
        merchant_name="IDFM Navigo",
        category="Transports",
        subcategory="Transports en commun",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d1,
    ))

    # 2. Jour 2: Boulangerie
    d2 = datetime(year, month, 2, 8, 15)
    d2_str = d2.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d2_str,
        value_date=d2_str,
        booking_datetime=d2,
        amount=-14.60,
        currency="EUR",
        raw_label="CARTE BOULANGERIE DU COIN",
        merchant_name="Boulangerie",
        category="Alimentation",
        subcategory="Boulangerie",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d2,
    ))

    # 3. Jour 3: Netflix
    d3 = datetime(year, month, 3, 9, 0)
    d3_str = d3.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d3_str,
        value_date=d3_str,
        booking_datetime=d3,
        amount=-17.99,
        currency="EUR",
        raw_label="CARTE NETFLIX.COM",
        merchant_name="Netflix",
        category="Abonnements",
        subcategory="Streaming Vidéo",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d3,
    ))

    # 4. Jour 4: Carrefour + Virements Épargne & PEA
    d4 = datetime(year, month, 4, 11, 45)
    d4_str = d4.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d4_str,
        value_date=d4_str,
        booking_datetime=d4,
        amount=round(-118.50 + v1, 2),
        currency="EUR",
        raw_label="CARTE CARREFOUR MARKET",
        merchant_name="Carrefour",
        category="Alimentation",
        subcategory="Supermarché",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d4,
    ))
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d4_str,
        value_date=d4_str,
        booking_datetime=d4,
        amount=-300.00,
        currency="EUR",
        raw_label="VIR INTERNE VERS LIVRET A",
        merchant_name="Épargne Programmée",
        category="Épargne",
        subcategory="Virement interne",
        is_user_classified=True,
        is_excluded_from_budget=True,
        status="confirmed",
        created_at=d4,
    ))
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_epargne_id,
        booking_date=d4_str,
        value_date=d4_str,
        booking_datetime=d4,
        amount=300.00,
        currency="EUR",
        raw_label="VIR RECU COMPTE COURANT",
        merchant_name="Épargne Programmée",
        category="Épargne",
        subcategory="Virement interne",
        is_user_classified=True,
        is_excluded_from_budget=True,
        status="confirmed",
        created_at=d4,
    ))
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d4_str,
        value_date=d4_str,
        booking_datetime=d4,
        amount=-250.00,
        currency="EUR",
        raw_label="VIR VERS PEA INVESTISSEMENTS",
        merchant_name="Bourse Fortuneo",
        category="Investissements",
        subcategory="Actions",
        is_user_classified=True,
        is_excluded_from_budget=True,
        status="confirmed",
        created_at=d4,
    ))
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_pea_id,
        booking_date=d4_str,
        value_date=d4_str,
        booking_datetime=d4,
        amount=250.00,
        currency="EUR",
        raw_label="VIR RECU COMPTE COURANT",
        merchant_name="Bourse Fortuneo",
        category="Investissements",
        subcategory="Actions",
        is_user_classified=True,
        is_excluded_from_budget=True,
        status="confirmed",
        created_at=d4,
    ))

    # 5. Jour 5: Loyer + Spotify
    d5 = datetime(year, month, 5, 7, 0)
    d5_str = d5.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d5_str,
        value_date=d5_str,
        booking_datetime=d5,
        amount=-950.00,
        currency="EUR",
        raw_label="PRLV SEPA GESTION IMMOBILIERE LOYER",
        merchant_name="Gestion Immobilière",
        category="Logement",
        subcategory="Loyer",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d5,
    ))
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d5_str,
        value_date=d5_str,
        booking_datetime=d5,
        amount=-10.99,
        currency="EUR",
        raw_label="CARTE SPOTIFY PREMIUM",
        merchant_name="Spotify",
        category="Abonnements",
        subcategory="Streaming Audio",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d5,
    ))

    # 6. Jour 6: Restaurant Le Bistrot
    d6 = datetime(year, month, 6, 20, 15)
    d6_str = d6.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d6_str,
        value_date=d6_str,
        booking_datetime=d6,
        amount=round(-52.00 + v2, 2),
        currency="EUR",
        raw_label="CARTE RESTAURANT LE BISTROT",
        merchant_name="Le Bistrot Gourmand",
        category="Loisirs & Sorties",
        subcategory="Restaurants",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d6,
    ))

    # 7. Jour 7: Freebox Fibre
    d7 = datetime(year, month, 7, 6, 30)
    d7_str = d7.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d7_str,
        value_date=d7_str,
        booking_datetime=d7,
        amount=-29.99,
        currency="EUR",
        raw_label="PRLV SEPA FREE FIBRE INTERNET",
        merchant_name="Freebox",
        category="Abonnements",
        subcategory="Télécoms",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d7,
    ))

    # 8. Jour 8: EDF
    d8 = datetime(year, month, 8, 7, 0)
    d8_str = d8.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d8_str,
        value_date=d8_str,
        booking_datetime=d8,
        amount=round(-68.40 + edf_extra + v3, 2),
        currency="EUR",
        raw_label="PRLV SEPA EDF CLIENT PARTICULIER",
        merchant_name="EDF",
        category="Logement",
        subcategory="Énergie",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d8,
    ))

    # 9. Jour 9: Pharmacie
    d9 = datetime(year, month, 9, 15, 30)
    d9_str = d9.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d9_str,
        value_date=d9_str,
        booking_datetime=d9,
        amount=round(-28.30 + v2, 2),
        currency="EUR",
        raw_label="CARTE PHARMACIE CENTRALE",
        merchant_name="Pharmacie Centrale",
        category="Santé & Bien-être",
        subcategory="Pharmacie",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d9,
    ))

    # 10. Jour 10: Monoprix
    d10 = datetime(year, month, 10, 18, 40)
    d10_str = d10.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d10_str,
        value_date=d10_str,
        booking_datetime=d10,
        amount=round(-76.30 + v1, 2),
        currency="EUR",
        raw_label="CARTE MONOPRIX PARIS",
        merchant_name="Monoprix",
        category="Alimentation",
        subcategory="Supermarché",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d10,
    ))

    # 11. Jour 11: MK2 Cinémas
    d11 = datetime(year, month, 11, 21, 0)
    d11_str = d11.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d11_str,
        value_date=d11_str,
        booking_datetime=d11,
        amount=-32.50,
        currency="EUR",
        raw_label="CARTE CINEMA MK2 BIBLIOTHEQUE",
        merchant_name="MK2 Cinémas",
        category="Loisirs & Sorties",
        subcategory="Culture",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d11,
    ))

    # 12. Jour 12: Macif Assurance Habitation
    d12 = datetime(year, month, 12, 7, 0)
    d12_str = d12.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d12_str,
        value_date=d12_str,
        booking_datetime=d12,
        amount=-24.50,
        currency="EUR",
        raw_label="PRLV SEPA MACIF ASSURANCE HABITATION",
        merchant_name="Macif",
        category="Logement",
        subcategory="Assurance",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d12,
    ))

    # 13. Jour 14: Basic-Fit
    d14 = datetime(year, month, 14, 7, 0)
    d14_str = d14.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d14_str,
        value_date=d14_str,
        booking_datetime=d14,
        amount=-29.99,
        currency="EUR",
        raw_label="PRLV SEPA BASIC FIT MENSUEL",
        merchant_name="Basic-Fit",
        category="Abonnements",
        subcategory="Sport & Fitness",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d14,
    ))

    # 14. Jour 15: SNCF Connect (+ Prime semestrielle en juin et décembre)
    d15 = datetime(year, month, 15, 14, 20)
    d15_str = d15.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d15_str,
        value_date=d15_str,
        booking_datetime=d15,
        amount=round(-45.00 + v2 * 2, 2),
        currency="EUR",
        raw_label="CARTE SNCF CONNECT TGV",
        merchant_name="SNCF Connect",
        category="Transports",
        subcategory="Train",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d15,
    ))
    if month in (6, 12):
        txs.append(Transaction(
            id=f"tx_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
            account_id=acc_courant_id,
            booking_date=d15_str,
            value_date=d15_str,
            booking_datetime=d15,
            amount=750.00,
            currency="EUR",
            raw_label="VIR SEPA PRIME PERFORMANCE SEMESTRIELLE",
            merchant_name="Tech Solutions",
            category="Revenus",
            subcategory="Prime",
            is_user_classified=True,
            is_excluded_from_budget=True,
            status="confirmed",
            created_at=d15,
        ))

    # 15. Jour 16: Boulangerie Artisanale
    d16 = datetime(year, month, 16, 9, 30)
    d16_str = d16.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d16_str,
        value_date=d16_str,
        booking_datetime=d16,
        amount=-16.20,
        currency="EUR",
        raw_label="CARTE BOULANGERIE ARTISANALE",
        merchant_name="Boulangerie",
        category="Alimentation",
        subcategory="Boulangerie",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d16,
    ))

    # 16. Jour 17: Médecin (trimestriel: mars, juin, sept, déc)
    if month in (3, 6, 9, 12):
        d17 = datetime(year, month, 17, 16, 0)
        d17_str = d17.strftime("%Y-%m-%d")
        txs.append(Transaction(
            id=f"tx_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
            account_id=acc_courant_id,
            booking_date=d17_str,
            value_date=d17_str,
            booking_datetime=d17,
            amount=-26.50,
            currency="EUR",
            raw_label="CARTE DR DUPONT GENERALISTE",
            merchant_name="Cabinet Médical",
            category="Santé & Bien-être",
            subcategory="Médecin",
            is_user_classified=True,
            is_excluded_from_budget=False,
            status="confirmed",
            created_at=d17,
        ))

    # 17. Jour 18: Bio c' Bon
    d18 = datetime(year, month, 18, 17, 45)
    d18_str = d18.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d18_str,
        value_date=d18_str,
        booking_datetime=d18,
        amount=round(-89.90 + v3, 2),
        currency="EUR",
        raw_label="CARTE BIO C BON",
        merchant_name="Bio c' Bon",
        category="Alimentation",
        subcategory="Supermarché",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d18,
    ))

    # 18. Jour 20: Trattoria Romana (+ CPAM trimestriel)
    d20 = datetime(year, month, 20, 20, 30)
    d20_str = d20.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d20_str,
        value_date=d20_str,
        booking_datetime=d20,
        amount=round(-64.00 + v1, 2),
        currency="EUR",
        raw_label="CARTE RESTAURANT ITALIEN TRATTORIA",
        merchant_name="Trattoria Romana",
        category="Loisirs & Sorties",
        subcategory="Restaurants",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d20,
    ))
    if month in (3, 6, 9, 12):
        txs.append(Transaction(
            id=f"tx_{uuid.uuid4().hex[:12]}",
            user_id=user_id,
            bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
            account_id=acc_courant_id,
            booking_date=d20_str,
            value_date=d20_str,
            booking_datetime=d20,
            amount=18.50,
            currency="EUR",
            raw_label="VIR SEPA CPAM REMBOURSEMENT SOINS",
            merchant_name="Assurance Maladie",
            category="Santé & Bien-être",
            subcategory="Remboursement",
            is_user_classified=True,
            is_excluded_from_budget=True,
            status="confirmed",
            created_at=d20,
        ))

    # 19. Jour 22: TotalEnergies
    d22 = datetime(year, month, 22, 18, 10)
    d22_str = d22.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d22_str,
        value_date=d22_str,
        booking_datetime=d22,
        amount=round(-28.00 + v2, 2),
        currency="EUR",
        raw_label="CARTE TOTALENERGIES RELAIS",
        merchant_name="TotalEnergies",
        category="Transports",
        subcategory="Carburant",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d22,
    ))

    # 20. Jour 24: Café
    d24 = datetime(year, month, 24, 16, 45)
    d24_str = d24.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d24_str,
        value_date=d24_str,
        booking_datetime=d24,
        amount=-22.50,
        currency="EUR",
        raw_label="CARTE CAFE COMPTOIR",
        merchant_name="Café de Paris",
        category="Loisirs & Sorties",
        subcategory="Bars & Cafés",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d24,
    ))

    # 21. Jour 25: Carrefour Drive
    d25 = datetime(year, month, 25, 12, 15)
    d25_str = d25.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d25_str,
        value_date=d25_str,
        booking_datetime=d25,
        amount=round(-104.20 + v1, 2),
        currency="EUR",
        raw_label="CARTE CARREFOUR DRIVE",
        merchant_name="Carrefour",
        category="Alimentation",
        subcategory="Supermarché",
        is_user_classified=True,
        is_excluded_from_budget=False,
        status="confirmed",
        created_at=d25,
    ))

    # 22. Jour 27: Salaire Tech Solutions
    d27 = datetime(year, month, 27, 6, 0)
    d27_str = d27.strftime("%Y-%m-%d")
    txs.append(Transaction(
        id=f"tx_{uuid.uuid4().hex[:12]}",
        user_id=user_id,
        bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
        account_id=acc_courant_id,
        booking_date=d27_str,
        value_date=d27_str,
        booking_datetime=d27,
        amount=3850.00,
        currency="EUR",
        raw_label="VIR SEPA SALAIRE ENTREPRISE TECH SAS",
        merchant_name="Tech Solutions",
        category="Revenus",
        subcategory="Salaire",
        is_user_classified=True,
        is_excluded_from_budget=True,
        status="confirmed",
        created_at=d27,
    ))

    return txs

def seed_demo_data_for_user(db: Session, user: User, force: bool = False) -> int:
    """
    Crée ou réinitialise des données de démonstration complètes et réalistes
    pour l'utilisateur avec un historique complet couvrant tous les mois.
    """
    print(f"[Seed] Traitement des données de démo pour {user.email} (force={force})...")

    # 1. Connexion bancaire
    bank_conn = db.query(BankConnection).filter(BankConnection.user_id == user.id).first()
    if not bank_conn:
        conn_id = f"conn_{uuid.uuid4().hex[:10]}"
        bank_conn = BankConnection(
            id=conn_id,
            user_id=user.id,
            module_name="bourso",
            bank_name="BoursoBank",
            login="admin_demo",
            password=None,
            backend_name=f"bourso_{user.id[:8]}",
            status="connected",
            created_at=datetime(2025, 9, 1),
            last_synced_at=datetime.utcnow(),
        )
        db.add(bank_conn)
        db.commit()

    # 2. Comptes bancaires
    acc_courant = db.query(Account).filter(Account.user_id == user.id, Account.account_type == "Compte Courant").first()
    acc_epargne = db.query(Account).filter(Account.user_id == user.id, Account.account_type == "Livret A").first()
    acc_pea = db.query(Account).filter(Account.user_id == user.id, Account.account_type == "Plan d'Épargne en Actions").first()

    if not acc_courant:
        acc_courant = Account(
            id=f"acc_{uuid.uuid4().hex[:10]}",
            user_id=user.id,
            backend_name=bank_conn.backend_name,
            bank_account_id=f"bourso_courant_{user.id[:6]}",
            name="Compte Courant",
            iban="FR7630004000012345678901234",
            account_type="Compte Courant",
            balance=3450.75,
            currency="EUR",
            bank_name="BoursoBank",
            color="from-indigo-600 to-blue-600",
            created_at=datetime(2025, 9, 1),
            updated_at=datetime.utcnow(),
        )
        db.add(acc_courant)

    if not acc_epargne:
        acc_epargne = Account(
            id=f"acc_{uuid.uuid4().hex[:10]}",
            user_id=user.id,
            backend_name=bank_conn.backend_name,
            bank_account_id=f"bourso_livret_a_{user.id[:6]}",
            name="Livret A",
            iban="FR7630004000012345678901235",
            account_type="Livret A",
            balance=12500.00,
            currency="EUR",
            bank_name="BoursoBank",
            color="from-emerald-600 to-teal-600",
            created_at=datetime(2025, 9, 1),
            updated_at=datetime.utcnow(),
        )
        db.add(acc_epargne)

    if not acc_pea:
        acc_pea = Account(
            id=f"acc_{uuid.uuid4().hex[:10]}",
            user_id=user.id,
            backend_name=bank_conn.backend_name,
            bank_account_id=f"fortuneo_pea_{user.id[:6]}",
            name="PEA Investissements",
            iban="FR7610002000098765432109876",
            account_type="Plan d'Épargne en Actions",
            balance=28400.00,
            currency="EUR",
            bank_name="Fortuneo",
            color="from-violet-600 to-purple-600",
            created_at=datetime(2025, 9, 1),
            updated_at=datetime.utcnow(),
        )
        db.add(acc_pea)

    db.commit()

    # 3. Budgets
    existing_budgets = db.query(Budget).filter(Budget.user_id == user.id).count()
    if existing_budgets == 0:
        budgets = [
            Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Alimentation", monthly_limit=550.0),
            Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Logement", monthly_limit=1100.0),
            Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Loisirs & Sorties", monthly_limit=350.0),
            Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Transports", monthly_limit=150.0),
            Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Abonnements", monthly_limit=90.0),
            Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Santé & Bien-être", monthly_limit=80.0),
        ]
        db.add_all(budgets)
        db.commit()

    # 4. Projets
    existing_projects = db.query(Project).filter(Project.user_id == user.id).count()
    if existing_projects == 0:
        projects = [
            Project(
                id=f"proj_{uuid.uuid4().hex[:10]}",
                user_id=user.id,
                name="Fonds d'Urgence",
                description="Épargne de précaution 6 mois de dépenses",
                project_type="savings",
                target_amount=15000.0,
                current_amount=12500.0,
                monthly_contribution=300.0,
                deadline="2026-12-31",
                category="Épargne",
                status="in_progress",
                linked_account_id=acc_epargne.id,
            ),
            Project(
                id=f"proj_{uuid.uuid4().hex[:10]}",
                user_id=user.id,
                name="Voyage à Tokyo",
                description="Vacances et séjour 3 semaines",
                project_type="savings",
                target_amount=4000.0,
                current_amount=2800.0,
                monthly_contribution=250.0,
                deadline="2026-11-15",
                category="Voyages",
                status="in_progress",
                linked_account_id=acc_epargne.id,
            ),
            Project(
                id=f"proj_{uuid.uuid4().hex[:10]}",
                user_id=user.id,
                name="Investissement Locatif Lyon",
                description="Apport personnel pour acquisition studio",
                project_type="real_estate",
                target_amount=45000.0,
                current_amount=28400.0,
                monthly_contribution=500.0,
                deadline="2027-06-30",
                category="Immobilier",
                status="in_progress",
                linked_account_id=acc_pea.id,
            ),
        ]
        db.add_all(projects)
        db.commit()

    # 5. Investissements (PEA)
    existing_holdings = db.query(InvestmentHolding).filter(InvestmentHolding.user_id == user.id).count()
    if existing_holdings == 0:
        holdings = [
            InvestmentHolding(
                id=f"hold_{uuid.uuid4().hex[:10]}",
                user_id=user.id,
                account_id=acc_pea.id,
                symbol="CW8",
                name="Amundi MSCI World UCITS ETF",
                asset_type="etf",
                quantity=35.0,
                buy_price=435.00,
                current_price=512.40,
                currency="EUR",
                sector="Index / Global",
                notes="Ligne principale ETF Monde",
            ),
            InvestmentHolding(
                id=f"hold_{uuid.uuid4().hex[:10]}",
                user_id=user.id,
                account_id=acc_pea.id,
                symbol="AI.PA",
                name="Air Liquide SA",
                asset_type="stock",
                quantity=25.0,
                buy_price=158.00,
                current_price=182.60,
                currency="EUR",
                sector="Industrie & Chimie",
                notes="Actions au nominatif administré",
            ),
            InvestmentHolding(
                id=f"hold_{uuid.uuid4().hex[:10]}",
                user_id=user.id,
                account_id=acc_pea.id,
                symbol="MC.PA",
                name="LVMH Moët Hennessy",
                asset_type="stock",
                quantity=8.0,
                buy_price=690.00,
                current_price=745.00,
                currency="EUR",
                sector="Luxe",
                notes="Position de conviction",
            ),
            InvestmentHolding(
                id=f"hold_{uuid.uuid4().hex[:10]}",
                user_id=user.id,
                account_id=acc_pea.id,
                symbol="SU.PA",
                name="Schneider Electric SE",
                asset_type="stock",
                quantity=20.0,
                buy_price=185.00,
                current_price=242.00,
                currency="EUR",
                sector="Énergie & Industrie",
                notes="Transition énergétique",
            ),
        ]
        db.add_all(holdings)
        db.commit()

    # 6. Emprunt immobilier (Loans - Issue #43)
    existing_loans = db.query(Loan).filter(Loan.user_id == user.id).count()
    if existing_loans == 0:
        demo_loan = Loan(
            id=f"loan_{uuid.uuid4().hex[:10]}",
            user_id=user.id,
            name="Crédit Immobilier RP",
            loan_type="mortgage",
            lender_name="BoursoBank",
            principal_amount=240000.0,
            interest_rate=3.10,
            insurance_rate=0.28,
            duration_months=240,
            start_date="2024-01-01",
            rate_type="fixed",
            linked_account_id=acc_courant.id,
            notes="Financement résidence principale taux fixe 20 ans",
        )
        db.add(demo_loan)
        db.commit()

    # 7. Transactions couvrant tous les mois
    existing_txs_count = db.query(Transaction).filter(Transaction.user_id == user.id).count()
    if force or existing_txs_count < 50:
        if existing_txs_count > 0:
            db.query(Transaction).filter(Transaction.user_id == user.id).delete()
            db.commit()

        all_transactions: List[Transaction] = []
        for y, m in MONTHS_TO_SEED:
            month_txs = _generate_month_transactions(
                user_id=user.id,
                acc_courant_id=acc_courant.id,
                acc_epargne_id=acc_epargne.id,
                acc_pea_id=acc_pea.id,
                year=y,
                month=m,
            )
            all_transactions.extend(month_txs)

        db.add_all(all_transactions)
        db.commit()
        print(f"[Seed] {len(all_transactions)} transactions créées sur {len(MONTHS_TO_SEED)} mois pour {user.email}.")
        return len(all_transactions)

    return existing_txs_count

def init_db_superuser(db: Session = None) -> None:
    """
    Initialise automatiquement un compte administrateur (superuser) au démarrage
    avec ses données de démonstration complètes sur tous les mois.
    """
    close_db = False
    if db is None:
        db = SessionLocal()
        close_db = True

    try:
        superuser_email = settings.FIRST_SUPERUSER_EMAIL.lower().strip()
        existing_user = db.query(User).filter(User.email == superuser_email).first()

        if existing_user:
            if existing_user.role != "admin" or not existing_user.is_active:
                existing_user.role = "admin"
                existing_user.is_active = True
                db.commit()
                print(f"[Seed] Utilisateur '{superuser_email}' mis a jour avec le role 'admin'.")
            if not getattr(existing_user, "avatar_seed", None):
                existing_user.avatar_seed = "felix"
                db.commit()
            seed_demo_data_for_user(db, existing_user)
        else:
            admin_id = f"usr_{uuid.uuid4().hex[:12]}"
            hashed_pw = hash_user_password(settings.FIRST_SUPERUSER_PASSWORD)
            new_admin = User(
                id=admin_id,
                email=superuser_email,
                full_name=settings.FIRST_SUPERUSER_NAME.strip(),
                hashed_password=hashed_pw,
                role="admin",
                avatar_seed="felix",
                is_active=True,
            )
            db.add(new_admin)
            db.commit()
            print(f"[Seed] Compte Superuser initialise : {superuser_email} (role: admin)")
            seed_demo_data_for_user(db, new_admin)
    except Exception as e:
        db.rollback()
        print(f"[Seed Error] Impossible d'initialiser le superuser : {e}")
    finally:
        if close_db:
            db.close()
