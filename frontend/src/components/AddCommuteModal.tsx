import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X, MapPin } from 'lucide-react'
import { api } from '../lib/api'

interface AddCommuteModalProps {
  onClose: () => void
}

export function AddCommuteModal({ onClose }: AddCommuteModalProps) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState({
    name: '',
    origin_lat: 0,
    origin_lng: 0,
    origin_address: '',
    dest_lat: 0,
    dest_lng: 0,
    dest_address: '',
    typical_departure_time: '17:00',
  })

  const mutation = useMutation({
    mutationFn: api.createCommute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commutes'] })
      onClose()
    },
  })

  // Simple geocoding using Nominatim (free, no API key)
  const geocode = async (address: string): Promise<{ lat: number; lng: number } | null> => {
    try {
      const resp = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      )
      const data = await resp.json()
      if (data && data[0]) {
        return {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
        }
      }
    } catch (error) {
      console.error('Geocoding error:', error)
    }
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Geocode addresses if coordinates not set
    let originCoords = { lat: form.origin_lat, lng: form.origin_lng }
    let destCoords = { lat: form.dest_lat, lng: form.dest_lng }

    if (form.origin_address && !form.origin_lat) {
      const coords = await geocode(form.origin_address)
      if (coords) originCoords = coords
    }

    if (form.dest_address && !form.dest_lat) {
      const coords = await geocode(form.dest_address)
      if (coords) destCoords = coords
    }

    mutation.mutate({
      ...form,
      origin_lat: originCoords.lat,
      origin_lng: originCoords.lng,
      dest_lat: destCoords.lat,
      dest_lng: destCoords.lng,
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg w-full max-w-md mx-4 border border-gray-700">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h3 className="text-lg font-semibold">Add Commute</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Commute Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g., Work to Home"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Origin Address
            </label>
            <input
              type="text"
              required
              placeholder="123 Main St, City, State"
              value={form.origin_address}
              onChange={(e) => setForm({ ...form, origin_address: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              <MapPin className="w-4 h-4 inline mr-1" />
              Destination Address
            </label>
            <input
              type="text"
              required
              placeholder="456 Oak Ave, City, State"
              value={form.dest_address}
              onChange={(e) => setForm({ ...form, dest_address: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">
              Typical Departure Time
            </label>
            <input
              type="time"
              value={form.typical_departure_time}
              onChange={(e) => setForm({ ...form, typical_departure_time: e.target.value })}
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg transition-colors disabled:opacity-50"
            >
              {mutation.isPending ? 'Adding...' : 'Add Commute'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
