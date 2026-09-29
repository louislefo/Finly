import time
import math
import random
from typing import Dict, Any, List, Optional
import httpx

# In-memory caches for fast sub-millisecond response
_QUOTES_CACHE: Dict[str, Dict[str, Any]] = {}
_HISTORY_CACHE: Dict[str, Dict[str, Any]] = {}

CACHE_TTL_QUOTES = 120  # 2 minutes
CACHE_TTL_HISTORY = 900  # 15 minutes

CURATED_MARKET_ASSETS: List[Dict[str, Any]] = [
    # Major Indices
    {
        "symbol": "^FCHI",
        "name": "CAC 40",
        "asset_type": "index",
        "sector": "France Index",
        "currency": "EUR",
        "base_price": 7980.50,
        "pe_ratio": 14.8,
        "market_cap": 2400000000000,
        "dividend_yield": 2.9,
    },
    {
        "symbol": "^GSPC",
        "name": "S&P 500",
        "asset_type": "index",
        "sector": "US Index",
        "currency": "USD",
        "base_price": 5750.25,
        "pe_ratio": 24.2,
        "market_cap": 46000000000000,
        "dividend_yield": 1.4,
    },
    {
        "symbol": "^IXIC",
        "name": "Nasdaq 100",
        "asset_type": "index",
        "sector": "US Tech Index",
        "currency": "USD",
        "base_price": 20120.80,
        "pe_ratio": 31.5,
        "market_cap": 21000000000000,
        "dividend_yield": 0.8,
    },
    {
        "symbol": "^GDAXI",
        "name": "DAX 40",
        "asset_type": "index",
        "sector": "Germany Index",
        "currency": "EUR",
        "base_price": 19450.10,
        "pe_ratio": 15.2,
        "market_cap": 1850000000000,
        "dividend_yield": 3.1,
    },
    {
        "symbol": "^STOXX50E",
        "name": "Euro Stoxx 50",
        "asset_type": "index",
        "sector": "Europe Index",
        "currency": "EUR",
        "base_price": 4980.40,
        "pe_ratio": 14.5,
        "market_cap": 3900000000000,
        "dividend_yield": 3.2,
    },
    # US Tech & Global Leaders
    {
        "symbol": "AAPL",
        "name": "Apple Inc.",
        "asset_type": "stock",
        "sector": "Technology",
        "currency": "USD",
        "base_price": 228.50,
        "pe_ratio": 33.8,
        "market_cap": 3480000000000,
        "dividend_yield": 0.45,
    },
    {
        "symbol": "NVDA",
        "name": "NVIDIA Corporation",
        "asset_type": "stock",
        "sector": "Semiconductors",
        "currency": "USD",
        "base_price": 128.80,
        "pe_ratio": 48.5,
        "market_cap": 3150000000000,
        "dividend_yield": 0.08,
    },
    {
        "symbol": "MSFT",
        "name": "Microsoft Corporation",
        "asset_type": "stock",
        "sector": "Technology",
        "currency": "USD",
        "base_price": 432.10,
        "pe_ratio": 35.2,
        "market_cap": 3210000000000,
        "dividend_yield": 0.72,
    },
    {
        "symbol": "AMZN",
        "name": "Amazon.com Inc.",
        "asset_type": "stock",
        "sector": "Consumer Cyclical",
        "currency": "USD",
        "base_price": 189.40,
        "pe_ratio": 42.1,
        "market_cap": 1980000000000,
        "dividend_yield": 0.0,
    },
    {
        "symbol": "GOOGL",
        "name": "Alphabet Inc.",
        "asset_type": "stock",
        "sector": "Communication Services",
        "currency": "USD",
        "base_price": 165.70,
        "pe_ratio": 23.4,
        "market_cap": 2040000000000,
        "dividend_yield": 0.48,
    },
    {
        "symbol": "TSLA",
        "name": "Tesla Inc.",
        "asset_type": "stock",
        "sector": "Automotive & Energy",
        "currency": "USD",
        "base_price": 254.20,
        "pe_ratio": 64.0,
        "market_cap": 810000000000,
        "dividend_yield": 0.0,
    },
    {
        "symbol": "META",
        "name": "Meta Platforms Inc.",
        "asset_type": "stock",
        "sector": "Communication Services",
        "currency": "USD",
        "base_price": 572.40,
        "pe_ratio": 27.8,
        "market_cap": 1450000000000,
        "dividend_yield": 0.35,
    },
    # European Champions
    {
        "symbol": "MC.PA",
        "name": "LVMH Moët Hennessy",
        "asset_type": "stock",
        "sector": "Luxury & Consumer",
        "currency": "EUR",
        "base_price": 642.50,
        "pe_ratio": 21.6,
        "market_cap": 322000000000,
        "dividend_yield": 2.02,
    },
    {
        "symbol": "TTE.PA",
        "name": "TotalEnergies SE",
        "asset_type": "stock",
        "sector": "Energy",
        "currency": "EUR",
        "base_price": 61.80,
        "pe_ratio": 7.4,
        "market_cap": 144000000000,
        "dividend_yield": 5.15,
    },
    {
        "symbol": "ASML.AS",
        "name": "ASML Holding NV",
        "asset_type": "stock",
        "sector": "Semiconductors",
        "currency": "EUR",
        "base_price": 768.90,
        "pe_ratio": 38.4,
        "market_cap": 302000000000,
        "dividend_yield": 0.82,
    },
    {
        "symbol": "SAN.PA",
        "name": "Sanofi SA",
        "asset_type": "stock",
        "sector": "Healthcare",
        "currency": "EUR",
        "base_price": 102.30,
        "pe_ratio": 13.9,
        "market_cap": 128000000000,
        "dividend_yield": 3.71,
    },
    {
        "symbol": "SAP.DE",
        "name": "SAP SE",
        "asset_type": "stock",
        "sector": "Enterprise Software",
        "currency": "EUR",
        "base_price": 206.50,
        "pe_ratio": 34.2,
        "market_cap": 242000000000,
        "dividend_yield": 1.07,
    },
    {
        "symbol": "AI.PA",
        "name": "Air Liquide SA",
        "asset_type": "stock",
        "sector": "Basic Materials & Gases",
        "currency": "EUR",
        "base_price": 171.20,
        "pe_ratio": 25.1,
        "market_cap": 90000000000,
        "dividend_yield": 1.95,
    },
    {
        "symbol": "RMS.PA",
        "name": "Hermès International",
        "asset_type": "stock",
        "sector": "Luxury",
        "currency": "EUR",
        "base_price": 2130.00,
        "pe_ratio": 49.5,
        "market_cap": 224000000000,
        "dividend_yield": 1.18,
    },
    {
        "symbol": "BNP.PA",
        "name": "BNP Paribas SA",
        "asset_type": "stock",
        "sector": "Financial Services",
        "currency": "EUR",
        "base_price": 66.40,
        "pe_ratio": 6.8,
        "market_cap": 76000000000,
        "dividend_yield": 7.05,
    },
    # ETFs & Funds
    {
        "symbol": "CW8.PA",
        "name": "Amundi MSCI World UCITS ETF",
        "asset_type": "etf",
        "sector": "Global Equities",
        "currency": "EUR",
        "base_price": 542.80,
        "pe_ratio": 21.0,
        "market_cap": 4200000000,
        "dividend_yield": 1.25,
    },
    {
        "symbol": "VUAA.PA",
        "name": "Vanguard S&P 500 UCITS ETF",
        "asset_type": "etf",
        "sector": "US Equities",
        "currency": "EUR",
        "base_price": 103.50,
        "pe_ratio": 24.5,
        "market_cap": 8900000000,
        "dividend_yield": 1.35,
    },
    {
        "symbol": "UST.PA",
        "name": "Lyxor Nasdaq-100 UCITS ETF",
        "asset_type": "etf",
        "sector": "Tech Index ETF",
        "currency": "EUR",
        "base_price": 72.40,
        "pe_ratio": 30.5,
        "market_cap": 1800000000,
        "dividend_yield": 0.65,
    },
    {
        "symbol": "EM.PA",
        "name": "Amundi MSCI Emerging Markets ETF",
        "asset_type": "etf",
        "sector": "Emerging Markets",
        "currency": "EUR",
        "base_price": 5.45,
        "pe_ratio": 13.2,
        "market_cap": 1100000000,
        "dividend_yield": 2.45,
    },
    # Crypto Assets
    {
        "symbol": "BTC",
        "name": "Bitcoin",
        "asset_type": "crypto",
        "sector": "Digital Gold & Layer 1",
        "currency": "USD",
        "base_price": 65400.0,
        "pe_ratio": None,
        "market_cap": 1290000000000,
        "dividend_yield": 0.0,
    },
    {
        "symbol": "ETH",
        "name": "Ethereum",
        "asset_type": "crypto",
        "sector": "Smart Contracts Layer 1",
        "currency": "USD",
        "base_price": 2680.0,
        "pe_ratio": None,
        "market_cap": 322000000000,
        "dividend_yield": 3.2,
    },
    {
        "symbol": "SOL",
        "name": "Solana",
        "asset_type": "crypto",
        "sector": "High-Throughput Layer 1",
        "currency": "USD",
        "base_price": 156.40,
        "pe_ratio": None,
        "market_cap": 73000000000,
        "dividend_yield": 6.8,
    },
]

