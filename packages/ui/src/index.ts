// ── Tokens ──
import '../tokens.css'

// ── Lib ──
export { cn } from './lib/cn'

// ── Components ──
export { Button, buttonVariants, type ButtonProps } from './components/button'
export { Input } from './components/input'
export { Label } from './components/label'
export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
} from './components/select'
export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from './components/dialog'
export {
  Sheet,
  SheetPortal,
  SheetOverlay,
  SheetTrigger,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetFooter,
  SheetTitle,
  SheetDescription,
} from './components/sheet'
export {
  ToastProvider,
  ToastViewport,
  Toast,
  ToastTitle,
  ToastDescription,
  ToastClose,
  ToastAction,
  type ToastProps,
  type ToastActionElement,
} from './components/toast'
export { Toaster } from './components/toaster'
export { useToast, toast } from './components/use-toast'
export { Badge, badgeVariants, type BadgeProps } from './components/badge'
export { Skeleton } from './components/skeleton'
export { EmptyState, type EmptyStateProps } from './components/empty-state'
export { ErrorBoundary, type ErrorBoundaryProps } from './components/error-boundary'

// ── Tailwind Preset (consumido por apps/web tailwind.config) ──
export { default as fumibugPreset } from './tailwind-preset'
