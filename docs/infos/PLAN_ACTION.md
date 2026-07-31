# Plan d'Action - Projet Finly (Application PWA de Suivi Financier)

Ce document définit la feuille de route globale et le plan d'exécution technique pour le développement complet de l'application Finly.

---

## 1. Architecture Globale et Vision Technique

- **Frontend :** Next.js (App Router, TypeScript), Tailwind CSS, Shadcn UI, Lucide Icons, Framer Motion, Vaul (Drawer iOS).
- **Backend & API :** Node.js / Next.js API Routes ou FastAPI (Python), Prisma / Drizzle ORM.
- **Base de Données :** PostgreSQL (ou SQLite en mode embarqué).
- **Agrégation Bancaire :** GoCardless Bank Account Data API (Norme DSP2, requêtes synchronisées par tâches cron).
- **Exportation :** Générateur Excel (`exceljs` / `openpyxl`) produisant des fichiers `.xlsx` avec formules dynamiques nativement interprétables.
- **Déploiement :** Self-hosted via Docker Compose avec reverse proxy sécurisé (Nginx / Tailscale).

---

## 2. Feuille de Route d'Exécution

### Phase 1 : Modernisation du Design System & Layout Front-end
1. **Configuration du Thème Dark Mode Deep Space :**
   - Palette Zinc 950 (`#09090B`), surfaces Zinc 900 (`#18181B`), bordures semi-transparentes (`white/10`).
   - Intégration des composants Shadcn UI (Card, Sheet/Drawer, Dialog, Tabs, Select, Table, Badge, Button, Input, Progress, Skeleton).
2. **Navigation Adaptative Multi-Plateforme :**
   - Desktop / Tablette : Sidebar pliable et bento grid 12 colonnes.
   - Mobile : Navigation par barre inférieure fixe (Bottom Bar glassmorphism) et conteneurs défilants.
3. **Gestion du Mode Confidentialité (Privacy Masking) :**
   - Context React / State global pour masquer les soldes et montants (`*** €`) sans casser l'alignement typographique.

### Phase 2 : Implémentation des Modules Front-end
1. **Module 1 : Dashboard (Page d'accueil) :**
   - Carte de solde total consolidé avec indicateurs d'évolution.
   - Carousel / Liste scrollable des comptes reliés (BoursoBank, Revolut, etc.) avec leurs soldes.
   - Graphique interactif des flux (Recharts / Tremor).
   - Widgets Bento pour le top des dépenses du mois et la progression des projets.
2. **Module 2 : Fil des Transactions :**
   - Filtres temporels : Jour, Mois, Année.
   - Filtres par compte bancaire et barre de recherche par commerçant/catégorie.
   - Liste chronologique groupée par date avec logos / icônes par catégorie.
   - Fiche détaillée de transaction avec Bottom Sheet style iOS (Vaul / Sheet Shadcn).
3. **Module 3 : Projets & Prévisions Budgétaires :**
   - Cartes de projets (Vacances, Épargne de précaution, Apport immo).
   - Jauges de progression visuelles et calcul dynamique du solde restant à attribuer.
   - Formulaire d'affectation manuelle et automatique des dépenses aux projets.
4. **Module 4 : Centre d'Exportation Excel :**
   - Filtre par plage de dates et sélection des comptes concernés.
   - Prévisualisation dynamique des données exportables.
   - Déclenchement du téléchargement des fichiers `.xlsx`.

### Phase 3 : Modèle de Données & Backend API
1. **Modélisation de la Base de Données :**
   - Table `Requisitions` (identifiants GoCardless, statut, expiration 180j).
   - Table `Accounts` (id, requisition_id, nom, type, solde, devise).
   - Table `Transactions` (id, account_id, date, montant, marchand nettoyé, libellé brut, catégorie, projet_id).
   - Table `Categories` (id, nom, icône, couleur, règles regex).
   - Table `Projects` (id, nom, budget_cible, date_début, date_fin).
2. **Développement des API Routes / Endpoints REST :**
   - Endpoints CRUD pour les comptes, transactions, projets et catégories.
   - Pipeline de nettoyage Regex pour isoler le nom du marchand à partir du libellé brut.
   - Système de catégorisation automatique basé sur des mots-clés et règles configurables.

### Phase 4 : Agrégation Bancaire GoCardless DSP2
1. **Gestion des Identifiants & Consentement :**
   - Flux d'authentification et de redirection vers les applications bancaires.
   - Suivi de l'expiration du consentement (180 jours) avec alerte de renouvellement.
2. **Pipeline d'Aspiration Synchronisée :**
   - Tâche cron d'aspiration quotidienne des transactions et rafraîchissement des soldes.
   - Dédoublonnage robuste via identifiants uniques de transaction GoCardless (`transactionId`).

### Phase 5 : Moteur d'Exportation & Conteneurisation Docker
1. **Génération de Fichiers Excel Avancés :**
   - Création de classeurs multi-onglets (Synthèse, Transactions, Projets).
   - Injection de formules Excel dynamiques (`SOMME`, `SOMME.SI`).
2. **Conteneurisation & Configuration Self-Hosted :**
   - Rédaction du `Dockerfile` et `docker-compose.yml`.
   - Documentation du déploiement avec volume persistant pour la BDD et variables d'environnement.

---

## 3. Critères de Validation et Qualité
- **Fidélité UI/UX :** Respect strict des maquettes HTML (docs/visuals) et des spécifications (docs/infos/Projet.md).
- **Responsive & PWA :** Fonctionnement optimal sur mobile iOS/Android et sur écran large PC.
- **Composants Reutilisables :** Exploitation maximale des composants Shadcn UI personnalisés avec Tailwind CSS.
