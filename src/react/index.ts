/**
 * @module yappy-sdk/react
 * @description React hooks and components for Yappy payment integration.
 *
 * Import from this subpath in React / Next.js client code:
 * ```typescript
 * import { useYappyWebComponent, YappyButton } from 'yappy-sdk/react'
 * ```
 *
 * This module does NOT export server-side utilities (YappyClient, webhook validators).
 * For server-side code, use `yappy-sdk/server`.
 */

// Hooks
export { useYappyWebComponent } from './hooks/useYappyWebComponent'
export { useYappyCheckout } from './hooks/useYappyCheckout'
export { useYappyOrderStatus } from './hooks/useYappyOrderStatus'
export { useYappyPendingCheck } from './hooks/useYappyPendingCheck'

// Components (optional UI)
export { YappyButton } from './components/YappyButton'
export { YappyPhoneInput, validateYappyPhone } from './components/YappyPhoneInput'
export { YappyPendingModal } from './components/YappyPendingModal'

// Hook config types
export type { UseYappyWebComponentConfig, UseYappyWebComponentReturn } from './hooks/useYappyWebComponent'
export type { UseYappyCheckoutConfig, UseYappyCheckoutReturn } from './hooks/useYappyCheckout'
export type { UseYappyOrderStatusConfig, UseYappyOrderStatusReturn, YappyOrderStatusData } from './hooks/useYappyOrderStatus'
export type {
  UseYappyPendingCheckConfig,
  UseYappyPendingCheckReturn,
  YappyPendingStatus,
  YappyPendingOrderData,
} from './hooks/useYappyPendingCheck'

// Component prop types
export type { YappyButtonProps } from './components/YappyButton'
export type { YappyPhoneInputProps } from './components/YappyPhoneInput'
export type { YappyPendingModalProps } from './components/YappyPendingModal'

// Re-export shared types for convenience
export { YappyButtonTheme, YappyStatus, YappyErrorCode, YAPPY_ERROR_MESSAGES } from '../types'
export type { YappyButtonConfig, YappyPaymentParams } from '../types'
