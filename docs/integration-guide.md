# Integration Guide

Complete implementation examples for five common use cases.

---

## Use Case 1 — Minimal server checkout endpoint

The simplest backend implementation using `YappyClient.initCheckout()`.

```typescript
// Express.js
import { YappyClient, generateOrderId } from '@panama-payments/yappy/server'

const yappy = new YappyClient({
  merchantId: process.env.YAPPY_MERCHANT_ID!,
  urlDomain: process.env.YAPPY_URL_DOMAIN!,
  environment: 'production',
})

app.post('/api/yappy/checkout', async (req, res) => {
  const { total, subtotal, aliasYappy } = req.body

  const result = await yappy.initCheckout({
    ipnUrl: `${process.env.BASE_URL}/api/yappy/webhook`,
    total,
    subtotal,
    discount: '0.00',
    taxes: '0.00',
    ...(aliasYappy ? { aliasYappy } : {}),
  })

  // Always save before responding
  await db.yappyOrders.create({
    orderId: result.orderId,
    transactionId: result.transactionId,
    status: 'pending',
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  })

  res.json(result)
})
```

**curl test:**

```bash
curl -X POST http://localhost:3000/api/yappy/checkout \
  -H "Content-Type: application/json" \
  -d '{ "total": "10.00", "subtotal": "10.00" }'
```

Expected response:
```json
{
  "orderId": "ABC123DEF456789",
  "transactionId": "TXN-YAPPY-00001",
  "token": "eyJ...",
  "documentName": "DOC-00001",
  "expiresAt": "2026-01-01T12:05:00.000Z"
}
```

---

## Use Case 2 — IPN webhook handler

```typescript
import { validateYappyHash, parseYappyWebhook, YappyStatus } from '@panama-payments/yappy/server'

app.get('/api/yappy/webhook', async (req, res) => {
  // Step 1: Validate hash (prevents spoofed requests)
  const result = validateYappyHash(req.query as Record<string, string>, process.env.CLAVE_SECRETA!)
  if (!result.valid) {
    return res.status(400).json({ error: 'Invalid hash' })
  }

  // Step 2: Respond immediately
  res.status(200).json({ received: true })

  // Step 3: Process asynchronously
  const { orderId, status } = result

  const order = await db.yappyOrders.findOne({ where: { orderId } })
  if (!order || order.status !== 'pending') return // Idempotency

  if (status === YappyStatus.Executed) {
    await createRealOrder(order)
    await db.yappyOrders.update({ status: 'paid' }, { where: { orderId } })
  } else {
    const statusMap: Record<string, string> = {
      R: 'failed', C: 'cancelled', X: 'expired',
    }
    await db.yappyOrders.update({ status: statusMap[status] ?? 'failed' }, { where: { orderId } })
  }
})
```

---

## Use Case 3 — Official Web Component (React)

```tsx
import { YappyButton } from '@panama-payments/yappy/react'

function CheckoutPage({ cart }: { cart: Cart }) {
  return (
    <YappyButton
      checkoutEndpoint="/api/yappy/checkout"
      checkoutPayload={{
        total: cart.total,
        subtotal: cart.subtotal,
        taxes: cart.taxes,
        discount: cart.discount,
        cartId: cart.id,
      }}
      onSuccess={(detail) => {
        // detail = event.detail from the CDN component's eventSuccess event
        router.push('/checkout/success')
      }}
      onError={(detail) => {
        showToast('error', 'El pago no fue completado')
      }}
      theme="blue"
      environment="production"
      renderOffline={
        <p>Yappy no está disponible en este momento. Intenta más tarde.</p>
      }
    />
  )
}
```

**TypeScript declaration for `<btn-yappy>` (add to a `global.d.ts` file):**

```typescript
declare global {
  namespace JSX {
    interface IntrinsicElements {
      'btn-yappy': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement> & {
        theme?: string
        rounded?: string
        ref?: React.Ref<HTMLElement>
      }
    }
  }
}
```

---

## Use Case 4 — Custom polling flow (React)

Full custom flow with phone input, pending modal, and countdown timer:

