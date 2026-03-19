/**
 * @module yappy-sdk/server/webhook
 * @description Utilities for validating and parsing Yappy IPN webhook requests.
 *
 * Yappy notifies your server of payment results via HTTP GET requests to the
 * `ipnUrl` you specified in `createOrder()`. Always validate the hash before
 * processing to prevent spoofed webhook calls.
 */

import crypto from 'crypto'
import { YappyStatus, YappyWebhookPayload, YappyWebhookResult } from '../types'

// ============================================================================
// HASH VALIDATION
// ============================================================================

/**
 * Validates the HMAC-SHA256 hash from a Yappy IPN webhook request.
 *
 * Hash algorithm (from official Banco General documentation):
 * 1. Base64-decode your `CLAVE_SECRETA`
 * 2. Split the decoded string on `.` and take the first part as the key
 * 3. Compute HMAC-SHA256 of `orderId + status + domain` using that key
 * 4. Compare (hex) against the `hash` query param from Yappy
 *
 * @param query - The parsed query string object from the webhook GET request.
 * @param secretKey - Your `CLAVE_SECRETA` environment variable (base64-encoded string from Yappy Comercial).
 * @returns `YappyWebhookResult` with `valid: true` if the hash matches, `valid: false` otherwise.
 *
 * @example
 * ```typescript
 * // Express.js:
 * app.get('/webhooks/yappy', (req, res) => {
 *   const result = validateYappyHash(req.query as Record<string, string>, process.env.CLAVE_SECRETA!)
 *
 *   if (!result.valid) {
 *     // Log and reject — could be a spoofed request
 *     return res.status(400).json({ error: 'Invalid hash' })
 *   }
 *
 *   if (result.status === YappyStatus.Executed) {
 *     await fulfillOrder(result.orderId)
 *   }
 *
 *   res.status(200).json({ received: true })
 * })
 * ```
 */
export function validateYappyHash(
  query: Record<string, string>,
  secretKey: string,
): YappyWebhookResult {
  const { orderId, status, hash, domain } = query

  // Build the result object first (we'll set valid after checking)
  const result: YappyWebhookResult = {
    valid: false,
    status: status as YappyStatus,
    orderId: orderId ?? '',
    domain: domain ?? '',
  }

  if (!orderId || !status || !hash || !domain) {
    return result
  }

  try {
    // Step 1: decode the base64 secret
    const decoded = Buffer.from(secretKey, 'base64').toString('utf-8')

    // Step 2: take the first part before the first '.'
    const keyPart = decoded.split('.')[0]

    // Step 3: compute HMAC-SHA256 over the concatenated string
    const message = orderId + status + domain
    const computedHash = crypto
      .createHmac('sha256', keyPart)
      .update(message)
      .digest('hex')

    // Step 4: constant-time comparison to prevent timing attacks
    const hashBuffer = Buffer.from(hash, 'hex')
    const computedBuffer = Buffer.from(computedHash, 'hex')

    const isValid =
      hashBuffer.length === computedBuffer.length &&
      crypto.timingSafeEqual(hashBuffer, computedBuffer)

    return { ...result, valid: isValid }
  } catch {
    // If any step fails (e.g., invalid base64), treat as invalid
    return result
  }
}

// ============================================================================
// PAYLOAD PARSING
// ============================================================================

/**
 * Parses and types the raw query string from a Yappy IPN webhook GET request.
 *
 * Converts the `status` string (e.g., `"E"`) to the `YappyStatus` enum.
 * Does NOT validate the hash — call `validateYappyHash()` separately.
 *
 * @param query - The raw query string object (e.g., `req.query` in Express).
 * @returns `YappyWebhookPayload` with typed fields.
 * @throws {Error} If required fields (`orderId`, `status`, `hash`, `domain`) are missing.
 *
 * @example
 * ```typescript
 * // Express.js:
 * app.get('/webhooks/yappy', (req, res) => {
 *   const payload = parseYappyWebhook(req.query as Record<string, string>)
 *   // payload.status is now typed as YappyStatus
 * })
 * ```
 */
export function parseYappyWebhook(query: Record<string, string>): YappyWebhookPayload {
  const { orderId, status, hash, domain } = query

  if (!orderId) throw new Error('Yappy webhook: missing required field "orderId"')
  if (!status) throw new Error('Yappy webhook: missing required field "status"')
  if (!hash) throw new Error('Yappy webhook: missing required field "hash"')
  if (!domain) throw new Error('Yappy webhook: missing required field "domain"')

  // Validate that status is a known YappyStatus value
  const validStatuses = Object.values(YappyStatus) as string[]
  if (!validStatuses.includes(status)) {
    throw new Error(
      `Yappy webhook: unknown status "${status}". Expected one of: ${validStatuses.join(', ')}`,
    )
  }

  return {
    orderId,
    status: status as YappyStatus,
    hash,
    domain,
  }
}
