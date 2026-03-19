/**
 * @module yappy-sdk/react/components/YappyButton
 * @description Ready-to-use React wrapper around the official `<btn-yappy>` web component.
 *
 * This component uses `useYappyWebComponent` internally and renders the native
 * `<btn-yappy>` Custom Element with proper event wiring. It does NOT include any styles
 * beyond what the CDN component provides — use `className` for layout overrides.
 *
 * If the Yappy channel is offline, `renderOffline` is rendered instead (or null by default).
 */

'use client'

import React, { useEffect } from 'react'
import {
  useYappyWebComponent,
  UseYappyWebComponentConfig,
} from '../hooks/useYappyWebComponent'
import { YappyButtonTheme } from '../../types'

// TypeScript declaration for the native Custom Element (not a React component).
// This allows `<btn-yappy>` usage in .tsx files without errors.
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        theme?: string
        rounded?: string
        ref?: React.Ref<HTMLElement>
      }
    }
  }
}

export interface YappyButtonProps {
  /**
   * Your backend checkout endpoint URL.
   * The component POSTs here when the user clicks the button.
   */
  checkoutEndpoint: string
  /**
   * Optional data to include in the POST body (cart, amounts, etc.).
   */
  checkoutPayload?: Record<string, unknown>
  /**
   * Called when the customer confirms payment in Yappy.
   * `detail` is the raw `event.detail` from the `eventSuccess` custom event.
   */
  onSuccess: (detail: unknown) => void
  /**
   * Called when the payment fails or is rejected.
   */
  onError?: (detail: unknown) => void
  /** Visual theme for the button. Defaults to YappyButtonTheme.Blue. */
  theme?: YappyButtonTheme
  /** Whether the button has rounded corners. Defaults to true. */
  rounded?: boolean
  /**
   * Content to render when the Yappy channel is offline.
   * Defaults to null (nothing rendered).
   */
  renderOffline?: React.ReactNode
  /**
   * Additional CSS class name for the wrapper div.
   * The button itself is a Custom Element — apply layout styles here.
   */
  className?: string
  /**
   * CDN environment. Defaults to 'production'.
   * Use 'sandbox' during development to avoid real charges.
   */
  environment?: 'production' | 'sandbox'
}

/**
 * React component for the official Yappy `<btn-yappy>` web component.
 *
 * Wraps `useYappyWebComponent` for easy drop-in usage. Shows an offline fallback
 * if the Yappy channel is unavailable. All styles come from the Yappy CDN — this
 * component adds no CSS of its own.
 *
 * @example
 * ```tsx
 * import { YappyButton } from 'yappy-sdk/react'
 *
 * <YappyButton
 *   checkoutEndpoint="/api/yappy/checkout"
 *   checkoutPayload={{ total: '25.00', cartId: cart.id }}
 *   onSuccess={(detail) => router.push('/success')}
 *   onError={(detail) => setError('Payment failed')}
 *   theme="blue"
 *   renderOffline={<p>Yappy no disponible.</p>}
 * />
 * ```
 */
export function YappyButton({
  checkoutEndpoint,
  checkoutPayload,
  onSuccess,
  onError,
  theme = YappyButtonTheme.Blue,
  rounded = true,
  renderOffline = null,
  className,
  environment = 'production',
}: YappyButtonProps) {
  const hookConfig: UseYappyWebComponentConfig = {
    checkoutEndpoint,
    checkoutPayload,
    onSuccess,
    onError,
    environment,
  }

  const { btnRef, isOnline, isCdnLoaded } = useYappyWebComponent(hookConfig)

  if (!isOnline) {
    return <>{renderOffline}</>
  }

  // Don't render the element until the CDN script is loaded to avoid
  // rendering an un-upgraded custom element (blank box).
  if (!isCdnLoaded) {
    return null
  }

  return (
    <div className={className}>
      {/* btn-yappy is a native Custom Element registered by the Yappy CDN script.
          It is NOT a React component — do not add React event handlers directly. */}
      <btn-yappy
        ref={btnRef as React.Ref<HTMLElement>}
        theme={theme}
        rounded={String(rounded)}
      />
    </div>
  )
}
