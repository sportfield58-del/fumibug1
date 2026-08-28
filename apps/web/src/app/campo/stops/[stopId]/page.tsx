'use client'

import * as React from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Navigation, MapPin, CheckCircle2, XCircle, Play, PackagePlus, DollarSign, PenLine, FileCheck, Camera, Check } from 'lucide-react'
import {
  Button,
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
  getGetFieldToday,
  getListSupplies,
  postPostStopEnRoute,
  postPostStopArrive,
  postPostStopNoShow,
  postPostStopInaccessible,
  postPostStartSession,
  postPostCreateSupplyUsage,
  postPostSessionSignature,
  postPostSessionPayment,
  postPostFinishSession,
  postUploadEvidenceUrl,
  postConfirmEvidence,
} from '@/../../lib/api/client'
import type { FieldStop, Supply } from '@fumibug/contracts'

/** crypto.randomUUID existe en todo navegador moderno con contexto seguro (HTTPS/PWA) — sin fallback de node:crypto en el cliente. */
function uuid(): string {
  return crypto.randomUUID()
}

/** R47: el GPS nunca bloquea — si falla o tarda, seguimos sin coordenadas. */
function getPosition(): Promise<{ lat: number | null; lng: number | null; accuracy: number | null; gpsStatus: 'OK' | 'DENIED' | 'UNAVAILABLE' | 'TIMEOUT' }> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({ lat: null, lng: null, accuracy: null, gpsStatus: 'UNAVAILABLE' })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy, gpsStatus: 'OK' }),
      (err) => resolve({ lat: null, lng: null, accuracy: null, gpsStatus: err.code === err.PERMISSION_DENIED ? 'DENIED' : err.code === err.TIMEOUT ? 'TIMEOUT' : 'UNAVAILABLE' }),
      { timeout: 5000, maximumAge: 30000 },
    )
  })
}

const OUTCOME_REASONS = [
  { value: 'CUSTOMER_ABSENT', label: 'El cliente no estaba' },
  { value: 'PREMISES_CLOSED', label: 'Local cerrado' },
  { value: 'CONSTRUCTION_WORK', label: 'Obra en curso' },
  { value: 'LOOSE_ANIMAL', label: 'Animal suelto' },
  { value: 'NO_WATER_SUPPLY', label: 'Sin agua' },
  { value: 'RAN_OUT_OF_TIME', label: 'Se acabó el tiempo' },
  { value: 'POWER_OUTAGE', label: 'Sin luz' },
  { value: 'WEATHER', label: 'Clima' },
  { value: 'OTHER', label: 'Otro' },
] as const

