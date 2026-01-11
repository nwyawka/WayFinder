// Wayfinder Service Worker
// Handles background sync and push notifications

const CACHE_NAME = 'wayfinder-v1'
const OFFLINE_URL = '/offline.html'

// Assets to cache for offline use
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/offline.html',
]

// Install event - cache assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE)
    })
  )
  self.skipWaiting()
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      )
    })
  )
  self.clients.claim()
})

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return

  // Skip API requests (always go to network)
  if (event.request.url.includes('/api/')) return

  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response
      }
      return fetch(event.request).catch(() => {
        // Return offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return caches.match(OFFLINE_URL)
        }
      })
    })
  )
})

// Push notification event
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()

  const options = {
    body: data.body || 'New update available',
    icon: '/wayfinder-icon.png',
    badge: '/wayfinder-badge.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: data.actions || [
      { action: 'open', title: 'Open App' },
      { action: 'dismiss', title: 'Dismiss' },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Wayfinder', options)
  )
})

// Notification click event
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  if (event.action === 'dismiss') return

  // Open or focus the app
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus()
        }
      }
      // Otherwise open new window
      if (clients.openWindow) {
        return clients.openWindow('/')
      }
    })
  )
})

// Background sync for route updates
self.addEventListener('sync', (event) => {
  if (event.tag === 'check-routes') {
    event.waitUntil(checkRoutesInBackground())
  }
})

async function checkRoutesInBackground() {
  // This would be called periodically to check for route updates
  // and send notifications if a better route is found
  try {
    const response = await fetch('/api/routes/check-active')
    if (!response.ok) return

    const data = await response.json()

    if (data.recommended_switch) {
      await self.registration.showNotification('Better Route Found!', {
        body: data.recommendation_reason,
        icon: '/wayfinder-icon.png',
        badge: '/wayfinder-badge.png',
        vibrate: [200, 100, 200],
        tag: 'route-switch',
        requireInteraction: true,
        actions: [
          { action: 'switch', title: 'Switch Route' },
          { action: 'ignore', title: 'Keep Current' },
        ],
      })
    }
  } catch (error) {
    console.error('Background route check failed:', error)
  }
}
