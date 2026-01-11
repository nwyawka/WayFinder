import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Plus, Play, Trash2, TrendingUp, Clock } from 'lucide-react'
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

  if (isLoading) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Your Commutes</h2>
          <p className="text-gray-400">
            Track and optimize your regular routes
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg transition-colors"
        >
          <Plus className="w-5 h-5" />
          Add Commute
        </button>
      </div>

      {/* Commutes list */}
      {commutes && commutes.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {commutes.map((commute: Commute) => (
            <CommuteCard
              key={commute.id}
              commute={commute}
              onDelete={() => deleteMutation.mutate(commute.id)}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-800 rounded-lg">
          <Navigation className="w-12 h-12 mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold mb-2">No commutes yet</h3>
          <p className="text-gray-400 mb-4">
            Add your first commute to start tracking and optimizing
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg transition-colors"
          >
            Add Your First Commute
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
          to={`/commute/${commute.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg transition-colors"
        >
          <Play className="w-4 h-4" />
          Start
        </Link>
        <Link
          to={`/history/${commute.id}`}
          className="flex-1 flex items-center justify-center gap-2 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg transition-colors"
        >
          History
        </Link>
      </div>
    </div>
  )
}
