# Action Plan - Finly Project (Personal Finance PWA)

This document outlines the overall roadmap and technical execution plan for the Finly application.

---

## 1. Global Architecture and Technical Vision

- **Frontend:** Next.js 16 (App Router, TypeScript), Tailwind CSS, Shadcn UI, Lucide Icons, Framer Motion, Vaul (iOS-style Drawer).
- **Backend & API:** FastAPI (Python 3.11+), SQLAlchemy ORM, Pydantic v2.
- **Database:** SQLite (embedded local file with zero-configuration persistence).
- **Bank Aggregation:** Woob (direct banking connectors with background APScheduler tasks).
- **Export Engine:** Advanced Excel generator producing multi-tab `.xlsx` workbooks with native formulas, and PDF budget summaries.
- **Deployment:** Self-hosted via Docker Compose.

---

## 2. Execution Roadmap

### Phase 1: Design System & Front-End Layout
1. **Dark Theme Configuration:**
   - Zinc 950 (`#09090B`) background, Zinc 900 (`#18181B`) surfaces, subtle semi-transparent borders (`white/10`).
   - Integration of Shadcn UI components (Card, Sheet/Drawer, Dialog, Tabs, Select, Table, Badge, Button, Input, Progress, Skeleton).
2. **Adaptive Multi-Platform Navigation:**
   - Desktop / Tablet: Collapsible sidebar and 12-column Bento Grid layout.
   - Mobile: Fixed bottom bar navigation with glassmorphism styling and swipeable containers.
3. **Privacy Masking Mode:**
   - Global React state / context to mask balances and transaction amounts without causing typographic layout shifts.

### Phase 2: Front-End Feature Modules
1. **Module 1: Dashboard (Overview):**
   - Consolidated total net worth card with historical performance indicators.
   - Connected accounts carousel / card grid with individual balances.
   - Interactive financial trajectory charts.
   - Bento widgets for monthly spending highlights and goal milestones.
2. **Module 2: Transaction Ledger:**
   - Granular time filters: Day, Month, Year, Custom Range.
   - Account-based filtering and instant search by merchant or category.
   - Chronological list grouped by date with category badges and icons.
   - Detailed transaction sheet drawer with edit capability.
3. **Module 3: Envelope Budgeting & Cashflow:**
   - Category budget cards with real-time visual progress gauges and overflow warnings.
   - Cashflow analysis comparing income versus expense streams.
4. **Module 4: Savings Goals & Projects:**
   - Target savings cards (Emergency Fund, Vacations, Down Payment).
   - Visual progress gauges and remaining funding calculations.
5. **Module 5: Export Center:**
   - Multi-tab Excel file export with native formulas (`SUM`, `SUMIF`).
   - Formatted PDF monthly budget summary exports.

### Phase 3: Data Model & Backend API
1. **Database Schema:**
   - `connections` (bank module, status, encrypted credentials).
   - `accounts` (id, connection_id, name, type, balance, currency).
   - `transactions` (id, account_id, date, amount, cleaned_merchant, raw_label, category_id, goal_id).
   - `categories` (id, name, icon, color, monthly_budget, regex_rules).
   - `goals` (id, name, target_amount, current_amount, start_date, target_date).
2. **REST API Endpoints:**
   - CRUD endpoints for accounts, transactions, budgets, goals, and categories.
   - Label cleaning pipeline to isolate merchant names.
   - Keyword-based auto-categorization engine.

### Phase 4: Bank Aggregation with Woob
1. **Credential & Connection Management:**
   - Secure credential entry and symmetric encryption (AES-256 Fernet).
2. **Automated Synchronization Pipeline:**
   - Background APScheduler job for periodic transaction pulling and balance refreshment.
   - Robust deduplication via unique transaction identifiers.

### Phase 5: Export Engine & Docker Containerization
1. **Advanced File Generation:**
   - Multi-tab Excel workbook generation with embedded spreadsheet formulas.
   - PDF summary reports.
2. **Dockerization & Self-Hosted Packaging:**
   - Production Dockerfiles for backend and frontend.
   - `docker-compose.yml` for unified single-command deployment.

---

## 3. Quality and Validation Criteria
- **UI/UX Fidelity:** Strict adherence to design specifications (Zinc dark mode, Bento Grid layout, zero clutter).
- **Responsive & Mobile-First:** Flawless experience on mobile browsers / PWA and wide desktop displays.
- **Code Quality:** Type safety across TypeScript and Python, with full test suite coverage.
