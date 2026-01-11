"""
Pattern analysis for commute history.
Identifies best times, worst days, and recurring patterns.
"""
from datetime import datetime
from collections import defaultdict
from typing import Optional


def analyze_commute_patterns(history: list) -> dict:
    """
    Analyze historical commute data to find patterns.

    Returns insights like:
    - Best/worst days to commute
    - Best/worst departure times
    - Average duration by day/hour
    - Trend over time
    """
    if not history:
        return {"message": "No data available", "trips_recorded": 0}

    # Group by various dimensions
    by_day = defaultdict(list)
    by_hour = defaultdict(list)
    by_day_hour = defaultdict(list)

    for entry in history:
        if not entry.duration_minutes:
            continue

        started = entry.started_at
        if isinstance(started, str):
            started = datetime.fromisoformat(started.replace("Z", "+00:00"))

        dow = started.weekday()  # 0=Monday
        hour = started.hour

        by_day[dow].append(entry.duration_minutes)
        by_hour[hour].append(entry.duration_minutes)
        by_day_hour[(dow, hour)].append(entry.duration_minutes)

    # Calculate statistics
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

    day_stats = {}
    for dow, durations in by_day.items():
        day_stats[day_names[dow]] = {
            "avg_minutes": round(sum(durations) / len(durations), 1),
            "min_minutes": round(min(durations), 1),
            "max_minutes": round(max(durations), 1),
            "trips": len(durations),
        }

    hour_stats = {}
    for hour, durations in by_hour.items():
        hour_stats[f"{hour:02d}:00"] = {
            "avg_minutes": round(sum(durations) / len(durations), 1),
            "trips": len(durations),
        }

    # Find best and worst
    all_durations = [
        entry.duration_minutes
        for entry in history
        if entry.duration_minutes
    ]

    best_day = min(day_stats.items(), key=lambda x: x[1]["avg_minutes"])[0] if day_stats else None
    worst_day = max(day_stats.items(), key=lambda x: x[1]["avg_minutes"])[0] if day_stats else None

    best_hour = min(hour_stats.items(), key=lambda x: x[1]["avg_minutes"])[0] if hour_stats else None
    worst_hour = max(hour_stats.items(), key=lambda x: x[1]["avg_minutes"])[0] if hour_stats else None

    # Calculate recommendations
    recommendations = generate_recommendations(
        day_stats=day_stats,
        hour_stats=hour_stats,
        best_day=best_day,
        worst_day=worst_day,
        best_hour=best_hour,
        worst_hour=worst_hour,
    )

    return {
        "trips_recorded": len(all_durations),
        "overall": {
            "avg_minutes": round(sum(all_durations) / len(all_durations), 1),
            "best_minutes": round(min(all_durations), 1),
            "worst_minutes": round(max(all_durations), 1),
        },
        "by_day": day_stats,
        "by_hour": dict(sorted(hour_stats.items())),
        "insights": {
            "best_day": best_day,
            "worst_day": worst_day,
            "best_departure": best_hour,
            "worst_departure": worst_hour,
        },
        "recommendations": recommendations,
    }


def generate_recommendations(
    day_stats: dict,
    hour_stats: dict,
    best_day: Optional[str],
    worst_day: Optional[str],
    best_hour: Optional[str],
    worst_hour: Optional[str],
) -> list[str]:
    """Generate actionable recommendations from patterns."""
    recommendations = []

    if best_day and worst_day and best_day != worst_day:
        best_avg = day_stats[best_day]["avg_minutes"]
        worst_avg = day_stats[worst_day]["avg_minutes"]
        diff = worst_avg - best_avg
        if diff > 5:
            recommendations.append(
                f"Consider remote work on {worst_day}s - you save ~{diff:.0f} minutes vs {best_day}s"
            )

    if best_hour and worst_hour and best_hour != worst_hour:
        best_avg = hour_stats[best_hour]["avg_minutes"]
        worst_avg = hour_stats[worst_hour]["avg_minutes"]
        diff = worst_avg - best_avg
        if diff > 5:
            recommendations.append(
                f"Leaving at {best_hour} saves ~{diff:.0f} minutes compared to {worst_hour}"
            )

    if not recommendations:
        recommendations.append("Keep tracking - more data will reveal patterns!")

    return recommendations
