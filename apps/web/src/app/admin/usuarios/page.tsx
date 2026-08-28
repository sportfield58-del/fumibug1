'use client'

import * as React from 'react'
import { Users as UsersIcon, Plus, KeyRound, Power, LogOut } from 'lucide-react'
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
  postForceLogoutUser,
  getListRoles,
} from '@/../../lib/api/client'
import type { UserWithMembership, Role, LicenseType } from '@fumibug/contracts'

/** Mismo criterio que UsersService.FIELD_ROLE_KEYS en el backend — roles que necesitan ficha de operario. */
const FIELD_ROLE_KEYS = new Set(['technician', 'technical_director'])

/**
 * docs/spec/03-modulos.md §C.2. No existía pantalla de gestión de usuarios pese a que
 * el backend (PR-201) está completo hace rato — faltaba en el sidebar y como ruta.
 * Alta, activar/desactivar, resetear PIN (para operarios) y forzar cierre de sesión.
 */
export default function UsuariosPage(): JSX.Element {
  const [users, setUsers] = React.useState<UserWithMembership[]>([])
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
      if (u.success) setUsers(u.data)
      if (r.success) setRoles(r.data)
      if (!u.success || !r.success) setError('No se pudo cargar todo.')
    } catch {
      setError('No se pudieron cargar los usuarios.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void fetchAll()
  }, [fetchAll])

  const toggleActive = async (u: UserWithMembership): Promise<void> => {
    const res = u.isActive ? await postDeactivateUser({ params: { id: u.id } }) : await postActivateUser({ params: { id: u.id } })
    if (res.success) void fetchAll()
  }

  const resetPin = async (u: UserWithMembership): Promise<void> => {
    const res = await postResetUserPin({ params: { id: u.id } })
    if (res.success) setPinReveal({ username: u.username ?? u.email, pin: res.data.temporaryPin })
  }

  const forceLogout = async (u: UserWithMembership): Promise<void> => {
    await postForceLogoutUser({ params: { id: u.id } })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-h1 font-semibold text-fg">Usuarios</h1>
          <p className="text-body text-fg-muted mt-1">Altas, roles, PIN de operarios y sesiones.</p>
        </div>
        <Button onClick={() => setShowCreateForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nuevo usuario
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
        <NewUserForm
          roles={roles}
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
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <EmptyState icon={<UsersIcon className="h-8 w-8 text-fg-subtle" />} title="Sin usuarios" description="Dá de alta el primero." />
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between rounded-lg border border-border bg-bg-elevated p-4">
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-body font-semibold text-fg">{u.fullName ?? u.username ?? u.email}</p>
                  <Badge variant="secondary">{u.roleName}</Badge>
                  <Badge variant={u.isActive ? 'default' : 'destructive'}>{u.isActive ? 'Activo' : 'Inactivo'}</Badge>
                  {u.technicianProfile?.licenseExpiresAt && (
                    <span className="text-caption text-fg-muted">Libreta vence: {u.technicianProfile.licenseExpiresAt}</span>
                  )}
                </div>
                <p className="text-caption text-fg-muted mt-1">
                  {u.username ? `usuario: ${u.username}` : u.email}
                  {u.phone ? ` · ${u.phone}` : ''}
                </p>
              </div>
              <div className="flex gap-2">
                {FIELD_ROLE_KEYS.has(u.roleKey) && (
                  <Button variant="outline" size="sm" onClick={() => { void resetPin(u) }}>
                    <KeyRound className="h-4 w-4" /> Resetear PIN
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { void forceLogout(u) }}>
                  <LogOut className="h-4 w-4" /> Cerrar sesiones
                </Button>
                <Button variant={u.isActive ? 'destructive' : 'default'} size="sm" onClick={() => { void toggleActive(u) }}>
                  <Power className="h-4 w-4" /> {u.isActive ? 'Desactivar' : 'Activar'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function NewUserForm({ roles, onCreated }: { roles: Role[]; onCreated: (pin: string | null | undefined, username: string) => void }): JSX.Element {
  const [fullName, setFullName] = React.useState('')
  const [roleId, setRoleId] = React.useState('')
  const [email, setEmail] = React.useState('')
  const [username, setUsername] = React.useState('')
  const [phone, setPhone] = React.useState('')
  const [licenseNumber, setLicenseNumber] = React.useState('')
  const [licenseExpiresAt, setLicenseExpiresAt] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const selectedRole = roles.find((r) => r.id === roleId)
  const isFieldRole = selectedRole ? FIELD_ROLE_KEYS.has(selectedRole.key) : false

  const submit = async (): Promise<void> => {
    if (!fullName || !roleId) {
      setError('Nombre y rol son obligatorios.')
      return
    }
    if (isFieldRole && !username) {
      setError('Los operarios necesitan un usuario (no email).')
      return
    }
    if (!isFieldRole && !email) {
      setError('Este rol necesita un email.')
      return
    }
    setIsSaving(true)
    setError(null)
    try {
      const res = await postCreateUser({
        body: {
          fullName,
          roleId,
          ...(isFieldRole ? { username } : { email }),
          phone: phone || null,
          ...(isFieldRole
            ? {
                technicianProfile: {
                  licenseType: 'SANITARY_BOOK' as LicenseType,
                  licenseNumber: licenseNumber || null,
                  licenseExpiresAt: licenseExpiresAt || null,
                },
              }
            : {}),
        },
      })
      if (res.success) {
        onCreated(res.data.temporaryPin, username || res.data.user.email)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudo crear el usuario.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
      <h2 className="text-body font-semibold text-fg">Nuevo usuario</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1">
          <Label htmlFor="u-name">Nombre completo</Label>
          <Input id="u-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
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
          <Label htmlFor="u-phone">Teléfono</Label>
          <Input id="u-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>

        {isFieldRole ? (
          <>
            <div className="space-y-1">
              <Label htmlFor="u-username">Usuario (sin email)</Label>
              <Input id="u-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="diego.sosa" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="u-license">N° de libreta sanitaria</Label>
              <Input id="u-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="u-license-exp">Libreta vence</Label>
              <Input id="u-license-exp" type="date" value={licenseExpiresAt} onChange={(e) => setLicenseExpiresAt(e.target.value)} />
            </div>
          </>
        ) : (
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="u-email">Email</Label>
            <Input id="u-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        )}
      </div>
      <Button onClick={() => { void submit() }} disabled={isSaving}>{isSaving ? 'Guardando...' : 'Crear usuario'}</Button>
      {error && <p className="text-caption text-destructive">{error}</p>}
    </div>
  )
}
