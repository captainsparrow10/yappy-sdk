# Environment Variables

All server-side variables must be kept secret. Never expose them to the browser
via `NEXT_PUBLIC_*` or equivalent prefixes in other frameworks.

---

## Required Variables

### `YAPPY_MERCHANT_ID`

Your Yappy merchant identifier.

- **Where to find it:** Yappy Comercial → Métodos de cobro → Botón de Pago Yappy → Ver credenciales
- **Format:** String, e.g. `BG-MERCHANT-XXXX`
- **Used in:** `YappyClient` constructor, passed to every Yappy API call
- **Security:** Server-side only — treat as a secret

```bash
YAPPY_MERCHANT_ID=BG-MERCHANT-XXXX
```

---

### `YAPPY_URL_DOMAIN`

Your website's domain as registered in Yappy Comercial.

- **Where to find it:** Same location as `YAPPY_MERCHANT_ID`
- **Format:** Domain only, no `https://` prefix, no trailing slash. E.g. `mystore.com`
- **Used in:** `YappyClient` constructor, passed in every `createOrder` call, included in webhook hash validation
- **Important:** Must match exactly what's registered in Yappy Comercial. Any mismatch causes webhook hash validation failures.

```bash
YAPPY_URL_DOMAIN=mystore.com
```

---

### `CLAVE_SECRETA`

Your HMAC secret key for validating IPN webhook signatures.

- **Where to find it:** Yappy Comercial → Métodos de cobro → Botón de Pago Yappy → Generar clave secreta
- **Format:** Base64-encoded string (e.g. `dGhpcyBpcyBhIHRlc3Q=`)
- **Used in:** `validateYappyHash()` — must be present on your webhook handler
- **Security:** Server-side only — extremely sensitive. Rotate this key if compromised.

```bash
CLAVE_SECRETA=base64encodedSecretKeyHere==
```

The SDK decodes this internally: `Buffer.from(CLAVE_SECRETA, 'base64').toString().split('.')[0]`

---

### `BASE_URL`

Your server's public base URL, used to construct the `ipnUrl` webhook callback.

- **Format:** Full URL with protocol, no trailing slash. E.g. `https://api.mystore.com`
- **Must be publicly accessible** — Yappy's servers must be able to reach it. `localhost` will not work in production.
- **Used in:** Constructing `ipnUrl: ${BASE_URL}/api/yappy/webhook`

```bash
BASE_URL=https://api.mystore.com
```

For local development with the sandbox environment, use a tunneling tool:

```bash
# ngrok
npx ngrok http 3000
# → https://abc123.ngrok.io
BASE_URL=https://abc123.ngrok.io

# Cloudflare Tunnel
npx cloudflared tunnel --url http://localhost:3000
```

---

## Optional Variables

### `YAPPY_ENVIRONMENT`

Controls which Yappy API environment to use.

| Value | API URL | CDN URL |
|---|---|---|
| `production` (default) | `https://apipagosbg.bgeneral.cloud` | `https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js` |
| `sandbox` | `https://api-comecom-uat.yappycloud.com` | `https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js` |

```bash
YAPPY_ENVIRONMENT=sandbox   # Development / testing
YAPPY_ENVIRONMENT=production # Production
```

---

## Example `.env` file

```bash
# ── Yappy Payments ────────────────────────────────────────────────────────────
# All server-side only. NEVER expose these to the browser.

YAPPY_MERCHANT_ID=BG-MERCHANT-XXXX
YAPPY_URL_DOMAIN=mystore.com
YAPPY_ENVIRONMENT=sandbox
CLAVE_SECRETA=replace_with_your_base64_clave_secreta_from_yappy_comercial==
BASE_URL=https://api.mystore.com
```

---

## Next.js specifics

In Next.js, server-only variables should NOT use the `NEXT_PUBLIC_` prefix:

```bash
# server-side only (in API routes, Server Components, Server Actions)
YAPPY_MERCHANT_ID=...
YAPPY_URL_DOMAIN=...
CLAVE_SECRETA=...

# base URL: use BASE_URL (server) not NEXT_PUBLIC_BASE_URL (client)
BASE_URL=https://mystore.com
```

The SDK's Next.js example routes access these via `process.env.YAPPY_MERCHANT_ID` etc. in API route handlers, which are always server-side.

---

## Vercel deployment

Add the following in your Vercel project settings under **Settings → Environment Variables**:

| Name | Environment | Value |
|---|---|---|
| `YAPPY_MERCHANT_ID` | Production, Preview | Your merchant ID |
| `YAPPY_URL_DOMAIN` | Production | `mystore.com` |
| `YAPPY_URL_DOMAIN` | Preview | `preview.mystore.com` |
| `YAPPY_ENVIRONMENT` | Production | `production` |
| `YAPPY_ENVIRONMENT` | Preview | `sandbox` |
| `CLAVE_SECRETA` | Production, Preview | Your secret key |
| `BASE_URL` | Production | `https://api.mystore.com` |
| `BASE_URL` | Preview | `https://preview.api.mystore.com` |
