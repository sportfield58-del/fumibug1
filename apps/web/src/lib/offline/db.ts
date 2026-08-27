import Dexie, { type EntityTable } from 'dexie'

/**
 * Outbox entry: cada escritura offline se encola aquí.
 * El SyncEngine la procesa en orden, con dependencias.
 * docs/spec/12-offline-pwa.md
 */
export interface OutboxEntry {
  id: string // UUID v4, generado en el cliente
  type: string // Ej: 'field/start-session', 'field/add-evidence', 'field/finish-service'
  payload: Record<string, unknown>
  occurredAt: string // ISO datetime
  deps: string[] // IDs de otras entradas que deben completarse primero
  status: 'PENDING' | 'IN_FLIGHT' | 'DONE' | 'FAILED'
  attempts: number
  lastError?: string
  createdAt: string
}

/**
 * Cached read data for offline.
 * Keys are API endpoint paths, values are the cached response.
 */
export interface CachedResponse {
  key: string // Ej: '/field/today', '/customers/123'
  data: unknown
  cachedAt: string
  ttlMs: number
}

/**
 * Photo blob store for evidence uploads.
 * Photos are compressed to WebP <300KB, EXIF stripped, stored here
 * until the server confirms the hash.
 */
export interface PhotoBlob {
  id: string // UUID v4
  serviceId: string
  blob: Blob
  mimeType: string
  sizeBytes: number
  hash: string // SHA-256 hex
  uploadedAt?: string // Set when server confirms
  createdAt: string
}

const db = new Dexie('FumibugCampo') as Dexie & {
  outbox: EntityTable<OutboxEntry, 'id'>
  cache: EntityTable<CachedResponse, 'key'>
  photos: EntityTable<PhotoBlob, 'id'>
}

db.version(1).stores({
  outbox: 'id, status, type, occurredAt, [status+occurredAt]',
  cache: 'key, cachedAt',
  photos: 'id, serviceId, hash, createdAt, [serviceId+uploadedAt]',
})

export { db }
