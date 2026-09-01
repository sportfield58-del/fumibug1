'use client'

import * as React from 'react'
import { BarChart3, RefreshCw } from 'lucide-react'
import {
  Button,
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
import { getGetReport } from '@/../../lib/api/client'
import { REPORT_TYPE, type ReportRow, type ReportType } from '@fumibug/contracts'

const REPORT_LABEL: Record<ReportType, string> = {
  services_by_status: 'Servicios por estado',
  productivity_by_technician: 'Productividad por técnico',
  revenue_by_period: 'Facturación por período',
  collected_by_method: 'Cobrado por método',
  supply_consumption: 'Consumo de insumos',
  stock_current: 'Stock actual',
  settlements: 'Liquidaciones',
  certificates_issued: 'Certificados emitidos',
}

export default function ReportesPage(): JSX.Element {
  const [type, setType] = React.useState<ReportType>('services_by_status')
  const [from, setFrom] = React.useState('')
  const [to, setTo] = React.useState('')
  const [rows, setRows] = React.useState<ReportRow[] | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const run = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getGetReport({
        query: { type, ...(from ? { from } : {}), ...(to ? { to } : {}) },
      })
      if (res.success) {
        setRows(res.data.rows)
      } else {
        setRows(null)
        setError(res.error.message)
      }
    } catch {
      setRows(null)
      setError('No se pudo generar el reporte')
    } finally {
      setIsLoading(false)
    }
  }, [type, from, to])

  const columns = React.useMemo(() => {
    if (!rows || rows.length === 0) return []
    const cols = new Set<string>()
    for (const r of rows) {
      for (const key of Object.keys(r)) cols.add(key)
    }
    return [...cols]
  }, [rows])

  const formatCell = (value: unknown): string => {
    switch (typeof value) {
      case 'string':
      case 'number':
      case 'boolean':
      case 'bigint':
        return String(value)
      default:
        return ''
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-h1 font-semibold text-fg">Reportes</h1>
        <p className="text-caption text-fg-muted mt-1">
          Los 8 reportes operativos y financieros del roadmap (ADR 0010)
        </p>
      </div>

      <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="report-type">Reporte</Label>
            <Select value={type} onValueChange={(v) => setType(v as ReportType)}>
              <SelectTrigger id="report-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REPORT_TYPE.map((t) => (
                  <SelectItem key={t} value={t}>
                    {REPORT_LABEL[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-from">Desde</Label>
            <Input
              id="report-from"
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="report-to">Hasta</Label>
            <Input
              id="report-to"
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={() => { void run() }} disabled={isLoading}>
          {isLoading ? 'Generando…' : 'Generar reporte'}
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void run() }}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
      )}

      {!isLoading && !error && rows !== null && rows.length === 0 && (
        <EmptyState
          icon={<BarChart3 className="h-8 w-8 text-fg-subtle" />}
          title="Sin datos"
          description="No hay resultados para el reporte con los filtros elegidos."
        />
      )}

      {!isLoading && !error && rows !== null && rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full text-left text-body">
            <thead className="bg-bg-subtle">
              <tr>
                {columns.map((c) => (
                  <th key={c} className="px-4 py-2 text-caption font-medium text-fg-muted">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, idx) => (
                <tr key={idx} className="bg-bg-elevated">
                  {columns.map((c) => (
                    <td key={c} className="px-4 py-2 text-fg">
                      {formatCell((row as Record<string, unknown>)[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
