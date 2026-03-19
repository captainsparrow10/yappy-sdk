/**
 * Next.js App Router — GET /api/yappy/status/[orderId]
 *
 * Returns the current status of a pending Yappy order.
 * Polled by useYappyOrderStatus and useYappyPendingCheck hooks on the client.
 */

import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ orderId: string }>
}

export async function GET(_request: NextRequest, context: RouteContext) {
  try {
    const { orderId } = await context.params

    if (!orderId) {
      return NextResponse.json({ message: 'orderId is required' }, { status: 400 })
    }

    // Replace with: const order = await prisma.yappyOrder.findUnique({ where: { orderId } })
    const order = await findOrderById(orderId)

    if (!order) {
      return NextResponse.json({ message: 'Order not found' }, { status: 404 })
    }

    // Auto-expire if still pending and past the expiresAt timestamp
    if (order.status === 'pending' && order.expiresAt && new Date() > new Date(order.expiresAt)) {
      order.status = 'expired'
      // Replace with: await prisma.yappyOrder.update({ where: { orderId }, data: { status: 'expired' } })
    }

    return NextResponse.json({
      status: order.status,
      errorMessage: order.errorMessage ?? null,
      order: order.status === 'paid' ? order.orderData : null,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch order status'
    return NextResponse.json({ message }, { status: 500 })
  }
}

// ── Database stub ─────────────────────────────────────────────────────────────

async function findOrderById(orderId: string) {
  // Example: return await prisma.yappyOrder.findUnique({ where: { orderId } })
  console.log('[yappy] Finding order:', orderId)
  return {
    orderId,
    status: 'pending' as string,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
    errorMessage: null as string | null,
    orderData: null as unknown,
  }
}
