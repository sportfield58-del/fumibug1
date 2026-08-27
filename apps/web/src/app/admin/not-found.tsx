import Link from 'next/link'
import { Button } from '@fumibug/ui'

export default function NotFound(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center py-24">
      <h1 className="text-display font-bold text-fg">404</h1>
      <p className="mt-2 text-body text-fg-muted">Página no encontrada</p>
      <Button asChild variant="outline" className="mt-6">
        <Link href="/admin">Volver al inicio</Link>
      </Button>
    </div>
  )
}
