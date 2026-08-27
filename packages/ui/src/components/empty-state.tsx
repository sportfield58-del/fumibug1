import { cn } from '../lib/cn'
import { FileX } from 'lucide-react'
import { Button } from './button'

interface EmptyStateProps {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: {
    label: string
    onClick: () => void
  } | undefined
  className?: string
}

function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps): JSX.Element {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-bg-sunken">
        {icon ?? <FileX className="h-8 w-8 text-fg-subtle" />}
      </div>
      <h3 className="mt-4 text-h3 font-semibold text-fg">{title}</h3>
      {description && (
        <p className="mt-2 text-body text-fg-muted max-w-sm">{description}</p>
      )}
      {action && (
        <Button onClick={action.onClick} className="mt-6">
          {action.label}
        </Button>
      )}
    </div>
  )
}

export { EmptyState }
export type { EmptyStateProps }
