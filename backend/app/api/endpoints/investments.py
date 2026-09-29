import uuid
from typing import Dict, Any, List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.investment import InvestmentHolding
from app.services.market_data_service import MarketDataService, ASSET_MAP

router = APIRouter()

# Pydantic Schemas
class HoldingCreate(BaseModel):
    symbol: str
    name: Optional[str] = None
    asset_type: str = "stock"  # stock, etf, crypto, commodity, fund
    quantity: float = Field(gt=0)
    buy_price: float = Field(ge=0)  # PRU
    currency: str = "EUR"
    account_id: Optional[str] = None
    sector: Optional[str] = None
    notes: Optional[str] = None

class HoldingUpdate(BaseModel):
    name: Optional[str] = None
    quantity: Optional[float] = Field(None, gt=0)
    buy_price: Optional[float] = Field(None, ge=0)
    currency: Optional[str] = None
    account_id: Optional[str] = None
    sector: Optional[str] = None
    notes: Optional[str] = None

def seed_sample_holdings_if_empty(db: Session):
    """Seed initial realistic investment portfolio if none exists."""
    existing_count = db.query(InvestmentHolding).count()
    if existing_count > 0:
        return

    sample_holdings = [
        {
            "symbol": "MC.PA",
            "name": "LVMH Moët Hennessy",
            "asset_type": "stock",
            "quantity": 6.0,
            "buy_price": 590.0,
            "currency": "EUR",
            "sector": "Luxury & Consumer",
        },
        {
            "symbol": "NVDA",
            "name": "NVIDIA Corporation",
            "asset_type": "stock",
            "quantity": 25.0,
            "buy_price": 92.50,
            "currency": "USD",
            "sector": "Semiconductors",
        },
        {
            "symbol": "CW8.PA",
            "name": "Amundi MSCI World UCITS ETF",
            "asset_type": "etf",
            "quantity": 30.0,
            "buy_price": 465.0,
            "currency": "EUR",
            "sector": "Global Equities",
        },
        {
            "symbol": "AAPL",
            "name": "Apple Inc.",
            "asset_type": "stock",
            "quantity": 12.0,
            "buy_price": 182.0,
            "currency": "USD",
            "sector": "Technology",
        },
        {
            "symbol": "TTE.PA",
            "name": "TotalEnergies SE",
            "asset_type": "stock",
            "quantity": 40.0,
            "buy_price": 54.20,
            "currency": "EUR",
            "sector": "Energy",
        },
        {
            "symbol": "BTC",
            "name": "Bitcoin",
            "asset_type": "crypto",
            "quantity": 0.15,
            "buy_price": 52400.0,
            "currency": "USD",
            "sector": "Digital Assets",
        },
    ]

    for item in sample_holdings:
        quote = MarketDataService.get_quote(item["symbol"])
        holding = InvestmentHolding(
            id=str(uuid.uuid4()),
            symbol=item["symbol"],
            name=item["name"],
            asset_type=item["asset_type"],
            quantity=item["quantity"],
            buy_price=item["buy_price"],
            current_price=quote.get("price", item["buy_price"]),
            currency=item["currency"],
            sector=item["sector"],
            notes="Initial portfolio holding",
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db.add(holding)
    db.commit()

@router.get("/holdings")
def get_holdings(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """
    Returns all investment portfolio holdings with live price, PRU, current value,
    and unrealized gain/loss calculations.
    """
    seed_sample_holdings_if_empty(db)
    holdings = db.query(InvestmentHolding).all()

    # Calculate total portfolio value for weighting
    enriched: List[Dict[str, Any]] = []
    total_port_val = 0.0

    for h in holdings:
        quote = MarketDataService.get_quote(h.symbol)
        curr_price = quote.get("price", h.current_price or h.buy_price)
        total_val = round(h.quantity * curr_price, 2)
        total_cost = round(h.quantity * h.buy_price, 2)
        pnl = round(total_val - total_cost, 2)
        pnl_pct = round(((curr_price - h.buy_price) / h.buy_price) * 100, 2) if h.buy_price > 0 else 0.0
        daily_change = round(quote.get("change", 0.0) * h.quantity, 2)
        daily_change_pct = quote.get("change_percent", 0.0)

        total_port_val += total_val

        enriched.append({
            "id": h.id,
            "symbol": h.symbol,
            "name": h.name,
            "asset_type": h.asset_type,
            "quantity": h.quantity,
            "buy_price": h.buy_price,
            "current_price": curr_price,
            "total_value": total_val,
            "total_cost": total_cost,
            "unrealized_pnl": pnl,
            "unrealized_pnl_percent": pnl_pct,
            "daily_change": daily_change,
            "daily_change_percent": daily_change_pct,
            "currency": h.currency,
            "sector": h.sector or quote.get("sector", "Diversified"),
            "account_id": h.account_id,
            "notes": h.notes,
            "updated_at": h.updated_at.isoformat() if h.updated_at else None,
        })

    # Add weight percentage
    for item in enriched:
        item["weight_percent"] = round((item["total_value"] / total_port_val) * 100, 2) if total_port_val > 0 else 0.0

    # Sort by total value descending
    enriched.sort(key=lambda x: x["total_value"], reverse=True)
    return enriched

@router.post("/holdings")
def create_holding(payload: HoldingCreate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Add a new investment asset to the user's portfolio."""
    quote = MarketDataService.get_quote(payload.symbol)
    name = payload.name or quote.get("name", payload.symbol)
    sector = payload.sector or quote.get("sector", "Diversified")
    curr_price = quote.get("price", payload.buy_price)

    holding = InvestmentHolding(
        id=str(uuid.uuid4()),
        symbol=payload.symbol.strip().upper(),
        name=name,
        asset_type=payload.asset_type,
        quantity=payload.quantity,
        buy_price=payload.buy_price,
        current_price=curr_price,
        currency=payload.currency,
        account_id=payload.account_id,
        sector=sector,
        notes=payload.notes,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(holding)
    db.commit()
    db.refresh(holding)

    return {
        "id": holding.id,
        "symbol": holding.symbol,
        "name": holding.name,
        "asset_type": holding.asset_type,
        "quantity": holding.quantity,
        "buy_price": holding.buy_price,
        "current_price": holding.current_price,
        "currency": holding.currency,
        "sector": holding.sector,
    }

@router.put("/holdings/{holding_id}")
def update_holding(holding_id: str, payload: HoldingUpdate, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Update an existing holding."""
    holding = db.query(InvestmentHolding).filter(InvestmentHolding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")

    if payload.name is not None:
        holding.name = payload.name
    if payload.quantity is not None:
        holding.quantity = payload.quantity
    if payload.buy_price is not None:
        holding.buy_price = payload.buy_price
    if payload.currency is not None:
        holding.currency = payload.currency
    if payload.account_id is not None:
        holding.account_id = payload.account_id
    if payload.sector is not None:
        holding.sector = payload.sector
    if payload.notes is not None:
        holding.notes = payload.notes

    holding.updated_at = datetime.utcnow()
    db.commit()
    return {"message": "Holding updated successfully", "id": holding.id}

@router.delete("/holdings/{holding_id}")
def delete_holding(holding_id: str, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Delete a holding from the portfolio."""
    holding = db.query(InvestmentHolding).filter(InvestmentHolding.id == holding_id).first()
    if not holding:
        raise HTTPException(status_code=404, detail="Holding not found")
    db.delete(holding)
    db.commit()
    return {"message": "Holding deleted successfully", "id": holding_id}

@router.get("/summary")
def get_portfolio_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Returns aggregated investment portfolio metrics: total value, total invested,
    unrealized gain/loss, asset class allocation, and sector allocation.
    """
    seed_sample_holdings_if_empty(db)
    holdings = db.query(InvestmentHolding).all()

    total_value = 0.0
    total_cost = 0.0
    total_daily_change = 0.0

    alloc_type_map: Dict[str, float] = {}
    alloc_sector_map: Dict[str, float] = {}

    for h in holdings:
        quote = MarketDataService.get_quote(h.symbol)
        curr_price = quote.get("price", h.current_price or h.buy_price)
        val = h.quantity * curr_price
        cost = h.quantity * h.buy_price
        d_chg = quote.get("change", 0.0) * h.quantity

        total_value += val
        total_cost += cost
        total_daily_change += d_chg

        # Allocations
        t_key = h.asset_type.lower()
        alloc_type_map[t_key] = alloc_type_map.get(t_key, 0.0) + val

        s_key = h.sector or quote.get("sector", "Diversified")
        alloc_sector_map[s_key] = alloc_sector_map.get(s_key, 0.0) + val

    unrealized_pnl = round(total_value - total_cost, 2)
    unrealized_pnl_pct = round(((total_value - total_cost) / total_cost) * 100, 2) if total_cost > 0 else 0.0
    daily_pct = round((total_daily_change / (total_value - total_daily_change)) * 100, 2) if (total_value - total_daily_change) > 0 else 0.0

    allocation_by_type = [
        {
            "type": k,
            "value": round(v, 2),
            "percent": round((v / total_value) * 100, 2) if total_value > 0 else 0.0,
        }
        for k, v in alloc_type_map.items()
    ]

    allocation_by_sector = [
        {
            "sector": k,
            "value": round(v, 2),
            "percent": round((v / total_value) * 100, 2) if total_value > 0 else 0.0,
        }
        for k, v in alloc_sector_map.items()
    ]

    return {
        "total_value": round(total_value, 2),
        "total_cost": round(total_cost, 2),
        "unrealized_pnl": unrealized_pnl,
        "unrealized_pnl_percent": unrealized_pnl_pct,
        "daily_change": round(total_daily_change, 2),
        "daily_change_percent": daily_pct,
        "holdings_count": len(holdings),
        "allocation_by_type": allocation_by_type,
        "allocation_by_sector": allocation_by_sector,
    }

@router.get("/indices")
def get_market_indices() -> List[Dict[str, Any]]:
    """Returns top market indices (CAC 40, S&P 500, Nasdaq, DAX, Euro Stoxx)."""
    return MarketDataService.get_indices()

@router.get("/stocks")
def get_stocks(q: Optional[str] = Query(None, description="Search symbol or name")) -> List[Dict[str, Any]]:
    """Returns curated stocks or search results."""
    return MarketDataService.search(q or "")

@router.get("/stocks/{symbol}")
def get_stock_detail(symbol: str) -> Dict[str, Any]:
    """Returns detailed quote and financial metrics for a given stock/asset."""
    return MarketDataService.get_quote(symbol)

@router.get("/stocks/{symbol}/history")
def get_stock_history(
    symbol: str,
    timeframe: str = Query("1M", pattern="^(1D|1W|1M|1Y|5Y|ALL)$")
) -> List[Dict[str, Any]]:
    """Returns historical price series for interactive charts."""
    return MarketDataService.get_historical_candles(symbol, timeframe)
