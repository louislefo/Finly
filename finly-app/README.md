# Finly Frontend (Next.js 16)

Progressive Web Application (PWA) for Finly, built with TypeScript, Next.js 16 (App Router), React 19, Tailwind CSS, and Shadcn UI.

---

## Prerequisites

- Node.js 20+
- npm

---

## Installation and Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```
   The application will be accessible at `http://localhost:3000`.

3. Run unit and integration tests:
   ```bash
   npm test
   ```

4. Run ESLint code inspection:
   ```bash
   npm run lint
   ```

5. Build and run production bundle:
   ```bash
   npm run build
   npm start
   ```

---

## Folder Architecture

```text
finly-app/
|-- app/             # Next.js App Router routes (dashboard, budget, expenses, admin, etc.)
|-- components/      # UI components (Shadcn UI, Recharts charts, modals, drawers)
|-- hooks/           # Custom React hooks (privacy state, query wrappers)
|-- lib/             # Utility functions, Fetch API client, and PDF exporter
`-- __tests__/       # Vitest and Testing Library test suite
```
