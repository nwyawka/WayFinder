import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline, Marker, Popup, Circle, useMap } from 'react-leaflet'
import { AlertTriangle, CheckCircle, Clock, Navigation, Volume2, VolumeX } from 'lucide-react'
import { api } from '../lib/api'
import { RouteOption, Coordinate } from '../types'
import { useGeolocation, calculateDistance } from '../hooks/useGeolocation'
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
  unknown: '#6b7280',
}

// Component to follow user position on map
function FollowUser({ position }: { position: Position | null }) {
  const map = useMap()

  useEffect(() => {
    if (position) {
      map.setView([position.lat, position.lng], map.getZoom())
    }
  }, [position, map])

  return null
}

export function ActiveCommute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)
  const [followUser, setFollowUser] = useState(true)
  const [audioEnabled, setAudioEnabled] = useState(true)
  const [startTime, setStartTime] = useState<Date | null>(null)
  const lastAlertRef = useRef<string | null>(null)
  const hasArrivedRef = useRef(false)

  // GPS tracking
  const { position, error: geoError, isTracking, startTracking, stopTracking } = useGeolocation({
    enableHighAccuracy: true,
  })

  // Notifications
  const { permission, requestPermission, sendNotification } = useNotifications()

  // Start commute tracking
  const startMutation = useMutation({
    mutationFn: () => api.startCommute(id!),
    onSuccess: (data) => {
      setHistoryId(data.history_id)
      setStartTime(new Date())
      startTracking()
    },
  })

  // End commute
  const endMutation = useMutation({
    mutationFn: () => api.endCommute(id!, historyId!, selectedRoute),
    onSuccess: () => {
      stopTracking()
      navigate('/')
    },
  })

  // Get route comparison (polls every 30s)
  const { data: routeData, isLoading } = useQuery({
    queryKey: ['routes', id, position?.lat, position?.lng],
    queryFn: () => api.calculateRoutes(id!),
    enabled: !!historyId,
    refetchInterval: 30000, // Poll every 30 seconds
  })

  // Request notification permission and auto-start on mount
  useEffect(() => {
    if (permission === 'default') {
      requestPermission()
    }
    if (!historyId) {
      startMutation.mutate()
    }
  }, [id])

  // Check for route recommendations and alert user
  useEffect(() => {
    if (routeData?.recommended_switch && routeData.recommended_switch !== lastAlertRef.current) {
      lastAlertRef.current = routeData.recommended_switch
      const alt = routeData.alternatives.find((a: RouteOption) => a.id === routeData.recommended_switch)
      if (alt) {
        // Send notification
        sendRouteAlert(sendNotification, alt.name, alt.savings_vs_current)

        // Speak alert if audio enabled
        if (audioEnabled && 'speechSynthesis' in window) {
          const msg = new SpeechSynthesisUtterance(
            `Switch to ${alt.name} to save ${Math.round(alt.savings_vs_current)} minutes`
          )
          speechSynthesis.speak(msg)
        }
      }
    }
  }, [routeData?.recommended_switch, audioEnabled, sendNotification])

  // Extract destination coordinates
  const destinationCoords = routeData?.current_route?.geometry?.length
    ? routeData.current_route.geometry[routeData.current_route.geometry.length - 1]
    : null

  const handleArrival = () => {
    if (hasArrivedRef.current) return // Prevent multiple triggers
    hasArrivedRef.current = true

    if (startTime) {
      const duration = (new Date().getTime() - startTime.getTime()) / 60000
      sendArrivalAlert(sendNotification, duration)

      // Voice announcement
      if (audioEnabled && 'speechSynthesis' in window) {
        const msg = new SpeechSynthesisUtterance(
          `You have arrived. Commute completed in ${Math.round(duration)} minutes.`
        )
        speechSynthesis.speak(msg)
      }
    }
    endMutation.mutate()
  }

  // Auto-end commute when within 100 meters of destination
  useEffect(() => {
    if (position && destinationCoords && !hasArrivedRef.current) {
      const distance = calculateDistance(position, destinationCoords)
      if (distance <= 0.1) { // 100 meters
        handleArrival()
      }
    }
  }, [position, destinationCoords])

  // Calculate elapsed time
  const elapsedMinutes = startTime
    ? Math.floor((new Date().getTime() - startTime.getTime()) / 60000)
    : 0

  // Calculate remaining distance
  const remainingDistance = position && destinationCoords
    ? calculateDistance(position, destinationCoords)
    : null

  if (isLoading || !routeData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Calculating routes...</p>
          {geoError && <p className="text-red-400 mt-2">{geoError}</p>}
        </div>
      </div>
    )
  }

  const { current_route, alternatives, recommended_switch, recommendation_reason } = routeData

  // Calculate map bounds
  const allPoints: Coordinate[] = [
    ...current_route.geometry,
    ...alternatives.flatMap((a: RouteOption) => a.geometry),
  ]
  const bounds = allPoints.length > 0
    ? L.latLngBounds(allPoints.map((p: Coordinate) => [p.lat, p.lng] as [number, number]))
    : undefined

  return (
    <div className="space-y-4">
      {/* Live Status Bar */}
      <div className="bg-gray-800 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={clsx(
              "w-3 h-3 rounded-full",
              isTracking ? "bg-green-500 animate-pulse" : "bg-gray-500"
            )} />
            <span className="text-sm text-gray-400">
              {isTracking ? "Tracking" : "Not tracking"}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-gray-400">Elapsed: </span>
            <span className="font-mono">{elapsedMinutes} min</span>
          </div>
          {remainingDistance !== null && (
            <div className="text-sm">
              <span className="text-gray-400">Remaining: </span>
              <span className="font-mono">{remainingDistance.toFixed(1)} km</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFollowUser(!followUser)}
            className={clsx(
              "p-2 rounded-lg transition-colors",
              followUser ? "bg-blue-600" : "bg-gray-700"
            )}
            title={followUser ? "Following your position" : "Free map movement"}
          >
            <Navigation className="w-5 h-5" />
          </button>
          <button
            onClick={() => setAudioEnabled(!audioEnabled)}
            className={clsx(
              "p-2 rounded-lg transition-colors",
              audioEnabled ? "bg-blue-600" : "bg-gray-700"
            )}
            title={audioEnabled ? "Voice alerts on" : "Voice alerts off"}
          >
            {audioEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Recommendation Alert */}
      {recommended_switch && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4 flex items-start gap-3 animate-pulse">
          <AlertTriangle className="w-6 h-6 text-yellow-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="font-semibold text-yellow-400">Route Change Recommended</h3>
            <p className="text-yellow-200 text-sm mt-1">{recommendation_reason}</p>
          </div>
          <button
            onClick={() => setSelectedRoute(recommended_switch)}
            className="bg-yellow-600 hover:bg-yellow-700 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Switch Route
          </button>
        </div>
      )}

      {/* Map and Routes */}
      <div className="grid lg:grid-cols-3 gap-4">
        {/* Map */}
        <div className="lg:col-span-2 bg-gray-800 rounded-lg overflow-hidden h-[500px]">
          <MapContainer
            bounds={bounds}
            className="h-full w-full"
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            {followUser && <FollowUser position={position} />}

            {/* Current route */}
            <Polyline
              positions={current_route.geometry.map((p: Coordinate) => [p.lat, p.lng] as [number, number])}
              color={TRAFFIC_COLORS[current_route.traffic_level]}
              weight={6}
              opacity={selectedRoute === current_route.id ? 1 : 0.7}
            />

            {/* Alternative routes */}
            {alternatives.map((route: RouteOption) => (
              <Polyline
                key={route.id}
                positions={route.geometry.map((p: Coordinate) => [p.lat, p.lng] as [number, number])}
                color={TRAFFIC_COLORS[route.traffic_level]}
                weight={4}
                opacity={selectedRoute === route.id ? 1 : 0.4}
                dashArray={selectedRoute === route.id ? undefined : '10, 10'}
              />
            ))}

            {/* User position */}
            {position && (
              <>
                <Circle
                  center={[position.lat, position.lng]}
                  radius={position.accuracy}
                  pathOptions={{ color: '#3b82f6', fillOpacity: 0.1 }}
                />
                <Marker position={[position.lat, position.lng]}>
                  <Popup>
                    You are here
                    {position.speed && <><br />Speed: {Math.round(position.speed * 3.6)} km/h</>}
                  </Popup>
                </Marker>
              </>
            )}

            {/* Destination marker */}
            {destinationCoords && (
              <Marker position={[destinationCoords.lat, destinationCoords.lng]}>
                <Popup>Destination</Popup>
              </Marker>
            )}
          </MapContainer>
        </div>

        {/* Route Options */}
        <div className="space-y-3">
          <h3 className="font-semibold text-lg">Route Options</h3>

          {/* Current route */}
          <RouteCard
            route={current_route}
            isCurrent={true}
            isSelected={selectedRoute === current_route.id}
            onSelect={() => setSelectedRoute(current_route.id)}
          />

          {/* Alternatives */}
          {alternatives.map((route: RouteOption) => (
            <RouteCard
              key={route.id}
              route={route}
              isCurrent={false}
              isSelected={selectedRoute === route.id}
              isRecommended={route.id === recommended_switch}
              onSelect={() => setSelectedRoute(route.id)}
            />
          ))}

          {/* End commute button */}
          <button
            onClick={() => endMutation.mutate()}
            className="w-full mt-4 bg-gray-700 hover:bg-gray-600 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle className="w-5 h-5" />
            End Commute
          </button>
        </div>
      </div>
    </div>
  )
}

