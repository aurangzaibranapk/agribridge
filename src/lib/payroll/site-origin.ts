import { headers } from "next/headers";

/** Is request ka asal pata (QR ke liye) -- NEXT_PUBLIC_SITE_URL ho to wahi. */
export function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "agribridge.pk";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
