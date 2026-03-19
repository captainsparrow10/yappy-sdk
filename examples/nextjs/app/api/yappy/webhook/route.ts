/**
 * Next.js App Router — GET /api/yappy/webhook
 *
 * Receives Yappy IPN (Instant Payment Notification) callbacks.
 * Yappy calls this URL via HTTP GET when a payment result is available.
 *
 * The URL must match the `ipnUrl` passed to createOrder / initCheckout.
 * This route must be publicly accessible (not behind auth middleware).
 *
 * Environment variables required:
 *   CLAVE_SECRETA — Your base64-encoded secret from Yappy Comercial
 *                   (Métodos de cobro → Botón de Pago Yappy → Generar clave secreta)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateYappyHash, parseYappyWebhook, YappyStatus } from '@panama-payments/yappy/server'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const query = Object.fromEntries(searchParams.entries())

  // ── Step 1: Validate the HMAC hash ────────────────────────────────────────
  // This verifies the request genuinely came from Yappy.
  // Reject any request with an invalid hash — it may be a spoofed attack.
  const secretKey = process.env.CLAVE_SECRETA
  if (!secretKey) {
    console.error('[yappy/webhook] CLAVE_SECRETA is not configured')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }

  const result = validateYappyHash(query, secretKey)

  if (!result.valid) {
    console.warn('[yappy/webhook] Invalid hash — possible spoofed request', {
      orderId: query.orderId,
      status: query.status,
    })
    return NextResponse.json({ error: 'Invalid hash' }, { status: 400 })
  }

  // ── Step 2: Parse the typed payload ───────────────────────────────────────
  let payload
  try {
    payload = parseYappyWebhook(query)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Parse error'
    console.error('[yappy/webhook] Payload parse failed:', msg)
    return NextResponse.json({ error: msg }, { status: 400 })
  }

  const { orderId, status } = payload

  // ── Step 3: Respond immediately ───────────────────────────────────────────
  // Yappy expects a fast HTTP 200. Do NOT delay the response for DB writes.
  // Use waitUntil() (Vercel/Cloudflare) or fire-and-forget for async processing.
  processPaymentAsync(orderId, status).catch((err) => {
    console.error('[yappy/webhook] Async processing failed:', err)
  })

  return NextResponse.json({ received: true }, { status: 200 })
}

// ── Async payment processing ──────────────────────────────────────────────────

async function processPaymentAsync(orderId: string, status: YappyStatus): Promise<void> {
  const order = await findOrderById(orderId)

  if (!order) {
    console.error('[yappy/webhook] Order not found:', orderId)
    return
  }

  // Idempotency guard: skip if already processed
  if (order.status !== 'pending') {
    console.info('[yappy/webhook] Already processed:', { orderId, status: order.status })
    return
  }

  switch (status) {
    case YappyStatus.Executed:
      // Payment confirmed — create the real order and mark as paid
      await fulfillOrder(orderId)
      await updateOrderStatus(orderId, 'paid')
      console.info('[yappy/webhook] Payment fulfilled:', orderId)
      break

    case YappyStatus.Rejected:
      await updateOrderStatus(orderId, 'failed', 'Pago rechazado — no confirmado en Yappy')
      console.info('[yappy/webhook] Payment rejected:', orderId)
      break

    case YappyStatus.Cancelled:
      await updateOrderStatus(orderId, 'cancelled', 'Pago cancelado por el usuario')
      console.info('[yappy/webhook] Payment cancelled:', orderId)
      break

    case YappyStatus.Expired:
      await updateOrderStatus(orderId, 'expired', 'Tiempo de confirmación expirado')
      console.info('[yappy/webhook] Payment expired:', orderId)
      break

    default:
      console.warn('[yappy/webhook] Unknown status received:', status)
  }
}

// ── Database stubs ────────────────────────────────────────────────────────────
// Replace with your actual ORM (Prisma, Drizzle, etc.)

async function findOrderById(orderId: string) {
  // Example: return await prisma.yappyOrder.findUnique({ where: { orderId } })
  console.log('[yappy] Finding order:', orderId)
  return { orderId, status: 'pending' }
}

async function updateOrderStatus(orderId: string, status: string, errorMessage?: string) {
  // Example: await prisma.yappyOrder.update({ where: { orderId }, data: { status, errorMessage } })
  console.log('[yappy] Updating order:', { orderId, status, errorMessage })
}

async function fulfillOrder(orderId: string) {
  // Create the real order in your system, send confirmation email, etc.
  console.log('[yappy] Fulfilling order:', orderId)
}
