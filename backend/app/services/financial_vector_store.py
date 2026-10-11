"""
Finly Financial Hybrid RAG (Retrieval-Augmented Generation) & Knowledge Engine
Provides exhaustive factual indexing, exact merchant/category aggregation analytics,
multi-source document chunking, and semantic entity retrieval for local AI.
"""

import math
import re
import unicodedata
from collections import defaultdict
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, or_

from app.mcp.service import (
    get_net_worth_data,
    get_budget_status_data,
    get_cashflow_forecast_data,
)
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.budget import Budget
from app.models.investment import InvestmentHolding


STOP_WORDS = {
    # French stop words & query tokens
    "j", "ai", "tu", "il", "elle", "nous", "vous", "ils", "le", "la", "les", "un", "une", "des",
    "du", "de", "d", "au", "aux", "a", "à", "en", "dans", "par", "pour", "sur", "avec", "sans",
    "chez", "mon", "ma", "mes", "ton", "ta", "tes", "son", "sa", "ses", "notre", "nos", "votre", "vos", "leur", "leurs",
    "combien", "combine", "depenser", "depense", "depenses", "dépensé", "dépense", "dépenses",
    "argent", "payer", "payé", "cout", "coût", "total", "somme", "montant", "depuis", "debut", "début",
    "mois", "annee", "année", "hier", "aujourd", "hui", "est", "sont", "ete", "été", "avoir", "faire",
    "finly", "compte", "comptes", "bancaire", "bancaires",
    # English stop words & query tokens
    "i", "you", "he", "she", "we", "they", "the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "at",
    "my", "your", "his", "her", "our", "their", "how", "much", "many", "did", "spend", "spent", "spending",
    "money", "total", "sum", "amount", "since", "from", "beginning", "all", "time", "what", "is", "are",
}


def _normalize_text(text: str) -> str:
    if not text:
        return ""
    nfkd = unicodedata.normalize("NFKD", text)
    clean = "".join([c for c in nfkd if not unicodedata.combining(c)])
    clean = re.sub(r"[^A-Za-z0-9\s]", " ", clean)
    return re.sub(r"\s+", " ", clean).strip().lower()


def _extract_query_keywords(query: str) -> List[str]:
    norm = _normalize_text(query)
    words = [w for w in norm.split() if len(w) >= 2 and w not in STOP_WORDS]
    return words


