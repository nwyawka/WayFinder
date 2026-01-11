import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Save, Key, Bell, Clock, Home, Building2, Sun, Moon, Plus, Check, Loader2 } from 'lucide-react'
import { api } from '../lib/api'

// Pre-configured locations
const LOCATIONS = {
  home: {
    address: '836 Cottonwood Drive, Severna Park, MD 21146',
    lat: 39.0802529,
    lng: -76.5655867,
  },
  work: {
    address: '4555 Overlook Ave SW, Washington, DC 20375',
    lat: 38.8231381,
    lng: -77.0178902,
  },
}

export function Settings() {
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState({
    tomtomApiKey: '',
    hereApiKey: '',
    rerouteThreshold: 2,
    pollInterval: 60,
    enableNotifications: true,
  })
  const [setupStatus, setSetupStatus] = useState<{
    morning: 'idle' | 'loading' | 'success' | 'exists'
    evening: 'idle' | 'loading' | 'success' | 'exists'
  }>({ morning: 'idle', evening: 'idle' })

  // Fetch existing commutes to check if they already exist
  const { data: commutes } = useQuery({
    queryKey: ['commutes'],
    queryFn: api.getCommutes,
  })

  // Check if commutes already exist
  const morningExists = commutes?.some(c => c.name === 'Morning Commute')
  const eveningExists = commutes?.some(c => c.name === 'Evening Commute')

  // Create commute mutation
  const createCommute = useMutation({
    mutationFn: api.createCommute,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commutes'] })
    },
  })

  const handleSetupMorning = async () => {
    if (morningExists) {
      setSetupStatus(s => ({ ...s, morning: 'exists' }))
      return
    }
    setSetupStatus(s => ({ ...s, morning: 'loading' }))
    try {
      await createCommute.mutateAsync({
        name: 'Morning Commute',
        origin_lat: LOCATIONS.home.lat,
        origin_lng: LOCATIONS.home.lng,
        origin_address: LOCATIONS.home.address,
        dest_lat: LOCATIONS.work.lat,
        dest_lng: LOCATIONS.work.lng,
        dest_address: LOCATIONS.work.address,
        typical_departure_time: '07:30',
      })
      setSetupStatus(s => ({ ...s, morning: 'success' }))
    } catch (error) {
      console.error('Failed to create morning commute:', error)
      setSetupStatus(s => ({ ...s, morning: 'idle' }))
    }
  }

  const handleSetupEvening = async () => {
    if (eveningExists) {
      setSetupStatus(s => ({ ...s, evening: 'exists' }))
      return
    }
    setSetupStatus(s => ({ ...s, evening: 'loading' }))
    try {
      await createCommute.mutateAsync({
        name: 'Evening Commute',
        origin_lat: LOCATIONS.work.lat,
        origin_lng: LOCATIONS.work.lng,
        origin_address: LOCATIONS.work.address,
        dest_lat: LOCATIONS.home.lat,
        dest_lng: LOCATIONS.home.lng,
        dest_address: LOCATIONS.home.address,
        typical_departure_time: '17:00',
      })
      setSetupStatus(s => ({ ...s, evening: 'success' }))
    } catch (error) {
      console.error('Failed to create evening commute:', error)
      setSetupStatus(s => ({ ...s, evening: 'idle' }))
    }
  }

  const handleSetupBoth = async () => {
    await handleSetupMorning()
    await handleSetupEvening()
  }

  const handleSave = () => {
    // Save to localStorage or backend
    localStorage.setItem('wayfinder_settings', JSON.stringify(settings))
    alert('Settings saved!')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Settings</h2>
        <p className="text-gray-400">Configure your Wayfinder preferences</p>
      </div>

      {/* Quick Commute Setup */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Home className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold">Quick Commute Setup</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Set up your daily commutes with one click
        </p>

        {/* Locations Display */}
        <div className="bg-gray-900 rounded-lg p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Home className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm text-gray-400">Home</div>
              <div className="text-white">{LOCATIONS.home.address}</div>
            </div>
          </div>
          <div className="border-l-2 border-gray-700 ml-2 h-4" />
          <div className="flex items-start gap-3">
            <Building2 className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-sm text-gray-400">Work</div>
              <div className="text-white">{LOCATIONS.work.address}</div>
            </div>
          </div>
        </div>

        {/* Commute Setup Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <button
            onClick={handleSetupMorning}
            disabled={setupStatus.morning === 'loading' || morningExists || setupStatus.morning === 'success'}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors ${
              morningExists || setupStatus.morning === 'success'
                ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                : setupStatus.morning === 'loading'
                ? 'bg-gray-700 text-gray-400'
                : 'bg-orange-600 hover:bg-orange-500 text-white'
            }`}
          >
            {setupStatus.morning === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : morningExists || setupStatus.morning === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <Sun className="w-5 h-5" />
            )}
            <span>
              {morningExists || setupStatus.morning === 'success'
                ? 'Morning Commute Set'
                : 'Add Morning Commute'}
            </span>
          </button>

          <button
            onClick={handleSetupEvening}
            disabled={setupStatus.evening === 'loading' || eveningExists || setupStatus.evening === 'success'}
            className={`flex items-center justify-center gap-2 py-3 px-4 rounded-lg transition-colors ${
              eveningExists || setupStatus.evening === 'success'
                ? 'bg-green-600/20 text-green-400 border border-green-600/50'
                : setupStatus.evening === 'loading'
                ? 'bg-gray-700 text-gray-400'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white'
            }`}
          >
            {setupStatus.evening === 'loading' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : eveningExists || setupStatus.evening === 'success' ? (
              <Check className="w-5 h-5" />
            ) : (
              <Moon className="w-5 h-5" />
            )}
            <span>
              {eveningExists || setupStatus.evening === 'success'
                ? 'Evening Commute Set'
                : 'Add Evening Commute'}
            </span>
          </button>
        </div>

        {/* Setup Both Button */}
        {!morningExists && !eveningExists && setupStatus.morning !== 'success' && setupStatus.evening !== 'success' && (
          <button
            onClick={handleSetupBoth}
            disabled={setupStatus.morning === 'loading' || setupStatus.evening === 'loading'}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-blue-600 hover:bg-blue-500 rounded-lg transition-colors mt-2"
          >
            <Plus className="w-5 h-5" />
            Set Up Both Commutes
          </button>
        )}
      </div>

      {/* API Keys */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Key className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold">API Keys</h3>
        </div>
        <p className="text-sm text-gray-400 mb-4">
          Get free API keys from TomTom and HERE for traffic data
        </p>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            TomTom API Key
            <a
              href="https://developer.tomtom.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-400 hover:underline"
            >
              (Get key)
            </a>
          </label>
          <input
            type="password"
            value={settings.tomtomApiKey}
            onChange={(e) => setSettings({ ...settings, tomtomApiKey: e.target.value })}
            placeholder="Enter your TomTom API key"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            HERE API Key
            <a
              href="https://developer.here.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="ml-2 text-blue-400 hover:underline"
            >
              (Get key)
            </a>
          </label>
          <input
            type="password"
            value={settings.hereApiKey}
            onChange={(e) => setSettings({ ...settings, hereApiKey: e.target.value })}
            placeholder="Enter your HERE API key"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Rerouting Settings */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-5 h-5 text-gray-400" />
          <h3 className="font-semibold">Rerouting Behavior</h3>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Reroute threshold (minutes)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            Suggest alternate routes when they save at least this many minutes
          </p>
          <input
            type="number"
            min="1"
            max="15"
            value={settings.rerouteThreshold}
            onChange={(e) => setSettings({ ...settings, rerouteThreshold: parseInt(e.target.value) || 2 })}
            className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">
            Poll interval (seconds)
          </label>
          <p className="text-xs text-gray-500 mb-2">
            How often to check for better routes during your commute
          </p>
          <input
            type="number"
            min="15"
            max="300"
            step="15"
            value={settings.pollInterval}
            onChange={(e) => setSettings({ ...settings, pollInterval: parseInt(e.target.value) || 60 })}
            className="w-24 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="bg-gray-800 rounded-lg p-5 border border-gray-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-gray-400" />
            <div>
              <h3 className="font-semibold">Notifications</h3>
              <p className="text-sm text-gray-400">
                Get alerted when a better route is available
              </p>
            </div>
          </div>
          <button
            onClick={() => setSettings({ ...settings, enableNotifications: !settings.enableNotifications })}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              settings.enableNotifications ? 'bg-blue-600' : 'bg-gray-600'
            }`}
          >
            <div
              className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                settings.enableNotifications ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>
      </div>

      {/* Save button */}
      <button
        onClick={handleSave}
        className="w-full bg-blue-600 hover:bg-blue-700 py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
      >
        <Save className="w-5 h-5" />
        Save Settings
      </button>
    </div>
  )
}
