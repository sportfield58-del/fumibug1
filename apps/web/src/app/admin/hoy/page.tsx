'use client'

import * as React from 'react'
import Link from 'next/link'
import { RefreshCw, MapPin, ArrowRight } from 'lucide-react'
import { Button, Badge, EmptyState, Skeleton } from '@fumibug/ui'
import { getListServices } from '@/../../lib/api/client'
import type { Service } from '@fumibug/contracts'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; className: string }> = {
  SCHEDULED: { label: 'Programado', variant: 'default', className: 'border-l-4 border-l-blue-500' },
  ASSIGNED: { label: 'Asignado', variant: 'default', className: 'border-l-4 border-l-blue-500' },
  DISPATCHED: { label: 'Despachado', variant: 'default', className: 'border-l-4 border-l-yellow-500' },
  IN_EXECUTION: { label: 'En ejecución', variant: 'default', className: 'border-l-4 border-l-green-500 bg-green-50/50' },
  PENDING_VALIDATION: { label: 'Pend. validación', variant: 'outline', className: 'border-l-4 border-l-orange-500' },
  COMPLETED: { label: 'Completado', variant: 'secondary', className: 'border-l-4 border-l-green-700 opacity-60' },
}

const POLL_INTERVAL = 60_000

export default function HoyPage(): JSX.Element {
  const [services, setServices] = React.useState<Service[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const fetchToday = React.useCallback(async () => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const res = await getListServices({
        query: {
          from: today,
          to: today,
          limit: 100,
        },
      })
      if (res.success) {
        setServices(res.data)
        setLastUpdated(new Date())
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar los servicios de hoy')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchToday()
    const interval = setInterval(() => { void fetchToday() }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchToday])

  const activeServices = services.filter((s) =>
    ['DISPATCHED', 'IN_EXECUTION'].includes(s.status)
  )
  const pendingServices = services.filter((s) =>
    ['SCHEDULED', 'ASSIGNED'].includes(s.status)
  )
  const completedServices = services.filter((s) =>
    s.status === 'COMPLETED'
  )
  const validationServices = services.filter((s) =>
    s.status === 'PENDING_VALIDATION'
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-fg">Hoy</h1>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-caption text-fg-muted">
              Actualizado {lastUpdated.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button variant="ghost" size="sm" onClick={() => { void fetchToday() }}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchToday() }} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Total hoy</p>
          <p className="text-h2 font-bold text-fg mt-1">{services.length}</p>
        </div>
        <div className="rounded-lg border border-l-4 border-l-blue-500 bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Activos</p>
          <p className="text-h2 font-bold text-fg mt-1">{activeServices.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Completados</p>
          <p className="text-h2 font-bold text-fg mt-1">{completedServices.length}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Validación pend.</p>
          <p className="text-h2 font-bold text-fg mt-1">{validationServices.length}</p>
        </div>
      </div>

      {/* Service lists */}
      {activeServices.length > 0 && (
        <Section title="En ejecución" services={activeServices} />
      )}

      {validationServices.length > 0 && (
        <Section title="Pendientes de validación" services={validationServices} />
      )}

      {pendingServices.length > 0 && (
        <Section title="Programados / Asignados" services={pendingServices} />
      )}

      {completedServices.length > 0 && (
        <Section title="Completados" services={completedServices} />
      )}

      {!error && services.length === 0 && (
        <EmptyState
          icon={<MapPin className="h-8 w-8 text-fg-subtle" />}
          title="Sin servicios hoy"
          description="No hay servicios programados para hoy."
        />
      )}
    </div>
  )
}

function Section({
  title,
  services,
}: {
  title: string
  services: Service[]
}): JSX.Element {
  return (
    <div>
      <h2 className="text-h3 font-semibold text-fg mb-3">{title} ({services.length})</h2>
      <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
        {services.map((service) => {
          const status = statusConfig[service.status]
          return (
            <Link
              key={service.id}
              href={`/admin/servicios/${service.id}`}
              className={`flex items-center justify-between px-4 py-3 transition-colors hover:bg-bg-sunken ${status?.className ?? ''}`}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-body font-medium text-fg">{service.code}</span>
                  {status && (
                    <Badge variant={status.variant} className="text-xs">{status.label}</Badge>
                  )}
                  {service.isWarrantyVisit && (
                    <Badge variant="secondary" className="text-xs">Garantía</Badge>
                  )}
                </div>
                <p className="text-caption text-fg-muted">
                  {service.windowStart && service.windowEnd
                    ? `${service.windowStart} - ${service.windowEnd}`
                    : service.scheduledDate ?? ''}
                  {service.targetPests.length > 0 && ` · ${service.targetPests.join(', ')}`}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 shrink-0 text-fg-subtle" />
            </Link>
          )
        })}
      </div>
    </div>
  )
}
