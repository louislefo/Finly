# Guide de Contribution a Finly

Merci de votre interet pour Finly. Ce document definit les lignes directrices, standards de code et processus de developpement pour contribuer efficacement au projet.

---

## Sommaire

- [Principes Fondamentaux](#principes-fondamentaux)
- [Configuration de l'Environnement de Developpement](#configuration-de-lenvironnement-de-developpement)
  - [Backend FastAPI](#backend-fastapi)
  - [Frontend Nextjs](#frontend-nextjs)
  - [Environnement Conteneurise avec Docker](#environnement-conteneurise-avec-docker)
- [Workflow Git et Conventions](#workflow-git-et-conventions)
  - [Gestion des Branches](#gestion-des-branches)
  - [Conventions de Commits](#conventions-de-commits)
- [Standards et Qualite de Code](#standards-et-qualite-de-code)
  - [Frontend (Next.js, TypeScript, Tailwind)](#frontend-nextjs-typescript-tailwind)
  - [Directives UI/UX et Design](#directives-uiux-et-design)
  - [Backend (FastAPI, Python, SQLAlchemy)](#backend-fastapi-python-sqlalchemy)
- [Tests et Validation](#tests-et-validation)
- [Processus de Pull Request](#processus-de-pull-request)
- [Signaler un Probleme ou une Vulnerabilite](#signaler-un-probleme-ou-une-vulnerabilite)

---

## Principes Fondamentaux

1. **Confidentialite et Souverainete :** Finly est 100% auto-heberge. Aucune telemetrie, aucun traqueur externe et aucun service d'agregation cloud payant ne doivent etre introduits.
2. **Securite des Donnees :** Les identifiants bancaires et cles sensibles doivent obligatoirement etre chiffres via AES-256 (Fernet) avant ecriture en base de donnees.
3. **Sobriete et Minimalisme :** L'interface utilisateur est epuree, directe et concentree sur les indicateurs cles. Aucun texte explicatif verbeux ou surcharge visuelle.
4. **Qualite et Robustesse :** Tout nouvel ajout doit etre accompagne de tests unitaires/d'integration et respecter le typage strict.

---

## Configuration de l'Environnement de Developpement

### Backend FastAPI

1. **Prerequis :** Python 3.11 ou version superieure.
2. **Initialisation de l'environnement virtuel :**
   ```bash
   cd backend
   python -m venv .venv

   # Sur Linux / macOS
   source .venv/bin/activate

   # Sur Windows (PowerShell)
   .\.venv\Scripts\Activate.ps1
   ```
3. **Installation des dependances :**
   ```bash
   pip install -r requirements.txt
   ```
4. **Configuration locale :**
   ```bash
   cp .env.example .env
   ```
5. **Demarrage du serveur de developpement :**
   ```bash
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```
   L'API est accessible sur `http://localhost:8000` et sa documentation Swagger sur `http://localhost:8000/docs`.

---

### Frontend Next.js

1. **Prerequis :** Node.js 20+ et npm.
2. **Installation des modules :**
   ```bash
   cd finly-app
   npm install
   ```
3. **Demarrage du serveur Next.js :**
   ```bash
   npm run dev
   ```
   L'application est accessible sur `http://localhost:3000`.

---

### Environnement Conteneurise avec Docker

Pour reproduire fidelement l'environnement de production localement :
```bash
docker compose up -d --build
```
Pour consulter les journaux :
```bash
docker compose logs -f
```

---

## Workflow Git et Conventions

### Gestion des Branches

- La branche principale est `main`.
- Creez toujours une branche thematique a partir de `main` :
  - `feature/nom-de-la-fonctionnalite` : Ajout d'une nouvelle fonctionnalite.
  - `fix/description-du-correctif` : Correction d'un bug.
  - `refactor/nom-du-refactoring` : Refonte de code sans changement fonctionnel.
  - `docs/sujet-de-la-doc` : Ajout ou mise a jour de documentation.
  - `test/sujet-des-tests` : Ajout ou amelioration de tests.

Exemple :
```bash
git checkout -b feature/add-csv-export
```

### Conventions de Commits

Nous suivons le standard Conventional Commits :

```text
<type>(<scope optionnel>): <description courte et imperative>
```

Types autorises :
- `feat` : Nouvelle fonctionnalite
- `fix` : Correction de bug
- `docs` : Modifications de la documentation
- `style` : Formatage, points-virgules, sans impact sur le sens du code
- `refactor` : Refactorisation sans ajout de fonctionnalite ni correction
- `perf` : Amelioration de performance
- `test` : Ajout ou correction de tests
- `chore` : Taches de maintenance, configuration de build, dependances

Exemples de messages valides :
- `feat(export): add dynamic PDF summary generator`
- `fix(sync): resolve token expiration handling in woob runner`
- `refactor(auth): simplify session token validation middleware`
- `docs(readme): update screenshots and visual guide`

---

## Standards et Qualite de Code

### Frontend (Next.js, TypeScript, Tailwind)

- **TypeScript Strict :** Pas de type `any` non justifie. Tous les modeles de donnees d'API doivent disposer d'interfaces dediees dans `lib/` ou `types/`.
- **React Server Components & Client Components :** N'ajoutez la directive `'use client'` qu'aux composants necessitant des hooks React (`useState`, `useEffect`, evenements DOM).
- **Structure des Composants :** Placez les composants reutilisables dans `components/ui` et les composants metier dans des sous-dossiers explicites.
- **Composants Shadcn UI :** Privilegier les composants de base Shadcn UI (Button, Card, Dialog, Sheet, Tabs, Badge, Progress, Select, Table).

### Directives UI/UX et Design

- **Dark Mode Exclusif :** Finly n'utilise pas de mode clair. Fondez les styles sur la palette Zinc sombre :
  - Fond d'ecran principal : `bg-zinc-950` (`#09090B`)
  - Cartes et panneaux : `bg-zinc-900` (`#18181B`)
  - Bordures subtiles : `border-white/10` ou `border-zinc-800`
  - Texte principal : `text-zinc-100`, secondaire : `text-zinc-400`
- **Simplicite et Epuration :** Supprimer tout texte verbeux, sous-titres superflus ou descriptions redondantes sous les en-tetes. Les chiffres et graphiques doivent parler d'eux-memes.
- **Responsive Mobile First :** Verifier systematiquement le rendu sur ecran etroit (navigation via Bottom Bar, tiroirs coulissants Vaul/Sheet pour les details).

### Backend (FastAPI, Python, SQLAlchemy)

- **PEP 8 et Typage :** Respecter les conventions PEP 8 et utiliser les type hints Python (Pydantic v2 pour les schemas d'entree/sortie).
- **Architecture en Couches :**
  - `app/api/endpoints/` : Definition des routes HTTP, validation et reponses.
  - `app/services/` : Logique metier, agregation bancaire, exports.
  - `app/models/` : Modeles SQLAlchemy ORM.
  - `app/core/` : Parametres globaux, securite, configuration base de donnees.
- **Gestion des Erreurs :** Retourner des exceptions HTTP explicites via `HTTPException(status_code=..., detail=...)`.
- **Securite :** Jamais d'identifiants bancaires en clair dans les logs ou dans la base de donnees.

---

## Tests et Validation

Avant de soumettre une modification, assurez-vous que l'ensemble des tests passent avec succes.

### Backend

```bash
cd backend
pytest -v
```

Pour executer un fichier de test specifique :
```bash
pytest tests/test_transactions_and_accounts.py -v
```

### Frontend

```bash
cd finly-app
# Executer les tests unitaires
npm test

# Executer l'analyse statique ESLint
npm run lint

# Verifier la compilation TypeScript et Next.js
npm run build
```

---

## Processus de Pull Request

1. **Mettre a jour votre branche locale :**
   ```bash
   git fetch origin
   git rebase origin/main
   ```
2. **Executer la suite de tests complete** (backend et frontend).
3. **Pousser votre branche sur votre fork ou le depot :**
   ```bash
   git push origin feature/votre-branche
   ```
4. **Ouvrir une Pull Request sur GitHub :**
   - Renseignez un titre clair suivant les conventions Conventional Commits.
   - Decrivez precisement les modifications apportees, le contexte et les tests effectues.
   - Joignez des captures d'ecran ou enregistrements si des changements visuels ont ete realises.
5. **Revue de code :** Repondez aux remarques des relecteurs et effectuez les ajustements necessaires.

---

## Signaler un Probleme ou une Vulnerabilite

- **Signalement de bugs ou suggestions :** Ouvrez une Issue sur le depot GitHub avec une description detaillee, les etapes de reproduction et votre environnement (OS, navigateur, version de Finly).
- **Signalement de vulnerabilite de securite :** Merci de ne pas ouvrir d'issue publique pour une faille critique de securite. Contactez directement les mainteneurs du projet pour un traitement confidentiel.
