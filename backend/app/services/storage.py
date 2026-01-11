"""
Simple file-based storage for commutes and history.
In production, replace with PostgreSQL or similar.
"""
import json
from pathlib import Path
from typing import Optional
import uuid

from app.models import Commute, CommuteHistory


DATA_DIR = Path(__file__).parent.parent.parent / "data"
COMMUTES_FILE = DATA_DIR / "commutes.json"
HISTORY_FILE = DATA_DIR / "history.json"


class CommuteStorage:
    """File-based storage for commutes and history."""

    def __init__(self):
        DATA_DIR.mkdir(exist_ok=True)
        self._ensure_files()

    def _ensure_files(self):
        """Create data files if they don't exist."""
        if not COMMUTES_FILE.exists():
            COMMUTES_FILE.write_text("[]")
        if not HISTORY_FILE.exists():
            HISTORY_FILE.write_text("[]")

    def _load_commutes(self) -> list[dict]:
        return json.loads(COMMUTES_FILE.read_text())

    def _save_commutes(self, commutes: list[dict]):
        COMMUTES_FILE.write_text(json.dumps(commutes, indent=2, default=str))

    def _load_history(self) -> list[dict]:
        return json.loads(HISTORY_FILE.read_text())

    def _save_history(self, history: list[dict]):
        HISTORY_FILE.write_text(json.dumps(history, indent=2, default=str))

    async def save_commute(self, commute: Commute) -> str:
        """Save a new commute."""
        commutes = self._load_commutes()
        commutes.append(commute.model_dump())
        self._save_commutes(commutes)
        return commute.id

    async def get_commute(self, commute_id: str) -> Optional[Commute]:
        """Get a commute by ID."""
        commutes = self._load_commutes()
        for c in commutes:
            if c["id"] == commute_id:
                return Commute(**c)
        return None

    async def get_all_commutes(self) -> list[Commute]:
        """Get all saved commutes."""
        commutes = self._load_commutes()
        return [Commute(**c) for c in commutes]

    async def delete_commute(self, commute_id: str) -> bool:
        """Delete a commute."""
        commutes = self._load_commutes()
        original_len = len(commutes)
        commutes = [c for c in commutes if c["id"] != commute_id]
        if len(commutes) < original_len:
            self._save_commutes(commutes)
            return True
        return False

    async def update_commute_stats(self, commute_id: str):
        """Update commute statistics from history."""
        history = await self.get_history_for_commute(commute_id)
        if not history:
            return

        durations = [h.duration_minutes for h in history if h.duration_minutes]
        if not durations:
            return

        commutes = self._load_commutes()
        for c in commutes:
            if c["id"] == commute_id:
                c["avg_duration_minutes"] = sum(durations) / len(durations)
                c["best_duration_minutes"] = min(durations)
                c["worst_duration_minutes"] = max(durations)
                break

        self._save_commutes(commutes)

    async def save_history(self, history: CommuteHistory) -> str:
        """Save a new history entry."""
        history_id = str(uuid.uuid4())
        all_history = self._load_history()
        entry = history.model_dump()
        entry["id"] = history_id
        all_history.append(entry)
        self._save_history(all_history)
        return history_id

    async def get_history(self, history_id: str) -> Optional[CommuteHistory]:
        """Get a history entry by ID."""
        all_history = self._load_history()
        for h in all_history:
            if h.get("id") == history_id:
                return CommuteHistory(**h)
        return None

    async def update_history(self, history_id: str, **updates):
        """Update a history entry."""
        all_history = self._load_history()
        for h in all_history:
            if h.get("id") == history_id:
                h.update(updates)
                break
        self._save_history(all_history)

    async def get_history_for_commute(
        self, commute_id: str, limit: int = 30
    ) -> list[CommuteHistory]:
        """Get history for a specific commute."""
        all_history = self._load_history()
        filtered = [h for h in all_history if h["commute_id"] == commute_id]
        # Sort by started_at descending
        filtered.sort(key=lambda h: h.get("started_at", ""), reverse=True)
        return [CommuteHistory(**h) for h in filtered[:limit]]
