/**
 * Kisan Wallet v2 ("bank card" naya andaz) -- pure mapping, koi DB call nahi.
 * Flag KISAN_WALLET_V2 band ho to purana /portal/wallet bilkul waisa hi.
 */
import type { StatementRow } from "./khata";

export type WLang = "en" | "rm" | "ur";

export function kisanWalletV2Enabled(env: Record<string, string | undefined> = process.env): boolean {
  const v = String(env.KISAN_WALLET_V2 ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "on" || v === "yes";
}

/** Flag on + user ne "classic" na chuna ho. */
export function showWalletV2(env: Record<string, string | undefined>, look: string | string[] | undefined): boolean {
  if (!kisanWalletV2Enabled(env)) return false;
  const l = Array.isArray(look) ? look[0] : look;
  return l !== "classic";
}

export interface FarmerCardRow {
  id: string;
  full_name: string | null;
  farmer_code: string | null;
  profile_photo_url?: string | null;
  member_photo_url?: string | null;
  created_at?: string | null;
  credit_limit?: number | string | null;
  whatsapp_number?: string | null;
  phone_number?: string | null;
}
export interface BookingRow { acres: number | string | null; status: string | null; created_at?: string | null; campaign?: { name?: string | null; crop?: string | null; is_active?: boolean | null } | null }

export interface WalletEntry { date: string | null; category: string; label: string; amount: number; direction: "udhaar" | "adaigi"; ref: string | null }
export interface WalletV2Data {
  name: string; nameCaps: string; code: string; cardNumber: string; memberSince: string | null;
  photo: string | null; initials: string; mobile: string | null; mobileMasked: string | null;
  baqaya: number; creditLimit: number | null; gunjaish: number | null; usedPct: number | null;
  plan: { label: string; acres: number | null } | null; entries: WalletEntry[];
}

const n = (v: unknown) => { const x = Number(v ?? 0); return Number.isFinite(x) ? x : 0; };

/** FRM-000003 -> "**** **** **** 0003" (sirf code ke aakhri 4 hindse). */
export function cardNumber(code: string | null | undefined): string {
  const d = String(code ?? "").replace(/\D/g, "");
  return `**** **** **** ${(d.slice(-4) || "0000").padStart(4, "0")}`;
}
export function memberSince(created: string | null | undefined): string | null {
  if (!created) return null;
  const m = /^(\d{4})-(\d{2})/.exec(created);
  return m ? `${m[2]}/${m[1].slice(2)}` : null;
}
export function initials(name: string | null | undefined): string {
  const p = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "K") + (p[1]?.[0] ?? "")).toUpperCase();
}
/** 03457583294 -> "0345 7583294"; masked -> "0345 ••• ••94". */
export function formatMobile(raw: string | null | undefined): { plain: string; masked: string } | null {
  let d = String(raw ?? "").replace(/\D/g, "");
  if (d.startsWith("92") && d.length === 12) d = `0${d.slice(2)}`;
  if (d.length < 7) return null;
  return { plain: `${d.slice(0, 4)} ${d.slice(4)}`, masked: `${d.slice(0, 4)} ••• ••${d.slice(-2)}` };
}

/** Aakhri 3 asal entries (opening/sifar wali nahi), naya pehle. */
export function lastEntries(rows: StatementRow[], count = 3): WalletEntry[] {
  return rows
    .filter((r) => !r.is_opening && (r.udhaar > 0 || r.adaigi > 0))
    .sort((a, b) => String(b.entry_date ?? "").localeCompare(String(a.entry_date ?? "")))
    .slice(0, count)
    .map((r) => ({
      date: r.entry_date, category: r.category || "deegar", label: r.tafseel || r.category || "",
      amount: r.udhaar > 0 ? r.udhaar : r.adaigi, direction: r.udhaar > 0 ? "udhaar" : "adaigi", ref: r.ref,
    }));
}

/** Season plan: sab se nayi active booking (cancel/reject chhor kar). */
export function seasonPlan(bookings: BookingRow[] | null | undefined): { label: string; acres: number | null } | null {
  const ok = (bookings ?? []).filter((b) => !/cancel|reject/i.test(String(b.status ?? "")));
  if (!ok.length) return null;
  ok.sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")));
  const b = ok[0];
  const label = String(b.campaign?.crop || b.campaign?.name || "").trim();
  if (!label) return null;
  const acres = b.acres == null ? null : n(b.acres);
  return { label: label.charAt(0).toUpperCase() + label.slice(1), acres: acres && acres > 0 ? acres : null };
}

