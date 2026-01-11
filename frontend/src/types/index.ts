/**
 * Wayfinder frontend type definitions
 */

export interface Coordinate {
  lat: number
  lng: number
}

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
  created_at: string
  avg_duration_minutes?: number
  best_duration_minutes?: number
  worst_duration_minutes?: number
}

export interface CommuteCreate {
  name: string
  origin_lat: number
  origin_lng: number
  origin_address?: string
  dest_lat: number
  dest_lng: number
  dest_address?: string
  typical_departure_time?: string
}

export interface CommuteHistoryEntry {
  id: string
  commute_id: string
  started_at: string
  ended_at?: string
  duration_minutes?: number
  route_taken?: string
  switched_routes: boolean
  initial_route?: string
}

export interface RouteOption {
  id: string
  name: string
  distance_km: number
  duration_minutes: number
  predicted_duration_minutes: number
  traffic_level: string
  geometry: Coordinate[]
  savings_vs_current: number
  confidence: number
}

export interface RouteComparison {
  current_route: RouteOption
  alternatives: RouteOption[]
  recommended_switch?: string
  recommendation_reason?: string
  last_updated: string
}

export interface OverallStats {
  avg_minutes: number
  best_minutes: number
  worst_minutes: number
}

export interface PatternInsights {
  best_day?: string
  worst_day?: string
  best_departure?: string
  worst_departure?: string
}

export interface CommutePatterns {
  overall?: OverallStats
  trips_recorded: number
  insights?: PatternInsights
  recommendations?: string[]
  by_day?: Record<string, { avg_minutes: number; count: number }>
  by_hour?: Record<string, { avg_minutes: number; count: number }>
}

export interface StartCommuteResponse {
  history_id: string
  routes: RouteComparison
}
