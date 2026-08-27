import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary text-primary-fg',
        secondary: 'border-transparent bg-bg-sunken text-fg',
        destructive: 'border-transparent bg-destructive text-destructive-fg',
        outline: 'text-fg',
        // Estado chips — forma + color (spec §G.4.5)
        draft: 'border-transparent bg-state-draft text-white',
        scheduled: 'border-transparent bg-state-scheduled text-white',
        dispatched: 'border-transparent bg-state-dispatched text-white',
        progress: 'border-transparent bg-state-progress text-white',
        done: 'border-transparent bg-state-done text-white',
        problem: 'border-transparent bg-state-problem text-white',
        pending: 'border-transparent bg-state-pending text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
