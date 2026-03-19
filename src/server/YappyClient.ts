/**
 * @module yappy-sdk/server
 * @description Server-side Yappy API client for Node.js environments.
 *
 * IMPORTANT: This module is for server-side use ONLY. Never import or call it
 * from browser code — it uses your secret credentials (YAPPY_MERCHANT_ID, etc.)
 * that must never be exposed to the client.
 */

import axios, { AxiosInstance } from 'axios'
import {
  YappyClientConfig,
  ValidateMerchantRequest,
  ValidateMerchantResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  YappyCheckoutResult,
} from '../types'

// ============================================================================
// CONSTANTS
// ============================================================================

const API_URLS = {
  production: 'https://apipagosbg.bgeneral.cloud',
  sandbox: 'https://api-comecom-uat.yappycloud.com',
} as const

const CDN_URLS = {
  production: 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js',
  sandbox: 'https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js',
} as const

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Generates a random alphanumeric orderId of exactly 15 characters.
 *
 * Yappy requires orderIds to be:
 * - Exactly 15 alphanumeric characters (error E009 if longer)
 * - Unique per transaction (error E007 if reused)
 *
 * @returns A random 15-character uppercase alphanumeric string.
 *
 * @example
 * const orderId = generateOrderId() // e.g. "A3KX9MZQ1BPRY7W"
 */
