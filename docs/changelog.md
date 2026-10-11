# Changelog & Release History

All notable updates, new features, enhancements, and bug fixes for Finly are documented in reverse chronological order on this page.

---

## Release v1.0.26 — October 11, 2026

### New Features

- **Interactive 2FA / Strong Customer Authentication (Issue #49)**:
  - Integrated interactive challenge state machine handling PSD2 two-factor authentication during bank synchronization.
  - Added support for SMS one-time password (OTP) submission and mobile push approval polling.
  - Implemented automatic module status checking (`woob/modules/status`) and background module update routines (`woob/modules/update`).
  - Added persistent regional bank selectors for cooperative institutions (Caisse d'Épargne, Crédit Agricole, Banque Populaire) stored in connection metadata.

- **Multi-Provider AI Financial Assistant**:
  - Implemented a decoupled provider framework supporting local Ollama (`qwen2.5:3b`, `mistral:7b`, `llama3.2`) and private cloud models (OpenAI, Anthropic, Mistral AI, Groq, custom OpenAI-compatible endpoints).
  - Built an in-memory financial vector store and RAG context synthesizer that indexes accounts, budgets, loans, and recent transactions without cloud vector database persistence.
  - Added an optional local Ollama bundling selection in the Windows Inno Setup installer with clear hardware performance disclaimers.

- **Loans & Debt Amortization Tracking (Issue #43)**:
  - Implemented fixed-rate French annuity installment calculation ($$M = P \frac{r(1+r)^n}{(1+r)^n - 1}$$) with borrower insurance modeling.
  - Full amortization schedule generator from payment 1 to maturity $n$, displaying principal, interest, insurance, and remaining capital balance.
  - Early repayment simulator allowing users to model lump-sum prepayments with duration reduction versus monthly payment reduction, capped at the French legal IRA penalty threshold.
  - Dedicated "Emprunts & Dettes" tab integrated into the Wealth / Patrimoine view, synchronizing net worth ($$\text{Net Worth} = \text{Gross Assets} - \text{Total Liabilities}$$).

- **15-Month Historical Demo Dataset & Admin Maintenance**:
  - Upgraded administrative demo seeder to generate 403 realistic transactions across 15 consecutive months (October 2025 through December 2026).
  - Seeded PEA investment holdings (Amundi MSCI World ETF, Air Liquide, LVMH, Schneider Electric) and a 20-year residential mortgage.
  - Automatic startup detection and upgrade for existing installations with sparse demo data ($< 50$ transactions).
  - Added `POST /api/v1/admin/maintenance/seed-demo-data` endpoint and 1-click re-seeding card in the Admin console.

### Bug Fixes & Refinements

- Fixed an issue where background bank synchronization would fail silently when banking sessions required user OTP interaction.
- Fixed short-circuiting in demo data initialization that left returning administrator accounts without multi-month transaction histories.
- Resolved type ambiguities in client-side loan early repayment simulation forms.

---

## Release v1.0.25 — October 9, 2026

### New Features

- **Stocks & Equities Hub**:
  - Live quote tracking for French and international securities via Yahoo Finance API integration.
  - Real-time PRU (Weighted Average Purchase Price) calculation, capital gain tracking, and economic sector distribution charts.
  - Semantic asset search across Euronext Paris, Frankfurt, Amsterdam, and US exchanges.

- **Model Context Protocol (MCP) Server**:
  - Built-in MCP JSON-RPC 2.0 server allowing LLM coding assistants (Claude Desktop, Cursor) to securely query financial metrics, account lists, transactions, and budgets.

- **Deterministic Categorization Rules Engine**:
  - Custom user rules supporting `contains`, `exact`, and `regex` operators with amount threshold filters.
  - Merchant normalization engine that standardizes noisy bank statement strings into clean commercial brands.

### Bug Fixes & Refinements

- Pinned `mcp` dependency to `<2.0.0` for runtime compatibility across development environments.
- Corrected balance reconciliation logic when importing raw CSV statements with inverted debit/credit signs.

---

## Release v1.0.24 — September 28, 2026

### New Features

- **Envelope Budgeting & Cash Flow Analytics**:
  - Monthly category spending envelopes with real-time consumption rates and threshold alerts.
  - Strict deposit account filtering that isolates consumable spending from savings deposits and investment transfers.
  - Interactive Sankey cash flow visualization tracing income from source to categories and net savings.

- **Direct Woob Banking Protocol Integration**:
  - Native Python Woob driver executing scraping and banking API queries directly from the user's host machine over TLS.
  - AES-256 Fernet symmetric encryption for locally stored banking credentials.

- **Dark Mode OLED Design System & Privacy Blur**:
  - High-contrast Zinc-950 (`#09090B`) OLED interface with semi-transparent borders (`border-white/10`).
  - Global client-side privacy blur mode (`Alt + P`) obscuring balances and figures during screen sharing or public viewing.

---

## Release v1.0.0 — September 1, 2026

### Initial Release

- Initial release of Finly: local-first personal finance platform.
- SQLite database persistence with Write-Ahead Logging (WAL).
- Multi-account tracking across checking, savings, and investment accounts.
- Excel (.xlsx) and JSON encrypted export/import.
- Role-based access control with superuser bootstrapping.
