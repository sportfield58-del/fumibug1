import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata = {
  title: 'Fumibug',
  description: 'Field Service Management para control de plagas',
}

export default function RootLayout({
  children,
}: {
  children: ReactNode
}): JSX.Element {
  return (
    <html lang="es" className={inter.variable}>
      <body className="min-h-screen bg-bg font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
