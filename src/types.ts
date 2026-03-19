/**
 * @module yappy-sdk/types
 * @description Core TypeScript types and enums for the Yappy SDK.
 * All types are derived from the official Banco General Yappy API documentation.
 */

// ============================================================================
// ENUMS
// ============================================================================

/**
 * Payment status codes returned by Yappy via the IPN webhook.
 *
 * Yappy delivers these as single-character strings in the `status` query param
 * of GET requests to your ipnUrl endpoint.
 *
 * @example
 * // In your webhook handler:
 * if (status === YappyStatus.Executed) { fulfillOrder() }
 */
export enum YappyStatus {
  /** Pago ejecutado exitosamente — the customer confirmed payment in the Yappy app. */
  Executed = 'E',
  /** Pago rechazado — the customer rejected or did not confirm in time. */
  Rejected = 'R',
  /** Pago cancelado — the customer actively cancelled the transaction. */
  Cancelled = 'C',
  /** Pago expirado — the 5-minute window elapsed without confirmation. */
  Expired = 'X',
}

/**
 * Visual themes available for the `<btn-yappy>` web component.
 *
 * Pass the string value (not the enum key) as the `theme` attribute on the element.
 * @example
 * // React (via ref):
 * btnRef.current?.setAttribute('theme', YappyButtonTheme.Blue)
 *
 * // HTML:
 * <btn-yappy theme="blue"></btn-yappy>
 */
export enum YappyButtonTheme {
  Blue = 'blue',
  DarkBlue = 'darkBlue',
  Orange = 'orange',
  Dark = 'dark',
  Sky = 'sky',
  Light = 'light',
}

/**
 * Error codes returned by the Yappy API in `status.code`.
 *
 * Use these to present user-friendly messages in your UI.
 */
export enum YappyErrorCode {
  /** Algo salió mal. Intenta nuevamente. */
  E002 = 'E002',
  /** Este número no está registrado en Yappy. */
  E005 = 'E005',
  /** Algo salió mal. Intenta nuevamente. */
  E006 = 'E006',
  /** El pedido ya ha sido registrado. The orderId was already used — generate a new one. */
  E007 = 'E007',
  /** Algo salió mal. Intenta nuevamente. */
  E008 = 'E008',
  /** ID de la orden mayor a 15 dígitos. Ensure orderId is max 15 alphanumeric chars. */
  E009 = 'E009',
  /** El valor de los montos no es el correcto. Check discount+taxes+subtotal=total. */
  E010 = 'E010',
  /** Error en los campos de URL. Validate domain and ipnUrl formats. */
  E011 = 'E011',
  /** Algo salió mal. Intenta nuevamente. */
  E012 = 'E012',
  /** Bad Request. A required field is missing or malformed. */
  E100 = 'E100',
}

/**
 * Human-readable messages keyed by YappyErrorCode.
 * Use this to display friendly errors without a switch statement.
 *
 * @example
 * const message = YAPPY_ERROR_MESSAGES[code] ?? 'Error desconocido. Intenta nuevamente.'
 */
export const YAPPY_ERROR_MESSAGES: Record<YappyErrorCode, string> = {
  [YappyErrorCode.E002]: 'Algo salió mal. Intenta nuevamente.',
  [YappyErrorCode.E005]: 'Este número no está registrado en Yappy.',
  [YappyErrorCode.E006]: 'Algo salió mal. Intenta nuevamente.',
  [YappyErrorCode.E007]: 'El pedido ya ha sido registrado.',
  [YappyErrorCode.E008]: 'Algo salió mal. Intenta nuevamente.',
  [YappyErrorCode.E009]: 'ID de la orden mayor a 15 dígitos.',
  [YappyErrorCode.E010]: 'El valor de los montos no es el correcto.',
  [YappyErrorCode.E011]: 'Error en los campos de URL.',
  [YappyErrorCode.E012]: 'Algo salió mal. Intenta nuevamente.',
  [YappyErrorCode.E100]: 'Solicitud inválida. Verifica los datos enviados.',
}

// ============================================================================
// API REQUEST / RESPONSE TYPES
// ============================================================================

/**
 * Request body for Step 1: Validate Merchant.
 *
 * @see POST /payments/validate/merchant
 */
export interface ValidateMerchantRequest {
  /** Your merchant ID obtained from Yappy Comercial. Maps to `YAPPY_MERCHANT_ID`. */
  merchantId: string
  /** The URL domain you registered in Yappy Comercial. Maps to `YAPPY_URL_DOMAIN`. */
  urlDomain: string
}

/**
 * Response from Step 1: Validate Merchant.
 * The `body.token` must be passed as the `Authorization` header in Step 2.
 * Tokens are short-lived — always call validateMerchant immediately before createOrder.
 */
export interface ValidateMerchantResponse {
  status: {
    /** Yappy status code (e.g., "00" for success). */
    code: string
    /** Human-readable description of the status. */
    description: string
  }
  body: {
    /** Unix epoch timestamp from Yappy server. */
    epochTime: number
    /**
     * Short-lived authorization token.
     * Pass this as `Authorization: <token>` in the createOrder request.
     * Do NOT store or reuse across requests.
     */
    token: string
  }
}

/**
 * Request body for Step 2: Create Payment Order.
 *
 * @see POST /payments/payment-wc
 *
 * Important constraints:
 * - `orderId` must be alphanumeric, max 15 characters, and UNIQUE per transaction.
 * - `total` must be at least "0.01".
 * - All monetary values must be string representations with 2 decimal places (e.g., "12.50").
 * - `discount + taxes + subtotal` should logically equal `total` (Yappy validates this).
 */
