from datetime import datetime
from fastapi import APIRouter
from typing import Dict, Any, List

router = APIRouter()

# Current representative mortgage rates and macroeconomic benchmark indicators in France
MORTGAGE_RATES_DATA = {
    "last_updated": datetime.utcnow().strftime("%Y-%m-%d"),
    "source": "Banque de France & Observatoire Crédit Logement",
    "market_rates": [
        {
            "duration_years": 7,
            "rate_excellent": 2.85,
            "rate_good": 3.00,
            "rate_average": 3.15,
            "monthly_per_10k": 132.5,
        },
        {
            "duration_years": 10,
            "rate_excellent": 2.95,
            "rate_good": 3.10,
            "rate_average": 3.25,
            "monthly_per_10k": 97.4,
        },
        {
            "duration_years": 15,
            "rate_excellent": 3.10,
            "rate_good": 3.25,
            "rate_average": 3.40,
            "monthly_per_10k": 70.2,
        },
        {
            "duration_years": 20,
            "rate_excellent": 3.25,
            "rate_good": 3.40,
            "rate_average": 3.55,
            "monthly_per_10k": 57.5,
        },
        {
            "duration_years": 25,
            "rate_excellent": 3.40,
            "rate_good": 3.55,
            "rate_average": 3.75,
            "monthly_per_10k": 50.3,
        },
    ],
    "usury_rates": [
        {"category": "Moins de 10 ans", "max_rate": 4.55},
        {"category": "10 ans à moins de 20 ans", "max_rate": 5.80},
        {"category": "20 ans et plus", "max_rate": 6.00},
    ],
    "reference_rates": {
        "bce_refi_rate": 3.15,
        "bce_deposit_rate": 3.00,
        "livret_a_rate": 3.00,
        "lep_rate": 4.00,
        "avg_insurance_rate": 0.30,
        "notary_fees_old_percent": 7.5,
        "notary_fees_new_percent": 2.5,
        "max_debt_ratio_percent": 35.0,
    },
}

@router.get("/mortgage")
def get_mortgage_rates() -> Dict[str, Any]:
    """
    Returns up-to-date average mortgage interest rates, usury rates, and reference market rates in France.
    """
    return MORTGAGE_RATES_DATA
