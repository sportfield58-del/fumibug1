'use client'

import * as React from 'react'

/**
 * Registers the service worker scoped to /campo/.
 * Only runs on the client and only for the campo app.
 */
export function ServiceWorkerRegistration(): null {
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    if (process.env.NODE_ENV !== 'production') return
    if (!window.location.pathname.startsWith('/campo')) return

    let active = true

    const register = async (): Promise<void> => {
      try {
        const registration = await navigator.serviceWorker.register('/campo/sw.js', {
          scope: '/campo/',
        })

        // Auto-update on new SW
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing
          if (!newWorker) return
          newWorker.addEventListener('statechange', () => {
            if (
              newWorker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              // New content available — notify via CustomEvent
              window.dispatchEvent(
                new CustomEvent('fumibug:sw-updated')
              )
            }
          })
        })
      } catch {
        // SW registration failed — non-fatal, app works online
      }
    }

    if (navigator.serviceWorker.controller) {
      // Already controlled
      active = true
    } else {
      void register()
    }

    // Re-register when navigations land on /campo (after login)
    const onLocationChange = (): void => {
      if (active && window.location.pathname.startsWith('/campo')) {
        void register()
      }
    }
    window.addEventListener('popstate', onLocationChange)

    return () => {
      active = false
      window.removeEventListener('popstate', onLocationChange)
    }
  }, [])

  return null
}
