import type { OutboxEntry } from './db'

/**
 * Pure sync-scheduling logic, separated for unit testing.
 */

/**
 * Returns the PENDING entries whose dependencies are all satisfied.
 */
export function filterReady(entries: OutboxEntry[]): OutboxEntry[] {
  return entries.filter((entry) => entry.status === 'PENDING' && filterIsReady(entries, entry))
}

export function filterIsReady(entries: OutboxEntry[], entry: OutboxEntry): boolean {
  if (entry.deps.length === 0) return true
  return entry.deps.every((depId) => {
    const dep = entries.find((e) => e.id === depId)
    if (!dep) return true // dep already processed outside this batch
    return dep.status === 'DONE'
  })
}

/**
 * Exponential backoff with jitter. base * 2^attempts, capped at maxDelay,
 * plus up to base ms of random jitter.
 */
export function calculateDelay(
  attempts: number,
  base = 1_000,
  maxDelay = 300_000,
  jitter = Math.random
): number {
  const exponential = Math.min(base * Math.pow(2, attempts), maxDelay)
  return exponential + jitter() * base
}

/** Entries blocked because a dependency is FAILED — these cascade to FAILED too. */
export function pickBlockedByFailed(entries: OutboxEntry[]): OutboxEntry[] {
  return entries.filter((entry) =>
    entry.deps.some((depId) => {
      const dep = entries.find((e) => e.id === depId)
      return dep?.status === 'FAILED'
    })
  )
}
