---
name: Security hardening decisions
description: Key security choices made during Kiwara Tech security audit rounds 1+2 — affects rbac.ts, payments.ts, app.ts, admin.ts, infant.ts, guardian.ts, auth.ts.
---

## Round 1 Decisions

**Staff password hashing — bcrypt not SHA256**
rbac.ts uses bcrypt (cost 12) via bcryptjs. Old SHA256+salt hashes still verified via `verifyPassword()` for backwards compatibility (detects by `$2a$`/`$2b$` prefix vs 64-char hex).

**Why:** SHA256 with a hardcoded salt is rainbow-table vulnerable.

**Webhook HMAC signature**
`POST /payments/webhook` verifies `X-Webhook-Signature: sha256=<hmac>` using `WEBHOOK_SECRET` env var. If env var absent the endpoint is DISABLED (safe fail in prod). Set `WEBHOOK_SECRET` in production.

**Admin credentials — hard fail without env vars**
`admin.ts` throws at startup if `ADMIN_USERNAME` or `ADMIN_PASSWORD` not set. No hardcoded fallback.

**Rate limiters — express-rate-limit v8**
`src/lib/rate-limiters.ts` — do NOT use custom `keyGenerator` with `req.ip` — v8 throws `ERR_ERL_KEY_GEN_IPV6`. Let library use its default.

**Helmet**
`app.ts` applies `helmet()` with `crossOriginResourcePolicy: { policy: "cross-origin" }` (needed for uploaded media in iframes).

**Path traversal — infant.ts**
`/school/infant/media/:filename`: (1) `path.basename()`, (2) regex whitelist `/^inf-\d+-[0-9a-f]+\.[a-z0-9]{2,5}$/`, (3) DB ownership check.

## Round 2 Decisions

**Uploads auth — /api/uploads is NOT public**
`app.ts` adds `uploadsAuth` middleware before `express.static`. Requires Bearer token validated against sessions, guardian_sessions, or admin_sessions. Without this, student BI documents were publicly accessible.

**Why:** Student identity documents (BIs) uploaded for enrolment were accessible to anyone who guessed the filename.

**SSRF protection — test-request endpoint**
`admin.ts` `validateNoSSRF()` checks URL before any `fetch()`: (1) scheme must be http/https, (2) blocks known metadata hostnames, (3) DNS-resolves hostname and blocks private IP ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, loopback IPv6).

**Why:** Admin proxy endpoint allowed fetch to internal network including cloud metadata (169.254.169.254).

**SELECT s.* removed from /admin/colegios/:id**
Explicit column projection, excludes `password_hash`. Response no longer contains bcrypt hash of school credentials.

**getGuardianFromToken — explicit projection**
`guardian.ts` uses explicit SELECT instead of `SELECT e.*`, removing `password` (bcrypt hash) from the in-memory guardian object throughout the request lifecycle.

**e.message suppressed in rbac.ts — 24 catch blocks**
All `res.status(500).json({ error: e.message })` replaced with `req.log?.error(e); res.status(500).json({ error: "Erro interno do servidor." })`. Prevents DB schema/table names leaking via error messages.

**bcrypt cost 10 → 12 universally**
auth.ts, guardian.ts (change-password + recuperar-pin), admin.ts (school create + reset-password) all updated to cost 12.

**Hardcoded default password removed in admin school creation**
`password || "Kiwara@2025"` removed. Password is now required (≥8 chars) when admin creates a school.

**Math.random() → crypto.randomBytes in generateSchoolId**
auth.ts — school IDs now generated with cryptographically secure randomness (CWE-338).
