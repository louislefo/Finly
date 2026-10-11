# Overview & Philosophy

Finly was created to solve a fundamental problem in modern personal finance management: the surrender of sensitive banking and investment data to centralized cloud software providers.

---

## The Centralized SaaS Dilemma

Most consumer wealth-tracking applications operate on a software-as-a-service (SaaS) business model that introduces critical compromises:

1. **Third-Party Credential Exposure**: Users must provide banking credentials to intermediary financial aggregation brokers (such as Plaid, Bridge, or Budget Insight). These third parties store tokens and scrape user transaction data on external cloud clusters.
2. **Recurring Subscription Paywalls**: Features such as historical analysis, custom asset allocation, and multi-account sync are locked behind recurring monthly or annual subscription fees.
3. **Data Commercialization & Monetization**: Aggregated telemetry and anonymized spending trends are often monetized through targeted credit, mortgage, or financial product promotions.
4. **Data Lock-In**: Exporting raw historical ledger data is frequently constrained to truncated CSV files, preventing users from conducting custom SQL queries or local data science experiments.

---

## The Local-First Alternative

Finly takes an opposite architectural stance by adopting a strict local-first paradigm:

- **Direct Bank Integration**: Finly connects to banking institutions directly from your own machine using [Woob](https://woob.tech/) (Web Outside of Browsers). TLS sessions originate from your physical IP address without intermediate proxy servers.
- **Single-File Relational Storage**: All financial records, categorizations, rules, and notes are stored inside a single SQLite database (`finly.db`). You retain complete ownership of your raw financial records.
- **Local AI Inference**: The financial assistant can run entirely on your local CPU/GPU through Ollama (`qwen2.5:3b`, `mistral:7b`, `llama3.2`). Financial records never transit through public cloud model endpoints unless you explicitly configure private API keys.
- **Self-Contained Executables**: Finly can be installed as an integrated Windows desktop application or deployed inside an isolated Docker container on home servers (NAS, Raspberry Pi, Unraid).

---

## Comparison Matrix

| Dimension | Typical Cloud SaaS Aggregators | Finly |
| :--- | :--- | :--- |
| **Hosting Model** | Multi-tenant cloud servers | 100% self-hosted on user machine |
| **Data Storage** | Remote PostgreSQL/DynamoDB | Local SQLite database (`finly.db`) |
| **Bank Connection Path** | Cloud Bridge -> Bank API | User Device -> Direct Bank API |
| **Credential Encryption** | Remote Key Management Service (KMS) | Local AES-256 Fernet encryption |
| **Subscription Cost** | 10 to 25 EUR / month | Free and open source (MIT license) |
| **Telemetry & Analytics** | Segment, Mixpanel, Google Analytics | None. Zero tracking scripts |
| **Raw SQL Access** | Blocked | Complete access via any SQLite client |
| **AI Processing** | Remote cloud LLM processing | Local Ollama or optional private cloud APIs |
