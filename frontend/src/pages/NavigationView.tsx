import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline, Marker, Circle, useMap } from 'react-leaflet'
import {
  AlertTriangle,
  Volume2,
  VolumeX,
  X,
  Navigation2,
  ArrowUp,
  ArrowLeft,
  ArrowRight,
  CornerUpLeft,
  CornerUpRight,
  ArrowUpLeft,
  ArrowUpRight,
  RotateCcw,
  LogOut,
  Cloud,
  CloudRain,
  CloudSnow,
  Sun,
  CloudLightning,
  CloudFog,
  Thermometer,
  Wind,
} from 'lucide-react'
import { api } from '../lib/api'
import { RouteOption, Coordinate, TurnInstruction, TrafficIncident } from '../types'
import { useGeolocation, Position, calculateDistance } from '../hooks/useGeolocation'
import { useNotifications, sendRouteAlert, sendArrivalAlert } from '../hooks/useNotifications'
import clsx from 'clsx'
import L from 'leaflet'

// Fix Leaflet marker icon issue
delete (L.Icon.Default.prototype as any)._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})

const TRAFFIC_COLORS: Record<string, string> = {
  free: '#22c55e',
  light: '#84cc16',
  moderate: '#eab308',
  heavy: '#f97316',
  severe: '#ef4444',
  unknown: '#3b82f6',
}

const INCIDENT_COLORS: Record<string, string> = {
  accident: '#ef4444',
  congestion: '#f97316',
  construction: '#eab308',
  road_closed: '#dc2626',
  weather: '#3b82f6',
  other: '#6b7280',
}

// Custom user position marker
const createUserIcon = (heading: number | null) => {
  return L.divIcon({
    className: 'user-position-marker',
    html: `
      <div style="
        width: 24px;
        height: 24px;
        background: #3b82f6;
        border: 3px solid white;
        border-radius: 50%;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        position: relative;
      ">
        ${heading !== null ? `
          <div style="
            position: absolute;
            top: -8px;
            left: 50%;
            transform: translateX(-50%) rotate(${heading}deg);
            width: 0;
            height: 0;
            border-left: 6px solid transparent;
            border-right: 6px solid transparent;
            border-bottom: 10px solid #3b82f6;
          "></div>
        ` : ''}
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  })
}

// Custom incident marker
const createIncidentIcon = (type: string) => {
  const color = INCIDENT_COLORS[type] || INCIDENT_COLORS.other
  return L.divIcon({
    className: 'incident-marker',
    html: `
      <div style="
        width: 28px;
        height: 28px;
        background: ${color};
        border: 2px solid white;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
          <path d="M12 2L1 21h22L12 2zm0 3.83L19.13 19H4.87L12 5.83zM11 10v4h2v-4h-2zm0 6v2h2v-2h-2z"/>
        </svg>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })
}

// Map component that follows user and rotates based on heading
function NavigationMap({
  position,
  heading,
  followUser
}: {
  position: Position | null
  heading: number | null
  followUser: boolean
}) {
  const map = useMap()

  useEffect(() => {
    if (position && followUser) {
      map.setView([position.lat, position.lng], 17, { animate: true })
    }
  }, [position, followUser, map])

  // Rotate map based on heading (north-up vs heading-up)
  useEffect(() => {
    if (heading !== null && followUser) {
      const container = map.getContainer()
      // Note: Full rotation would require Leaflet plugins or Mapbox GL
      // For now, we rotate the user marker instead
      container.style.transform = ''
    }
  }, [heading, followUser, map])

  return null
}

// Get maneuver icon
function ManeuverIcon({ maneuver, className }: { maneuver?: string, className?: string }) {
  const iconProps = { className: clsx('w-8 h-8', className) }

  switch (maneuver) {
    case 'left':
      return <ArrowLeft {...iconProps} />
    case 'right':
      return <ArrowRight {...iconProps} />
    case 'slight_left':
      return <ArrowUpLeft {...iconProps} />
    case 'slight_right':
      return <ArrowUpRight {...iconProps} />
    case 'sharp_left':
      return <CornerUpLeft {...iconProps} />
    case 'sharp_right':
      return <CornerUpRight {...iconProps} />
    case 'u_turn':
      return <RotateCcw {...iconProps} />
    case 'exit':
      return <LogOut {...iconProps} />
    case 'straight':
    default:
      return <ArrowUp {...iconProps} />
  }
}

