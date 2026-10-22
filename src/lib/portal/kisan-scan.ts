import type { KisanQrResult } from "./kisan-qr";

export type ScanDecision = { kind: "login" } | { kind: "open"; href: string } | { kind: "error"; message: string };

/** Pure faisla: pehle staff login, phir token. */
export function kisanScanDecision(i: {
  auth: { caller: { role: string } } | { error: string; status: number };
  token: string | null; secret: string | null;
  verify: (t: string, s: string) => KisanQrResult;
}): ScanDecision {
  if ("error" in i.auth) return i.auth.status === 401 ? { kind: "login" } : { kind: "error", message: "Sirf AgriBridge staff ye card scan kar sakta hai." };
  if (!i.secret) return { kind: "error", message: "QR abhi set nahi (server par KISAN_QR_SECRET nahi)." };
  if (!i.token) return { kind: "error", message: "QR mein token nahi mila." };
  const r = i.verify(i.token, i.secret);
  if (!r.ok) return { kind: "error", message: r.reason === "expired" ? "Ye QR purana ho gaya hai. Kisan se card dobara kholne ko kahein." : "Ye QR sahi nahi hai." };
  return { kind: "open", href: `/admin/farmers/${r.farmerId}/statement` };
}