export default function StopDetailPage(): JSX.Element {
  const params = useParams<{ stopId: string }>()
  const router = useRouter()
  const [stop, setStop] = React.useState<FieldStop | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [sessionId, setSessionId] = React.useState<string | null>(null)

  const fetchStop = React.useCallback(async () => {
    const res = await getGetFieldToday()
    if (res.success) {
      const found = res.data.stops.find((s) => s.id === params.stopId) ?? null
      setStop(found)
    } else {
      setError(res.error.message)
    }
    setIsLoading(false)
  }, [params.stopId])

  React.useEffect(() => {
    void fetchStop()
    const stored = typeof window !== 'undefined' ? localStorage.getItem(`campo:session:${params.stopId}`) : null
    if (stored) setSessionId(stored)
  }, [fetchStop, params.stopId])

  const run = async (fn: () => Promise<void>): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch {
      setError('Algo falló — probá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  const markEnRoute = (): Promise<void> => run(async () => {
    const gps = await getPosition()
    const res = await postPostStopEnRoute({ params: { id: params.stopId }, body: { occurredAt: new Date().toISOString(), lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, gpsStatus: gps.gpsStatus, clientEventId: uuid() } })
    if (res.success) void fetchStop(); else setError(res.error.message)
  })

  const markArrive = (): Promise<void> => run(async () => {
    const gps = await getPosition()
    const res = await postPostStopArrive({ params: { id: params.stopId }, body: { occurredAt: new Date().toISOString(), lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, gpsStatus: gps.gpsStatus, clientEventId: uuid() } })
    if (res.success) void fetchStop(); else setError(res.error.message)
  })

  const markOutcome = (kind: 'no-show' | 'inaccessible', reason: string): Promise<void> => run(async () => {
    const gps = await getPosition()
    const fn = kind === 'no-show' ? postPostStopNoShow : postPostStopInaccessible
    const res = await fn({ params: { id: params.stopId }, body: { reason: reason as 'OTHER', evidenceIds: [], occurredAt: new Date().toISOString(), lat: gps.lat, lng: gps.lng, clientEventId: uuid() } })
    if (res.success) void fetchStop(); else setError(res.error.message)
  })

  const startSession = (): Promise<void> => run(async () => {
    if (!stop) return
    const gps = await getPosition()
    const res = await postPostStartSession({ params: { id: stop.serviceId }, body: { occurredAt: new Date().toISOString(), lat: gps.lat, lng: gps.lng, accuracy: gps.accuracy, gpsStatus: gps.gpsStatus, clientEventId: uuid() } })
    if (res.success) {
      setSessionId(res.data.id)
      localStorage.setItem(`campo:session:${params.stopId}`, res.data.id)
      void fetchStop()
    } else {
      setError(res.error.message)
    }
  })

  if (isLoading) {
    return (
      <div className="space-y-3 px-4 py-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>
    )
  }

  if (!stop) {
    return (
      <div className="space-y-4 px-4 py-6">
        <Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/campo"><ArrowLeft className="h-4 w-4" /> Volver</Link></Button>
        <p className="text-body text-destructive">{error ?? 'No se encontró esta parada.'}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-16">
      <Button variant="ghost" size="sm" asChild className="-ml-2"><Link href="/campo"><ArrowLeft className="h-4 w-4" /> Tu ruta</Link></Button>

      <div>
        <h1 className="text-h2 font-semibold text-fg">{stop.location?.customerName ?? stop.serviceCode}</h1>
        <p className="text-body text-fg-muted mt-0.5">{stop.serviceTypeName}</p>
        {stop.location?.addressLine && (
          <p className="text-caption text-fg-muted mt-1 flex items-center gap-1">
            <Navigation className="h-3.5 w-3.5" /> {stop.location.addressLine}
          </p>
        )}
        {stop.notesForTechnician && (
          <p className="text-caption text-fg mt-2 rounded-md bg-bg-subtle p-2">{stop.notesForTechnician}</p>
        )}
      </div>

      {error && <p className="text-caption text-destructive rounded-md bg-destructive/5 p-2 border border-destructive/20">{error}</p>}

      {/* PENDING / EN_ROUTE — llegar o reportar que no se pudo */}
      {(stop.status === 'PENDING' || stop.status === 'EN_ROUTE') && (
        <div className="space-y-2">
          {stop.status === 'PENDING' && (
            <Button className="w-full" size="lg" disabled={busy} onClick={() => { void markEnRoute() }}>
              <Navigation className="h-4 w-4" /> Marcar en camino
            </Button>
          )}
          <Button className="w-full" size="lg" disabled={busy} onClick={() => { void markArrive() }}>
            <MapPin className="h-4 w-4" /> Marcar llegada
          </Button>
          <OutcomeButtons busy={busy} onPick={(kind, reason) => { void markOutcome(kind, reason) }} />
        </div>
      )}

      {/* ARRIVED — iniciar el servicio */}
      {stop.status === 'ARRIVED' && (
        <Button className="w-full" size="lg" disabled={busy} onClick={() => { void startSession() }}>
          <Play className="h-4 w-4" /> Iniciar servicio
        </Button>
      )}

      {/* IN_PROGRESS — ejecución (insumos, cobro, firma, cierre) */}
      {stop.status === 'IN_PROGRESS' && sessionId && (
        <ExecutionPanel sessionId={sessionId} serviceId={stop.serviceId} onFinished={() => {
          localStorage.removeItem(`campo:session:${params.stopId}`)
          router.push('/campo')
        }} />
      )}
      {stop.status === 'IN_PROGRESS' && !sessionId && (
        <p className="text-caption text-fg-muted">
          Esta parada ya está en curso pero perdí de vista la sesión (¿recargaste la página en otro momento?).
          Volvé a "Iniciar servicio" no hace falta — probá cerrar y volver a entrar.
        </p>
      )}

      {(stop.status === 'DONE' || stop.status === 'NO_SHOW' || stop.status === 'INACCESSIBLE' || stop.status === 'SKIPPED' || stop.status === 'CANCELLED') && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-elevated p-4">
          {stop.status === 'DONE' ? <CheckCircle2 className="h-5 w-5 text-success" /> : <XCircle className="h-5 w-5 text-destructive" />}
          <span className="text-body text-fg">Esta parada ya está {stop.status === 'DONE' ? 'completada' : 'cerrada'}.</span>
        </div>
      )}
    </div>
  )
}

