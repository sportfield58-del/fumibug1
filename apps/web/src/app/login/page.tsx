'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { Bug, Eye, EyeOff } from 'lucide-react'
import { Button, Input, Label } from '@fumibug/ui'
import { useAuth } from '@/components/auth-provider'

type LoginMode = 'admin' | 'operario'

export default function LoginPage(): JSX.Element {
  const [mode, setMode] = React.useState<LoginMode>('admin')
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [showPassword, setShowPassword] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const { login, isAuthenticated } = useAuth()
  const router = useRouter()

  React.useEffect(() => {
    if (isAuthenticated) {
      router.push('/admin')
    }
  }, [isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)

    try {
      await login(identifier, password, mode)
      router.push(mode === 'admin' ? '/admin' : '/campo')
    } catch {
      setError(
        mode === 'admin'
          ? 'Email o contraseña incorrectos'
          : 'Usuario o PIN incorrecto'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-bg p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-subtle">
            <Bug className="h-8 w-8 text-primary" />
          </div>
          <h1 className="mt-4 text-h1 font-bold text-fg">Fumibug</h1>
          <p className="mt-1 text-body text-fg-muted">Field Service Management</p>
        </div>

        {/* Mode tabs */}
        <div className="mb-6 flex rounded-lg bg-bg-sunken p-1">
          <button
            type="button"
            onClick={() => { setMode('admin'); setError(null) }}
            className={`flex-1 rounded-md py-2 text-body font-medium transition-colors ${
              mode === 'admin'
                ? 'bg-bg-elevated text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            Admin
          </button>
          <button
            type="button"
            onClick={() => { setMode('operario'); setError(null) }}
            className={`flex-1 rounded-md py-2 text-body font-medium transition-colors ${
              mode === 'operario'
                ? 'bg-bg-elevated text-fg shadow-sm'
                : 'text-fg-muted hover:text-fg'
            }`}
          >
            Operario
          </button>
        </div>

        {/* Form */}
        <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="identifier">
              {mode === 'admin' ? 'Email' : 'Usuario'}
            </Label>
            <Input
              id="identifier"
              type={mode === 'admin' ? 'email' : 'text'}
              placeholder={mode === 'admin' ? 'admin@fumibug.com' : 'usuario'}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">
              {mode === 'admin' ? 'Contraseña' : 'PIN'}
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'admin' ? '••••••••' : '000000'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={mode === 'admin' ? 'current-password' : 'one-time-code'}
                inputMode={mode === 'operario' ? 'numeric' : undefined}
                pattern={mode === 'operario' ? '[0-9]{6}' : undefined}
                maxLength={mode === 'operario' ? 6 : undefined}
                className={mode === 'operario' ? 'text-center text-h1 tracking-[0.5em]' : ''}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-subtle hover:text-fg"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-caption text-destructive">{error}</p>
          )}

          <Button
            type="submit"
            className="w-full"
            size="lg"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Entrando...' : 'Entrar'}
          </Button>
        </form>

        {mode === 'admin' && (
          <p className="mt-4 text-center text-caption text-fg-muted">
            <button type="button" className="text-primary hover:underline">
              ¿Olvidaste tu contraseña?
            </button>
          </p>
        )}
      </div>
    </div>
  )
}
