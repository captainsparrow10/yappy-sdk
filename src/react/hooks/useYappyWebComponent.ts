/**
 * @module yappy-sdk/react/hooks/useYappyWebComponent
 * @description React hook for integrating the OFFICIAL Yappy `<btn-yappy>` web component CDN.
 *
 * This is the recommended integration path per Banco General's documentation.
 * It loads the Yappy CDN script dynamically and wires up the native Custom Element events.
 *
 * Usage pattern:
 * 1. Use this hook to get a `ref` and state helpers.
 * 2. Attach the `ref` to a `<btn-yappy>` element in your JSX.
 * 3. The hook handles: CDN loading, `eventClick` (calls your backend), `eventPayment` dispatch.
 * 4. Your component receives `onSuccess` / `onError` callbacks.
 *
 * @example
 * ```tsx
 * import { useYappyWebComponent } from 'yappy-sdk/react'
 *
 * function CheckoutPage() {
 *   const { btnRef, isOnline, isLoading } = useYappyWebComponent({
 *     checkoutEndpoint: '/api/yappy/checkout',
 *     onSuccess: (detail) => router.push(`/success?id=${detail.orderId}`),
 *     onError: (detail) => setError(detail.message),
 *   })
 *
 *   if (!isOnline) return <p>Yappy no está disponible en este momento.</p>
 *
 *   return <btn-yappy ref={btnRef} theme="blue" rounded="true" />
 * }
 * ```
 *
 * IMPORTANT: `<btn-yappy>` is a native DOM Custom Element, NOT a React component.
 * TypeScript will complain about unknown JSX elements — see the TypeScript section
 * in docs/integration-guide.md for how to declare the global type.
 */

import { useCallback, useEffect, useRef, useState } from 'react'

/** CDN URLs per environment */
const CDN_URLS = {
  production: 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js',
  sandbox: 'https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js',
} as const

/** The custom element exposes these methods and properties at runtime. */
interface BtnYappyElement extends HTMLElement {
  /** Call this with checkout params to activate the Yappy payment flow in the button. */
  eventPayment: (params: { transactionId: string; token: string; documentName: string }) => void
  /** Set to true to show the button's loading state while your backend call is in flight. */
  isButtonLoading: boolean
}

export interface UseYappyWebComponentConfig {
  /**
   * Your backend endpoint URL for initiating checkout.
   * The hook POSTs to this URL when the user clicks the button.
   * Your endpoint must call YappyClient.initCheckout() and return:
   * `{ transactionId: string; token: string; documentName: string }`
   *
   * NEVER call the Yappy API directly from the browser.
   */
  checkoutEndpoint: string
  /**
   * Optional request body to include in the POST to checkoutEndpoint.
   * Use this to pass cart data, customer info, amounts, etc.
   */
  checkoutPayload?: Record<string, unknown>
  /**
   * Called when the customer successfully authorizes the payment in Yappy.
   * `detail` contains the event.detail object from the `eventSuccess` event.
   */
  onSuccess: (detail: unknown) => void
  /**
   * Called when the payment fails or is rejected.
   * `detail` contains the event.detail object from the `eventError` event.
   */
  onError?: (detail: unknown) => void
  /**
   * CDN environment. Defaults to 'production'.
   * Use 'sandbox' during development to avoid real transactions.
   */
  environment?: 'production' | 'sandbox'
}

export interface UseYappyWebComponentReturn {
  /**
   * Attach this ref to your `<btn-yappy>` element.
   * The hook uses it to call `eventPayment()` and set `isButtonLoading`.
   *
   * @example
   * // In React TSX (requires global type declaration for btn-yappy):
   * <btn-yappy ref={btnRef} theme="blue" rounded="true" />
   */
  btnRef: React.RefObject<BtnYappyElement | null>
  /** Whether the Yappy payment channel is currently online. Hides the button when false. */
  isOnline: boolean
  /** Whether a checkout request to your backend is in flight. */
  isLoading: boolean
  /** True once the CDN script has been loaded and the element is registered. */
  isCdnLoaded: boolean
  /** Manually set the loading state (useful for custom loading UIs). */
  setLoading: (loading: boolean) => void
}

/**
 * React hook for the official Yappy `<btn-yappy>` web component CDN integration.
 *
 * Handles:
 * - Dynamic CDN script loading (idempotent — safe to call multiple times)
 * - Listening to `isYappyOnline` to show/hide the button
 * - Listening to `eventClick` to call your checkout endpoint
 * - Calling `btnyappy.eventPayment()` with the result
 * - Listening to `eventSuccess` and `eventError` to invoke your callbacks
 *
 * @param config - Hook configuration.
 * @returns Ref and state for your `<btn-yappy>` element.
 */