class FinancialVectorStore:
    """
    Exhaustive Hybrid RAG & Knowledge Engine for Finly.
    Combines:
    1. Direct SQL Analytics & Exact Aggregations for targeted merchants / categories / timeframes.
    2. All-Time Rollups (Top 30 merchants, Category Totals, Accounts & Net Worth).
    3. Structured Semantic Chunking & BM25 Ranking.
    """

    @classmethod
    def get_targeted_merchant_or_keyword_analytics(
        cls,
        db: Session,
        query: str,
        user_id: Optional[str] = None,
    ) -> List[str]:
        """
        Scans query for merchant names or transaction keywords and computes exact factual SQL aggregations.
        """
        keywords = _extract_query_keywords(query)
        if not keywords:
            return []

        targeted_chunks: List[str] = []

        for kw in keywords:
            # Query transactions matching this keyword in merchant_name, raw_label, or category
            tx_q = db.query(Transaction)
            if user_id:
                tx_q = tx_q.filter(Transaction.user_id == user_id)

            kw_filter = or_(
                Transaction.merchant_name.ilike(f"%{kw}%"),
                Transaction.raw_label.ilike(f"%{kw}%"),
                Transaction.category.ilike(f"%{kw}%"),
            )
            matching_txs = tx_q.filter(kw_filter).order_by(desc(Transaction.booking_date)).all()

            if not matching_txs:
                continue

            expenses = [t for t in matching_txs if t.amount < 0]
            incomes = [t for t in matching_txs if t.amount > 0]

            total_spent = sum(abs(t.amount) for t in expenses)
            total_income = sum(t.amount for t in incomes)
            tx_count = len(matching_txs)
            expense_count = len(expenses)

            first_date = matching_txs[-1].booking_date if matching_txs else "N/A"
            last_date = matching_txs[0].booking_date if matching_txs else "N/A"
            avg_expense = (total_spent / expense_count) if expense_count > 0 else 0.0

            # List detailed matching transactions (up to 20)
            detail_lines = []
            for t in matching_txs[:20]:
                m_name = t.merchant_name or t.raw_label
                detail_lines.append(f"  - [{t.booking_date}] {m_name} : {t.amount:+.2f} EUR (Catégorie: {t.category or 'Divers'})")

            more_text = f"\n  - ... et {tx_count - 20} autre(s) transaction(s)" if tx_count > 20 else ""

            chunk = (
                f"=== ANALYSE EXACTE ET DÉPENSES CUMULÉES POUR '{kw.upper()}' (DEPUIS LE DÉBUT) ===\n"
                f"- Dépenses totales cumulées chez ce commerçant / mot-clé : {total_spent:.2f} EUR\n"
                f"- Nombre total d'achats / transactions : {tx_count} ({expense_count} dépenses)\n"
                f"- Dépense moyenne par achat : {avg_expense:.2f} EUR\n"
                f"- Première opération enregistrée : {first_date}\n"
                f"- Dernière opération enregistrée : {last_date}\n"
                f"- Détail des transactions correspondantes :\n"
                + "\n".join(detail_lines)
                + more_text
            )
            targeted_chunks.append(chunk)

        return targeted_chunks

    @classmethod
    def build_top_merchants_document(cls, db: Session, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Builds an exhaustive rollup of top 30 merchants by all-time cumulative expenses.
        """
        try:
            tx_q = db.query(Transaction).filter(Transaction.amount < 0)
            if user_id:
                tx_q = tx_q.filter(Transaction.user_id == user_id)
            all_expenses = tx_q.all()

            if not all_expenses:
                return None

            merchant_stats = defaultdict(lambda: {"total": 0.0, "count": 0, "last_date": ""})
            for tx in all_expenses:
                name = (tx.merchant_name or tx.raw_label or "Inconnu").strip()
                # Clean prefix/suffixes if needed
                merchant_stats[name]["total"] += abs(tx.amount)
                merchant_stats[name]["count"] += 1
                if not merchant_stats[name]["last_date"] or tx.booking_date > merchant_stats[name]["last_date"]:
                    merchant_stats[name]["last_date"] = tx.booking_date

            sorted_merchants = sorted(merchant_stats.items(), key=lambda x: x[1]["total"], reverse=True)
            top_30 = sorted_merchants[:30]

            lines = [
                f"- {m}: {data['total']:.2f} EUR ({data['count']} achats, dernier le {data['last_date']})"
                for m, data in top_30
            ]

            text = (
                "=== CLASSEMENT DES COMMERÇANTS (DÉPENSES CUMULÉES DEPUIS LE DÉBUT) ===\n"
                + "\n".join(lines)
            )

            all_keywords = ["commercant", "commerçants", "magasin", "enseigne", "marchand", "achats", "depenses"]
            for m, _ in top_30:
                all_keywords.extend(_normalize_text(m).split())

            return {
                "id": "doc_top_merchants",
                "category": "commercants_cumules",
                "text": text,
                "keywords": list(set(all_keywords)),
            }
        except Exception:
            return None

    @classmethod
    def build_category_spending_document(cls, db: Session, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """
        Builds all-time and current-year spending breakdowns by category.
        """
        try:
            tx_q = db.query(Transaction).filter(Transaction.amount < 0)
            if user_id:
                tx_q = tx_q.filter(Transaction.user_id == user_id)
            all_expenses = tx_q.all()

            if not all_expenses:
                return None

            current_year = datetime.now().strftime("%Y")
            current_month = datetime.now().strftime("%Y-%m")

            cat_all_time = defaultdict(float)
            cat_year = defaultdict(float)
            cat_month = defaultdict(float)

            for tx in all_expenses:
                c = tx.category or "Divers"
                val = abs(tx.amount)
                cat_all_time[c] += val
                if tx.booking_date and tx.booking_date.startswith(current_year):
                    cat_year[c] += val
                if tx.booking_date and tx.booking_date.startswith(current_month):
                    cat_month[c] += val

            all_time_lines = [f"- {c}: {total:.2f} EUR" for c, total in sorted(cat_all_time.items(), key=lambda x: x[1], reverse=True)]
            year_lines = [f"- {c}: {total:.2f} EUR" for c, total in sorted(cat_year.items(), key=lambda x: x[1], reverse=True)]
            month_lines = [f"- {c}: {total:.2f} EUR" for c, total in sorted(cat_month.items(), key=lambda x: x[1], reverse=True)]

            text = (
                f"=== RÉPARTITION DES DÉPENSES PAR CATÉGORIE ===\n"
                f"1. Dépenses cumulées depuis le début par catégorie :\n"
                + "\n".join(all_time_lines)
                + f"\n\n2. Dépenses de l'année en cours ({current_year}) :\n"
                + "\n".join(year_lines)
                + f"\n\n3. Dépenses du mois en cours ({current_month}) :\n"
                + "\n".join(month_lines)
            )

            keywords = ["categorie", "catégories", "alimentation", "transports", "logement", "loisirs", "courses", "restaurant"]
            for c in cat_all_time.keys():
                keywords.extend(_normalize_text(c).split())

            return {
                "id": "doc_category_spending",
                "category": "repartition_categories",
                "text": text,
                "keywords": list(set(keywords)),
            }
        except Exception:
            return None

    @classmethod
    def build_financial_context_documents(cls, db: Session, user_id: Optional[str] = None) -> List[Dict[str, Any]]:
        """
        Creates full structured semantic chunks covering the user's complete finances.
        """
        docs: List[Dict[str, Any]] = []

        # 1. Net Worth & All Accounts Document
        try:
            nw = get_net_worth_data(db, user_id=user_id)
            total_nw = nw.get("total_net_worth", 0.0)
            breakdown = nw.get("breakdown", {})
            accs = nw.get("accounts", [])

            acc_details = "\n".join([
                f"- {a.get('name', 'Compte')} [{a.get('type', 'checking')}] ({a.get('bank_name') or a.get('bank') or 'Banque'}) : {a.get('balance', 0):.2f} {a.get('currency', 'EUR')}"
                for a in accs
            ])

            nw_text = (
                f"=== PATRIMOINE TOTAL & DÉTAIL DES COMPTES BANCAIRES ===\n"
                f"Patrimoine net total : {total_nw:.2f} EUR.\n"
                f"Répartition par classe d'actifs :\n"
                f"- Comptes courants : {breakdown.get('checking', 0):.2f} EUR\n"
                f"- Livrets & Épargne liquide : {breakdown.get('savings', 0):.2f} EUR\n"
                f"- Assurance-vie : {breakdown.get('life_insurance', 0):.2f} EUR\n"
                f"- Bourse, Titres & PEA : {breakdown.get('brokerage_pea', 0):.2f} EUR\n"
                f"- Crypto-actifs : {breakdown.get('crypto', 0):.2f} EUR\n\n"
                f"Soldes individuels de chaque compte :\n{acc_details if acc_details else 'Aucun compte connecté.'}"
            )
            docs.append({
                "id": "doc_net_worth",
                "category": "patrimoine_soldes",
                "text": nw_text,
                "keywords": ["patrimoine", "solde", "compte", "comptes", "argent", "total", "banque", "boursobank", "livret", "courant", "bourse"],
            })
        except Exception:
            pass

        # 2. Top Merchants All-Time Rollup
        top_merchants_doc = cls.build_top_merchants_document(db, user_id=user_id)
        if top_merchants_doc:
            docs.append(top_merchants_doc)

        # 3. Category Spending Rollup
        cat_spending_doc = cls.build_category_spending_document(db, user_id=user_id)
        if cat_spending_doc:
            docs.append(cat_spending_doc)

        # 4. Budget & Envelopes Document
        try:
            current_month = datetime.now().strftime("%Y-%m")
            b_data = get_budget_status_data(db, user_id=user_id, month=current_month)
            total_limit = b_data.get("total_budget_limit", 0.0)
            total_spent = b_data.get("total_spent", 0.0)
            remaining = b_data.get("remaining_budget", 0.0)
            b_list = b_data.get("budgets", [])

            budgets_detail = []
            for b in b_list:
                cat = b.get("category", "")
                spent = b.get("spent", 0.0)
                lim = b.get("limit", 0.0)
                rem = b.get("remaining", 0.0)
                budgets_detail.append(f"- {cat} : dépensé {spent:.2f} EUR / plafond {lim:.2f} EUR (reste disponible : {rem:.2f} EUR)")

            budget_text = (
                f"=== BUDGET ET ENVELOPPES DU MOIS EN COURS ({current_month}) ===\n"
                f"- Plafond budgétaire total alloué : {total_limit:.2f} EUR\n"
                f"- Dépenses réelles effectuées ce mois-ci : {total_spent:.2f} EUR\n"
                f"- Reste à vivre / Budget restant disponible : {remaining:.2f} EUR\n\n"
                f"Détail par enveloppe budgétaire :\n"
                + ("\n".join(budgets_detail) if budgets_detail else "Aucun budget individuel configuré.")
            )
            docs.append({
                "id": "doc_budgets",
                "category": "budget_enveloppes",
                "text": budget_text,
                "keywords": ["budget", "reste a vivre", "depense", "limite", "enveloppe", "mois", "plafond", "economie"],
            })
        except Exception:
            pass

        # 5. Cashflow, Incomes & Subscriptions Document
        try:
            cf = get_cashflow_forecast_data(db, months_ahead=3, user_id=user_id)
            recurring = cf.get("top_recurring_merchants", [])
            rec_texts = [
                f"- {r['merchant']} : {r['estimated_monthly_cost']:.2f} EUR/mois (Catégorie: {r.get('category', 'Divers')})"
                for r in recurring
            ]

            cf_text = (
                f"=== TRÉSORERIE, REVENUS ET ABONNEMENTS RÉCURRENTS ===\n"
                f"- Solde liquide immédiatement disponible : {cf.get('current_liquid_balance', 0):.2f} EUR\n"
                f"- Moyenne mensuelle des revenus récents : {cf.get('avg_monthly_inflow', 0):.2f} EUR\n"
                f"- Moyenne mensuelle des dépenses récentes : {cf.get('avg_monthly_outflow', 0):.2f} EUR\n\n"
                f"Abonnements et prélèvements récurrents détectés :\n"
                + ("\n".join(rec_texts) if rec_texts else "Aucun abonnement détecté.")
            )
            docs.append({
                "id": "doc_cashflow_subs",
                "category": "abonnements_tresorerie",
                "text": cf_text,
                "keywords": ["abonnement", "recurrent", "charges", "netflix", "spotify", "tresorerie", "salaire", "prevision", "cashflow"],
            })
        except Exception:
            pass

        # 6. Recent Transactions Highlights Document
        try:
            tx_q = db.query(Transaction)
            if user_id:
                tx_q = tx_q.filter(Transaction.user_id == user_id)
            recent_txs = tx_q.order_by(desc(Transaction.booking_date)).limit(40).all()

            if recent_txs:
                tx_lines = [
                    f"- [{t.booking_date}] {t.merchant_name or t.raw_label} : {t.amount:+.2f} EUR ({t.category or 'Divers'})"
                    for t in recent_txs
                ]
                tx_text = (
                    "=== DERNIÈRES TRANSACTIONS ENREGISTRÉES ===\n"
                    + "\n".join(tx_lines)
                )
                docs.append({
                    "id": "doc_recent_transactions",
                    "category": "transactions_recentes",
                    "text": tx_text,
                    "keywords": ["transaction", "achat", "carte", "virement", "historique", "paiement", "dernier", "releve", "recent"],
                })
        except Exception:
            pass

        # 7. Investments & Stocks Document
        try:
            h_query = db.query(InvestmentHolding)
            if user_id:
                h_query = h_query.filter(InvestmentHolding.user_id == user_id)
            holdings = h_query.all()
            if holdings:
                h_lines = []
                for h in holdings:
                    qty = float(h.quantity or 0.0)
                    price = float(h.current_price or 0.0)
                    val = qty * price
                    h_lines.append(f"- {h.name or h.symbol} ({h.symbol}) : {qty} parts à {price:.2f} EUR = {val:.2f} EUR")

                inv_text = (
                    "=== PORTEFEUILLE BOURSE, ACTIONS ET PEA ===\n"
                    + "\n".join(h_lines)
                )
                docs.append({
                    "id": "doc_investments",
                    "category": "bourse_investissements",
                    "text": inv_text,
                    "keywords": ["bourse", "action", "etf", "pea", "titres", "portfolio", "actions", "cw8", "sp500", "cac40"],
                })
        except Exception:
            pass

        return docs

    @classmethod
    def retrieve_relevant_context(
        cls,
        query: str,
        db: Session,
        user_id: Optional[str] = None,
        top_k: int = 5,
    ) -> str:
        """
        Executes a 2-stage Hybrid RAG retrieval:
        1. Exact SQL analytics for any targeted merchant/entity in the query.
        2. Semantic BM25 scoring over multi-source financial chunks (Top merchants, categories, accounts, budgets).
        """
        context_blocks: List[str] = []

        # Stage 1: Specific targeted SQL analytics for merchants/keywords in query
        targeted_analytics = cls.get_targeted_merchant_or_keyword_analytics(db, query=query, user_id=user_id)
        if targeted_analytics:
            context_blocks.extend(targeted_analytics)

        # Stage 2: Scored multi-source semantic documents
        docs = cls.build_financial_context_documents(db, user_id=user_id)
        if docs:
            query_norm = _normalize_text(query)
            query_words = set(query_norm.split())

            scored_docs = []
            for doc in docs:
                text_norm = _normalize_text(doc["text"])
                doc_keywords = set([_normalize_text(k) for k in doc.get("keywords", [])])

                score = 0.0
                for w in query_words:
                    if len(w) <= 2:
                        continue
                    if w in doc_keywords:
                        score += 3.5
                    if w in text_norm:
                        score += 1.5

                # Boost rollups when relevant
                if "doc_top_merchants" == doc["id"] and any(k in query_norm for k in ["commercant", "depense", "combien", "achat", "chez", "magasin"]):
                    score += 4.0
                if "doc_category_spending" == doc["id"] and any(k in query_norm for k in ["categorie", "repartition", "combien", "courses", "alimentation"]):
                    score += 4.0
                if "doc_net_worth" == doc["id"] and any(k in query_norm for k in ["solde", "compte", "patrimoine", "argent", "total"]):
                    score += 3.0
                if "doc_budgets" == doc["id"] and any(k in query_norm for k in ["budget", "reste"]):
                    score += 3.0

                scored_docs.append((score, doc))

            scored_docs.sort(key=lambda x: x[0], reverse=True)
            for _, doc in scored_docs[:top_k]:
                context_blocks.append(doc["text"])

        if not context_blocks:
            return "Aucune donnée financière disponible."

        return "\n\n".join(context_blocks)
