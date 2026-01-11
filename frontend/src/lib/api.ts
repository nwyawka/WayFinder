/**
 * API client for Wayfinder backend
 */

import {
  Commute,
  CommuteCreate,
  CommuteHistoryEntry,
  CommutePatterns,
  RouteComparison,
  StartCommuteResponse,
} from '../types'

const BASE_URL = '/api'

async function fetchJSON<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${BASE_URL}${url}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  return response.json()
}

export const api = {
  // Commutes
  getCommutes: () => fetchJSON<Commute[]>('/commutes/'),

  getCommute: (id: string) => fetchJSON<Commute>(`/commutes/${id}`),

  createCommute: (data: CommuteCreate) =>
    fetchJSON<Commute>('/commutes/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCommute: (id: string) =>
    fetchJSON<void>(`/commutes/${id}`, { method: 'DELETE' }),

  // Commute tracking
  startCommute: (id: string) =>
    fetchJSON<StartCommuteResponse>(`/commutes/${id}/start`, {
      method: 'POST',
    }),

  endCommute: (commuteId: string, historyId: string, routeTaken?: string | null) =>
    fetchJSON<CommuteHistoryEntry>(`/commutes/${commuteId}/history/${historyId}/end`, {
      method: 'POST',
      body: JSON.stringify({ route_taken: routeTaken }),
    }),

  // History and patterns
  getHistory: (commuteId: string) =>
    fetchJSON<CommuteHistoryEntry[]>(`/commutes/${commuteId}/history`),

  getPatterns: (commuteId: string) =>
    fetchJSON<CommutePatterns>(`/commutes/${commuteId}/patterns`),

  // Routes
  calculateRoutes: (commuteId: string) =>
    fetchJSON<StartCommuteResponse>(`/commutes/${commuteId}/start`, { method: 'POST' })
      .then((data) => data.routes),
}
