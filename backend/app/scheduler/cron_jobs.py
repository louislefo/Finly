from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.core.database import SessionLocal
from app.services.sync_service import sync_service

scheduler = AsyncIOScheduler()

async def scheduled_bank_sync():
    db = SessionLocal()
    try:
        print("[Scheduler] Lancement de la synchronisation bancaire automatique...")
        result = await sync_service.sync_all_active_accounts(db)
        print(f"[Scheduler] Synchronisation terminée : {result}")
    except Exception as e:
        print(f"[Scheduler] Erreur pendant la synchronisation : {str(e)}")
    finally:
        db.close()

def start_scheduler():
    interval_hours = settings.SYNC_INTERVAL_HOURS
    scheduler.add_job(
        scheduled_bank_sync,
        "interval",
        hours=interval_hours,
        id="bank_sync_job",
        replace_existing=True,
    )
    scheduler.start()
    print(f"[Scheduler] Planificateur activé : synchronisation toutes les {interval_hours} heures.")

def shutdown_scheduler():
    scheduler.shutdown()
