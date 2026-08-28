'use client'

import * as React from 'react'
import Link from 'next/link'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { MapPin, Clock, CheckCircle, XCircle, ArrowRight, GripVertical, Plus } from 'lucide-react'
import {
  Button,
  Badge,
  EmptyState,
  Skeleton,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from '@fumibug/ui'
import { getListRoutes, getListUsers, postCreateRoute } from '@/../../lib/api/client'
import type { Route, UserWithMembership } from '@fumibug/contracts'

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  DRAFT: { label: 'Borrador', variant: 'secondary', icon: null },
  READY: { label: 'Lista', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  PUBLISHED: { label: 'Publicada', variant: 'default', icon: <ArrowRight className="h-3 w-3" /> },
  IN_PROGRESS: { label: 'En curso', variant: 'default', icon: <Clock className="h-3 w-3" /> },
  COMPLETED: { label: 'Completada', variant: 'secondary', icon: <CheckCircle className="h-3 w-3" /> },
  CANCELLED: { label: 'Cancelada', variant: 'destructive', icon: <XCircle className="h-3 w-3" /> },
}

function SortableRouteCard({ route }: { route: Route }): JSX.Element {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: route.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  const status = statusConfig[route.status] ?? statusConfig.DRAFT

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-border bg-bg-elevated p-4 transition-colors hover:bg-bg-sunken ${isDragging ? 'z-50 shadow-lg' : ''}`}
    >
      <div className="flex items-center gap-3">
        <button
          className="cursor-grab active:cursor-grabbing touch-none shrink-0 p-1 rounded hover:bg-bg-subtle"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-5 w-5 text-fg-subtle" />
        </button>
        <Link href={`/admin/planificador/rutas/${route.id}`} className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-body font-semibold text-fg">{route.code}</h3>
                {status && (
                  <Badge variant={status.variant} className="gap-1">
                    {status.icon}
                    {status.label}
                  </Badge>
                )}
              </div>
              <p className="text-caption text-fg-muted mt-1">
                {route.routeDate} · Técnico: {route.technicianName ?? `${route.technicianId.slice(0, 8)}...`}
                {route.publishedAt && ` · Publicada ${new Date(route.publishedAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}`}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-fg-subtle" />
          </div>
          {route.notes && (
            <p className="text-caption text-fg-muted mt-2 line-clamp-1">{route.notes}</p>
          )}
        </Link>
      </div>
    </div>
  )
}

export default function PlanificadorPage(): JSX.Element {
  const [routes, setRoutes] = React.useState<Route[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [dateFilter, setDateFilter] = React.useState(
    new Date().toISOString().split('T')[0] ?? ''
  )
  const [technicians, setTechnicians] = React.useState<UserWithMembership[]>([])
  const [showCreateForm, setShowCreateForm] = React.useState(false)
  const [newTechnicianId, setNewTechnicianId] = React.useState('')
  const [newDate, setNewDate] = React.useState(dateFilter)
  const [isCreating, setIsCreating] = React.useState(false)
  const [createError, setCreateError] = React.useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const fetchRoutes = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await getListRoutes({
        query: { date: dateFilter || undefined, limit: 50 },
      })
      if (res.success) {
        setRoutes(res.data)
      } else {
        setError(res.error.message)
      }
    } catch {
      setError('No se pudieron cargar las rutas')
    } finally {
      setIsLoading(false)
    }
  }, [dateFilter])

  React.useEffect(() => {
    void fetchRoutes()
  }, [fetchRoutes])

  React.useEffect(() => {
    getListUsers({ query: { roleKey: 'technician', limit: 50 } })
      .then((res) => {
        if (res.success) setTechnicians(res.data)
      })
      .catch(() => {
        // Sin operarios en el combo no bloquea la pantalla — solo no se puede crear
        // ruta hasta reintentar; el resto de Planificador sigue usable.
      })
  }, [])

  const handleCreateRoute = async (): Promise<void> => {
    if (!newTechnicianId || !newDate) {
      setCreateError('Elegí operario y fecha.')
      return
    }
    setIsCreating(true)
    setCreateError(null)
    try {
      const res = await postCreateRoute({ body: { technicianId: newTechnicianId, date: newDate } })
      if (res.success) {
        setShowCreateForm(false)
        setNewTechnicianId('')
        setDateFilter(newDate)
        void fetchRoutes()
      } else {
        setCreateError(res.error.message)
      }
    } catch {
      setCreateError('No se pudo crear la ruta')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDragEnd = (event: DragEndEvent): void => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setRoutes((items) => {
      const oldIndex = items.findIndex((r) => r.id === active.id)
      const newIndex = items.findIndex((r) => r.id === over.id)
      if (oldIndex === -1 || newIndex === -1) return items
      return arrayMove(items, oldIndex, newIndex)
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-h1 font-semibold text-fg">Planificador</h1>
        <Button onClick={() => setShowCreateForm((v) => !v)}>
          <Plus className="h-4 w-4" /> Nueva ruta
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="space-y-1">
          <label className="text-caption text-fg-muted" htmlFor="date-filter">Fecha</label>
          <Input
            id="date-filter"
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-40"
          />
        </div>
      </div>

      {/* Crear ruta */}
      {showCreateForm && (
        <div className="rounded-lg border border-border bg-bg-elevated p-4 space-y-3">
          <h2 className="text-body font-semibold text-fg">Nueva ruta</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1">
              <Label htmlFor="new-route-technician">Operario</Label>
              <Select value={newTechnicianId} onValueChange={setNewTechnicianId}>
                <SelectTrigger id="new-route-technician">
                  <SelectValue placeholder="Seleccionar operario" />
                </SelectTrigger>
                <SelectContent>
                  {technicians.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.fullName ?? t.username ?? t.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="new-route-date">Fecha</Label>
              <Input
                id="new-route-date"
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => { void handleCreateRoute() }} disabled={isCreating}>
                {isCreating ? 'Creando...' : 'Crear ruta'}
              </Button>
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                Cancelar
              </Button>
            </div>
          </div>
          {createError && <p className="text-caption text-destructive">{createError}</p>}
          {technicians.length === 0 && (
            <p className="text-caption text-fg-muted">
              No hay operarios cargados — dalos de alta primero en Usuarios.
            </p>
          )}
        </div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4">
          <p className="text-body text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => { void fetchRoutes() }} className="mt-2">
            Reintentar
          </Button>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && routes.length === 0 && (
        <EmptyState
          icon={<MapPin className="h-8 w-8 text-fg-subtle" />}
          title="Planificar rutas"
          description="No hay rutas para esta fecha. Crea una ruta para asignar servicios a un técnico."
        />
      )}

      {/* Routes with drag & drop */}
      {!isLoading && !error && routes.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={routes.map((r) => r.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-3">
              {routes.map((route) => (
                <SortableRouteCard key={route.id} route={route} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  )
}
