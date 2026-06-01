---
name: FCM native implementation
description: How FCM push notifications are implemented without firebase-admin (blocked by package firewall)
---

The `firebase-admin` npm package is blocked by Replit's package firewall (502 Bad Gateway on install).

## Rule
Implement Firebase Cloud Messaging using native Node.js `crypto` + `fetch` — no external packages needed.

**Why:** Replit package firewall blocks `firebase-admin`. The FCM HTTP v1 API is a standard REST API that only requires an OAuth2 Bearer token, which can be obtained by signing a JWT with the service account's RS256 private key.

**How to apply:**
1. Build JWT: `crypto.createSign('RSA-SHA256')` with `base64url` header+payload, RS256 sign with service account private_key (replace `\\n` → `\n`).
2. Exchange JWT for OAuth2 access token via `https://oauth2.googleapis.com/token` (grant_type: `urn:ietf:params:oauth:grant-type:jwt-bearer`).
3. POST to `https://fcm.googleapis.com/v1/projects/{project_id}/messages:send` with `Authorization: Bearer {access_token}`.
4. FCM HTTP v1 is per-token (no multicast endpoint); use `Promise.all` in batches of 100 for scale.

## Storage
- FCM credentials stored in `platform_config` table, key `'fcm_config'`, JSONB format:
  ```json
  { "active_env": "test", "test": { "project_id": "...", "client_email": "...", "private_key": "..." }, "production": {...} }
  ```
- Device tokens stored in `fcm_device_tokens` table (school_id, user_type guardian/staff, user_id, token, platform).
- `private_key` added to `SENSITIVE` array in admin.ts → masked as `"***"` in GET responses, preserved via `mergePreserveSecrets` on PUT.

## Files
- Backend: `artifacts/api-server/src/routes/fcm.ts` (all FCM logic + `/api/fcm/register-token`, `/api/school/comunicar/fcm-stats`, `/api/school/comunicar/push`).
- Admin config routes: appended to `artifacts/api-server/src/routes/admin.ts` (`GET/PUT /admin/fcm-config`, `POST /admin/fcm-config/test` using dynamic import of `./fcm.js`).
- Frontend admin: `FcmConfigAdminView` component in `admin-dashboard.tsx`, nav item with `Zap` icon, view type `"fcm_config"`.
- Frontend school: `"push"` tab added to `ComunicarView` in `dashboard.tsx` with audience filter, device stats, and send button.
