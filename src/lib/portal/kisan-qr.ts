/**
 * Kisan card ka QR token -- HMAC-SHA256, chhoti muddat.
 * Token mein sirf farmer id + expiry hai; balance KABHI nahi.
 * Secret sirf server .env (KISAN_QR_SECRET) se. Secret na ho = QR nahi.
 */
import { createHmac, timingSafeEqual } from "crypto";

export const KISAN_QR_TTL_SEC = 10 * 60;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const sigOf = (body: string, secret: string) => createHmac("sha256", secret).update(`kisan-qr|${body}`).digest("base64url").slice(0, 22);

export function kisanQrSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = env.KISAN_QR_SECRET;
  return s && s.length >= 16 ? s : null;
}

export function signKisanQr(farmerId: string, secret: string, nowSec = Math.floor(Date.now() / 1000), ttl = KISAN_QR_TTL_SEC): string {
  if (!UUID_RE.test(farmerId)) throw new Error("farmer id ghalat");
  const body = `k1.${farmerId.replace(/-/g, "").toLowerCase()}.${(nowSec + ttl).toString(36)}`;
  return `${body}.${sigOf(body, secret)}`;
}

export type KisanQrResult = { ok: true; farmerId: string; exp: number } | { ok: false; reason: "malformed" | "bad_signature" | "expired" };

export function verifyKisanQr(token: string | null | undefined, secret: string, nowSec = Math.floor(Date.now() / 1000)): KisanQrResult {
  const p = String(token ?? "").split(".");
  if (p.length !== 4 || p[0] !== "k1" || !/^[0-9a-f]{32}$/.test(p[1]) || !/^[0-9a-z]{1,10}$/.test(p[2])) return { ok: false, reason: "malformed" };
  const body = p.slice(0, 3).join(".");
  const a = Buffer.from(sigOf(body, secret)), b = Buffer.from(p[3]);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, reason: "bad_signature" };
  const exp = parseInt(p[2], 36);
  if (!Number.isFinite(exp) || nowSec > exp) return { ok: false, reason: "expired" };
  const h = p[1];
  return { ok: true, farmerId: `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`, exp };
}

export const KISAN_SCAN_PATH = "/admin/kisan-scan";
