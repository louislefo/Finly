import re
import difflib
import unicodedata
from datetime import datetime, timedelta
from typing import Optional, Set, List
from sqlalchemy.orm import Session
from app.models.transaction import Transaction
from app.services.cleaner_service import CleanerService

class ReconciliationService:
    @staticmethod
    def normalize_text(text: str) -> str:
        """Normalize text: lower, unaccent, strip extra symbols."""
        if not text:
            return ""
        # Remove accents
        text = unicodedata.normalize('NFKD', str(text)).encode('ASCII', 'ignore').decode('utf-8')
        text = text.lower()
        # Keep letters and numbers
        text = re.sub(r"[^a-z0-9\s]", " ", text)
        return " ".join(text.split())

    @classmethod
    def is_similar_title(
        cls,
        label1: str,
        label2: str,
        merchant1: Optional[str] = None,
        merchant2: Optional[str] = None,
    ) -> bool:
        """Check if two transaction labels/titles are similar enough to be the same expense."""
        if not label1 or not label2:
            return False

        norm1 = cls.normalize_text(label1)
        norm2 = cls.normalize_text(label2)

        if not norm1 or not norm2:
            return False

        # 1. Exact normalized match
        if norm1 == norm2:
            return True

        # 2. Direct Substring inclusion (one inside the other)
        if norm1 in norm2 or norm2 in norm1:
            return True

        # 3. Cleaned merchant comparison
        m1 = cls.normalize_text(merchant1 or CleanerService.clean_merchant_name(label1))
        m2 = cls.normalize_text(merchant2 or CleanerService.clean_merchant_name(label2))
        if m1 and m2:
            if m1 == m2 or m1 in m2 or m2 in m1:
                return True
            # Check ratio between merchants
            if difflib.SequenceMatcher(None, m1, m2).ratio() >= 0.70:
                return True

        # 4. Token / word overlap
        # Filter out very short generic stopwords (e.g. de, du, la, le, cb, vir)
        stopwords = {"cb", "vir", "inst", "sepa", "carte", "virement", "prlv", "prelevement", "achat", "paiement", "de", "du", "la", "le", "et", "en", "les", "des", "pour", "par"}
        words1 = {w for w in norm1.split() if len(w) >= 2 and w not in stopwords}
        words2 = {w for w in norm2.split() if len(w) >= 2 and w not in stopwords}

        if words1 and words2:
            intersection = words1.intersection(words2)
            # If at least one significant word matches (or 50% overlap)
            if len(intersection) >= max(1, min(len(words1), len(words2)) * 0.5):
                return True

        # 5. SequenceMatcher fuzzy similarity ratio
        ratio = difflib.SequenceMatcher(None, norm1, norm2).ratio()
        return ratio >= 0.60

    @classmethod
    def find_matching_transaction(
        cls,
        db: Session,
        user_id: str,
        account_id: str,
        booking_date: str,
        amount: float,
        raw_label: str,
        merchant_name: Optional[str] = None,
        bank_tx_id: Optional[str] = None,
        exclude_tx_ids: Optional[Set[str]] = None,
    ) -> Optional[Transaction]:
        """Find an existing transaction on the account that matches same amount, date (or near date) and similar title."""
        if exclude_tx_ids is None:
            exclude_tx_ids = set()

        rounded_amount = round(amount, 2)

        # 1. Exact Bank Tx ID match
        if bank_tx_id:
            tx = db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.account_id == account_id,
                Transaction.bank_tx_id == bank_tx_id
            ).first()
            if tx and tx.id not in exclude_tx_ids:
                return tx

        # 2. Exact (Date + Amount + Raw Label) match
        tx_exact = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.account_id == account_id,
            Transaction.booking_date == booking_date,
            Transaction.amount == rounded_amount,
            Transaction.raw_label == raw_label
        ).first()
        if tx_exact and tx_exact.id not in exclude_tx_ids:
            return tx_exact

        # 3. Same Day + Same Amount -> check title similarity
        candidates_same_day = db.query(Transaction).filter(
            Transaction.user_id == user_id,
            Transaction.account_id == account_id,
            Transaction.booking_date == booking_date,
            Transaction.amount == rounded_amount
        ).all()

        for c in candidates_same_day:
            if c.id in exclude_tx_ids:
                continue
            if cls.is_similar_title(raw_label, c.raw_label or "", merchant_name, c.merchant_name):
                return c

        # 4. Date shifted (+/- 2 days) + Same Amount -> stricter title similarity
        try:
            dt = datetime.strptime(booking_date[:10], "%Y-%m-%d")
            min_date = (dt - timedelta(days=2)).strftime("%Y-%m-%d")
            max_date = (dt + timedelta(days=2)).strftime("%Y-%m-%d")

            candidates_near_days = db.query(Transaction).filter(
                Transaction.user_id == user_id,
                Transaction.account_id == account_id,
                Transaction.booking_date >= min_date,
                Transaction.booking_date <= max_date,
                Transaction.amount == rounded_amount
            ).all()

            for c in candidates_near_days:
                if c.id in exclude_tx_ids:
                    continue
                if cls.is_similar_title(raw_label, c.raw_label or "", merchant_name, c.merchant_name):
                    return c
        except Exception:
            pass

        return None
