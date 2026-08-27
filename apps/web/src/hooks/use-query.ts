'use client'

import * as React from 'react'

interface UseQueryState<T> {
  data: T | null
  error: string | null
  isLoading: boolean
}

export function useQuery<T>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): UseQueryState<T> & { refetch: () => void } {
  const [state, setState] = React.useState<UseQueryState<T>>({
    data: null,
    error: null,
    isLoading: true,
  })
  const [refreshKey, setRefreshKey] = React.useState(0)

  React.useEffect(() => {
    let cancelled = false
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    fetcher()
      .then((data) => {
        if (!cancelled) setState({ data, error: null, isLoading: false })
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Error desconocido'
          setState({ data: null, error: message, isLoading: false })
        }
      })

    return () => { cancelled = true }
  }, [refreshKey, ...deps])

  const refetch = React.useCallback(() => setRefreshKey((k) => k + 1), [])

  return { ...state, refetch }
}