export function generateOrderId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from(
    { length: 15 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('')
}

// ============================================================================
// YappyClient
// ============================================================================

/**
 * Server-side client for the Yappy (Banco General) payment API.
 *
 * Handles the two-step authentication + order creation flow required by Yappy:
 * 1. `validateMerchant()` — exchanges credentials for a short-lived token
 * 2. `createOrder()` — creates a payment order using the token
 * 3. `initCheckout()` — orchestrates both steps in a single call (recommended)
 *
 * @example
 * ```typescript
 * import { YappyClient } from 'yappy-sdk/server'
 *
 * const yappy = new YappyClient({
 *   merchantId: process.env.YAPPY_MERCHANT_ID!,
 *   urlDomain: process.env.YAPPY_URL_DOMAIN!,
 *   environment: process.env.YAPPY_ENVIRONMENT as 'production' | 'sandbox' ?? 'production',
 * })
 *
 * // In your checkout endpoint:
 * const result = await yappy.initCheckout({
 *   orderId: generateOrderId(),
 *   ipnUrl: 'https://api.mystore.com/webhooks/yappy',
 *   total: '25.00',
 *   subtotal: '25.00',
 *   discount: '0.00',
 *   taxes: '0.00',
 *   aliasYappy: '60800011', // optional — customer's phone
 * })
 * ```
 */
export class YappyClient {
  private readonly config: Required<YappyClientConfig>
  private readonly http: AxiosInstance
  /** The CDN URL for the `<btn-yappy>` web component script. Use this to load the CDN. */
  public readonly cdnUrl: string
  /** The base API URL for this environment. */
  public readonly apiUrl: string

  constructor(config: YappyClientConfig) {
    this.config = {
      environment: 'production',
      ...config,
    }

    this.apiUrl = API_URLS[this.config.environment]
    this.cdnUrl = CDN_URLS[this.config.environment]

    this.http = axios.create({
      baseURL: this.apiUrl,
      headers: { 'Content-Type': 'application/json' },
      timeout: 15000,
    })
  }

  /**
   * Step 1: Validates your merchant credentials with Yappy and obtains a short-lived token.
   *
   * The token expires quickly — always call this immediately before `createOrder()`.
   * Do NOT cache or reuse tokens across requests.
   *
   * @returns The short-lived authorization token needed for `createOrder()`.
   * @throws {Error} If the merchant validation fails (invalid credentials, network error, etc.)
   *
   * @example
   * ```typescript
   * const token = await yappy.validateMerchant()
   * // token is a short-lived string, use it immediately
   * ```
   */
  async validateMerchant(): Promise<string> {
    const body: ValidateMerchantRequest = {
      merchantId: this.config.merchantId,
      urlDomain: this.config.urlDomain,
    }

    try {
      const response = await this.http.post<ValidateMerchantResponse>(
        '/payments/validate/merchant',
        body,
      )

      const token = response.data.body?.token
      if (!token) {
        throw new Error(
          `Yappy validateMerchant: missing token in response. status=${response.data.status?.code} description=${response.data.status?.description}`,
        )
      }

      return token
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data as Partial<ValidateMerchantResponse>
        throw new Error(
          `Yappy validateMerchant failed: ${apiError?.status?.description ?? error.message}`,
        )
      }
      throw error
    }
  }

  /**
   * Step 2: Creates a payment order in Yappy.
   *
   * Must be called immediately after `validateMerchant()` using the fresh token.
   * The returned `{ transactionId, token, documentName }` must be passed to the
   * `<btn-yappy>` web component via `btnyappy.eventPayment(params)`.
   *
   * @param params - Order details including amounts, orderId, and ipnUrl.
   * @param authToken - The token obtained from `validateMerchant()`.
   * @returns Checkout params for the `<btn-yappy>` web component.
   * @throws {Error} If order creation fails (duplicate orderId, invalid amounts, etc.)
   *
   * @example
   * ```typescript
   * const token = await yappy.validateMerchant()
   * const result = await yappy.createOrder({
   *   orderId: 'ABC123XYZ789012',
   *   ipnUrl: 'https://api.mystore.com/webhooks/yappy',
   *   total: '25.00',
   *   subtotal: '25.00',
   *   discount: '0.00',
   *   taxes: '0.00',
   * }, token)
   * ```
   */
  async createOrder(
    params: Omit<CreateOrderRequest, 'merchantId' | 'domain' | 'paymentDate'> & {
      paymentDate?: number
    },
    authToken: string,
  ): Promise<YappyCheckoutResult> {
    const body: CreateOrderRequest = {
      merchantId: this.config.merchantId,
      domain: this.config.urlDomain,
      paymentDate: params.paymentDate ?? Math.floor(Date.now() / 1000),
      orderId: params.orderId,
      ipnUrl: params.ipnUrl,
      discount: params.discount,
      taxes: params.taxes,
      subtotal: params.subtotal,
      total: params.total,
      ...(params.aliasYappy ? { aliasYappy: params.aliasYappy } : {}),
    }

    try {
      const response = await this.http.post<CreateOrderResponse>(
        '/payments/payment-wc',
        body,
        { headers: { Authorization: authToken } },
      )

      const { transactionId, token, documentName } = response.data.body ?? {}

      if (!transactionId || !token || !documentName) {
        throw new Error(
          `Yappy createOrder: incomplete response body. status=${response.data.status?.code} description=${response.data.status?.description}`,
        )
      }

      return { transactionId, token, documentName }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response) {
        const apiError = error.response.data as Partial<CreateOrderResponse>
        throw new Error(
          `Yappy createOrder failed [${apiError?.status?.code}]: ${apiError?.status?.description ?? error.message}`,
        )
      }
      throw error
    }
  }

  /**
   * Orchestrates the full checkout flow: validateMerchant + createOrder in one call.
   *
   * This is the recommended method for your checkout endpoint. It handles the
   * two-step Yappy authentication internally so you don't have to manage tokens.
   *
   * The orderId is auto-generated if not provided.
   *
   * @param params - Order details. `orderId` is optional — a random one is generated if omitted.
   * @returns `{ transactionId, token, documentName }` to pass to the web component,
   *          plus the `orderId` used (important: persist this to match against your webhook).
   *
   * @example
   * ```typescript
   * // Express checkout endpoint:
   * app.post('/api/checkout/yappy', async (req, res) => {
   *   const { total, subtotal, aliasYappy } = req.body
   *
   *   const result = await yappy.initCheckout({
   *     ipnUrl: `${process.env.BASE_URL}/webhooks/yappy`,
   *     total,
   *     subtotal,
   *     discount: '0.00',
   *     taxes: '0.00',
   *     aliasYappy,
   *   })
   *
   *   // IMPORTANT: Save result.orderId to your DB before responding.
   *   // Your IPN webhook will reference this orderId.
   *   await db.savePendingOrder({ orderId: result.orderId, ...result })
   *
   *   res.json(result)
   * })
   * ```
   */
  async initCheckout(
    params: Omit<CreateOrderRequest, 'merchantId' | 'domain' | 'paymentDate' | 'orderId'> & {
      orderId?: string
      paymentDate?: number
    },
  ): Promise<YappyCheckoutResult & { orderId: string }> {
    const orderId = params.orderId ?? generateOrderId()

    // Step 1: Get auth token
    const authToken = await this.validateMerchant()

    // Step 2: Create order using the fresh token
    const result = await this.createOrder(
      { ...params, orderId },
      authToken,
    )

    return { ...result, orderId }
  }
}
