'use client'

import * as React from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from './button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  onReset?: () => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override componentDidCatch(_error: Error, _errorInfo: React.ErrorInfo): void {
    // Error logging handled by error reporting service (Sentry, etc.)
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  override render(): React.ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-bg-elevated p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="mt-4 text-h3 font-semibold text-fg">
            Algo salió mal
          </h3>
          <p className="mt-2 max-w-sm text-body text-fg-muted">
            {this.state.error?.message ?? 'Error inesperado. Intentá de nuevo.'}
          </p>
          <Button onClick={this.handleReset} variant="outline" className="mt-6">
            Reintentar
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}

export { ErrorBoundary }
export type { ErrorBoundaryProps }
