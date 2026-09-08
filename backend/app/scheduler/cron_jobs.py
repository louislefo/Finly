from apscheduler.schedulers.asyncio import AsyncIOScheduler
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.user import User
from app.services.sync_service import sync_service

scheduler = AsyncIOScheduler()

async def scheduled_bank_sync():
    db = SessionLocal()
    try:
        active_users = db.query(User).filter(User.auto_sync_enabled == True).all()
        if not active_users:
            print("[Scheduler] Synchronisation automatique inactive (option non activée dans les paramètres).")
            return

        for u in active_users:
            print(f"[Scheduler] Synchronisation automatique en cours pour {u.email} (intervalle: {u.sync_interval_hours}h)...")
            res = await sync_service.sync_all_active_accounts(db, user_id=u.id)
            print(f"[Scheduler] Résultat pour {u.email} : {res}")
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
    print("[Scheduler] Planificateur démarré (synchronisation automatique selon préférences utilisateurs).")

def shutdown_scheduler():
    scheduler.shutdown()