export function buildWalletV2(input: { farmer: FarmerCardRow; totalBaqi: number | null; summaryOwed: number | null; summaryCreditLimit?: number | null; rows: StatementRow[]; bookings?: BookingRow[] | null }): WalletV2Data {
  const f = input.farmer;
  const name = (f.full_name ?? "").trim() || (f.farmer_code ?? "Kisan");
  const baqaya = input.totalBaqi != null ? n(input.totalBaqi) : n(input.summaryOwed);
  const limRaw = f.credit_limit != null ? n(f.credit_limit) : input.summaryCreditLimit != null ? n(input.summaryCreditLimit) : 0;
  const creditLimit = limRaw > 0 ? limRaw : null;
  const used = Math.max(0, baqaya);
  const mob = formatMobile(f.whatsapp_number || f.phone_number);
  return {
    name, nameCaps: name.toUpperCase(), code: f.farmer_code ?? "", cardNumber: cardNumber(f.farmer_code),
    memberSince: memberSince(f.created_at), photo: f.profile_photo_url || f.member_photo_url || null, initials: initials(name),
    mobile: mob?.plain ?? null, mobileMasked: mob?.masked ?? null,
    baqaya, creditLimit,
    gunjaish: creditLimit == null ? null : Math.max(0, creditLimit - used),
    usedPct: creditLimit == null ? null : Math.min(100, Math.round((used / creditLimit) * 100)),
    plan: seasonPlan(input.bookings), entries: lastEntries(input.rows),
  };
}

export const CAT_ICON: Record<string, string> = {
  khaad: "🌱", karyana: "🛒", vets: "💉", dukaan: "🏪", naqad: "💵", purana: "📜", doodh: "🥛", gandum: "🌾",
  machinery: "🚜", qist: "📅", adaigi: "✅", deegar: "•",
};
export const catIcon = (c: string) => CAT_ICON[c] ?? CAT_ICON.deegar;

export const W_TXT = {
  title: { en: "Kisan Card", rm: "Kisan Card", ur: "کسان کارڈ" },
  baqaya: { en: "Total balance due", rm: "Kul baqaya", ur: "کل بقایا" },
  receive: { en: "Shop owes you", rm: "Dukaan ne aap ko dena hai", ur: "دکان نے آپ کو دینا ہے" },
  limit: { en: "Credit limit", rm: "Udhaar ki had", ur: "ادھار کی حد" },
  avail: { en: "Available", rm: "Baqi gunjaish", ur: "باقی گنجائش" },
  khata: { en: "View khata", rm: "Khata dekhein", ur: "کھاتہ دیکھیں" },
  pay: { en: "Payment", rm: "Adaigi", ur: "ادائیگی" },
  order: { en: "Order", rm: "Order", ur: "آرڈر" },
  recent: { en: "Recent entries", rm: "Haal ki len-den", ur: "حالیہ لین دین" },
  none: { en: "No entries yet", rm: "Abhi koi entry nahi", ur: "ابھی کوئی اندراج نہیں" },
  hide: { en: "Hide amounts", rm: "Raqam chhupayein", ur: "رقم چھپائیں" },
  show: { en: "Show amounts", rm: "Raqam dikhayein", ur: "رقم دکھائیں" },
  flip: { en: "Flip card", rm: "Card palatein", ur: "کارڈ پلٹیں" },
  since: { en: "Member since", rm: "Member since", ur: "ممبر از" },
  plan: { en: "Season plan", rm: "Season plan", ur: "سیزن پلان" },
  acre: { en: "acre", rm: "acre", ur: "ایکڑ" },
  mobile: { en: "Mobile", rm: "Mobile", ur: "موبائل" },
  helpline: { en: "Helpline", rm: "Helpline", ur: "ہیلپ لائن" },
  fine: {
    en: "Scan only by logged-in AgriBridge staff. QR has no balance. If found, please return to AgriBridge.",
    rm: "Sirf login kiya hua AgriBridge staff scan kar sakta hai. QR mein balance nahi. Mile to AgriBridge ko wapas karein.",
    ur: "صرف لاگ اِن AgriBridge اسٹاف اسکین کر سکتا ہے۔ QR میں بیلنس نہیں۔ ملے تو AgriBridge کو واپس کریں۔",
  },
  noQr: { en: "QR not set up yet", rm: "QR abhi set nahi", ur: "QR ابھی سیٹ نہیں" },
  classic: { en: "Classic", rm: "Purana", ur: "پرانا" },
  newLook: { en: "New look", rm: "Naya andaz", ur: "نیا انداز" },
  udhaar: { en: "Credit", rm: "Udhaar", ur: "ادھار" },
  adaigi: { en: "Paid", rm: "Adaigi", ur: "ادائیگی" },
} as const;
export const wt = (k: keyof typeof W_TXT, l: WLang) => W_TXT[k][l];

export const HELPLINE = "0322 6275476";
