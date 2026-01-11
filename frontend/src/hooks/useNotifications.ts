import { useState, useEffect, useCallback } from 'react'

interface UseNotificationsReturn {
  permission: NotificationPermission
  isSupported: boolean
  requestPermission: () => Promise<boolean>
  sendNotification: (title: string, options?: NotificationOptions) => void
}

export function useNotifications(): UseNotificationsReturn {
  const [permission, setPermission] = useState<NotificationPermission>('default')
  const isSupported = 'Notification' in window

  useEffect(() => {
    if (isSupported) {
      setPermission(Notification.permission)
    }
  }, [isSupported])

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) return false

    try {
      const result = await Notification.requestPermission()
      setPermission(result)
      return result === 'granted'
    } catch {
      return false
    }
  }, [isSupported])

  const sendNotification = useCallback((
    title: string,
    options?: NotificationOptions
  ) => {
    if (!isSupported || permission !== 'granted') return

    const defaultOptions: NotificationOptions = {
      icon: '/wayfinder-icon.png',
      badge: '/wayfinder-badge.png',
      vibrate: [200, 100, 200],
      requireInteraction: true,
      ...options,
    }

    new Notification(title, defaultOptions)
  }, [isSupported, permission])

  return {
    permission,
    isSupported,
    requestPermission,
    sendNotification,
  }
}

// Pre-built notification types for Wayfinder
export function sendRouteAlert(
  sendNotification: (title: string, options?: NotificationOptions) => void,
  routeName: string,
  timeSaved: number
) {
  sendNotification(`Switch to ${routeName}!`, {
    body: `Save ${Math.round(timeSaved)} minutes by switching now`,
    tag: 'route-alert', // Replaces previous route alerts
    data: { type: 'route-switch', route: routeName },
  })
}

export function sendArrivalAlert(
  sendNotification: (title: string, options?: NotificationOptions) => void,
  duration: number
) {
  sendNotification('You\'ve arrived!', {
    body: `Commute completed in ${Math.round(duration)} minutes`,
    tag: 'arrival',
  })
}

export function sendTrafficAlert(
  sendNotification: (title: string, options?: NotificationOptions) => void,
  message: string
) {
  sendNotification('Traffic Update', {
    body: message,
    tag: 'traffic-alert',
  })
}
