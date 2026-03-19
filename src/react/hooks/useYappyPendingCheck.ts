/**
 * @module yappy-sdk/react/hooks/useYappyPendingCheck
 * @description Full-featured orchestrator hook for the Yappy custom payment flow.
 *
 * This hook manages the entire lifecycle of a pending Yappy payment:
 * - Initiating checkout (calling your backend)
 * - Polling for payment status
 * - Countdown timer (Yappy orders expire after 5 minutes)
 * - Persisting state in localStorage to survive page refreshes
 * - Handling success, failure, cancellation, and expiration
 *
 * Use this when you want to build a completely custom payment UI without
 * the official `<btn-yappy>` web component.
 *
 * ⚠️ EXPIRATION WARNING: Yappy payment orders expire after exactly 5 minutes.
 * The `timeLeft` value counts down from 300 seconds. If `timeLeft` reaches 0,
 * the order is expired and cannot be completed. Your UI MUST display this timer.
 *
 * ⚠️ REFRESH RECOVERY: This hook saves the pending order to localStorage under
 * the key `yappy_pending_order` so that if the user refreshes the page mid-payment,
 * the polling resumes automatically. Clear this key once the order completes.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** localStorage key for persisting pending order across refreshes. */
const STORAGE_KEY = 'yappy_pending_order'

/** Internal status — maps to both Yappy API statuses and custom ones. */
export type YappyPendingStatus = 'idle' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'

/** Shape of the pending order data persisted in localStorage. */
export interface YappyPendingOrderData {
  /** The `orderId` generated for this transaction (15-char alphanumeric). */
  orderId: string
  /** The Yappy transaction ID from your backend. */
  transactionId: string
  /** ISO string of when this order expires (5 minutes after creation). */
  expiresAt: string
  /** When the order was created. */
  createdAt: string
}

export interface UseYappyPendingCheckConfig {
  /** Backend endpoint for initiating checkout (POST). */
  checkoutEndpoint: string
  /**
   * Backend endpoint for polling order status (GET).
   * The hook calls `GET {statusEndpoint}/{orderId}`.
   */
  statusEndpoint: string
  /** Backend endpoint for cancelling a pending order (POST). Optional. */
  cancelEndpoint?: string
  /** Called when the payment is confirmed (status = 'paid'). */
  onSuccess: (data: { orderId: string; transactionId: string; orderData?: unknown }) => void
  /** Called when the payment fails, is cancelled, or expires. */
  onError?: (reason: { status: YappyPendingStatus; message: string }) => void
  /**
   * Polling interval in ms. Defaults to 3000.
   * Keep this at 3000 or higher to avoid rate limiting your backend.
   */
  interval?: number
  /**
   * Maximum time to wait in ms before treating the order as expired on the client side.
   * Defaults to 300000 (5 minutes, matching Yappy's server-side expiry).
   * The timer is computed from the `expiresAt` timestamp returned by your backend.
   */
  expiryMs?: number
}

export interface UseYappyPendingCheckReturn {
  /** Current status of the pending payment. */
  status: YappyPendingStatus
  /** Seconds remaining before the order expires. Counts down from 300. */
  timeLeft: number
  /** The pending order data (orderId, transactionId, expiresAt). Null when idle. */
  pendingOrder: YappyPendingOrderData | null
  /**
   * Start the payment flow. Calls your checkout endpoint and begins polling.
   * @param aliasYappy - Customer's Yappy phone number (optional).
   * @param payload - Additional data to POST to your checkout endpoint.
   */
  startPayment: (aliasYappy?: string, payload?: Record<string, unknown>) => Promise<void>
  /** Cancel the pending payment. Calls cancelEndpoint if configured, then clears state. */
  cancelPayment: () => Promise<void>
  /** Reset hook to idle state. */
  reset: () => void
  /** Whether a checkout request is in flight. */
  isLoading: boolean
  /** Error message if checkout initiation failed. */
  error: string | null
}

// ============================================================================
// localStorage helpers
// ============================================================================

function savePending(data: YappyPendingOrderData): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch {
    // Storage full or unavailable — continue without persistence
  }
}

function loadPending(): YappyPendingOrderData | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as YappyPendingOrderData
  } catch {
    return null
  }
}

function clearPending(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // Ignore
  }
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Orchestrator hook for the complete Yappy custom payment flow.
 *
 * @param config - Hook configuration with endpoints and callbacks.
 * @returns State and controls for the pending payment UI.
 *
 * @example
 * ```tsx
 * import { useYappyPendingCheck } from 'yappy-sdk/react'
 *
 * function CheckoutPage() {
 *   const {
 *     status, timeLeft, startPayment, cancelPayment, isLoading, error
 *   } = useYappyPendingCheck({
 *     checkoutEndpoint: '/api/yappy/checkout',
 *     statusEndpoint: '/api/yappy/status',
 *     cancelEndpoint: '/api/yappy/cancel',
 *     onSuccess: ({ orderId }) => router.push(`/success?order=${orderId}`),
 *     onError: ({ message }) => showToast('error', message),
 *   })
 *
 *   if (status === 'pending') {
 *     return (
 *       <YappyPendingModal
 *         status={status}
 *         timeLeft={timeLeft}
 *         onCancel={cancelPayment}
 *       />
 *     )
 *   }
 *
 *   return (
 *     <YappyPhoneInput
 *       onSubmit={(phone) => startPayment(phone, { total: '25.00' })}
 *       disabled={isLoading}
 *     />
 *   )
 * }
 * ```
 */
