'use client'

import * as React from 'react'
import { FileText, Plus, PenLine, Ban, RefreshCw } from 'lucide-react'
import {
  Button,
  Badge,
  EmptyState,
  Skeleton,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@fumibug/ui'
import {
  getListCertificates,
  postCreateCertificate,
  postSignCertificate,
  postVoidCertificate,
  getListServices,
} from '@/../../lib/api/client'
import type { Certificate, CertificateStatus, Service } from '@fumibug/contracts'

const STATUS_LABEL: Record<CertificateStatus, string> = {
  DRAFT: 'Borrador',
  ISSUED: 'Emitido',
  SIGNED: 'Firmado',
  VOIDED: 'Anulado',
}

const STATUS_BADGE: Record<CertificateStatus, 'outline' | 'default' | 'secondary' | 'destructive'> = {
  DRAFT: 'outline',
  ISSUED: 'secondary',
  SIGNED: 'default',
  VOIDED: 'destructive',
}

export default function CertificadosPage(): JSX.Element {
  const [certificates, setCertificates] = React.useState<Certificate[]>([])
  const [services, setServices] = React.useState<Service[]>([])
  const [statusFilter, setStatusFilter] = React.useState<CertificateStatus | 'ALL'>('ALL')
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [processingId, setProcessingId] = React.useState<string | null>(null)
  const [showCreate, setShowCreate] = React.useState(false)
  const [selectedService, setSelectedService] = React.useState('')
  const [creating, setCreating] = React.useState(false)
  const [actionError, setActionError] = React.useState<string | null>(null)

  const fetchCertificates = React.useCallback(async (status: CertificateStatus | 'ALL') => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getListCertificates({
        query: { limit: 100, status: status === 'ALL' ? undefined : status },
      })
      if (res.success) {
        setCertificates(res.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar los certificados')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchCertificates(statusFilter)
  }, [fetchCertificates, statusFilter])

  const openCreate = React.useCallback(async () => {
    setShowCreate(true)
    setActionError(null)
    try {
      const res = await getListServices({ query: { status: 'COMPLETED', limit: 100 } })
      if (res.success) {
        setServices(res.data)
      }
    } catch {
      setServices([])
    }
  }, [])

  const handleCreate = async (): Promise<void> => {
    if (!selectedService) return
    setCreating(true)
    setActionError(null)
    try {
      const res = await postCreateCertificate({ body: { serviceId: selectedService } })
      if (res.success) {
        setShowCreate(false)
        setSelectedService('')
        await fetchCertificates(statusFilter)
      } else {
        setActionError(res.error.message)
      }
    } catch {
      setActionError('No se pudo emitir el certificado')
    } finally {
      setCreating(false)
    }
  }

  const handleSign = async (id: string): Promise<void> => {
    setProcessingId(id)
    setActionError(null)
    try {
      const res = await postSignCertificate({ params: { id } })
      if (res.success) {
        await fetchCertificates(statusFilter)
      } else {
        setActionError(res.error.message)
      }
    } catch {
      setActionError('No se pudo firmar el certificado')
    } finally {
      setProcessingId(null)
    }
  }

  const handleVoid = async (id: string, current: Certificate): Promise<void> => {
    const reason = window.prompt(`Motivo de anulación para ${current.formattedNumber}:`)
    if (reason === null) return
    setProcessingId(id)
    setActionError(null)
    try {
      const res = await postVoidCertificate({ params: { id }, body: { reason } })
      if (res.success) {
        await fetchCertificates(statusFilter)
      } else {
        setActionError(res.error.message)
      }
    } catch {
      setActionError('No se pudo anular el certificado')
    } finally {
      setProcessingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-h1 font-semibold text-fg">Certificados</h1>
          <p className="text-caption text-fg-muted mt-1">
            Emisión, firma y anulación (R33-R38)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as CertificateStatus | 'ALL')}
          >
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="DRAFT">Borrador</SelectItem>
              <SelectItem value="ISSUED">Emitido</SelectItem>
              <SelectItem value="SIGNED">Firmado</SelectItem>
              <SelectItem value="VOIDED">Anulado</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { void openCreate() }}>
            <Plus className="h-4 w-4" /> Emitir
          </Button>
        </div>
      </div>

      {showCreate && (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="cert-service">Servicio completado</Label>
            <Select value={selectedService} onValueChange={setSelectedService}>
              <SelectTrigger id="cert-service">
                <SelectValue placeholder="Elegir servicio" />
              </SelectTrigger>
              <SelectContent>
                {services.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.code} · {s.scheduledDate ?? 'sin fecha'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {actionError && <p className="text-caption text-destructive">{actionError}</p>}
          <div className="flex gap-2">
            <Button onClick={() => { void handleCreate() }} disabled={!selectedService || creating}>
              {creating ? 'Emitiendo…' : 'Emitir certificado'}
            </Button>
            <Button
              variant="outline"
              onClick={() => { setShowCreate(false); setSelectedService(''); setActionError(null) }}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full rounded-lg" />
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { void fetchCertificates(statusFilter) }}
            className="mt-2"
          >
            <RefreshCw className="h-4 w-4" /> Reintentar
          </Button>
        </div>
      )}

      {!isLoading && !error && certificates.length === 0 && (
        <EmptyState
          icon={<FileText className="h-8 w-8 text-fg-subtle" />}
          title="Sin certificados"
          description={
            statusFilter === 'ALL'
              ? 'Todavía no se emitieron certificados.'
              : 'No hay certificados en este estado.'
          }
        />
      )}

      {!isLoading && !error && certificates.length > 0 && (
        <div className="space-y-3">
          {certificates.map((cert) => {
            const isProcessing = processingId === cert.id
            const customerName = cert.snapshot.customer.legalName
            return (
              <div
                key={cert.id}
                className="rounded-lg border border-border bg-bg-elevated p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-body font-semibold text-fg">{cert.formattedNumber}</h3>
                      <Badge variant={STATUS_BADGE[cert.status]}>
                        {STATUS_LABEL[cert.status]}
                      </Badge>
                    </div>
                    <p className="text-caption text-fg-muted mt-1">
                      {customerName}
                    </p>
                    <p className="text-caption text-fg-muted">
                      Servicio: {cert.snapshot.service.serviceCode} · {cert.snapshot.service.serviceTypeName}
                    </p>
                    <p className="text-caption text-fg-subtle">
                      {cert.issuedAt ? `Emitido ${new Date(cert.issuedAt).toLocaleDateString()}` : 'Sin emitir'}
                      {cert.signedAt ? ` · Firmado ${new Date(cert.signedAt).toLocaleDateString()}` : ''}
                      {cert.voidedAt ? ` · Anulado ${new Date(cert.voidedAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>

                  <div className="flex gap-2 shrink-0">
                    {cert.status === 'ISSUED' && (
                      <Button
                        size="sm"
                        onClick={() => { void handleSign(cert.id) }}
                        disabled={isProcessing}
                      >
                        <PenLine className="h-4 w-4" /> Firmar
                      </Button>
                    )}
                    {(cert.status === 'ISSUED' || cert.status === 'SIGNED') && (
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => { void handleVoid(cert.id, cert) }}
                        disabled={isProcessing}
                      >
                        <Ban className="h-4 w-4" /> Anular
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
