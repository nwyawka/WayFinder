import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Clock, TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { api } from '../lib/api'
import clsx from 'clsx'

export function CommuteHistory() {
  const { id } = useParams<{ id: string }>()

  const { data: commute } = useQuery({
    queryKey: ['commute', id],
    queryFn: () => api.getCommute(id!),
  })

  const { data: patterns } = useQuery({
    queryKey: ['patterns', id],
    queryFn: () => api.getPatterns(id!),
  })

  const { data: history } = useQuery({
    queryKey: ['history', id],
    queryFn: () => api.getHistory(id!),
  })

  if (!commute) {
    return <div className="text-center py-12">Loading...</div>
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">{commute.name}</h2>
        <p className="text-gray-400">
          {commute.origin_address || 'Origin'} → {commute.dest_address || 'Destination'}
        </p>
      </div>

      {/* Stats */}
      {patterns && patterns.overall && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<Clock className="w-6 h-6" />}
            label="Average"
            value={`${Math.round(patterns.overall.avg_minutes)} min`}
          />
          <StatCard
            icon={<TrendingDown className="w-6 h-6 text-green-400" />}
            label="Best"
            value={`${Math.round(patterns.overall.best_minutes)} min`}
            className="text-green-400"
          />
          <StatCard
            icon={<TrendingUp className="w-6 h-6 text-red-400" />}
            label="Worst"
            value={`${Math.round(patterns.overall.worst_minutes)} min`}
            className="text-red-400"
          />
          <StatCard
            icon={<Calendar className="w-6 h-6" />}
            label="Trips"
            value={patterns.trips_recorded.toString()}
          />
        </div>
      )}

      {/* Insights */}
      {patterns && patterns.insights && (
        <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
          <h3 className="font-semibold mb-4">Insights</h3>
          <div className="grid md:grid-cols-2 gap-4">
            {patterns.insights.best_day && (
              <div className="text-sm">
                <span className="text-gray-400">Best day: </span>
                <span className="text-green-400">{patterns.insights.best_day}</span>
              </div>
            )}
            {patterns.insights.worst_day && (
              <div className="text-sm">
                <span className="text-gray-400">Worst day: </span>
                <span className="text-red-400">{patterns.insights.worst_day}</span>
              </div>
            )}
            {patterns.insights.best_departure && (
              <div className="text-sm">
                <span className="text-gray-400">Best departure: </span>
                <span className="text-green-400">{patterns.insights.best_departure}</span>
              </div>
            )}
            {patterns.insights.worst_departure && (
              <div className="text-sm">
                <span className="text-gray-400">Worst departure: </span>
                <span className="text-red-400">{patterns.insights.worst_departure}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {patterns && patterns.recommendations && patterns.recommendations.length > 0 && (
        <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-5">
          <h3 className="font-semibold mb-3 text-blue-400">Recommendations</h3>
          <ul className="space-y-2">
            {patterns.recommendations.map((rec: string, i: number) => (
              <li key={i} className="text-sm text-blue-200 flex items-start gap-2">
                <span className="text-blue-400">•</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* History table */}
      {history && history.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
          <h3 className="font-semibold p-4 border-b border-gray-700">Recent Trips</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-700/50">
                <tr>
                  <th className="text-left p-3">Date</th>
                  <th className="text-left p-3">Started</th>
                  <th className="text-left p-3">Duration</th>
                  <th className="text-left p-3">Route</th>
                </tr>
              </thead>
              <tbody>
                {history.map((entry: any) => (
                  <tr key={entry.id || entry.started_at} className="border-t border-gray-700">
                    <td className="p-3">
                      {new Date(entry.started_at).toLocaleDateString()}
                    </td>
                    <td className="p-3 text-gray-400">
                      {new Date(entry.started_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="p-3">
                      {entry.duration_minutes
                        ? `${Math.round(entry.duration_minutes)} min`
                        : '-'}
                    </td>
                    <td className="p-3 text-gray-400">
                      {entry.switched_routes ? 'Switched' : 'Original'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string
  className?: string
}

function StatCard({ icon, label, value, className }: StatCardProps) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center gap-3">
        <div className="text-gray-400">{icon}</div>
        <div>
          <div className="text-xs text-gray-400">{label}</div>
          <div className={clsx('text-xl font-bold', className)}>{value}</div>
        </div>
      </div>
    </div>
  )
}
