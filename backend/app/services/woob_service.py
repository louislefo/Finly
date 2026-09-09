import os
import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from woob.core import Woob
from woob.capabilities.bank import CapBank
from woob.exceptions import (
    BrowserIncorrectPassword,
    AppValidation,
    DecoupledValidation,
    NeedInteractive,
    NeedInteractiveFor2FA,
    BrowserQuestion,
    OTPQuestion,
    SentOTPQuestion,
    ActionNeeded,
    BrowserUnavailable,
    ScrapingBlocked,
    BrowserForbidden,
    NoAccountsException,
)

class WoobService:
    SUPPORTED_MODULES = [
        {"id": "bourso", "name": "BoursoBank", "color": "from-pink-600 to-rose-600", "logo": "B"},
        {"id": "bnporc", "name": "BNP Paribas", "color": "from-emerald-600 to-teal-600", "logo": "BNP"},
        {"id": "fortuneo", "name": "Fortuneo", "color": "from-emerald-500 to-teal-700", "logo": "F"},
        {"id": "cragr", "name": "Crédit Agricole", "color": "from-green-600 to-emerald-700", "logo": "CA"},
        {"id": "sg", "name": "Société Générale", "color": "from-[#18181B] to-[#201f22]", "logo": "SG"},
        {"id": "n26", "name": "N26 Bank", "color": "from-teal-600 to-cyan-600", "logo": "N26"},
        {"id": "creditmutuel", "name": "Crédit Mutuel", "color": "from-red-600 to-rose-700", "logo": "CM"},
        {"id": "cic", "name": "CIC", "color": "from-blue-700 to-cyan-700", "logo": "CIC"},
        {"id": "bp", "name": "Banque Populaire", "color": "from-cyan-600 to-blue-800", "logo": "BP"},
        {"id": "ce", "name": "Caisse d'Épargne", "color": "from-rose-600 to-red-800", "logo": "CE"},
        {"id": "hellobank", "name": "Hello bank!", "color": "from-teal-500 to-emerald-600", "logo": "HB"},
        {"id": "lcl", "name": "LCL", "color": "from-yellow-600 to-amber-700", "logo": "LCL"},
        {"id": "labanquepostale", "name": "La Banque Postale", "color": "from-blue-600 to-indigo-700", "logo": "LBP"},
        {"id": "bforbank", "name": "BforBank", "color": "from-blue-800 to-cyan-800", "logo": "BFB"},
        {"id": "monabanq", "name": "Monabanq", "color": "from-orange-600 to-amber-700", "logo": "MONA"},
        {"id": "shine", "name": "Shine", "color": "from-yellow-500 to-amber-600", "logo": "SHINE"},
        {"id": "qonto", "name": "Qonto", "color": "from-purple-600 to-indigo-700", "logo": "QON"},
    ]

    def __init__(self):
        self.woob_dir = os.path.join(os.getcwd(), "woob_data")
        os.makedirs(self.woob_dir, exist_ok=True)
        self._woob: Optional[Woob] = None
        self.latest_logs: List[str] = []

    def log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted = f"[{timestamp}] [WOOB] {message}"
        self.latest_logs.append(formatted)
        if len(self.latest_logs) > 50:
            self.latest_logs.pop(0)
        print(formatted, flush=True)

    def _get_woob_instance(self) -> Woob:
        if self._woob is None:
            self.log(f"Initialisation Woob (workdir: {self.woob_dir})")
            self._woob = Woob(workdir=self.woob_dir)
            try:
                # S'assurer que les depots officiels sont souscrits
                if hasattr(self._woob.repositories, "subscribe_source"):
                    try:
                        self._woob.repositories.subscribe_source("https://updates.woob.tech/3/main/")
                    except Exception:
                        pass
                self._woob.repositories.update()
            except Exception as e:
                self.log(f"Note mise a jour depots: {e}")
        return self._woob

    def get_supported_banks(self) -> List[Dict[str, Any]]:
        return self.SUPPORTED_MODULES

    def setup_backend(
        self,
        module_name: str,
        login: str,
        password: str,
        backend_name: Optional[str] = None,
        custom_params: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """Test and establish connection to a bank module using official certified Woob modules."""
        w = self._get_woob_instance()

        if not backend_name:
            backend_name = f"{module_name}_{uuid.uuid4().hex[:8]}"

        self.log(f"Connexion au module {module_name} (login: {login[:3]}***)")

        # Ensure the official module is loaded securely
        try:
            if not w.modules_loader.module_exists(module_name):
                self.log(f"Module {module_name} absent en local. Recherche dans le depot officiel Woob...")
                minfo = w.repositories.get_module_info(module_name)
                if not minfo:
                    w.repositories.update()
                    minfo = w.repositories.get_module_info(module_name)
                if minfo:
                    self.log(f"Installation du module certifie {module_name} (v{getattr(minfo, 'version', 'latest')})...")
                    w.repositories.install(minfo)
                    w.modules_loader.load_module(module_name)
        except Exception as e:
            self.log(f"Note installation module {module_name}: {e}")

        params = {
            "login": login,
            "password": password,
        }
        if custom_params:
            params.update(custom_params)

        try:
            # 1. Build backend instance
            self.log(f"Construction du backend {backend_name}...")
            # Remove any previous backend instance with the same name
            w.backend_instances.pop(backend_name, None)
            backend = w.build_backend(module_name, params, name=backend_name)
            w.backend_instances[backend_name] = backend

            # 2. Extract accounts and transactions directly
            self.log(f"Authentification aupres de {module_name}...")
            accounts_list = list(backend.iter_accounts())
            self.log(f"Authentification reussie: {len(accounts_list)} compte(s) trouve(s).")

            # Extract full data structure
            extracted_accounts = []
            for account in accounts_list:
                acc_id = str(account.id)
                acc_label = str(account.label or "Compte")
                acc_balance = float(account.balance or 0.0)
                acc_currency = str(account.currency or "EUR")
                acc_iban = str(account.iban) if getattr(account, "iban", None) else None
                acc_type = str(account.type) if getattr(account, "type", None) else "Compte Courant"

                self.log(f"-> Compte extrait: {acc_label} | Solde: {acc_balance} {acc_currency}")

                transactions_list = []
                try:
                    for history_tx in backend.iter_history(account):
                        tx_amount = float(history_tx.amount or 0.0)
                        tx_raw_label = str(history_tx.raw or history_tx.label or "Transaction")
                        tx_date = history_tx.date.strftime("%Y-%m-%d") if history_tx.date else datetime.utcnow().strftime("%Y-%m-%d")
                        tx_id = str(history_tx.id) if getattr(history_tx, "id", None) else f"{acc_id}_{tx_date}_{tx_amount}"

                        transactions_list.append({
                            "id": tx_id,
                            "date": tx_date,
                            "amount": tx_amount,
                            "raw_label": tx_raw_label,
                            "currency": acc_currency,
                            "status": "confirmed",
                        })
                except Exception as tx_err:
                    self.log(f"-> Info transactions {acc_label}: {tx_err}")

                extracted_accounts.append({
                    "backend_name": backend_name,
                    "module": module_name,
                    "account_id": acc_id,
                    "name": acc_label,
                    "iban": acc_iban,
                    "balance": acc_balance,
                    "currency": acc_currency,
                    "type": acc_type,
                    "transactions": transactions_list,
                })

            return {
                "status": "connected",
                "backend_name": backend_name,
                "module": module_name,
                "accounts_count": len(accounts_list),
                "extracted_data": extracted_accounts,
            }

        except BrowserIncorrectPassword:
            self.log(f"ERREUR: Identifiant ou mot de passe incorrect pour {module_name}.")
            raise Exception("Identifiant ou mot de passe bancaire incorrect.")

        except (AppValidation, DecoupledValidation, NeedInteractive, NeedInteractiveFor2FA, BrowserQuestion, OTPQuestion, SentOTPQuestion, ActionNeeded) as auth_err:
            msg = str(auth_err) or "Validation requise sur l'application mobile de votre banque."
            self.log(f"2FA / VALIDATION MOBILE: {msg}")
            return {
                "status": "2fa_required",
                "backend_name": backend_name,
                "module": module_name,
                "message": msg,
            }

        except (BrowserUnavailable, ScrapingBlocked, BrowserForbidden) as sec_err:
            self.log(f"ERREUR ACCES: {sec_err}")
            raise Exception(f"Acces refuse ou service bancaire indisponible: {sec_err}")

        except NoAccountsException:
            self.log(f"Aucun compte bancaire trouve pour {module_name}.")
            return {
                "status": "connected",
                "backend_name": backend_name,
                "module": module_name,
                "accounts_count": 0,
                "extracted_data": [],
            }

        except Exception as e:
            error_str = str(e)
            self.log(f"EXCEPTION: {error_str}")
            if any(k in error_str.lower() for k in ["2fa", "sca", "otp", "interactive", "validation", "app", "mobile"]):
                return {
                    "status": "2fa_required",
                    "backend_name": backend_name,
                    "module": module_name,
                    "message": "Validation requise sur votre application mobile bancaire.",
                }
            raise Exception(f"Erreur de connexion bancaire: {error_str}")

    def ensure_connections_loaded(self, connections: list, force_reload: bool = True):
        """Re-instantiate backends from SQLite connections with AES-256 decrypted passwords."""
        from app.core.security import decrypt_bank_password
        w = self._get_woob_instance()

        for conn in connections:
            if not conn.login:
                self.log(f"Connexion {conn.bank_name} ({conn.module_name}) ignoree: identifiant manquant.")
                continue

            if not conn.password:
                self.log(f"Connexion {conn.bank_name} ({conn.module_name}) ignoree: mot de passe non renseigne en base (reconnexion requise via l'interface).")
                continue

            decrypted_pwd = decrypt_bank_password(conn.password)
            if not decrypted_pwd:
                self.log(f"Mot de passe non dechiffrable pour {conn.bank_name}. Reconnexion requise via l'interface.")
                continue

            # Ensure official module is installed and loaded
            try:
                if not w.modules_loader.module_exists(conn.module_name):
                    self.log(f"Module {conn.module_name} absent en local. Recherche dans le depot officiel Woob...")
                    minfo = w.repositories.get_module_info(conn.module_name)
                    if not minfo:
                        w.repositories.update()
                        minfo = w.repositories.get_module_info(conn.module_name)
                    if minfo:
                        self.log(f"Installation du module certifie {conn.module_name}...")
                        w.repositories.install(minfo)
                    w.modules_loader.load_module(conn.module_name)
            except Exception as mod_err:
                self.log(f"Note chargement module {conn.module_name}: {mod_err}")

            # Remove previous backend instance if present
            w.backend_instances.pop(conn.backend_name, None)

            try:
                self.log(f"Reconnexion & rafraichissement de session pour {conn.bank_name} ({conn.module_name})...")
                params = {
                    "login": conn.login,
                    "password": str(decrypted_pwd),
                }
                backend = w.build_backend(conn.module_name, params, name=conn.backend_name)
                w.backend_instances[conn.backend_name] = backend
            except Exception as e:
                self.log(f"Note chargement backend {conn.backend_name}: {e}")

    def fetch_accounts_and_transactions(self) -> List[Dict[str, Any]]:
        import hashlib
        w = self._get_woob_instance()
        results = []

        backends = list(w.backend_instances.values())
        self.log(f"Aspiration des comptes sur {len(backends)} backend(s) actif(s)...")

        for backend in backends:
            if not backend.has_caps(CapBank):
                continue

            self.log(f"Interrogation du backend: {backend.name} ({backend.NAME})")

            try:
                for account in backend.iter_accounts():
                    acc_id = str(account.id)
                    acc_label = str(account.label or "Compte")
                    acc_balance = float(account.balance or 0.0)
                    acc_currency = str(account.currency or "EUR")
                    acc_iban = str(account.iban) if getattr(account, "iban", None) else None
                    acc_type = str(account.type) if getattr(account, "type", None) else "Compte Courant"

                    self.log(f"-> Compte: {acc_label} | Solde: {acc_balance} {acc_currency}")

                    # Fetch history
                    transactions_list = []
                    seen_tx_ids = set()

                    # 1. Past transactions (History)
                    try:
                        for history_tx in backend.iter_history(account):
                            tx_amount = float(history_tx.amount or 0.0)
                            tx_raw_label = str(history_tx.raw or history_tx.label or "Transaction")
                            tx_date = history_tx.date.strftime("%Y-%m-%d") if history_tx.date else datetime.utcnow().strftime("%Y-%m-%d")

                            # Deterministic stable ID
                            label_hash = hashlib.md5(f"{acc_id}_{tx_date}_{tx_amount}_{tx_raw_label.strip().upper()}".encode()).hexdigest()[:10]
                            tx_id = str(history_tx.id) if getattr(history_tx, "id", None) else f"{acc_id}_{label_hash}"

                            if tx_id not in seen_tx_ids:
                                seen_tx_ids.add(tx_id)
                                transactions_list.append({
                                    "id": tx_id,
                                    "date": tx_date,
                                    "amount": tx_amount,
                                    "raw_label": tx_raw_label,
                                    "currency": acc_currency,
                                    "status": "confirmed",
                                })
                    except Exception as tx_err:
                        self.log(f"-> Info transactions {acc_label}: {tx_err}")

                    # 2. Coming / pending transactions if supported
                    try:
                        if hasattr(backend, "iter_coming"):
                            for coming_tx in backend.iter_coming(account):
                                tx_amount = float(coming_tx.amount or 0.0)
                                tx_raw_label = str(coming_tx.raw or coming_tx.label or "Transaction à venir")
                                tx_date = coming_tx.date.strftime("%Y-%m-%d") if coming_tx.date else datetime.utcnow().strftime("%Y-%m-%d")

                                label_hash = hashlib.md5(f"{acc_id}_{tx_date}_{tx_amount}_{tx_raw_label.strip().upper()}_coming".encode()).hexdigest()[:10]
                                tx_id = str(coming_tx.id) if getattr(coming_tx, "id", None) else f"{acc_id}_{label_hash}"

                                if tx_id not in seen_tx_ids:
                                    seen_tx_ids.add(tx_id)
                                    transactions_list.append({
                                        "id": tx_id,
                                        "date": tx_date,
                                        "amount": tx_amount,
                                        "raw_label": tx_raw_label,
                                        "currency": acc_currency,
                                        "status": "pending",
                                    })
                    except Exception:
                        pass

                    self.log(f"-> {len(transactions_list)} transaction(s) extraite(s) pour {acc_label}")

                    results.append({
                        "backend_name": backend.name,
                        "module": backend.NAME,
                        "account_id": acc_id,
                        "name": acc_label,
                        "iban": acc_iban,
                        "balance": acc_balance,
                        "currency": acc_currency,
                        "type": acc_type,
                        "transactions": transactions_list,
                    })
            except Exception as b_err:
                self.log(f"Erreur d'iteration sur {backend.name}: {b_err}")

        return results

    def remove_backend(self, backend_name: str):
        w = self._get_woob_instance()
        try:
            if backend_name in w:
                w.remove_backend(backend_name)
                self.log(f"Backend Woob {backend_name} supprime.")
        except Exception as e:
            self.log(f"Erreur suppression backend Woob {backend_name}: {e}")

woob_service = WoobService()