export interface CreateOrderRequest {
  /** Your Yappy merchant ID. */
  merchantId: string
  /**
   * Unique alphanumeric order identifier, max 15 characters.
   * Yappy will reject duplicate orderIds with error E007.
   * Generate a random ID per transaction.
   */
  orderId: string
  /** The domain URL registered in Yappy Comercial (must match your registration). */
  domain: string
  /** Unix epoch timestamp of the payment, in seconds. Use `Math.floor(Date.now() / 1000)`. */
  paymentDate: number
  /**
   * The customer's Panamanian phone number registered in Yappy, without country code.
   * Format: 8 digits starting with 6 or 7 (e.g., "60800011").
   * Optional — if omitted, the web component shows a QR code instead.
   */
  aliasYappy?: string
  /**
   * Your webhook endpoint URL. Yappy will send GET requests here with the payment result.
   * Must be a publicly accessible URL (not localhost).
   * @example "https://api.mystore.com/webhooks/yappy"
   */
  ipnUrl: string
  /** Discount amount as string with 2 decimal places. Use "0.00" if none. */
  discount: string
  /** Taxes amount as string with 2 decimal places. Use "0.00" if none. */
  taxes: string
  /** Subtotal before taxes as string with 2 decimal places. */
  subtotal: string
  /** Total amount. Minimum "0.01". Must be consistent with discount+taxes+subtotal. */
  total: string
}

/**
 * Response from Step 2: Create Payment Order.
 * Pass all three fields in `body` to the `<btn-yappy>` web component via `eventPayment()`.
 */
export interface CreateOrderResponse {
  status: {
    /** Yappy status code. */
    code: string
    /** Human-readable description. */
    description: string
  }
  body: {
    /** Yappy-assigned transaction identifier. Store this for your records. */
    transactionId: string
    /** Token for the web component. Pass to `btnyappy.eventPayment()`. */
    token: string
    /** Document name for the web component. Pass to `btnyappy.eventPayment()`. */
    documentName: string
  }
}

/**
 * Combined result from `YappyClient.initCheckout()`.
 * Contains everything needed to activate the `<btn-yappy>` web component.
 */
export interface YappyCheckoutResult {
  /** Yappy transaction ID. Persist this to match against your IPN webhook. */
  transactionId: string
  /** Token for the web component `eventPayment()` call. */
  token: string
  /** Document name for the web component `eventPayment()` call. */
  documentName: string
}

// ============================================================================
// WEBHOOK TYPES
// ============================================================================

/**
 * Raw query parameters received in the Yappy IPN webhook GET request.
 *
 * Yappy sends: `GET /your-webhook?orderId=X&status=E&hash=ABC&domain=Y`
 *
 * Always validate the `hash` before processing the payment to prevent spoofing.
 */
export interface YappyWebhookPayload {
  /** The orderId you sent in createOrder — your internal order reference. */
  orderId: string
  /** Payment status: E=Executed, R=Rejected, C=Cancelled, X=Expired. */
  status: YappyStatus
  /**
   * HMAC-SHA256 hash for authenticity verification.
   * Computed by Yappy as: HMAC-SHA256(orderId + status + domain, secretKeyBytes)
   * where secretKeyBytes = base64decode(CLAVE_SECRETA).split('.')[0]
   */
  hash: string
  /** The domain you registered — included in hash computation. */
  domain: string
}

/**
 * Result returned by `validateYappyHash()` after verifying the IPN webhook.
 */
export interface YappyWebhookResult {
  /** Whether the hash is valid. Reject the request if false. */
  valid: boolean
  /** Payment status from Yappy. */
  status: YappyStatus
  /** Your order identifier. */
  orderId: string
  /** The domain from the webhook. */
  domain: string
}

// ============================================================================
// CLIENT CONFIG
// ============================================================================

/**
 * Configuration for YappyClient.
 *
 * @example
 * const client = new YappyClient({
 *   merchantId: process.env.YAPPY_MERCHANT_ID!,
 *   urlDomain: process.env.YAPPY_URL_DOMAIN!,
 *   environment: 'production',
 * })
 */
export interface YappyClientConfig {
  /** Your Yappy merchant ID from Yappy Comercial. */
  merchantId: string
  /** The URL domain you registered in Yappy Comercial. */
  urlDomain: string
  /**
   * API environment to use.
   * - 'production': https://apipagosbg.bgeneral.cloud
   * - 'sandbox': https://api-comecom-uat.yappycloud.com
   *
   * Defaults to 'production'. Use 'sandbox' for development and testing.
   */
  environment?: 'production' | 'sandbox'
}

// ============================================================================
// BUTTON / FRONTEND CONFIG
// ============================================================================

/**
 * Configuration for the Yappy button integration (frontend hooks and vanilla JS).
 */
export interface YappyButtonConfig {
  /**
   * Your backend endpoint URL that initiates the Yappy checkout.
   * This must be a POST endpoint that calls YappyClient.initCheckout() and
   * returns `{ transactionId, token, documentName }`.
   *
   * NEVER call the Yappy API directly from the browser — your credentials would be exposed.
   */
  checkoutEndpoint: string
  /** Visual theme for the `<btn-yappy>` web component. Defaults to 'blue'. */
  theme?: YappyButtonTheme
  /** Whether the button should have rounded corners. Defaults to true. */
  rounded?: boolean
}

/**
 * Parameters passed to the `<btn-yappy>` web component's `eventPayment()` method
 * after a successful checkout initiation.
 */
export interface YappyPaymentParams {
  /** Yappy transaction ID from createOrder response. */
  transactionId: string
  /** Token from createOrder response. */
  token: string
  /** Document name from createOrder response. */
  documentName: string
}
