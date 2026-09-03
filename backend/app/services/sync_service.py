import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction
from app.models.bank_connection import BankConnection
from app.models.merchant_rule import MerchantRule
from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService
from app.services.woob_service import woob_service

class SyncService:
    @staticmethod
    def _normalize_account_type(raw_type: str, label: str) -> str:
        r = (raw_type or "").lower()
        lbl = (label or "").lower()

        if "pea" in lbl or "action" in lbl or "bourse" in lbl or "titre" in lbl or "invest" in r:
            return "Investissement"
        if "vie" in lbl or "assurance" in lbl or "assurance-vie" in r:
            return "Assurance-Vie"
        if "livret" in lbl or "epargne" in lbl or "épargne" in lbl or "savings" in r or "deposit" in r:
            return "Épargne"
        if "courant" in lbl or "dépôt" in lbl or "depot" in lbl or "checking" in r or "current" in r:
            return "Compte Courant"

        return "Compte Courant"

    async def sync_all_active_accounts(
        self,
        db: Session,
        active_connections: Optional[List[BankConnection]] = None,
        user_id: Optional[str] = None,
        pre_extracted: Optional[List[Dict[str, Any]]] = None,
    ) -> Dict[str, Any]:
        """Synchronize accounts and transactions from Woob sessions into SQLite database."""
        total_synced_accounts = 0
        total_new_transactions = 0

        # 1. Determine active connections if not provided
        if active_connections is None:
            query = db.query(BankConnection)
            if user_id:
                query = query.filter((BankConnection.user_id == user_id) | (BankConnection.user_id.is_(None)))
            active_connections = query.all()

        woob_service.log(f"[Sync] Connexions bancaires detectees en base: {len(active_connections)}")

        extracted_data = pre_extracted

        # 2. If no pre-extracted data, load backends and fetch live from Woob
        if not extracted_data:
            if not active_connections:
                woob_service.log("[Sync] Aucun compte bancaire configuré.")
                return {
                    "status": "warning",
                    "message": "Aucun compte bancaire configuré",
                    "synced_accounts": 0,
                    "new_transactions": 0,
                }

            # Re-instantiate backends in Woob
            woob_service.ensure_connections_loaded(active_connections, force_reload=True)
            extracted_data = woob_service.fetch_accounts_and_transactions()

        if not extracted_data:
            woob_service.log("[Sync] Aucune donnée extraite des banques.")
            return {
                "status": "warning",
                "message": "Aucune donnée extraite",
                "synced_accounts": 0,
                "new_transactions": 0,
            }

        woob_service.log(f"[Sync] {len(extracted_data)} compte(s) aspire(s) depuis Woob.")

        # 3. Process accounts and transactions
        for acc_info in extracted_data:
            backend_name = acc_info.get("backend_name")
            acc_id = str(acc_info.get("account_id"))
            acc_label = acc_info.get("name", "Compte Bancaire")
            acc_balance = float(acc_info.get("balance", 0.0))
            acc_currency = acc_info.get("currency", "EUR")
            acc_raw_type = acc_info.get("type", "Compte Courant")
            acc_iban = acc_info.get("iban")

            # Match connection
            matching_conn = next(
                (c for c in active_connections if c.backend_name == backend_name),
                None
            )
            bank_name = matching_conn.bank_name if matching_conn else "Banque"
            conn_user_id = matching_conn.user_id if matching_conn else user_id

            # Find or create account in DB
            query = db.query(Account).filter(Account.bank_account_id == acc_id)
            if conn_user_id:
                query = query.filter(Account.user_id == conn_user_id)

            db_account = query.first()
            normalized_type = self._normalize_account_type(acc_raw_type, acc_label)

            if db_account:
                db_account.balance = acc_balance
                db_account.name = acc_label
                db_account.account_type = normalized_type
                if acc_iban:
                    db_account.iban = acc_iban
                db_account.backend_name = backend_name
                db_account.bank_name = bank_name
                db.commit()
                db.refresh(db_account)
            else:
                db_account = Account(
                    id=f"acc_{uuid.uuid4().hex[:12]}",
                    user_id=conn_user_id,
                    bank_account_id=acc_id,
                    backend_name=backend_name,
                    bank_name=bank_name,
                    name=acc_label,
                    account_type=normalized_type,
                    balance=acc_balance,
                    currency=acc_currency,
                    iban=acc_iban,
                )
                db.add(db_account)
                db.commit()
                db.refresh(db_account)

            total_synced_accounts += 1

            # 4. Insert transactions
            tx_list = acc_info.get("transactions", [])
            for tx in tx_list:
                raw_label = tx.get("raw_label", "Paiement / Virement")
                raw_amount = float(tx.get("amount", 0.0))
                booking_date = tx.get("date", datetime.utcnow().strftime("%Y-%m-%d"))

                label_hash = hashlib.md5(f"{acc_id}_{booking_date}_{raw_amount}_{raw_label.strip().upper()}".encode()).hexdigest()[:10]
                tx_key = tx.get("id") or f"{acc_id}_{label_hash}"

                tx_query = db.query(Transaction).filter(
                    (Transaction.bank_tx_id == tx_key) |
                    ((Transaction.account_id == db_account.id) & (Transaction.booking_date == booking_date) & (Transaction.amount == raw_amount) & (Transaction.raw_label == raw_label))
                )
                if conn_user_id:
                    tx_query = tx_query.filter(Transaction.user_id == conn_user_id)

                if tx_query.first():
                    continue

                cleaned_merchant = CleanerService.clean_merchant_name(raw_label)

                # Check custom user rule
                user_rule = None
                if conn_user_id:
                    user_rule = db.query(MerchantRule).filter(
                        (MerchantRule.user_id == conn_user_id) &
                        (MerchantRule.merchant_pattern == cleaned_merchant)
                    ).first()

                if user_rule:
                    category = user_rule.category
                    subcategory = user_rule.subcategory
                else:
                    category = CategorizerService.categorize(cleaned_merchant, raw_label, raw_amount)
                    subcategory = None

                try:
                    new_tx = Transaction(
                        id=f"tx_{uuid.uuid4().hex[:12]}",
                        user_id=conn_user_id,
                        bank_tx_id=tx_key,
                        account_id=db_account.id,
                        booking_date=booking_date,
                        value_date=booking_date,
                        amount=raw_amount,
                        currency=acc_currency,
                        raw_label=raw_label,
                        merchant_name=cleaned_merchant,
                        category=category,
                        subcategory=subcategory,
                    )
                    db.add(new_tx)
                    db.commit()
                    total_new_transactions += 1
                except Exception as e:
                    db.rollback()
                    woob_service.log(f"[Sync] Erreur insertion transaction: {e}")

        # Update last synced timestamp on connections
        for conn in active_connections:
            conn.last_synced_at = datetime.utcnow()
        db.commit()

        woob_service.log(f"[Sync] Termine. Comptes: {total_synced_accounts} | Nouvelles transactions: {total_new_transactions}")

        return {
            "status": "success",
            "synced_accounts": total_synced_accounts,
            "new_transactions": total_new_transactions,
        }

sync_service = SyncService()
