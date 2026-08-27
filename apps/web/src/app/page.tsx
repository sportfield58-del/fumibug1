'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth-provider'
import { Skeleton } from '@fumibug/ui'
import * as React from 'react'

export default function RootPage(): JSX.Element {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (!isLoading) {
      router.push(isAuthenticated ? '/admin' : '/login')
    }
  }, [isLoading, isAuthenticated, router])

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  )
}
