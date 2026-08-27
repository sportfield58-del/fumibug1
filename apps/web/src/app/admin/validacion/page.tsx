'use client'

import * as React from 'react'
import { CheckCircle, XCircle, AlertTriangle } from 'lucide-react'
import { Button, Badge, EmptyState, Skeleton } from '@fumibug/ui'
import { getListServices, postValidateService, postRejectService } from '@/../../lib/api/client'
import type { Service } from '@fumibug/contracts'

export default function ValidacionPage(): JSX.Element {
  const [services, setServices] = React.useState<Service[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [processingId, setProcessingId] = React.useState<string | null>(null)

  const fetchPending = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getListServices({
        query: { status: 'PENDING_VALIDATION', limit: 50 },
      })
      if (res.success) {
        setServices(res.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar los servicios pendientes')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchPending()
  }, [fetchPending])

  const handleValidate = async (serviceId: string): Promise<void> => {
    setProcessingId(serviceId)
    try {
      const res = await postValidateService({ params: { id: serviceId } })
      if (res.success) {
        setServices((prev) => prev.filter((s) => s.id !== serviceId))
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('Error al validar el servicio')
    } finally {
      setProcessingId(null)
    }
  }

  const handleReject = async (serviceId: string): Promise<void> => {
    setProcessingId(serviceId)
    try {
      const res = await postRejectService({
        params: { id: serviceId },
        body: { reason: 'Requiere revisión' },
      })
      if (res.success) {
        setServices((prev) => prev.filter((s) => s.id !== serviceId))
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('Error al rechazar el servicio')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-fg">Validación de servicios</h1>
        <Badge variant="outline">{services.length} pendientes</Badge>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchPending() }} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && services.length === 0 && (
        <EmptyState
          icon={<CheckCircle className="h-8 w-8 text-fg-subtle" />}
          title="Todo validado"
          description="No hay servicios pendientes de validación."
        />
      )}

      {!isLoading && !error && services.length > 0 && (
        <div className="space-y-3">
          {services.map((service) => {
            const isProcessing = processingId === service.id
            return (
              <div
                key={service.id}
                className="rounded-lg border border-border bg-bg-elevated p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-body font-semibold text-fg">{service.code}</h3>
                      <Badge variant="outline" className="gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        Pendiente validación
                      </Badge>
                    </div>
                    <p className="text-caption text-fg-muted mt-1">
                      {service.scheduledDate ?? 'Sin fecha'} · Prioridad: {service.priority}
                    </p>
                    {service.targetPests.length > 0 && (
                      <p className="text-caption text-fg-muted">
                        Plagas: {service.targetPests.join(', ')}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <Button
                      size="sm"
                      onClick={() => { void handleValidate(service.id) }}
                      disabled={isProcessing}
                    >
                      <CheckCircle className="h-4 w-4" /> Validar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { void handleReject(service.id) }}
                      disabled={isProcessing}
                    >
                      <XCircle className="h-4 w-4" /> Rechazar
                    </Button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