function OutcomeButtons({ busy, onPick }: { busy: boolean; onPick: (kind: 'no-show' | 'inaccessible', reason: string) => void }): JSX.Element {
  const [reason, setReason] = React.useState('')
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-3 space-y-2">
      <Label>Si no se pudo hacer</Label>
      <Select value={reason} onValueChange={setReason}>
        <SelectTrigger><SelectValue placeholder="Elegir motivo" /></SelectTrigger>
        <SelectContent>
          {OUTCOME_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex gap-2">
        <Button variant="outline" className="flex-1" disabled={busy || !reason} onClick={() => onPick('no-show', reason)}>No se presentó</Button>
        <Button variant="outline" className="flex-1" disabled={busy || !reason} onClick={() => onPick('inaccessible', reason)}>Inaccesible</Button>
      </div>
    </div>
  )
}

function ExecutionPanel({ sessionId, onFinished }: { sessionId: string; serviceId: string; onFinished: () => void }): JSX.Element {
  const [supplies, setSupplies] = React.useState<Supply[]>([])
  const [addedSupplies, setAddedSupplies] = React.useState<string[]>([])
  const [paid, setPaid] = React.useState(false)
  const [signed, setSigned] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [details, setDetails] = React.useState<string[]>([])
  const [busy, setBusy] = React.useState(false)

  React.useEffect(() => {
    void getListSupplies().then((res) => { if (res.success) setSupplies(res.data) })
  }, [])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <EvidencePhoto sessionId={sessionId} category="BEFORE" label="Foto antes" />
        <EvidencePhoto sessionId={sessionId} category="AFTER" label="Foto después" />
      </div>

      <SupplyForm sessionId={sessionId} supplies={supplies} disabled={busy} onAdded={(name) => setAddedSupplies((v) => [...v, name])} />
      {addedSupplies.length > 0 && (
        <p className="text-caption text-fg-muted">Aplicado: {addedSupplies.join(', ')}</p>
      )}

      <PaymentForm sessionId={sessionId} disabled={busy} onPaid={() => setPaid(true)} paid={paid} />

      <SignatureForm sessionId={sessionId} disabled={busy} onSigned={() => setSigned(true)} signed={signed} />

      <FinishForm
        sessionId={sessionId}
        disabled={busy}
        setBusy={setBusy}
        error={error}
        details={details}
        setError={setError}
        setDetails={setDetails}
        onFinished={onFinished}
      />
    </div>
  )
}

/**
 * Sube directo a Supabase Storage con la URL firmada que da el backend — el archivo
 * nunca pasa por nuestra API (docs/spec/03-modulos.md §C.11). `capture="environment"`
 * abre la cámara trasera directo en el celular en vez de la galería.
 */
