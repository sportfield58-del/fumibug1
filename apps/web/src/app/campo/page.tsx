import { MapPin } from 'lucide-react'
import { EmptyState } from '@fumibug/ui'

export default function CampoHomePage(): JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12">
      <EmptyState
        icon={<MapPin className="h-8 w-8 text-fg-subtle" />}
        title="No tenés ruta para hoy"
        description="Cuando tu supervisor publique una ruta, aparecerá acá."
      />
    </div>
  )
}
