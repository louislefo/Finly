import re
import csv
import io
from datetime import datetime
from typing import Dict, Any, List, Optional, Tuple

from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService

class CsvParserService:
    @staticmethod
    def detect_format(raw_text: str) -> str:
        """Detect whether input is OFX/QFX, QIF, or CSV/TSV."""
        trimmed = raw_text.strip()
        upper_sample = trimmed[:1000].upper()

        if "OFXHEADER" in upper_sample or "<OFX>" in upper_sample or "<STMTTRN>" in upper_sample:
            return "ofx"

        if upper_sample.startswith("!TYPE:") or (upper_sample.startswith("D") and "\n^" in trimmed[:500]):
            return "qif"

        return "csv"

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
        s = s.replace("€", "").replace("$", "").replace("EUR", "").replace("USD", "").replace("£", "").strip()
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

        # 1. OFX compact format: YYYYMMDD or YYYYMMDDHHMMSS...
        m_ofx = re.match(r"^(\d{4})(\d{2})(\d{2})", s)
        if m_ofx and len(s) >= 8 and s[:8].isdigit():
            y, m, d = int(m_ofx.group(1)), int(m_ofx.group(2)), int(m_ofx.group(3))
            try:
                dt = datetime(y, m, d)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        # 2. DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
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

        # 3. YYYY/MM/DD or YYYY-MM-DD
        m_iso = re.match(r"^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})$", s)
        if m_iso:
            y, m, d = int(m_iso.group(1)), int(m_iso.group(2)), int(m_iso.group(3))
            try:
                dt = datetime(y, m, d)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        # 4. QIF apostrophe year: DD/MM'YY or DD/MM'YYYY
        m_qif = re.match(r"^(\d{1,2})[/\-.](\d{1,2})'(\d{2,4})$", s)
        if m_qif:
            d, m, y = int(m_qif.group(1)), int(m_qif.group(2)), int(m_qif.group(3))
            if y < 100:
                y += 2000
            try:
                dt = datetime(y, m, d)
                return dt.strftime("%Y-%m-%d")
            except Exception:
                pass

        return None

    @classmethod
    def parse_ofx(cls, raw_text: str) -> Dict[str, Any]:
        """Parse OFX / QFX (Open Financial Exchange) format."""
        # Find all transaction blocks
        trn_blocks = re.findall(r"<STMTTRN>([\s\S]*?)(?:</STMTTRN>|(?=<STMTTRN>)|(?=</BANKTRANLIST>)|$)", raw_text, re.IGNORECASE)
        
        # Also extract account metadata if present
        bank_id_m = re.search(r"<BANKID>([^<\r\n]+)", raw_text, re.IGNORECASE)
        acct_id_m = re.search(r"<ACCTID>([^<\r\n]+)", raw_text, re.IGNORECASE)
        acct_type_m = re.search(r"<ACCTTYPE>([^<\r\n]+)", raw_text, re.IGNORECASE)
        cur_m = re.search(r"<CURDEF>([^<\r\n]+)", raw_text, re.IGNORECASE)

        account_info = {
            "bank_id": bank_id_m.group(1).strip() if bank_id_m else None,
            "account_id": acct_id_m.group(1).strip() if acct_id_m else None,
            "account_type": acct_type_m.group(1).strip() if acct_type_m else "CHECKING",
            "currency": cur_m.group(1).strip() if cur_m else "EUR",
        }

        extracted_transactions = []
        for idx, block in enumerate(trn_blocks):
            if not block.strip():
                continue

            dt_m = re.search(r"<DTPOSTED>([^<\r\n]+)", block, re.IGNORECASE)
            amt_m = re.search(r"<TRNAMT>([^<\r\n]+)", block, re.IGNORECASE)
            fitid_m = re.search(r"<FITID>([^<\r\n]+)", block, re.IGNORECASE)
            name_m = re.search(r"<NAME>([^<\r\n]+)", block, re.IGNORECASE)
            memo_m = re.search(r"<MEMO>([^<\r\n]+)", block, re.IGNORECASE)
            checknum_m = re.search(r"<CHECKNUM>([^<\r\n]+)", block, re.IGNORECASE)

            parsed_date = cls.parse_date(dt_m.group(1).strip()) if dt_m else None
            parsed_amount = cls.parse_amount(amt_m.group(1).strip()) if amt_m else None

            if not parsed_date or parsed_amount is None:
                continue

            name_val = name_m.group(1).strip() if name_m else ""
            memo_val = memo_m.group(1).strip() if memo_m else ""

            if name_val and memo_val and name_val.lower() != memo_val.lower():
                raw_label = f"{name_val} {memo_val}".strip()
            elif name_val:
                raw_label = name_val
            elif memo_val:
                raw_label = memo_val
            else:
                raw_label = "Paiement / Virement OFX"

            cleaned_merchant = CleanerService.clean_merchant_name(raw_label)
            cat_res = CategorizerService.categorize(cleaned_merchant, raw_label, parsed_amount)

            extracted_transactions.append({
                "row_index": idx,
                "id": fitid_m.group(1).strip() if fitid_m else None,
                "date": parsed_date,
                "amount": parsed_amount,
                "raw_label": raw_label,
                "merchant_name": cleaned_merchant,
                "category": cat_res.category or "Divers",
                "subcategory": cat_res.subcategory,
                "category_confidence": cat_res.confidence,
                "is_low_confidence": bool(cat_res.confidence < 0.65),
                "check_number": checknum_m.group(1).strip() if checknum_m else None,
            })

        return {
            "status": "success",
            "format": "ofx",
            "has_header": True,
            "columns": ["Date", "Montant", "Libellé", "Catégorie", "ID Transaction"],
            "detected_mapping": {
                "date_col": 0,
                "amount_col": 1,
                "label_cols": [2],
                "category_col": 3,
            },
            "account_metadata": account_info,
            "total_count": len(extracted_transactions),
            "sample_transactions": extracted_transactions[:20],
            "all_transactions": extracted_transactions,
        }

    @classmethod
    def parse_qif(cls, raw_text: str) -> Dict[str, Any]:
        """Parse QIF (Quicken Interchange Format) format."""
        # Split by '^' character which marks end of entry in QIF
        entries = raw_text.split("^")
        extracted_transactions = []

        for idx, entry in enumerate(entries):
            lines = [l.strip() for l in entry.strip().splitlines() if l.strip()]
            if not lines:
                continue

            # Ignore header lines like !Type:Bank
            data_lines = [l for l in lines if not l.startswith("!")]
            if not data_lines:
                continue

            date_val = None
            amount_val = None
            payee_val = ""
            memo_val = ""
            category_val = None
            checknum_val = None

            for l in data_lines:
                code = l[0].upper()
                content = l[1:].strip()

                if code == "D":
                    date_val = cls.parse_date(content)
                elif code in ["T", "U"]:
                    amount_val = cls.parse_amount(content)
                elif code == "P":
                    payee_val = content
                elif code == "M":
                    memo_val = content
                elif code == "L":
                    category_val = content
                elif code == "N":
                    checknum_val = content

            if not date_val or amount_val is None:
                continue

            if payee_val and memo_val and payee_val.lower() != memo_val.lower():
                raw_label = f"{payee_val} {memo_val}".strip()
            elif payee_val:
                raw_label = payee_val
            elif memo_val:
                raw_label = memo_val
            else:
                raw_label = "Paiement / Virement QIF"

            cleaned_merchant = CleanerService.clean_merchant_name(raw_label)
            subcategory = None
            category_confidence = 1.0

            if not category_val or category_val.lower() in ["divers", "autre", "none", "0"]:
                cat_res = CategorizerService.categorize(cleaned_merchant, raw_label, amount_val)
                category_val = cat_res.category
                subcategory = cat_res.subcategory
                category_confidence = cat_res.confidence

            extracted_transactions.append({
                "row_index": idx,
                "date": date_val,
                "amount": amount_val,
                "raw_label": raw_label,
                "merchant_name": cleaned_merchant,
                "category": category_val or "Divers",
                "subcategory": subcategory,
                "category_confidence": category_confidence,
                "is_low_confidence": bool(category_confidence < 0.65),
                "check_number": checknum_val,
            })

        return {
            "status": "success",
            "format": "qif",
            "has_header": True,
            "columns": ["Date", "Montant", "Libellé", "Catégorie"],
            "detected_mapping": {
                "date_col": 0,
                "amount_col": 1,
                "label_cols": [2],
                "category_col": 3,
            },
            "total_count": len(extracted_transactions),
            "sample_transactions": extracted_transactions[:20],
            "all_transactions": extracted_transactions,
        }

    @classmethod
    def analyze_and_parse(
        cls,
        raw_text: str,
        custom_mapping: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Universal entrypoint: automatically detects file format (OFX, QIF, CSV) and parses."""
        if not raw_text or not raw_text.strip():
            return {
                "status": "error",
                "message": "Fichier ou contenu vide",
                "columns": [],
                "transactions": [],
                "total_count": 0,
            }

        fmt = cls.detect_format(raw_text)
        if fmt == "ofx":
            return cls.parse_ofx(raw_text)
        elif fmt == "qif":
            return cls.parse_qif(raw_text)
        else:
            return cls.analyze_and_parse_csv(raw_text, custom_mapping)

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
                "message": "Aucune ligne de transaction trouvée dans le fichier",
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
            subcategory = None
            category_confidence = 1.0
            if not parsed_category:
                cat_res = CategorizerService.categorize(cleaned_merchant, raw_label, parsed_amount)
                parsed_category = cat_res.category
                subcategory = cat_res.subcategory
                category_confidence = cat_res.confidence

            extracted_transactions.append({
                "row_index": row_idx,
                "date": parsed_date,
                "amount": parsed_amount,
                "raw_label": raw_label,
                "merchant_name": cleaned_merchant,
                "category": parsed_category or "Divers",
                "subcategory": subcategory,
                "category_confidence": category_confidence,
                "is_low_confidence": bool(category_confidence < 0.65),
            })

        return {
            "status": "success",
            "format": "csv",
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
