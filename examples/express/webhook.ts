/**
 * Express.js example — Yappy IPN webhook handler
 *
 * Yappy calls this endpoint via HTTP GET when a payment result is available.
 * The URL must match the `ipnUrl` you passed to createOrder / initCheckout.
 *
 * Request format:
 * GET /api/yappy/webhook?orderId=ABC123&status=E&hash=<hmac>&domain=yourdomain.com
 *
 * Status values:
 *   E = Ejecutado (payment confirmed)
 *   R = Rechazado (customer rejected)
 *   C = Cancelado (customer cancelled)
 *   X = Expirado  (5-minute window expired without confirmation)
 *
 * Hash validation:
 * Always validate the hash before processing. An invalid hash means the
 * request did NOT come from Yappy and should be rejected.
 */

import express, { Request, Response } from 'express'
import { validateYappyHash, parseYappyWebhook, YappyStatus } from 'yappy-sdk/server'

const router = express.Router()

/**
 * GET /api/yappy/webhook
 *
 * Yappy sends GET (not POST) for IPN webhooks — this is by design.
 * Always return HTTP 200 quickly; do heavy processing asynchronously.
 */
router.get('/api/yappy/webhook', async (req: Request, res: Response) => {
  const query = req.query as Record<string, string>

  // Step 1: Validate the HMAC hash to confirm this is a genuine Yappy request.
  // CLAVE_SECRETA is your base64-encoded secret from Yappy Comercial.
  const result = validateYappyHash(query, process.env.CLAVE_SECRETA!)

  if (!result.valid) {
    console.warn('[yappy/webhook] Invalid hash — rejecting request', { query })
    // Return 400 to signal to Yappy that something is wrong.
    // Yappy may retry — ensure your secret key is correct.
    res.status(400).json({ error: 'Invalid hash' })
    return
  }

  // Step 2: Parse the typed payload
  let payload
  try {
    payload = parseYappyWebhook(query)
  } catch (err: unknown) {
    console.error('[yappy/webhook] Parse error:', err)
    res.status(400).json({ error: 'Invalid webhook payload' })
    return
  }

  const { orderId, status } = payload

  // Step 3: Respond immediately (Yappy expects a fast HTTP 200)
  res.status(200).json({ received: true })

  // Step 4: Process the payment result asynchronously
  // Fetch the pending order from your DB using the orderId
  try {
    const pendingOrder = await findOrderById(orderId)

    if (!pendingOrder) {
      console.error('[yappy/webhook] Order not found:', orderId)
      return
    }

    // Idempotency: skip if already processed
    if (pendingOrder.status !== 'pending') {
      console.info('[yappy/webhook] Order already processed:', { orderId, status: pendingOrder.status })
      return
    }

    switch (status) {
      case YappyStatus.Executed:
        // Payment confirmed — fulfill the order
        await fulfillOrder(orderId)
        await updateOrderStatus(orderId, 'paid')
        console.info('[yappy/webhook] Payment successful:', orderId)
        break

      case YappyStatus.Rejected:
        await updateOrderStatus(orderId, 'failed', 'Pago rechazado por el usuario')
        console.info('[yappy/webhook] Payment rejected:', orderId)
        break

      case YappyStatus.Cancelled:
        await updateOrderStatus(orderId, 'cancelled', 'Pago cancelado por el usuario')
        console.info('[yappy/webhook] Payment cancelled:', orderId)
        break

      case YappyStatus.Expired:
        await updateOrderStatus(orderId, 'expired', 'Tiempo de pago expirado')
        console.info('[yappy/webhook] Payment expired:', orderId)
        break

      default:
        console.warn('[yappy/webhook] Unknown status:', status)
    }
  } catch (error: unknown) {
    // Log but don't throw — the HTTP response was already sent
    console.error('[yappy/webhook] Processing error:', error)
  }
})

export default router

// ---- Database stubs (replace with your actual ORM) ----

async function findOrderById(orderId: string) {
  // Example: return await db.yappyOrders.findOne({ where: { orderId } })
  console.log('[yappy] Finding order:', orderId)
  return { status: 'pending', orderId }
}

async function updateOrderStatus(orderId: string, status: string, errorMessage?: string) {
  // Example: await db.yappyOrders.update({ status, errorMessage }, { where: { orderId } })
  console.log('[yappy] Updating order status:', { orderId, status, errorMessage })
}

async function fulfillOrder(orderId: string) {
  // Your business logic: create the actual order, send confirmation email, etc.
  console.log('[yappy] Fulfilling order:', orderId)
}
