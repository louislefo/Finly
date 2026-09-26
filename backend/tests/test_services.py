import pytest
from app.services.cleaner_service import CleanerService
from app.services.categorizer_service import CategorizerService
from app.services.csv_parser_service import CsvParserService

# --- CleanerService Tests ---
def test_cleaner_service_merchant_cleaning():
    assert CleanerService.clean_merchant_name("CB CARREFOUR MARKET PARIS 15 12/03") == "Carrefour"
    assert CleanerService.clean_merchant_name("PAIEMENT PAR CARTE MONOPRIX 75001") == "Monoprix"
    assert CleanerService.clean_merchant_name("ACHAT CB SPOTIFY 28/07/2026") == "Spotify"
    assert CleanerService.clean_merchant_name("VIR SEPA NETFLIX MONTHLY") == "Netflix"
    assert CleanerService.clean_merchant_name("SNCF CONNECT VOYAGE") == "SNCF Connect"
    assert CleanerService.clean_merchant_name("VIR SEPA SALAIRE SEPTEMBRE 2026") == "Virement Salaire"
    assert CleanerService.clean_merchant_name("PRLV TOTALENERGIES ELECTRICITE") == "TotalEnergies"

def test_cleaner_service_edge_cases():
    assert CleanerService.clean_merchant_name("") == "Inconnu"
    assert CleanerService.clean_merchant_name(None) == "Inconnu"
    assert CleanerService.clean_merchant_name("   ") == "Inconnu"
    # Title case formatting for unknown uppercase merchant
    assert CleanerService.clean_merchant_name("BOULANGERIE DU COIN") == "Boulangerie Du Coin"

# --- CategorizerService Tests ---
def test_categorizer_service_income():
    assert CategorizerService.categorize("Virement Salaire", "VIR SALAIRE ACME CORP", 3200.0) == "Revenus"
    assert CategorizerService.categorize("CPAM", "REMBOURSEMENT CPAM SOINS", 45.0) == "Revenus"

def test_categorizer_service_transfers():
    assert CategorizerService.categorize("Virement Interne", "VIR INTERNE LIVRET A", -500.0) == "Virements & Épargne"
    assert CategorizerService.categorize("Épargne", "VERSEMENT EPARGNE PEA", -200.0) == "Virements & Épargne"
    assert CategorizerService.categorize("Virement", "VIR DE VOTRE COMPTE", 300.0) == "Virements & Épargne"

def test_categorizer_service_expenses():
    assert CategorizerService.categorize("Carrefour", "CB CARREFOUR CITY", -42.50) == "Alimentation"
    assert CategorizerService.categorize("Uber Eats", "UBER EATS COMMANDE", -28.90) == "Alimentation"
    assert CategorizerService.categorize("SNCF Connect", "CB SNCF CONNECT TGV", -89.00) == "Transports"
    assert CategorizerService.categorize("Netflix", "PRLV NETFLIX ABONNEMENT", -17.99) == "Abonnements"
    assert CategorizerService.categorize("EDF", "PRLV EDF FACTURE ELEC", -110.00) == "Logement"
    assert CategorizerService.categorize("Doctolib", "CB DOCTOLIB CONSULTATION", -30.00) == "Santé & Bien-être"
    
    # Test low confidence detection
    uncertain_res = CategorizerService.categorize("Inconnu", "ACHAT BOUTIQUE DIVERS 123", -15.00)
    assert uncertain_res.category == "Divers"
    assert uncertain_res.is_low_confidence is True
    assert uncertain_res.confidence < 0.65

# --- CsvParserService Tests ---
def test_csv_parser_detect_delimiter():
    csv_semicolon = "Date;Libelle;Montant\n01/09/2026;Carrefour;-30,50\n02/09/2026;Salaire;2500,00"
    assert CsvParserService.detect_delimiter(csv_semicolon) == ";"

    csv_comma = "Date,Libelle,Montant\n01/09/2026,Carrefour,-30.50\n02/09/2026,Salaire,2500.00"
    assert CsvParserService.detect_delimiter(csv_comma) == ","

    csv_tab = "Date\tLibelle\tMontant\n01/09/2026\tCarrefour\t-30.50\n02/09/2026\tSalaire\t2500.00"
    assert CsvParserService.detect_delimiter(csv_tab) == "\t"

def test_csv_parser_parse_amount():
    assert CsvParserService.parse_amount("1 250,50 €") == 1250.50
    assert CsvParserService.parse_amount("-45,99 €") == -45.99
    assert CsvParserService.parse_amount("(15.00)") == -15.00
    assert CsvParserService.parse_amount("1,234.56 USD") == 1234.56
    assert CsvParserService.parse_amount("invalid") is None
    assert CsvParserService.parse_amount(None) is None

def test_csv_parser_parse_date():
    assert CsvParserService.parse_date("15/09/2026") == "2026-09-15"
    assert CsvParserService.parse_date("15-09-2026") == "2026-09-15"
    assert CsvParserService.parse_date("2026-09-15") == "2026-09-15"
    assert CsvParserService.parse_date("15.09.26") == "2026-09-15"
    assert CsvParserService.parse_date("not-a-date") is None
    assert CsvParserService.parse_date(None) is None

def test_csv_parser_analyze_and_parse_full_csv():
    raw_csv = (
        "Date;Libellé de l'opération;Montant\n"
        "12/09/2026;CB CARREFOUR MARKET;-45,50\n"
        "13/09/2026;VIR SALAIRE ENTREPRISE;2800,00\n"
        "14/09/2026;PRLV NETFLIX;-17,99\n"
    )
    result = CsvParserService.analyze_and_parse_csv(raw_csv)
    
    assert result["status"] == "success"
    assert result["total_count"] == 3
    assert result["has_header"] is True
    
    txs = result["all_transactions"]
    assert len(txs) == 3
    
    assert txs[0]["date"] == "2026-09-12"
    assert txs[0]["amount"] == -45.50
    assert txs[0]["merchant_name"] == "Carrefour"
    assert txs[0]["category"] == "Alimentation"
    
    assert txs[1]["date"] == "2026-09-13"
    assert txs[1]["amount"] == 2800.00
    assert txs[1]["category"] == "Revenus"
    
    assert txs[2]["date"] == "2026-09-14"
    assert txs[2]["amount"] == -17.99
    assert txs[2]["category"] == "Abonnements"

def test_csv_parser_empty_csv():
    result = CsvParserService.analyze_and_parse_csv("")
    assert result["status"] == "error"
    assert result["total_count"] == 0
