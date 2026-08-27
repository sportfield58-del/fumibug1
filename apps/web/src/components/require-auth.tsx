'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './auth-provider'
import { Skeleton } from '@fumibug/ui'

interface RequireAuthProps {
  children: React.ReactNode
  requiredPermission?: string
  fallback?: React.ReactNode
}

function RequireAuth({
  children,
  requiredPermission,
  fallback,
}: RequireAuthProps): JSX.Element {
  const { isAuthenticated, isLoading, can } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login')
    }
  }, [isLoading, isAuthenticated, router])

  if (isLoading) {
    if (fallback) {
      return <>{fallback}</>
    }
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <></>
  }

  if (requiredPermission && !can(requiredPermission as never)) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-h1 font-semibold text-fg">Sin permiso</h1>
          <p className="mt-2 text-body text-fg-muted">
            No tenés acceso a esta sección.
          </p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

export { RequireAuth }
