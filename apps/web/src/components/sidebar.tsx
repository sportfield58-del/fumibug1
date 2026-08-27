'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  Briefcase,
  CalendarRange,
  Map,
  Sun,
  CheckCircle,
  FileText,
  Package,
  Wallet,
  BarChart3,
  ScrollText,
  Settings,
  ChevronLeft,
  Bug,
} from 'lucide-react'
import { cn, Button } from '@fumibug/ui'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Clientes', href: '/admin/clientes', icon: Users },
  { label: 'Servicios', href: '/admin/servicios', icon: Briefcase },
  { label: 'Planificador', href: '/admin/planificador', icon: CalendarRange },
  { label: 'Rutas', href: '/admin/rutas', icon: Map },
  { label: 'Hoy', href: '/admin/hoy', icon: Sun },
  { label: 'Validación', href: '/admin/validacion', icon: CheckCircle },
  { label: 'Certificados', href: '/admin/certificados', icon: FileText },
  { label: 'Inventario', href: '/admin/inventario', icon: Package },
  { label: 'Caja', href: '/admin/caja', icon: Wallet },
  { label: 'Reportes', href: '/admin/reportes', icon: BarChart3 },
  { label: 'Auditoría', href: '/admin/auditoria', icon: ScrollText },
  { label: 'Configuración', href: '/admin/configuracion', icon: Settings },
]

interface SidebarProps {
  collapsed?: boolean
  onToggle?: () => void
  className?: string
}

function Sidebar({ collapsed = false, onToggle, className }: SidebarProps): JSX.Element {
  const pathname = usePathname()

  return (
    <aside
      className={cn(
        'flex h-full flex-col border-r border-border bg-bg-elevated transition-all duration-200',
        collapsed ? 'w-16' : 'w-64',
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-14 items-center gap-2 border-b border-border px-4">
        <Bug className="h-6 w-6 shrink-0 text-primary" />
        {!collapsed && (
          <span className="text-h3 font-bold text-fg">Fumibug</span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const isActive =
              item.href === '/admin'
                ? pathname === '/admin'
                : pathname.startsWith(item.href)
            const Icon = item.icon

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-md px-3 py-2 text-body font-medium transition-colors',
                    isActive
                      ? 'bg-primary-subtle text-primary'
                      : 'text-fg-muted hover:bg-bg-sunken hover:text-fg',
                    collapsed && 'justify-center px-0'
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-border p-2">
        <Button
          variant="ghost"
          size={collapsed ? 'icon' : 'sm'}
          onClick={onToggle}
          className={cn('w-full', collapsed && 'px-0')}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          <ChevronLeft
            className={cn(
              'h-4 w-4 transition-transform',
              collapsed && 'rotate-180'
            )}
          />
          {!collapsed && <span className="ml-1">Colapsar</span>}
        </Button>
      </div>
    </aside>
  )
}

export { Sidebar }
export type { SidebarProps, NavItem }
