// Server-only: preview token (node:crypto).
import { createHmac, timingSafeEqual } from "node:crypto";
import { PREVIEW_VALID_MINUTES } from "./core";

// Preview -> confirm token: wohi log, wohi admin, 10 minute ke andar.
function sig(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
export function signPreview(secret: string, actorId: string, userIds: string[], now = Date.now()): string {
  const exp = now + PREVIEW_VALID_MINUTES * 60_000;
  const payload = `${actorId}|${[...userIds].sort().join(",")}|${exp}`;
  return `${exp}.${sig(secret, payload)}`;
}
export function verifyPreview(secret: string, token: string, actorId: string, userIds: string[], now = Date.now()): boolean {
  const [expStr, s] = String(token ?? "").split(".");
  const exp = Number(expStr);
  if (!s || !Number.isFinite(exp) || exp < now) return false;
  const want = sig(secret, `${actorId}|${[...userIds].sort().join(",")}|${exp}`);
  const a = Buffer.from(s), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
}

