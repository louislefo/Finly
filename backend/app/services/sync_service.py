import uuid
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session

from app.models.account import Account
from app.models.transaction import Transaction
from app.models.bank_connection import BankConnection
from app.models.merchant_rule import MerchantRule
from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService
from app.services.reconciliation_service import ReconciliationService
from app.services.woob_service import woob_service

def _parse_date(date_val: Any) -> Optional[datetime]:
    if isinstance(date_val, datetime):
        return date_val
    if isinstance(date_val, str):
        try:
            return datetime.strptime(date_val[:10], "%Y-%m-%d")
        except Exception:
            pass
    return None

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
        """Synchronize accounts and transactions from Woob sessions into database with smart reconciliation."""
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

            # 4. Reconcile & insert transactions
            tx_list = acc_info.get("transactions", [])
            matched_db_tx_ids = set()
            incoming_coming_hashes = set()

            for tx in tx_list:
                raw_label = str(tx.get("raw_label") or "Paiement / Virement").strip()
                raw_amount = round(float(tx.get("amount", 0.0)), 2)
                booking_date_str = str(tx.get("date") or datetime.utcnow().strftime("%Y-%m-%d"))[:10]
                status = tx.get("status", "confirmed")
                value_date = tx.get("value_date") or booking_date_str

                incoming_date = _parse_date(booking_date_str) or datetime.utcnow()

                # Calculate deterministic label hash
                label_hash = hashlib.md5(f"{acc_id}_{booking_date_str}_{raw_amount}_{raw_label.upper()}".encode()).hexdigest()[:10]
                bank_provided_id = tx.get("id")
                tx_key = bank_provided_id or f"{acc_id}_{label_hash}"

                if status == "pending" or "_coming" in str(tx_key):
                    incoming_coming_hashes.add(tx_key)

                existing_tx = None

                # Priority 1: Match by explicit bank_tx_id
                if bank_provided_id:
                    tx_query = db.query(Transaction).filter(
                        Transaction.account_id == db_account.id,
                        Transaction.bank_tx_id == bank_provided_id
                    )
                    if conn_user_id:
                        tx_query = tx_query.filter(Transaction.user_id == conn_user_id)
                    candidate = tx_query.first()
                    if candidate and candidate.id not in matched_db_tx_ids:
                        existing_tx = candidate

                # Priority 2: Match by exact date, amount and raw_label
                if not existing_tx:
                    tx_query = db.query(Transaction).filter(
                        Transaction.account_id == db_account.id,
                        Transaction.booking_date == booking_date_str,
                        Transaction.amount == raw_amount,
                        Transaction.raw_label == raw_label
                    )
                    if conn_user_id:
                        tx_query = tx_query.filter(Transaction.user_id == conn_user_id)
                    for candidate in tx_query.all():
                        if candidate.id not in matched_db_tx_ids:
                            existing_tx = candidate
                            break

                # Priority 3: Smart Reconciliation (Changed label or +/- 2 days date shift)
                if not existing_tx:
                    min_date = (incoming_date - timedelta(days=2)).strftime("%Y-%m-%d")
                    max_date = (incoming_date + timedelta(days=2)).strftime("%Y-%m-%d")

                    tx_query = db.query(Transaction).filter(
                        Transaction.account_id == db_account.id,
                        Transaction.booking_date >= min_date,
                        Transaction.booking_date <= max_date,
                        Transaction.amount == raw_amount
                    )
                    if conn_user_id:
                        tx_query = tx_query.filter(Transaction.user_id == conn_user_id)

                    candidates = [c for c in tx_query.all() if c.id not in matched_db_tx_ids]

                    if candidates:
                        def candidate_rank(c: Transaction):
                            c_date = _parse_date(c.booking_date) or incoming_date
                            day_diff = abs((c_date - incoming_date).days)
                            similar_title = 0 if ReconciliationService.is_similar_title(raw_label, c.raw_label or "", merchant_name, c.merchant_name) else 1
                            is_pending = 0 if (getattr(c, "status", "confirmed") == "pending" or "_coming" in str(c.bank_tx_id or "")) else 1
                            has_gen_key = 0 if (c.bank_tx_id and c.bank_tx_id.startswith(f"{acc_id}_")) else 1
                            return (similar_title, is_pending, day_diff, has_gen_key)

                        candidates.sort(key=candidate_rank)
                        existing_tx = candidates[0]

                # If existing transaction matched, reconcile and update
                if existing_tx:
                    matched_db_tx_ids.add(existing_tx.id)
                    is_modified = False

                    if existing_tx.raw_label != raw_label:
                        existing_tx.raw_label = raw_label
                        is_modified = True

                    if existing_tx.booking_date != booking_date_str:
                        existing_tx.booking_date = booking_date_str
                        is_modified = True

                    if value_date and existing_tx.value_date != value_date:
                        existing_tx.value_date = value_date
                        is_modified = True

                    if getattr(existing_tx, "status", None) != status:
                        existing_tx.status = status
                        is_modified = True

                    if bank_provided_id and existing_tx.bank_tx_id != bank_provided_id:
                        existing_tx.bank_tx_id = bank_provided_id
                        is_modified = True

                    # Re-clean merchant & re-categorize only if not user-classified
                    if not existing_tx.is_user_classified:
                        cleaned_merchant = CleanerService.clean_merchant_name(raw_label)
                        existing_tx.merchant_name = cleaned_merchant

                        user_rule = None
                        if conn_user_id:
                            user_rule = db.query(MerchantRule).filter(
                                (MerchantRule.user_id == conn_user_id) &
                                (MerchantRule.merchant_pattern == cleaned_merchant)
                            ).first()

                        if user_rule:
                            existing_tx.category = user_rule.category
                            existing_tx.subcategory = user_rule.subcategory
                            if user_rule.logo_url:
                                existing_tx.logo_url = user_rule.logo_url
                        else:
                            existing_tx.category = CategorizerService.categorize(cleaned_merchant, raw_label, raw_amount)
                            existing_tx.subcategory = None
                        is_modified = True

                    if is_modified:
                        try:
                            db.commit()
                        except Exception as e:
                            db.rollback()
                            woob_service.log(f"[Sync] Erreur mise a jour transaction: {e}")

                    continue

                # Priority 4: Truly new transaction, insert into DB
                cleaned_merchant = CleanerService.clean_merchant_name(raw_label)

                user_rule = None
                if conn_user_id:
                    user_rule = db.query(MerchantRule).filter(
                        (MerchantRule.user_id == conn_user_id) &
                        (MerchantRule.merchant_pattern == cleaned_merchant)
                    ).first()

                logo_url = None
                if user_rule:
                    category = user_rule.category
                    subcategory = user_rule.subcategory
                    logo_url = user_rule.logo_url
                else:
                    category = CategorizerService.categorize(cleaned_merchant, raw_label, raw_amount)
                    subcategory = None

                try:
                    new_tx = Transaction(
                        id=f"tx_{uuid.uuid4().hex[:12]}",
                        user_id=conn_user_id,
                        bank_tx_id=tx_key,
                        account_id=db_account.id,
                        booking_date=booking_date_str,
                        value_date=value_date,
                        amount=raw_amount,
                        currency=acc_currency,
                        raw_label=raw_label,
                        merchant_name=cleaned_merchant,
                        category=category,
                        subcategory=subcategory,
                        status=status,
                        logo_url=logo_url,
                    )
                    db.add(new_tx)
                    db.commit()
                    matched_db_tx_ids.add(new_tx.id)
                    total_new_transactions += 1
                except Exception as e:
                    db.rollback()
                    woob_service.log(f"[Sync] Erreur insertion transaction: {e}")

            # 5. Clean up stale pending transactions
            try:
                stale_pending = db.query(Transaction).filter(
                    Transaction.account_id == db_account.id,
                    Transaction.status == "pending"
                )
                if conn_user_id:
                    stale_pending = stale_pending.filter(Transaction.user_id == conn_user_id)

                for pending_tx in stale_pending.all():
                    if pending_tx.id not in matched_db_tx_ids:
                        if pending_tx.bank_tx_id not in incoming_coming_hashes:
                            db.delete(pending_tx)
                db.commit()
            except Exception as e:
                db.rollback()
                woob_service.log(f"[Sync] Erreur nettoyage transactions pending: {e}")

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
