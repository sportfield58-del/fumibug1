'use client'

import * as React from 'react'
import { getSyncEngine, type SyncStatus } from './sync-engine'

const defaultStatus: SyncStatus = {
  pending: 0,
  inFlight: 0,
  failed: 0,
  total: 0,
  isSyncing: false,
}

export function useSyncStatus(): SyncStatus & { retry: () => void } {
  const [status, setStatus] = React.useState<SyncStatus>(defaultStatus)
  const engineRef = React.useRef(getSyncEngine())

  React.useEffect(() => {
    const engine = engineRef.current
    void engine.getStatus().then(setStatus)

    // Subscribe to status changes by polling
    const interval = setInterval(() => {
      void engine.getStatus().then(setStatus)
    }, 2_000)

    return () => {
      clearInterval(interval)
    }
  }, [])

  const retry = React.useCallback(() => {
    void engineRef.current.processPending()
  }, [])

  return { ...status, retry }
}
