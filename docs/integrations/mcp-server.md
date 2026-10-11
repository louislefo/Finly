# Model Context Protocol (MCP)

Finly includes an embedded **Model Context Protocol (MCP)** server, allowing AI coding assistants and autonomous agents (such as Claude Desktop, Cursor, and custom agentic frameworks) to interact directly with your financial ledger.

---

## What is MCP?

The Model Context Protocol is an open standard developed by Anthropic that enables large language models to discover and invoke tools, query external databases, and execute actions in a secure, sandboxed manner.

By exposing Finly through MCP, developers can pair-program with local AI assistants that have real-time visibility into financial balances, budget progress, and investment portfolios without copy-pasting spreadsheet data.

---

## Available MCP Tools

Finly exposes the following MCP tools over standard JSON-RPC 2.0:

### 1. `get_financial_overview`
Returns high-level wealth metrics:
- Net worth ($$\text{Assets} - \text{Liabilities}$$)
- Gross asset totals (cash, savings, equities)
- Total loan liabilities
- Current month income, expenses, and savings rate

### 2. `list_accounts`
Returns a list of all bank and investment accounts:
- Account name, institution, and account type
- Settled balances and currency
- Masked IBAN and last synced timestamps

### 3. `list_transactions`
Queries the financial ledger with optional filters:
- Parameters: `limit`, `start_date`, `end_date`, `category`, `account_id`, `search_query`
- Returns booking date, merchant name, amount, category, subcategory, and budget exclusion status

### 4. `get_budget_summary`
Returns active envelope budgeting metrics:
- Parameters: `month` (e.g., `2026-10` or `last_30_days`)
- Returns category limits, actual expenses, remaining balances, and alert thresholds

### 5. `get_loans_summary`
Returns all active debts and amortizing credit lines:
- Principal amounts, interest rates, elapsed/remaining payment periods
- Remaining capital balance and monthly installments

### 6. `get_bank_sync_health`
Returns connection status for all connected banking modules:
- Connection status (`connected`, `action_needed`, `error`)
- Last successful synchronization timestamp
- Error diagnoses and interactive challenge requirements

---

## Configuration

To connect Finly to **Claude Desktop** or **Cursor**, add the following entry to your MCP configuration file (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "finly": {
      "command": "python",
      "args": [
        "-m",
        "app.mcp.server"
      ],
      "cwd": "C:\\path\\to\\Finly\\backend",
      "env": {
        "DATABASE_URL": "sqlite:///./data/finly.db",
        "SECRET_KEY": "your_secure_secret_key"
      }
    }
  }
}
```
