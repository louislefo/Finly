import os
import json
import uuid
import hashlib
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime, timedelta
from woob.core import Woob
from woob.capabilities.bank import CapBank
from woob.exceptions import (
    BrowserIncorrectPassword,
    AppValidation,
    AppValidationCancelled,
    AppValidationExpired,
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

from app.core.config import settings

class WoobService:
    MODULE_ALIASES = {
        "ce": "caissedepargne",
        "caisseepargne": "caissedepargne",
        "caisse_epargne": "caissedepargne",
        "caissedepargne": "caissedepargne",
        "bnporc": "bnp",
        "bnp": "bnp",
        "bourso": "boursorama",
        "boursorama": "boursorama",
        "sg": "societegenerale",
        "societegenerale": "societegenerale",
        "banquepopulaire": "banquepopulaire",
        "bp": "bp",
        "labanquepostale": "bp",
        "cragr": "cragr",
        "ca": "cragr",
        "creditagricole": "cragr",
        "credit_agricole": "cragr",
        "cm": "creditmutuel",
        "creditmutuel": "creditmutuel",
        "cic": "cic",
        "lcl": "lcl",
        "fortuneo": "fortuneo",
        "hellobank": "hellobank",
        "n26": "n26",
        "bforbank": "bforbank",
        "axabanque": "axabanque",
        "creditcooperatif": "creditcooperatif",
        "ccf": "ccf",
        "mafrenchbank": "mafrenchbank",
    }

    SUPPORTED_MODULES = [
        {"id": "boursorama", "name": "BoursoBank", "desc": "Banque en ligne & Bourse", "color": "from-pink-600 to-rose-700", "logo": "BOURS"},
        {"id": "bnp", "name": "BNP Paribas", "desc": "Banque de détail", "color": "from-emerald-600 to-teal-700", "logo": "BNP"},
        {"id": "caissedepargne", "name": "Caisse d'Épargne", "desc": "Banque régionale", "color": "from-rose-600 to-red-800", "logo": "CE"},
        {"id": "banquepopulaire", "name": "Banque Populaire", "desc": "Banque coopérative", "color": "from-cyan-600 to-blue-800", "logo": "BP"},
        {"id": "cragr", "name": "Crédit Agricole", "desc": "Banque régionale", "color": "from-green-600 to-emerald-700", "logo": "CA"},
        {"id": "societegenerale", "name": "Société Générale", "desc": "Banque de détail", "color": "from-red-600 to-rose-700", "logo": "SG"},
        {"id": "lcl", "name": "LCL", "desc": "Banque de détail", "color": "from-yellow-600 to-amber-700", "logo": "LCL"},
        {"id": "fortuneo", "name": "Fortuneo", "desc": "Banque en ligne & Bourse", "color": "from-emerald-500 to-teal-700", "logo": "FORTU"},
        {"id": "creditmutuel", "name": "Crédit Mutuel", "desc": "Banque coopérative", "color": "from-red-600 to-rose-700", "logo": "CM"},
        {"id": "cic", "name": "CIC", "desc": "Banque de détail", "color": "from-blue-700 to-cyan-700", "logo": "CIC"},
        {"id": "hellobank", "name": "Hello bank!", "desc": "Banque mobile", "color": "from-teal-500 to-emerald-600", "logo": "HB"},
        {"id": "bp", "name": "La Banque Postale", "desc": "Banque publique", "color": "from-blue-600 to-indigo-700", "logo": "LBP"},
        {"id": "bforbank", "name": "BforBank", "desc": "Banque 100% en ligne", "color": "from-blue-800 to-cyan-800", "logo": "BFB"},
        {"id": "n26", "name": "N26 Bank", "desc": "Néobanque européenne", "color": "from-teal-600 to-cyan-600", "logo": "N26"},
        {"id": "axabanque", "name": "AXA Banque", "desc": "Banque & Assurance", "color": "from-blue-700 to-indigo-800", "logo": "AXA"},
        {"id": "creditcooperatif", "name": "Crédit Coopératif", "desc": "Banque solidaire", "color": "from-teal-600 to-emerald-700", "logo": "CC"},
        {"id": "ccf", "name": "CCF", "desc": "Banque patrimoniale", "color": "from-gray-700 to-slate-800", "logo": "CCF"},
        {"id": "mafrenchbank", "name": "Ma French Bank", "desc": "Banque mobile", "color": "from-sky-500 to-blue-600", "logo": "MFB"},
    ]

    FALLBACK_CONFIG_FIELDS = {
        "cragr": [
            {
                "name": "website",
                "label": "Caisse Régionale",
                "type": "select",
                "required": True,
                "default": "www.ca-paris.fr",
                "choices": [
                    {"value": "www.ca-paris.fr", "label": "Île-de-France (Paris)"},
                    {"value": "www.ca-alpesprovence.fr", "label": "Alpes Provence"},
                    {"value": "www.ca-alsace-vosges.fr", "label": "Alsace Vosges"},
                    {"value": "www.ca-anjou-maine.fr", "label": "Anjou Maine"},
                    {"value": "www.ca-aquitaine.fr", "label": "Aquitaine"},
                    {"value": "www.ca-atlantique-vendee.fr", "label": "Atlantique Vendée"},
                    {"value": "www.ca-briepicardie.fr", "label": "Brie Picardie"},
                    {"value": "www.ca-centreest.fr", "label": "Centre-Est"},
                    {"value": "www.ca-centrefrance.fr", "label": "Centre France"},
                    {"value": "www.ca-centreloire.fr", "label": "Centre Loire"},
                    {"value": "www.ca-charente-maritime-deux-sevres.fr", "label": "Charente-Maritime Deux-Sèvres"},
                    {"value": "www.ca-charente-perigord.fr", "label": "Charente-Périgord"},
                    {"value": "www.ca-corse.fr", "label": "Corse"},
                    {"value": "www.ca-cotesdarmor.fr", "label": "Côtes d'Armor"},
                    {"value": "www.ca-des-savoie.fr", "label": "Des Savoie"},
                    {"value": "www.ca-finistere.fr", "label": "Finistère"},
                    {"value": "www.ca-franchecomte.fr", "label": "Franche-Comté"},
                    {"value": "www.ca-illeetvilaine.fr", "label": "Ille-et-Vilaine"},
                    {"value": "www.ca-languedoc.fr", "label": "Languedoc"},
                    {"value": "www.ca-loire-haute-loire.fr", "label": "Loire Haute-Loire"},
                    {"value": "www.ca-lorraine.fr", "label": "Lorraine"},
                    {"value": "www.ca-morbihan.fr", "label": "Morbihan"},
                    {"value": "www.ca-norddefrance.fr", "label": "Nord de France"},
                    {"value": "www.ca-nord-est.fr", "label": "Nord Est"},
                    {"value": "www.ca-nord-midi-pyrenees.fr", "label": "Nord Midi-Pyrénées"},
                    {"value": "www.ca-normandie.fr", "label": "Normandie"},
                    {"value": "www.ca-normandie-seine.fr", "label": "Normandie Seine"},
                    {"value": "www.ca-pyrenees-gascogne.fr", "label": "Pyrénées Gascogne"},
                    {"value": "www.ca-sudmed.fr", "label": "Sud Méditerranée"},
                    {"value": "www.ca-sudrhonealpes.fr", "label": "Sud Rhône Alpes"},
                    {"value": "www.ca-touraine-poitou.fr", "label": "Touraine Poitou"},
                    {"value": "www.ca-valdefrance.fr", "label": "Val de France"},
                ],
            }
        ],
        "banquepopulaire": [
            {
                "name": "cdetab",
                "label": "Établissement Régional",
                "type": "select",
                "required": True,
                "default": "10207",
                "choices": [
                    {"value": "10207", "label": "BP Rives de Paris"},
                    {"value": "10107", "label": "BP Val de France"},
                    {"value": "13807", "label": "BP Alsace Lorraine Champagne"},
                    {"value": "14507", "label": "BP Aquitaine Centre Atlantique"},
                    {"value": "14607", "label": "BP Atlantique"},
                    {"value": "14707", "label": "BP Bourgogne Franche-Comté"},
                    {"value": "13907", "label": "BP Auvergne Rhône Alpes"},
                    {"value": "17807", "label": "BP du Sud"},
                    {"value": "16907", "label": "BP Occitane"},
                    {"value": "13507", "label": "BRED Banque Populaire"},
                    {"value": "18206", "label": "CASDEN Banque Populaire"},
                ],
            }
        ],
        "bforbank": [
            {
                "name": "birthdate",
                "label": "Date de naissance (JJ/MM/AAAA)",
                "type": "text",
                "required": False,
                "placeholder": "Ex: 15/04/1990",
            }
        ],
    }

    def __init__(self):
        self.woob_dir = os.environ.get("WOOB_WORKDIR") or os.path.join(settings.DATA_DIR, "woob_data")
        try:
            os.makedirs(self.woob_dir, exist_ok=True)
        except Exception:
            pass
        self._woob: Optional[Woob] = None
        self.latest_logs: List[str] = []
        self._challenge_sessions: Dict[str, Dict[str, Any]] = {}

    def log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        formatted = f"[{timestamp}] [WOOB] {message}"
        self.latest_logs.append(formatted)
        if len(self.latest_logs) > 50:
            self.latest_logs.pop(0)
        print(formatted, flush=True)

    def _cleanup_expired_challenges(self):
        now = datetime.utcnow()
        expired = [cid for cid, s in self._challenge_sessions.items() if s.get("expires_at", now) < now]
        for cid in expired:
            self.log(f"Session 2FA expiree et nettoyee: {cid}")
            self._challenge_sessions.pop(cid, None)

    def _get_woob_instance(self) -> Woob:
        if self._woob is None:
            self.log(f"Initialisation Woob (workdir: {self.woob_dir})")
            self._woob = Woob(workdir=self.woob_dir)
            try:
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
        """Returns list of supported banks enriched with dynamic regional choices and parameters."""
        w = self._get_woob_instance()
        banks = []

        for bank in self.SUPPORTED_MODULES:
            b_copy = dict(bank)
            mod_id = bank["id"]
            config_fields = []

            # Check if module has dynamic config fields in Woob
            try:
                if w.modules_loader.module_exists(mod_id):
                    mod = w.modules_loader.get_or_load_module(mod_id)
                    cfg = getattr(mod.klass, "CONFIG", None)
                    if cfg:
                        if mod_id == "cragr" and "website" in cfg:
                            choices_dict = getattr(cfg["website"], "choices", {}) or {}
                            choices_list = [{"value": k, "label": v} for k, v in choices_dict.items()]
                            config_fields.append({
                                "name": "website",
                                "label": "Caisse Régionale",
                                "type": "select",
                                "required": True,
                                "default": "www.ca-paris.fr",
                                "choices": choices_list,
                            })
                        elif mod_id == "banquepopulaire" and "cdetab" in cfg:
                            choices_dict = getattr(cfg["cdetab"], "choices", {}) or {}
                            choices_list = [{"value": k, "label": v} for k, v in choices_dict.items() if k != "Padding"]
                            config_fields.append({
                                "name": "cdetab",
                                "label": "Établissement Régional",
                                "type": "select",
                                "required": True,
                                "default": "10207",
                                "choices": choices_list,
                            })
                        elif mod_id == "bforbank" and "birthdate" in cfg:
                            config_fields.append({
                                "name": "birthdate",
                                "label": "Date de naissance (JJ/MM/AAAA)",
                                "type": "text",
                                "required": False,
                                "placeholder": "Ex: 15/04/1990",
                            })
            except Exception as e:
                self.log(f"Note inspection config {mod_id}: {e}")

            if not config_fields and mod_id in self.FALLBACK_CONFIG_FIELDS:
                config_fields = [dict(f) for f in self.FALLBACK_CONFIG_FIELDS[mod_id]]

            b_copy["config_fields"] = config_fields
            banks.append(b_copy)

        return banks

    def _extract_accounts_and_transactions(self, backend: Any, accounts_list: List[Any], module_name: str, backend_name: str) -> List[Dict[str, Any]]:
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
            seen_tx_counts: Dict[str, int] = {}
            try:
                for history_tx in backend.iter_history(account):
                    tx_amount = float(history_tx.amount or 0.0)
                    tx_raw_label = str(history_tx.raw or history_tx.label or "Transaction")
                    tx_date = history_tx.date.strftime("%Y-%m-%d") if history_tx.date else datetime.utcnow().strftime("%Y-%m-%d")

                    raw_id = getattr(history_tx, "id", None)
                    if raw_id:
                        tx_id = str(raw_id)
                    else:
                        label_hash = hashlib.md5(f"{acc_id}_{tx_date}_{tx_amount}_{tx_raw_label.strip().upper()}".encode()).hexdigest()[:10]
                        count = seen_tx_counts.get(label_hash, 0)
                        seen_tx_counts[label_hash] = count + 1
                        suffix = f"_{count}" if count > 0 else ""
                        tx_id = f"{acc_id}_{label_hash}{suffix}"

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

            try:
                if hasattr(backend, "iter_coming"):
                    for coming_tx in backend.iter_coming(account):
                        tx_amount = float(coming_tx.amount or 0.0)
                        tx_raw_label = str(coming_tx.raw or coming_tx.label or "Transaction à venir")
                        tx_date = coming_tx.date.strftime("%Y-%m-%d") if coming_tx.date else datetime.utcnow().strftime("%Y-%m-%d")

                        raw_id = getattr(coming_tx, "id", None)
                        if raw_id:
                            tx_id = str(raw_id)
                        else:
                            label_hash = hashlib.md5(f"{acc_id}_{tx_date}_{tx_amount}_{tx_raw_label.strip().upper()}_coming".encode()).hexdigest()[:10]
                            count = seen_tx_counts.get(label_hash, 0)
                            seen_tx_counts[label_hash] = count + 1
                            suffix = f"_{count}" if count > 0 else ""
                            tx_id = f"{acc_id}_{label_hash}{suffix}"

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
        return extracted_accounts

    def setup_backend(
        self,
        module_name: str,
        login: str,
        password: str,
        backend_name: Optional[str] = None,
        custom_params: Optional[Dict[str, str]] = None,
        user_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Establish bank backend session with full 2FA interactive challenge support."""
        self._cleanup_expired_challenges()
        w = self._get_woob_instance()

        normalized_module = self.MODULE_ALIASES.get(module_name.lower(), module_name.lower())
        if not backend_name:
            backend_name = f"{normalized_module}_{uuid.uuid4().hex[:8]}"

        self.log(f"Connexion au module {normalized_module} (login: {login[:3]}***)")

        # Ensure module exists locally or install from repository
        try:
            if not w.modules_loader.module_exists(normalized_module):
                self.log(f"Module {normalized_module} absent en local. Recherche dans le depot officiel...")
                minfo = w.repositories.get_module_info(normalized_module)
                if not minfo:
                    w.repositories.update()
                    minfo = w.repositories.get_module_info(normalized_module)
                if minfo:
                    self.log(f"Installation du module certifie {normalized_module}...")
                    w.repositories.install(minfo)
            w.modules_loader.get_or_load_module(normalized_module)
        except Exception as e:
            self.log(f"Note chargement module {normalized_module}: {e}")

        # Assemble connection params
        params: Dict[str, Any] = {
            "login": login,
            "password": password,
        }
        if custom_params:
            params.update(custom_params)

        # Module-specific default parameters if missing
        if normalized_module == "caissedepargne" and "auth_type" not in params:
            params["auth_type"] = "part"
        elif normalized_module == "cragr" and "website" not in params:
            params["website"] = "www.ca-paris.fr"
        elif normalized_module == "banquepopulaire" and "cdetab" not in params:
            params["cdetab"] = "10207"

        try:
            w.backend_instances.pop(backend_name, None)
            backend = w.build_backend(normalized_module, params, name=backend_name)

            # Enable interactive DSP2 / 2FA challenges
            if "request_information" in backend.config:
                backend.config["request_information"].set({})

            w.backend_instances[backend_name] = backend

            self.log(f"Authentification aupres de {normalized_module}...")
            accounts_list = list(backend.iter_accounts())
            self.log(f"Authentification reussie: {len(accounts_list)} compte(s) trouve(s).")

            extracted_data = self._extract_accounts_and_transactions(backend, accounts_list, normalized_module, backend_name)

            return {
                "status": "connected",
                "backend_name": backend_name,
                "module": normalized_module,
                "accounts_count": len(accounts_list),
                "extracted_data": extracted_data,
                "custom_params": custom_params,
            }

        except BrowserIncorrectPassword:
            self.log(f"ERREUR: Identifiant ou mot de passe incorrect pour {normalized_module}.")
            raise Exception("Identifiant ou mot de passe bancaire incorrect.")

        except (AppValidation, DecoupledValidation) as app_err:
            msg = str(app_err) or "Validation requise sur l'application mobile de votre banque."
            self.log(f"2FA APP VALIDATION: {msg}")
            challenge_id = f"chal_{uuid.uuid4().hex[:12]}"
            self._challenge_sessions[challenge_id] = {
                "challenge_id": challenge_id,
                "backend": backend,
                "backend_name": backend_name,
                "module_name": normalized_module,
                "bank_name": module_name,
                "login": login,
                "password": password,
                "custom_params": custom_params or {},
                "user_id": user_id,
                "challenge_type": "app_validation",
                "message": msg,
                "fields": [],
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(minutes=10),
            }
            return {
                "status": "2fa_required",
                "challenge_id": challenge_id,
                "challenge_type": "app_validation",
                "backend_name": backend_name,
                "module": normalized_module,
                "message": msg,
                "fields": [],
                "custom_params": custom_params,
            }

        except (OTPQuestion, SentOTPQuestion, BrowserQuestion) as quest_err:
            msg = str(quest_err) or "Code de sécurité requis (SMS ou e-mail)."
            self.log(f"2FA QUESTION OTP: {msg}")
            challenge_id = f"chal_{uuid.uuid4().hex[:12]}"
            fields = []
            if hasattr(quest_err, "fields") and quest_err.fields:
                for f in quest_err.fields:
                    f_id = getattr(f, "id", "code")
                    f_lbl = getattr(f, "label", None) or getattr(f, "description", None) or "Code de sécurité (SMS / e-mail)"
                    fields.append({"id": f_id, "label": f_lbl, "type": "text"})
            if not fields:
                fields = [{"id": "code", "label": "Code reçu par SMS / e-mail", "type": "text"}]

            self._challenge_sessions[challenge_id] = {
                "challenge_id": challenge_id,
                "backend": backend,
                "backend_name": backend_name,
                "module_name": normalized_module,
                "bank_name": module_name,
                "login": login,
                "password": password,
                "custom_params": custom_params or {},
                "user_id": user_id,
                "challenge_type": "otp",
                "message": msg,
                "fields": fields,
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(minutes=10),
            }
            return {
                "status": "2fa_required",
                "challenge_id": challenge_id,
                "challenge_type": "otp",
                "backend_name": backend_name,
                "module": normalized_module,
                "message": msg,
                "fields": fields,
                "custom_params": custom_params,
            }

        except (NeedInteractive, NeedInteractiveFor2FA) as ni_err:
            msg = str(ni_err) or "Validation forte requise par votre établissement bancaire."
            challenge_id = f"chal_{uuid.uuid4().hex[:12]}"
            self._challenge_sessions[challenge_id] = {
                "challenge_id": challenge_id,
                "backend": backend,
                "backend_name": backend_name,
                "module_name": normalized_module,
                "bank_name": module_name,
                "login": login,
                "password": password,
                "custom_params": custom_params or {},
                "user_id": user_id,
                "challenge_type": "otp",
                "message": msg,
                "fields": [{"id": "code", "label": "Code de validation", "type": "text"}],
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(minutes=10),
            }
            return {
                "status": "2fa_required",
                "challenge_id": challenge_id,
                "challenge_type": "otp",
                "backend_name": backend_name,
                "module": normalized_module,
                "message": msg,
                "fields": [{"id": "code", "label": "Code de validation", "type": "text"}],
                "custom_params": custom_params,
            }

        except (BrowserUnavailable, ScrapingBlocked, BrowserForbidden) as sec_err:
            self.log(f"ERREUR ACCES: {sec_err}")
            raise Exception(f"Accès refusé ou service bancaire indisponible: {sec_err}")

        except NoAccountsException:
            self.log(f"Aucun compte bancaire trouvé pour {normalized_module}.")
            return {
                "status": "connected",
                "backend_name": backend_name,
                "module": normalized_module,
                "accounts_count": 0,
                "extracted_data": [],
                "custom_params": custom_params,
            }

        except Exception as e:
            error_str = str(e)
            self.log(f"EXCEPTION setup_backend: {error_str}")
            if any(k in error_str.lower() for k in ["2fa", "sca", "otp", "interactive", "validation", "app", "mobile"]):
                challenge_id = f"chal_{uuid.uuid4().hex[:12]}"
                self._challenge_sessions[challenge_id] = {
                    "challenge_id": challenge_id,
                    "backend": backend,
                    "backend_name": backend_name,
                    "module_name": normalized_module,
                    "bank_name": module_name,
                    "login": login,
                    "password": password,
                    "custom_params": custom_params or {},
                    "user_id": user_id,
                    "challenge_type": "app_validation",
                    "message": "Validation requise sur votre application mobile bancaire.",
                    "fields": [],
                    "created_at": datetime.utcnow(),
                    "expires_at": datetime.utcnow() + timedelta(minutes=10),
                }
                return {
                    "status": "2fa_required",
                    "challenge_id": challenge_id,
                    "challenge_type": "app_validation",
                    "backend_name": backend_name,
                    "module": normalized_module,
                    "message": "Validation requise sur votre application mobile bancaire.",
                    "fields": [],
                    "custom_params": custom_params,
                }
            raise Exception(f"Erreur de connexion bancaire: {error_str}")

    def respond_to_challenge(self, challenge_id: str, answers: Dict[str, str]) -> Dict[str, Any]:
        """Submit 2FA OTP codes or confirm App Push validation to resume live session."""
        self._cleanup_expired_challenges()
        session = self._challenge_sessions.get(challenge_id)
        if not session:
            raise Exception("Session de validation expirée ou introuvable. Veuillez relancer la connexion.")

        backend = session["backend"]
        backend_name = session["backend_name"]
        module_name = session["module_name"]

        self.log(f"Reponse au defi 2FA {challenge_id} pour {backend_name}...")

        # Inject answer fields into backend configuration
        for key, val in answers.items():
            val_clean = str(val).strip()
            if key in backend.config:
                backend.config[key].set(val_clean)
            else:
                for candidate in ["code", "otp", "code_sms", "otp_sms", "email_code", "security_code"]:
                    if candidate in backend.config:
                        backend.config[candidate].set(val_clean)

        if "resume" in backend.config:
            backend.config["resume"].set(True)

        try:
            accounts_list = list(backend.iter_accounts())
            self.log(f"Validation 2FA confirmee avec succes: {len(accounts_list)} compte(s).")

            extracted_data = self._extract_accounts_and_transactions(backend, accounts_list, module_name, backend_name)
            self._challenge_sessions.pop(challenge_id, None)

            return {
                "status": "connected",
                "backend_name": backend_name,
                "module": module_name,
                "accounts_count": len(accounts_list),
                "extracted_data": extracted_data,
                "custom_params": session.get("custom_params"),
            }

        except BrowserIncorrectPassword:
            raise Exception("Code de vérification incorrect ou expiré. Veuillez vérifier le code et réessayer.")

        except (AppValidation, DecoupledValidation) as app_err:
            msg = str(app_err) or "En attente de validation sur l'application mobile..."
            session["message"] = msg
            return {
                "status": "2fa_required",
                "challenge_id": challenge_id,
                "challenge_type": "app_validation",
                "backend_name": backend_name,
                "module": module_name,
                "message": msg,
                "fields": [],
            }

        except (OTPQuestion, SentOTPQuestion, BrowserQuestion) as q_err:
            msg = str(q_err) or "Nouveau code ou question de sécurité requis."
            fields = []
            if hasattr(q_err, "fields") and q_err.fields:
                for f in q_err.fields:
                    f_id = getattr(f, "id", "code")
                    f_lbl = getattr(f, "label", None) or getattr(f, "description", None) or "Code"
                    fields.append({"id": f_id, "label": f_lbl, "type": "text"})
            if not fields:
                fields = [{"id": "code", "label": "Code de validation", "type": "text"}]

            session["message"] = msg
            session["fields"] = fields
            return {
                "status": "2fa_required",
                "challenge_id": challenge_id,
                "challenge_type": "otp",
                "backend_name": backend_name,
                "module": module_name,
                "message": msg,
                "fields": fields,
            }

        except Exception as e:
            self.log(f"Erreur validation defi 2FA: {e}")
            raise Exception(f"Échec de validation: {str(e)}")

    def poll_or_verify_challenge(self, challenge_id: str) -> Dict[str, Any]:
        """Poll or verify state for decoupled push notification authentication."""
        self._cleanup_expired_challenges()
        session = self._challenge_sessions.get(challenge_id)
        if not session:
            return {
                "status": "expired",
                "message": "La session de validation a expiré ou a été clôturée.",
            }

        backend = session["backend"]
        backend_name = session["backend_name"]
        module_name = session["module_name"]

        if "resume" in backend.config:
            backend.config["resume"].set(True)

        try:
            accounts_list = list(backend.iter_accounts())
            self.log(f"Polling 2FA: validation reussie pour {backend_name}.")
            extracted_data = self._extract_accounts_and_transactions(backend, accounts_list, module_name, backend_name)
            self._challenge_sessions.pop(challenge_id, None)

            return {
                "status": "connected",
                "backend_name": backend_name,
                "module": module_name,
                "accounts_count": len(accounts_list),
                "extracted_data": extracted_data,
                "custom_params": session.get("custom_params"),
            }

        except (AppValidation, DecoupledValidation) as app_err:
            return {
                "status": "pending",
                "challenge_id": challenge_id,
                "message": str(app_err) or "En attente de validation sur l'application bancaire...",
            }

        except AppValidationExpired:
            self._challenge_sessions.pop(challenge_id, None)
            return {
                "status": "expired",
                "challenge_id": challenge_id,
                "message": "La demande de validation a expiré sur votre application mobile.",
            }

        except AppValidationCancelled:
            self._challenge_sessions.pop(challenge_id, None)
            return {
                "status": "cancelled",
                "challenge_id": challenge_id,
                "message": "La demande de validation a été annulée ou refusée.",
            }

        except Exception as e:
            err_str = str(e)
            if any(k in err_str.lower() for k in ["appvalidation", "decoupled", "pending", "attente"]):
                return {
                    "status": "pending",
                    "challenge_id": challenge_id,
                    "message": "En attente de confirmation sur votre application mobile...",
                }
            self.log(f"Erreur polling 2FA: {err_str}")
            return {
                "status": "error",
                "challenge_id": challenge_id,
                "message": f"Erreur de communication: {err_str}",
            }

    def cancel_challenge(self, challenge_id: str):
        """Cancel and clean up a pending 2FA challenge session."""
        self._challenge_sessions.pop(challenge_id, None)
        self.log(f"Session 2FA annulee: {challenge_id}")

    def ensure_connections_loaded(self, connections: list, force_reload: bool = True) -> List[Dict[str, Any]]:
        """Re-instantiate backends from SQLite connections with decrypted passwords and custom_params."""
        from app.core.security import decrypt_bank_password
        w = self._get_woob_instance()
        load_errors: List[Dict[str, Any]] = []

        for conn in connections:
            if not conn.login:
                self.log(f"Connexion {conn.bank_name} ({conn.module_name}) ignoree: identifiant manquant.")
                load_errors.append({
                    "connection_id": conn.id,
                    "bank_name": conn.bank_name,
                    "module_name": conn.module_name,
                    "login": conn.login or "",
                    "backend_name": conn.backend_name,
                    "status": "error",
                    "message": "Identifiant bancaire manquant.",
                })
                continue

            if not conn.password:
                self.log(f"Connexion {conn.bank_name} ({conn.module_name}) ignoree: mot de passe non renseigne.")
                load_errors.append({
                    "connection_id": conn.id,
                    "bank_name": conn.bank_name,
                    "module_name": conn.module_name,
                    "login": conn.login,
                    "backend_name": conn.backend_name,
                    "status": "reconnect_required",
                    "message": "Mot de passe non renseigné en base (reconnexion requise).",
                })
                continue

            decrypted_pwd = decrypt_bank_password(conn.password)
            if not decrypted_pwd:
                self.log(f"Mot de passe non dechiffrable pour {conn.bank_name}. Reconnexion requise.")
                load_errors.append({
                    "connection_id": conn.id,
                    "bank_name": conn.bank_name,
                    "module_name": conn.module_name,
                    "login": conn.login,
                    "backend_name": conn.backend_name,
                    "status": "reconnect_required",
                    "message": "Mot de passe non déchiffrable (reconnexion requise).",
                })
                continue

            mod_name = self.MODULE_ALIASES.get(conn.module_name.lower(), conn.module_name.lower())
            try:
                if not w.modules_loader.module_exists(mod_name):
                    minfo = w.repositories.get_module_info(mod_name)
                    if minfo:
                        w.repositories.install(minfo)
                w.modules_loader.get_or_load_module(mod_name)
            except Exception as mod_err:
                self.log(f"Note chargement module {mod_name}: {mod_err}")

            w.backend_instances.pop(conn.backend_name, None)

            # Rebuild params with stored custom_params
            params: Dict[str, Any] = {
                "login": conn.login,
                "password": str(decrypted_pwd),
            }
            if getattr(conn, "custom_params", None):
                try:
                    cparams = json.loads(conn.custom_params) if isinstance(conn.custom_params, str) else conn.custom_params
                    if isinstance(cparams, dict):
                        params.update(cparams)
                except Exception as cp_err:
                    self.log(f"Note deserialisation custom_params pour {conn.backend_name}: {cp_err}")

            # Defaults for regional modules
            if mod_name == "caissedepargne" and "auth_type" not in params:
                params["auth_type"] = "part"
            elif mod_name == "cragr" and "website" not in params:
                params["website"] = "www.ca-paris.fr"
            elif mod_name == "banquepopulaire" and "cdetab" not in params:
                params["cdetab"] = "10207"

            try:
                self.log(f"Chargement session pour {conn.bank_name} ({mod_name})...")
                backend = w.build_backend(mod_name, params, name=conn.backend_name)
                if "request_information" in backend.config:
                    backend.config["request_information"].set({})
                w.backend_instances[conn.backend_name] = backend
            except Exception as e:
                self.log(f"Note chargement backend {conn.backend_name}: {e}")
                load_errors.append({
                    "connection_id": conn.id,
                    "bank_name": conn.bank_name,
                    "module_name": conn.module_name,
                    "login": conn.login,
                    "backend_name": conn.backend_name,
                    "status": "error",
                    "message": f"Erreur de chargement: {str(e)}",
                })

        return load_errors

    def fetch_accounts_and_transactions(self) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """Fetch accounts and transactions from active backends with robust error classification."""
        w = self._get_woob_instance()
        results: List[Dict[str, Any]] = []
        fetch_errors: List[Dict[str, Any]] = []

        backends = list(w.backend_instances.values())
        self.log(f"Aspiration des comptes sur {len(backends)} backend(s) actif(s)...")

        for backend in backends:
            if not backend.has_caps(CapBank):
                continue

            self.log(f"Interrogation du backend: {backend.name} ({backend.NAME})")

            try:
                accounts_list = list(backend.iter_accounts())
                extracted = self._extract_accounts_and_transactions(backend, accounts_list, backend.NAME, backend.name)
                results.extend(extracted)
            except BrowserIncorrectPassword as pwd_err:
                self.log(f"Erreur mot de passe sur {backend.name}: {pwd_err}")
                fetch_errors.append({
                    "backend_name": backend.name,
                    "module_name": getattr(backend, "NAME", ""),
                    "status": "error",
                    "message": "Identifiant ou mot de passe bancaire incorrect.",
                })
            except (AppValidation, DecoupledValidation, NeedInteractive, NeedInteractiveFor2FA, BrowserQuestion, OTPQuestion, SentOTPQuestion, ActionNeeded) as auth_err:
                self.log(f"2FA requise sur {backend.name}: {auth_err}")
                fetch_errors.append({
                    "backend_name": backend.name,
                    "module_name": getattr(backend, "NAME", ""),
                    "status": "2fa_required",
                    "message": "Validation requise sur l'application mobile de votre banque.",
                })
            except (BrowserUnavailable, ScrapingBlocked, BrowserForbidden) as sec_err:
                self.log(f"Acces refuse sur {backend.name}: {sec_err}")
                fetch_errors.append({
                    "backend_name": backend.name,
                    "module_name": getattr(backend, "NAME", ""),
                    "status": "error",
                    "message": "Accès refusé ou service bancaire temporairement indisponible.",
                })
            except Exception as b_err:
                err_str = str(b_err)
                self.log(f"Erreur d'iteration sur {backend.name}: {err_str}")
                if any(k in err_str.lower() for k in ["2fa", "sca", "otp", "interactive", "validation", "app", "mobile"]):
                    fetch_errors.append({
                        "backend_name": backend.name,
                        "module_name": getattr(backend, "NAME", ""),
                        "status": "2fa_required",
                        "message": "Validation requise sur l'application mobile de votre banque.",
                    })
                else:
                    fetch_errors.append({
                        "backend_name": backend.name,
                        "module_name": getattr(backend, "NAME", ""),
                        "status": "error",
                        "message": f"Erreur de communication: {err_str}",
                    })

        return results, fetch_errors

    def test_single_connection(self, conn: Any) -> Dict[str, Any]:
        """Test authentication and health of a single bank connection without updating history."""
        from app.core.security import decrypt_bank_password
        w = self._get_woob_instance()

        if not conn.login:
            return {"status": "error", "message": "Identifiant manquant."}
        if not conn.password:
            return {"status": "reconnect_required", "message": "Mot de passe manquant (reconnexion requise)."}

        decrypted_pwd = decrypt_bank_password(conn.password)
        if not decrypted_pwd:
            return {"status": "reconnect_required", "message": "Mot de passe non déchiffrable."}

        mod_name = self.MODULE_ALIASES.get(conn.module_name.lower(), conn.module_name.lower())
        test_backend_name = f"test_{conn.backend_name}_{uuid.uuid4().hex[:6]}"

        params: Dict[str, Any] = {
            "login": conn.login,
            "password": str(decrypted_pwd),
        }
        if getattr(conn, "custom_params", None):
            try:
                cparams = json.loads(conn.custom_params) if isinstance(conn.custom_params, str) else conn.custom_params
                if isinstance(cparams, dict):
                    params.update(cparams)
            except Exception:
                pass

        if mod_name == "caissedepargne" and "auth_type" not in params:
            params["auth_type"] = "part"
        elif mod_name == "cragr" and "website" not in params:
            params["website"] = "www.ca-paris.fr"
        elif mod_name == "banquepopulaire" and "cdetab" not in params:
            params["cdetab"] = "10207"

        try:
            backend = w.build_backend(mod_name, params, name=test_backend_name)
            if "request_information" in backend.config:
                backend.config["request_information"].set({})

            accounts_list = list(backend.iter_accounts())
            w.backend_instances.pop(test_backend_name, None)
            return {
                "status": "connected",
                "message": f"Connexion réussie ({len(accounts_list)} compte(s) détecté(s)).",
                "accounts_count": len(accounts_list),
            }
        except BrowserIncorrectPassword:
            w.backend_instances.pop(test_backend_name, None)
            return {"status": "error", "message": "Identifiant ou mot de passe incorrect."}
        except (AppValidation, DecoupledValidation, NeedInteractive, NeedInteractiveFor2FA, BrowserQuestion, OTPQuestion, SentOTPQuestion):
            w.backend_instances.pop(test_backend_name, None)
            return {"status": "2fa_pending", "message": "Authentification forte (2FA) requise."}
        except (BrowserUnavailable, ScrapingBlocked, BrowserForbidden) as sec_err:
            w.backend_instances.pop(test_backend_name, None)
            return {"status": "blocked", "message": f"Accès bloqué ou banque indisponible : {sec_err}"}
        except Exception as e:
            w.backend_instances.pop(test_backend_name, None)
            return {"status": "error", "message": str(e)}

    def ensure_all_supported_modules_installed(self) -> Dict[str, Any]:
        """Ensure all 18 supported official modules are installed and loaded."""
        w = self._get_woob_instance()
        installed = []
        errors = []

        target_modules = [m["id"] for m in self.SUPPORTED_MODULES]
        for mod_name in target_modules:
            try:
                if not w.modules_loader.module_exists(mod_name):
                    minfo = w.repositories.get_module_info(mod_name)
                    if minfo:
                        w.repositories.install(minfo)
                        installed.append(mod_name)
                w.modules_loader.get_or_load_module(mod_name)
            except Exception as e:
                errors.append({"module": mod_name, "error": str(e)})

        return {"installed_new": installed, "errors": errors}

    def update_all_modules(self) -> Dict[str, Any]:
        """Update Woob repository and upgrade installed bank modules."""
        w = self._get_woob_instance()
        self.log("Mise a jour des depots officiels Woob...")
        try:
            w.repositories.update()
        except Exception as e:
            self.log(f"Note mise a jour depots: {e}")

        res = self.ensure_all_supported_modules_installed()
        return {
            "status": "success",
            "message": "Modules Woob mis à jour avec succès",
            "details": res,
        }

    def get_modules_status(self) -> List[Dict[str, Any]]:
        """Return version and installation status of each supported bank module."""
        w = self._get_woob_instance()
        statuses = []
        for b in self.SUPPORTED_MODULES:
            mod_id = b["id"]
            exists = w.modules_loader.module_exists(mod_id)
            version = "inconnu"
            if exists:
                try:
                    mod = w.modules_loader.get_or_load_module(mod_id)
                    version = getattr(mod, "version", "latest") or "latest"
                except Exception:
                    version = "installé"

            statuses.append({
                "id": mod_id,
                "name": b["name"],
                "installed": exists,
                "version": str(version),
                "logo": b["logo"],
            })
        return statuses

    def remove_backend(self, backend_name: str):
        w = self._get_woob_instance()
        try:
            if backend_name in w:
                w.remove_backend(backend_name)
                self.log(f"Backend Woob {backend_name} supprime.")
        except Exception as e:
            self.log(f"Erreur suppression backend Woob {backend_name}: {e}")

woob_service = WoobService()
