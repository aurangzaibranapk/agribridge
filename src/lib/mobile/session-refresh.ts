/**
 * Supabase session phone par rehti hai aur khud refresh hoti hai.
 * autoRefreshToken jaisa: refresh token save, foreground par naya access,
 * aur 401 JWT expired par ek dafa refresh phir wahi request.
 */

import { acceptedSupabaseUrl, dataFlavor, type DataFlavor, type FetchLike } from "./live-login";

export const SESSION_EXPIRED = "Session khatam ho gayi. Dobara login karein.";

export type RefreshSuccess = {
  ok: true;
  accessToken: string;
  refreshToken: string;
  expiresAt: number | null;
};

export type RefreshFailure = { ok: false; dead: boolean };

export function jwtExpired(status: number, body: string | null | undefined): boolean {
  if (status !== 401) return false;
  return /PGRST303|JWT expired/i.test(body ?? "");
}

/** expiresAt unix seconds. Null par bhi refresh, kyunke purani session mein waqt nahi tha. */
export function refreshDue(expiresAt: number | null, nowMs: number, skewMs = 60_000): boolean {
  if (!expiresAt) return true;
  return expiresAt * 1000 - nowMs <= skewMs;
}

export function singleFlight<T>(run: () => Promise<T>): () => Promise<T> {
  let flight: Promise<T> | null = null;
  return () => {
    if (!flight) {
      flight = run().finally(() => {
        flight = null;
      });
    }
    return flight;
  };
}

export async function refreshSupabaseSession(input: {
  supabaseUrl: string;
  anonKey: string;
  refreshToken: string;
  flavor?: DataFlavor;
  fetchImpl: FetchLike;
  nowMs?: number;
}): Promise<RefreshSuccess | RefreshFailure> {
  const base = acceptedSupabaseUrl(input.supabaseUrl, dataFlavor(input.flavor));
  if (!base || !input.anonKey.trim() || !input.refreshToken.trim()) return { ok: false, dead: true };
  let res: { status: number; text: () => Promise<string> };
  try {
    res = await input.fetchImpl(`${base}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        apikey: input.anonKey,
        authorization: `Bearer ${input.anonKey}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({ refresh_token: input.refreshToken }),
    });
  } catch {
    return { ok: false, dead: false };
  }
  const text = await res.text();
  if (res.status === 400 || res.status === 401) return { ok: false, dead: true };
  if (res.status >= 400) return { ok: false, dead: false };
  try {
    const json = JSON.parse(text) as { access_token?: unknown; refresh_token?: unknown; expires_at?: unknown; expires_in?: unknown };
    if (typeof json.access_token !== "string" || typeof json.refresh_token !== "string") return { ok: false, dead: true };
    const now = input.nowMs ?? Date.now();
    const expiresAt = typeof json.expires_at === "number"
      ? json.expires_at
      : typeof json.expires_in === "number"
        ? Math.floor(now / 1000) + json.expires_in
        : null;
    return { ok: true, accessToken: json.access_token, refreshToken: json.refresh_token, expiresAt };
  } catch {
    return { ok: false, dead: false };
  }
}
