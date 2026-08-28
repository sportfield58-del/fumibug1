'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, Plus, Calendar, Clock, AlertTriangle, CheckCircle, MoreHorizontal } from 'lucide-react'
import { Button, Input, Badge, EmptyState, Skeleton, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import { getListServices } from '@/../../lib/api/client'
import type { Service } from '@fumibug/contracts'

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

export default function ServiciosPage(): JSX.Element {
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string | null>(null)
  const [services, setServices] = React.useState<Service[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

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

  React.useEffect(() => {
    void fetchServices()
  }, [fetchServices])

  const filteredServices = React.useMemo(() => {
    if (!search) return services
    const q = search.toLowerCase()
    return services.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.customerName?.toLowerCase().includes(q) ||
        s.serviceTypeName?.toLowerCase().includes(q) ||
        s.location?.addressLine.toLowerCase().includes(q) ||
        s.targetPests.some((p) => p.toLowerCase().includes(q))
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
            placeholder="Buscar por cliente, dirección, tipo, código o plaga..."
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
              <Link
                key={service.id}
                href={`/admin/servicios/${service.id}`}
                className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-bg-sunken"
              >
                <div className="flex items-center gap-3 min-w-0">
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
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={status.variant} className="gap-1">
                    {status.icon}
                    {status.label}
                  </Badge>
                  <span className={`hidden sm:inline-flex text-caption px-2 py-0.5 rounded-full ${priority.className}`}>
                    {priority.label}
                  </span>
                  <MoreHorizontal className="h-4 w-4 text-fg-subtle" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
