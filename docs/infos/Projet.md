# Technical & Functional Specifications - Finly (PWA)

## 1. Project Overview
- **Project Name:** Personal Finance & Wealth Tracking App - Finly.
- **Application Type:** Web Application / Progressive Web App (PWA) hosted in Self-Hosted mode.
- **UI/UX Philosophy:** Mobile-First, native iOS feel (inspired by Finary, Linear, Apple), default Dark Mode, fully responsive for desktop screens.
- **Functional Scope:** Multi-account bank aggregation, daily expense tracking (Day/Month/Year), envelope budgeting, savings goals management, dynamic Excel & PDF exports.

---

## 2. Technical Stack & Core Dependencies

### A. Frontend & User Interface
- **Base Framework:** Next.js (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **UI Components:** Shadcn UI / Radix UI (accessible, composable components)
- **Icons:** Lucide React (vector icons)
- **Animations & Mobile Interactions:**
  - `framer-motion` (smooth transitions and interface animations)
  - `vaul` (iOS style Drawer / Bottom Sheet component)
- **Data Visualization:** Recharts (trend charts, area charts, donut breakdowns, and gauges)
- **Data Tables:** `@tanstack/react-table` (list management and table previews)
- **PWA:** Native manifest configuration (standalone home screen launch without browser URL bar)

### B. Backend, API & Data Processing
- **Server Environment:** FastAPI (Python 3.11+)
- **Database:** SQLite with SQLAlchemy ORM
- **Task Scheduling:** `APScheduler` for periodic background bank synchronization
- **Report Generation:** `xlsx` / `xlsx-js-style` / `openpyxl` for `.xlsx` workbooks with native formulas, and `jspdf` for PDF budget summaries

### C. Infrastructure & Self-Hosted Deployment
- **Containerization:** Docker and Docker Compose
- **Secrets Management:** Environment variables file (`.env`)

---

## 3. Bank Integration & Regulations

- **Bank Aggregation Engine:** Woob (Web Outside of Browsers)
- **Legal Context:** European PSD2 Directive compatibility
- **Synchronization Pipeline:**
  1. Fetch account balances
  2. Extract transaction history
  3. Deduplication via unique transaction identifiers
  4. Regex cleaning of raw statement labels to isolate merchant names
  5. Automatic categorization via keyword rules

---

## 4. Data Models & Entities

1. **Bank Connections:**
   - Bank module name, connection status, creation timestamp, last sync timestamp, encrypted credentials.

2. **Accounts:**
   - Unique ID, linked connection ID, account name, type (Checking, Savings, Investment, Real Estate, Loan), balance, currency.

3. **Transactions:**
   - Unique ID, linked account ID, posting date, amount, cleaned merchant, raw label, assigned category, assigned project/goal (optional).

4. **Categories & Envelopes:**
   - ID, name (Food, Transport, Housing, etc.), icon, color, monthly budget limit, keyword rules.

5. **Projects & Savings Goals:**
   - ID, project name, target budget, start date, target deadline, status, progress percentage.

---

## 5. Functional Application Modules

### Module 1: Dashboard / Net Worth Overview (Home)
- Real-time consolidated total net worth (sum across all accounts).
- Privacy Mode: One-click masking of balances and numbers without altering layout.
- Account breakdown cards and balances (Checking, Savings, Investments, Real Estate).
- Interactive historical net worth evolution chart.
- Bento summary widgets: top monthly expenses, budget status, goal progress.

### Module 2: Transaction Ledger
- Time granularity filtering: Day, Month, Year, Custom range.
- Account-specific or combined view.
- Real-time search by merchant name, raw label, or category.
- Chronological list grouped by date.
- Detailed transaction inspection in a mobile-friendly slide-over drawer / bottom sheet.

### Module 3: Envelope Budgeting & Cashflow Analysis
- Monthly spending caps per category with visual consumption gauges.
- Real-time overflow alerts.
- Cashflow breakdown comparing total income vs total expenses.
- Visual donut breakdowns and merchant analysis.

### Module 4: Savings Goals & Projects
- Target-based goal creation with target amount, deadline, and visual progress indicators.
- Milestone tracking and remaining funding computation.

### Module 5: Export Center (Excel & PDF)
- Date range filtering and account selection.
- Multi-tab Excel workbook generation with native Excel formulas (`SUM`, `SUMIF`).
- Structured monthly budget PDF reports.

---

## 6. UI/UX Directives & Design System

- **Color Palette:**
  - Base Background: `#09090B` (Zinc 950)
  - Cards and Containers: `#18181B` (Zinc 900)
  - Borders: `border-white/10` (subtle and semi-transparent)
  - State variants: Emerald green for income/positive trends, Rose/Red for expense overflows.
- **Ergonomics:**
  - Avoid centered pop-up modals on mobile; prefer slide-over sheets and bottom drawers.
  - Full-screen standalone PWA mode.
  - Micro-interactions on interactive buttons and controls.
- **Layouts:**
  - Mobile: Single scrollable column with a fixed bottom navigation bar.
  - Desktop: Sidebar navigation with a structured Bento Grid layout.