'use client'

import * as React from 'react'
import { Menu, Bell } from 'lucide-react'
import { cn, Button } from '@fumibug/ui'

interface TopbarProps {
  title?: string
  breadcrumbs?: Array<{ label: string; href?: string }>
  onMenuClick?: () => void
  showMenuButton?: boolean
  className?: string
  children?: React.ReactNode
}

function Topbar({
  title,
  breadcrumbs,
  onMenuClick,
  showMenuButton = false,
  className,
  children,
}: TopbarProps): JSX.Element {
  return (
    <header
      className={cn(
        'flex h-14 items-center gap-4 border-b border-border bg-bg-elevated px-4 lg:px-6',
        className
      )}
    >
      {showMenuButton && (
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
          aria-label="Abrir menú"
        >
          <Menu className="h-5 w-5" />
        </Button>
      )}

      {/* Breadcrumbs */}
      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="flex items-center gap-1.5 text-caption text-fg-muted">
          {breadcrumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-fg-subtle">/</span>}
              {crumb.href ? (
                <a href={crumb.href} className="hover:text-fg transition-colors">
                  {crumb.label}
                </a>
              ) : (
                <span className="text-fg font-medium">{crumb.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      )}

      {title && !breadcrumbs && (
        <h1 className="text-h3 font-semibold text-fg">{title}</h1>
      )}

      <div className="ml-auto flex items-center gap-2">
        {children}
        <Button variant="ghost" size="icon" aria-label="Notificaciones">
          <Bell className="h-5 w-5" />
        </Button>
      </div>
    </header>
  )
}

export { Topbar }
export type { TopbarProps }
