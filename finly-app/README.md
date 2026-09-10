# Finly Frontend (Next.js 16)

Application web progressive (PWA) de Finly, concue en TypeScript avec Next.js 16 (App Router), React 19, Tailwind CSS et Shadcn UI.

---

## Prerequis

- Node.js 20+
- npm

---

## Installation et Developpement

1. Installer les dependances :
   ```bash
   npm install
   ```

2. Demarrer le serveur de developpement :
   ```bash
   npm run dev
   ```
   L'application est disponible sur `http://localhost:3000`.

3. Executer les tests unitaires :
   ```bash
   npm test
   ```

4. Executer l'analyse ESLint :
   ```bash
   npm run lint
   ```

5. Compiler pour la production :
   ```bash
   npm run build
   npm start
   ```

---

## Architecture des Dossiers

```text
finly-app/
|-- app/             # Routes Next.js App Router (dashboard, budget, depenses, admin, etc.)
|-- components/      # Composants UI (Shadcn UI, graphiques Recharts, modales, drawers)
|-- hooks/           # Hooks React personnalises (state de confidentialite, requetes)
|-- lib/             # Fonctions utilitaires, client API Fetch et generateur PDF
`-- __tests__/       # Tests unitaires Vitest et Testing Library
```

