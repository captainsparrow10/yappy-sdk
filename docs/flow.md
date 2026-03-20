# Payment Flows

Yappy supports two integration approaches. Choose based on your requirements:

| Approach | Best for | UI control | Complexity |
|---|---|---|---|
| **Official Web Component** | Standard integrations, Banco General branding | Low (CDN-managed) | Low |
| **Custom polling flow** | Fully custom UIs, mobile apps, white-label | Full | Medium |

---

## Approach A — Official Web Component

The `<btn-yappy>` Custom Element is provided by Banco General's CDN. It handles the payment UI (QR code or phone push), theming, and result feedback natively.

```mermaid
sequenceDiagram
    participant Browser
    participant YourBackend
    participant YappyAPI
    participant YappyApp

    Browser->>Browser: Render <btn-yappy> (CDN loaded)
    Browser->>Browser: eventOnline fires (Yappy available)
    Browser->>Browser: User clicks btn-yappy → eventClick fires

    Browser->>YourBackend: POST /api/yappy/checkout (eventClick handler)
    YourBackend->>YappyAPI: POST /payments/validate/merchant
    YappyAPI-->>YourBackend: { token, epochTime }
    YourBackend->>YappyAPI: POST /payments/payment-wc (using token)
    YappyAPI-->>YourBackend: { transactionId, token, documentName }
    YourBackend->>YourBackend: Save pending order to DB
    YourBackend-->>Browser: { transactionId, token, documentName }

    Browser->>Browser: btnyappy.eventPayment({ transactionId, token, documentName })
    Browser->>YappyApp: Yappy push notification sent to customer's phone

    YappyApp->>YappyApp: Customer confirms payment

    YappyAPI->>YourBackend: GET /api/yappy/webhook?orderId=X&status=E&hash=...
    YourBackend->>YourBackend: validateYappyHash() → valid
    YourBackend->>YourBackend: Fulfill order in DB
    YourBackend-->>YappyAPI: HTTP 200 { received: true }

    YappyAPI->>Browser: eventSuccess fires on <btn-yappy>
    Browser->>Browser: onSuccess callback → redirect to confirmation
```

### Key points

- The browser never directly calls the Yappy API.
- `eventClick` fires when the user taps the button — your handler calls your backend.
- `eventPayment()` activates the Yappy flow inside the web component.
- `eventSuccess` fires when Yappy confirms the payment to the CDN component.
- `eventError` fires if the payment fails.

---

## Approach B — Custom Polling Flow

You build your own UI. The customer enters their Yappy phone number, your backend creates the order, and you poll your backend for the result.

```mermaid
sequenceDiagram
    participant Browser
    participant YourBackend
    participant YappyAPI
    participant YappyApp

    Browser->>Browser: Customer enters phone number (YappyPhoneInput)
    Browser->>YourBackend: POST /api/yappy/checkout { aliasYappy, total, ... }
    YourBackend->>YappyAPI: POST /payments/validate/merchant
    YappyAPI-->>YourBackend: { token, epochTime }
    YourBackend->>YappyAPI: POST /payments/payment-wc { aliasYappy, ... }
    YappyAPI-->>YourBackend: { transactionId, token, documentName }
    YourBackend->>YourBackend: Save pending order { orderId, expiresAt }
    YourBackend-->>Browser: { orderId, transactionId, expiresAt }

    Browser->>Browser: Show pending modal + countdown timer
    Browser->>YappyApp: Push notification sent to customer's Yappy app

    loop Poll every 3 seconds
        Browser->>YourBackend: GET /api/yappy/status/:orderId
        YourBackend-->>Browser: { status: 'pending' | 'paid' | ... }
    end

    YappyApp->>YappyApp: Customer confirms payment

    YappyAPI->>YourBackend: GET /api/yappy/webhook?orderId=X&status=E&hash=...
    YourBackend->>YourBackend: validateYappyHash() → valid
    YourBackend->>YourBackend: Update order status to 'paid', fulfill order
    YourBackend-->>YappyAPI: HTTP 200

    Browser->>YourBackend: GET /api/yappy/status/:orderId
    YourBackend-->>Browser: { status: 'paid', order: { ... } }
    Browser->>Browser: onSuccess callback → navigate to confirmation
```

### Key points

- The customer's Yappy push notification is triggered when `aliasYappy` is provided.
- If `aliasYappy` is omitted, the CDN web component shows a QR code instead.
- The browser polls your backend (not Yappy directly) for status updates.
- Your backend gets the authoritative status from Yappy via the IPN webhook.
- `useYappyPendingCheck` orchestrates this entire flow and persists state in `localStorage` to survive page refreshes.

---

## Order Expiration

Yappy orders expire **5 minutes** after creation if not confirmed. The expiry lifecycle:

```mermaid
stateDiagram-v2
    [*] --> created
    created --> expired : 5 min timeout (Yappy server-side)
    expired --> webhook_received : GET /webhook?status=X
    webhook_received --> order_updated : updateOrderStatus('expired')
    order_updated --> client_notified : Client polls → status: 'expired'
    client_notified --> [*]
```

The client-side timer (`timeLeft`) counts down from 300 seconds and is computed from the `expiresAt` timestamp returned by your backend. If `timeLeft` reaches 0 before the webhook fires, the hook sets status to `'expired'` after a 60-second grace period (in case the webhook is delayed).

---

## Webhook Delivery

Yappy delivers IPN webhooks as **GET requests** (not POST). Always:

1. Validate the `hash` parameter using `validateYappyHash()` before processing.
2. Return HTTP 200 immediately.
3. Process the payment asynchronously (fire-and-forget).
4. Implement idempotency — Yappy may retry the webhook.

Hash algorithm:
```
message = orderId + status + domain
key     = base64decode(CLAVE_SECRETA).split('.')[0]
hash    = HMAC-SHA256(message, key).hexdigest()
```
