'use client'

import * as React from 'react'
import Link from 'next/link'
import { MapPin, ChevronRight, Navigation } from 'lucide-react'
import { EmptyState, Badge, Skeleton } from '@fumibug/ui'
import { getGetFieldToday } from '@/../../lib/api/client'
import type { FieldStop } from '@fumibug/contracts'

const STOP_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  EN_ROUTE: { label: 'En camino', variant: 'default' },
  ARRIVED: { label: 'Llegaste', variant: 'default' },
  IN_PROGRESS: { label: 'En curso', variant: 'default' },
  DONE: { label: 'Hecho', variant: 'secondary' },
  NO_SHOW: { label: 'No se presentó', variant: 'destructive' },
  INACCESSIBLE: { label: 'Inaccesible', variant: 'destructive' },
  SKIPPED: { label: 'Salteado', variant: 'outline' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
}

/**
 * docs/spec/10-api.md §J.2. Esto reemplaza el placeholder estático que había acá
 * (siempre "No tenés ruta para hoy", sin llamar nunca a la API) — PR-316 quedaba
 * bloqueado en el task board esperando el contrato de /field/*, que ya está mergeado
 * (PR-106b/PR-207b) hace rato pero nunca se conectó esta pantalla.
 */
export default function CampoHomePage(): JSX.Element {
  const [stops, setStops] = React.useState<FieldStop[]>([])
  const [routeCode, setRouteCode] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    getGetFieldToday()
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setRouteCode(res.data.route?.code ?? null)
          setStops([...res.data.stops].sort((a, b) => a.sequence - b.sequence))
        } else {
          setError(res.error.message)
        }
      })
      .catch(() => { if (!cancelled) setError('No se pudo cargar tu ruta de hoy.') })
      .finally(() => { if (!cancelled) setIsLoading(false) })
    return () => { cancelled = true }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 py-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-lg" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="px-4 py-6">
        <p className="text-body text-destructive">{error}</p>
      </div>
    )
  }

  if (stops.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-12">
        <EmptyState
          icon={<MapPin className="h-8 w-8 text-fg-subtle" />}
          title="No tenés ruta para hoy"
          description="Cuando tu supervisor publique una ruta, aparecerá acá."
        />
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4">
      <div>
        <h1 className="text-h2 font-semibold text-fg">Tu ruta de hoy</h1>
        {routeCode && <p className="text-caption text-fg-muted mt-0.5">{routeCode} · {stops.length} paradas</p>}
      </div>

      <div className="space-y-3">
        {stops.map((stop) => {
          const status = STOP_STATUS[stop.status] ?? STOP_STATUS.PENDING
          return (
            <Link
              key={stop.id}
              href={`/campo/stops/${stop.id}`}
              className="flex items-center gap-3 rounded-lg border border-border bg-bg-elevated p-4 transition-colors active:bg-bg-sunken"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-body font-semibold text-fg-muted">
                {stop.sequence}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-body font-semibold text-fg truncate">{stop.location?.customerName ?? stop.serviceCode}</p>
                  {status && <Badge variant={status.variant} className="shrink-0">{status.label}</Badge>}
                </div>
                <p className="text-caption text-fg-muted truncate mt-0.5">{stop.serviceTypeName}</p>
                {stop.location?.addressLine && (
                  <p className="text-caption text-fg-muted truncate flex items-center gap-1 mt-0.5">
                    <Navigation className="h-3 w-3 shrink-0" /> {stop.location.addressLine}
                  </p>
                )}
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-fg-subtle" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
