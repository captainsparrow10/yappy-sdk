# API Reference

Complete reference for all exported functions, classes, hooks, components, enums, and types.

---

## Server (`@panama-payments/yappy/server`)

### `YappyClient`

Server-side client for the Yappy payment API. Instantiate once at startup and reuse across requests.

```typescript
const yappy = new YappyClient(config: YappyClientConfig)
```

**Constructor config:**

| Property | Type | Required | Description |
|---|---|---|---|
| `merchantId` | `string` | Yes | Merchant ID from Yappy Comercial |
| `urlDomain` | `string` | Yes | Registered domain (e.g. `'mystore.com'`) |
| `environment` | `'production' \| 'sandbox'` | No | Defaults to `'production'` |

**Properties:**

| Property | Type | Description |
|---|---|---|
| `yappy.apiUrl` | `string` | Resolved API base URL for the environment |
| `yappy.cdnUrl` | `string` | CDN URL for the `<btn-yappy>` script for the environment |

---

#### `yappy.validateMerchant()`

```typescript
async validateMerchant(): Promise<string>
```

Step 1 of the Yappy flow. Exchanges your credentials for a short-lived authorization token.

- **Returns:** Authorization token string (pass to `createOrder()`)
- **Throws:** If credentials are invalid or the network request fails

---

#### `yappy.createOrder(params, authToken)`

```typescript
async createOrder(
  params: Omit<CreateOrderRequest, 'merchantId' | 'domain' | 'paymentDate'> & { paymentDate?: number },
  authToken: string,
): Promise<YappyCheckoutResult>
```

Step 2 of the Yappy flow. Creates the payment order.

| Param | Type | Required | Description |
|---|---|---|---|
| `params.orderId` | `string` | Yes | Unique 15-char alphanumeric ID |
| `params.ipnUrl` | `string` | Yes | Your webhook URL |
| `params.total` | `string` | Yes | Total amount (e.g. `'25.00'`) |
| `params.subtotal` | `string` | Yes | Subtotal before taxes |
| `params.taxes` | `string` | Yes | Tax amount |
| `params.discount` | `string` | Yes | Discount amount |
| `params.aliasYappy` | `string` | No | Customer's 8-digit Yappy phone number |
| `params.paymentDate` | `number` | No | Unix epoch in seconds (defaults to `Date.now() / 1000`) |
| `authToken` | `string` | Yes | Token from `validateMerchant()` |

**Returns:** `YappyCheckoutResult` — `{ transactionId, token, documentName }`

---

#### `yappy.initCheckout(params)`

```typescript
async initCheckout(
  params: Omit<CreateOrderRequest, 'merchantId' | 'domain' | 'paymentDate' | 'orderId'> & {
    orderId?: string
    paymentDate?: number
  },
): Promise<YappyCheckoutResult & { orderId: string }>
```

Combines `validateMerchant()` and `createOrder()` in one call. Recommended method for checkout endpoints.

- If `orderId` is omitted, a random 15-char ID is generated via `generateOrderId()`.
- **Returns:** `{ transactionId, token, documentName, orderId }` — persist `orderId` before responding.

---

### `generateOrderId()`

```typescript
function generateOrderId(): string
```

Generates a cryptographically-random 15-character uppercase alphanumeric string suitable for Yappy's `orderId` requirement.

```typescript
generateOrderId() // e.g. "A3KX9MZQ1BPRY7W"
```

---

### `validateYappyHash(query, secretKey)`

```typescript
function validateYappyHash(
  query: Record<string, string>,
  secretKey: string,
): YappyWebhookResult
```

Validates the HMAC-SHA256 signature of a Yappy IPN webhook request using constant-time comparison (timing-safe).

| Param | Description |
|---|---|
| `query` | Raw query params from the webhook GET request (e.g. `req.query`) |
| `secretKey` | Your `CLAVE_SECRETA` (base64 string from Yappy Comercial) |

**Returns:** `YappyWebhookResult` — `{ valid, status, orderId, domain }`

Always check `result.valid` before processing.

---

### `parseYappyWebhook(query)`

```typescript
function parseYappyWebhook(query: Record<string, string>): YappyWebhookPayload
```

Parses and validates the query params of a Yappy IPN webhook into a typed `YappyWebhookPayload`. Throws if required fields are missing or `status` is not a known `YappyStatus` value.

---

## React (`@panama-payments/yappy/react`)

### `useYappyWebComponent(config)`

```typescript
function useYappyWebComponent(config: UseYappyWebComponentConfig): UseYappyWebComponentReturn
```

Hook for the official `<btn-yappy>` CDN web component. Handles CDN loading, event wiring, and checkout flow.

**Config:**

| Property | Type | Required | Description |
|---|---|---|---|
| `checkoutEndpoint` | `string` | Yes | Backend URL to POST for checkout initiation |
| `checkoutPayload` | `Record<string, unknown>` | No | Extra data to include in POST body |
| `onSuccess` | `(detail: unknown) => void` | Yes | Called when `eventSuccess` fires |
| `onError` | `(detail: unknown) => void` | No | Called when `eventError` fires |
| `environment` | `'production' \| 'sandbox'` | No | Defaults to `'production'` |

**Returns:**

| Property | Type | Description |
|---|---|---|
| `btnRef` | `RefObject<BtnYappyElement>` | Attach to `<btn-yappy ref={btnRef} />` |
| `isOnline` | `boolean` | Whether Yappy channel is available |
| `isLoading` | `boolean` | Whether checkout request is in flight |
| `isCdnLoaded` | `boolean` | Whether the CDN script has loaded |
| `setLoading` | `(loading: boolean) => void` | Manually set loading state |

