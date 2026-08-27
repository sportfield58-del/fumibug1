'use client'

import * as React from 'react'
import { getAuthMe } from '../../lib/api/client'
import type { PermissionKey } from '@fumibug/contracts'

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
    // TODO: replace with real POST /auth/login once endpoint exists in contracts
    // For now, simulate login with MSW mock
    const response = await fetch('/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    })

    if (!response.ok) {
      throw new Error('Credenciales incorrectas')
    }

    const data = await response.json() as { data: { accessToken: string } }
    localStorage.setItem('access_token', data.data.accessToken)

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