export function useYappyPendingCheck(config: UseYappyPendingCheckConfig): UseYappyPendingCheckReturn {
  const {
    checkoutEndpoint,
    statusEndpoint,
    cancelEndpoint,
    onSuccess,
    onError,
    interval = 3000,
  } = config

  const [status, setStatus] = useState<YappyPendingStatus>('idle')
  const [timeLeft, setTimeLeft] = useState(300)
  const [pendingOrder, setPendingOrder] = useState<YappyPendingOrderData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const isMountedRef = useRef(true)
  const isProcessingRef = useRef(false)

  // Stable refs for callbacks
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  const stopAll = useCallback(() => {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const reset = useCallback(() => {
    stopAll()
    clearPending()
    if (!isMountedRef.current) return
    setStatus('idle')
    setTimeLeft(300)
    setPendingOrder(null)
    setIsLoading(false)
    setError(null)
    isProcessingRef.current = false
  }, [stopAll])

  // ---- Polling ----

  const pollStatus = useCallback(async (order: YappyPendingOrderData) => {
    if (isProcessingRef.current) return

    try {
      const response = await fetch(`${statusEndpoint}/${order.orderId}`)
      if (!response.ok) return // Transient error — keep polling

      const data = await response.json() as {
        status: string
        errorMessage?: string
        order?: unknown
      }

      if (!isMountedRef.current) return

      if (data.status === 'paid' || data.status === 'E') {
        isProcessingRef.current = true
        stopAll()
        clearPending()
        setStatus('paid')
        onSuccessRef.current({
          orderId: order.orderId,
          transactionId: order.transactionId,
          orderData: data.order,
        })
      } else if (
        data.status === 'failed' || data.status === 'R' ||
        data.status === 'cancelled' || data.status === 'C' ||
        data.status === 'expired' || data.status === 'X'
      ) {
        const mappedStatus: YappyPendingStatus =
          data.status === 'R' ? 'failed' :
          data.status === 'C' ? 'cancelled' :
          data.status === 'X' ? 'expired' :
          data.status as YappyPendingStatus

        stopAll()
        clearPending()
        setStatus(mappedStatus)
        onErrorRef.current?.({
          status: mappedStatus,
          message: data.errorMessage ?? 'El pago no fue completado',
        })
      }
    } catch {
      // Network error — keep polling, don't change state
    }
  }, [statusEndpoint, stopAll])

  // ---- Timer ----

  const startTimer = useCallback((expiresAt: string) => {
    if (timerRef.current) clearInterval(timerRef.current)

    const calcRemaining = () => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))

    setTimeLeft(calcRemaining())

    timerRef.current = setInterval(() => {
      const remaining = calcRemaining()
      if (isMountedRef.current) setTimeLeft(remaining)

      if (remaining <= 0) {
        clearInterval(timerRef.current!)
        timerRef.current = null
        // Let polling detect the 'expired' status from backend
        // But if polling is still running, give it 60s grace before forcing expiry
        setTimeout(() => {
          if (isMountedRef.current && status === 'pending') {
            stopAll()
            clearPending()
            setStatus('expired')
            onErrorRef.current?.({
              status: 'expired',
              message: 'El tiempo para confirmar el pago ha expirado',
            })
          }
        }, 60_000)
      }
    }, 1000)
  }, [status, stopAll])

  // ---- Start Payment ----

  const startPayment = useCallback(
    async (aliasYappy?: string, payload?: Record<string, unknown>) => {
      setIsLoading(true)
      setError(null)

      try {
        const response = await fetch(checkoutEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...(payload ?? {}),
            ...(aliasYappy ? { aliasYappy } : {}),
          }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({})) as { message?: string }
          throw new Error(err?.message ?? `Checkout failed: HTTP ${response.status}`)
        }

        const data = await response.json() as {
          orderId: string
          transactionId: string
          expiresAt?: string
        }

        const expiresAt = data.expiresAt ?? new Date(Date.now() + 5 * 60 * 1000).toISOString()
        const orderData: YappyPendingOrderData = {
          orderId: data.orderId,
          transactionId: data.transactionId,
          expiresAt,
          createdAt: new Date().toISOString(),
        }

        savePending(orderData)
        setPendingOrder(orderData)
        setStatus('pending')

        // Start timer and polling
        startTimer(expiresAt)
        pollStatus(orderData)
        pollingRef.current = setInterval(() => pollStatus(orderData), interval)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al iniciar pago con Yappy'
        setError(message)
      } finally {
        if (isMountedRef.current) setIsLoading(false)
      }
    },
    [checkoutEndpoint, interval, pollStatus, startTimer],
  )

  // ---- Cancel Payment ----

  const cancelPayment = useCallback(async () => {
    stopAll()

    if (cancelEndpoint && pendingOrder) {
      try {
        await fetch(`${cancelEndpoint}/${pendingOrder.orderId}`, { method: 'POST' })
      } catch {
        // Fire-and-forget — don't block UI on cancel endpoint failure
      }
    }

    clearPending()
    if (isMountedRef.current) {
      setStatus('cancelled')
      setPendingOrder(null)
    }
  }, [cancelEndpoint, pendingOrder, stopAll])

  // ---- Resume from localStorage on mount ----
  useEffect(() => {
    const saved = loadPending()
    if (!saved) return

    const expiryMs = new Date(saved.expiresAt).getTime()
    if (Date.now() >= expiryMs) {
      // Already expired — clear and don't resume
      clearPending()
      return
    }

    // Resume polling for the saved order
    setPendingOrder(saved)
    setStatus('pending')
    startTimer(saved.expiresAt)
    pollStatus(saved)
    pollingRef.current = setInterval(() => pollStatus(saved), interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- Cleanup on unmount ----
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopAll()
    }
  }, [stopAll])

  return {
    status,
    timeLeft,
    pendingOrder,
    startPayment,
    cancelPayment,
    reset,
    isLoading,
    error,
  }
}