```tsx
import {
  useYappyPendingCheck,
  YappyPhoneInput,
  YappyPendingModal,
} from '@panama-payments/yappy/react'

function YappyCheckout({ cart }: { cart: Cart }) {
  const {
    status,
    timeLeft,
    startPayment,
    cancelPayment,
    isLoading,
    error,
  } = useYappyPendingCheck({
    checkoutEndpoint: '/api/yappy/checkout',
    statusEndpoint: '/api/yappy/status',
    cancelEndpoint: '/api/yappy/cancel',
    onSuccess: ({ orderId, orderData }) => {
      router.push(`/checkout/success?orderId=${orderId}`)
    },
    onError: ({ status, message }) => {
      console.error('Yappy payment error:', status, message)
    },
    interval: 3000,      // poll every 3 seconds
    expiryMs: 300_000,   // 5 minutes (matches Yappy server-side)
  })

  return (
    <>
      {/* Phone input shown when idle */}
      {status === 'idle' && (
        <YappyPhoneInput
          onSubmit={(phone) => startPayment(phone, {
            total: cart.total,
            subtotal: cart.subtotal,
            taxes: cart.taxes,
            discount: cart.discount,
          })}
          disabled={isLoading}
        />
      )}

      {/* Error message from checkout initiation */}
      {error && <p role="alert">{error}</p>}

      {/* Pending modal (renders when status !== 'idle') */}
      <YappyPendingModal
        status={status}
        timeLeft={timeLeft}
        onCancel={cancelPayment}
      />
    </>
  )
}
```

---

## Use Case 5 — Next.js App Router (full stack)

**Frontend page** (`app/checkout/page.tsx`):

```tsx
'use client'
import { useYappyPendingCheck, YappyPhoneInput, YappyPendingModal } from '@panama-payments/yappy/react'
import { useRouter } from 'next/navigation'

export default function CheckoutPage() {
  const router = useRouter()
  const { status, timeLeft, startPayment, cancelPayment, isLoading } = useYappyPendingCheck({
    checkoutEndpoint: '/api/yappy/checkout',
    statusEndpoint: '/api/yappy/status',
    cancelEndpoint: '/api/yappy/cancel',
    onSuccess: ({ orderId }) => router.push(`/checkout/success?orderId=${orderId}`),
  })

  return (
    <main>
      <h1>Pago con Yappy</h1>
      {status === 'idle' && (
        <YappyPhoneInput
          onSubmit={(phone) => startPayment(phone, { total: '25.00', subtotal: '25.00', taxes: '0.00', discount: '0.00' })}
          disabled={isLoading}
        />
      )}
      <YappyPendingModal status={status} timeLeft={timeLeft} onCancel={cancelPayment} />
    </main>
  )
}
```

**Backend routes** — see `examples/nextjs/app/api/yappy/` for complete implementations of:
- `checkout/route.ts` — POST `/api/yappy/checkout`
- `webhook/route.ts` — GET `/api/yappy/webhook`
- `status/route.ts` — GET `/api/yappy/status/[orderId]`
- `cancel/route.ts` — POST `/api/yappy/cancel/[orderId]`

---

## Amount formatting

All monetary values are **strings** with two decimal places:

```typescript
// Correct
total: '25.00'
subtotal: '23.81'
taxes: '1.19'
discount: '0.00'

// Incorrect
total: 25        // number, not string
total: '25'      // missing decimal places
total: '25.000'  // too many decimal places
```

The Yappy API validates that `subtotal + taxes - discount === total` (approximately). Use `Number.toFixed(2)` when computing amounts from cart items.

---

## orderId constraints

- Exactly **15 alphanumeric characters** (no spaces, hyphens, or special chars)
- **Must be unique per transaction** — Yappy rejects duplicates with error E007
- Use `generateOrderId()` from the SDK to generate valid IDs automatically

```typescript
import { generateOrderId } from '@panama-payments/yappy/server'
const orderId = generateOrderId() // e.g. "A3KX9MZQ1BPRY7W"
```

---

## Error handling

Wrap all `YappyClient` calls in try/catch. The client throws descriptive errors:

```typescript
try {
  const result = await yappy.initCheckout({ ... })
} catch (error) {
  // error.message contains the Yappy error code and description
  // e.g. "Yappy createOrder failed [E007]: El pedido ya ha sido registrado."
  console.error(error.message)
}
```

See [api-reference.md](./api-reference.md) for error code documentation.
