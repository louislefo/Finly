"""
Finly Model Context Protocol (MCP) Server
Standalone and embeddable MCP server exposing read-only financial data and analytics.
"""

import sys
import json
import argparse
from typing import Optional, Dict, Any

from mcp.server.mcpserver import MCPServer
from app.core.database import SessionLocal
from app.mcp.service import (
    get_net_worth_data,
    get_budget_status_data,
    search_transactions_data,
    get_cashflow_forecast_data,
)

def create_mcp_server() -> MCPServer:
    """
    Creates and configures the Finly MCP Server instance with tools and resources.
    """
    server = MCPServer(
        name="Finly",
        instructions="Finly MCP Server provides strictly read-only access to local personal finance data, account balances, budgets, expense transactions, and cashflow forecasts.",
        version="1.0.0",
    )

    @server.tool(
        name="get_net_worth",
        description="Calculates and returns the user's aggregated net worth, breakdown across checking, savings, life insurance, stocks/PEA, and crypto assets.",
    )
    def get_net_worth(user_id: Optional[str] = None) -> str:
        """
        Calculates user's total net worth and asset class breakdown.
        """
        db = SessionLocal()
        try:
            data = get_net_worth_data(db, user_id=user_id)
            return json.dumps(data, indent=2, ensure_ascii=False)
        finally:
            db.close()

    @server.tool(
        name="get_budget_status",
        description="Retrieves current active budget limits and real-time consumption rates (spent, remaining, percentage used) per category.",
    )
    def get_budget_status(
        user_id: Optional[str] = None,
        month: Optional[str] = None,
    ) -> str:
        """
        Retrieves budget status for the specified or current month (YYYY-MM).
        """
        db = SessionLocal()
        try:
            data = get_budget_status_data(db, user_id=user_id, month=month)
            return json.dumps(data, indent=2, ensure_ascii=False)
        finally:
            db.close()

    @server.tool(
        name="search_transactions",
        description="Searches financial transactions with filters for keywords/merchant, category, date bounds, amount bounds, and pagination.",
    )
    def search_transactions(
        query: Optional[str] = None,
        category: Optional[str] = None,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        min_amount: Optional[float] = None,
        max_amount: Optional[float] = None,
        account_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Searches transaction records matching filters.
        """
        db = SessionLocal()
        try:
            data = search_transactions_data(
                db,
                query=query,
                category=category,
                start_date=start_date,
                end_date=end_date,
                min_amount=min_amount,
                max_amount=max_amount,
                account_id=account_id,
                limit=limit,
                offset=offset,
                user_id=user_id,
            )
            return json.dumps(data, indent=2, ensure_ascii=False)
        finally:
            db.close()

    @server.tool(
        name="get_cashflow_forecast",
        description="Calculates forward-looking cashflow projections (inflows vs outflows), fixed recurring subscription burn, and estimated balances for upcoming months.",
    )
    def get_cashflow_forecast(
        months_ahead: int = 3,
        user_id: Optional[str] = None,
    ) -> str:
        """
        Computes cashflow forecast for the next N months.
        """
        db = SessionLocal()
        try:
            data = get_cashflow_forecast_data(db, months_ahead=months_ahead, user_id=user_id)
            return json.dumps(data, indent=2, ensure_ascii=False)
        finally:
            db.close()

    @server.resource(
        "finly://net_worth",
        name="Net Worth Summary",
        description="Real-time consolidated net worth balance and asset allocation.",
        mime_type="application/json",
    )
    def read_net_worth_resource() -> str:
        db = SessionLocal()
        try:
            data = get_net_worth_data(db)
            return json.dumps(data, indent=2, ensure_ascii=False)
        finally:
            db.close()

    @server.resource(
        "finly://budget_status",
        name="Current Month Budget Status",
        description="Real-time monthly envelope budget consumption metrics.",
        mime_type="application/json",
    )
    def read_budget_status_resource() -> str:
        db = SessionLocal()
        try:
            data = get_budget_status_data(db)
            return json.dumps(data, indent=2, ensure_ascii=False)
        finally:
            db.close()

    @server.resource(
        "finly://recent_transactions",
        name="Recent Transactions",
        description="Latest 20 financial transactions sorted by date descending.",
        mime_type="application/json",
    )
    def read_recent_transactions_resource() -> str:
        db = SessionLocal()
        try:
            data = search_transactions_data(db, limit=20)
            return json.dumps(data, indent=2, ensure_ascii=False)
        finally:
            db.close()

    return server


def main():
    parser = argparse.ArgumentParser(description="Finly Model Context Protocol (MCP) Server")
    parser.add_argument(
        "--transport",
        choices=["stdio", "sse"],
        default="stdio",
        help="Transport protocol: 'stdio' for CLI/desktop agents (default) or 'sse' for HTTP streaming.",
    )
    parser.add_argument(
        "--host",
        default="127.0.0.1",
        help="Host to bind for SSE transport (default: 127.0.0.1)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=8001,
        help="Port to bind for SSE transport (default: 8001)",
    )

    args = parser.parse_args()
    server = create_mcp_server()

    if args.transport == "stdio":
        server.run(transport="stdio")
    elif args.transport == "sse":
        server.settings.host = args.host
        server.settings.port = args.port
        server.run(transport="sse")


if __name__ == "__main__":
    main()
