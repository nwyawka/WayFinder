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

export interface TurnInstruction {
  type: 'depart' | 'arrive' | 'turn' | 'continue' | 'merge' | 'ramp' | 'fork' | 'roundabout' | 'notification' | 'unknown'
  instruction: string
  distance_m: number
  duration_s: number
  lat: number
  lng: number
  maneuver?: 'left' | 'right' | 'straight' | 'slight_left' | 'slight_right' | 'sharp_left' | 'sharp_right' | 'u_turn' | 'exit'
  road_name?: string
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
  instructions?: TurnInstruction[]
}

export interface TrafficIncident {
  id: string
  type: 'accident' | 'congestion' | 'construction' | 'road_closed' | 'weather' | 'other'
  severity: 'low' | 'medium' | 'high' | 'critical'
  lat: number
  lng: number
  description: string
  delay_seconds?: number
  start_time?: string
  end_time?: string
  source: 'tomtom' | 'here' | 'user'
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

export interface StartCommuteResponse {
  history_id: string
  routes: RouteComparison
}

export interface WeatherCondition {
  condition: string
  condition_id: number
  description: string
  icon: string
  icon_url: string
  temperature_c: number
  feels_like_c: number
  humidity: number
  visibility_m: number
  wind_speed_ms: number
  wind_gust_ms?: number
  rain_1h_mm: number
  snow_1h_mm: number
  driving_impact: 'none' | 'low' | 'moderate' | 'high' | 'severe'
  driving_warning?: string
}

export interface RouteWeather {
  origin: WeatherCondition
  destination: WeatherCondition
  route_impact: 'none' | 'low' | 'moderate' | 'high' | 'severe'
  warnings: string[]
}
