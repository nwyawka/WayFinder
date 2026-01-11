"""
Background scheduler for periodic traffic polling.
Polls traffic for active commutes and triggers alerts.
"""
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from typing import Optional

from app.config import get_settings


scheduler: Optional[AsyncIOScheduler] = None


async def poll_active_commutes():
    """
    Background job that polls traffic for active commutes.
    Called periodically to check if rerouting is recommended.
    """
    # This would:
    # 1. Get list of "active" commutes (users currently driving)
    # 2. For each, recalculate routes
    # 3. If better route found, send notification (websocket/push)
    pass  # Implementation depends on notification mechanism


async def start_scheduler():
    """Start the background scheduler."""
    global scheduler
    settings = get_settings()

    scheduler = AsyncIOScheduler()
    scheduler.add_job(
        poll_active_commutes,
        trigger=IntervalTrigger(seconds=settings.poll_interval_seconds),
        id="traffic_poller",
        replace_existing=True,
    )
    scheduler.start()


async def stop_scheduler():
    """Stop the scheduler gracefully."""
    global scheduler
    if scheduler:
        scheduler.shutdown(wait=False)
        scheduler = None
