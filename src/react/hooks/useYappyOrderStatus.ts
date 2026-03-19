/**
 * @module yappy-sdk/react/hooks/useYappyOrderStatus
 * @description React hook for polling the status of a pending Yappy order.
 *
 * Polls your backend status endpoint at a configurable interval until the order
 * reaches a terminal state (paid, failed, cancelled, or expired).
 *
 * Use this hook when you manage the pending state UI yourself. For a complete
 * orchestrated flow (timer + localStorage persistence + callbacks), use
 * `useYappyPendingCheck` instead.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { YappyStatus } from '../../types'

/** Terminal states — polling stops when one of these is reached. */
const TERMINAL_STATUSES: YappyStatus[] = [
  YappyStatus.Executed,
  YappyStatus.Rejected,
  YappyStatus.Cancelled,
  YappyStatus.Expired,
]

/** Status response shape expected from your status endpoint. */
export interface YappyOrderStatusData {
  /**
   * Current status of the Yappy order.
   * Your backend maps Yappy webhook statuses (E/R/C/X) to your internal status names
   * ('paid', 'failed', 'cancelled', 'expired'). This hook accepts both conventions.
   */
  status: string
  /** Error message from Yappy, if any. */
  errorMessage?: string | null
  /** Order data, available when status is 'paid' / Executed. */
  order?: Record<string, unknown> | null
}

export interface UseYappyOrderStatusConfig {
  /**
   * Your backend endpoint for fetching order status.
   * The hook appends `/{orderId}` to this URL.
   * Example: '/api/yappy/status' → calls GET '/api/yappy/status/ABC123XYZ789012'
   */
  statusEndpoint: string
  /** The `orderId` returned by your checkout endpoint. Polling is disabled if null. */
  orderId: string | null
  /**
   * Polling interval in milliseconds. Defaults to 3000 (3 seconds).
   * Increase this to reduce server load, but it makes the UX feel slower.
   */
  interval?: number
  /**
   * Optional expiry timestamp (ISO string). If provided, polling stops automatically
   * 1 minute after this time (grace period to catch the final 'expired' status from backend).
   */
  expiresAt?: string
}

export interface UseYappyOrderStatusReturn {
  /** The full status response data from your backend, or null while loading. */
  data: YappyOrderStatusData | null
  /** Whether polling is currently active. */
  isPolling: boolean
  /** Error message if the status fetch failed, null otherwise. */
  error: string | null
  /** Manually stop polling (e.g., when user cancels). */
  stopPolling: () => void
  /** Restart polling after it was stopped. */
  startPolling: () => void
}

/**
 * Hook for polling the status of a pending Yappy order.
 *
 * Polls your backend status endpoint every `interval` ms until the order reaches
 * a terminal state or the `expiresAt` grace period elapses.
 *
 * @param config - Hook configuration.
 * @returns Current status data and polling controls.
 *
 * @example
 * ```tsx
 * import { useYappyOrderStatus } from 'yappy-sdk/react'
 *
 * function PendingPaymentView({ orderId, expiresAt }: Props) {
 *   const { data, isPolling, error } = useYappyOrderStatus({
 *     statusEndpoint: '/api/yappy/status',
 *     orderId,
 *     expiresAt,
 *   })
 *
 *   useEffect(() => {
 *     if (data?.status === 'paid') navigateToSuccess()
 *     if (data?.status === 'failed') showError(data.errorMessage)
 *   }, [data?.status])
 *
 *   return <div>{isPolling ? 'Esperando confirmación...' : data?.status}</div>
 * }
 * ```
 */
export function useYappyOrderStatus(config: UseYappyOrderStatusConfig): UseYappyOrderStatusReturn {
  const { statusEndpoint, orderId, interval = 3000, expiresAt } = config

  const [data, setData] = useState<YappyOrderStatusData | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    if (isMountedRef.current) setIsPolling(false)
  }, [])

  const fetchStatus = useCallback(async () => {
    if (!orderId) return

    // Check expiry with grace period (1 minute after expiry)
    if (expiresAt) {
      const expiryMs = new Date(expiresAt).getTime()
      if (Date.now() >= expiryMs + 60_000) {
        stopPolling()
        return
      }
    }

    try {
      const response = await fetch(`${statusEndpoint}/${orderId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        throw new Error(`Status fetch failed: HTTP ${response.status}`)
      }

      const result = await response.json() as YappyOrderStatusData

      if (!isMountedRef.current) return

      setData(result)
      setError(null)

      // Stop polling if terminal state reached
      // Accept both Yappy single-char codes and internal status names
      const statusValue = result.status as string
      const isTerminal =
        TERMINAL_STATUSES.includes(statusValue as YappyStatus) ||
        ['paid', 'failed', 'cancelled', 'expired'].includes(statusValue)

      if (isTerminal) {
        stopPolling()
      }
    } catch (err: unknown) {
      if (!isMountedRef.current) return
      const message = err instanceof Error ? err.message : 'Error al obtener estado del pago'
      setError(message)
      // Don't stop polling on error — transient network failures are common
    }
  }, [orderId, statusEndpoint, expiresAt, stopPolling])

  const startPolling = useCallback(() => {
    if (!orderId || intervalRef.current) return

    setIsPolling(true)
    setError(null)

    // Fetch immediately, then at interval
    fetchStatus()
    intervalRef.current = setInterval(fetchStatus, interval)
  }, [orderId, interval, fetchStatus])

  // Start polling when orderId becomes available
  useEffect(() => {
    if (orderId) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => stopPolling()
  }, [orderId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopPolling()
    }
  }, [stopPolling])

  return { data, isPolling, error, stopPolling, startPolling }
}
