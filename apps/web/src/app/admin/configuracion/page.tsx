'use client'

import * as React from 'react'
import { Plus, Server, MapPin, BadgeDollarSign, RefreshCw, Wrench, Pencil } from 'lucide-react'
import { Button, Badge, EmptyState, Skeleton, Input, Label, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import {
  getListServiceTypes,
  postCreateServiceType,
  patchUpdateServiceType,
  getListZones,
  postCreateZone,
  patchUpdateZone,
  getListPriceLists,
  postCreatePriceList,
  patchUpdatePriceList,
} from '@/../../lib/api/client'
import type { ServiceType, Zone, PriceListWithItems } from '@fumibug/contracts'

const CURRENCY = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 })

const asEtag = (updatedAt: string): string => `"${updatedAt}"`

export default function ConfiguracionPage(): JSX.Element {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-h1 font-semibold text-fg">Configuración</h1>
        <p className="text-body text-fg-muted mt-1">
          Catálogo del tenant: tipos de servicio, zonas y listas de precios.
        </p>
      </div>

      <ServiceTypesSection />
      <ZonesSection />
      <PriceListsSection />
    </div>
  )
}

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count: number }): JSX.Element {
  return (
    <div className="flex items-center justify-between">
      <h2 className="text-h2 font-semibold text-fg flex items-center gap-2">
        {icon}
        {title}
      </h2>
      <Badge variant="outline">{count}</Badge>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tipos de servicio
// ---------------------------------------------------------------------------

function ServiceTypesSection(): JSX.Element {
  const [items, setItems] = React.useState<ServiceType[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [key, setKey] = React.useState('')
  const [name, setName] = React.useState('')
  const [duration, setDuration] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getListServiceTypes()
      if (res.success) setItems(res.data)
      else setError(res.error.message)
    } catch {
      setError('No se pudieron cargar los tipos de servicio.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => { void fetchData() }, [fetchData])

  const startCreate = (): void => {
    setEditingId(null); setKey(''); setName(''); setDuration(''); setFormError(null); setShowForm(true)
  }

  const startEdit = (item: ServiceType): void => {
    setEditingId(item.id); setKey(item.key); setName(item.name)
    setDuration(item.defaultDurationMinutes ? String(item.defaultDurationMinutes) : '')
    setFormError(null); setShowForm(true)
  }

  const cancel = (): void => { setShowForm(false); setEditingId(null); setFormError(null) }

  const submit = async (): Promise<void> => {
    if (!key.trim() || !name.trim()) { setFormError('Completá la clave y el nombre.'); return }
    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        const res = await patchUpdateServiceType({
          params: { id: editingId },
          etag: asEtag(items.find((i) => i.id === editingId)?.updatedAt ?? ''),
          body: {
            name: name.trim(),
            ...(duration !== '' ? { defaultDurationMinutes: Number(duration) } : {}),
          },
        })
        if (res.success) {
          setItems((prev) => prev.map((i) => (i.id === editingId ? res.data : i)).sort((a, b) => a.name.localeCompare(b.name)))
          cancel()
        } else {
          setFormError(res.error.code === 'VERSION_CONFLICT' ? 'El dato cambió en otro lugar; refrescá y volvé a intentar.' : res.error.message)
        }
        return
      }
      const res = await postCreateServiceType({
        body: {
          key: key.trim(),
          name: name.trim(),
          ...(duration !== '' ? { defaultDurationMinutes: Number(duration) } : {}),
          requiredSupplyIds: [],
        },
      })
      if (res.success) {
        setItems((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
        cancel()
      } else {
        setFormError(res.error.message)
      }
    } catch {
      setFormError('No se pudo guardar el tipo de servicio.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader icon={<Wrench className="h-5 w-5 text-fg-subtle" />} title="Tipos de servicio" count={items.length} />
        <Button variant="outline" size="sm" onClick={() => void fetchData()}><RefreshCw className="h-4 w-4" /> Refrescar</Button>
      </div>

      {isLoading && <Skeleton className="h-24 w-full rounded-lg" />}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void fetchData()}>Reintentar</Button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState icon={<Wrench className="h-8 w-8 text-fg-subtle" />} title="Sin tipos" description="Todavía no hay tipos de servicio." />
      )}

      <div className="space-y-2">
        {items.map((t) => (
          <div key={t.id} className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-body font-semibold text-fg">{t.name}</p>
                <p className="text-caption text-fg-muted">clave: {t.key}{t.defaultDurationMinutes ? ` · ${t.defaultDurationMinutes} min` : ''}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => startEdit(t)}><Pencil className="h-4 w-4" /> Editar</Button>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <Button variant="outline" className="w-full" onClick={startCreate}>
          <Plus className="h-4 w-4" /> Nuevo tipo de servicio
        </Button>
      ) : (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Clave</Label>
              <Input value={key} onChange={(e) => setKey(e.target.value)} placeholder="ej: roedor-control" readOnly={!!editingId} disabled={!!editingId} />
            </div>
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Control de roedores" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Duración por defecto (min)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="30" />
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving} onClick={() => void submit()}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}</Button>
            <Button variant="outline" onClick={cancel}>Cancelar</Button>
          </div>
          {formError && <p className="text-caption text-destructive">{formError}</p>}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Zonas
// ---------------------------------------------------------------------------

function ZonesSection(): JSX.Element {
  const [items, setItems] = React.useState<Zone[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')
  const [color, setColor] = React.useState('#22c55e')
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getListZones()
      if (res.success) setItems(res.data)
      else setError(res.error.message)
    } catch {
      setError('No se pudieron cargar las zonas.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => { void fetchData() }, [fetchData])

  const startCreate = (): void => {
    setEditingId(null); setName(''); setColor('#22c55e'); setFormError(null); setShowForm(true)
  }

  const startEdit = (item: Zone): void => {
    setEditingId(item.id); setName(item.name); setColor(item.color ?? '#22c55e'); setFormError(null); setShowForm(true)
  }

  const cancel = (): void => { setShowForm(false); setEditingId(null); setFormError(null) }

  const submit = async (): Promise<void> => {
    if (!name.trim()) { setFormError('Completá el nombre de la zona.'); return }
    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        const res = await patchUpdateZone({
          params: { id: editingId },
          etag: asEtag(items.find((i) => i.id === editingId)?.updatedAt ?? ''),
          body: { name: name.trim(), color },
        })
        if (res.success) {
          setItems((prev) => prev.map((i) => (i.id === editingId ? res.data : i)).sort((a, b) => a.name.localeCompare(b.name)))
          cancel()
        } else {
          setFormError(res.error.code === 'VERSION_CONFLICT' ? 'El dato cambió en otro lugar; refrescá y volvé a intentar.' : res.error.message)
        }
        return
      }
      const res = await postCreateZone({ body: { name: name.trim(), color } })
      if (res.success) {
        setItems((prev) => [...prev, res.data].sort((a, b) => a.name.localeCompare(b.name)))
        cancel()
      } else {
        setFormError(res.error.message)
      }
    } catch {
      setFormError('No se pudo guardar la zona.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader icon={<MapPin className="h-5 w-5 text-fg-subtle" />} title="Zonas" count={items.length} />
        <Button variant="outline" size="sm" onClick={() => void fetchData()}><RefreshCw className="h-4 w-4" /> Refrescar</Button>
      </div>

      {isLoading && <Skeleton className="h-20 w-full rounded-lg" />}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void fetchData()}>Reintentar</Button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState icon={<MapPin className="h-8 w-8 text-fg-subtle" />} title="Sin zonas" description="Todavía no hay zonas." />
      )}

      <div className="space-y-2">
        {items.map((z) => (
          <div key={z.id} className="rounded-lg border border-border bg-bg-elevated p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                {z.color && <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: z.color }} />}
                <p className="text-body font-semibold text-fg">{z.name}</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => startEdit(z)}><Pencil className="h-4 w-4" /> Editar</Button>
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <Button variant="outline" className="w-full" onClick={startCreate}>
          <Plus className="h-4 w-4" /> Nueva zona
        </Button>
      ) : (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Centro" />
          </div>
          <div className="space-y-1">
            <Label>Color</Label>
            <div className="flex items-center gap-3">
              <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-9 w-12 rounded border border-border" />
              <span className="text-caption text-fg-muted font-mono">{color}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving} onClick={() => void submit()}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}</Button>
            <Button variant="outline" onClick={cancel}>Cancelar</Button>
          </div>
          {formError && <p className="text-caption text-destructive">{formError}</p>}
        </div>
      )}
    </section>
  )
}

// ---------------------------------------------------------------------------
// Listas de precios
// ---------------------------------------------------------------------------

function PriceListsSection(): JSX.Element {
  const [items, setItems] = React.useState<PriceListWithItems[]>([])
  const [serviceTypes, setServiceTypes] = React.useState<ServiceType[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showForm, setShowForm] = React.useState(false)
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [name, setName] = React.useState('')
  const [validFrom, setValidFrom] = React.useState('')
  const [validTo, setValidTo] = React.useState('')
  const [isDefault, setIsDefault] = React.useState(false)
  const [serviceTypeId, setServiceTypeId] = React.useState('')
  const [price, setPrice] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [plRes, stRes] = await Promise.all([getListPriceLists(), getListServiceTypes()])
      if (plRes.success) setItems(plRes.data)
      else { setError(plRes.error.message); return }
      if (stRes.success) setServiceTypes(stRes.data)
    } catch {
      setError('No se pudieron cargar las listas de precios.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => { void fetchData() }, [fetchData])

  const startCreate = (): void => {
    setEditingId(null); setName(''); setValidFrom(''); setValidTo(''); setIsDefault(false)
    setServiceTypeId(''); setPrice(''); setFormError(null); setShowForm(true)
  }

  const startEdit = (pl: PriceListWithItems): void => {
    setEditingId(pl.id); setName(pl.name); setValidFrom(pl.validFrom); setValidTo(pl.validTo ?? '')
    setIsDefault(pl.isDefault); setServiceTypeId(''); setPrice(''); setFormError(null); setShowForm(true)
  }

  const cancel = (): void => { setShowForm(false); setEditingId(null); setFormError(null) }

  const submit = async (): Promise<void> => {
    if (!name.trim() || !validFrom) { setFormError('Completá el nombre y la fecha de vigencia.'); return }
    setSaving(true)
    setFormError(null)
    try {
      if (editingId) {
        const res = await patchUpdatePriceList({
          params: { id: editingId },
          etag: asEtag(items.find((i) => i.id === editingId)?.updatedAt ?? ''),
          body: {
            name: name.trim(),
            validFrom,
            ...(validTo ? { validTo } : {}),
            isDefault,
          },
        })
        if (res.success) {
          setItems((prev) => prev.map((i) => (i.id === editingId ? res.data : i)))
          cancel()
        } else {
          setFormError(res.error.code === 'VERSION_CONFLICT' ? 'El dato cambió en otro lugar; refrescá y volvé a intentar.' : res.error.message)
        }
        return
      }
      if (!serviceTypeId || !price) { setSaving(false); setFormError('Agregá al menos un precio (tipo de servicio + monto).'); return }
      const cents = Math.round(Number(price) * 100)
      if (!Number.isFinite(cents) || cents < 0) { setSaving(false); setFormError('El monto no es válido.'); return }
      const res = await postCreatePriceList({
        body: {
          name: name.trim(),
          validFrom,
          ...(validTo ? { validTo } : {}),
          isDefault,
          items: [{ serviceTypeId, establishmentType: null, priceCents: cents }],
        },
      })
      if (res.success) {
        setItems((prev) => [res.data, ...prev])
        cancel()
      } else {
        setFormError(res.error.message)
      }
    } catch {
      setFormError('No se pudo guardar la lista de precios.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader icon={<BadgeDollarSign className="h-5 w-5 text-fg-subtle" />} title="Listas de precios" count={items.length} />
        <Button variant="outline" size="sm" onClick={() => void fetchData()}><RefreshCw className="h-4 w-4" /> Refrescar</Button>
      </div>

      {isLoading && <Skeleton className="h-24 w-full rounded-lg" />}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => void fetchData()}>Reintentar</Button>
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <EmptyState icon={<BadgeDollarSign className="h-8 w-8 text-fg-subtle" />} title="Sin listas" description="Todavía no hay listas de precios." />
      )}

      <div className="space-y-2">
        {items.map((pl) => (
          <div key={pl.id} className="rounded-lg border border-border bg-bg-elevated p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-body font-semibold text-fg flex items-center gap-2">
                  {pl.name}
                  {pl.isDefault && <Badge>Por defecto</Badge>}
                </p>
                <p className="text-caption text-fg-muted">
                  {pl.validFrom} → {pl.validTo ?? 'sin fin'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => startEdit(pl)}><Pencil className="h-4 w-4" /> Editar</Button>
            </div>
            <div className="space-y-1">
              {pl.items.length === 0 && <p className="text-caption text-fg-muted">Sin precios cargados.</p>}
              {pl.items.map((item) => {
                const st = serviceTypes.find((s) => s.id === item.serviceTypeId)
                return (
                  <div key={item.id} className="flex items-center justify-between rounded-md bg-bg-subtle px-3 py-2">
                    <span className="text-body text-fg">{st?.name ?? item.serviceTypeId}</span>
                    <span className="text-body font-semibold text-fg tabular-nums">{CURRENCY.format(item.priceCents / 100)}</span>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {!showForm ? (
        <Button variant="outline" className="w-full" onClick={startCreate}>
          <Plus className="h-4 w-4" /> Nueva lista de precios
        </Button>
      ) : (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
          <div className="space-y-1">
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tarifa 2026-2" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Vigente desde</Label>
              <Input type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Hasta (opcional)</Label>
              <Input type="date" value={validTo} onChange={(e) => setValidTo(e.target.value)} />
            </div>
          </div>

          {!editingId && (
            <div className="rounded-md border border-border p-3 space-y-3">
              <p className="text-body font-semibold text-fg flex items-center gap-2"><Server className="h-4 w-4" /> Precio</p>
              <div className="space-y-1">
                <Label>Tipo de servicio</Label>
                <Select value={serviceTypeId} onValueChange={setServiceTypeId}>
                  <SelectTrigger><SelectValue placeholder="Elegir tipo" /></SelectTrigger>
                  <SelectContent>
                    {serviceTypes.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Monto ($)</Label>
                <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="25000" />
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-body text-fg">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} className="h-4 w-4" />
            Es la lista por defecto
          </label>

          <div className="flex gap-2">
            <Button className="flex-1" disabled={saving} onClick={() => void submit()}>{saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Guardar'}</Button>
            <Button variant="outline" onClick={cancel}>Cancelar</Button>
          </div>
          {formError && <p className="text-caption text-destructive">{formError}</p>}
        </div>
      )}
    </section>
  )
}
