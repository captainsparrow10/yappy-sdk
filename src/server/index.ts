/**
 * @module yappy-sdk/server
 * @description Server-side exports for the Yappy SDK.
 *
 * Import from this subpath in Node.js / server environments only:
 * ```typescript
 * import { YappyClient, validateYappyHash, parseYappyWebhook, generateOrderId } from 'yappy-sdk/server'
 * ```
 *
 * NEVER import this module in browser code — it contains server-only utilities
 * and depends on Node.js built-ins (crypto, etc.).
 */

export { YappyClient, generateOrderId } from './YappyClient'
export { validateYappyHash, parseYappyWebhook } from './webhook'

// Re-export relevant types for convenience
export type {
  YappyClientConfig,
  ValidateMerchantRequest,
  ValidateMerchantResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  YappyCheckoutResult,
  YappyWebhookPayload,
  YappyWebhookResult,
} from '../types'

export { YappyStatus, YappyErrorCode, YAPPY_ERROR_MESSAGES } from '../types'
