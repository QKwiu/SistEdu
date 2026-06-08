/**
 * api-client.ts — shared API helper factory (DRY: replaces raw fetch + manual headers)
 *
 * Usage:
 *   const api = createApiClient("kiwara_admin_token");
 *   const res = await api("/admin/stats");
 *   const data = await res.json();
 */

const BASE = "/api";

/**
 * Creates a fetch wrapper that automatically injects the Authorization header
 * from the given localStorage key.
 *
 * The returned function has the same signature as admin-dashboard.tsx's local `api()`
 * so it can be dropped in as a replacement without changing call sites.
 */
export function createApiClient(tokenKey: string) {
  return async function apiFetch(path: string, opts: RequestInit = {}): Promise<Response> {
    const token = localStorage.getItem(tokenKey) ?? "";
    return fetch(`${BASE}${path}`, {
      ...opts,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...opts.headers,
      },
    });
  };
}

/**
 * Lower-level typed helpers — useful for new code that wants auto-parsed JSON.
 */
export async function apiGet<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? res.statusText);
  }
  return res.json();
}

export async function apiPost<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? res.statusText);
  }
  return res.json();
}

export async function apiPut<T>(path: string, body: unknown, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? res.statusText);
  }
  return res.json();
}

export async function apiDelete<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    throw new Error((e as any).error ?? res.statusText);
  }
  return res.json();
}
