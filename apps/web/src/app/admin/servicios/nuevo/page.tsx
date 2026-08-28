'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import { postCreateService, getListCustomers, getListServiceTypes, getListCustomerLocations } from '@/../../lib/api/client'
import type { Customer, ServiceLocation } from '@fumibug/contracts'

export default function NuevoServicioPage(): JSX.Element {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [customerId, setCustomerId] = React.useState('')
  const [serviceLocationId, setServiceLocationId] = React.useState('')
  const [locations, setLocations] = React.useState<ServiceLocation[]>([])
  const [isLoadingLocations, setIsLoadingLocations] = React.useState(false)
  const [serviceTypeId, setServiceTypeId] = React.useState('')
  const [scheduledDate, setScheduledDate] = React.useState('')
  const [windowStart, setWindowStart] = React.useState('')
  const [windowEnd, setWindowEnd] = React.useState('')
  const [priceCents, setPriceCents] = React.useState('')
  const [priority, setPriority] = React.useState('NORMAL')
  const [targetPests, setTargetPests] = React.useState('')
  const [notesForTechnician, setNotesForTechnician] = React.useState('')

  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [serviceTypes, setServiceTypes] = React.useState<Array<{ id: string; name: string }>>([])

  React.useEffect(() => {
    void getListCustomers({ query: { limit: 100 } }).then((res) => {
      if (res.success) setCustomers(res.data)
    })
    void getListServiceTypes().then((res) => {
      if (res.success) setServiceTypes(res.data)
    })
  }, [])

  // Las ubicaciones dependen del cliente elegido — antes esto mandaba siempre un id
  // fijo inexistente (00000000-...-0001), que rompía la creación con 500 (violación
  // de FK en Postgres, sin manejo específico) para cualquier cliente, siempre.
  React.useEffect(() => {
    setServiceLocationId('')
    setLocations([])
    if (!customerId) return
    setIsLoadingLocations(true)
    getListCustomerLocations({ params: { id: customerId } })
      .then((res) => {
        if (res.success) {
          setLocations(res.data)
          if (res.data.length === 1 && res.data[0]) setServiceLocationId(res.data[0].id)
        }
      })
      .catch(() => { /* combo vacío no bloquea el resto del form */ })
      .finally(() => setIsLoadingLocations(false))
  }, [customerId])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)

    if (!serviceLocationId) {
      setError('Elegí una ubicación del cliente (o cargá una primero si no tiene ninguna).')
      return
    }

    setIsSubmitting(true)

    try {
      const res = await postCreateService({
        body: {
          customerId,
          serviceLocationId,
          serviceTypeId,
          scheduledDate: scheduledDate || undefined,
          windowStart: windowStart || undefined,
          windowEnd: windowEnd || undefined,
          priceCents: Math.round(parseFloat(priceCents || '0') * 100),
          requiredTechnicians: 1,
          priority: priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
          targetPests: targetPests ? targetPests.split(',').map((p) => p.trim()).filter(Boolean) : [],
          notesForTechnician: notesForTechnician || undefined,
        },
      })

      if (res.success) {
        router.push(`/admin/servicios/${res.data.id}`)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('Error al crear el servicio')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/admin/servicios">
            <ArrowLeft className="h-4 w-4" /> Servicios
          </Link>
        </Button>
        <h1 className="text-h1 font-semibold text-fg">Nuevo servicio</h1>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-6">
        {/* Customer */}
        <div className="space-y-2">
          <Label>Cliente *</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar cliente" />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.tradeName ?? c.legalName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Location — depende del cliente elegido */}
        {customerId && (
          <div className="space-y-2">
            <Label>Ubicación *</Label>
            {isLoadingLocations ? (
              <p className="text-caption text-fg-muted">Cargando ubicaciones...</p>
            ) : locations.length === 0 ? (
              <p className="text-caption text-fg-muted">
                Este cliente no tiene ubicaciones cargadas.{' '}
                <Link href={`/admin/clientes/${customerId}/ubicaciones/nueva`} className="text-primary underline">
                  Agregar una
                </Link>
                {' '}antes de crear el servicio.
              </p>
            ) : (
              <Select value={serviceLocationId} onValueChange={setServiceLocationId}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar ubicación" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.label ? `${l.label} — ${l.addressLine}` : l.addressLine}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        )}

        {/* Service type */}
        <div className="space-y-2">
          <Label>Tipo de servicio *</Label>
          <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar tipo" />
            </SelectTrigger>
            <SelectContent>
              {serviceTypes.map((st) => (
                <SelectItem key={st.id} value={st.id}>
                  {st.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date and time */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="scheduledDate">Fecha</Label>
            <Input
              id="scheduledDate"
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="windowStart">Hora inicio</Label>
            <Input
              id="windowStart"
              type="time"
              value={windowStart}
              onChange={(e) => setWindowStart(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="windowEnd">Hora fin</Label>
            <Input
              id="windowEnd"
              type="time"
              value={windowEnd}
              onChange={(e) => setWindowEnd(e.target.value)}
            />
          </div>
        </div>

        {/* Price and priority */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="priceCents">Precio (ARS)</Label>
            <Input
              id="priceCents"
              type="number"
              step="0.01"
              min="0"
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
              placeholder="0.00"
              className="tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">Baja</SelectItem>
                <SelectItem value="NORMAL">Normal</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="URGENT">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Target pests */}
        <div className="space-y-2">
          <Label htmlFor="targetPests">Plagas objetivo</Label>
          <Input
            id="targetPests"
            value={targetPests}
            onChange={(e) => setTargetPests(e.target.value)}
            placeholder="Cucarachas, termitas, ratas (separar con coma)"
          />
        </div>

        {/* Notes */}
        <div className="space-y-2">
          <Label htmlFor="notesForTechnician">Notas para el técnico</Label>
          <textarea
            id="notesForTechnician"
            value={notesForTechnician}
            onChange={(e) => setNotesForTechnician(e.target.value)}
            rows={3}
            className="flex w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-body ring-offset-bg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            placeholder="Instrucciones especiales para el operario..."
          />
        </div>

        {error && (
          <p className="text-caption text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting || !customerId || !serviceTypeId || !serviceLocationId}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar servicio</>
            )}
          </Button>
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  )
}