ASSET_MAP: Dict[str, Dict[str, Any]] = {a["symbol"].upper(): a for a in CURATED_MARKET_ASSETS}
 
class MarketDataService:
    @staticmethod
    def _fetch_yahoo_quote_sync(symbol: str) -> Optional[Dict[str, Any]]:
        """Fetch quote from Yahoo Finance public v8 chart endpoint with timeout."""
        try:
            url = f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=5d"
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            }
            with httpx.Client(timeout=3.5, headers=headers) as client:
                res = client.get(url)
                if res.status_code == 200:
                    data = res.json()
                    res_arr = data.get("chart", {}).get("result", [])
                    if res_arr:
                        result = res_arr[0]
                        meta = result.get("meta", {})
                        price = meta.get("regularMarketPrice")
                        prev_close = meta.get("chartPreviousClose") or meta.get("previousClose") or price
                        if price is not None and prev_close:
                            change = price - prev_close
                            change_pct = (change / prev_close) * 100
                            inst_type = (meta.get("instrumentType") or "EQUITY").upper()
                            asset_type = "etf" if inst_type == "ETF" else ("index" if inst_type == "INDEX" else ("crypto" if inst_type == "CRYPTOCURRENCY" else "stock"))
                            real_name = meta.get("shortName") or meta.get("longName") or symbol

                            return {
                                "name": real_name,
                                "asset_type": asset_type,
                                "price": round(float(price), 2),
                                "change": round(float(change), 2),
                                "change_percent": round(float(change_pct), 2),
                                "day_high": round(float(meta.get("regularMarketDayHigh", price * 1.01)), 2),
                                "day_low": round(float(meta.get("regularMarketDayLow", price * 0.99)), 2),
                                "high_52w": round(float(meta.get("fiftyTwoWeekHigh", price * 1.25)), 2),
                                "low_52w": round(float(meta.get("fiftyTwoWeekLow", price * 0.75)), 2),
                                "volume": meta.get("regularMarketVolume", 1500000),
                                "currency": meta.get("currency", "USD"),
                            }
        except Exception:
            pass
        return None

    @classmethod
    def get_quote(cls, symbol: str) -> Dict[str, Any]:
        """Returns single quote with live fallback."""
        clean_symbol = symbol.strip().upper()
        now = time.time()

        # Check Cache
        cached = _QUOTES_CACHE.get(clean_symbol)
        if cached and (now - cached.get("_cached_at", 0)) < CACHE_TTL_QUOTES:
            return cached

        # Find in curated metadata
        meta = ASSET_MAP.get(clean_symbol, {
            "symbol": clean_symbol,
            "name": clean_symbol,
            "asset_type": "stock",
            "sector": "Equities",
            "currency": "EUR" if ".PA" in clean_symbol or ".DE" in clean_symbol or ".AS" in clean_symbol else "USD",
            "base_price": 100.0,
            "pe_ratio": 20.0,
            "market_cap": 10000000000,
            "dividend_yield": 1.5,
        })

        # Try Yahoo quote
        live = cls._fetch_yahoo_quote_sync(clean_symbol)
        if live:
            name = meta["name"] if clean_symbol in ASSET_MAP else (live.get("name") or clean_symbol)
            asset_type = meta["asset_type"] if clean_symbol in ASSET_MAP else (live.get("asset_type") or "stock")
            price = live["price"]
            change = live["change"]
            change_percent = live["change_percent"]
            day_high = live["day_high"]
            day_low = live["day_low"]
            high_52w = live["high_52w"]
            low_52w = live["low_52w"]
            volume = live["volume"]
            currency = live["currency"]
        else:
            name = meta.get("name", clean_symbol)
            asset_type = meta.get("asset_type", "stock")
            # Deterministic pseudo-dynamic variation based on timestamp
            base = meta.get("base_price", 100.0)
            seed = sum(ord(c) for c in clean_symbol)
            day_bucket = int(now / 300) + seed
            rand_val = math.sin(day_bucket) * 0.025
            price = round(base * (1 + rand_val), 2)
            change = round(base * rand_val, 2)
            change_percent = round(rand_val * 100, 2)
            day_high = round(price * 1.012, 2)
            day_low = round(price * 0.988, 2)
            high_52w = round(base * 1.28, 2)
            low_52w = round(base * 0.76, 2)
            volume = int(1250000 + abs(math.cos(seed)) * 850000)
            currency = meta.get("currency", "EUR")

        quote_data = {
            "symbol": clean_symbol,
            "name": name,
            "asset_type": asset_type,
            "sector": meta.get("sector", "Aéronautique & Espace" if clean_symbol in ["RKLB", "SPCE", "ASTS", "LMT", "BA"] else "Actions"),
            "price": price,
            "change": change,
            "change_percent": change_percent,
            "currency": currency,
            "day_high": day_high,
            "day_low": day_low,
            "high_52w": high_52w,
            "low_52w": low_52w,
            "volume": volume,
            "market_cap": meta.get("market_cap"),
            "pe_ratio": meta.get("pe_ratio"),
            "dividend_yield": meta.get("dividend_yield"),
            "_cached_at": now,
        }

        _QUOTES_CACHE[clean_symbol] = quote_data
        return quote_data

    @classmethod
    def get_indices(cls) -> List[Dict[str, Any]]:
        """Returns the major world market indices."""
        indices = [a for a in CURATED_MARKET_ASSETS if a["asset_type"] == "index"]
        return [cls.get_quote(idx["symbol"]) for idx in indices]

    @classmethod
    def get_all_stocks(cls) -> List[Dict[str, Any]]:
        """Returns all curated market assets with quotes."""
        return [cls.get_quote(a["symbol"]) for a in CURATED_MARKET_ASSETS]

    KEYWORD_SYNONYMS: Dict[str, List[str]] = {
        "voiture": ["TSLA"],
        "auto": ["TSLA"],
        "automobile": ["TSLA"],
        "electrique": ["TSLA"],
        "luxe": ["MC.PA", "RMS.PA"],
        "mode": ["MC.PA", "RMS.PA"],
        "sac": ["MC.PA", "RMS.PA"],
        "champagne": ["MC.PA"],
        "petrole": ["TTE.PA"],
        "pétrole": ["TTE.PA"],
        "gaz": ["TTE.PA"],
        "energie": ["TTE.PA"],
        "énergie": ["TTE.PA"],
        "ia": ["NVDA", "MSFT", "GOOGL", "ASML.AS"],
        "intelligence artificielle": ["NVDA", "MSFT", "GOOGL"],
        "chips": ["NVDA", "ASML.AS"],
        "puce": ["NVDA", "ASML.AS"],
        "semi-conducteur": ["NVDA", "ASML.AS"],
        "carte graphique": ["NVDA"],
        "gpu": ["NVDA"],
        "iphone": ["AAPL"],
        "mac": ["AAPL"],
        "smartphone": ["AAPL", "GOOGL"],
        "telephone": ["AAPL", "GOOGL"],
        "ordinateur": ["AAPL", "MSFT"],
        "windows": ["MSFT"],
        "cloud": ["MSFT", "AMZN", "GOOGL"],
        "e-commerce": ["AMZN"],
        "livraison": ["AMZN"],
        "moteur de recherche": ["GOOGL"],
        "youtube": ["GOOGL"],
        "reseau social": ["META"],
        "reseaux sociaux": ["META"],
        "instagram": ["META"],
        "whatsapp": ["META"],
        "sante": ["SAN.PA"],
        "santé": ["SAN.PA"],
        "pharma": ["SAN.PA"],
        "medicament": ["SAN.PA"],
        "banque": ["BNP.PA"],
        "monde": ["CW8.PA"],
        "world": ["CW8.PA"],
        "sp500": ["^GSPC", "VUAA.PA"],
        "s&p": ["^GSPC", "VUAA.PA"],
        "cac": ["^FCHI"],
        "cac40": ["^FCHI"],
        "nasdaq": ["^IXIC", "UST.PA"],
        "dax": ["^GDAXI"],
        "spacex": ["RKLB", "TSLA", "ASTS", "SPCE", "LMT", "BA"],
        "space": ["RKLB", "ASTS", "SPCE", "TSLA", "LMT", "BA"],
        "espace": ["RKLB", "ASTS", "SPCE", "TSLA"],
        "fusee": ["RKLB", "SPCE"],
        "fusée": ["RKLB", "SPCE"],
        "satellite": ["ASTS", "RKLB"],
        "starlink": ["TSLA", "ASTS", "RKLB"],
        "rocket": ["RKLB"],
        "defense": ["LMT", "BA", "AIR.PA"],
        "défense": ["LMT", "BA", "AIR.PA"],
        "avion": ["AIR.PA", "BA"],
        "crypto": ["BTC", "ETH", "SOL"],
        "bitcoin": ["BTC"],
        "ethereum": ["ETH"],
        "solana": ["SOL"],
    }

    @classmethod
    def search(cls, query: str) -> List[Dict[str, Any]]:
        """
        Intelligent multi-criteria search:
        1. Exact and substring match on Symbol, Name, Sector
        2. French & English conceptual keyword mapping (e.g. 'voiture' -> TSLA, 'pétrole' -> TotalEnergies)
        3. Real-time fallback to Yahoo Finance global search for unlisted tickers (e.g. PLTR, TSM, AMD)
        """
        q = query.strip().lower()
        if not q:
            return cls.get_all_stocks()

        matched_symbols = set()
        results: List[Dict[str, Any]] = []

        # 1. Match keyword synonyms
        for kw, syms in cls.KEYWORD_SYNONYMS.items():
            if kw in q or q in kw:
                for s in syms:
                    matched_symbols.add(s)

        # 2. Match curated catalog
        for a in CURATED_MARKET_ASSETS:
            sym = a["symbol"].upper()
            name = a["name"].lower()
            sector = (a.get("sector") or "").lower()
            if q in sym.lower() or q in name or q in sector:
                matched_symbols.add(sym)

        # Add all matching curated assets
        for sym in matched_symbols:
            results.append(cls.get_quote(sym))

        # 3. If few results or query looks like a specific company / ticker, query live Yahoo search
        if len(results) < 5 and len(q) >= 2:
            try:
                search_url = f"https://query1.finance.yahoo.com/v1/finance/search?q={httpx._utils.percent_encode(q)}&quotesCount=6&newsCount=0"
                headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
                with httpx.Client(timeout=2.5, headers=headers) as client:
                    resp = client.get(search_url)
                    if resp.status_code == 200:
                        y_quotes = resp.json().get("quotes", [])
                        for item in y_quotes:
                            sym = item.get("symbol", "").upper()
                            q_type = item.get("quoteType", "")
                            if sym and sym not in matched_symbols and q_type in ["EQUITY", "ETF", "INDEX", "CRYPTOCURRENCY", "MUTUALFUND"]:
                                matched_symbols.add(sym)
                                # Fetch full quote
                                quote = cls.get_quote(sym)
                                if item.get("shortname") and quote.get("name") == sym:
                                    quote["name"] = item.get("shortname")
                                if item.get("sector") and quote.get("sector") == "General":
                                    quote["sector"] = item.get("sector")
                                results.append(quote)
                                if len(results) >= 8:
                                    break
            except Exception:
                pass

        return results

    @classmethod
    def get_historical_candles(cls, symbol: str, timeframe: str = "1M") -> List[Dict[str, Any]]:
        """
        Returns real-time and historical price points for interactive charts from Yahoo Finance Chart API.
        Timeframe mapping:
        - 1D: range=1d, interval=5m (Intraday real-time ticks)
        - 1W: range=5d, interval=15m (Multi-day intraday points)
        - 1M: range=1mo, interval=1d (Daily candles)
        - 1Y: range=1y, interval=1d (1-year trading sessions)
        - 5Y: range=5y, interval=1wk (Weekly candles over 5 years)
        - ALL: range=max, interval=1mo (Full asset historical lifetime)
        """
        clean_symbol = symbol.strip().upper()
        cache_key = f"{clean_symbol}_{timeframe}"
        now = time.time()

        cached = _HISTORY_CACHE.get(cache_key)
        if cached and (now - cached.get("_cached_at", 0)) < CACHE_TTL_HISTORY:
            return cached.get("points", [])

        quote = cls.get_quote(clean_symbol)
        curr_price = quote["price"]
        points: List[Dict[str, Any]] = []

        tf_map = {
            "1D": ("1d", "5m"),
            "1W": ("5d", "15m"),
            "1M": ("1mo", "1d"),
            "1Y": ("1y", "1d"),
            "5Y": ("5y", "1wk"),
            "ALL": ("max", "1mo"),
        }
        r_param, i_param = tf_map.get(timeframe.upper(), ("1mo", "1d"))

        # 1. Fetch real historical chart from Yahoo Finance
        try:
            chart_url = f"https://query1.finance.yahoo.com/v8/finance/chart/{clean_symbol}?range={r_param}&interval={i_param}"
            headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
            with httpx.Client(timeout=4.0, headers=headers) as client:
                resp = client.get(chart_url)
                if resp.status_code == 200:
                    data = resp.json()
                    res_list = data.get("chart", {}).get("result", [])
                    if res_list:
                        result = res_list[0]
                        timestamps = result.get("timestamp", [])
                        indicators = result.get("indicators", {}).get("quote", [{}])[0]
                        closes = indicators.get("close", [])
                        volumes = indicators.get("volume", [])

                        from datetime import datetime, timezone
                        for idx, ts in enumerate(timestamps):
                            if idx < len(closes) and closes[idx] is not None:
                                close_val = round(float(closes[idx]), 2)
                                vol_val = int(volumes[idx]) if (idx < len(volumes) and volumes[idx] is not None) else 0
                                dt = datetime.fromtimestamp(ts, tz=timezone.utc)

                                if timeframe.upper() == "1D":
                                    label = dt.strftime("%H:%M")
                                elif timeframe.upper() == "1W":
                                    label = dt.strftime("%d/%m %H:%M")
                                elif timeframe.upper() == "1M":
                                    label = dt.strftime("%d/%m")
                                elif timeframe.upper() in ["1Y", "5Y"]:
                                    label = dt.strftime("%b %y")
                                else:
                                    label = dt.strftime("%m/%y")

                                points.append({
                                    "time": int(ts),
                                    "label": label,
                                    "price": close_val,
                                    "volume": vol_val,
                                })
        except Exception:
            pass

        # 2. Fallback only if Yahoo was unreachable and returned empty
        if not points:
            tf_config = {
                "1D": {"count": 48, "interval_mins": 10, "volatility": 0.008},
                "1W": {"count": 35, "interval_hours": 3, "volatility": 0.02},
                "1M": {"count": 30, "interval_days": 1, "volatility": 0.05},
                "1Y": {"count": 52, "interval_weeks": 1, "volatility": 0.18},
                "5Y": {"count": 60, "interval_months": 1, "volatility": 0.45},
                "ALL": {"count": 80, "interval_months": 1.5, "volatility": 0.65},
            }
            cfg = tf_config.get(timeframe.upper(), tf_config["1M"])
            num_points = cfg["count"]
            volatility = cfg["volatility"]

            seed = sum(ord(c) for c in clean_symbol)
            random.seed(seed + int(now / 3600))

            raw_prices = [1.0]
            for i in range(1, num_points):
                step = (random.random() - 0.48) * (volatility / math.sqrt(num_points))
                new_val = max(0.1, raw_prices[-1] * (1 + step))
                raw_prices.append(new_val)

            last_raw = raw_prices[-1]
            factor = curr_price / last_raw

            from datetime import datetime, timezone, timedelta
            now_dt = datetime.now(timezone.utc)

            for idx, p in enumerate(raw_prices):
                steps_back = num_points - 1 - idx
                if timeframe.upper() == "1D":
                    dt = now_dt - timedelta(minutes=steps_back * 10)
                    label = dt.strftime("%H:%M")
                elif timeframe.upper() == "1W":
                    dt = now_dt - timedelta(hours=steps_back * 3)
                    label = dt.strftime("%d/%m %H:%M")
                elif timeframe.upper() == "1M":
                    dt = now_dt - timedelta(days=steps_back)
                    label = dt.strftime("%d/%m")
                elif timeframe.upper() == "1Y":
                    dt = now_dt - timedelta(weeks=steps_back)
                    label = dt.strftime("%b %y")
                else:
                    dt = now_dt - timedelta(days=int(steps_back * 30))
                    label = dt.strftime("%m/%y")

                val = round(p * factor, 2)
                points.append({
                    "time": int(dt.timestamp()),
                    "label": label,
                    "price": val,
                    "volume": int(quote.get("volume", 1500000) * (0.8 + 0.4 * random.random())),
                })

        _HISTORY_CACHE[cache_key] = {
            "points": points,
            "_cached_at": now,
        }
        return points
