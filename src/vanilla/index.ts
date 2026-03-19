/**
 * @module yappy-sdk/vanilla
 * @description Vanilla JavaScript / framework-agnostic Yappy web component integration.
 *
 * Use this for Vue, Svelte, Angular, or plain HTML projects that don't use React.
 *
 * ```typescript
 * import { initYappyButton } from 'yappy-sdk/vanilla'
 * ```
 */

export { initYappyButton } from './initYappyButton'
export type { InitYappyButtonOptions } from './initYappyButton'

// Re-export shared types
export { YappyButtonTheme, YappyStatus, YappyErrorCode, YAPPY_ERROR_MESSAGES } from '../types'
export type { YappyButtonConfig, YappyPaymentParams } from '../types'
