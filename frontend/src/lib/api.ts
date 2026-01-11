/**
 * API client for Wayfinder backend
 */

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
  getCommutes: () => fetchJSON('/commutes/'),

  getCommute: (id: string) => fetchJSON(`/commutes/${id}`),

  createCommute: (data: {
    name: string
    origin_lat: number
    origin_lng: number
    origin_address?: string
    dest_lat: number
    dest_lng: number
    dest_address?: string
    typical_departure_time?: string
  }) =>
    fetchJSON('/commutes/', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCommute: (id: string) =>
    fetchJSON(`/commutes/${id}`, { method: 'DELETE' }),

  // Commute tracking
  startCommute: (id: string) =>
    fetchJSON<{ history_id: string; routes: any }>(`/commutes/${id}/start`, {
      method: 'POST',
    }),

  endCommute: (commuteId: string, historyId: string, routeTaken?: string | null) =>
    fetchJSON(`/commutes/${commuteId}/history/${historyId}/end`, {
      method: 'POST',
      body: JSON.stringify({ route_taken: routeTaken }),
    }),

  // History and patterns
  getHistory: (commuteId: string) =>
    fetchJSON(`/commutes/${commuteId}/history`),

  getPatterns: (commuteId: string) =>
    fetchJSON(`/commutes/${commuteId}/patterns`),

  // Routes
  calculateRoutes: (commuteId: string) =>
    fetchJSON(`/commutes/${commuteId}/start`, { method: 'POST' })
      .then((data: any) => data.routes),
}
