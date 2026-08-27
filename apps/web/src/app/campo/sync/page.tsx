'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Clock, CloudUpload } from 'lucide-react'
import { Button } from '@fumibug/ui'
import { db, type OutboxEntry } from '@/lib/offline/db'

export default function SyncPage(): JSX.Element {
  const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0)
  const [entries, setEntries] = React.useState<OutboxEntry[]>([])
  const [isWorking, setIsWorking] = React.useState(false)

  React.useEffect(() => {
    const load = async (): Promise<void> => {
      const all = await db.outbox.toArray()
      setEntries(all.sort((a, b) => (a.occurredAt < b.occurredAt ? 1 : -1)))
      setIsWorking(false)
    }
    void load()
    const interval = setInterval(() => { void load() }, 3000)
    return () => clearInterval(interval)
  }, [forceUpdate])

  const retryAll = React.useCallback(async (): Promise<void> => {
    setIsWorking(true)
    // Reset FAILED entries back to PENDING
    const failed = await db.outbox.where('status').equals('FAILED').toArray()
    const reset: OutboxEntry[] = failed.map((e) => {
      const { lastError: _lastError, ...rest } = e
      return { ...rest, status: 'PENDING' as const, attempts: 0 }
    })
    await db.outbox.bulkPut(reset)
    forceUpdate()
  }, [])

  const failed = entries.filter((e) => e.status === 'FAILED')
  const pending = entries.filter((e) => e.status === 'PENDING')
  const done = entries.filter((e) => e.status === 'DONE')
  const inFlight = entries.filter((e) => e.status === 'IN_FLIGHT')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/campo">
              <ArrowLeft className="h-4 w-4" /> Volver
            </Link>
          </Button>
          <h1 className="text-h1 font-semibold text-fg">Sincronización</h1>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Pendientes" value={pending.length + inFlight.length} color="text-warning" />
        <SummaryCard label="Sincronizando" value={inFlight.length} color="text-primary" />
        <SummaryCard label="Completados" value={done.length} color="text-success" />
        <SummaryCard label="Errores" value={failed.length} color={failed.length > 0 ? 'text-destructive' : 'text-success'} />
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        {failed.length > 0 && (
          <Button onClick={() => { void retryAll() }} disabled={isWorking} className="w-full touch-manipulation" size="touch">
            <RefreshCw className="h-5 w-5" /> Reintentar pendientes
          </Button>
        )}
      </div>

      {/* Failed entries */}
      {failed.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Necesitan atención</h2>
          <div className="space-y-3">
            {failed.map((e) => (
              <div key={e.id} className="rounded-lg border border-destructive/30 bg-state-problem/5 p-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
                  <div>
                    <p className="text-body font-medium text-fg">{e.type}</p>
                    <p className="text-caption text-fg-muted">
                      {new Date(e.occurredAt).toLocaleString('es-AR')}
                      {e.lastError && ` · ${e.lastError}`}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending */}
      {pending.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">En cola</h2>
          <div className="space-y-3">
            {pending.map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-bg-elevated p-4">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-warning shrink-0" />
                  <div>
                    <p className="text-body font-medium text-fg">{e.type}</p>
                    <p className="text-caption text-fg-muted">
                      {new Date(e.occurredAt).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Done */}
      {done.length > 0 && (
        <div>
          <h2 className="text-h3 font-semibold text-fg mb-3">Sincronizados</h2>
          <div className="space-y-3">
            {done.slice(0, 10).map((e) => (
              <div key={e.id} className="rounded-lg border border-border bg-bg-elevated p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                  <div>
                    <p className="text-body font-medium text-fg">{e.type}</p>
                    <p className="text-caption text-fg-muted">
                      {new Date(e.occurredAt).toLocaleString('es-AR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CloudUpload className="h-12 w-12 text-fg-subtle mb-4" />
          <p className="text-h3 font-medium text-fg">Nada por sincronizar</p>
          <p className="text-body text-fg-muted mt-1">
            Todas las operaciones están al día.
          </p>
        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}): JSX.Element {
  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4">
      <p className="text-caption text-fg-muted">{label}</p>
      <p className={`text-h2 font-bold mt-1 ${color}`}>{value}</p>
    </div>
  )
}
