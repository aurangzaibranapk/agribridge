/**
 * Glassy UI (owner approved 20 Oct 2026) -- pure helpers, koi DB call nahi.
 * Wallet card, payment summary aur receipt-print animation yahin se.
 */
import { BRAND_NAME, BRAND_TAGLINE } from "@/lib/brand";
export type GLang = "en" | "rm" | "ur";

/** FRM-000047 -> "FRM •••• •••• 0047" (sirf aakhri 4 hindse). */
export function maskFrm(code: string | null | undefined): string {
  const d = String(code ?? "").replace(/\D/g, "");
  const prefix = (String(code ?? "").match(/^[A-Za-z]+/)?.[0] ?? "FRM").toUpperCase();
  return `${prefix} •••• •••• ${(d.slice(-4) || "0000").padStart(4, "0")}`;
}

export const rsFmt = (v: number) => `Rs ${Math.round(Math.abs(Number(v) || 0)).toLocaleString("en-PK")}`;

/**
 * Payment modal ka "balance ke baad" preview. Sirf dikhane ke liye --
 * posting ka hisaab server karta hai; ye us ko nahi chhoota.
 */
export function paymentPreview(input: { direction: "pay" | "receive"; amount: number | string | null | undefined; accountBalance: number | null | undefined }) {
  const amount = Math.max(0, Number(input.amount) || 0);
  const bal = input.accountBalance == null ? null : Number(input.accountBalance) || 0;
  const after = bal == null ? null : input.direction === "pay" ? bal - amount : bal + amount;
  return { amount, before: bal, after, short: input.direction === "pay" && bal != null && amount > bal };
}

/** "Bank Alfalah — Rs 401,235" -> "Bank Alfalah" (option text se naam). */
export function optionName(text: string | null | undefined): string {
  return String(text ?? "").split(" — ")[0].trim();
}

export interface ReceiptData {
  kind: "payment" | "pos" | "wallet";
  no: string;
  date: string;
  from?: string | null;
  to?: string | null;
  amount: number;
  lines?: Array<[string, string]>;
}

export function receiptText(r: ReceiptData): string {
  const head = r.kind === "pos" ? "POS Raseed" : r.kind === "wallet" ? "Wallet Jama Raseed" : "Payment Raseed";
  const flow = r.from || r.to ? `${r.from ?? "—"} se -> ${r.to ?? "—"}` : "";
  return [
    BRAND_NAME, BRAND_TAGLINE, head, `Raseed #: ${r.no}`, `Tarikh: ${r.date}`, flow, `Raqam: ${rsFmt(r.amount)}`,
    ...(r.lines ?? []).map(([a, b]) => `${a}: ${b}`),
  ].filter(Boolean).join("\n");
}

/** Sirf wa.me link -- WhatsApp khulta hai, khud kuch nahi bhejta. */
export function receiptWhatsAppUrl(r: ReceiptData, phone?: string | null): string {
  let d = String(phone ?? "").replace(/\D/g, "");
  if (d.startsWith("0") && d.length === 11) d = `92${d.slice(1)}`;
  const base = d.length >= 11 ? `https://wa.me/${d}` : "https://wa.me/";
  return `${base}?text=${encodeURIComponent(receiptText(r))}`;
}

export const SOUND_KEY = "ab_receipt_sound";
/** Awaaz default BAND; sirf "1" par on. */
export function soundOn(stored: string | null | undefined): boolean {
  return stored === "1";
}
/** prefers-reduced-motion par animation nahi, seedha poori raseed. */
export function printFrames(reduced: boolean): number[] {
  return reduced ? [100] : [0, 15, 35, 55, 75, 100];
}

export const QUEUE_KEY = "ab_receipt_queue";

export const HELPLINE_E164 = "923226275476";
/** "Nikalwayein": sirf WhatsApp khulta hai (prefilled), khud kuch nahi jata; staff maker-checker se karta hai. */
export function withdrawLink(code: string | null | undefined): string {
  return `https://wa.me/${HELPLINE_E164}?text=${encodeURIComponent(`Assalam o alaikum, mujhe wallet se paisa nikalwana hai. Kisan code: ${code ?? ""}`)}`;
}
