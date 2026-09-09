from fastapi import APIRouter
from app.api.endpoints import auth, woob, accounts, transactions, categories, projects, budgets, sync, rates, real_estate, admin

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(admin.router, prefix="/admin", tags=["Administration"])
api_router.include_router(categories.router, prefix="/categories", tags=["Categories"])
api_router.include_router(budgets.router, prefix="/budgets", tags=["Budgets"])
api_router.include_router(woob.router, prefix="/woob", tags=["Woob Bank Integration"])
api_router.include_router(accounts.router, prefix="/accounts", tags=["Accounts"])
api_router.include_router(transactions.router, prefix="/transactions", tags=["Transactions"])
api_router.include_router(projects.router, prefix="/projects", tags=["Projects"])
api_router.include_router(rates.router, prefix="/rates", tags=["Rates"])
api_router.include_router(real_estate.router, prefix="/real-estate", tags=["Real Estate"])
api_router.include_router(sync.router, prefix="/sync", tags=["Sync"])

