import re
import csv
import io
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService

class CsvParserService:
    @staticmethod
    def detect_delimiter(raw_text: str) -> str:
        """Detect CSV/TSV delimiter based on frequency and consistency across lines."""
        lines = [line for line in raw_text.splitlines() if line.strip()][:15]
        if not lines:
            return ";"

        # Check for tab first (common for spreadsheet copy-pastes)
        tab_counts = [line.count("\t") for line in lines]
        if tab_counts and tab_counts[0] > 0 and len(set(tab_counts)) <= 2:
            return "\t"

        delimiters = [";", "\t", ",", "|"]
        best_delim = ";"
        best_score = -1

        for delim in delimiters:
            counts = [line.count(delim) for line in lines]
            if counts and counts[0] > 0:
                avg_count = sum(counts) / len(counts)
                std_dev = sum(abs(c - avg_count) for c in counts) / len(counts)
                score = avg_count - (std_dev * 2)
                if score > best_score:
                    best_score = score
                    best_delim = delim

        return best_delim

    @staticmethod
    def parse_amount(val: Any) -> Optional[float]:
        """Parse numerical amount handling French comma, currency symbols, and signs."""
        if val is None:
            return None
        s = str(val).strip()
        if not s:
            return None

        # Remove currency symbols and non-numeric fluff
        s = s.replace("€", "").replace("$", "").replace("EUR", "").replace("USD", "").strip()
        # Remove spaces used as thousand separators (e.g. 1 250,50)
        s = s.replace("\xa0", "").replace(" ", "")

        # Check parenthesized negatives like (12.50)
        if s.startswith("(") and s.endswith(")"):
            s = f"-{s[1:-1]}"

        # Handle decimal comma vs dot
        if "," in s and "." in s:
            if s.rfind(",") > s.rfind("."):
                s = s.replace(".", "").replace(",", ".")
            else:
                s = s.replace(",", "")
        elif "," in s:
            s = s.replace(",", ".")

        try:
            return round(float(s), 2)
        except Exception:
            return None

    @staticmethod
    def parse_date(val: Any) -> Optional[str]:
        """Parse various date formats into standard YYYY-MM-DD string."""
        if not val:
            return None
        s = str(val).strip()
        if not s:
            return None

        # 1. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
        m_fr = re.match(r"^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$", s)
        if m_fr:
            d, m, y = int(m_fr.group(1)), int(m_fr.group(2)), int(m_fr.group(3))
            if y < 100:
                y += 2000
            try:
                dt = datetime(y, m, d)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        # 2. YYYY/MM/DD or YYYY-MM-DD
        m_iso = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$", s)
        if m_iso:
            y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
            try:
                dt = datetime(y, m, d)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        return None

    @classmethod
    def analyze_and_parse_csv(
        cls,
        raw_text: str,
        custom_mapping: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Analyze CSV structure, auto-detect columns, and extract normalized transactions."""
        delimiter = cls.detect_delimiter(raw_text)
        
        # Read rows
        f = io.StringIO(raw_text.strip())
        reader = csv.reader(f, delimiter=delimiter)
        raw_rows = [[cell.strip() for cell in row] for row in reader if any(cell.strip() for cell in row)]

        if not raw_rows:
            return {
                "status": "error",
                "message": "Fichier CSV vide ou illisible",
                "columns": [],
                "transactions": [],
                "total_count": 0,
            }

        max_cols = max(len(r) for r in raw_rows)
        rows = [r + [""] * (max_cols - len(r)) for r in raw_rows]

        # 1. Detect if first row is a header row
        first_row = rows[0]
        header_keywords = ["date", "montant", "amount", "libelle", "libellé", "description", "debit", "débit", "credit", "crédit", "solde", "type", "categorie", "catégorie", "tiers"]
        first_row_lower = [c.lower() for c in first_row]

        has_header = False
        if any(any(kw in cell for kw in header_keywords) for cell in first_row_lower):
            if not cls.parse_date(first_row[0]):
                has_header = True

        headers = [f"Colonne {i + 1}" for i in range(max_cols)]
        data_rows = rows
        if has_header:
            headers = [h if h else f"Colonne {i + 1}" for i, h in enumerate(first_row)]
            data_rows = rows[1:]

        if not data_rows:
            return {
                "status": "error",
                "message": "Aucune ligne de transaction trouvée dans le CSV",
                "columns": headers,
                "transactions": [],
                "total_count": 0,
            }

        # 2. Heuristic Column Type Inference
        date_col_idx = None
        amount_col_idx = None
        debit_col_idx = None
        credit_col_idx = None
        category_col_idx = None
        label_col_indices = []

        if custom_mapping:
            date_col_idx = custom_mapping.get("date_col")
            amount_col_idx = custom_mapping.get("amount_col")
            debit_col_idx = custom_mapping.get("debit_col")
            credit_col_idx = custom_mapping.get("credit_col")
            category_col_idx = custom_mapping.get("category_col")
            if custom_mapping.get("label_col") is not None:
                label_col_indices = [custom_mapping["label_col"]]
        else:
            sample_size = min(len(data_rows), 50)
            sample_rows = data_rows[:sample_size]

            date_scores = [0] * max_cols
            amount_scores = [0] * max_cols
            text_scores = [0] * max_cols

            for r in sample_rows:
                for idx, cell in enumerate(r):
                    if cls.parse_date(cell):
                        date_scores[idx] += 1
                    if cls.parse_amount(cell) is not None:
                        amount_scores[idx] += 1
                    if len(cell) > 2 and not cls.parse_date(cell) and cls.parse_amount(cell) is None:
                        text_scores[idx] += 1

            # Match by Header names first
            if has_header:
                for idx, h in enumerate(first_row_lower):
                    if any(k in h for k in ["date", "date op", "date opér", "date valeur"]) and date_col_idx is None:
                        date_col_idx = idx
                    elif "débit" in h or "debit" in h:
                        debit_col_idx = idx
                    elif "crédit" in h or "credit" in h:
                        credit_col_idx = idx
                    elif any(k in h for k in ["montant", "amount", "valeur", "somme"]) and amount_col_idx is None:
                        amount_col_idx = idx
                    elif any(k in h for k in ["catégorie", "categorie", "category"]):
                        category_col_idx = idx

            # Fallback to score inference
            if date_col_idx is None:
                max_date_score = max(date_scores)
                if max_date_score >= sample_size * 0.4:
                    date_col_idx = date_scores.index(max_date_score)

            if amount_col_idx is None and debit_col_idx is None:
                sorted_amount_indices = sorted(range(max_cols), key=lambda i: amount_scores[i], reverse=True)
                candidates = [i for i in sorted_amount_indices if i != date_col_idx and amount_scores[i] >= sample_size * 0.3]
                if candidates:
                    amount_col_idx = candidates[0]

            for idx in range(max_cols):
                if idx != date_col_idx and idx != amount_col_idx and idx != debit_col_idx and idx != credit_col_idx and idx != category_col_idx:
                    if text_scores[idx] > 0 or has_header:
                        label_col_indices.append(idx)

        if date_col_idx is None:
            date_col_idx = 0
        if amount_col_idx is None and debit_col_idx is None:
            amount_col_idx = 1 if max_cols > 1 else 0

        # 3. Extract Transactions
        extracted_transactions = []
        for row_idx, r in enumerate(data_rows):
            raw_date_val = r[date_col_idx] if date_col_idx < len(r) else ""
            parsed_date = cls.parse_date(raw_date_val)
            if not parsed_date:
                continue

            parsed_amount = 0.0
            if debit_col_idx is not None or credit_col_idx is not None:
                d_val = cls.parse_amount(r[debit_col_idx]) if debit_col_idx is not None and debit_col_idx < len(r) else None
                c_val = cls.parse_amount(r[credit_col_idx]) if credit_col_idx is not None and credit_col_idx < len(r) else None
                
                if d_val is not None and d_val != 0:
                    parsed_amount = -abs(d_val)
                elif c_val is not None:
                    parsed_amount = abs(c_val)
            elif amount_col_idx is not None and amount_col_idx < len(r):
                amt = cls.parse_amount(r[amount_col_idx])
                if amt is not None:
                    parsed_amount = amt
                else:
                    continue

            # Text candidates
            text_candidates = []
            for col_i in (label_col_indices if label_col_indices else range(len(r))):
                if col_i < len(r) and col_i != date_col_idx and col_i != amount_col_idx and col_i != debit_col_idx and col_i != credit_col_idx and col_i != category_col_idx:
                    cell_txt = r[col_i].strip()
                    if cell_txt and cell_txt != "0" and len(cell_txt) > 1 and cls.parse_amount(cell_txt) is None:
                        text_candidates.append(cell_txt)

            if text_candidates:
                longest_label = max(text_candidates, key=len)
                raw_label = longest_label
            else:
                raw_label = "Paiement / Virement"

            parsed_category = None
            if category_col_idx is not None and category_col_idx < len(r):
                cat_val = r[category_col_idx].strip()
                if cat_val and cat_val.lower() not in ["0", "divers", "autre", "none"]:
                    parsed_category = cat_val

            cleaned_merchant = CleanerService.clean_merchant_name(raw_label)
            if not parsed_category:
                parsed_category = CategorizerService.categorize(cleaned_merchant, raw_label, parsed_amount)

            extracted_transactions.append({
                "row_index": row_idx,
                "date": parsed_date,
                "amount": parsed_amount,
                "raw_label": raw_label,
                "merchant_name": cleaned_merchant,
                "category": parsed_category,
            })

        return {
            "status": "success",
            "delimiter": delimiter,
            "has_header": has_header,
            "columns": headers,
            "detected_mapping": {
                "date_col": date_col_idx,
                "amount_col": amount_col_idx,
                "debit_col": debit_col_idx,
                "credit_col": credit_col_idx,
                "label_cols": label_col_indices,
                "category_col": category_col_idx,
            },
            "total_count": len(extracted_transactions),
            "sample_transactions": extracted_transactions[:20],
            "all_transactions": extracted_transactions,
        }

csv_parser_service = CsvParserService()
