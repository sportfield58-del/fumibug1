'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, Plus, Calendar, Clock, AlertTriangle, CheckCircle, MoreHorizontal, UserCheck } from 'lucide-react'
import { Button, Input, Badge, EmptyState, Skeleton, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import {
  getListServices,
  getListRoutes,
  postCreateRoute,
  postAddStop,
  getListUsers,
} from '@/../../lib/api/client'
import type { Service, UserWithMembership, Route } from '@fumibug/contracts'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary', icon: null },
  SCHEDULED: { label: 'Programado', variant: 'default', icon: <Calendar className="h-3 w-3" /> },
  ASSIGNED: { label: 'Asignado', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  DISPATCHED: { label: 'Despachado', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  IN_EXECUTION: { label: 'En ejecución', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  PENDING_VALIDATION: { label: 'Pendiente validación', variant: 'outline', icon: <AlertTriangle className="h-3 w-3" /> },
  COMPLETED: { label: 'Completado', variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
  PARTIALLY_COMPLETED: { label: 'Parcial', variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
  RESCHEDULED: { label: 'Reprogramado', variant: 'secondary', icon: <Calendar className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelado', variant: 'destructive', icon: <AlertTriangle className="h-3 w-3" /> },
}

const priorityConfig: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Baja', className: 'bg-bg-subtle text-fg-muted' },
  NORMAL: { label: 'Normal', className: '' },
  HIGH: { label: 'Alta', className: 'bg-warning-subtle text-warning' },
  URGENT: { label: 'Urgente', className: 'bg-destructive-subtle text-destructive' },
}

const FIELD_ROLE_KEYS = new Set(['technician', 'technical_director'])

/** Estados en los que un servicio todavía puede asignarse a un operario (via ruta). */
const ASSIGNABLE = new Set(['DRAFT', 'SCHEDULED', 'ASSIGNED'])

export default function ServiciosPage(): JSX.Element {
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null)
  const [services, setServices] = React.useState<Service[]>([])
  const [operarios, setOperarios] = React.useState<UserWithMembership[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [assigning, setAssigning] = React.useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = React.useState<Record<string, string>>({})

  const fetchServices = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getListServices({
        query: {
          status: (statusFilter as 'DRAFT' | 'SCHEDULED' | 'ASSIGNED' | 'DISPATCHED' | 'IN_EXECUTION' | 'PENDING_VALIDATION' | 'COMPLETED' | 'PARTIALLY_COMPLETED' | 'RESCHEDULED' | 'CANCELLED') || undefined,
          limit: 20,
        },
      })
      if (res.success) {
        setServices(res.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar los servicios')
    } finally {
      setIsLoading(false)
    }
  }, [statusFilter])

  const fetchOperarios = React.useCallback(async () => {
    const res = await getListUsers({ query: { limit: 100 } })
    if (res.success) setOperarios(res.data.filter((u) => FIELD_ROLE_KEYS.has(u.roleKey)))
  }, [])

  React.useEffect(() => {
    void fetchServices()
    void fetchOperarios()
  }, [fetchServices, fetchOperarios])

  /**
   * Asigna un servicio a un operario usando el flujo real del modelo: lo agrega a la
   * ruta del operario para la fecha del servicio (creándola si no existe). Reasignar
   * en ASSIGNED agrega un segundo stop — el servicio pasa a la ruta nueva (R11 no
   * impide un servicio en dos rutas DRAFT; publish() usa la última ruta).
   */
  const assignOperario = async (service: Service, operarioId: string): Promise<void> => {
    setAssigning((s) => ({ ...s, [service.id]: true }))
    setFeedback((f) => ({ ...f, [service.id]: '' }))
    try {
      const date = service.scheduledDate ?? new Date().toISOString().slice(0, 10)
      const routesRes = await getListRoutes({ query: { date, technicianId: operarioId, limit: 20 } })
      if (!routesRes.success) {
        setFeedback((f) => ({ ...f, [service.id]: 'No se pudo buscar la ruta del operario.' }))
        return
      }
      const route = routesRes.data.find((r: Route) => ['DRAFT', 'READY', 'PUBLISHED'].includes(r.status))
      let routeId: string
      if (route) {
        routeId = route.id
      } else {
        const created = await postCreateRoute({ body: { technicianId: operarioId, date } })
        if (!created.success) {
          setFeedback((f) => ({ ...f, [service.id]: created.error.message }))
          return
        }
        routeId = created.data.id
      }
      const addRes = await postAddStop({ params: { id: routeId }, body: { serviceId: service.id } })
      if (addRes.success) {
        setFeedback((f) => ({ ...f, [service.id]: 'Asignado ✓' }))
        void fetchServices()
      } else {
        setFeedback((f) => ({ ...f, [service.id]: addRes.error.message }))
      }
    } catch {
      setFeedback((f) => ({ ...f, [service.id]: 'No se pudo asignar.' }))
    } finally {
      setAssigning((s) => ({ ...s, [service.id]: false }))
    }
  }

  const filteredServices = React.useMemo(() => {
    if (!search) return services
    const q = search.toLowerCase()
    return services.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q) ||
        s.serviceTypeName?.toLowerCase().includes(q) ||
        s.location?.addressLine.toLowerCase().includes(q) ||
        s.targetPests.some((p) => p.toLowerCase().includes(q)) ||
        s.technicianName?.toLowerCase().includes(q)
    )
  }, [services, search])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-fg">Servicios</h1>
        <Button asChild>
          <Link href="/admin/servicios/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo servicio
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <Input
            placeholder="Buscar por cliente, dirección, tipo, código, plaga u operario..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter ?? '__all__'} onValueChange={(v) => setStatusFilter(v === '__all__' ? null : v)}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Todos los estados" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todos los estados</SelectItem>
            {Object.entries(statusConfig).map(([key, cfg]) => (
              <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchServices() }} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && filteredServices.length === 0 && (
        <EmptyState
          icon={<Calendar className="h-8 w-8 text-fg-subtle" />}
          title="Crear servicio"
          description={
            search || statusFilter
              ? 'No se encontraron servicios con esos filtros.'
              : 'Aún no hay servicios creados.'
          }
          action={
            !search && !statusFilter
              ? {
                  label: 'Crear el primero',
                  onClick: () => { window.location.href = '/admin/servicios/nuevo' },
                }
              : undefined
          }
        />
      )}

      {/* List */}
      {!isLoading && !error && filteredServices.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
          {filteredServices.map((service) => {
            const status = statusConfig[service.status] ?? statusConfig.DRAFT
            const priority = priorityConfig[service.priority] ?? priorityConfig.NORMAL
            if (!status || !priority) return null
            return (
              <div key={service.id} className="flex items-center justify-between px-4 py-3">
                <Link
                  href={`/admin/servicios/${service.id}`}
                  className="flex items-center gap-3 min-w-0"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-body font-medium text-fg truncate">
                      {service.serviceTypeName ?? service.code}
                      {service.isWarrantyVisit && (
                        <Badge variant="secondary" className="ml-2 text-xs">Garantía</Badge>
                      )}
                    </p>
                    <p className="text-caption text-fg-muted truncate">
                      {service.customerName ?? service.code}
                      {service.location?.addressLine && ` · ${service.location.addressLine}`}
                      {' · '}{service.scheduledDate ?? 'Sin fecha'}
                    </p>
                    <p className="text-caption truncate">
                      {service.technicianName ? (
                        <span className="inline-flex items-center gap-1 text-primary">
                          <UserCheck className="h-3 w-3" />{service.technicianName}
                        </span>
                      ) : (
                        <span className="text-fg-muted">Sin operario asignado</span>
                      )}
                    </p>
                  </div>
                </Link>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={status.variant} className="gap-1">
                    {status.icon}
                    {status.label}
                  </Badge>
                  <span className={`hidden sm:inline-flex text-caption px-2 py-0.5 rounded-full ${priority.className}`}>
                    {priority.label}
                  </span>
                  {ASSIGNABLE.has(service.status) && (
                    <Select
                      value=""
                      onValueChange={(operarioId) => { void assignOperario(service, operarioId) }}
                      {...(assigning[service.id] ? { disabled: true } : {})}
                    >
                      <SelectTrigger className="w-44" aria-label={`Asignar operario a ${service.code}`}>
                        <SelectValue placeholder={assigning[service.id] ? 'Asignando...' : 'Asignar operario'} />
                      </SelectTrigger>
                      <SelectContent>
                        {operarios.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.fullName ?? o.username}
                          </SelectItem>
                        ))}
                        {operarios.length === 0 && (
                          <div className="px-2 py-1.5 text-caption text-fg-muted">No hay operarios cargados.</div>
                        )}
                      </SelectContent>
                    </Select>
                  )}
                  {feedback[service.id] && (
                    <span className="text-caption text-fg-muted">{feedback[service.id]}</span>
                  )}
                  <MoreHorizontal className="h-4 w-4 text-fg-subtle" />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}