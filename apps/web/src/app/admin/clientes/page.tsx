'use client'

import * as React from 'react'
import Link from 'next/link'
import { Search, Plus, Building2, Tag, MoreHorizontal } from 'lucide-react'
import { Button, Input, Badge, EmptyState, Skeleton } from '@fumibug/ui'
import { getListCustomers } from '@/../../lib/api/client'
import type { Customer } from '@fumibug/contracts'

const customerTypeLabels: Record<string, string> = {
  INDIVIDUAL: 'Particular',
  COMPANY: 'Empresa',
}

export default function ClientesPage(): JSX.Element {
  const [search, setSearch] = React.useState('')
  const [customers, setCustomers] = React.useState<Customer[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const fetchCustomers = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getListCustomers({
        query: { search: search || undefined, limit: 20 },
      })
      if (res.success) {
        setCustomers(res.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar los clientes')
    } finally {
      setIsLoading(false)
    }
  }, [search])

  React.useEffect(() => {
    const timer = setTimeout(() => { void fetchCustomers() }, 300)
    return () => clearTimeout(timer)
  }, [fetchCustomers])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-fg">Clientes</h1>
        <Button asChild>
          <Link href="/admin/clientes/nuevo">
            <Plus className="h-4 w-4" />
            Nuevo cliente
          </Link>
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        <Input
          placeholder="Buscar por nombre, CUIT, teléfono..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
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
          <Button variant="outline" size="sm" onClick={() => { void fetchCustomers() }} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && customers.length === 0 && (
        <EmptyState
          icon={<Building2 className="h-8 w-8 text-fg-subtle" />}
          title="Crear cliente"
          description={
            search
              ? 'No se encontraron clientes con esa búsqueda.'
              : 'Aún no hay clientes cargados.'
          }
          action={
            !search
              ? {
                  label: 'Crear el primero',
                  onClick: () => { window.location.href = '/admin/clientes/nuevo' },
                }
              : undefined
          }
        />
      )}

      {/* List */}
      {!isLoading && !error && customers.length > 0 && (
        <div className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
          {customers.map((customer) => (
            <Link
              key={customer.id}
              href={`/admin/clientes/${customer.id}`}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-bg-sunken"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-body font-medium text-fg truncate">
                    {customer.tradeName ?? customer.legalName}
                  </p>
                  <p className="text-caption text-fg-muted truncate">
                    {customer.legalName}
                    {customer.taxId && ` · ${customer.taxId}`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="secondary">
                  {customerTypeLabels[customer.type] ?? customer.type}
                </Badge>
                {customer.tags.length > 0 && (
                  <div className="hidden sm:flex items-center gap-1">
                    <Tag className="h-3 w-3 text-fg-subtle" />
                    <span className="text-caption text-fg-subtle">
                      {customer.tags.length}
                    </span>
                  </div>
                )}
                <MoreHorizontal className="h-4 w-4 text-fg-subtle" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