export function useYappyWebComponent(
  config: UseYappyWebComponentConfig,
): UseYappyWebComponentReturn {
  const { checkoutEndpoint, checkoutPayload, onSuccess, onError, environment = 'production' } = config

  const btnRef = useRef<BtnYappyElement | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const [isLoading, setIsLoading] = useState(false)
  const [isCdnLoaded, setIsCdnLoaded] = useState(false)

  // Stable ref for callbacks to avoid stale closures in event listeners
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)
  useEffect(() => { onSuccessRef.current = onSuccess }, [onSuccess])
  useEffect(() => { onErrorRef.current = onError }, [onError])

  // Load CDN script once
  useEffect(() => {
    const cdnUrl = CDN_URLS[environment]

    // Idempotent: don't load twice
    if (document.querySelector(`script[src="${cdnUrl}"]`)) {
      setIsCdnLoaded(true)
      return
    }

    const script = document.createElement('script')
    script.type = 'module'
    script.src = cdnUrl
    script.onload = () => setIsCdnLoaded(true)
    script.onerror = () => {
      console.error('[yappy-sdk] Failed to load Yappy CDN script:', cdnUrl)
    }
    document.head.appendChild(script)
  }, [environment])

  // Wire up web component events once the element is in the DOM and CDN is loaded
  useEffect(() => {
    if (!isCdnLoaded) return
    const btn = btnRef.current
    if (!btn) return

    /**
     * `isYappyOnline` — fires with true/false to indicate channel availability.
     * Hide the button (or show an offline message) when false.
     */
    const handleIsOnline = (event: Event) => {
      setIsOnline((event as CustomEvent<boolean>).detail)
    }

    /**
     * `eventClick` — fires when the user taps the Yappy button.
     * Call your backend to create the Yappy order, then pass the result
     * back to the web component via `btn.eventPayment()`.
     */
    const handleClick = async () => {
      if (isLoading) return
      setIsLoading(true)
      if (btn.isButtonLoading !== undefined) btn.isButtonLoading = true

      try {
        const response = await fetch(checkoutEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(checkoutPayload ?? {}),
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData?.message ?? `HTTP ${response.status}`)
        }

        const data = await response.json() as { transactionId: string; token: string; documentName: string }

        // Pass the checkout result to the web component to trigger the Yappy flow
        btn.eventPayment({
          transactionId: data.transactionId,
          token: data.token,
          documentName: data.documentName,
        })
      } catch (error: unknown) {
        console.error('[yappy-sdk] Checkout request failed:', error)
        onErrorRef.current?.(error)
        setIsLoading(false)
        if (btn.isButtonLoading !== undefined) btn.isButtonLoading = false
      }
    }

    /**
     * `eventSuccess` — fires when the customer successfully confirms the payment in Yappy.
     */
    const handleSuccess = (event: Event) => {
      setIsLoading(false)
      if (btn.isButtonLoading !== undefined) btn.isButtonLoading = false
      onSuccessRef.current((event as CustomEvent).detail)
    }

    /**
     * `eventError` — fires when the payment fails or is rejected.
     */
    const handleError = (event: Event) => {
      setIsLoading(false)
      if (btn.isButtonLoading !== undefined) btn.isButtonLoading = false
      onErrorRef.current?.((event as CustomEvent).detail)
    }

    btn.addEventListener('isYappyOnline', handleIsOnline)
    btn.addEventListener('eventClick', handleClick)
    btn.addEventListener('eventSuccess', handleSuccess)
    btn.addEventListener('eventError', handleError)

    return () => {
      btn.removeEventListener('isYappyOnline', handleIsOnline)
      btn.removeEventListener('eventClick', handleClick)
      btn.removeEventListener('eventSuccess', handleSuccess)
      btn.removeEventListener('eventError', handleError)
    }
  }, [isCdnLoaded, checkoutEndpoint, checkoutPayload, isLoading])

  const setLoading = useCallback((loading: boolean) => {
    setIsLoading(loading)
    if (btnRef.current && btnRef.current.isButtonLoading !== undefined) {
      btnRef.current.isButtonLoading = loading
    }
  }, [])

  return { btnRef, isOnline, isLoading, isCdnLoaded, setLoading }
}
