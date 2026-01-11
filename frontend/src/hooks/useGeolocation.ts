import { useState, useEffect, useCallback } from 'react'

export interface Position {
  lat: number
  lng: number
  accuracy: number
  speed: number | null // m/s
  heading: number | null // degrees from north
  timestamp: number
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean
  maximumAge?: number
  timeout?: number
  onPositionChange?: (position: Position) => void
}

interface UseGeolocationReturn {
  position: Position | null
  error: string | null
  isTracking: boolean
  startTracking: () => void
  stopTracking: () => void
}

export function useGeolocation(options: UseGeolocationOptions = {}): UseGeolocationReturn {
  const [position, setPosition] = useState<Position | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isTracking, setIsTracking] = useState(false)
  const [watchId, setWatchId] = useState<number | null>(null)

  const {
    enableHighAccuracy = true,
    maximumAge = 5000,
    timeout = 10000,
    onPositionChange,
  } = options

  const handleSuccess = useCallback((geoPosition: GeolocationPosition) => {
    const newPosition: Position = {
      lat: geoPosition.coords.latitude,
      lng: geoPosition.coords.longitude,
      accuracy: geoPosition.coords.accuracy,
      speed: geoPosition.coords.speed,
      heading: geoPosition.coords.heading,
      timestamp: geoPosition.timestamp,
    }
    setPosition(newPosition)
    setError(null)
    onPositionChange?.(newPosition)
  }, [onPositionChange])

  const handleError = useCallback((geoError: GeolocationPositionError) => {
    switch (geoError.code) {
      case geoError.PERMISSION_DENIED:
        setError('Location permission denied. Please enable location access.')
        break
      case geoError.POSITION_UNAVAILABLE:
        setError('Location unavailable. Please check GPS settings.')
        break
      case geoError.TIMEOUT:
        setError('Location request timed out.')
        break
      default:
        setError('Unknown location error.')
    }
  }, [])

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser.')
      return
    }

    setIsTracking(true)
    setError(null)

    const id = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      {
        enableHighAccuracy,
        maximumAge,
        timeout,
      }
    )
    setWatchId(id)
  }, [enableHighAccuracy, maximumAge, timeout, handleSuccess, handleError])

  const stopTracking = useCallback(() => {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId)
      setWatchId(null)
    }
    setIsTracking(false)
  }, [watchId])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
      }
    }
  }, [watchId])

  return {
    position,
    error,
    isTracking,
    startTracking,
    stopTracking,
  }
}

// Calculate distance between two points in km
export function calculateDistance(
  pos1: { lat: number; lng: number },
  pos2: { lat: number; lng: number }
): number {
  const R = 6371 // Earth's radius in km
  const dLat = toRad(pos2.lat - pos1.lat)
  const dLng = toRad(pos2.lng - pos1.lng)
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(pos1.lat)) * Math.cos(toRad(pos2.lat)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180)
}

// Check if user is near a point (within threshold km)
export function isNearPoint(
  position: { lat: number; lng: number },
  target: { lat: number; lng: number },
  thresholdKm: number = 0.1 // 100 meters default
): boolean {
  return calculateDistance(position, target) <= thresholdKm
}
