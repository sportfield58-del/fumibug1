'use client'

import * as React from 'react'
import { HardHat, Plus, KeyRound, Power, Phone, ScrollText, ShieldCheck, User as UserIcon } from 'lucide-react'
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
  getListUsers,
  postCreateUser,
  postActivateUser,
  postDeactivateUser,
  postResetUserPin,
  getListRoles,
} from '@/../../lib/api/client'
import type { UserWithMembership, Role, LicenseType } from '@fumibug/contracts'

/** Mismo criterio que UsersService.FIELD_ROLE_KEYS en el backend — roles de campo. */
const FIELD_ROLE_KEYS = new Set(['technician', 'technical_director'])

const LICENSE_TYPE_LABEL: Record<LicenseType, string> = {
  SANITARY_BOOK: 'Libreta sanitaria',
  TECHNICAL_DIRECTOR: 'Matrícula DT',
}

/**
 * docs/spec/03-modulos.md §C.2 — operarios de campo (técnico / director técnico).
 * Apartado dedicado: solo roles que usan la app de campo, con su ficha técnica
 * (libreta/matrícula, vencimiento) y alta con rol + reporte del PIN generado.
 */
export default function OperariosPage(): JSX.Element {
  const [operarios, setOperarios] = React.useState<UserWithMembership[]>([])
  const [roles, setRoles] = React.useState<Role[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = React.useState(false)
  const [pinReveal, setPinReveal] = React.useState<{ username: string; pin: string } | null>(null)

  const fetchAll = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [u, r] = await Promise.all([getListUsers({ query: { limit: 100 } }), getListRoles()])
      if (!u.success || !r.success) {
        setError('No se pudo cargar todo.')
        return
      }
      setOperarios(u.data.filter((x) => FIELD_ROLE_KEYS.has(x.roleKey)))
      setRoles(r.data)
    } catch {
      setError('No se pudieron cargar los operarios.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const toggleActive = async (o: UserWithMembership): Promise<void> => {
    const res = o.isActive ? await postDeactivateUser({ params: { id: o.id } }) : await postActivateUser({ params: { id: o.id } })
    if (res.success) void fetchAll()
  }

  const resetPin = async (o: UserWithMembership): Promise<void> => {
    const res = await postResetUserPin({ params: { id: o.id } })
    if (res.success) setPinReveal({ username: o.username ?? o.email, pin: res.data.temporaryPin })
  }

  const fieldRoles = roles.filter((r) => FIELD_ROLE_KEYS.has(r.key))

  const userLabel = (o: UserWithMembership): string => o.fullName ?? o.username ?? o.email

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-semibold text-fg">Operarios</h1>
          <p className="text-body text-fg-muted mt-1">Técnicos y directores técnicos: fichas, libretas y PIN.</p>
        </div>
        <Button onClick={() => setShowCreateForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Cargar operario
        </Button>
      </div>

      {pinReveal && (
        <div className="rounded-lg border border-primary/30 bg-primary-subtle p-4 flex items-center justify-between">
          <p className="text-body text-fg">
            PIN nuevo de <strong>{pinReveal.username}</strong>: <span className="font-mono text-h3">{pinReveal.pin}</span>{' '}
            <span className="text-caption text-fg-muted">— se muestra una sola vez, guardalo ahora.</span>
          </p>
          <Button variant="ghost" size="sm" onClick={() => setPinReveal(null)}>Cerrar</Button>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchAll() }} className="mt-2">Reintentar</Button>
        </div>
      )}

      {showCreateForm && (
        <NewOperarioForm
          roles={fieldRoles}
          onCreated={(pin, username) => {
            setShowCreateForm(false)
            if (pin) setPinReveal({ username, pin })
            void fetchAll()
          }}
        />
      )}

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : operarios.length === 0 ? (
        <EmptyState
          icon={<HardHat className="h-8 w-8 text-fg-subtle" />}
          title="Sin operarios"
          description="Cargá el primer operario de campo para poder asignarlo a rutas y servicios."
        />
      ) : (
        <div className="space-y-2">
          {operarios.map((o) => (
            <div key={o.id} className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-body font-semibold text-fg">{userLabel(o)}</p>
                  <Badge variant={o.roleKey === 'technical_director' ? 'default' : 'secondary'}>{o.roleName}</Badge>
                  <Badge variant={o.isActive ? 'default' : 'destructive'}>{o.isActive ? 'Activo' : 'Inactivo'}</Badge>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-fg-muted">
                  <span>usuario: {o.username ?? o.email}</span>
                  {o.phone && (
                    <span className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{o.phone}</span>
                  )}
                  {o.technicianProfile && (
                    <>
                      <span className="inline-flex items-center gap-1">
                        <ScrollText className="h-3 w-3" />
                        {LICENSE_TYPE_LABEL[o.technicianProfile.licenseType]}
                        {o.technicianProfile.licenseNumber ? ` · ${o.technicianProfile.licenseNumber}` : ''}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {o.technicianProfile.licenseExpiresAt
                          ? `Vence: ${o.technicianProfile.licenseExpiresAt}`
                          : 'Sin vencimiento'}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { void resetPin(o) }}>
                  <KeyRound className="h-4 w-4" /> Resetear PIN
                </Button>
                <Button variant={o.isActive ? 'destructive' : 'default'} size="sm" onClick={() => { void toggleActive(o) }}>
                  <Power className="h-4 w-4" /> {o.isActive ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewOperarioForm({ roles, onCreated }: { roles: Role[]; onCreated: (pin: string | null | undefined, username: string) => void }): JSX.Element {
  const [fullName, setFullName] = React.useState('')
  const [roleId, setRoleId] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [licenseNumber, setLicenseNumber] = React.useState('')
  const [licenseType, setLicenseType] = React.useState<LicenseType>('SANITARY_BOOK')
  const [licenseExpiresAt, setLicenseExpiresAt] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const submit = async (): Promise<void> => {
    if (!fullName || !roleId) {
      setError('Nombre y rol son obligatorios.')
      return
    }
    if (!username) {
      setError('El operario necesita un usuario (no email).')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await postCreateUser({
        body: {
          fullName,
          roleId,
          username,
          phone: phone || null,
          technicianProfile: {
            licenseType,
            licenseNumber: licenseNumber || null,
            licenseExpiresAt: licenseExpiresAt || null,
          },
        },
      })
      if (res.success) {
        onCreated(res.data.temporaryPin, username)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo crear el operario.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserIcon className="h-4 w-4 text-fg-subtle" />
        <h2 className="text-body font-semibold text-fg">Cargar operario</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="op-name">Nombre completo</Label>
          <Input id="op-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Rol</Label>
          <Select value={roleId} onValueChange={setRoleId}>
            <SelectTrigger><SelectValue placeholder="Elegir rol" /></SelectTrigger>
            <SelectContent>
              {roles.map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="op-username">Usuario (sin email)</Label>
          <Input id="op-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="diego.sosa" />
        </div>

        <div className="space-y-1">
          <Label htmlFor="op-phone">Teléfono</Label>
          <Input id="op-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>Ficha técnica</Label>
          <Select value={licenseType} onValueChange={(v) => setLicenseType(v as LicenseType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {(Object.keys(LICENSE_TYPE_LABEL) as LicenseType[]).map((lt) => (
                <SelectItem key={lt} value={lt}>{LICENSE_TYPE_LABEL[lt]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor="op-license">N°</Label>
          <Input id="op-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} placeholder="LS-0000" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="op-license-exp">Vence</Label>
          <Input id="op-license-exp" type="date" value={licenseExpiresAt} onChange={(e) => setLicenseExpiresAt(e.target.value)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Button onClick={() => { void submit() }} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Cargar operario'}</Button>
        {error && <p className="text-caption text-destructive">{error}</p>}
      </div>
    </div>
  )
}