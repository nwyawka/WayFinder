import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Play, Trash2, TrendingUp, Clock, Navigation2, Sun, Moon, Home, Building2, ArrowRight } from 'lucide-react'
import { api } from '../lib/api'
import { AddCommuteModal } from '../components/AddCommuteModal'
import { Commute } from '../types'

export function Dashboard() {
  const [showAddModal, setShowAddModal] = useState(false)
  const queryClient = useQueryClient()

  const { data: commutes, isLoading } = useQuery({
    queryKey: ['commutes'],
    queryFn: api.getCommutes,
  })

  const deleteMutation = useMutation({
    mutationFn: api.deleteCommute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commutes'] })
    },
  })

  // Find morning and evening commutes
  const morningCommute = commutes?.find((c: Commute) => c.name === 'Morning Commute')
  const eveningCommute = commutes?.find((c: Commute) => c.name === 'Evening Commute')
  const otherCommutes = commutes?.filter((c: Commute) =>
    c.name !== 'Morning Commute' && c.name !== 'Evening Commute'
  )

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Quick Commute Buttons - Morning & Evening */}
      {(morningCommute || eveningCommute) && (
        <div className="space-y-4">
          <h2 className="text-xl font-bold">Quick Start</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Morning Commute */}
            {morningCommute && (
              <Link
                to={`/navigate/${morningCommute.id}`}
                className="group relative overflow-hidden bg-gradient-to-br from-orange-500 to-amber-600 rounded-xl p-6 hover:from-orange-400 hover:to-amber-500 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
              >
                <div className="absolute top-0 right-0 opacity-10">
                  <Sun className="w-32 h-32 -mt-8 -mr-8" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <Sun className="w-8 h-8" />
                    <span className="text-2xl font-bold">Morning Commute</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                    <ArrowRight className="w-4 h-4" />
                    <Building2 className="w-4 h-4" />
                    <span>Work</span>
                  </div>
                  <div className="flex items-center gap-4 text-white/90 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {morningCommute.avg_duration_minutes
                        ? `~${Math.round(morningCommute.avg_duration_minutes)} min`
                        : 'Tap to start'}
                    </span>
                    {morningCommute.typical_departure_time && (
                      <span>Departs {morningCommute.typical_departure_time}</span>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 bg-white/20 rounded-full p-2 group-hover:bg-white/30 transition-colors">
                  <Navigation2 className="w-6 h-6" />
                </div>
              </Link>
            )}

            {/* Evening Commute */}
            {eveningCommute && (
              <Link
                to={`/navigate/${eveningCommute.id}`}
                className="group relative overflow-hidden bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 hover:from-indigo-400 hover:to-purple-500 transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
              >
                <div className="absolute top-0 right-0 opacity-10">
                  <Moon className="w-32 h-32 -mt-8 -mr-8" />
                </div>
                <div className="relative">
                  <div className="flex items-center gap-3 mb-3">
                    <Moon className="w-8 h-8" />
                    <span className="text-2xl font-bold">Evening Commute</span>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-sm mb-2">
                    <Building2 className="w-4 h-4" />
                    <span>Work</span>
                    <ArrowRight className="w-4 h-4" />
                    <Home className="w-4 h-4" />
                    <span>Home</span>
                  </div>
                  <div className="flex items-center gap-4 text-white/90 text-sm">
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {eveningCommute.avg_duration_minutes
                        ? `~${Math.round(eveningCommute.avg_duration_minutes)} min`
                        : 'Tap to start'}
                    </span>
                    {eveningCommute.typical_departure_time && (
                      <span>Departs {eveningCommute.typical_departure_time}</span>
                    )}
                  </div>
                </div>
                <div className="absolute bottom-4 right-4 bg-white/20 rounded-full p-2 group-hover:bg-white/30 transition-colors">
                  <Navigation2 className="w-6 h-6" />
                </div>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* No commutes - show setup prompt */}
      {(!commutes || commutes.length === 0) && (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <Navigation className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No commutes yet</h3>
          <p className="text-gray-400 mb-4">
            Set up your morning and evening commutes to get started
          </p>
          <Link
            to="/settings"
            className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg transition-colors font-medium"
          >
            Quick Setup in Settings
          </Link>
        </div>
      )}

      {/* Other Commutes section */}
      {otherCommutes && otherCommutes.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Other Commutes</h2>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-1.5 rounded-lg transition-colors text-sm"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {otherCommutes.map((commute: Commute) => (
              <CommuteCard
                key={commute.id}
                commute={commute}
                onDelete={() => deleteMutation.mutate(commute.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Show add button if only morning/evening exist */}
      {commutes && commutes.length > 0 && (!otherCommutes || otherCommutes.length === 0) && (
        <div className="flex justify-center">
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Custom Commute
          </button>
        </div>
      )}

      {/* Add modal */}
      {showAddModal && (
        <AddCommuteModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  )
}

function Navigation(props: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  )
}

interface CommuteCardProps {
  commute: Commute
  onDelete: () => void
}

function CommuteCard({ commute, onDelete }: CommuteCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 hover:border-gray-600 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <h3 className="text-lg font-semibold">{commute.name}</h3>
        <button
          onClick={onDelete}
          className="text-gray-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4 text-sm">
        <div className="flex items-center gap-2 text-gray-400">
          <Clock className="w-4 h-4" />
          <span>
            {commute.avg_duration_minutes
              ? `~${Math.round(commute.avg_duration_minutes)} min avg`
              : 'No data yet'}
          </span>
        </div>
        {commute.best_duration_minutes && (
          <div className="flex items-center gap-2 text-green-400">
            <TrendingUp className="w-4 h-4" />
            <span>Best: {Math.round(commute.best_duration_minutes)} min</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Link
          to={`/navigate/${commute.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg transition-colors"
        >
          <Navigation2 className="w-4 h-4" />
          Navigate
        </Link>
        <Link
          to={`/commute/${commute.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          Preview
        </Link>
        <Link
          to={`/history/${commute.id}`}
          className="flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded-lg transition-colors"
        >
          <Clock className="w-4 h-4" />
        </Link>
      </div>
    </div>
  )
}
