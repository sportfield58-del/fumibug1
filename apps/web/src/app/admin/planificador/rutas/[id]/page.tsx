'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { ArrowLeft, Clock, CheckCircle, XCircle, Send, Ban, Plus } from 'lucide-react'
import { Button, Badge, Skeleton, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import { getGetRoute, getListServices, postAddStop, postPublishRoute, postCancelRoute } from '@/../../lib/api/client'
import type { Service } from '@fumibug/contracts'
import type { RouteStopsMapPoint } from '@/components/route-stops-map'

// Leaflet toca `window` al armar el mapa — se carga solo en el cliente, nunca en SSR.
const RouteStopsMap = dynamic(
  () => import('@/components/route-stops-map').then((m) => m.RouteStopsMap),
  { ssr: false },
)

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
  const [unassignedServices, setUnassignedServices] = React.useState<Service[]>([])
  const [selectedServiceId, setSelectedServiceId] = React.useState('')
  const [isAddingStop, setIsAddingStop] = React.useState(false)

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

  React.useEffect(() => {
    getListServices({ query: { unassigned: true, limit: 50 } })
      .then((res) => {
        if (res.success) setUnassignedServices(res.data)
      })
      .catch(() => {
        // sin servicios sin asignar en el combo no bloquea el resto de la pantalla
      })
  }, [])

  const handleAddStop = async (): Promise<void> => {
    if (!params.id || !selectedServiceId) return
    setIsAddingStop(true)
    try {
      const res = await postAddStop({ params: { id: params.id }, body: { serviceId: selectedServiceId } })
      if (res.success) {
        setSelectedServiceId('')
        void fetchRoute()
        const refreshed = await getListServices({ query: { unassigned: true, limit: 50 } })
        if (refreshed.success) setUnassignedServices(refreshed.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo agregar el servicio a la ruta')
    } finally {
      setIsAddingStop(false)
    }
  }

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
      location?: { customerName: string; addressLine: string; lat: number | null; lng: number | null } | null
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

      {/* Agregar servicio a la ruta — solo mientras no está publicada */}
      {(r.status === 'DRAFT' || r.status === 'READY') && (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
          <h2 className="text-body font-semibold text-fg">Agregar servicio</h2>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[240px] flex-1">
              <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Servicio sin asignar" />
                </SelectTrigger>
                <SelectContent>
                  {unassignedServices.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.code} {s.scheduledDate ? `· ${s.scheduledDate}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => { void handleAddStop() }} disabled={isAddingStop || !selectedServiceId}>
              <Plus className="h-4 w-4" />
              {isAddingStop ? 'Agregando...' : 'Agregar'}
            </Button>
          </div>
          {unassignedServices.length === 0 && (
            <p className="text-caption text-fg-muted">No hay servicios sin asignar.</p>
          )}
        </div>
      )}

      {/* Mapa de paradas — posiciones de los clientes, no tracking en vivo del operario */}
      {r.stops && r.stops.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Mapa de la ruta</h2>
          {(() => {
            const points: RouteStopsMapPoint[] = (r.stops ?? [])
              .filter((s) => s.location?.lat != null && s.location.lng != null)
              .map((s) => ({
                id: s.id,
                sequence: s.sequence,
                status: s.status,
                lat: s.location!.lat as number,
                lng: s.location!.lng as number,
                customerName: s.location!.customerName,
                addressLine: s.location!.addressLine,
              }))
            if (points.length === 0) {
              return (
                <p className="text-caption text-fg-muted rounded-lg border border-border bg-bg-elevated p-4">
                  Ninguna parada tiene el domicilio del cliente geocodificado todavía.
                </p>
              )
            }
            return <RouteStopsMap points={points} />
          })()}
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
                          {stop.location?.customerName || `Servicio ${stop.serviceId.slice(0, 8)}...`}
                        </p>
                        <p className="text-caption text-fg-muted">
                          {stop.location?.addressLine}
                          {stop.eta && ` · ETA: ${stop.eta}`}
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
