'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, Clock, AlertTriangle, CheckCircle, XCircle, User, HardHat, MapPin, Wrench } from 'lucide-react'
import { Button, Badge, Skeleton, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import { getGetService, postRescheduleService, postCancelService } from '@/../../lib/api/client'
import type { CancellationReason } from '@fumibug/contracts'

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
  CANCELLED: { label: 'Cancelado', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
}

export default function ServicioDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const [service, setService] = React.useState<Record<string, unknown> | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showReschedule, setShowReschedule] = React.useState(false)
  const [showCancel, setShowCancel] = React.useState(false)

  const fetchService = React.useCallback(async () => {
    if (!params.id) return
    try {
      const res = await getGetService({ params: { id: params.id } })
      if (res.success) {
        setService(res.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo cargar el servicio')
    } finally {
      setIsLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    void fetchService()
  }, [fetchService])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  if (error || !service) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/admin/servicios"><ArrowLeft className="h-4 w-4" /> Servicios</Link>
        </Button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error ?? 'Servicio no encontrado'}</p>
        </div>
      </div>
    )
  }

  const svc = service as {
    id: string
    code: string
    status: string
    priority: string
    isWarrantyVisit: boolean
    scheduledDate?: string | null
    windowStart?: string | null
    windowEnd?: string | null
    estimatedDurationMinutes?: number | null
    requiredTechnicians: number
    priceCents: number
    currency: string
    targetPests: string[]
    notesInternal?: string | null
    notesForTechnician?: string | null
    createdAt: string
    updatedAt: string
    customerName?: string | null
    serviceTypeName?: string | null
    technicianId?: string | null
    technicianName?: string | null
    location?: { addressLine: string; lat: number | null; lng: number | null } | null
  }

  const status = statusConfig[svc.status] ?? statusConfig.DRAFT

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/admin/servicios">
              <ArrowLeft className="h-4 w-4" /> Servicios
            </Link>
          </Button>
          <h1 className="text-h1 font-semibold text-fg">
            {svc.serviceTypeName ?? svc.code}
            {svc.isWarrantyVisit && (
              <Badge variant="secondary" className="ml-2">Garantía</Badge>
            )}
          </h1>
          <p className="text-caption text-fg-muted mt-0.5">{svc.code}</p>
          {status && (
            <Badge variant={status.variant} className="gap-1 mt-1">
              {status.icon}
              {status.label}
            </Badge>
          )}
        </div>
        {svc.status !== 'COMPLETED' && svc.status !== 'CANCELLED' && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setShowReschedule((v) => !v); setShowCancel(false) }}>
              <Calendar className="h-4 w-4" /> Reprogramar
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setShowCancel((v) => !v); setShowReschedule(false) }}>
              <XCircle className="h-4 w-4" /> Cancelar
            </Button>
          </div>
        )}
      </div>

      {showReschedule && (
        <RescheduleForm
          serviceId={svc.id}
          onDone={() => { setShowReschedule(false); void fetchService() }}
        />
      )}
      {showCancel && (
        <CancelForm
          serviceId={svc.id}
          onDone={() => { setShowCancel(false); void fetchService() }}
        />
      )}

      {/* Qué servicio es y dónde es — lo primero que hay que ver, antes que cualquier otro dato */}
      <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
        <div className="flex items-start gap-3">
          <Wrench className="h-5 w-5 shrink-0 text-fg-subtle mt-0.5" />
          <div>
            <p className="text-caption text-fg-muted">Servicio</p>
            <p className="text-body font-medium text-fg">{svc.serviceTypeName ?? 'Sin tipo'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <User className="h-5 w-5 shrink-0 text-fg-subtle mt-0.5" />
          <div>
            <p className="text-caption text-fg-muted">Cliente</p>
            <p className="text-body font-medium text-fg">{svc.customerName ?? 'Sin cliente'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <HardHat className="h-5 w-5 shrink-0 text-fg-subtle mt-0.5" />
          <div>
            <p className="text-caption text-fg-muted">Operario</p>
            <p className="text-body font-medium text-fg">{svc.technicianName ?? 'Sin operario asignado'}</p>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <MapPin className="h-5 w-5 shrink-0 text-fg-subtle mt-0.5" />
          <div>
            <p className="text-caption text-fg-muted">Dónde</p>
            <p className="text-body font-medium text-fg">{svc.location?.addressLine ?? 'Sin dirección'}</p>
          </div>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Fecha programada</p>
          <p className="text-body font-medium text-fg mt-1">
            {svc.scheduledDate ?? 'Sin fecha'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Horario</p>
          <p className="text-body font-medium text-fg mt-1">
            {svc.windowStart && svc.windowEnd
              ? `${svc.windowStart} - ${svc.windowEnd}`
              : 'Sin horario definido'}
          </p>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Técnicos requeridos</p>
          <p className="text-body font-medium text-fg mt-1">{svc.requiredTechnicians}</p>
        </div>
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Precio</p>
          <p className="text-body font-medium text-fg mt-1 tabular-nums">
            ${((svc.priceCents) / 100).toFixed(2)} {svc.currency}
          </p>
        </div>
        {svc.estimatedDurationMinutes && (
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <p className="text-caption text-fg-muted">Duración estimada</p>
            <p className="text-body font-medium text-fg mt-1">{svc.estimatedDurationMinutes} min</p>
          </div>
        )}
      </div>

      {/* Target pests */}
      {svc.targetPests.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Plagas objetivo</h2>
          <div className="flex flex-wrap gap-2">
            {svc.targetPests.map((pest) => (
              <Badge key={pest} variant="secondary">{pest}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {svc.notesForTechnician && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Notas para el técnico</h2>
          <p className="text-body text-fg-muted whitespace-pre-wrap rounded-lg border border-border bg-bg-elevated p-4">
            {svc.notesForTechnician}
          </p>
        </div>
      )}

      {svc.notesInternal && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Notas internas</h2>
          <p className="text-body text-fg-muted whitespace-pre-wrap rounded-lg border border-border bg-bg-elevated p-4">
            {svc.notesInternal}
          </p>
        </div>
      )}
    </div>
  )
}

function RescheduleForm({ serviceId, onDone }: { serviceId: string; onDone: () => void }): JSX.Element {
  const [newDate, setNewDate] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!newDate || !reason) {
      setError('Elegí la fecha nueva y contá el motivo.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await postRescheduleService({ params: { id: serviceId }, body: { newDate, reason } })
      if (res.success) {
        onDone()
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo reprogramar el servicio.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <h2 className="text-body font-semibold text-fg">Reprogramar servicio</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="reschedule-date">Fecha nueva</Label>
          <Input id="reschedule-date" type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="reschedule-reason">Motivo</Label>
          <Input id="reschedule-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="El cliente pidió otro día" />
        </div>
      </div>
      <Button onClick={() => { void submit() }} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Confirmar reprogramación'}</Button>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}

const CANCELLATION_REASONS: Array<{ value: CancellationReason; label: string }> = [
  { value: 'CUSTOMER_REQUESTED', label: 'El cliente lo pidió' },
  { value: 'WEATHER', label: 'Clima' },
  { value: 'DATA_ENTRY_ERROR', label: 'Error de carga' },
  { value: 'DUPLICATE', label: 'Duplicado' },
  { value: 'OUT_OF_ZONE', label: 'Fuera de zona' },
  { value: 'NON_PAYMENT', label: 'Falta de pago' },
  { value: 'OTHER', label: 'Otro' },
]

function CancelForm({ serviceId, onDone }: { serviceId: string; onDone: () => void }): JSX.Element {
  const [reason, setReason] = React.useState<CancellationReason | ''>('')
  const [billable, setBillable] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!reason) {
      setError('Elegí el motivo de cancelación.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await postCancelService({ params: { id: serviceId }, body: { reason, billable } })
      if (res.success) {
        onDone()
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo cancelar el servicio.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
      <h2 className="text-body font-semibold text-fg">Cancelar servicio</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label>Motivo</Label>
          <Select value={reason} onValueChange={(v) => setReason(v as CancellationReason)}>
            <SelectTrigger>
              <SelectValue placeholder="Elegir motivo" />
            </SelectTrigger>
            <SelectContent>
              {CANCELLATION_REASONS.map((r) => (
                <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 text-body text-fg">
            <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="h-4 w-4" />
            Se factura igual
          </label>
        </div>
      </div>
      <Button variant="destructive" onClick={() => { void submit() }} disabled={isSaving}>
        {isSaving ? 'Cancelando...' : 'Confirmar cancelación'}
      </Button>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}
