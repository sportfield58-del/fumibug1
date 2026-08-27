import {
  filterReady,
  filterIsReady,
  calculateDelay,
  pickBlockedByFailed,
} from './sync-logic'
import type { OutboxEntry } from './db'

function makeEntry(partial: Partial<OutboxEntry> & { id: string }): OutboxEntry {
  return {
    type: 'test',
    payload: {},
    occurredAt: '2026-01-01T00:00:00Z',
    deps: [],
    status: 'PENDING',
    attempts: 0,
    createdAt: '2026-01-01T00:00:00Z',
    ...partial,
  }
}

describe('filterReady', () => {
  it('returns entries without deps immediately', () => {
    const a = makeEntry({ id: 'a' })
    const b = makeEntry({ id: 'b' })
    expect(filterReady([a, b])).toEqual([a, b])
  })

  it('holds an entry until its dependency is DONE', () => {
    const payment = makeEntry({ id: 'payment', deps: ['session'] })
    const session = makeEntry({ id: 'session', status: 'PENDING' })

    // Session not done → payment not ready (only session is ready)
    expect(filterIsReady([session, payment], payment)).toBe(false)
    expect(filterReady([session, payment]).map((e) => e.id)).toEqual(['session'])

    // Session done → payment ready
    const sessionDone = { ...session, status: 'DONE' as const }
    expect(filterIsReady([sessionDone, payment], payment)).toBe(true)
    expect(filterReady([sessionDone, payment]).map((e) => e.id)).toEqual(['payment'])
  })

  it('respects causal chains (pago depende de sesión, cierre de pago)', () => {
    const session = makeEntry({ id: 's1', status: 'DONE' })
    const supplies = makeEntry({ id: 'c1', deps: ['s1'] })
    const photos = makeEntry({ id: 'p1', deps: ['s1'] })
    const payment = makeEntry({ id: 'pay1', deps: ['c1'] })
    const signature = makeEntry({ id: 'sig1', deps: ['pay1'] })

    const ready = filterReady([session, supplies, photos, payment, signature])
    const readyIds = ready.map((e) => e.id).sort()
    // supplies + photos ready (depend on done session); payment/signature blocked
    expect(readyIds).toEqual(['c1', 'p1'])
  })
})

describe('pickBlockedByFailed', () => {
  it('finds entries whose dep failed (cascade)', () => {
    const session = makeEntry({ id: 's1', status: 'FAILED' })
    const supplies = makeEntry({ id: 'c1', deps: ['s1'] })
    expect(pickBlockedByFailed([session, supplies]).map((e) => e.id)).toEqual(['c1'])
  })
})

describe('calculateDelay', () => {
  it('doubles with attempts', () => {
    const d0 = calculateDelay(0, 1000, 300000, () => 0)
    const d1 = calculateDelay(1, 1000, 300000, () => 0)
    const d2 = calculateDelay(2, 1000, 300000, () => 0)
    expect(d0).toBe(1000)
    expect(d1).toBe(2000)
    expect(d2).toBe(4000)
  })

  it('caps at max delay', () => {
    expect(calculateDelay(20, 1000, 5000, () => 0)).toBeLessThanOrEqual(5001)
  })

  it('adds jitter', () => {
    const withJitter = calculateDelay(0, 1000, 300000, () => 0.5)
    expect(withJitter).toBe(1500)
  })
})
