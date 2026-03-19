/**
 * @module yappy-sdk/react/components/YappyPhoneInput
 * @description Accessible phone input for entering a Panamanian Yappy phone number.
 *
 * Validates Panamanian mobile numbers: 8 digits starting with 6 or 7 (e.g., 60800011).
 * This component is intentionally unstyled — use `className` to apply your own design.
 */

'use client'

import React, { useState } from 'react'

/**
 * Validates a Panamanian phone number for Yappy.
 *
 * Rules:
 * - Exactly 8 digits
 * - Must start with 6 or 7
 * - No country code prefix (+507)
 *
 * @example
 * validateYappyPhone('60800011') // true
 * validateYappyPhone('20800011') // false — doesn't start with 6 or 7
 * validateYappyPhone('6080001')  // false — only 7 digits
 */
export function validateYappyPhone(phone: string): boolean {
  return /^[67]\d{7}$/.test(phone)
}

export interface YappyPhoneInputProps {
  /**
   * Called when the user submits a valid phone number.
   * @param phone - 8-digit phone number string (no country code).
   */
  onSubmit: (phone: string) => void
  /** Disables the input and submit button. */
  disabled?: boolean
  /** Additional CSS class for the root `<form>` element. */
  className?: string
  /** Placeholder text for the input. Defaults to "Ej: 60800011". */
  placeholder?: string
  /** Label text. Defaults to "Número de teléfono Yappy". */
  label?: string
  /** Submit button text. Defaults to "Continuar". */
  submitLabel?: string
}

/**
 * Phone number input for the custom Yappy payment flow.
 *
 * Validates the Panamanian mobile phone format (8 digits, starts with 6 or 7).
 * Styled entirely via `className` — no default visual styles are applied.
 *
 * @example
 * ```tsx
 * import { YappyPhoneInput } from 'yappy-sdk/react'
 *
 * <YappyPhoneInput
 *   onSubmit={(phone) => startPayment(phone)}
 *   disabled={isLoading}
 *   className="my-form-class"
 * />
 * ```
 */
export function YappyPhoneInput({
  onSubmit,
  disabled = false,
  className,
  placeholder = 'Ej: 60800011',
  label = 'Número de teléfono Yappy',
  submitLabel = 'Continuar',
}: YappyPhoneInputProps) {
  const [phone, setPhone] = useState('')
  const [touched, setTouched] = useState(false)

  const isValid = validateYappyPhone(phone)
  const showError = touched && phone.length > 0 && !isValid

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow digits, cap at 8 characters
    const clean = e.target.value.replace(/\D/g, '').slice(0, 8)
    setPhone(clean)
  }

  const handleBlur = () => setTouched(true)

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setTouched(true)
    if (isValid && !disabled) {
      onSubmit(phone)
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className} noValidate>
      <fieldset disabled={disabled}>
        <legend className="sr-only">Pago con Yappy</legend>

        <label htmlFor="yappy-phone-input">
          {label}
        </label>

        <input
          id="yappy-phone-input"
          type="tel"
          inputMode="numeric"
          pattern="[67][0-9]{7}"
          value={phone}
          onChange={handleChange}
          onBlur={handleBlur}
          placeholder={placeholder}
          maxLength={8}
          autoComplete="tel-national"
          aria-describedby={showError ? 'yappy-phone-error' : 'yappy-phone-hint'}
          aria-invalid={showError ? 'true' : undefined}
          required
        />

        <p id="yappy-phone-hint" className="sr-only">
          Ingresa tu número de teléfono sin el código +507. Ejemplo: 60800011
        </p>

        {showError && (
          <p id="yappy-phone-error" role="alert" aria-live="polite">
            El número debe tener 8 dígitos y empezar con 6 o 7. Ejemplo: 60800011
          </p>
        )}

        <button type="submit" disabled={disabled || !isValid}>
          {submitLabel}
        </button>
      </fieldset>
    </form>
  )
}
