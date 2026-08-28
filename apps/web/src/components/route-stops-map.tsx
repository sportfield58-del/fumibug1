'use client'

import * as React from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Mapa estático de las paradas de una ruta — NO es tracking en vivo (GPS continuo
 * en background está explícitamente descartado del MVP, ver
 * docs/spec/19-mvp-roadmap.md: "Técnicamente imposible en PWA. Prometerlo genera
 * una expectativa que no se puede cumplir."). Muestra dónde queda cada cliente de la
 * ruta y el estado de la parada (pendiente / en camino / llegó / hecho), que se
 * actualiza cada vez que el operario avanza en el campo — no es una posición GPS
 * moviéndose sola.
 */
export interface RouteStopsMapPoint {
  id: string
  sequence: number
  status: string
  lat: number
  lng: number
  customerName: string
  addressLine: string
}

const STATUS_COLOR: Record<string, string> = {
  PENDING: '#94a3b8', // slate
  EN_ROUTE: '#3b82f6', // blue
  ARRIVED: '#f59e0b', // amber
  IN_PROGRESS: '#f59e0b',
  DONE: '#22c55e', // green
  NO_SHOW: '#ef4444',
  INACCESSIBLE: '#ef4444',
  SKIPPED: '#94a3b8',
  CANCELLED: '#ef4444',
}

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pendiente',
  EN_ROUTE: 'En camino',
  ARRIVED: 'Llegó',
  IN_PROGRESS: 'En curso',
  DONE: 'Completado',
  NO_SHOW: 'No se presentó',
  INACCESSIBLE: 'Inaccesible',
  SKIPPED: 'Saltado',
  CANCELLED: 'Cancelado',
}

export function RouteStopsMap({ points }: { points: RouteStopsMapPoint[] }): JSX.Element | null {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const mapRef = React.useRef<L.Map | null>(null)
  const layerRef = React.useRef<L.LayerGroup | null>(null)

  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const map = L.map(containerRef.current, { scrollWheelZoom: false })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map)
    mapRef.current = map
    layerRef.current = L.layerGroup().addTo(map)
    return () => {
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
  }, [])

  React.useEffect(() => {
    const map = mapRef.current
    const layer = layerRef.current
    if (!map || !layer) return
    layer.clearLayers()

    if (points.length === 0) return

    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    for (const p of points) {
      const color = STATUS_COLOR[p.status] ?? '#94a3b8'
      L.circleMarker([p.lat, p.lng], {
        radius: 12,
        color: '#fff',
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindTooltip(String(p.sequence), { permanent: true, direction: 'center', className: 'route-stop-tooltip' })
        .bindPopup(
          `<strong>${escapeHtml(p.customerName)}</strong><br/>${escapeHtml(p.addressLine)}<br/>${STATUS_LABEL[p.status] ?? p.status}`,
        )
        .addTo(layer)
    }
    map.fitBounds(bounds, { padding: [32, 32], maxZoom: 15 })
  }, [points])

  return (
    <div>
      <div ref={containerRef} className="h-80 w-full rounded-lg border border-border" />
      <style jsx global>{`
        .route-stop-tooltip {
          background: transparent;
          border: none;
          box-shadow: none;
          color: #fff;
          font-weight: 600;
          font-size: 12px;
        }
      `}</style>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c)
}
