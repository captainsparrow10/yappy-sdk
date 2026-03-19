# yappy-sdk (@panama-payments/yappy)

SDK de TypeScript para integrar pagos Yappy (Banco General, Panamá) en Node.js, React y proyectos vanilla. Open source — parte del proyecto [panama-payments](https://github.com/captainsparrow10).

## Comandos

```bash
npm install              # Instalar dependencias (axios es peer dependency)
npm run typecheck        # Verificar tipos (SIEMPRE antes de commit)
npm run build            # Compilar TypeScript → dist/
```

> `axios` debe instalarse por separado en el proyecto consumidor: `npm install axios`

## Arquitectura

Tres subpath exports:

| Import | Entorno | Contiene |
|--------|---------|----------|
| `yappy-sdk/server` | Node.js only | `YappyClient`, `validateYappyHash`, `parseYappyWebhook` |
| `yappy-sdk/react` | React (browser) | hooks headless, componentes opcionales |
| `yappy-sdk/vanilla` | Cualquier JS | `initYappyButton` (Vue, Svelte, HTML) |

```
src/
├── types.ts                         # Enums, interfaces, YAPPY_ERROR_MESSAGES
├── server/
│   ├── YappyClient.ts               # validateMerchant() + createOrder() + initiatePayment()
│   ├── webhook.ts                   # validateYappyHash() (timing-safe) + parseYappyWebhook()
│   └── index.ts
├── react/
│   ├── hooks/
│   │   ├── useYappyWebComponent.ts  # Integración oficial CDN <btn-yappy>
│   │   ├── useYappyCheckout.ts      # Inicia pago (llama al backend)
│   │   ├── useYappyOrderStatus.ts   # Polling de estado
│   │   └── useYappyPendingCheck.ts  # Orquestador: checkout + polling + countdown
│   ├── components/
│   │   ├── YappyButton.tsx          # Wrapper web component oficial
│   │   ├── YappyPhoneInput.tsx      # Input con validación teléfono panameño (6/7XXXXXXX)
│   │   └── YappyPendingModal.tsx    # Modal countdown + estados
│   └── index.ts
└── vanilla/
    ├── initYappyButton.ts           # API de bajo nivel para no-React
    └── index.ts
examples/
├── express/                         # checkout-endpoint.ts + webhook.ts
└── nextjs/                          # routes: checkout, webhook, status, cancel + checkout-page.tsx
docs/                                # 6 documentos
```

## Dos enfoques de integración

**Oficial (CDN web component)** — más simple para integraciones nuevas:
- Agregar `<script src="https://cdn-yappy.bgeneral.cloud/btn-yappy.js">` al HTML/layout
- Usar `useYappyWebComponent` para configurar `<btn-yappy>` con React ref
- El modal de pago lo maneja el web component automáticamente

**Custom (UI propia con polling)** — más control sobre la UX:
- Usar `useYappyPendingCheck` — orquesta checkout + polling + countdown + cancelación
- Ideal para Shopify u otros sistemas que necesitan confirmar orden antes de crearla

## Flujo de pago (backend)

Dos llamados secuenciales — SIEMPRE desde el backend, nunca desde el browser:
1. `POST /payments/validate/merchant` → `{ token, epochTime }`
2. `POST /payments/payment-wc` con el token → `{ transactionId, token, documentName }`

Método convenience que combina ambos: `yappy.initiatePayment({ orderId, total, subtotal, taxes, discount, ipnUrl })`

## Reglas críticas

- **server-only**: Los dos llamados a la API de Yappy nunca van al browser.
- **axios peer dependency**: El consumidor del SDK debe instalar axios. No está bundleado.
- **Hash del webhook**: `HMAC-SHA256(orderId + status + domain, key)` donde `key = Buffer.from(CLAVE_SECRETA, 'base64').toString().split('.')[0]`. Usar `crypto.timingSafeEqual` para comparar (ya implementado en `webhook.ts`).
- **YAPPY_URL_DOMAIN**: Debe coincidir exactamente con el dominio registrado en Yappy Comercial.
- **orderId único**: Yappy rechaza con `E006` si se reutiliza un `orderId`.
- **Hooks headless**: No agregar JSX ni HTML a hooks. Solo estado y callbacks.
- **TypeScript strict**: Correr `npm run typecheck` antes de cualquier commit.

## Estados del webhook IPN

| Código | Significado |
|--------|-------------|
| `E` | Ejecutado — pago exitoso |
| `R` | Rechazado |
| `C` | Cancelado por el usuario |
| `X` | Expirado sin acción |

## Variables de entorno (server-only)

| Variable | Descripción |
|----------|-------------|
| `YAPPY_MERCHANT_ID` | ID del comercio (obtenido de Yappy Comercial) |
| `YAPPY_URL_DOMAIN` | Dominio registrado en Yappy Comercial (ej: `mitienda.com`) |
| `YAPPY_ENVIRONMENT` | `'production'` o `'sandbox'` |
| `CLAVE_SECRETA` | Clave base64 para validar firma del webhook IPN |

Ver `docs/env-vars.md` para instrucciones de cómo obtener cada valor desde Yappy Comercial.

## Documentación

- `docs/getting-started.md` — Guía de 7 pasos para obtener credenciales en Yappy Comercial
- `docs/flow.md` — Diagramas Mermaid: flujo oficial y flujo custom
- `docs/integration-guide.md` — 5 casos de uso con curl + TypeScript
- `docs/api-reference.md` — Referencia completa de métodos, hooks, enums y tipos
- `docs/env-vars.md` — Variables de entorno con ejemplos
- `docs/database-model.md` — Schema para rastrear órdenes Yappy (Sequelize + Prisma + SQL)
