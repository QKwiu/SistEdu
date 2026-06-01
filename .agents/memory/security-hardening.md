---
name: Security hardening decisions
description: Key security choices made during the Kiwara Tech security audit — affects rbac.ts, payments.ts, app.ts, admin.ts, infant.ts.
---

## Decisions

**Staff password hashing — bcrypt not SHA256**
rbac.ts uses bcrypt (cost 12) via bcryptjs. Old SHA256+salt hashes are still verified via `verifyPassword()` for backwards compatibility (detects by `$2a$`/`$2b$` prefix vs 64-char hex). New hashes are always bcrypt.

**Why:** SHA256 with a hardcoded salt is rainbow-table vulnerable.

**Temp password generation — crypto.randomBytes**
`generateTempPassword()` uses `crypto.randomBytes(4).toString("hex").toUpperCase()`. Never use `Math.random()` for security tokens.

**Webhook HMAC signature**
`POST /payments/webhook` verifies `X-Webhook-Signature: sha256=<hmac>` using `WEBHOOK_SECRET` env var. If env var is absent the endpoint remains open (dev fallback). Set `WEBHOOK_SECRET` in production.

**Why:** Unauthenticated webhook = anyone can mark invoices as paid.

**Admin credentials — hard fail without env vars**
`admin.ts` throws at startup if `ADMIN_USERNAME` or `ADMIN_PASSWORD` not set. No hardcoded fallback.

**Why:** Hardcoded `Superaadmin/Superaadmin` was a critical vulnerability.

**Rate limiters — express-rate-limit v8**
`src/lib/rate-limiters.ts` exports three limiters. Do NOT use custom `keyGenerator` with `req.ip` — v8 throws `ERR_ERL_KEY_GEN_IPV6`. Let the library use its default key generator.

Applied:
- `loginRateLimiter` (20 req / 15 min) → `/auth/login`, `/admin/login`, `/guardian/login`
- `pinResetLimiter` (5 req / 1 hour) → `/guardian/recuperar-pin`
- `apiLimiter` (300 req / 1 min) → all `/api/*` routes

**Helmet**
`app.ts` applies `helmet()` with `crossOriginResourcePolicy: { policy: "cross-origin" }` (needed so uploaded media in iframes works).

**Path traversal — infant.ts media serving**
`/school/infant/media/:filename` now: (1) strips to `path.basename()`, (2) validates against regex `/^inf-\d+-[0-9a-f]+\.[a-z0-9]{2,5}$/`, (3) queries DB to verify ownership before serving.
