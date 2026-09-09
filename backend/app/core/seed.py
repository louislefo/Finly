import uuid
from datetime import datetime, timedelta
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

def seed_demo_data_for_user(db: Session, user: User) -> None:
    """Crée des données de démonstration complètes et réalistes pour le compte administrateur."""
    # Vérifier si l'utilisateur a déjà des comptes
    existing_accounts = db.query(Account).filter(Account.user_id == user.id).count()
    if existing_accounts > 0:
        return

    print(f"[Seed] Création des données de démo pour {user.email}...")

    # 1. Connexion bancaire
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
        created_at=datetime.utcnow() - timedelta(days=90),
        last_synced_at=datetime.utcnow(),
    )
    db.add(bank_conn)

    # 2. Comptes bancaires
    acc_courant_id = f"acc_{uuid.uuid4().hex[:10]}"
    acc_courant = Account(
        id=acc_courant_id,
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
        created_at=datetime.utcnow() - timedelta(days=90),
        updated_at=datetime.utcnow(),
    )

    acc_epargne_id = f"acc_{uuid.uuid4().hex[:10]}"
    acc_epargne = Account(
        id=acc_epargne_id,
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
        created_at=datetime.utcnow() - timedelta(days=90),
        updated_at=datetime.utcnow(),
    )

    acc_pea_id = f"acc_{uuid.uuid4().hex[:10]}"
    acc_pea = Account(
        id=acc_pea_id,
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
        created_at=datetime.utcnow() - timedelta(days=90),
        updated_at=datetime.utcnow(),
    )

    db.add_all([acc_courant, acc_epargne, acc_pea])
    db.commit()

    # 3. Budgets
    budgets = [
        Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Alimentation", monthly_limit=550.0),
        Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Logement", monthly_limit=1100.0),
        Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Loisirs & Sorties", monthly_limit=350.0),
        Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Transports", monthly_limit=150.0),
        Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Abonnements", monthly_limit=90.0),
        Budget(id=f"bud_{uuid.uuid4().hex[:10]}", user_id=user.id, category="Santé", monthly_limit=80.0),
    ]
    db.add_all(budgets)

    # 4. Projets
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

    # 5. Transactions réalistes récentes
    now = datetime.utcnow()
    raw_txs = [
        # Salaires
        {"days": 2, "amt": 3850.00, "raw": "VIR SEPA SALAIRE ENTREPRISE TECH SAS", "m": "Tech Solutions", "cat": "Revenus", "sub": "Salaire"},
        # Logement
        {"days": 3, "amt": -950.00, "raw": "PRLV SEPA GESTION IMMOBILIERE LOYER", "m": "Gestion Immobilière", "cat": "Logement", "sub": "Loyer"},
        {"days": 8, "amt": -68.40, "raw": "PRLV SEPA EDF CLIENT PARTICULIER", "m": "EDF", "cat": "Logement", "sub": "Énergie"},
        # Alimentation
        {"days": 1, "amt": -74.30, "raw": "CARTE 08/09 MONOPRIX PARIS", "m": "Monoprix", "cat": "Alimentation", "sub": "Supermarché"},
        {"days": 4, "amt": -118.50, "raw": "CARTE 05/09 CARREFOUR MARKET", "m": "Carrefour", "cat": "Alimentation", "sub": "Supermarché"},
        {"days": 6, "amt": -14.20, "raw": "CARTE 03/09 BOULANGERIE DU COIN", "m": "Boulangerie", "cat": "Alimentation", "sub": "Boulangerie"},
        {"days": 11, "amt": -89.90, "raw": "CARTE 29/08 BIO C BON", "m": "Bio c' Bon", "cat": "Alimentation", "sub": "Supermarché"},
        # Loisirs / Restaurants
        {"days": 2, "amt": -48.00, "raw": "CARTE 07/09 RESTAURANT LE BISTROT", "m": "Le Bistrot Gourmand", "cat": "Loisirs & Sorties", "sub": "Restaurants"},
        {"days": 5, "amt": -32.50, "raw": "CARTE 04/09 CINEMA MK2 BIBLIOTHEQUE", "m": "MK2 Cinémas", "cat": "Loisirs & Sorties", "sub": "Culture"},
        {"days": 9, "amt": -56.00, "raw": "CARTE 31/08 RESTAURANT ITALIEN TRATTORIA", "m": "Trattoria Romana", "cat": "Loisirs & Sorties", "sub": "Restaurants"},
        # Transports
        {"days": 7, "amt": -86.40, "raw": "PRLV SEPA ILE DE FRANCE MOBILITES NAVIGO", "m": "IDFM Navigo", "cat": "Transports", "sub": "Transports en commun"},
        {"days": 12, "amt": -42.00, "raw": "CARTE 28/08 SNCF CONNECT TGV", "m": "SNCF Connect", "cat": "Transports", "sub": "Train"},
        # Abonnements
        {"days": 4, "amt": -17.99, "raw": "CARTE 05/09 NETFLIX.COM", "m": "Netflix", "cat": "Abonnements", "sub": "Streaming Vidéo"},
        {"days": 6, "amt": -10.99, "raw": "CARTE 03/09 SPOTIFY PREMIUM", "m": "Spotify", "cat": "Abonnements", "sub": "Streaming Audio"},
        {"days": 10, "amt": -29.99, "raw": "PRLV SEPA FREE FIBRE INTERNET", "m": "Freebox", "cat": "Abonnements", "sub": "Télécoms"},
        # Épargne & Virements
        {"days": 3, "amt": -300.00, "raw": "VIR INTERNE VERS LIVRET A", "m": "Épargne Programmée", "cat": "Épargne", "sub": "Virement interne"},
        {"days": 3, "amt": -250.00, "raw": "VIR VERS PEA INVESTISSEMENTS", "m": "Bourse Fortuneo", "cat": "Investissements", "sub": "Actions"},
    ]

    transactions = []
    for tx in raw_txs:
        date_obj = now - timedelta(days=tx["days"])
        date_str = date_obj.strftime("%Y-%m-%d")
        tx_obj = Transaction(
            id=f"tx_{uuid.uuid4().hex[:12]}",
            user_id=user.id,
            bank_tx_id=f"btx_{uuid.uuid4().hex[:12]}",
            account_id=acc_courant.id,
            booking_date=date_str,
            value_date=date_str,
            booking_datetime=date_obj,
            amount=tx["amt"],
            currency="EUR",
            raw_label=tx["raw"],
            merchant_name=tx["m"],
            category=tx["cat"],
            subcategory=tx["sub"],
            is_user_classified=True,
            is_excluded_from_budget=(tx["cat"] in ["Revenus", "Épargne", "Investissements"]),
            status="confirmed",
            created_at=date_obj,
        )
        transactions.append(tx_obj)

    db.add_all(transactions)
    db.commit()
    print(f"[Seed] Donnees de demo creees ({len(transactions)} transactions, 3 comptes, 6 budgets, 3 projets).")

def init_db_superuser(db: Session = None) -> None:
    """
    Initialise automatiquement un compte administrateur (superuser) au démarrage
    avec ses données de démonstration.
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
            seed_demo_data_for_user(db, existing_user)
        else:
            # Créer un nouveau compte superuser
            admin_id = f"usr_{uuid.uuid4().hex[:12]}"
            hashed_pw = hash_user_password(settings.FIRST_SUPERUSER_PASSWORD)
            new_admin = User(
                id=admin_id,
                email=superuser_email,
                full_name=settings.FIRST_SUPERUSER_NAME.strip(),
                hashed_password=hashed_pw,
                role="admin",
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
