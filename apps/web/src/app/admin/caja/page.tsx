'use client'

import * as React from 'react'
import { Wallet, Plus, CheckCircle, ArrowRightLeft } from 'lucide-react'
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
  getListCashAccounts,
  getListCashMovements,
  getListCashClosures,
  postDeclareCashClosure,
  postReconcileCashClosure,
  postCreatePayment,
  getListCustomers,
} from '@/../../lib/api/client'
import type { CashAccount, CashMovement, CashClosure, CustomerWithContacts } from '@fumibug/contracts'

function centsToPesos(cents: number): string {
  return (cents / 100).toLocaleString('es-AR', { style: 'currency', currency: 'ARS' })
}

/**
 * docs/spec/13-inventario-caja.md §O. Partida simple, append-only. Cada caja es de
 * un operario; acá el admin ve saldos, declara/concilia rendiciones y registra
 * cobros manuales (el cobro real en el momento del servicio llega con la sesión de
 * campo, PR-106b/PR-207).
 */
export default function CajaPage(): JSX.Element {
  const [accounts, setAccounts] = React.useState<CashAccount[]>([])
  const [closures, setClosures] = React.useState<CashClosure[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [expandedAccountId, setExpandedAccountId] = React.useState<string | null>(null)
  const [showPaymentForm, setShowPaymentForm] = React.useState(false)

  const fetchAll = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [a, c] = await Promise.all([getListCashAccounts(), getListCashClosures({ query: { status: 'DECLARED', limit: 20 } })])
      if (a.success) setAccounts(a.data)
      if (c.success) setClosures(c.data)
      if (!a.success || !c.success) setError('No se pudo cargar toda la información de caja.')
    } catch {
      setError('No se pudo cargar caja.')
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
          <h1 className="text-h1 font-semibold text-fg">Caja</h1>
          <p className="text-body text-fg-muted mt-1">Cajas por operario, rendiciones y cobros.</p>
        </div>
        <Button onClick={() => setShowPaymentForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Registrar cobro
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchAll() }} className="mt-2">Reintentar</Button>
        </div>
      )}

      {showPaymentForm && (
        <NewPaymentForm
          onCreated={() => {
            setShowPaymentForm(false)
            void fetchAll()
          }}
        />
      )}

      {closures.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-h3 font-semibold text-fg">Rendiciones pendientes de conciliar</h2>
          <div className="space-y-2">
            {closures.map((c) => (
              <ClosureReconcileCard
                key={c.id}
                closure={c}
                onReconciled={() => { void fetchAll() }}
              />
            ))}
          </div>
        </section>
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState icon={<Wallet className="h-8 w-8 text-fg-subtle" />} title="Sin cajas todavía" description="Se crean solas cuando un operario cobra por primera vez." />
      ) : (
        <section className="space-y-3">
          <h2 className="text-h3 font-semibold text-fg">Cajas</h2>
          <div className="space-y-2">
            {accounts.map((a) => (
              <AccountCard
                key={a.id}
                account={a}
                expanded={expandedAccountId === a.id}
                onToggle={() => setExpandedAccountId((cur) => (cur === a.id ? null : a.id))}
                onChanged={() => { void fetchAll() }}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function AccountCard({
  account,
  expanded,
  onToggle,
  onChanged,
}: {
  account: CashAccount
  expanded: boolean
  onToggle: () => void
  onChanged: () => void
}): JSX.Element {
  const [movements, setMovements] = React.useState<CashMovement[]>([])
  const [isLoadingMovements, setIsLoadingMovements] = React.useState(false)
  const [showDeclare, setShowDeclare] = React.useState(false)
  const [declaredCents, setDeclaredCents] = React.useState('')
  const [isDeclaring, setIsDeclaring] = React.useState(false)
  const [declareError, setDeclareError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!expanded) return
    setIsLoadingMovements(true)
    getListCashMovements({ params: { id: account.id } })
      .then((res) => {
        if (res.success) setMovements(res.data)
      })
      .catch(() => { /* lista vacía no bloquea la tarjeta */ })
      .finally(() => setIsLoadingMovements(false))
  }, [expanded, account.id])

  const declare = async (): Promise<void> => {
    const cents = Math.round(Number(declaredCents) * 100)
    if (!cents) {
      setDeclareError('Ingresá el monto declarado.')
      return
    }
    setIsDeclaring(true)
    setDeclareError(null)
    try {
      const res = await postDeclareCashClosure({ params: { id: account.id }, body: { declaredCents: cents } })
      if (res.success) {
        setShowDeclare(false)
        setDeclaredCents('')
        onChanged()
      } else {
        setDeclareError(res.error.message)
      }
    } catch {
      setDeclareError('No se pudo declarar la rendición.')
    } finally {
      setIsDeclaring(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="flex items-center justify-between">
        <button className="flex-1 text-left" onClick={onToggle}>
          <div className="flex items-center gap-2">
            <p className="text-body font-semibold text-fg">{account.ownerName}</p>
            <Badge variant="secondary">{account.type === 'TECHNICIAN' ? 'Operario' : 'Oficina'}</Badge>
            {account.openClosureId && <Badge variant="outline">Rendición abierta</Badge>}
          </div>
          <p className={`text-h3 font-semibold mt-1 ${account.balanceCents < 0 ? 'text-destructive' : 'text-fg'}`}>
            {centsToPesos(account.balanceCents)}
          </p>
        </button>
        <Button variant="outline" size="sm" onClick={() => setShowDeclare((v) => !v)}>
          <CheckCircle className="h-4 w-4" /> Declarar rendición
        </Button>
      </div>

      {showDeclare && (
        <div className="mt-3 flex items-end gap-2 border-t border-border pt-3">
          <div className="space-y-1">
            <Label htmlFor={`declared-${account.id}`}>Monto que rinde ($)</Label>
            <Input id={`declared-${account.id}`} type="number" value={declaredCents} onChange={(e) => setDeclaredCents(e.target.value)} className="w-40" />
          </div>
          <Button onClick={() => { void declare() }} disabled={isDeclaring}>{isDeclaring ? 'Declarando...' : 'Confirmar'}</Button>
          {declareError && <p className="text-caption text-destructive">{declareError}</p>}
        </div>
      )}

      {expanded && (
        <div className="mt-3 border-t border-border pt-3">
          {isLoadingMovements ? (
            <Skeleton className="h-12 w-full rounded" />
          ) : movements.length === 0 ? (
            <p className="text-caption text-fg-muted">Sin movimientos todavía.</p>
          ) : (
            <div className="space-y-1">
              {movements.map((m) => (
                <div key={m.id} className="flex items-center justify-between text-caption">
                  <span className="text-fg-muted">
                    {m.type} {m.description ? `— ${m.description}` : ''} · {new Date(m.createdAt).toLocaleString('es-AR')}
                  </span>
                  <span className={m.amountCents < 0 ? 'text-destructive' : 'text-fg'}>{centsToPesos(m.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ClosureReconcileCard({ closure, onReconciled }: { closure: CashClosure; onReconciled: () => void }): JSX.Element {
  const [receivedCents, setReceivedCents] = React.useState(
    closure.declaredCents !== null && closure.declaredCents !== undefined ? String(closure.declaredCents / 100) : '',
  )
  const [differenceReason, setDifferenceReason] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const reconcile = async (): Promise<void> => {
    const cents = Math.round(Number(receivedCents) * 100)
    setIsSaving(true)
    setError(null)
    try {
      const res = await postReconcileCashClosure({
        params: { id: closure.id },
        body: { receivedCents: cents, differenceReason: differenceReason || null },
      })
      if (res.success) {
        onReconciled()
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo conciliar.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <p className="text-caption text-fg-muted">Esperado</p>
          <p className="text-body font-medium text-fg">{centsToPesos(closure.expectedCents ?? 0)}</p>
        </div>
        <div>
          <p className="text-caption text-fg-muted">Declarado por el operario</p>
          <p className="text-body font-medium text-fg">{centsToPesos(closure.declaredCents ?? 0)}</p>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`received-${closure.id}`}>Recibido ($)</Label>
          <Input id={`received-${closure.id}`} type="number" value={receivedCents} onChange={(e) => setReceivedCents(e.target.value)} className="w-32" />
        </div>
        <div className="space-y-1 flex-1 min-w-[200px]">
          <Label htmlFor={`reason-${closure.id}`}>Motivo de la diferencia (si aplica)</Label>
          <Input id={`reason-${closure.id}`} value={differenceReason} onChange={(e) => setDifferenceReason(e.target.value)} placeholder="Faltó vuelto de un cliente" />
        </div>
        <Button onClick={() => { void reconcile() }} disabled={isSaving}>
          <ArrowRightLeft className="h-4 w-4" /> {isSaving ? 'Conciliando...' : 'Conciliar'}
        </Button>
      </div>
      {error && <p className="text-caption text-destructive mt-2">{error}</p>}
    </div>
  )
}

function NewPaymentForm({ onCreated }: { onCreated: () => void }): JSX.Element {
  const [customers, setCustomers] = React.useState<CustomerWithContacts[]>([])
  const [customerId, setCustomerId] = React.useState('')
  const [amount, setAmount] = React.useState('')
  const [method, setMethod] = React.useState('CASH')
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    getListCustomers({ query: { limit: 50 } }).then((res) => {
      if (res.success) setCustomers(res.data)
    }).catch(() => { /* combo vacío no bloquea el resto de la pantalla */ })
  }, [])

  const submit = async (): Promise<void> => {
    const cents = Math.round(Number(amount) * 100)
    if (!customerId || !cents) {
      setError('Elegí cliente y monto.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await postCreatePayment({
        body: { customerId, amountCents: cents, currency: 'ARS', method: method as 'CASH' | 'TRANSFER' | 'MERCADOPAGO' | 'CARD' | 'CHECK' | 'ACCOUNT' },
      })
      if (res.success) {
        onCreated()
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo registrar el cobro.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <h2 className="text-body font-semibold text-fg">Registrar cobro</h2>
      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1 sm:col-span-2">
          <Label>Cliente</Label>
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger><SelectValue placeholder="Elegir cliente" /></SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.tradeName ?? c.legalName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="pay-amount">Monto ($)</Label>
          <Input id="pay-amount" type="number" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Método</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {['CASH', 'TRANSFER', 'MERCADOPAGO', 'CARD', 'CHECK', 'ACCOUNT'].map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={() => { void submit() }} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Registrar cobro'}</Button>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}
