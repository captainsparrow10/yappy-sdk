/**
 * Next.js App Router — POST /api/yappy/cancel/[orderId]
 *
 * Marks a pending Yappy order as cancelled (user-initiated).
 * Called by useYappyPendingCheck when the user presses "Cancel".
 */

import { NextRequest, NextResponse } from 'next/server'

interface RouteContext {
  params: Promise<{ orderId: string }>
}

export async function POST(_request: NextRequest, context: RouteContext) {
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

    if (order.status === 'pending') {
      // Replace with: await prisma.yappyOrder.update({ where: { orderId }, data: { status: 'cancelled' } })
      await updateOrderStatus(orderId, 'cancelled', 'Cancelado por el usuario')
    }

    return NextResponse.json({ message: 'Order cancelled' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to cancel order'
    return NextResponse.json({ message }, { status: 500 })
  }
}

// ── Database stubs ────────────────────────────────────────────────────────────

async function findOrderById(orderId: string) {
  console.log('[yappy] Finding order:', orderId)
  return { orderId, status: 'pending' as string }
}

async function updateOrderStatus(orderId: string, status: string, reason?: string) {
  console.log('[yappy] Cancelling order:', { orderId, status, reason })
}
