import { useState } from 'react'
import { Save, Key, Bell, Clock } from 'lucide-react'

export function Settings() {
  const [settings, setSettings] = useState({
    tomtomApiKey: '',
    hereApiKey: '',
    rerouteThreshold: 2,
    pollInterval: 60,
    enableNotifications: true,
  })

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
