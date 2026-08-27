'use client'

import * as React from 'react'
import { Sidebar } from '@/components/sidebar'
import { Topbar } from '@/components/topbar'
import { RequireAuth } from '@/components/require-auth'

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}): JSX.Element {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false)
  const [mobileOpen, setMobileOpen] = React.useState(false)

  return (
    <RequireAuth>
      <div className="flex h-screen overflow-hidden">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        <div
          className={`
            fixed inset-y-0 left-0 z-50 lg:static lg:z-auto
            transition-transform duration-200
            ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          `}
        >
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          />
        </div>

        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            showMenuButton
            onMenuClick={() => setMobileOpen(!mobileOpen)}
          />
          <main className="flex-1 overflow-y-auto bg-bg p-4 lg:p-6">
            {children}
          </main>
        </div>
      </div>
    </RequireAuth>
  )
}
