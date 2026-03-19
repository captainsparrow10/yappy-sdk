/**
 * Express.js example — Yappy checkout endpoint
 *
 * This endpoint is called by the frontend (either by the `<btn-yappy>` web component
 * event handler or by useYappyCheckout) to initiate a Yappy payment.
 *
 * WHY THIS MUST BE ON THE SERVER:
 * - YAPPY_MERCHANT_ID and YAPPY_URL_DOMAIN are your credentials.
 * - If exposed to the browser, anyone could create Yappy orders on your behalf.
 * - The Yappy API enforces CORS, so direct browser calls would fail anyway.
 * - Your `ipnUrl` (webhook) is also only known server-side.
 */

import express, { Request, Response } from 'express'
import { YappyClient, generateOrderId } from 'yappy-sdk/server'

const router = express.Router()

// Initialize YappyClient once (reuse across requests)
const yappy = new YappyClient({
  merchantId: process.env.YAPPY_MERCHANT_ID!,
  urlDomain: process.env.YAPPY_URL_DOMAIN!,
  environment: (process.env.YAPPY_ENVIRONMENT as 'production' | 'sandbox') ?? 'production',
})

/**
 * POST /api/yappy/checkout
 *
 * Request body:
 * {
 *   total: string        // e.g. "25.00"
 *   subtotal: string     // e.g. "25.00"
 *   aliasYappy?: string  // customer's phone, e.g. "60800011" (optional)
 *   cartId?: string      // your internal reference (optional)
 * }
 *
 * Response:
 * {
 *   transactionId: string
 *   token: string
 *   documentName: string
 *   orderId: string      // IMPORTANT: persist this to match against the webhook
 *   expiresAt: string    // ISO timestamp, 5 minutes from now
 * }
 */
router.post('/api/yappy/checkout', async (req: Request, res: Response) => {
  try {
    const { total, subtotal, aliasYappy, cartId } = req.body as {
      total?: string
      subtotal?: string
      aliasYappy?: string
      cartId?: string
    }

    // Validate required fields
    if (!total || isNaN(parseFloat(total)) || parseFloat(total) < 0.01) {
      res.status(400).json({ message: 'Invalid total amount. Minimum is 0.01.' })
      return
    }

    // initCheckout orchestrates validateMerchant + createOrder internally.
    // It auto-generates an orderId if not provided.
    const result = await yappy.initCheckout({
      ipnUrl: `${process.env.BASE_URL}/api/yappy/webhook`,
      total,
      subtotal: subtotal ?? total,
      discount: '0.00',
      taxes: '0.00',
      ...(aliasYappy ? { aliasYappy } : {}),
    })

    // CRITICAL: Persist the pending order to your database BEFORE responding.
    // When the IPN webhook fires, it references result.orderId.
    // If you don't save it now, you won't be able to match the webhook to an order.
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()
    await savePendingOrderToDatabase({
      orderId: result.orderId,
      transactionId: result.transactionId,
      total,
      cartId,
      expiresAt,
      status: 'pending',
    })

    res.json({
      transactionId: result.transactionId,
      token: result.token,
      documentName: result.documentName,
      orderId: result.orderId,
      expiresAt,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al procesar pago con Yappy'
    console.error('[yappy] checkout error:', error)
    res.status(500).json({ message })
  }
})

export default router

// ---- Database stub (replace with your actual ORM) ----

async function savePendingOrderToDatabase(data: {
  orderId: string
  transactionId: string
  total: string
  cartId?: string
  expiresAt: string
  status: string
}) {
  // Example with a hypothetical ORM:
  // await db.yappyOrders.create({ data })
  console.log('[yappy] Saving pending order:', data)
}
