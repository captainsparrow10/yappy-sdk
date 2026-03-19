/**
 * @module yappy-sdk/react/hooks/useYappyCheckout
 * @description React hook for initiating a Yappy payment from a custom UI (no web component).
 *
 * Use this when you want full control over your payment UI instead of using the
 * official `<btn-yappy>` web component. The hook calls your backend checkout endpoint
 * and returns the checkout result needed to proceed with polling via `useYappyOrderStatus`.
 *
 * This hook does NOT poll for status — pair it with `useYappyOrderStatus` or
 * `useYappyPendingCheck` for the complete flow.
 */

import { useCallback, useState } from 'react'
import type { YappyCheckoutResult } from '../../types'

export interface UseYappyCheckoutConfig {
  /**
   * Your backend endpoint for initiating Yappy checkout.
   * Must be a POST endpoint that calls YappyClient.initCheckout() and returns:
   * `{ transactionId, token, documentName, orderId, expiresAt? }`
   */
  checkoutEndpoint: string
}

export interface UseYappyCheckoutReturn {
  /**
   * Initiates the Yappy checkout flow by calling your backend.
   * Pass the customer's Yappy phone number (optional — for QR flow omit it).
   *
   * @param aliasYappy - Customer phone number (8 digits, starts with 6 or 7). Optional.
   * @param payload - Additional data to include in the POST body (e.g., cart data).
   */
  initPayment: (aliasYappy?: string, payload?: Record<string, unknown>) => Promise<void>
  /** Whether the checkout request is in flight. */
  isLoading: boolean
  /** Error message if the checkout request failed, null otherwise. */
  error: string | null
  /** The checkout result when successful, null before initiation or on error. */
  data: (YappyCheckoutResult & { orderId: string; expiresAt?: string }) | null
  /** Resets the hook state (clears data and error). */
  reset: () => void
}

/**
 * Hook for initiating a Yappy payment via your custom backend endpoint.
 *
 * Use this for fully custom payment UIs that don't use the `<btn-yappy>` web component.
 * After a successful call, persist the returned `orderId` and use `useYappyOrderStatus`
 * or `useYappyPendingCheck` to poll for the payment result.
 *
 * @param config - Hook configuration.
 * @returns State and `initPayment` function.
 *
 * @example
 * ```tsx
 * import { useYappyCheckout } from 'yappy-sdk/react'
 *
 * function YappyForm() {
 *   const { initPayment, isLoading, error, data } = useYappyCheckout({
 *     checkoutEndpoint: '/api/yappy/checkout',
 *   })
 *
 *   const handleSubmit = async (phone: string) => {
 *     await initPayment(phone, { total: '25.00', cartId: 'abc' })
 *   }
 *
 *   if (data) {
 *     return <YappyPendingView orderId={data.orderId} expiresAt={data.expiresAt} />
 *   }
 *
 *   return (
 *     <form onSubmit={(e) => { e.preventDefault(); handleSubmit('60800011') }}>
 *       <button type="submit" disabled={isLoading}>Pagar con Yappy</button>
 *       {error && <p className="error">{error}</p>}
 *     </form>
 *   )
 * }
 * ```
 */
export function useYappyCheckout(config: UseYappyCheckoutConfig): UseYappyCheckoutReturn {
  const { checkoutEndpoint } = config

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<(YappyCheckoutResult & { orderId: string; expiresAt?: string }) | null>(null)

  const initPayment = useCallback(
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
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData?.message ?? `Checkout failed: HTTP ${response.status}`)
        }

        const result = await response.json() as YappyCheckoutResult & {
          orderId: string
          expiresAt?: string
        }

        setData(result)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Error al iniciar pago con Yappy'
        setError(message)
      } finally {
        setIsLoading(false)
      }
    },
    [checkoutEndpoint],
  )

  const reset = useCallback(() => {
    setIsLoading(false)
    setError(null)
    setData(null)
  }, [])

  return { initPayment, isLoading, error, data, reset }
}
