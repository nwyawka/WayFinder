"""Route calculation and comparison endpoints."""
from fastapi import APIRouter, HTTPException

from app.models import RouteRequest, RouteOption, RouteComparison, Coordinate
from app.services.routing import RoutingService
from app.services.traffic import TrafficAggregator
from app.ml.predictor import TrafficPredictor


router = APIRouter()
routing_service = RoutingService()
traffic_aggregator = TrafficAggregator()
predictor = TrafficPredictor()


@router.post("/calculate", response_model=RouteComparison)
async def calculate_routes(request: RouteRequest):
    """
    Calculate multiple route options with ML-enhanced traffic predictions.
    Returns current best route and alternatives with switch recommendations.
    """
    try:
        # Get base routes from routing service
        routes = await routing_service.get_routes(
            origin=(request.origin_lat, request.origin_lng),
            destination=(request.dest_lat, request.dest_lng),
            alternatives=True,
        )

        if not routes:
            raise HTTPException(status_code=404, detail="No routes found")

        # Get current traffic for each route
        traffic_data = await traffic_aggregator.get_traffic_for_routes(routes)

        # Apply ML predictions
        enhanced_routes = []
        for route, traffic in zip(routes, traffic_data):
            predicted_duration = predictor.predict_duration(
                route=route,
                current_traffic=traffic,
                horizon_minutes=30,
            )
            enhanced_routes.append({
                **route,
                "predicted_duration_minutes": predicted_duration,
                "traffic_level": traffic.get("level", "unknown"),
                "confidence": predictor.get_confidence(route),
            })

        # Sort by predicted duration
        enhanced_routes.sort(key=lambda r: r["predicted_duration_minutes"])

        current = enhanced_routes[0]
        alternatives = enhanced_routes[1:]

        # Calculate savings for each alternative
        for alt in alternatives:
            alt["savings_vs_current"] = current["predicted_duration_minutes"] - alt["predicted_duration_minutes"]

        # Check if we should recommend a switch
        recommended_switch = None
        recommendation_reason = None

        # This is where the "aggressive rerouting" logic lives
        from app.config import get_settings
        settings = get_settings()

        for alt in alternatives:
            if alt["savings_vs_current"] >= settings.reroute_threshold_minutes:
                recommended_switch = alt["id"]
                recommendation_reason = (
                    f"Switch to {alt['name']} to save ~{alt['savings_vs_current']:.1f} minutes. "
                    f"Traffic on current route is {current['traffic_level']}."
                )
                break

        # Convert geometry to Coordinate objects
        current["geometry"] = [Coordinate(**p) for p in current.get("geometry", [])]
        current["savings_vs_current"] = 0

        for alt in alternatives:
            alt["geometry"] = [Coordinate(**p) for p in alt.get("geometry", [])]

        return RouteComparison(
            current_route=RouteOption(**current),
            alternatives=[RouteOption(**alt) for alt in alternatives],
            recommended_switch=recommended_switch,
            recommendation_reason=recommendation_reason,
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/traffic/{route_id}")
async def get_route_traffic(route_id: str):
    """Get current traffic conditions for a specific saved route."""
    traffic = await traffic_aggregator.get_traffic_by_route_id(route_id)
    if not traffic:
        raise HTTPException(status_code=404, detail="Route not found")
    return traffic
