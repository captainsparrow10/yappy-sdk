/**
 * @module yappy-sdk/react/components/YappyPendingModal
 * @description Semantic HTML modal for displaying the pending Yappy payment state.
 *
 * Intentionally unstyled — provides semantic structure only. Apply your own CSS
 * via `className`. Supports three visual states: pending (with timer), paid, and
 * error states (failed, cancelled, expired).
 */

'use client'

import React from 'react'
import type { YappyPendingStatus } from '../hooks/useYappyPendingCheck'

/**
 * Formats seconds into MM:SS display string.
 * @example formatTime(95) // "01:35"
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0')
  const secs = (seconds % 60).toString().padStart(2, '0')
  return `${mins}:${secs}`
}

export interface YappyPendingModalProps {
  /** Current payment status. Controls which content is rendered. */
  status: YappyPendingStatus
  /** Seconds remaining before order expiry. Used only when status is 'pending'. */
  timeLeft?: number
  /** Called when the user clicks the cancel or close button. */
  onCancel: () => void
  /**
   * Error message to display in failure states (failed, cancelled, expired).
   * Falls back to a sensible default per status if not provided.
   */
  error?: string | null
  /**
   * Additional CSS class for the root `<dialog>` element.
   * Apply your modal backdrop, sizing, and positioning styles here.
   */
  className?: string
}

/**
 * Semantic modal for the pending Yappy payment flow.
 *
 * This component renders a native `<dialog>` element (open attribute set when visible)
 * with appropriate ARIA labels for each state. No CSS is included — style via `className`.
 *
 * States:
 * - `pending` — Shows instructions + countdown timer + cancel button
 * - `paid` — Shows success message (brief, before redirect)
 * - `failed` / `cancelled` / `expired` — Shows error message + close button
 *
 * @example
 * ```tsx
 * import { YappyPendingModal } from 'yappy-sdk/react'
 *
 * <YappyPendingModal
 *   status={status}
 *   timeLeft={timeLeft}
 *   onCancel={cancelPayment}
 *   error={errorMessage}
 *   className="my-modal"
 * />
 * ```
 */
export function YappyPendingModal({
  status,
  timeLeft = 300,
  onCancel,
  error,
  className,
}: YappyPendingModalProps) {
  const isVisible = status !== 'idle'

  if (!isVisible) return null

  const getDefaultError = (): string => {
    if (error) return error
    switch (status) {
      case 'expired': return 'El tiempo para confirmar el pago ha expirado.'
      case 'cancelled': return 'El pago fue cancelado.'
      case 'failed': return 'Hubo un error al procesar el pago. Por favor intenta nuevamente.'
      default: return 'Ocurrió un error con tu pago.'
    }
  }

  return (
    <dialog
      open={isVisible}
      aria-modal="true"
      aria-labelledby="yappy-modal-title"
      aria-describedby="yappy-modal-description"
      className={className}
    >
      <article>
        {/* ---- PENDING STATE ---- */}
        {status === 'pending' && (
          <>
            <header>
              <h2 id="yappy-modal-title">Pago con Yappy</h2>
              <p id="yappy-modal-description">
                Te enviamos una notificación a tu aplicación de Yappy para confirmar el pago.
              </p>
            </header>

            <section aria-label="Instrucciones">
              <ol>
                <li>Abre tu aplicación de Yappy</li>
                <li>Confirma el pago en la notificación</li>
                <li>Regresa aquí para ver tu orden</li>
              </ol>
            </section>

            <section aria-label="Tiempo restante">
              <time
                dateTime={`PT${timeLeft}S`}
                aria-label={`Tiempo restante: ${formatTime(timeLeft)}`}
              >
                {formatTime(timeLeft)}
              </time>
              <p>Tiempo restante para confirmar</p>
            </section>

            <footer>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cancelar pago con Yappy"
              >
                Cancelar pago
              </button>
            </footer>
          </>
        )}

        {/* ---- SUCCESS STATE ---- */}
        {status === 'paid' && (
          <>
            <header>
              <h2 id="yappy-modal-title">¡Pago exitoso!</h2>
              <p id="yappy-modal-description">Procesando tu orden…</p>
            </header>
          </>
        )}

        {/* ---- ERROR STATES ---- */}
        {(status === 'failed' || status === 'cancelled' || status === 'expired') && (
          <>
            <header>
              <h2 id="yappy-modal-title">
                {status === 'expired'
                  ? 'Tiempo expirado'
                  : status === 'cancelled'
                  ? 'Pago cancelado'
                  : 'Pago fallido'}
              </h2>
              <p id="yappy-modal-description" role="alert">
                {getDefaultError()}
              </p>
            </header>

            <footer>
              <button
                type="button"
                onClick={onCancel}
                aria-label="Cerrar mensaje de error y volver"
              >
                Volver
              </button>
            </footer>
          </>
        )}
      </article>
    </dialog>
  )
}
