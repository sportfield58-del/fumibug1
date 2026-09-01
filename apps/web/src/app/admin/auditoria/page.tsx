'use client'

import * as React from 'react'
import { ScrollText, RefreshCw, Frown } from 'lucide-react'
import { Button, Badge, EmptyState, Skeleton, Input, Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@fumibug/ui'
import { getListAuditLogs } from '@/../../lib/api/client'
import type { AuditLog } from '@fumibug/contracts'

type Severity = 'INFO' | 'WARNING' | 'CRITICAL'

const SEVERITY_LABEL: Record<Severity, string> = {
  INFO: 'Info',
  WARNING: 'Advertencia',
  CRITICAL: 'Crítico',
}

function severityClass(s: Severity): string {
  if (s === 'CRITICAL') return 'text-destructive'
  if (s === 'WARNING') return 'text-warning'
  return 'text-fg-muted'
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export default function AuditoriaPage(): JSX.Element {
  const [logs, setLogs] = React.useState<AuditLog[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [isLoadingMore, setIsLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [entityType, setEntityType] = React.useState('')
  const [severity, setSeverity] = React.useState<'' | Severity>('')
  const [hasMore, setHasMore] = React.useState(true)

  const buildQuery = React.useCallback(
    (cursor?: string) => ({
      limit: 20,
      ...(entityType.trim() !== '' ? { entityType: entityType.trim() } : {}),
      ...(severity !== '' ? { severity } : {}),
      ...(cursor !== undefined ? { cursor } : {}),
    }),
    [entityType, severity],
  )

  const fetchFirst = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    setHasMore(true)
    try {
      const res = await getListAuditLogs({ query: buildQuery() })
      if (res.success) {
        setLogs(res.data)
        setHasMore(res.data.length === 20)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar los registros de auditoría.')
    } finally {
      setIsLoading(false)
    }
  }, [buildQuery])

  React.useEffect(() => {
    void fetchFirst()
  }, [fetchFirst])

  const loadMore = async (): Promise<void> => {
    const last = logs[logs.length - 1]
    if (!last) return
    setIsLoadingMore(true)
    setError(null)
    try {
      const res = await getListAuditLogs({ query: buildQuery(last.id) })
      if (res.success) {
        setLogs((prev) => [...prev, ...res.data])
        setHasMore(res.data.length === 20)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar más registros.')
    } finally {
      setIsLoadingMore(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-fg">Auditoría</h1>
        <Button variant="outline" size="sm" onClick={() => { void fetchFirst() }}>
          <RefreshCw className="h-4 w-4" /> Refrescar
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="w-56">
          <Input
            placeholder="Filtrar por entidad (ej: service)"
            value={entityType}
            onChange={(e) => setEntityType(e.target.value)}
          />
        </div>
        <div className="w-44">
          <Select value={severity} onValueChange={(v) => setSeverity(v as '' | Severity)}>
            <SelectTrigger><SelectValue placeholder="Severidad" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">Todas</SelectItem>
              <SelectItem value="INFO">Info</SelectItem>
              <SelectItem value="WARNING">Advertencia</SelectItem>
              <SelectItem value="CRITICAL">Crítico</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void fetchFirst() }}>
          Aplicar filtros
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchFirst() }} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && logs.length === 0 && (
        <EmptyState
          icon={<Frown className="h-8 w-8 text-fg-subtle" />}
          title="Sin registros"
          description="No hay movimientos de auditoría para estos filtros."
        />
      )}

      {!isLoading && !error && logs.length > 0 && (
        <div className="space-y-3">
          {logs.map((log) => (
            <div key={log.id} className="rounded-lg border border-border bg-bg-elevated p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <ScrollText className="h-4 w-4 text-fg-subtle shrink-0" />
                    <span className="text-body font-semibold text-fg">{log.action}</span>
                    <Badge variant="outline" className={severityClass(log.severity)}>
                      {SEVERITY_LABEL[log.severity]}
                    </Badge>
                  </div>
                  <p className="text-caption text-fg-muted mt-1">
                    {log.entityType}{log.entityId ? ` · ${log.entityId}` : ''}
                    {log.actorRole ? ` · ${log.actorRole}` : ''}
                    {log.actorUserId ? ` · ${log.actorUserId}` : ''}
                  </p>
                  <p className="text-caption text-fg-muted">{formatDate(log.createdAt)} · #{log.id}</p>
                  {(log.before !== undefined || log.after !== undefined || log.diff !== undefined) && (
                    <div className="mt-2 rounded-md bg-bg-subtle p-2 font-mono text-caption text-fg-muted break-words">
                      {log.before !== undefined ? `antes: ${JSON.stringify(log.before)}\n` : ''}
                      {log.after !== undefined ? `después: ${JSON.stringify(log.after)}\n` : ''}
                      {log.diff !== undefined && log.diff !== null ? `diff: ${JSON.stringify(log.diff)}` : ''}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && hasMore && (
        <Button variant="outline" className="w-full" disabled={isLoadingMore} onClick={() => { void loadMore() }}>
          {isLoadingMore ? 'Cargando...' : 'Cargar más'}
        </Button>
      )}
    </div>
  )
}
