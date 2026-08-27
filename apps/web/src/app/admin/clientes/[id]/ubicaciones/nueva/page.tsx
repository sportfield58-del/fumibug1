'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Loader2 } from 'lucide-react'
import { Button, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import { postCreateCustomerLocation } from '@/../../lib/api/client'

export default function NuevaUbicacionPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const [label, setLabel] = React.useState('')
  const [addressLine, setAddressLine] = React.useState('')
  const [city, setCity] = React.useState('')
  const [province, setProvince] = React.useState('')
  const [postalCode, setPostalCode] = React.useState('')
  const [establishmentType, setEstablishmentType] = React.useState('OTHER')
  const [accessNotes, setAccessNotes] = React.useState('')
  const [hazardNotes, setHazardNotes] = React.useState('')
  const [areaSqm, setAreaSqm] = React.useState('')

  const customerId = params.id

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      const res = await postCreateCustomerLocation({
        params: { id: customerId },
        body: {
          label: label || undefined,
          addressLine,
          city: city || undefined,
          province: province || undefined,
          postalCode: postalCode || undefined,
          establishmentType: establishmentType as 'HOME' | 'GASTRO' | 'FOOD_INDUSTRY' | 'WAREHOUSE' | 'SCHOOL' | 'OFFICE' | 'OTHER',
          accessNotes: accessNotes || undefined,
          hazardNotes: hazardNotes || undefined,
          areaSqm: areaSqm ? parseFloat(areaSqm) : undefined,
        },
      })

      if (res.success) {
        router.push(`/admin/clientes/${customerId}`)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('Error al crear la ubicación')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href={`/admin/clientes/${customerId}`}>
            <ArrowLeft className="h-4 w-4" /> Volver al cliente
          </Link>
        </Button>
        <h1 className="text-h1 font-semibold text-fg">Nueva ubicación</h1>
      </div>

      <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-6">
        {/* Label */}
        <div className="space-y-2">
          <Label htmlFor="label">Nombre / alias</Label>
          <Input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ej: Sede central, Depósito Norte"
          />
        </div>

        {/* Address */}
        <div className="space-y-2">
          <Label htmlFor="addressLine">Dirección *</Label>
          <Input
            id="addressLine"
            value={addressLine}
            onChange={(e) => setAddressLine(e.target.value)}
            required
            placeholder="Av. Corrientes 1234, Piso 5"
          />
        </div>

        {/* City / Province / Postal */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="city">Localidad</Label>
            <Input
              id="city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Buenos Aires"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="province">Provincia</Label>
            <Input
              id="province"
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="CABA"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="postalCode">Código postal</Label>
            <Input
              id="postalCode"
              value={postalCode}
              onChange={(e) => setPostalCode(e.target.value)}
              placeholder="C1043"
            />
          </div>
        </div>

        {/* Establishment type */}
        <div className="space-y-2">
          <Label>Tipo de establecimiento</Label>
          <Select value={establishmentType} onValueChange={setEstablishmentType}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HOME">Vivienda</SelectItem>
              <SelectItem value="GASTRO">Gastronomía</SelectItem>
              <SelectItem value="FOOD_INDUSTRY">Industria alimentaria</SelectItem>
              <SelectItem value="WAREHOUSE">Depósito</SelectItem>
              <SelectItem value="SCHOOL">Escuela / Institución</SelectItem>
              <SelectItem value="OFFICE">Oficina</SelectItem>
              <SelectItem value="OTHER">Otro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Area */}
        <div className="space-y-2">
          <Label htmlFor="areaSqm">Superficie (m²)</Label>
          <Input
            id="areaSqm"
            type="number"
            step="0.01"
            min="0"
            value={areaSqm}
            onChange={(e) => setAreaSqm(e.target.value)}
            placeholder="150"
            className="max-w-xs"
          />
        </div>

        {/* Notes */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="accessNotes">Notas de acceso</Label>
            <textarea
              id="accessNotes"
              value={accessNotes}
              onChange={(e) => setAccessNotes(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-body ring-offset-bg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Timbre, piso, código, etc."
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="hazardNotes">Notas de riesgo</Label>
            <textarea
              id="hazardNotes"
              value={hazardNotes}
              onChange={(e) => setHazardNotes(e.target.value)}
              rows={3}
              className="flex w-full rounded-md border border-border-strong bg-bg px-3 py-2 text-body ring-offset-bg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              placeholder="Mascotas, alérgicos, zonas restringidas..."
            />
          </div>
        </div>

        {error && (
          <p className="text-caption text-destructive">{error}</p>
        )}

        <div className="flex gap-3">
          <Button type="submit" disabled={isSubmitting || !addressLine}>
            {isSubmitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Guardando...</>
            ) : (
              <><Save className="h-4 w-4" /> Guardar ubicación</>
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