function EvidencePhoto({ sessionId, category, label }: { sessionId: string; category: 'BEFORE' | 'AFTER'; label: string }): JSX.Element {
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [count, setCount] = React.useState(0)
  const [uploading, setUploading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const onFile = async (file: File): Promise<void> => {
    setUploading(true)
    setError(null)
    try {
      const signed = await postUploadEvidenceUrl({ params: { id: sessionId }, body: { category, type: 'PHOTO', mimeType: file.type || 'image/jpeg' } })
      if (!signed.success) { setError(signed.error.message); return }

      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      const putRes = await fetch(signed.data.uploadUrl, {
        method: 'PUT',
        headers: { ...(anonKey ? { apikey: anonKey } : {}), 'Content-Type': file.type || 'image/jpeg' },
        body: file,
      })
      if (!putRes.ok) { setError('No se pudo subir la foto — probá de nuevo.'); return }

      const confirmed = await postConfirmEvidence({
        params: { id: sessionId },
        body: { storagePath: signed.data.storagePath, category, type: 'PHOTO', mimeType: file.type || 'image/jpeg', sizeBytes: file.size, clientEventId: uuid() },
      })
      if (confirmed.success) {
        setCount((v) => v + 1)
      } else {
        setError(confirmed.error.message)
      }
    } catch {
      setError('No se pudo subir la foto — probá de nuevo.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (file) void onFile(file)
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
      >
        {count > 0 ? <Check className="h-4 w-4 text-success" /> : <Camera className="h-4 w-4" />}
        {uploading ? 'Subiendo...' : count > 0 ? `${label} (${count})` : label}
      </Button>
      {error && <p className="text-caption text-destructive mt-1">{error}</p>}
    </div>
  )
}

function SupplyForm({ sessionId, supplies, disabled, onAdded }: { sessionId: string; supplies: Supply[]; disabled: boolean; onAdded: (name: string) => void }): JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [supplyId, setSupplyId] = React.useState('')
  const [quantity, setQuantity] = React.useState('')
  const [isDilutedMix, setIsDilutedMix] = React.useState(false)
  const [applicationMethod, setApplicationMethod] = React.useState('SPRAY')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    const supply = supplies.find((s) => s.id === supplyId)
    if (!supply || !quantity) { setError('Elegí el insumo y la cantidad.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await postPostCreateSupplyUsage({
        params: { id: sessionId },
        body: {
          supplyId,
          quantityApplied: Number(quantity),
          unit: supply.applicationUnit,
          isDilutedMix,
          applicationMethod: applicationMethod as 'SPRAY' | 'GEL' | 'BAIT_STATION' | 'FOG' | 'DUST' | 'GRANULE',
          clientEventId: uuid(),
        },
      })
      if (res.success) {
        onAdded(supply.name)
        setOpen(false)
        setSupplyId('')
        setQuantity('')
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo registrar el insumo.')
    } finally {
      setSaving(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <PackagePlus className="h-4 w-4" /> Registrar insumo aplicado
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <Label>Insumo</Label>
      <Select value={supplyId} onValueChange={setSupplyId}>
        <SelectTrigger><SelectValue placeholder="Elegir insumo" /></SelectTrigger>
        <SelectContent>
          {supplies.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="qty">Cantidad</Label>
          <Input id="qty" type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Modo</Label>
          <Select value={applicationMethod} onValueChange={setApplicationMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['SPRAY', 'GEL', 'BAIT_STATION', 'FOG', 'DUST', 'GRANULE'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-body text-fg">
        <input type="checkbox" checked={isDilutedMix} onChange={(e) => setIsDilutedMix(e.target.checked)} className="h-4 w-4" />
        Es mezcla diluida (calculamos el concentrado solo)
      </label>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={saving} onClick={() => { void submit() }}>{saving ? 'Guardando...' : 'Guardar'}</Button>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}

function PaymentForm({ sessionId, disabled, paid, onPaid }: { sessionId: string; disabled: boolean; paid: boolean; onPaid: () => void }): JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState('CASH')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    const cents = Math.round(Number(amount) * 100)
    if (!cents) { setError('Ingresá el monto.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await postPostSessionPayment({ params: { id: sessionId }, body: { amountCents: cents, method: method as 'CASH' | 'TRANSFER' | 'MERCADOPAGO' | 'CARD' | 'CHECK' | 'ACCOUNT', clientEventId: uuid() } })
      if (res.success) { onPaid(); setOpen(false) } else { setError(res.error.message) }
    } catch {
      setError('No se pudo registrar el cobro.')
    } finally {
      setSaving(false)
    }
  }

  if (paid) {
    return <p className="text-caption text-success flex items-center gap-1"><DollarSign className="h-4 w-4" /> Cobro registrado.</p>
  }
  if (!open) {
    return (
      <Button variant="outline" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <DollarSign className="h-4 w-4" /> Cobrar
      </Button>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label htmlFor="amount">Monto ($)</Label>
          <Input id="amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Método</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['CASH', 'TRANSFER', 'MERCADOPAGO', 'CARD', 'CHECK', 'ACCOUNT'].map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={saving} onClick={() => { void submit() }}>{saving ? 'Guardando...' : 'Confirmar cobro'}</Button>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}

const NO_SIGNATURE_REASONS = [
  { value: 'CUSTOMER_UNAVAILABLE', label: 'El cliente no estaba' },
  { value: 'CUSTOMER_REFUSED', label: 'No quiso firmar' },
  { value: 'MINOR_ON_SITE', label: 'Solo había un menor' },
  { value: 'OTHER', label: 'Otro motivo' },
] as const

function SignatureForm({ sessionId, disabled, signed, onSigned }: { sessionId: string; disabled: boolean; signed: boolean; onSigned: () => void }): JSX.Element {
  const [open, setOpen] = React.useState(false)
  const [signerName, setSignerName] = React.useState('')
  const [noReason, setNoReason] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!signerName && !noReason) { setError('Cargá quién firmó, o el motivo por el que no firmó nadie.'); return }
    setSaving(true)
    setError(null)
    try {
      const res = await postPostSessionSignature({
        params: { id: sessionId },
        body: {
          signerName: signerName || null,
          noSignatureReason: signerName ? null : (noReason as 'OTHER'),
          clientEventId: uuid(),
        },
      })
      if (res.success) { onSigned(); setOpen(false) } else { setError(res.error.message) }
    } catch {
      setError('No se pudo registrar la firma.')
    } finally {
      setSaving(false)
    }
  }

  if (signed) {
    return <p className="text-caption text-success flex items-center gap-1"><PenLine className="h-4 w-4" /> Firma registrada.</p>
  }
  if (!open) {
    return (
      <Button variant="outline" className="w-full" disabled={disabled} onClick={() => setOpen(true)}>
        <PenLine className="h-4 w-4" /> Firma del cliente
      </Button>
    )
  }
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <div className="space-y-1">
        <Label htmlFor="signer">Nombre de quien firma</Label>
        <Input id="signer" value={signerName} onChange={(e) => setSignerName(e.target.value)} placeholder="Si firmó, poné el nombre acá" />
      </div>
      <div className="space-y-1">
        <Label>...o motivo si no firmó nadie</Label>
        <Select value={noReason} onValueChange={setNoReason}>
          <SelectTrigger><SelectValue placeholder="Sin firma porque..." /></SelectTrigger>
          <SelectContent>
            {NO_SIGNATURE_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex gap-2">
        <Button className="flex-1" disabled={saving} onClick={() => { void submit() }}>{saving ? 'Guardando...' : 'Confirmar'}</Button>
        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
      </div>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}

function FinishForm({
  sessionId,
  disabled,
  setBusy,
  error,
  details,
  setError,
  setDetails,
  onFinished,
}: {
  sessionId: string
  disabled: boolean
  setBusy: (v: boolean) => void
  error: string | null
  details: string[]
  setError: (v: string | null) => void
  setDetails: (v: string[]) => void
  onFinished: () => void
}): JSX.Element {
  const [paymentDecision, setPaymentDecision] = React.useState('COLLECTED')
  const [notes, setNotes] = React.useState('')
  const [saving, setSaving] = React.useState(false)

  const submit = async (): Promise<void> => {
    setSaving(true)
    setBusy(true)
    setError(null)
    setDetails([])
    try {
      const res = await postPostFinishSession({
        params: { id: sessionId },
        body: { paymentDecision: paymentDecision as 'COLLECTED' | 'ACCOUNT_RECEIVABLE' | 'NOT_APPLICABLE', technicianNotes: notes || null, occurredAt: new Date().toISOString(), clientEventId: uuid() },
      })
      if (res.success) {
        onFinished()
      } else {
        setError(res.error.message)
        setDetails((res.error.details ?? []).map((d) => d.message ?? '').filter(Boolean))
      }
    } catch {
      setError('No se pudo cerrar el servicio.')
    } finally {
      setSaving(false)
      setBusy(false)
    }
  }

  return (
    <div className="rounded-lg border-2 border-primary/30 bg-primary-subtle p-4 space-y-3">
      <h2 className="text-body font-semibold text-fg flex items-center gap-2"><FileCheck className="h-4 w-4" /> Cerrar servicio</h2>
      <div className="space-y-1">
        <Label>¿Cómo quedó el pago?</Label>
        <Select value={paymentDecision} onValueChange={setPaymentDecision}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="COLLECTED">Cobrado</SelectItem>
            <SelectItem value="ACCOUNT_RECEIVABLE">Cuenta corriente</SelectItem>
            <SelectItem value="NOT_APPLICABLE">No corresponde cobrar</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <Label htmlFor="notes">Notas (opcional)</Label>
        <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Algo para dejar registrado" />
      </div>
      <Button className="w-full" size="lg" disabled={disabled || saving} onClick={() => { void submit() }}>
        {saving ? 'Cerrando...' : 'Cerrar servicio'}
      </Button>
      {error && (
        <div className="text-caption text-destructive">
          <p>{error}</p>
          {details.length > 0 && (
            <ul className="mt-1 list-disc pl-4">
              {details.map((d, i) => <li key={i}>{d}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
