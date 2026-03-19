# Getting Started

This guide walks you through obtaining Yappy credentials, configuring your environment, and running your first test payment.

## Prerequisites

- Node.js 18+ (or Bun / Deno)
- A publicly accessible server URL for the IPN webhook (required even in sandbox)
- A Yappy Comercial account (contact Banco General Panama to register)

## Step 1 — Register with Yappy Comercial

Go to [yappycomercial.bgeneral.com](https://yappycomercial.bgeneral.com) and log in with your Banco General business credentials. If you don't have an account, contact Banco General to onboard.

## Step 2 — Get your Merchant ID

In Yappy Comercial, navigate to:

```
Métodos de cobro → Botón de Pago Yappy → Ver credenciales
```

Copy the **Merchant ID** (`YAPPY_MERCHANT_ID`). This is a string like `BG-MERCHANT-XXXX`.

## Step 3 — Register your domain

In the same section, register your website domain (e.g., `mystore.com`). This value becomes `YAPPY_URL_DOMAIN`.

**Important:** The domain must match exactly what you pass in API calls and what Yappy uses to compute webhook hashes. Do not include `https://` or trailing slashes.

## Step 4 — Generate your secret key (CLAVE_SECRETA)

Still in Yappy Comercial, click **Generar clave secreta**. Copy the generated base64 string. This is your `CLAVE_SECRETA` — it is used to validate IPN webhook hashes.

Keep this secret. Never commit it to version control or expose it in client-side code.

## Step 5 — Set environment variables

```bash
# .env (server-side only — NEVER expose these to the browser)
YAPPY_MERCHANT_ID=BG-MERCHANT-XXXX
YAPPY_URL_DOMAIN=mystore.com
YAPPY_ENVIRONMENT=sandbox           # Use 'production' when going live
CLAVE_SECRETA=base64encodedstring==
BASE_URL=https://api.mystore.com    # Your public server URL for the IPN webhook
```

See [env-vars.md](./env-vars.md) for a full reference of all environment variables.

## Step 6 — Choose your environment

| Environment | API URL | CDN Script |
|---|---|---|
| Production | `https://apipagosbg.bgeneral.cloud` | `https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js` |
| Sandbox (UAT) | `https://api-comecom-uat.yappycloud.com` | `https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js` |

Set `YAPPY_ENVIRONMENT=sandbox` for local development. The `YappyClient` and `useYappyWebComponent` both use the correct URLs automatically based on this value.

## Step 7 — Install the SDK

```bash
# npm
npm install @panama-payments/yappy

# Bun
bun add @panama-payments/yappy

# pnpm
pnpm add @panama-payments/yappy
```

## Quickstart — Server (Node.js / Express)

```typescript
import { YappyClient, validateYappyHash, YappyStatus } from '@panama-payments/yappy/server'

const yappy = new YappyClient({
  merchantId: process.env.YAPPY_MERCHANT_ID!,
  urlDomain: process.env.YAPPY_URL_DOMAIN!,
  environment: 'sandbox',
})

// Create a payment order
const result = await yappy.initCheckout({
  ipnUrl: 'https://api.mystore.com/webhooks/yappy',
  total: '10.00',
  subtotal: '10.00',
  discount: '0.00',
  taxes: '0.00',
})

console.log(result.orderId)        // Persist this
console.log(result.transactionId)  // Yappy's transaction reference
```

## Quickstart — React (custom flow)

```tsx
import { useYappyPendingCheck } from '@panama-payments/yappy/react'

function CheckoutPage() {
  const { status, timeLeft, startPayment, cancelPayment } = useYappyPendingCheck({
    checkoutEndpoint: '/api/yappy/checkout',
    statusEndpoint: '/api/yappy/status',
    cancelEndpoint: '/api/yappy/cancel',
    onSuccess: ({ orderId }) => router.push(`/success?id=${orderId}`),
  })

  return status === 'pending'
    ? <YappyPendingModal status={status} timeLeft={timeLeft} onCancel={cancelPayment} />
    : <YappyPhoneInput onSubmit={(phone) => startPayment(phone, { total: '10.00' })} />
}
```

## Next steps

- [flow.md](./flow.md) — Architecture diagrams for both integration approaches
- [integration-guide.md](./integration-guide.md) — Full implementation guide with code examples
- [api-reference.md](./api-reference.md) — Complete API reference
- [database-model.md](./database-model.md) — Database schema for tracking Yappy orders
