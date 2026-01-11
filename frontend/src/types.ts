export interface Commute {
  id: string
  name: string
  origin_lat: number
  origin_lng: number
  origin_address?: string
  dest_lat: number
  dest_lng: number
  dest_address?: string
  typical_departure_time?: string
  days_of_week: number[]
  created_at: string
  avg_duration_minutes?: number
  best_duration_minutes?: number
  worst_duration_minutes?: number
}

export interface Coordinate {
  lat: number
  lng: number
}

export interface RouteOption {
  id: string
  name: string
  distance_km: number
  duration_minutes: number
  predicted_duration_minutes: number
  traffic_level: 'free' | 'light' | 'moderate' | 'heavy' | 'severe' | 'unknown'
  geometry: Coordinate[]
  savings_vs_current: number
  confidence: number
}

export interface RouteComparison {
  current_route: RouteOption
  alternatives: RouteOption[]
  recommended_switch?: string
  recommendation_reason?: string
}

export interface CommuteHistory {
  id?: string
  commute_id: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
  route_taken?: string
  traffic_conditions?: Record<string, unknown>
  switched_routes: boolean
}

export interface CommutePatterns {
  trips_recorded: number
  overall?: {
    avg_minutes: number
    best_minutes: number
    worst_minutes: number
  }
  by_day?: Record<string, {
    avg_minutes: number
    min_minutes: number
    max_minutes: number
    trips: number
  }>
  by_hour?: Record<string, {
    avg_minutes: number
    trips: number
  }>
  insights?: {
    best_day?: string
    worst_day?: string
    best_departure?: string
    worst_departure?: string
  }
  recommendations?: string[]
}