---

### `useYappyCheckout(config)`

```typescript
function useYappyCheckout(config: UseYappyCheckoutConfig): UseYappyCheckoutReturn
```

Low-level hook for calling your checkout backend. Does NOT poll for status — pair with `useYappyOrderStatus`.

**Config:**

| Property | Type | Description |
|---|---|---|
| `checkoutEndpoint` | `string` | Backend POST endpoint |

**Returns:** `{ initPayment, isLoading, error, data, reset }`

---

### `useYappyOrderStatus(config)`

```typescript
function useYappyOrderStatus(config: UseYappyOrderStatusConfig): UseYappyOrderStatusReturn
```

Polls your backend status endpoint until the order reaches a terminal state.

**Config:**

| Property | Type | Default | Description |
|---|---|---|---|
| `statusEndpoint` | `string` | — | Backend GET endpoint. Hook calls `GET {statusEndpoint}/{orderId}` |
| `orderId` | `string \| null` | — | Order to poll. Polling disabled if null |
| `interval` | `number` | `3000` | Polling interval in ms |
| `expiresAt` | `string` | — | ISO timestamp. Polling stops 1 min after expiry |

**Returns:** `{ data, isPolling, error, stopPolling, startPolling }`

---

### `useYappyPendingCheck(config)`

```typescript
function useYappyPendingCheck(config: UseYappyPendingCheckConfig): UseYappyPendingCheckReturn
```

Orchestrator hook for the full custom payment flow. Manages checkout initiation, status polling, countdown timer, and localStorage persistence.

**Config:**

| Property | Type | Required | Description |
|---|---|---|---|
| `checkoutEndpoint` | `string` | Yes | POST endpoint to initiate payment |
| `statusEndpoint` | `string` | Yes | GET endpoint for status polling |
| `cancelEndpoint` | `string` | No | POST endpoint for cancellation |
| `onSuccess` | `(data) => void` | Yes | Called when payment is confirmed |
| `onError` | `(reason) => void` | No | Called on failure/cancel/expiry |
| `interval` | `number` | `3000` | Polling interval in ms |
| `expiryMs` | `number` | `300000` | Client-side expiry window in ms |

**Returns:**

| Property | Type | Description |
|---|---|---|
| `status` | `YappyPendingStatus` | `'idle' \| 'pending' \| 'paid' \| 'failed' \| 'cancelled' \| 'expired'` |
| `timeLeft` | `number` | Seconds remaining (300 → 0) |
| `pendingOrder` | `YappyPendingOrderData \| null` | Current order data |
| `startPayment` | `(phone?, payload?) => Promise<void>` | Start the payment flow |
| `cancelPayment` | `() => Promise<void>` | Cancel the pending order |
| `reset` | `() => void` | Reset to idle state |
| `isLoading` | `boolean` | Checkout request in flight |
| `error` | `string \| null` | Checkout initiation error |

---

### Components

#### `YappyButton`

React wrapper around `<btn-yappy>`. Manages CDN loading, events, and offline fallback.

```tsx
<YappyButton
  checkoutEndpoint="/api/yappy/checkout"
  checkoutPayload={{ total: '25.00' }}
  onSuccess={(detail) => {}}
  onError={(detail) => {}}
  theme="blue"
  rounded={true}
  renderOffline={<p>Yappy no disponible.</p>}
  environment="production"
/>
```

#### `YappyPhoneInput`

Validated phone input for Panamanian mobile numbers. 8 digits, starts with 6 or 7.

```tsx
<YappyPhoneInput
  onSubmit={(phone) => startPayment(phone)}
  disabled={isLoading}
  placeholder="Ej: 60800011"
  label="Número de teléfono Yappy"
  submitLabel="Pagar"
/>
```

#### `YappyPendingModal`

Semantic `<dialog>` for the pending payment state. Unstyled — apply your own CSS.

```tsx
<YappyPendingModal
  status={status}
  timeLeft={timeLeft}
  onCancel={cancelPayment}
  error={errorMessage}
  className="my-modal"
/>
```

#### `validateYappyPhone(phone)`

```typescript
function validateYappyPhone(phone: string): boolean
```

Validates a Panamanian phone number: 8 digits, starts with 6 or 7.

---

## Enums

### `YappyStatus`

| Value | Code | Description |
|---|---|---|
| `YappyStatus.Executed` | `'E'` | Payment confirmed by customer |
| `YappyStatus.Rejected` | `'R'` | Customer rejected the payment |
| `YappyStatus.Cancelled` | `'C'` | Customer cancelled |
| `YappyStatus.Expired` | `'X'` | 5-minute window elapsed |

### `YappyErrorCode`

| Value | Code | Cause |
|---|---|---|
| `E002` | `'E002'` | Invalid merchant or inactive account |
| `E005` | `'E005'` | Phone number not registered in Yappy |
| `E006` | `'E006'` | Generic error |
| `E007` | `'E007'` | Duplicate orderId — already used |
| `E009` | `'E009'` | orderId exceeds 15 characters |
| `E010` | `'E010'` | Amount mismatch (discount+taxes+subtotal ≠ total) |
| `E011` | `'E011'` | Invalid URL fields (domain or ipnUrl) |
| `E100` | `'E100'` | Bad request — missing or malformed field |

Use `YAPPY_ERROR_MESSAGES[code]` to get a human-readable Spanish string for each code.

### `YappyButtonTheme`

`'blue' | 'darkBlue' | 'orange' | 'dark' | 'sky' | 'light'`

### `YappyPendingStatus` (React)

`'idle' | 'pending' | 'paid' | 'failed' | 'cancelled' | 'expired'`
