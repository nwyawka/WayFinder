"""Commute management - save routes, track history, learn patterns."""
from fastapi import APIRouter, HTTPException
from typing import Optional
from datetime import datetime
import uuid

from app.models import Commute, CommuteCreate, CommuteHistory, RouteRequest
from app.services.storage import CommuteStorage


router = APIRouter()
storage = CommuteStorage()


@router.post("/", response_model=Commute)
async def create_commute(commute: CommuteCreate):
    """Save a new commute for tracking."""
    new_commute = Commute(
        **commute.model_dump(),
        id=str(uuid.uuid4()),
        created_at=datetime.utcnow(),
    )
    await storage.save_commute(new_commute)
    return new_commute


@router.get("/", response_model=list[Commute])
async def list_commutes():
    """List all saved commutes."""
    return await storage.get_all_commutes()


@router.get("/{commute_id}", response_model=Commute)
async def get_commute(commute_id: str):
    """Get a specific commute."""
    commute = await storage.get_commute(commute_id)
    if not commute:
        raise HTTPException(status_code=404, detail="Commute not found")
    return commute


@router.delete("/{commute_id}")
async def delete_commute(commute_id: str):
    """Delete a commute."""
    success = await storage.delete_commute(commute_id)
    if not success:
        raise HTTPException(status_code=404, detail="Commute not found")
    return {"status": "deleted"}


@router.post("/{commute_id}/start")
async def start_commute(commute_id: str):
    """
    Start tracking a commute. Call this when leaving.
    Returns route options with predictions.
    """
    commute = await storage.get_commute(commute_id)
    if not commute:
        raise HTTPException(status_code=404, detail="Commute not found")

    # Create history entry
    history = CommuteHistory(
        commute_id=commute_id,
        started_at=datetime.utcnow(),
    )
    history_id = await storage.save_history(history)

    # Get route comparison (reuse the routes endpoint logic)
    from app.api.routes import calculate_routes

    route_comparison = await calculate_routes(RouteRequest(
        origin_lat=commute.origin_lat,
        origin_lng=commute.origin_lng,
        dest_lat=commute.dest_lat,
        dest_lng=commute.dest_lng,
    ))

    return {
        "history_id": history_id,
        "routes": route_comparison,
    }


@router.post("/{commute_id}/history/{history_id}/end")
async def end_commute(commute_id: str, history_id: str, route_taken: Optional[str] = None):
    """
    End a commute tracking session. Updates history with actual duration.
    This data feeds the ML model for better predictions.
    """
    history = await storage.get_history(history_id)
    if not history:
        raise HTTPException(status_code=404, detail="History entry not found")

    ended_at = datetime.utcnow()
    duration = (ended_at - history.started_at).total_seconds() / 60

    await storage.update_history(
        history_id,
        ended_at=ended_at,
        duration_minutes=duration,
        route_taken=route_taken,
    )

    # Update commute stats
    await storage.update_commute_stats(commute_id)

    return {
        "duration_minutes": duration,
        "status": "completed",
    }


@router.get("/{commute_id}/history", response_model=list[CommuteHistory])
async def get_commute_history(commute_id: str, limit: int = 30):
    """Get history for a commute to see patterns."""
    return await storage.get_history_for_commute(commute_id, limit=limit)


@router.get("/{commute_id}/patterns")
async def get_commute_patterns(commute_id: str):
    """
    Analyze historical patterns for this commute.
    Returns best/worst times, day-of-week patterns, etc.
    """
    history = await storage.get_history_for_commute(commute_id, limit=90)

    if not history:
        return {"message": "Not enough data yet", "trips_recorded": 0}

    # Analyze patterns
    from app.ml.patterns import analyze_commute_patterns
    patterns = analyze_commute_patterns(history)

    return patterns
