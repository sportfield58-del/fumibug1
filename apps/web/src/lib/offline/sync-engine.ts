import { db, type OutboxEntry } from './db'
import { filterReady, pickBlockedByFailed, calculateDelay } from './sync-logic'

const MAX_ATTEMPTS = 10

/**
 * SyncEngine: procesa la outbox en orden causal, con backoff exponencial + jitter.
 * docs/spec/12-offline-pwa.md §5
 *
 * - Cada entrada tiene `deps[]` que referencian otros IDs de la outbox
 * - No procesa una entrada hasta que todas sus dependencias estén DONE
 * - Backoff: base * 2^attempts + random jitter, tope 5 min
 * - Máximo 10 reintentos; después → FAILED (error 4xx no recuperable)
 * - POST /field/sync batch: agrupa entradas listas en un solo request
 */
export class SyncEngine {
  private processing = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private onStatusChange?: ((status: SyncStatus) => void) | undefined

  constructor(onStatusChange?: (status: SyncStatus) => void) {
    this.onStatusChange = onStatusChange
  }

  async enqueue(entry: Omit<OutboxEntry, 'status' | 'attempts' | 'createdAt'>): Promise<void> {
    await db.outbox.add({
      ...entry,
      status: 'PENDING',
      attempts: 0,
      createdAt: new Date().toISOString(),
    })
    this.emitStatus()
    this.scheduleProcess()
  }

  async processPending(): Promise<void> {
    if (this.processing) return
    this.processing = true
    this.emitStatus()

    try {
      const pending = await db.outbox
        .where('status')
        .equals('PENDING')
        .sortBy('occurredAt')

      if (pending.length === 0) {
        this.processing = false
        this.emitStatus()
        return
      }

      // Find entries whose deps are all DONE
      const ready = filterReady(pending)

      if (ready.length === 0) {
        // Check if any deps are FAILED — cascade
        const blocked = pickBlockedByFailed(pending)
        if (blocked.length > 0) {
          // Mark blocked entries as FAILED
          for (const entry of blocked) {
            await db.outbox.update(entry.id, {
              status: 'FAILED',
              lastError: 'Dependent entry failed',
            })
          }
        }
        this.processing = false
        this.emitStatus()
        return
      }

      // Mark as IN_FLIGHT
      for (const entry of ready) {
        await db.outbox.update(entry.id, { status: 'IN_FLIGHT' })
      }

      // POST /field/sync batch
      const batchPayload = ready.map((e) => ({
        clientEventId: e.id,
        type: e.type,
        payload: e.payload,
        occurredAt: e.occurredAt,
      }))

      try {
        const response = await fetch('/v1/field/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: batchPayload }),
        })

        if (response.ok) {
          // Mark all as DONE
          for (const entry of ready) {
            await db.outbox.update(entry.id, { status: 'DONE' })
          }
        } else if (response.status >= 400 && response.status < 500) {
          // 4xx not recoverable → FAILED
          for (const entry of ready) {
            await db.outbox.update(entry.id, {
              status: 'FAILED',
              lastError: `HTTP ${response.status}`,
              attempts: entry.attempts + 1,
            })
          }
        } else {
          // 5xx or network → retry with backoff
          for (const entry of ready) {
            const newAttempts = entry.attempts + 1
            if (newAttempts >= MAX_ATTEMPTS) {
              await db.outbox.update(entry.id, {
                status: 'FAILED',
                lastError: 'Max attempts exceeded',
                attempts: newAttempts,
              })
            } else {
              await db.outbox.update(entry.id, {
                status: 'PENDING',
                attempts: newAttempts,
                lastError: `HTTP ${response.status}`,
              })
            }
          }
        }
      } catch {
        // Network error → retry with backoff
        for (const entry of ready) {
          const newAttempts = entry.attempts + 1
          if (newAttempts >= MAX_ATTEMPTS) {
            await db.outbox.update(entry.id, {
              status: 'FAILED',
              lastError: 'Network error',
              attempts: newAttempts,
            })
          } else {
            await db.outbox.update(entry.id, {
              status: 'PENDING',
              attempts: newAttempts,
              lastError: 'Network error',
            })
          }
        }
      }
    } finally {
      this.processing = false
      this.emitStatus()
      // Check if there's more to process
      const remaining = await db.outbox.where('status').equals('PENDING').count()
      if (remaining > 0) {
        this.scheduleProcess()
      }
    }
  }

  private scheduleProcess(): void {
    if (this.timer) return
    // Find earliest PENDING entry to calculate delay
    void db.outbox.where('status').equals('PENDING').first().then((entry) => {
      if (!entry) return
      const delay = this.calculateDelay(entry)
      this.timer = setTimeout(() => {
        this.timer = null
        void this.processPending()
      }, delay)
    })
  }

  private calculateDelay(entry: OutboxEntry): number {
    return calculateDelay(entry.attempts)
  }

  private emitStatus(): void {
    if (!this.onStatusChange) return
    void this.getStatus().then(this.onStatusChange)
  }

  async getStatus(): Promise<SyncStatus> {
    const pending = await db.outbox.where('status').equals('PENDING').count()
    const inFlight = await db.outbox.where('status').equals('IN_FLIGHT').count()
    const failed = await db.outbox.where('status').equals('FAILED').count()
    const total = await db.outbox.count()

    return {
      pending,
      inFlight,
      failed,
      total,
      isSyncing: this.processing,
    }
  }

  destroy(): void {
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }
}

export interface SyncStatus {
  pending: number
  inFlight: number
  failed: number
  total: number
  isSyncing: boolean
}

/** Singleton for the app */
let engine: SyncEngine | null = null

export function getSyncEngine(): SyncEngine {
  if (!engine) {
    engine = new SyncEngine()
  }
  return engine
}
