'use client'

import * as React from 'react'
import { DollarSign, Users, Calendar, AlertTriangle, Clock } from 'lucide-react'
import { Button, Skeleton } from '@fumibug/ui'
import { getGetAdminDashboard } from '@/../../lib/api/client'

const statusLabels: Record<string, string> = {
  DRAFT: 'Borradores',
  SCHEDULED: 'Programados',
  ASSIGNED: 'Asignados',
  DISPATCHED: 'Despachados',
  IN_EXECUTION: 'En ejecución',
  PENDING_VALIDATION: 'Pendientes validación',
  COMPLETED: 'Completados',
  PARTIALLY_COMPLETED: 'Parciales',
  RESCHEDULED: 'Reprogramados',
  CANCELLED: 'Cancelados',
}

const severityConfig: Record<string, { className: string; icon: React.ReactNode }> = {
  INFO: { className: 'bg-primary-subtle text-primary', icon: <Clock className="h-4 w-4" /> },
  WARNING: { className: 'bg-warning-subtle text-warning', icon: <AlertTriangle className="h-4 w-4" /> },
  CRITICAL: { className: 'bg-destructive-subtle text-destructive', icon: <AlertTriangle className="h-4 w-4" /> },
}

export default function DashboardPage(): JSX.Element {
  const [data, setData] = React.useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    setIsLoading(true)

    getGetAdminDashboard()
      .then((res) => {
        if (cancelled) return
        if (res.success) {
          setData(res.data)
        } else {
          setError(res.error.message)
        }
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el dashboard')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <h1 className="text-h1 font-semibold text-fg">Dashboard</h1>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()} className="mt-2">
            Reintentar
          </Button>
        </div>
      </div>
    )
  }

  const dash = data as {
    servicesTodayByStatus?: Record<string, number>
    activeTechniciansCount?: number
    unassignedServicesCount?: number
    alerts?: Array<{ type: string; message: string; severity: string }>
    collectedTodayCashCents?: number
    collectedTodayTransferCents?: number
  } | null

  if (!dash) return <div />

  const totalServices = dash.servicesTodayByStatus
    ? Object.values(dash.servicesTodayByStatus).reduce((a, b) => a + b, 0)
    : 0
  const totalCollected = ((dash.collectedTodayCashCents ?? 0) + (dash.collectedTodayTransferCents ?? 0)) / 100

  return (
    <div className="space-y-6">
      <h1 className="text-h1 font-semibold text-fg">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="flex items-center gap-2 text-caption text-fg-muted">
            <Calendar className="h-4 w-4" />
            Servicios hoy
          </div>
          <p className="text-h2 font-bold text-fg mt-2">{totalServices}</p>
        </div>

        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="flex items-center gap-2 text-caption text-fg-muted">
            <Users className="h-4 w-4" />
            Técnicos activos
          </div>
          <p className="text-h2 font-bold text-fg mt-2">{dash.activeTechniciansCount ?? 0}</p>
        </div>

        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="flex items-center gap-2 text-caption text-fg-muted">
            <DollarSign className="h-4 w-4" />
            Cobrado hoy
          </div>
          <p className="text-h2 font-bold text-fg mt-2 tabular-nums">${totalCollected.toFixed(2)}</p>
        </div>

        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <div className="flex items-center gap-2 text-caption text-fg-muted">
            <AlertTriangle className="h-4 w-4" />
            Sin asignar
          </div>
          <p className="text-h2 font-bold text-fg mt-2">{dash.unassignedServicesCount ?? 0}</p>
        </div>
      </div>

      {/* Services by status */}
      {dash.servicesTodayByStatus && Object.keys(dash.servicesTodayByStatus).length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Servicios por estado</h2>
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(dash.servicesTodayByStatus).map(([status, count]) => (
                <div key={status} className="flex items-center justify-between">
                  <span className="text-body text-fg-muted">{statusLabels[status] ?? status}</span>
                  <span className="text-body font-medium text-fg tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {dash.alerts && dash.alerts.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Alertas</h2>
          <div className="space-y-2">
            {dash.alerts.map((alert, i) => {
              const sev = severityConfig[alert.severity] ?? severityConfig.INFO
              return (
                <div
                  key={i}
                  className={`flex items-center gap-3 rounded-lg border border-border p-3 ${sev?.className ?? ''}`}
                >
                  {sev?.icon}
                  <p className="text-body">{alert.message}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
