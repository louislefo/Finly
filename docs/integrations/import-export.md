# Import & Export Formats

Finly avoids vendor lock-in by providing data import and export pipelines for spreadsheets, encrypted backups, and PDF reports.

---

## 1. Universal CSV Transaction Import

For institutions not yet supported by Woob or for historical archives exported from online banking portals, Finly includes a flexible CSV import modal:

- **Delimiter Auto-Detection**: Automatically detects commas (`,`), semicolons (`;`), or tabs (`\t`).
- **Flexible Column Mapping**: Maps statement columns interactively to Finly data fields:
  - Date column (supports `DD/MM/YYYY`, `YYYY-MM-DD`, `DD.MM.YYYY`)
  - Label / Description column
  - Amount column (supports negative and positive values, or separate Debit/Credit columns)
  - Decimal format detection (handles French commas `12,50` and international dots `12.50`)
- **Automated Rule Application**: Newly imported CSV transactions are automatically processed through the Categorization Rules Engine.

---

## 2. Encrypted JSON Backup & Restore

Users can take complete snapshots of their financial environment from the **Paramètres** (`/compte`) page:

### Backup Scope

The exported JSON archive includes:
- All bank accounts and institutions (excluding raw banking passwords for security)
- Historical transaction ledger and user classification flags
- Budget envelopes and historical limits
- Project goals and real estate acquisition milestones
- Custom categorization and merchant normalization rules
- Investment holdings and stock PRU records
- Loans, credit lines, and amortization parameters

### Restoration Workflow

1. Navigate to **Paramètres** -> **Sauvegardes & Restauration**.
2. Select the exported `.json` backup file.
3. The backend imports the payload within an isolated SQLite transaction block, preserving relational integrity and re-mapping identifiers if necessary.

---

## 3. Spreadsheet Export (Excel .xlsx)

Users can export transactions and portfolio balances into multi-sheet Microsoft Excel spreadsheets:

- **Ledger Sheet**: Complete historical transactions with dates, amounts, categories, subcategories, accounts, and tags.
- **Summary Sheet**: Category breakdowns, total spending, and monthly savings rates.
- Compatible with Microsoft Excel, Apple Numbers, LibreOffice Calc, and Google Sheets.

---

## 4. PDF Budget Summary Export

Generate print-ready monthly financial reports directly in your browser:

- Built with `jsPDF`.
- Summarizes category limits, actual consumption, percentage ratios, and cash flow balance.
- Completely client-side: financial records are never transmitted to external PDF rendering web services.
