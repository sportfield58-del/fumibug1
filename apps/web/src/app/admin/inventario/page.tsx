'use client'

import * as React from 'react'
import { Package, Plus, ArrowLeftRight } from 'lucide-react'
import {
  Button,
  Badge,
  EmptyState,
  Skeleton,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@fumibug/ui'
import {
  getListSupplies,
  postCreateSupply,
  getListStockLocations,
  getListInventory,
  postCreateInventoryMovement,
} from '@/../../lib/api/client'
import type { Supply, StockLocation, InventoryBalance } from '@fumibug/contracts'

const MOVEMENT_TYPES = [
  { value: 'PURCHASE', label: 'Compra (entra al depósito)' },
  { value: 'TRANSFER', label: 'Transferencia entre ubicaciones' },
  { value: 'ADJUSTMENT', label: 'Ajuste (sube o baja)' },
  { value: 'LOSS', label: 'Pérdida' },
  { value: 'RETURN', label: 'Devolución al depósito' },
  { value: 'EXPIRY_WRITE_OFF', label: 'Baja por vencimiento' },
] as const

/**
 * docs/spec/13-inventario-caja.md §N. Alcance de hoy: catálogo, saldo actual y
 * movimientos manuales (compra/transferencia/ajuste/pérdida/devolución/baja). El
 * consumo en campo (dilución, descuento del vehículo del operario) llega con la
 * sesión de campo — acá no se inventa ese flujo.
 */
export default function InventarioPage(): JSX.Element {
  const [supplies, setSupplies] = React.useState<Supply[]>([])
  const [locations, setLocations] = React.useState<StockLocation[]>([])
  const [balances, setBalances] = React.useState<InventoryBalance[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [showSupplyForm, setShowSupplyForm] = React.useState(false)
  const [showMovementForm, setShowMovementForm] = React.useState(false)

  const fetchAll = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [s, l, b] = await Promise.all([getListSupplies(), getListStockLocations(), getListInventory({})])
      if (s.success) setSupplies(s.data)
      if (l.success) setLocations(l.data)
      if (b.success) setBalances(b.data)
      if (!s.success || !l.success || !b.success) setError('No se pudo cargar todo el inventario.')
    } catch {
      setError('No se pudo cargar el inventario.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-semibold text-fg">Inventario</h1>
          <p className="text-body text-fg-muted mt-1">Insumos, ubicaciones de stock y movimientos.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowSupplyForm((v) => !v)}>
            <Plus className="h-4 w-4" /> Nuevo insumo
          </Button>
          <Button onClick={() => setShowMovementForm((v) => !v)}>
            <ArrowLeftRight className="h-4 w-4" /> Nuevo movimiento
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchAll() }} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {showSupplyForm && (
        <NewSupplyForm
          onCreated={() => {
            setShowSupplyForm(false)
            void fetchAll()
          }}
        />
      )}

      {showMovementForm && (
        <NewMovementForm
          supplies={supplies}
          locations={locations}
          onCreated={() => {
            setShowMovementForm(false)
            void fetchAll()
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-h3 font-semibold text-fg">Saldo actual</h2>
            {balances.length === 0 ? (
              <EmptyState
                icon={<Package className="h-8 w-8 text-fg-subtle" />}
                title="Sin stock cargado"
                description="Registrá una compra para empezar a tener saldo en el depósito."
              />
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-body">
                  <thead className="bg-bg-subtle text-caption text-fg-muted">
                    <tr>
                      <th className="text-left px-3 py-2">Ubicación</th>
                      <th className="text-left px-3 py-2">Insumo</th>
                      <th className="text-left px-3 py-2">Lote</th>
                      <th className="text-right px-3 py-2">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody>
                    {balances.map((b, i) => (
                      <tr key={`${b.stockLocationId}-${b.supplyId}-${b.lotId ?? 'sin-lote'}-${i}`} className="border-t border-border">
                        <td className="px-3 py-2">{b.stockLocationName}</td>
                        <td className="px-3 py-2">{b.supplyName} <span className="text-fg-subtle">({b.supplySku})</span></td>
                        <td className="px-3 py-2 text-fg-muted">{b.lotCode ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          {b.quantity} {b.applicationUnit}
                          {b.belowMinimum && (
                            <Badge variant="destructive" className="ml-2">Bajo mínimo</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-h3 font-semibold text-fg">Catálogo de insumos</h2>
            {supplies.length === 0 ? (
              <p className="text-caption text-fg-muted">Todavía no hay insumos cargados.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {supplies.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-bg-elevated p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-body font-semibold text-fg">{s.name}</p>
                      <Badge variant="secondary">{s.sku}</Badge>
                    </div>
                    <p className="text-caption text-fg-muted mt-1">
                      {s.category} · {s.registryAuthority} {s.registryNumber}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function NewSupplyForm({ onCreated }: { onCreated: () => void }): JSX.Element {
  const [sku, setSku] = React.useState('')
  const [name, setName] = React.useState('')
  const [category, setCategory] = React.useState('INSECTICIDE')
  const [registryAuthority, setRegistryAuthority] = React.useState('SENASA')
  const [registryNumber, setRegistryNumber] = React.useState('')
  const [purchaseUnit, setPurchaseUnit] = React.useState('L')
  const [applicationUnit, setApplicationUnit] = React.useState('ML')
  const [isSaving, setIsSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!sku || !name || !registryNumber) {
      setFormError('SKU, nombre y número de registro son obligatorios.')
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      const res = await postCreateSupply({
        body: {
          sku,
          name,
          category: category as Supply['category'],
          registryAuthority: registryAuthority as Supply['registryAuthority'],
          registryNumber,
          purchaseUnit: purchaseUnit as Supply['purchaseUnit'],
          applicationUnit: applicationUnit as Supply['applicationUnit'],
          requiresLotTracking: true,
        },
      })
      if (res.success) {
        onCreated()
      } else {
        setFormError(res.error.message)
      }
    } catch {
      setFormError('No se pudo crear el insumo.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <h2 className="text-body font-semibold text-fg">Nuevo insumo</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="supply-sku">SKU</Label>
          <Input id="supply-sku" value={sku} onChange={(e) => setSku(e.target.value)} placeholder="CIP-25EC" />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="supply-name">Nombre</Label>
          <Input id="supply-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Cipermetrina 25% EC" />
        </div>
        <div className="space-y-1">
          <Label>Categoría</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['INSECTICIDE', 'RODENTICIDE', 'DISINFECTANT', 'BAIT', 'TRAP', 'PPE', 'OTHER'].map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Autoridad de registro</Label>
          <Select value={registryAuthority} onValueChange={setRegistryAuthority}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['SENASA', 'ANMAT', 'OTHER'].map((a) => (
                <SelectItem key={a} value={a}>{a}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="supply-registry">N° de registro</Label>
          <Input id="supply-registry" value={registryNumber} onChange={(e) => setRegistryNumber(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Unidad de compra</Label>
          <Select value={purchaseUnit} onValueChange={setPurchaseUnit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['L', 'ML', 'KG', 'G', 'UNIT'].map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>Unidad de aplicación</Label>
          <Select value={applicationUnit} onValueChange={setApplicationUnit}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['L', 'ML', 'KG', 'G', 'UNIT'].map((u) => (
                <SelectItem key={u} value={u}>{u}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => { void submit() }} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Crear insumo'}</Button>
      </div>
      {formError && <p className="text-caption text-destructive">{formError}</p>}
    </div>
  )
}

function NewMovementForm({
  supplies,
  locations,
  onCreated,
}: {
  supplies: Supply[]
  locations: StockLocation[]
  onCreated: () => void
}): JSX.Element {
  const [type, setType] = React.useState<(typeof MOVEMENT_TYPES)[number]['value']>('PURCHASE')
  const [supplyId, setSupplyId] = React.useState('')
  const [stockLocationId, setStockLocationId] = React.useState('')
  const [fromStockLocationId, setFromStockLocationId] = React.useState('')
  const [toStockLocationId, setToStockLocationId] = React.useState('')
  const [quantity, setQuantity] = React.useState('')
  const [lotCode, setLotCode] = React.useState('')
  const [reason, setReason] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const reasonRequired = type === 'ADJUSTMENT' || type === 'LOSS' || type === 'EXPIRY_WRITE_OFF'

  const submit = async (): Promise<void> => {
    const qty = Number(quantity)
    if (!supplyId || !qty) {
      setFormError('Elegí insumo y cantidad.')
      return
    }
    if (type === 'TRANSFER' && (!fromStockLocationId || !toStockLocationId)) {
      setFormError('Elegí ubicación de origen y destino.')
      return
    }
    if (type !== 'TRANSFER' && !stockLocationId) {
      setFormError('Elegí la ubicación.')
      return
    }
    if (reasonRequired && !reason) {
      setFormError('El motivo es obligatorio para este tipo de movimiento.')
      return
    }
    setIsSaving(true)
    setFormError(null)
    try {
      const res = await postCreateInventoryMovement({
        body: {
          type,
          supplyId,
          quantity: qty,
          lotCode: lotCode || undefined,
          reason: reason || undefined,
          ...(type === 'TRANSFER'
            ? { fromStockLocationId, toStockLocationId }
            : { stockLocationId }),
        },
      })
      if (res.success) {
        onCreated()
      } else {
        setFormError(res.error.message)
      }
    } catch {
      setFormError('No se pudo registrar el movimiento.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <h2 className="text-body font-semibold text-fg">Nuevo movimiento</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label>Tipo</Label>
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {MOVEMENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label>Insumo</Label>
          <Select value={supplyId} onValueChange={setSupplyId}>
            <SelectTrigger><SelectValue placeholder="Elegir insumo" /></SelectTrigger>
            <SelectContent>
              {supplies.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name} ({s.sku})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {type === 'TRANSFER' ? (
          <>
            <div className="space-y-1">
              <Label>Desde</Label>
              <Select value={fromStockLocationId} onValueChange={setFromStockLocationId}>
                <SelectTrigger><SelectValue placeholder="Origen" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Hacia</Label>
              <Select value={toStockLocationId} onValueChange={setToStockLocationId}>
                <SelectTrigger><SelectValue placeholder="Destino" /></SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <div className="space-y-1">
            <Label>Ubicación</Label>
            <Select value={stockLocationId} onValueChange={setStockLocationId}>
              <SelectTrigger><SelectValue placeholder="Elegir ubicación" /></SelectTrigger>
              <SelectContent>
                {locations.map((l) => (
                  <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <Label htmlFor="mov-qty">Cantidad</Label>
          <Input id="mov-qty" type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="mov-lot">Lote (opcional)</Label>
          <Input id="mov-lot" value={lotCode} onChange={(e) => setLotCode(e.target.value)} placeholder="L-2026-08" />
        </div>
        <div className="space-y-1 sm:col-span-3">
          <Label htmlFor="mov-reason">Motivo {reasonRequired && '(obligatorio)'}</Label>
          <Input id="mov-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => { void submit() }} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Registrar movimiento'}</Button>
      </div>
      {formError && <p className="text-caption text-destructive">{formError}</p>}
    </div>
  )
}
