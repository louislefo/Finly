# Finly

Application web progressive (PWA) d'agrégation et de gestion financière personnelle, 100% self-hosted, sécurisée et axée sur la confidentialité de vos données.

---

## Sommaire

- [Apercu](#apercu)
- [Fonctionnalites Principales](#fonctionnalites-principales)
- [Architecture Technique](#architecture-technique)
- [Pre-requis](#pre-requis)
- [Demarrage Rapide avec Docker Compose](#demarrage-rapide-avec-docker-compose)
- [Installation Manuelle pour le Developpement](#installation-manuelle-pour-le-developpement)
- [Configuration des Variables d'Environnement](#configuration-des-variables-denvironnement)
- [Gestion des Connecteurs Bancaires (Woob)](#gestion-des-connecteurs-bancaires-woob)
- [Securite et Confidentialite](#securite-et-confidentialite)
- [Structure du Projet](#structure-du-projet)
- [Licence](#licence)

---

## Apercu

Finly est une plateforme complete de gestion de finances personnelles concue pour fonctionner integralement en local ou sur votre propre serveur. Elle combine une interface moderne et epuree (inspiree des standards Linear, Apple et Finary en mode sombre exclusif) avec un moteur d'agregation bancaire autonome base sur Woob.

Contrairement aux solutions traditionnelles en mode SaaS, aucune donnee bancaire, aucun mot de passe et aucune transaction ne transitent par des serveurs tiers.

---

## Fonctionnalites Principales

### 1. Dashboard et Vue Consolidee
- Calcul et affichage en temps reel du patrimoine net consolide.
- Mode confidentialite pour masquer les soldes d'un clic.
- Repartition par compte (comptes courants, epargne, placements).
- Graphiques d'evolution du solde et de la dynamique mensuelle.

### 2. Gestion et Categorisation des Transactions
- Filtrage multi-echelle : Jour, Mois, Annee.
- Nettoyage et normalisation automatique des libelles bancaires bruts.
- Systeme de categories et sous-categories dynamiques avec regles de classification par mots-cles.
- Possibilite de modifier et classifier manuellement chaque transaction via une fiche detaillee.

### 3. Budgets et Enveloppes
- Definition de budgets previsionnels mensuels par categorie.
- Calcul en direct des depenses realisees et du montant restant disponible.
- Alertes et jauges de progression visuelles.

### 4. Projets et Objectifs d'Epargne
- Creation d'objectifs d'epargne personnalises avec date cible.
- Association de transactions specifiques aux projets.
- Suivi du taux d'avancement et du reste a financer.

### 5. Centre d'Exportation Excel Dynamique
- Generation de rapports `.xlsx` avances avec formules natives (SOMME, SOMME.SI).
- Separation par onglets (Synthese, Operations detaillees, Categories).
- Selection personnalisee des plages de dates et des comptes.

### 6. Agregation Bancaire Directe (Woob)
- Connexion directe aux etablissements bancaires europeens sans passerelle tierce.
- Synchronisation automatique planifiee en arriere-plan.
- Chiffrement symetrique AES-256 (Fernet) de l'ensemble des identifiants bancaires.

---

## Architecture Technique

### Frontend
- **Framework :** Next.js 16 (App Router, React 19, TypeScript)
- **Design System :** Tailwind CSS, composants personnalises Shadcn UI / Radix UI / Base UI
- **Visualisation :** Recharts, Lucide Icons
- **Moteur d'Export :** xlsx, xlsx-js-style

### Backend
- **API Framework :** FastAPI (Python 3.11+)
- **Base de Donnees :** SQLite avec SQLAlchemy ORM
- **Authentification :** JWT (JSON Web Tokens) avec hashage bcrypt
- **Securite :** Cryptography (AES-256 Fernet pour les identifiants)
- **Agregation :** Woob (Web Outside of Browsers)
- **Planification :** APScheduler pour les synchronisations automatiques

### Infrastructure
- Conteneurs Docker isoles avec Docker Compose et persistance sur volumes locaux.

---

## Pre-requis

Avant d'installer Finly, assurez-vous de disposer des outils suivants :

- **Option Docker (Recommandee) :** Docker Engine (20.10+) et Docker Compose (2.0+)
- **Option Manuelle :**
  - Node.js 20+ et npm
  - Python 3.11+ et pip

---

## Demarrage Rapide avec Docker Compose

C'est la methode la plus simple pour executer Finly en production ou en self-hosting.

### 1. Cloner le depot
```bash
git clone https://github.com/votre-compte/finly.git
cd finly
```

### 2. Configurer les variables d'environnement
Copiez le fichier d'exemple dans le dossier backend :
```bash
cp backend/.env.example backend/.env
```

Generez une cle secrete pour `SECRET_KEY` :
```bash
python -c "import secrets; print(secrets.token_hex(32))"
```
Renseignez cette valeur dans le fichier `backend/.env`.

### 3. Lancer les conteneurs
```bash
docker compose up -d --build
```

### 4. Acceder aux services
- **Application Web :** [http://localhost:3000](http://localhost:3000)
- **Documentation API (Swagger) :** [http://localhost:8000/docs](http://localhost:8000/docs)
- **Verification de l'API :** [http://localhost:8000/health](http://localhost:8000/health)

### 5. Arreter les conteneurs
```bash
docker compose down
```

---

## Installation Manuelle pour le Developpement

Si vous souhaitez travailler sur le code sans passer par Docker :

### A. Lancement du Backend (FastAPI)

1. Ouvrir un terminal et acceder au dossier backend :
```bash
cd backend
```

2. Creer et activer un environnement virtuel :
```bash
# Sous Linux / macOS
python3 -m venv .venv
source .venv/bin/activate

# Sous Windows (PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

3. Installer les dependances Python :
```bash
pip install -r requirements.txt
```

4. Creer le fichier `.env` a partir du modele :
```bash
cp .env.example .env
```

5. Lancer le serveur FastAPI avec rechargement a chaud :
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### B. Lancement du Frontend (Next.js)

1. Ouvrir un second terminal et acceder au dossier `finly-app` :
```bash
cd finly-app
```

2. Installer les dependances Node.js :
```bash
npm install
```

3. Lancer le serveur de developpement Next.js :
```bash
npm run dev
```

4. L'application est disponible sur [http://localhost:3000](http://localhost:3000).

---

## Configuration des Variables d'Environnement

Le backend necessite certaines variables pour fonctionner. Voici les parametres disponibles dans `backend/.env.example` :

| Variable | Description | Valeur par defaut |
| :--- | :--- | :--- |
| `DATABASE_URL` | URL de connexion a la base SQLite | `sqlite:///./finly.db` |
| `SECRET_KEY` | Cle pour le chiffrement AES-256 et JWT | A generer aleatoirement |
| `CORS_ORIGINS` | Origines autorisees pour les requetes | `http://localhost:3000` |
| `SYNC_INTERVAL_HOURS` | Intervalle de synchronisation bancaire automatique | `6` |

---

## Gestion des Connecteurs Bancaires (Woob)

Finly s'appuie sur la suite libre Woob pour communiquer avec les interfaces bancaires.

### Mise a jour des modules bancaires
Les interfaces bancaires evoluant regulierement, il est conseille de mettre a jour les modules Woob :
```bash
woob config update
```

### Lister les banques supportees
```bash
woob bank
```

---

## Securite et Confidentialite

1. **Isolation complete :** Finly n'envoie aucune donnee a des serveurs externes. Vos comptes et transactions restent stockes dans votre base de donnees locale SQLite.
2. **Chiffrement des identifiants :** Les mots de passe et identifiants bancaires necessaires aux synchronisations sont chiffres en base de donnees a l'aide de l'algorithme AES-256 (Fernet).
3. **Mots de passe utilisateurs :** Les mots de passe d'acces a l'application sont haches avec l'algorithme securise bcrypt.
4. **Controle total :** Vous pouvez a tout moment supprimer vos connexions bancaires, vos comptes ou exporter l'integralite de vos donnees au format Excel.

---

## Structure du Projet

```text
finly/
|-- backend/                     # API FastAPI & Moteur Python
|   |-- app/
|   |   |-- api/                 # Endpoints REST (auth, accounts, transactions, etc.)
|   |   |-- core/                # Configurations, securite, base de donnees
|   |   |-- models/              # Modeles SQLAlchemy
|   |   |-- scheduler/           # Planification des synchronisations
|   |   |-- services/            # Services metiers (Woob, export Excel, chiffrement)
|   |   `-- main.py              # Point d'entree FastAPI
|   |-- Dockerfile               # Image Docker Backend
|   |-- requirements.txt         # Dependances Python
|   `-- .env.example             # Modele de configuration
|
|-- finly-app/                   # Application Frontend Next.js
|   |-- app/                     # Routes et pages (App Router)
|   |-- components/              # Composants UI React
|   |-- hooks/                   # Hooks personnalises
|   |-- lib/                     # Utilitaires et clients API
|   |-- Dockerfile               # Image Docker Frontend
|   `-- package.json             # Dependances Node.js
|
|-- docker-compose.yml           # Orchestration complete
`-- README.md                    # Documentation principale
```

---

## Contribution

Les contributions, signalements de bugs et suggestions d'ameliorations sont les bienvenus. Pour contribuer :

1. Forkez le projet.
2. Creez une branche deduite (`git checkout -b feature/amelioration-nom`).
3. Commitez vos modifications (`git commit -m "Ajout d'une nouvelle fonctionnalite"`).
4. Poussez votre branche (`git push origin feature/amelioration-nom`).
5. Ouvrez une Pull Request.

---

## Licence

Ce projet est distribue sous licence MIT. Consultez le fichier `LICENSE` pour plus d'informations.