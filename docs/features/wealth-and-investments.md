# Wealth & Portfolio Tracking

The **Patrimoine** (Wealth) module provides an aggregated balance sheet of personal net worth, combining liquid cash, savings, stock portfolios, real estate goals, and debt liabilities.

---

## Net Worth Equation

Finly continuously computes personal net worth according to standard accounting principles:

$$\text{Net Worth} = \text{Gross Assets} - \text{Total Liabilities}$$

### Asset Categories (Gross Assets)

1. **Liquid Checking Accounts**: Settled cash in demand deposit accounts.
2. **Protected Savings Accounts**: Guaranteed deposits in Livret A, LDDS, LEP, and term deposit accounts.
3. **Equities & Investment Portfolios**: Market value of PEA, Compte-Titres (CTO), and retirement accounts.
4. **Real Estate & Asset Goals**: Current accumulated savings or estimated property values from Project goals.
5. **Cryptocurrency & Foreign Exchange**: Digital assets and foreign currency cash balances.

### Liability Categories (Total Liabilities)

1. **Mortgages**: Outstanding principal capital on real estate loans.
2. **Personal & Auto Loans**: Remaining unpaid debt balances.
3. **Student & Consumer Debt**: Short and long-term amortizing credit lines.

---

## Equities & Stock Portfolio Hub

Finly tracks stock holdings, exchange-traded funds (ETFs), and mutual funds within brokerage and PEA accounts:

| Metric | Computation Formula | Description |
| :--- | :--- | :--- |
| **Position Market Value** | $\text{Market Value} = \text{Quantity} \times \text{Current Price}$ | Real-time valuation of the held position. |
| **Cost Basis (PRU)** | $\text{Cost Basis} = \text{Quantity} \times \text{Average Purchase Price}$ | Total invested capital in the holding. |
| **Capital Gain / Loss** | $\Delta = \text{Market Value} - \text{Cost Basis}$ | Absolute gain or loss in Euros. |
| **Performance (%)** | $\text{Return} = \frac{\text{Current Price} - \text{Average Purchase Price}}{\text{Average Purchase Price}} \times 100\%$ | Percentage return on invested capital. |

### Live Market Price Updates

Finly fetches delayed live market prices and quotes via open financial market interfaces (such as Yahoo Finance):

- European equities (`.PA` ticker suffix for Euronext Paris, `.DE` for Frankfurt, `.AS` for Amsterdam).
- Global index ETFs (e.g., `CW8.PA`, `EWLD.PA`, `S&P 500`).
- US equities and international securities.

---

## Real Estate & Savings Projects

Users can track capital targets and asset milestones in the **Projets** view:

- **Savings Projects**: Emergency funds, travel budgets, car purchases with monthly contribution tracking and target deadlines.
- **Real Estate Acquisition Projects**: Track property targets, address, surface area in square meters, notary fees, down payments, and linked financing accounts.
