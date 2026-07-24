# Spécifications Techniques & Fonctionnelles — Projet Finance (PWA)

## 1. Présentation Générale du Projet
- **Nom du projet :** App de suivi financier personnel (ex: Saldo / Finly / Vaulto).
- **Type d'application :** Web Application / Progressive Web App (PWA) hébergée en mode Self-Hosted.
- **Philosophie UI/UX :** Mobile-First, ressenti iOS natif (Finary, Bankin', Revolut), Dark Mode par défaut, responsive pour écran PC.
- **Périmètre fonctionnel :** Agrégation bancaire multi-comptes, suivi quotidien des dépenses (Jour/Mois/Année), gestion de projets budgétaires, génération d'exports Excel dynamiques.

---

## 2. Pile Technique & Dépendances Principales

### A. Frontend & Interface Utilisateur
- **Framework Base :** Next.js (App Router, TypeScript)
- **Styling :** Tailwind CSS
- **Composants UI :** Shadcn UI / Radix UI (composants accessibles et personnalisables)
- **Icônes :** Lucide React (bibliothèque d'icônes vectorielles)
- **Animations & Interaction iOS :** 
  - `framer-motion` (transitions fluides et animations d'interface)
  - `vaul` (composant Drawer / Bottom Sheet identique au style iOS)
- **Visualisation de Données :** Recharts ou Tremor (graphiques d'évolution et jauges)
- **Tableaux de Données :** `@tanstack/react-table` (gestion des listes et prévisualisations)
- **PWA :** Manifest.json natif ou `next-pwa` (installation sur écran d'accueil sans barre d'adresse)

### B. Backend, API & Traitement de Données
- **Environnement Serveur :** Node.js (Fastify, Express ou Next.js API Routes) ou Python (FastAPI)
- **Base de Données :** PostgreSQL ou SQLite
- **ORM / Query Builder :** Prisma / Drizzle ORM (TypeScript) ou Peewee / SQLAlchemy (Python)
- **Planification de Tâches :** `node-cron` (Node.js) ou `APScheduler` (Python) pour l'aspiration bancaire
- **Génération Excel :** `exceljs` (Node.js) ou `openpyxl` (Python) pour la création de fichiers `.xlsx` avec formules natives

### C. Infrastructure & Déploiement Self-Hosted
- **Conteneurisation :** Docker et Docker Compose
- **Accès Distant Sécurisé :** VPN personnel (Tailscale / WireGuard) ou Reverse Proxy (Nginx / Traefik / Caddy)
- **Gestion des Secrets :** Fichier de variables d'environnement (`.env`)

---

## 3. Intégration Bancaire & Réglementation

- **Agrégateur Bancaire :** GoCardless Bank Account Data API (ex-Nordigen)
- **Norme Légale :** Directive Européenne DSP2 (Authentification Forte / SCA)
- **Durée de Consentement :** 180 jours maximum avant renouvellement obligatoire via l'application de la banque
- **Pipeline d'Aspiration :**
  1. Récupération des soldes de comptes
  2. Extraction de l'historique des transactions
  3. Dédoublonnage via identifiants uniques de transaction
  4. Nettoyage Regex des libellés bancaires pour isoler le marchand
  5. Catégorisation automatique par mots-clés

---

## 4. Modèle de Données & Entités

1. **Connexions Bancaires (Requisitions) :**
   - Identifiant GoCardless, nom de la banque, statut de la liaison, date de création, date d'expiration (180 jours).

2. **Comptes (Accounts) :**
   - ID unique, compte rattaché à une connexion, nom du compte, type (Courant, Épargne), solde, devise.

3. **Transactions :**
   - ID unique, compte rattaché, date d'imputation, montant, marchand nettoyé, libellé brut, catégorie rattachée, projet rattaché (optionnel).

4. **Catégories :**
   - ID, nom (Alimentation, Transports, Logement, etc.), icône, couleur, règles de filtrage.

5. **Projets & Budgets :**
   - ID, nom du projet (ex: Vacances), budget prévisionnel cible, date de début, date de fin, statut.

---

## 5. Modules Fonctionnels de l'Application

### Module 1 : Dashboard / Synthèse (Home)
- Affichage du solde global consolidé (somme de tous les comptes).
- Bouton de masquage des soldes (remplacement des chiffres par des puces d'occultation).
- Carousel / Liste des comptes individuels et leurs soldes respectifs.
- Graphique interactif de la courbe d'évolution des flux financiers.
- Widgets de résumé (Top dépenses du mois, état des projets).

### Module 2 : Fil des Dépenses (Transactions)
- Filtrage par granularité temporelle : **Jour**, **Mois**, **Année**.
- Filtre par compte bancaire spécifique ou vue combinée.
- Barre de recherche instantanée par nom de commerçant ou catégorie.
- Liste chronologique groupée par date.
- Ouverture d'une fiche détaillée en **Bottom Sheet iOS** au clic sur une transaction.

### Module 3 : Projets & Prévisions Budgétaires
- Création de projets personnalisés avec attribution d'un budget prévisionnel.
- Association manuelle ou automatique des dépenses à un projet.
- Calcul en temps réel du restant disponible et barres de progression visuelles.

### Module 4 : Centre d'Exportation Excel
- Sélection de plages de dates personnalisées et sélection des comptes.
- Prévisualisation du tableau de données avant téléchargement.
- Génération d'un fichier `.xlsx` contenant des formules dynamiques (SOMME, SOMME.SI) réparties sur plusieurs onglets.

---

## 6. Directives UI/UX & Design System

- **Palette de Couleurs :**
  - Background principal : `#09090B` (Zinc 950)
  - Cartes et conteneurs : `#18181B` (Zinc 900)
  - Bordures : `border-white/10` (fines et semi-transparentes)
  - Variantes d'état : Vert pour les revenus/positif, neutre/rouge pour les dépenses.
- **Ergonomie iOS :**
  - Absence de pop-ups classiques au centre sur mobile (remplacés par des Bottom Sheets Vaul).
  - Suppression de la barre d'adresse en mode PWA.
  - Micro-interactions visuelles sur chaque bouton.
- **Dispositions :**
  - Mobile : Colonne unique scrollable, navigation par Bottom Bar fixe.
  - PC / Tablette : Disposition en grille Bento Grid, navigation par Sidebar latérale.