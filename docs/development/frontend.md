# Frontend Engineering

The Finly frontend is a responsive, local-first Single-Page Application (SPA) built with **Next.js 16**, **React 19**, **Tailwind CSS**, and **Shadcn UI**.

---

## Directory Layout

```
finly-app/
├── app/
│   ├── (dashboard)/            # Authenticated application route group
│   │   ├── layout.tsx          # Top navigation, sidebar, and privacy wrappers
│   │   ├── page.tsx            # Root dashboard view
│   │   ├── budget/page.tsx     # Monthly budget envelopes & Sankey cashflow
│   │   ├── patrimoine/page.tsx # Wealth balance sheet, assets & loans
│   │   ├── depenses/page.tsx   # Ledger transactions & categorization
│   │   ├── admin/page.tsx      # Admin console & maintenance tools
│   │   └── ...
│   ├── login/page.tsx          # Authentication screen
│   └── layout.tsx              # Root HTML & body definition
├── components/
│   ├── views/                  # Primary full-screen view components
│   ├── modals/                 # Interactive action dialogs
│   │   ├── woob-modal.tsx      # Bank credentials & 2FA challenge modal
│   │   ├── loan-modal.tsx      # Loan creation & edit modal
│   │   ├── loan-details-modal.tsx # Amortization table & early repayment simulator
│   │   └── ...
│   ├── assistant/              # AI Assistant chat panel & cards
│   ├── charts/                 # Recharts, Sankey diagrams, progress bars
│   └── ui/                     # Shadcn UI primitives (Button, Card, Dialog, Badge)
├── lib/
│   ├── api/
│   │   ├── finly-api.ts        # Central typed HTTP client for backend REST API
│   │   └── assistant-api.ts    # AI streaming & provider management client
│   ├── i18n/                   # Type-safe internationalization system
│   │   ├── types.ts            # Translation key interfaces
│   │   ├── dictionaries/fr.ts  # French translation dictionary
│   │   └── dictionaries/en.ts  # English translation dictionary
│   └── types/
│       └── finance.ts          # TypeScript domain interfaces
└── __tests__/                  # Vitest automated test suite
```

---

## Design System & Token Guidelines

Finly adheres to a minimalist, high-contrast Dark Mode design system inspired by Apple, Linear, and Finary:

- **Background Canvas**: Pure OLED / Zinc 950 (`#09090B`).
- **Surface Elevation**: Zinc 900 (`#18181B`) for cards, dialog sheets, and dropdown menus.
- **Borders & Dividers**: Subtle semi-transparent borders using `border-white/10`.
- **Accent Tokens**: Indigo 600 (`#4F46E5`) for primary actions, Emerald 500 (`#10B981`) for savings and positive returns, Rose 500 (`#F43F5E`) for budget overflows and liabilities.
- **Simplicity**: No verbose subtitle explanations under card headers. Direct presentation of figures, graphs, and concise controls.
- **No Filter Pills**: Filter chips and tag pills are avoided in favor of clean dropdown menus and search bars.

---

## Internationalization (i18n)

Finly provides client-side internationalization across French and English:

- **Type-Safe Dictionaries**: Defined in `lib/i18n/types.ts`. TypeScript guarantees that missing translation keys in either `fr.ts` or `en.ts` produce compile-time build errors.
- **Hook Consumption**: Views access localized text using the `useI18n()` context hook:

```tsx
import { useI18n } from "@/components/i18n-context"

export function MyComponent() {
  const { t, language } = useI18n()
  return <h2>{t.dashboard.totalWealth}</h2>
}
```

---

## Client Testing with Vitest

Finly uses **Vitest** for fast unit and component testing:

```bash
cd finly-app
npm test
```

### Production Build Verification

Verify that all pages, route segments, and TypeScript types compile cleanly:

```bash
cd finly-app
npm run build
```