interface RouteCardProps {
  route: RouteOption
  isCurrent: boolean
  isSelected: boolean
  isRecommended?: boolean
  onSelect: () => void
}

function RouteCard({ route, isCurrent, isSelected, isRecommended, onSelect }: RouteCardProps) {
  return (
    <button
      onClick={onSelect}
      className={clsx(
        'w-full text-left p-4 rounded-lg border transition-all',
        isSelected
          ? 'bg-blue-900/50 border-blue-500'
          : 'bg-gray-800 border-gray-700 hover:border-gray-600',
        isRecommended && !isSelected && 'border-yellow-600 animate-pulse'
      )}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{route.name}</span>
          {isCurrent && (
            <span className="text-xs bg-gray-700 px-2 py-0.5 rounded">Current</span>
          )}
          {isRecommended && (
            <span className="text-xs bg-yellow-600 px-2 py-0.5 rounded">Recommended</span>
          )}
        </div>
        <div
          className="w-3 h-3 rounded-full"
          style={{ backgroundColor: TRAFFIC_COLORS[route.traffic_level] }}
          title={`Traffic: ${route.traffic_level}`}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm text-gray-400">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{Math.round(route.predicted_duration_minutes)} min</span>
        </div>
        <div>
          {route.distance_km.toFixed(1)} km
        </div>
      </div>

      {route.savings_vs_current > 0 && (
        <div className="mt-2 text-sm text-green-400 font-medium">
          Saves {Math.round(route.savings_vs_current)} min
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        Confidence: {Math.round(route.confidence * 100)}%
      </div>
    </button>
  )
}
