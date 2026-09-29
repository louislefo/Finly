import pytest
from app.services.market_data_service import MarketDataService, CURATED_MARKET_ASSETS

def test_market_data_service_indices():
    indices = MarketDataService.get_indices()
    assert len(indices) >= 4
    symbols = [idx["symbol"] for idx in indices]
    assert "^FCHI" in symbols  # CAC 40
    assert "^GSPC" in symbols  # S&P 500
    for idx in indices:
        assert idx["price"] > 0
        assert "change" in idx
        assert "change_percent" in idx

def test_market_data_service_quote():
    # US Stock
    aapl = MarketDataService.get_quote("AAPL")
    assert aapl["symbol"] == "AAPL"
    assert aapl["price"] > 0
    assert aapl["name"] == "Apple Inc."
    assert aapl["currency"] == "USD"

    # European Stock
    lvmh = MarketDataService.get_quote("MC.PA")
    assert lvmh["symbol"] == "MC.PA"
    assert lvmh["price"] > 0
    assert lvmh["name"] == "LVMH Moët Hennessy"
    assert lvmh["currency"] == "EUR"

def test_market_data_service_search():
    res = MarketDataService.search("nvidia")
    assert len(res) >= 1
    assert any(r["symbol"] == "NVDA" for r in res)

    res_cac = MarketDataService.search("CAC")
    assert len(res_cac) >= 1
    assert any(r["symbol"] == "^FCHI" for r in res_cac)

def test_market_data_service_history():
    candles_1m = MarketDataService.get_historical_candles("AAPL", "1M")
    assert len(candles_1m) > 0
    assert "time" in candles_1m[0]
    assert "price" in candles_1m[0]
    assert "label" in candles_1m[0]

    candles_1y = MarketDataService.get_historical_candles("MC.PA", "1Y")
    assert len(candles_1y) > 0
    assert candles_1y[-1]["price"] > 0
