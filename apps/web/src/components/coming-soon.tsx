import { Construction } from 'lucide-react'
import { EmptyState } from '@fumibug/ui'

/**
 * Módulos de Fase 2 (o Fase 1 sin pantalla propia todavía) — mejor esto que un 404
 * genérico cuando alguien hace click en el sidebar durante una demo.
 */
export function ComingSoon({ title }: { title: string }): JSX.Element {
  return (
    <EmptyState
      icon={<Construction className="h-8 w-8 text-fg-subtle" />}
      title={title}
      description="Todavía no está construido — llega en una próxima etapa."
    />
  )
}
