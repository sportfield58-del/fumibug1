'use client'

import * as React from 'react'
import { AuthProvider } from './auth-provider'

export function Providers({ children }: { children: React.ReactNode }): JSX.Element {
  return <AuthProvider>{children}</AuthProvider>
}
