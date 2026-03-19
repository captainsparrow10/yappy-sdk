# @panama-payments/yappy

[![npm version](https://img.shields.io/npm/v/@panama-payments/yappy.svg)](https://www.npmjs.com/package/@panama-payments/yappy)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)

SDK for [Yappy](https://bgeneral.com/yappy) (Banco General) mobile payment integration in Panama.

Supports both integration approaches:
- **Official Web Component** — Drop-in `<btn-yappy>` CDN button with Banco General branding
- **Custom Flow** — Headless hooks for fully custom payment UIs

---

## Installation

```bash
npm install @panama-payments/yappy
# or
bun add @panama-payments/yappy
# or
pnpm add @panama-payments/yappy
```

---

## Quick Start

### Server — initiate a payment

```typescript
import { YappyClient } from '@panama-payments/yappy/server'

const yappy = new YappyClient({
  merchantId: process.env.YAPPY_MERCHANT_ID!,
  urlDomain: process.env.YAPPY_URL_DOMAIN!,
  environment: 'production',
})

// In your checkout endpoint:
const result = await yappy.initCheckout({
  ipnUrl: 'https://api.mystore.com/webhooks/yappy',
  total: '25.00',
  subtotal: '25.00',
  discount: '0.00',
  taxes: '0.00',
  aliasYappy: '60800011', // optional: customer's Yappy phone
})

// result.orderId    — persist this before responding
// result.transactionId, result.token, result.documentName
//   → pass to the <btn-yappy> web component
```

### Server — validate an IPN webhook

```typescript
import { validateYappyHash, YappyStatus } from '@panama-payments/yappy/server'

// Yappy sends GET /webhooks/yappy?orderId=X&status=E&hash=...&domain=Y
app.get('/webhooks/yappy', async (req, res) => {
  const result = validateYappyHash(req.query as Record<string, string>, process.env.CLAVE_SECRETA!)

  if (!result.valid) return res.status(400).json({ error: 'Invalid hash' })

  res.status(200).json({ received: true })

  if (result.status === YappyStatus.Executed) {
    await fulfillOrder(result.orderId)
  }
})
```

---

## Approach A — Official Web Component (React)

The `<btn-yappy>` custom element is provided by Banco General's CDN. It handles the payment UI natively.

```tsx
import { YappyButton } from '@panama-payments/yappy/react'

function CheckoutPage() {
  return (
    <YappyButton
      checkoutEndpoint="/api/yappy/checkout"
      checkoutPayload={{ total: '25.00', subtotal: '25.00', taxes: '0.00', discount: '0.00' }}
      onSuccess={() => router.push('/checkout/success')}
      onError={(detail) => setError('El pago no fue completado')}
      theme="blue"
      renderOffline={<p>Yappy no disponible en este momento.</p>}
    />
  )
}
```

Your backend endpoint (`/api/yappy/checkout`) must:
1. Call `yappy.initCheckout()`
2. Persist the pending order to your database
3. Return `{ transactionId, token, documentName, orderId, expiresAt }`

---

## Approach B — Custom Polling Flow (React)

Full control over UI. Customer enters their Yappy phone number, you poll for the payment result.

```tsx
import {
  useYappyPendingCheck,
  YappyPhoneInput,
  YappyPendingModal,
} from '@panama-payments/yappy/react'

function CheckoutPage() {
  const { status, timeLeft, startPayment, cancelPayment, isLoading, error } = useYappyPendingCheck({
    checkoutEndpoint: '/api/yappy/checkout',
    statusEndpoint: '/api/yappy/status',
    cancelEndpoint: '/api/yappy/cancel',
    onSuccess: ({ orderId }) => router.push(`/checkout/success?orderId=${orderId}`),
    onError: ({ message }) => showToast('error', message),
  })

  return (
    <>
      {status === 'idle' && (
        <YappyPhoneInput
          onSubmit={(phone) => startPayment(phone, { total: '25.00' })}
          disabled={isLoading}
        />
      )}
      {error && <p role="alert">{error}</p>}
      <YappyPendingModal status={status} timeLeft={timeLeft} onCancel={cancelPayment} />
    </>
  )
}
```

Features of `useYappyPendingCheck`:
- Polls `/api/yappy/status/:orderId` every 3 seconds
- Countdown timer computed from server-side `expiresAt` timestamp
- Persists pending order to `localStorage` to survive page refreshes
- Handles all terminal states: `paid`, `failed`, `cancelled`, `expired`

---

## Package Exports

| Import | Use in | Contains |
|---|---|---|
| `@panama-payments/yappy/server` | Node.js, Server Components, API routes | `YappyClient`, `validateYappyHash`, `parseYappyWebhook`, `generateOrderId` |
| `@panama-payments/yappy/react` | React client components | Hooks, components, types |

---

## Environment Variables

```bash
# Required (server-side only — never expose to browser)
YAPPY_MERCHANT_ID=BG-MERCHANT-XXXX       # From Yappy Comercial
YAPPY_URL_DOMAIN=mystore.com             # Your registered domain
CLAVE_SECRETA=base64encodedSecret==      # For webhook hash validation
BASE_URL=https://api.mystore.com         # For constructing ipnUrl

# Optional
YAPPY_ENVIRONMENT=sandbox                # 'production' (default) or 'sandbox'
```

---

## Documentation

| Doc | Contents |
|---|---|
| [Getting Started](docs/getting-started.md) | Credential setup, environments, installation |
| [Payment Flows](docs/flow.md) | Mermaid sequence diagrams for both approaches |
| [Integration Guide](docs/integration-guide.md) | 5 use cases with full code examples |
| [API Reference](docs/api-reference.md) | Every method, hook, component, enum, and type |
| [Environment Variables](docs/env-vars.md) | All env vars with descriptions and examples |
| [Database Model](docs/database-model.md) | Sequelize, Prisma, and SQL schemas |

---

## Examples

- [`examples/express/`](examples/express/) — Express.js checkout endpoint + webhook handler
- [`examples/nextjs/`](examples/nextjs/) — Next.js App Router API routes + checkout page

---

## API Environments

| Environment | API URL | CDN Script |
|---|---|---|
| Production | `https://apipagosbg.bgeneral.cloud` | `https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js` |
| Sandbox (UAT) | `https://api-comecom-uat.yappycloud.com` | `https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js` |

---

## Yappy Payment Flow

```
Browser          Your Backend           Yappy API          Customer's Yappy App
   │                    │                    │                       │
   │──POST /checkout────►│                    │                       │
   │                    │──validateMerchant──►│                       │
   │                    │◄─────── token ──────│                       │
   │                    │──createOrder───────►│                       │
   │                    │◄── transactionId ───│                       │
   │                    │──save to DB         │                       │
   │◄─── result ────────│                    │                       │
   │                    │                    │──push notification────►│
   │                    │                    │                       │──confirm──►
   │                    │◄───GET /webhook (status=E)─────────────────│
   │                    │──update order paid  │                       │
   │──poll /status──────►│                    │                       │
   │◄── status: paid ───│                    │                       │
   │──redirect to success                    │                       │
```

---

## License

MIT