// Format distance for display
function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }
  return `${(meters / 1000).toFixed(1)} km`
}

// Format duration for display
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`
  }
  const hours = Math.floor(minutes / 60)
  const mins = Math.round(minutes % 60)
  return `${hours}h ${mins}m`
}

// Weather icon based on condition
function WeatherIcon({ conditionId, className }: { conditionId: number, className?: string }) {
  const iconProps = { className: clsx('w-6 h-6', className) }

  // OpenWeatherMap condition codes
  if (conditionId >= 200 && conditionId < 300) {
    return <CloudLightning {...iconProps} /> // Thunderstorm
  } else if (conditionId >= 300 && conditionId < 400) {
    return <CloudRain {...iconProps} /> // Drizzle
  } else if (conditionId >= 500 && conditionId < 600) {
    return <CloudRain {...iconProps} /> // Rain
  } else if (conditionId >= 600 && conditionId < 700) {
    return <CloudSnow {...iconProps} /> // Snow
  } else if (conditionId >= 700 && conditionId < 800) {
    return <CloudFog {...iconProps} /> // Fog/Mist
  } else if (conditionId === 800) {
    return <Sun {...iconProps} /> // Clear
  } else {
    return <Cloud {...iconProps} /> // Clouds
  }
}

// Weather impact colors
const WEATHER_IMPACT_COLORS: Record<string, string> = {
  none: '#22c55e',
  low: '#84cc16',
  moderate: '#eab308',
  high: '#f97316',
  severe: '#ef4444',
}

export function NavigationView() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [followUser, setFollowUser] = useState(true)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const [currentInstructionIndex, setCurrentInstructionIndex] = useState(0)
  const lastSpokenRef = useRef<number>(-1)
  const hasArrivedRef = useRef(false)
  const mapRef = useRef<L.Map | null>(null)

  // GPS tracking with high accuracy
  const { position, error: geoError, isTracking, startTracking, stopTracking } = useGeolocation({
    enableHighAccuracy: true,
  })

  // Notifications
  const { sendNotification } = useNotifications()

  // Fetch routes data
  const { data: routeData, isLoading, refetch } = useQuery({
    queryKey: ['navigation-routes', id],
    queryFn: async () => {
      const response = await api.calculateRoutes(id!)
      return response
    },
    refetchInterval: 60000, // Refresh every minute
  })

  // Fetch incidents
  const { data: incidents } = useQuery({
    queryKey: ['incidents', id],
    queryFn: () => api.getIncidents(id!),
    refetchInterval: 120000, // Refresh every 2 minutes
    enabled: !!id,
  })

  // Fetch weather
  const { data: weather } = useQuery({
    queryKey: ['weather', id],
    queryFn: () => api.getWeather(id!),
    refetchInterval: 600000, // Refresh every 10 minutes
    enabled: !!id,
  })

  // Start navigation on mount
  useEffect(() => {
    const startNavigation = async () => {
      if (!historyId && id) {
        try {
          const response = await api.startCommute(id)
          setHistoryId(response.history_id)
          setStartTime(new Date())
          startTracking()
        } catch (error) {
          console.error('Failed to start navigation:', error)
        }
      }
    }
    startNavigation()
  }, [id])

  // Get current route
  const currentRoute: RouteOption | null = routeData?.current_route || null
  const instructions = currentRoute?.instructions || []
  const destinationCoords = currentRoute?.geometry?.length
    ? currentRoute.geometry[currentRoute.geometry.length - 1]
    : null

  // Find next instruction based on current position
  const findNextInstruction = useCallback((pos: Position): number => {
    if (!instructions.length) return 0

    let minDistance = Infinity
    let closestIndex = 0

    for (let i = 0; i < instructions.length; i++) {
      const inst = instructions[i]
      const distance = calculateDistance(pos, { lat: inst.lat, lng: inst.lng })

      // Find the closest upcoming instruction (within 500m)
      if (distance < minDistance && distance < 0.5) {
        minDistance = distance
        closestIndex = i
      }
    }

    return closestIndex
  }, [instructions])

  // Update current instruction based on position
  useEffect(() => {
    if (position && instructions.length > 0) {
      const nextIndex = findNextInstruction(position)
      if (nextIndex !== currentInstructionIndex) {
        setCurrentInstructionIndex(nextIndex)
      }
    }
  }, [position, instructions, findNextInstruction, currentInstructionIndex])

  // Voice guidance
  const speakInstruction = useCallback((instruction: TurnInstruction, distanceAway: number) => {
    if (!audioEnabled || !('speechSynthesis' in window)) return

    let announcement = ''
    if (distanceAway > 0.3) {
      announcement = `In ${formatDistance(distanceAway * 1000)}, ${instruction.instruction}`
    } else if (distanceAway > 0.05) {
      announcement = instruction.instruction
    }

    if (announcement) {
      const utterance = new SpeechSynthesisUtterance(announcement)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      speechSynthesis.cancel() // Cancel any ongoing speech
      speechSynthesis.speak(utterance)
    }
  }, [audioEnabled])

  // Announce upcoming turns
  useEffect(() => {
    if (!position || !instructions.length) return

    const currentInstruction = instructions[currentInstructionIndex]
    if (!currentInstruction) return

    const distanceToTurn = calculateDistance(position, {
      lat: currentInstruction.lat,
      lng: currentInstruction.lng
    })

    // Announce at 500m, 200m, and 50m
    const announceDistances = [0.5, 0.2, 0.05]

    for (const threshold of announceDistances) {
      if (distanceToTurn <= threshold && lastSpokenRef.current < currentInstructionIndex) {
        speakInstruction(currentInstruction, distanceToTurn)
        lastSpokenRef.current = currentInstructionIndex
        break
      }
    }
  }, [position, instructions, currentInstructionIndex, speakInstruction])

  // Check for arrival
  useEffect(() => {
    if (position && destinationCoords && !hasArrivedRef.current) {
      const distance = calculateDistance(position, destinationCoords)
      if (distance <= 0.1) { // 100 meters
        hasArrivedRef.current = true

        // Announce arrival
        if (audioEnabled && 'speechSynthesis' in window) {
          const duration = startTime
            ? Math.round((new Date().getTime() - startTime.getTime()) / 60000)
            : 0
          const utterance = new SpeechSynthesisUtterance(
            `You have arrived at your destination. Trip completed in ${duration} minutes.`
          )
          speechSynthesis.speak(utterance)
        }

        // Send notification
        if (startTime) {
          const duration = (new Date().getTime() - startTime.getTime()) / 60000
          sendArrivalAlert(sendNotification, duration)
        }

        // End commute after delay
        setTimeout(async () => {
          if (historyId) {
            await api.endCommute(id!, historyId, currentRoute?.id)
            stopTracking()
            navigate('/')
          }
        }, 3000)
      }
    }
  }, [position, destinationCoords, historyId, id, startTime, audioEnabled, sendNotification, navigate, stopTracking, currentRoute])

  // Check for route switch recommendations
  useEffect(() => {
    if (routeData?.recommended_switch) {
      const alt = routeData.alternatives?.find(a => a.id === routeData.recommended_switch)
      if (alt) {
        sendRouteAlert(sendNotification, alt.name, alt.savings_vs_current)
        if (audioEnabled && 'speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(
            `Faster route available. Switch to ${alt.name} to save ${Math.round(alt.savings_vs_current)} minutes.`
          )
          speechSynthesis.speak(utterance)
        }
      }
    }
  }, [routeData?.recommended_switch])

  // Calculate stats
  const distanceRemaining = position && destinationCoords
    ? calculateDistance(position, destinationCoords)
    : currentRoute?.distance_km || 0

  const etaMinutes = currentRoute?.predicted_duration_minutes || 0
  const currentInstruction = instructions[currentInstructionIndex]
  const nextInstruction = instructions[currentInstructionIndex + 1]

  const distanceToNextTurn = position && currentInstruction
    ? calculateDistance(position, { lat: currentInstruction.lat, lng: currentInstruction.lng })
    : 0

  // End navigation manually
  const handleEndNavigation = async () => {
    if (historyId) {
      await api.endCommute(id!, historyId, currentRoute?.id)
    }
    stopTracking()
    navigate('/')
  }

  if (isLoading || !currentRoute) {
    return (
      <div className="fixed inset-0 bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Starting navigation...</p>
          {geoError && <p className="text-red-400 mt-2">{geoError}</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-gray-900 flex flex-col">
      {/* Top instruction panel */}
      <div className="absolute top-0 left-0 right-0 z-[1000] bg-gradient-to-b from-gray-900 via-gray-900/95 to-transparent pb-8 pt-4 px-4">
        {/* Current instruction */}
        {currentInstruction && (
          <div className="bg-blue-600 rounded-xl p-4 shadow-lg mb-3">
            <div className="flex items-center gap-4">
              <div className="bg-blue-500 rounded-lg p-3">
                <ManeuverIcon maneuver={currentInstruction.maneuver} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="text-sm text-blue-200 font-medium">
                  {formatDistance(distanceToNextTurn * 1000)}
                </div>
                <div className="text-xl font-bold text-white">
                  {currentInstruction.instruction}
                </div>
                {currentInstruction.road_name && (
                  <div className="text-sm text-blue-200 mt-1">
                    {currentInstruction.road_name}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Next instruction preview */}
        {nextInstruction && (
          <div className="bg-gray-800/90 rounded-lg px-4 py-2 flex items-center gap-3">
            <div className="text-gray-400">
              <ManeuverIcon maneuver={nextInstruction.maneuver} className="w-5 h-5" />
            </div>
            <div className="text-sm text-gray-300">
              Then {nextInstruction.instruction.toLowerCase()}
            </div>
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1">
        <MapContainer
          center={position ? [position.lat, position.lng] : [39.8283, -98.5795]}
          zoom={17}
          className="h-full w-full"
          zoomControl={false}
          ref={mapRef}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <NavigationMap
            position={position}
            heading={position?.heading || null}
            followUser={followUser}
          />

          {/* Route line */}
          <Polyline
            positions={currentRoute.geometry.map((p: Coordinate) => [p.lat, p.lng] as [number, number])}
            color={TRAFFIC_COLORS[currentRoute.traffic_level]}
            weight={8}
            opacity={0.9}
          />

          {/* Alternative routes (dimmed) */}
          {routeData?.alternatives?.map((route: RouteOption) => (
            <Polyline
              key={route.id}
              positions={route.geometry.map((p: Coordinate) => [p.lat, p.lng] as [number, number])}
              color="#6b7280"
              weight={4}
              opacity={0.4}
              dashArray="10, 10"
            />
          ))}

          {/* User position */}
          {position && (
            <>
              <Circle
                center={[position.lat, position.lng]}
                radius={position.accuracy}
                pathOptions={{ color: '#3b82f6', fillOpacity: 0.15, weight: 1 }}
              />
              <Marker
                position={[position.lat, position.lng]}
                icon={createUserIcon(position.heading || null)}
              />
            </>
          )}

          {/* Destination marker */}
          {destinationCoords && (
            <Marker position={[destinationCoords.lat, destinationCoords.lng]} />
          )}

          {/* Incident markers */}
          {incidents?.map((incident: TrafficIncident) => (
            <Marker
              key={incident.id}
              position={[incident.lat, incident.lng]}
              icon={createIncidentIcon(incident.type)}
            />
          ))}
        </MapContainer>
      </div>

      {/* Bottom controls and info */}
      <div className="absolute bottom-0 left-0 right-0 z-[1000] bg-gradient-to-t from-gray-900 via-gray-900/95 to-transparent pt-8 pb-6 px-4">
        {/* Route switch recommendation */}
        {routeData?.recommended_switch && (
          <div className="bg-yellow-600/90 rounded-xl p-3 mb-4 flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-200" />
            <div className="flex-1">
              <div className="text-yellow-100 font-medium">Faster route available</div>
              <div className="text-yellow-200 text-sm">{routeData.recommendation_reason}</div>
            </div>
            <button
              onClick={() => refetch()}
              className="bg-yellow-500 hover:bg-yellow-400 px-4 py-2 rounded-lg text-sm font-medium text-yellow-900"
            >
              Switch
            </button>
          </div>
        )}

        {/* Stats bar */}
        <div className="bg-gray-800 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {formatDuration(etaMinutes)}
              </div>
              <div className="text-xs text-gray-400">ETA</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {distanceRemaining.toFixed(1)} km
              </div>
              <div className="text-xs text-gray-400">Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">
                {position?.speed ? Math.round(position.speed * 3.6) : '--'} km/h
              </div>
              <div className="text-xs text-gray-400">Speed</div>
            </div>
          </div>

          {/* Traffic indicator */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: TRAFFIC_COLORS[currentRoute.traffic_level] }}
            />
            <span className="text-sm text-gray-400 capitalize">
              {currentRoute.traffic_level} traffic
            </span>
            {incidents && incidents.length > 0 && (
              <span className="text-sm text-orange-400 ml-auto">
                {incidents.length} incident{incidents.length > 1 ? 's' : ''} ahead
              </span>
            )}
          </div>
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setFollowUser(!followUser)}
            className={clsx(
              'flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors',
              followUser ? 'bg-blue-600' : 'bg-gray-700'
            )}
          >
            <Navigation2 className="w-5 h-5" />
            <span className="font-medium">{followUser ? 'Following' : 'Free'}</span>
          </button>

          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={clsx(
              'flex-1 py-3 rounded-xl flex items-center justify-center gap-2 transition-colors',
              audioEnabled ? 'bg-blue-600' : 'bg-gray-700'
            )}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            <span className="font-medium">{audioEnabled ? 'Voice On' : 'Voice Off'}</span>
          </button>

          <button
            onClick={handleEndNavigation}
            className="bg-red-600 hover:bg-red-500 py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-colors"
          >
            <X className="w-5 h-5" />
            <span className="font-medium">End</span>
          </button>
        </div>
      </div>

      {/* Top right status indicators */}
      <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
        {/* Tracking indicator */}
        <div className="flex items-center gap-2 bg-gray-900/80 rounded-full px-3 py-1.5">
          <div className={clsx(
            'w-2 h-2 rounded-full',
            isTracking ? 'bg-green-500 animate-pulse' : 'bg-gray-500'
          )} />
          <span className="text-xs text-gray-300">
            {isTracking ? 'GPS Active' : 'GPS Inactive'}
          </span>
        </div>

        {/* Weather widget */}
        {weather && (
          <div className="bg-gray-900/80 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <WeatherIcon conditionId={weather.origin.condition_id} className="text-white" />
              <div className="flex items-center gap-1">
                <Thermometer className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-white font-medium">
                  {Math.round(weather.origin.temperature_c)}°
                </span>
              </div>
              {weather.origin.wind_speed_ms > 5 && (
                <div className="flex items-center gap-1">
                  <Wind className="w-4 h-4 text-gray-400" />
                  <span className="text-xs text-gray-300">
                    {Math.round(weather.origin.wind_speed_ms * 3.6)} km/h
                  </span>
                </div>
              )}
            </div>
            {weather.route_impact !== 'none' && (
              <div className="flex items-center gap-1 mt-1">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: WEATHER_IMPACT_COLORS[weather.route_impact] }}
                />
                <span className="text-xs text-gray-400 capitalize">
                  {weather.route_impact} impact
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Weather warning banner */}
      {weather && weather.warnings.length > 0 && (
        <div className="absolute top-32 left-4 right-4 z-[1000]">
          <div className="bg-orange-600/90 rounded-lg px-4 py-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-200 flex-shrink-0" />
            <span className="text-sm text-orange-100">
              {weather.warnings[0]}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
