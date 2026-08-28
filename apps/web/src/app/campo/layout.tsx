'use client'

import * as React from 'react'
import Link from 'next/link'
import { Wifi, WifiOff, UploadCloud, CloudOff, LogOut } from 'lucide-react'
import { cn, Button } from '@fumibug/ui'
import { RequireAuth } from '@/components/require-auth'
import { useAuth } from '@/components/auth-provider'
import { useSyncStatus } from '@/lib/offline/use-sync-status'
import { ServiceWorkerRegistration } from '@/components/service-worker-registration'

function CampoHeader(): JSX.Element {
  const [isOnline, setIsOnline] = React.useState(true)
  const sync = useSyncStatus()
  const { logout } = useAuth()

  React.useEffect(() => {
    const handleOnline = (): void => setIsOnline(true)
    const handleOffline = (): void => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    setIsOnline(navigator.onLine)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return (
    <header className="sticky top-0 z-sticky border-b border-border bg-bg-elevated safe-top">
      <div className="mx-auto flex h-14 w-full max-w-lg items-center justify-between px-4">
      <div className="flex items-center gap-2">
        <span className="text-h3 font-bold text-primary">Fumibug</span>
      </div>

      <div className="flex items-center gap-3">
        {/* Sync indicator — link to sync screen */}
        <Link
          href="/campo/sync"
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium',
            sync.failed > 0
              ? 'bg-state-problem/10 text-state-problem'
              : sync.pending > 0 || sync.isSyncing
                ? 'bg-warning-subtle text-warning'
                : 'bg-success-subtle text-success'
          )}
          title={sync.failed > 0 ? `${sync.failed} sincronizaciones fallidas` : undefined}
        >
          {sync.failed > 0 ? (
            <CloudOff className="h-3.5 w-3.5" />
          ) : (
            <UploadCloud className="h-3.5 w-3.5" />
          )}
          <span>
            {sync.failed > 0
              ? `${sync.failed} pend. error`
              : sync.pending > 0
                ? `${sync.pending} por sinc.`
                : 'Sincronizado'}
          </span>
        </Link>

        {/* Network state */}
        <div
          className={cn(
            'flex items-center gap-1.5 rounded-full px-3 py-1 text-caption font-medium',
            isOnline
              ? 'bg-success-subtle text-success'
              : 'bg-state-problem/10 text-state-problem'
          )}
        >
          {isOnline ? (
            <Wifi className="h-3.5 w-3.5" />
          ) : (
            <WifiOff className="h-3.5 w-3.5" />
          )}
          <span>{isOnline ? 'En línea' : 'Sin conexión'}</span>
        </div>

        <Button variant="ghost" size="icon" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      </div>
    </header>
  )
}

export default function CampoLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  return (
    <RequireAuth>
      <ServiceWorkerRegistration />
      <div className="flex min-h-dvh flex-col bg-bg">
        <CampoHeader />

        {/* Ancho fijo centrado: en el celular ocupa toda la pantalla igual (max-w
            supera cualquier viewport real), pero en un navegador de escritorio —
            como al grabar la demo — no queda todo estirado de punta a punta. */}
        <main className="flex-1 overflow-y-auto pb-24">
          <div className="mx-auto w-full max-w-lg">
            {children}
          </div>
        </main>
      </div>
    </RequireAuth>
  )
}
