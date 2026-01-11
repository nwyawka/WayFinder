import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { MapContainer, TileLayer, Polyline, Marker, Popup } from 'react-leaflet'
import { AlertTriangle, CheckCircle, Clock, ArrowRight, X } from 'lucide-react'
import { api } from '../lib/api'
import { RouteComparison, RouteOption } from '../types'
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

export function ActiveCommute() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [historyId, setHistoryId] = useState<string | null>(null)
  const [selectedRoute, setSelectedRoute] = useState<string | null>(null)

  // Start commute tracking
  const startMutation = useMutation({
    mutationFn: () => api.startCommute(id!),
    onSuccess: (data) => {
      setHistoryId(data.history_id)
    },
  })

  // End commute
  const endMutation = useMutation({
    mutationFn: () => api.endCommute(id!, historyId!, selectedRoute),
    onSuccess: () => {
      navigate('/')
    },
  })

  // Get route comparison (polls every 30s)
  const { data: routeData, isLoading } = useQuery({
    queryKey: ['routes', id],
    queryFn: () => api.calculateRoutes(id!),
    enabled: !!historyId,
    refetchInterval: 30000, // Poll every 30 seconds
  })

  // Auto-start on mount
  useEffect(() => {
    if (!historyId) {
      startMutation.mutate()
    }
  }, [id])

  if (isLoading || !routeData) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-400">Calculating routes...</p>
        </div>
      </div>
    )
  }

  const { current_route, alternatives, recommended_switch, recommendation_reason } = routeData

  // Calculate map bounds
  const allPoints = [
    ...current_route.geometry,
    ...alternatives.flatMap(a => a.geometry),
  ]
  const bounds = allPoints.length > 0
    ? L.latLngBounds(allPoints.map(p => [p.lat, p.lng]))
    : undefined

  return (
    <div className="space-y-4">
      {/* Recommendation Alert */}
      {recommended_switch && (
        <div className="bg-yellow-900/50 border border-yellow-600 rounded-lg p-4 flex items-start gap-3">
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

            {/* Current route */}
            <Polyline
              positions={current_route.geometry.map(p => [p.lat, p.lng])}
              color={TRAFFIC_COLORS[current_route.traffic_level]}
              weight={6}
              opacity={selectedRoute === current_route.id ? 1 : 0.7}
            />

            {/* Alternative routes */}
            {alternatives.map((route) => (
              <Polyline
                key={route.id}
                positions={route.geometry.map(p => [p.lat, p.lng])}
                color={TRAFFIC_COLORS[route.traffic_level]}
                weight={4}
                opacity={selectedRoute === route.id ? 1 : 0.4}
                dashArray={selectedRoute === route.id ? undefined : '10, 10'}
              />
            ))}

            {/* Origin marker */}
            {current_route.geometry[0] && (
              <Marker position={[current_route.geometry[0].lat, current_route.geometry[0].lng]}>
                <Popup>Start</Popup>
              </Marker>
            )}

            {/* Destination marker */}
            {current_route.geometry.length > 0 && (
              <Marker
                position={[
                  current_route.geometry[current_route.geometry.length - 1].lat,
                  current_route.geometry[current_route.geometry.length - 1].lng,
                ]}
              >
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
          {alternatives.map((route) => (
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
        isRecommended && !isSelected && 'border-yellow-600'
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
        <div className="mt-2 text-sm text-green-400">
          Saves {Math.round(route.savings_vs_current)} min
        </div>
      )}

      <div className="mt-2 text-xs text-gray-500">
        Confidence: {Math.round(route.confidence * 100)}%
      </div>
    </button>
  )
}
