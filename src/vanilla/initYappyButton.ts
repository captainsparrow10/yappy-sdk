/**
 * @module yappy-sdk/vanilla
 * @description Vanilla JavaScript integration for the Yappy `<btn-yappy>` web component.
 *
 * Use this for projects without React: Vue, Svelte, Angular, plain HTML, etc.
 * It wires up the official Yappy CDN web component with your checkout backend.
 */

import type { YappyButtonConfig, YappyButtonTheme } from '../types'

const CDN_URLS = {
  production: 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js',
  sandbox: 'https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js',
} as const

/** The `<btn-yappy>` element exposes these imperative APIs at runtime. */
interface BtnYappyElement extends HTMLElement {
  eventPayment: (params: { transactionId: string; token: string; documentName: string }) => void
  isButtonLoading: boolean
}

export interface InitYappyButtonOptions extends YappyButtonConfig {
  /**
   * Optional request body to POST to checkoutEndpoint.
   * Include cart data, amounts, and any other context your backend needs.
   */
  checkoutPayload?: Record<string, unknown>
  /**
   * Called when the customer confirms payment in Yappy.
   * `detail` is the raw `event.detail` from the `eventSuccess` custom event.
   */
  onSuccess?: (detail: unknown) => void
  /**
   * Called when the payment fails or the channel reports an error.
   */
  onError?: (detail: unknown) => void
  /**
   * Called when the Yappy channel availability changes.
   * Hide or disable the button when `isOnline` is false.
   */
  onAvailabilityChange?: (isOnline: boolean) => void
  /**
   * API environment. Defaults to 'production'.
   * Use 'sandbox' for local testing to avoid real charges.
   */
  environment?: 'production' | 'sandbox'
}

/**
 * Initializes the official Yappy `<btn-yappy>` web component on a given DOM element.
 *
 * This function:
 * 1. Loads the Yappy CDN script (idempotent — safe to call multiple times).
 * 2. Creates a `<btn-yappy>` element inside `container` (or upgrades an existing one).
 * 3. Wires up `eventClick` → calls your `checkoutEndpoint` → calls `btn.eventPayment()`.
 * 4. Wires up `eventSuccess`, `eventError`, and `isYappyOnline` callbacks.
 *
 * @param container - The DOM element that will contain the Yappy button.
 * @param options - Configuration options.
 * @returns A cleanup function that removes event listeners and the CDN script reference.
 *          Call this when the containing component/view is destroyed.
 *
 * @example
 * ```typescript
 * import { initYappyButton } from 'yappy-sdk/vanilla'
 *
 * const container = document.getElementById('yappy-container')!
 * const cleanup = initYappyButton(container, {
 *   checkoutEndpoint: '/api/yappy/checkout',
 *   checkoutPayload: { total: '25.00', cartId: 'abc' },
 *   theme: 'blue',
 *   rounded: true,
 *   onSuccess: (detail) => { window.location.href = '/success' },
 *   onError: (detail) => { console.error('Payment failed', detail) },
 * })
 *
 * // Later, when the view is destroyed:
 * cleanup()
 * ```
 *
 * @example Vue 3 Composition API:
 * ```vue
 * <script setup>
 * import { ref, onMounted, onUnmounted } from 'vue'
 * import { initYappyButton } from 'yappy-sdk/vanilla'
 *
 * const containerRef = ref(null)
 * let cleanup = null
 *
 * onMounted(() => {
 *   cleanup = initYappyButton(containerRef.value, {
 *     checkoutEndpoint: '/api/yappy/checkout',
 *     onSuccess: (detail) => router.push('/success'),
 *   })
 * })
 *
 * onUnmounted(() => cleanup?.())
 * </script>
 * <template><div ref="containerRef" /></template>
 * ```
 */
export function initYappyButton(
  container: HTMLElement,
  options: InitYappyButtonOptions,
): () => void {
  const {
    checkoutEndpoint,
    checkoutPayload,
    theme = 'blue' as YappyButtonTheme,
    rounded = true,
    onSuccess,
    onError,
    onAvailabilityChange,
    environment = 'production',
  } = options

  const cdnUrl = CDN_URLS[environment]

  // Load CDN script (idempotent)
  if (!document.querySelector(`script[src="${cdnUrl}"]`)) {
    const script = document.createElement('script')
    script.type = 'module'
    script.src = cdnUrl
    document.head.appendChild(script)
  }

  // Create or reuse a <btn-yappy> element inside the container
  let btn = container.querySelector<BtnYappyElement>('btn-yappy')
  if (!btn) {
    btn = document.createElement('btn-yappy') as BtnYappyElement
    btn.setAttribute('theme', theme)
    btn.setAttribute('rounded', String(rounded))
    container.appendChild(btn)
  }

  const btnEl = btn

  // ---- Event Handlers ----

  const handleIsOnline = (event: Event) => {
    const isOnline = (event as CustomEvent<boolean>).detail
    onAvailabilityChange?.(isOnline)
    // Optionally hide the container when offline
    container.style.display = isOnline ? '' : 'none'
  }

  let isProcessing = false

  const handleClick = async () => {
    if (isProcessing) return
    isProcessing = true

    if (btnEl.isButtonLoading !== undefined) btnEl.isButtonLoading = true

    try {
      const response = await fetch(checkoutEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(checkoutPayload ?? {}),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { message?: string }
        throw new Error(errorData?.message ?? `HTTP ${response.status}`)
      }

      const data = await response.json() as {
        transactionId: string
        token: string
        documentName: string
      }

      btnEl.eventPayment({
        transactionId: data.transactionId,
        token: data.token,
        documentName: data.documentName,
      })
    } catch (error: unknown) {
      console.error('[yappy-sdk] initYappyButton: checkout request failed:', error)
      onError?.(error)
      isProcessing = false
      if (btnEl.isButtonLoading !== undefined) btnEl.isButtonLoading = false
    }
  }

  const handleSuccess = (event: Event) => {
    isProcessing = false
    if (btnEl.isButtonLoading !== undefined) btnEl.isButtonLoading = false
    onSuccess?.((event as CustomEvent).detail)
  }

  const handleError = (event: Event) => {
    isProcessing = false
    if (btnEl.isButtonLoading !== undefined) btnEl.isButtonLoading = false
    onError?.((event as CustomEvent).detail)
  }

  btnEl.addEventListener('isYappyOnline', handleIsOnline)
  btnEl.addEventListener('eventClick', handleClick)
  btnEl.addEventListener('eventSuccess', handleSuccess)
  btnEl.addEventListener('eventError', handleError)

  // Return cleanup function
  return () => {
    btnEl.removeEventListener('isYappyOnline', handleIsOnline)
    btnEl.removeEventListener('eventClick', handleClick)
    btnEl.removeEventListener('eventSuccess', handleSuccess)
    btnEl.removeEventListener('eventError', handleError)
  }
}
