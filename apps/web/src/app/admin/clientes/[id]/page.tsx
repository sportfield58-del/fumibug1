'use client'

import * as React from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Phone, Mail, Edit, Archive, MapPin, Plus } from 'lucide-react'
import { Button, Badge, Skeleton } from '@fumibug/ui'
import { getGetCustomer, getGetCustomerSummary, getListCustomerLocations } from '@/../../lib/api/client'

export default function ClienteDetailPage(): JSX.Element {
  const params = useParams<{ id: string }>()
  const [customer, setCustomer] = React.useState<Record<string, unknown> | null>(null)
  const [summary, setSummary] = React.useState<Record<string, unknown> | null>(null)
  const [locations, setLocations] = React.useState<Array<{
    id: string
    label?: string | null
    addressLine: string
    city?: string | null
    province?: string | null
    establishmentType: string
    geocodeStatus: string
  }>>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!params.id) return
    let cancelled = false

    Promise.all([
      getGetCustomer({ params: { id: params.id } }),
      getGetCustomerSummary({ params: { id: params.id } }),
      getListCustomerLocations({ params: { id: params.id } }),
    ])
      .then(([custRes, sumRes, locRes]) => {
        if (cancelled) return
        if (custRes.success) setCustomer(custRes.data)
        if (sumRes.success) setSummary(sumRes.data)
        if (locRes.success) setLocations(locRes.data as typeof locations)
      })
      .catch(() => {
        if (!cancelled) setError('No se pudo cargar el cliente')
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [params.id])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-lg" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    )
  }

  if (error || !customer) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild>
          <Link href="/admin/clientes"><ArrowLeft className="h-4 w-4" /> Volver</Link>
        </Button>
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error ?? 'Cliente no encontrado'}</p>
        </div>
      </div>
    )
  }

  const cust = customer as {
    id: string
    legalName: string
    tradeName?: string | null
    type: string
    taxId?: string | null
    notes?: string | null
    tags: string[]
    contacts?: Array<{
      id: string
      name: string
      role: string
      phone?: string | null
      email?: string | null
      isPrimary: boolean
    }>
  }

  const sum = summary as {
    accountBalanceCents?: number
    upcomingServicesCount?: number
    lastServiceAt?: string | null
  } | null

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/admin/clientes">
              <ArrowLeft className="h-4 w-4" /> Clientes
            </Link>
          </Button>
          <h1 className="text-h1 font-semibold text-fg">
            {cust.tradeName ?? cust.legalName}
          </h1>
          {cust.tradeName && (
            <p className="text-body text-fg-muted">{cust.legalName}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4" /> Editar
          </Button>
          <Button variant="outline" size="sm">
            <Archive className="h-4 w-4" /> Archivar
          </Button>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border border-border bg-bg-elevated p-4">
          <p className="text-caption text-fg-muted">Tipo</p>
          <Badge variant="secondary" className="mt-1">{cust.type}</Badge>
        </div>
        {cust.taxId && (
          <div className="rounded-lg border border-border bg-bg-elevated p-4">
            <p className="text-caption text-fg-muted">CUIT</p>
            <p className="text-body font-medium text-fg mt-1 tabular-nums">{cust.taxId}</p>
          </div>
        )}
        {sum && (
          <>
            <div className="rounded-lg border border-border bg-bg-elevated p-4">
              <p className="text-caption text-fg-muted">Saldo</p>
              <p className="text-body font-medium text-fg mt-1 tabular-nums">
                ${((sum.accountBalanceCents ?? 0) / 100).toFixed(2)}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-bg-elevated p-4">
              <p className="text-caption text-fg-muted">Próximos servicios</p>
              <p className="text-body font-medium text-fg mt-1">
                {sum.upcomingServicesCount ?? 0}
              </p>
            </div>
          </>
        )}
      </div>

      {/* Contacts */}
      {cust.contacts && cust.contacts.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Contactos</h2>
          <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
            {cust.contacts.map((contact) => (
              <div key={contact.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-body font-medium text-fg">
                    {contact.name}
                    {contact.isPrimary && (
                      <Badge variant="default" className="ml-2 text-xs">Principal</Badge>
                    )}
                  </p>
                  <p className="text-caption text-fg-muted">{contact.role}</p>
                </div>
                <div className="flex gap-2">
                  {contact.phone && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`tel:${contact.phone}`}><Phone className="h-4 w-4" /></a>
                    </Button>
                  )}
                  {contact.email && (
                    <Button variant="ghost" size="icon" asChild>
                      <a href={`mailto:${contact.email}`}><Mail className="h-4 w-4" /></a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-h3 font-semibold text-fg">Ubicaciones</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/clientes/${cust.id}/ubicaciones/nueva`}>
              <Plus className="h-4 w-4" /> Agregar
            </Link>
          </Button>
        </div>
        {locations.length === 0 ? (
          <p className="text-body text-fg-muted">Sin ubicaciones registradas.</p>
        ) : (
          <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
            {locations.map((loc) => (
              <div key={loc.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-fg-subtle" />
                  <div>
                    <p className="text-body font-medium text-fg">
                      {loc.label ?? loc.addressLine}
                    </p>
                    <p className="text-caption text-fg-muted">
                      {loc.addressLine}
                      {loc.city && `, ${loc.city}`}
                      {loc.province && ` · ${loc.province}`}
                    </p>
                    <div className="flex gap-2 mt-1">
                      <Badge variant="secondary">{loc.establishmentType}</Badge>
                      {loc.geocodeStatus === 'OK' && (
                        <Badge variant="default">Geocodificada</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tags */}
      {cust.tags.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Etiquetas</h2>
          <div className="flex flex-wrap gap-2">
            {cust.tags.map((tag) => (
              <Badge key={tag} variant="secondary">{tag}</Badge>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {cust.notes && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Notas</h2>
          <p className="text-body text-fg-muted whitespace-pre-wrap">{cust.notes}</p>
        </div>
      )}
    </div>
  )
}
