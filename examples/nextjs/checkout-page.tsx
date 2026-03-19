/**
 * Next.js checkout page example — Yappy payment integration.
 *
 * Demonstrates BOTH integration approaches side by side:
 *
 * Approach A — Official Web Component (<btn-yappy>):
 *   Uses YappyButton (wrapping useYappyWebComponent).
 *   The CDN component handles the payment UI natively.
 *   Best for: simple integrations with standard Banco General branding.
 *
 * Approach B — Custom Flow (useYappyPendingCheck):
 *   Full control over UI. Customer enters their Yappy phone number,
 *   you call your backend, then poll for the payment result.
 *   Best for: custom designs, mobile-first flows, React Native.
 */

'use client'

import React, { useState } from 'react'
import {
  YappyButton,
  YappyPhoneInput,
  YappyPendingModal,
  useYappyPendingCheck,
  YappyButtonTheme,
} from '@panama-payments/yappy/react'

// ── Shared cart data (replace with your actual cart state) ───────────────────

const CART = {
  total: '25.00',
  subtotal: '23.81',
  taxes: '1.19',
  discount: '0.00',
}

// ── Approach A: Official Web Component ───────────────────────────────────────

/**
 * Drop-in Yappy button using the official <btn-yappy> CDN web component.
 *
 * The button handles the entire payment UI including QR code display,
 * phone number entry (if aliasYappy is not pre-populated), and result feedback.
 *
 * PREREQUISITE: Load the CDN script in your layout. Either:
 *   <script src="https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js" type="module" />
 * or let useYappyWebComponent load it dynamically (which YappyButton does automatically).
 */
function WebComponentApproach() {
  const [paid, setPaid] = useState(false)
  const [payError, setPayError] = useState<string | null>(null)

  if (paid) {
    return <p role="status">¡Pago exitoso! Redirigiendo...</p>
  }

  return (
    <section aria-labelledby="wc-heading">
      <h2 id="wc-heading">Pagar con Yappy (Web Component)</h2>

      {payError && <p role="alert">{payError}</p>}

      <YappyButton
        checkoutEndpoint="/api/yappy/checkout"
        checkoutPayload={CART}
        onSuccess={() => setPaid(true)}
        onError={(detail) => setPayError(String(detail))}
        theme={YappyButtonTheme.Blue}
        environment="production"
        renderOffline={<p>Yappy no está disponible en este momento. Intenta más tarde.</p>}
      />
    </section>
  )
}

// ── Approach B: Custom Flow with useYappyPendingCheck ────────────────────────

/**
 * Fully custom Yappy payment flow:
 * 1. Customer enters their Yappy phone number
 * 2. Your backend creates the Yappy order
 * 3. A pending modal shows with a countdown timer
 * 4. The hook polls for confirmation via /api/yappy/status/:orderId
 * 5. On success, onSuccess callback fires — redirect to order confirmation
 */
function CustomFlowApproach() {
  const {
    status,
    timeLeft,
    startPayment,
    cancelPayment,
    isLoading,
    error,
  } = useYappyPendingCheck({
    checkoutEndpoint: '/api/yappy/checkout',
    statusEndpoint: '/api/yappy/status',
    cancelEndpoint: '/api/yappy/cancel',
    onSuccess: ({ orderId }) => {
      // Redirect to your order confirmation page
      window.location.href = `/checkout/success?orderId=${orderId}`
    },
    onError: ({ message }) => {
      console.error('[yappy] Payment error:', message)
    },
  })

  const handlePhoneSubmit = (phone: string) => {
    startPayment(phone, CART)
  }

  return (
    <section aria-labelledby="custom-heading">
      <h2 id="custom-heading">Pagar con Yappy (Flujo Personalizado)</h2>

      {/* Phone input — only visible when not in pending/paid state */}
      {status === 'idle' && (
        <YappyPhoneInput
          onSubmit={handlePhoneSubmit}
          disabled={isLoading}
        />
      )}

      {error && <p role="alert">{error}</p>}

      {/* Pending modal — shown when payment is initiated */}
      <YappyPendingModal
        status={status}
        timeLeft={timeLeft}
        onCancel={cancelPayment}
      />
    </section>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const [approach, setApproach] = useState<'webcomponent' | 'custom'>('webcomponent')

  return (
    <main>
      <h1>Checkout</h1>

      <nav aria-label="Seleccionar método de integración Yappy">
        <button
          type="button"
          aria-pressed={approach === 'webcomponent'}
          onClick={() => setApproach('webcomponent')}
        >
          Web Component (Oficial)
        </button>
        <button
          type="button"
          aria-pressed={approach === 'custom'}
          onClick={() => setApproach('custom')}
        >
          Flujo Personalizado
        </button>
      </nav>

      {approach === 'webcomponent' ? <WebComponentApproach /> : <CustomFlowApproach />}
    </main>
  )
}
