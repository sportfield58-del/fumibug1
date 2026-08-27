'use client'

import * as React from 'react'
import { configureApiClient, getAuthMe } from '../../lib/api/client'
import type { PermissionKey } from '@fumibug/contracts'

// Se configura una sola vez, al cargar el módulo (no en un efecto: si un componente
// llama a la API antes del primer render de <AuthProvider>, igual necesita baseUrl/token
// bien seteados). NEXT_PUBLIC_API_URL apunta a la API deployada (Railway); sin la env var
// cae en '/v1' relativo, que en Vercel no resuelve a nada.
configureApiClient({
  baseUrl: process.env.NEXT_PUBLIC_API_URL ?? '/v1',
  getAccessToken: () => (typeof window === 'undefined' ? null : localStorage.getItem('access_token')),
})

/**
 * ADR 0003: Supabase Auth es el identity provider — el login pega directo contra
 * Supabase (no contra nuestro backend, que solo verifica el JWT resultante por JWKS).
 * Antes llamaba a un placeholder `/v1/auth/login` que nunca existió del lado del backend
 * (a propósito: login/refresh viven en Supabase, ver apps/api/src/modules/auth/
 * auth.controller.ts).
 */
async function signInWithSupabase(
  identifier: string,
  password: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl || !anonKey) {
    throw new Error('Falta configurar NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: anonKey, 'Content-Type': 'application/json' },
    // `identifier` es el email (admin). El login de operario por username+PIN
    // (§K.1: "{username}@{tenant-slug}.fumibug.internal") llega con el flujo de PIN.
    body: JSON.stringify({ email: identifier, password }),
  })

  if (!res.ok) {
    throw new Error('Credenciales incorrectas')
  }

  const data = (await res.json()) as { access_token: string; refresh_token: string }
  return { accessToken: data.access_token, refreshToken: data.refresh_token }
}

interface AuthUser {
  id: string
  email: string
  name: string
}

interface AuthContextValue {
  user: AuthUser | null
  permissions: PermissionKey[]
  roleKey: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (identifier: string, password: string) => Promise<void>
  logout: () => void
  can: (permission: PermissionKey) => boolean
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  const [user, setUser] = React.useState<AuthUser | null>(null)
  const [permissions, setPermissions] = React.useState<PermissionKey[]>([])
  const [roleKey, setRoleKey] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    const token = localStorage.getItem('access_token')
    if (!token) {
      setIsLoading(false)
      return
    }

    getAuthMe()
      .then((res) => {
        if (res.success) {
          const { user, permissions, roleKey } = res.data
          setUser({
            id: user.id,
            email: user.email,
            name: user.fullName ?? user.username ?? user.email,
          })
          setPermissions(permissions)
          setRoleKey(roleKey)
        } else {
          localStorage.removeItem('access_token')
        }
      })
      .catch(() => {
        localStorage.removeItem('access_token')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = React.useCallback(async (identifier: string, password: string): Promise<void> => {
    const { accessToken, refreshToken } = await signInWithSupabase(identifier, password)
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('refresh_token', refreshToken)

    const me = await getAuthMe()
    if (me.success) {
      const { user, permissions, roleKey } = me.data
      setUser({
        id: user.id,
        email: user.email,
        name: user.fullName ?? user.username ?? user.email,
      })
      setPermissions(permissions)
      setRoleKey(roleKey)
    }
  }, [])

  const logout = React.useCallback((): void => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    setUser(null)
    setPermissions([])
    setRoleKey(null)
    window.location.href = '/login'
  }, [])

  const can = React.useCallback(
    (permission: PermissionKey): boolean => permissions.includes(permission),
    [permissions]
  )

  const value: AuthContextValue = {
    user,
    permissions,
    roleKey,
    isLoading,
    isAuthenticated: user !== null,
    login,
    logout,
    can,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
