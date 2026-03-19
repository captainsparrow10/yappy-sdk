/**
 * Next.js App Router — POST /api/yappy/checkout
 *
 * Initiates a Yappy payment by calling the Yappy API (server-side only).
 * Called by useYappyCheckout / useYappyPendingCheck hooks from the client,
 * and also by the <btn-yappy> web component's eventClick handler via useYappyWebComponent.
 *
 * Environment variables required:
 *   YAPPY_MERCHANT_ID   — From Yappy Comercial
 *   YAPPY_URL_DOMAIN    — Your registered domain (e.g. 'mystore.com')
 *   YAPPY_ENVIRONMENT   — 'production' or 'sandbox'
 *   NEXT_PUBLIC_BASE_URL or BASE_URL — Your app's public URL
 */

import { NextRequest, NextResponse } from 'next/server'
import { YappyClient, generateOrderId } from '@panama-payments/yappy/server'

// Initialize YappyClient once (module scope — Next.js reuses this across requests)
const yappy = new YappyClient({
  merchantId: process.env.YAPPY_MERCHANT_ID!,
  urlDomain: process.env.YAPPY_URL_DOMAIN!,
  environment: (process.env.YAPPY_ENVIRONMENT as 'production' | 'sandbox') ?? 'production',
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      total?: string
      subtotal?: string
      taxes?: string
      discount?: string
      aliasYappy?: string
    }

    const { total, subtotal, taxes, discount, aliasYappy } = body

    // Validate total
    if (!total || isNaN(parseFloat(total)) || parseFloat(total) < 0.01) {
      return NextResponse.json(
        { message: 'Invalid or missing "total". Must be >= 0.01.' },
        { status: 400 },
      )
    }

    // Determine the IPN webhook URL
    const baseUrl = process.env.BASE_URL ?? process.env.NEXT_PUBLIC_BASE_URL ?? ''
    if (!baseUrl) {
      return NextResponse.json(
        { message: 'Server misconfiguration: BASE_URL is not set.' },
        { status: 500 },
      )
    }

    // Initiate checkout — validates merchant and creates the Yappy order in one call
    const result = await yappy.initCheckout({
      ipnUrl: `${baseUrl}/api/yappy/webhook`,
      total,
      subtotal: subtotal ?? total,
      taxes: taxes ?? '0.00',
      discount: discount ?? '0.00',
      ...(aliasYappy ? { aliasYappy } : {}),
    })

    // IMPORTANT: Save the pending order to your database before responding.
    // Your webhook handler references result.orderId — it must exist in the DB
    // when the webhook fires (which can happen within seconds of this call).
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    await savePendingOrder({
      orderId: result.orderId,
      transactionId: result.transactionId,
      total,
      expiresAt,
    })

    return NextResponse.json({
      orderId: result.orderId,
      transactionId: result.transactionId,
      token: result.token,
      documentName: result.documentName,
      expiresAt,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to initiate Yappy payment'
    console.error('[yappy/checkout]', error)
    return NextResponse.json({ message }, { status: 500 })
  }
}

// ── Database stub ─────────────────────────────────────────────────────────────
// Replace with your actual ORM (Prisma, Drizzle, Sequelize, etc.)

async function savePendingOrder(data: {
  orderId: string
  transactionId: string
  total: string
  expiresAt: string
}) {
  // Example with Prisma:
  // await prisma.yappyOrder.create({
  //   data: { ...data, status: 'pending' },
  // })
  console.log('[yappy] Saving pending order:', data)
}
