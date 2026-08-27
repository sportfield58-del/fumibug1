'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Clock, CheckCircle, XCircle, Send, Ban } from 'lucide-react'
import { Button, Badge, Skeleton } from '@fumibug/ui'
import { getGetRoute, postPublishRoute, postCancelRoute } from '@/../../lib/api/client'

const routeStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary', icon: null },
  READY: { label: 'Lista', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  PUBLISHED: { label: 'Publicada', variant: 'default', icon: <Send className="h-3 w-3" /> },
  IN_PROGRESS: { label: 'En curso', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  COMPLETED: { label: 'Completada', variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelada', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
}

const stopStatusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  PENDING: { label: 'Pendiente', variant: 'secondary' },
  EN_ROUTE: { label: 'En camino', variant: 'default' },
  ARRIVED: { label: 'Llegó', variant: 'default' },
  IN_PROGRESS: { label: 'En curso', variant: 'default' },
  DONE: { label: 'Completado', variant: 'secondary' },
  NO_SHOW: { label: 'No se presentó', variant: 'destructive' },
  INACCESSIBLE: { label: 'Inaccesible', variant: 'destructive' },
  SKIPPED: { label: 'Saltado', variant: 'outline' },
  CANCELLED: { label: 'Cancelado', variant: 'destructive' },
}

export default function RutaDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const [route, setRoute] = React.useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isPublishing, setIsPublishing] = React.useState(false)

  const fetchRoute = React.useCallback(async () => {
    if (!params.id) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await getGetRoute({ params: { id: params.id } })
      if (res.success) {
        setRoute(res.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo cargar la ruta')
    } finally {
      setIsLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    void fetchRoute()
  }, [fetchRoute])

  const handlePublish = async (): Promise<void> => {
    if (!params.id) return
    setIsPublishing(true)
    try {
      const res = await postPublishRoute({ params: { id: params.id } })
      if (res.success) {
        void fetchRoute()
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo publicar la ruta')
    } finally {
      setIsPublishing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  if (error && !route) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/admin/planificador"><ArrowLeft className="h-4 w-4" /> Planificador</Link>
        </Button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  const r = route as {
    id: string
    code: string
    status: string
    routeDate: string
    technicianId: string
    publishedAt?: string | null
    startedAt?: string | null
    completedAt?: string | null
    notes?: string | null
    stops?: Array<{
      id: string
      sequence: number
      serviceId: string
      status: string
      eta?: string | null
      travelMinutes?: number | null
      arrivedAt?: string | null
      enRouteAt?: string | null
    }>
  }

  const status = routeStatusConfig[r.status] ?? routeStatusConfig.DRAFT

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/admin/planificador">
              <ArrowLeft className="h-4 w-4" /> Planificador
            </Link>
          </Button>
          <h1 className="text-h1 font-semibold text-fg">
            {r.code}
            {status && (
              <Badge variant={status.variant} className="gap-1 ml-2">
                {status.icon}
                {status.label}
              </Badge>
            )}
          </h1>
          <p className="text-body text-fg-muted mt-1">
            {r.routeDate} · Técnico: {r.technicianId.slice(0, 8)}...
          </p>
        </div>
        <div className="flex gap-2">
          {(r.status === 'DRAFT' || r.status === 'READY') && (
            <Button onClick={() => { void handlePublish() }} disabled={isPublishing}>
              <Send className="h-4 w-4" />
              {isPublishing ? 'Publicando...' : 'Publicar ruta'}
            </Button>
          )}
          {r.status !== 'CANCELLED' && r.status !== 'COMPLETED' && (
            <Button variant="outline" onClick={() => { void postCancelRoute({ params: { id: r.id } }).then(() => void fetchRoute()) }}>
              <Ban className="h-4 w-4" /> Cancelar
            </Button>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Fecha</p>
          <p className="text-body font-medium text-fg mt-1">{r.routeDate}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Paradas</p>
          <p className="text-body font-medium text-fg mt-1">{r.stops?.length ?? 0}</p>
        </div>
        {r.publishedAt && (
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <p className="text-caption text-fg-muted">Publicada</p>
            <p className="text-body font-medium text-fg mt-1">
              {new Date(r.publishedAt).toLocaleString('es-AR')}
            </p>
          </div>
        )}
        {r.startedAt && (
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <p className="text-caption text-fg-muted">Iniciada</p>
            <p className="text-body font-medium text-fg mt-1">
              {new Date(r.startedAt).toLocaleString('es-AR')}
            </p>
          </div>
        )}
      </div>

      {/* Notes */}
      {r.notes && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Notas</h2>
          <p className="text-body text-fg-muted whitespace-pre-wrap rounded-lg border border-border bg-bg-elevated p-4">
            {r.notes}
          </p>
        </div>
      )}

      {/* Stops */}
      {r.stops && r.stops.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Paradas</h2>
          <div className="space-y-2">
            {r.stops
              .sort((a, b) => a.sequence - b.sequence)
              .map((stop) => {
                const stopStatus = stopStatusConfig[stop.status] ?? stopStatusConfig.PENDING
                return (
                  <div
                    key={stop.id}
                    className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated p-3"
                  >
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-subtle text-caption font-medium text-fg-muted">
                        {stop.sequence}
                      </span>
                      <div>
                        <p className="text-body font-medium text-fg">
                          Servicio {stop.serviceId.slice(0, 8)}...
                        </p>
                        <p className="text-caption text-fg-muted">
                          {stop.eta && `ETA: ${stop.eta}`}
                          {stop.travelMinutes && ` · ${stop.travelMinutes} min`}
                        </p>
                      </div>
                    </div>
                    <Badge variant={stopStatus?.variant ?? 'secondary'}>{stopStatus?.label ?? stop.status}</Badge>
                  </div>
                )
              })}
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
          <p className="text-caption text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
