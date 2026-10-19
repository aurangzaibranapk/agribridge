/**
 * WhatsApp Chat Inbox -- pure qaide (UI aur tests dono yahi parhte hain).
 * DB (614-617) asal rok hai; ye sirf dikhane / jaldi rokne ke liye.
 */
export type InboxLang = "en" | "rm" | "ur";
export type PartyKind = "owner" | "admin" | "staff" | "farmer" | "customer" | "unknown" | "ambiguous";
export const FILTERS = ["all", "farmer", "customer", "staff", "unknown", "unread", "mine"] as const;
export type InboxFilter = (typeof FILTERS)[number];
export const DRAFT_KINDS = ["order", "payment", "demand"] as const;
export type DraftKind = (typeof DRAFT_KINDS)[number];

export interface ConversationRow {
  id: string; phone_key: string; phone_display: string | null; title: string; party_kind: PartyKind;
  farmer_id: string | null; customer_id: string | null; branch_id: string | null; department_key: string | null;
  assigned_to: string | null; assigned_name: string | null; unread_count: number;
  last_inbound_at: string | null; last_outbound_at: string | null; last_preview: string | null;
  is_naya: boolean; pending_since: string | null; stuck_with: string | null; window_open: boolean;
}
export interface MessageRow {
  id: string; direction: "in" | "out"; msg_type: "text" | "image" | "audio" | "template" | "other";
  body: string | null; media_url?: string | null; media_mime: string | null; transcript: string | null;
  ai_intent: string | null; ai_draft: string | null; sent_by_name?: string | null; send_status: string | null;
  created_at: string;
}
export interface Party360 {
  party_kind: PartyKind; balance: number; credit_limit: number | null;
  bills: { ref: string; amount: number; status: string; at: string }[];
  orders: { ref: string; amount: number; status: string; at: string }[];
  season: { campaign: string; crop: string | null; acres: number | null; status: string }[];
  promises: { amount: number; date: string; status: string }[];
}
export interface TemplateRow { key: string; label: string; body_preview: string; param_count: number }

export const WINDOW_MS = 24 * 3600 * 1000;
export const WINDOW_MARGIN_MS = 10 * 60 * 1000;

export function parseFilter(v: unknown): InboxFilter {
  return (FILTERS as readonly string[]).includes(String(v)) ? (v as InboxFilter) : "all";
}

/** 24h window: Meta free-text sirf aakhri inbound ke 24 ghante (10 min hifazat) tak. */
export function windowState(lastInboundAt: string | null, now = Date.now()) {
  const t = lastInboundAt ? Date.parse(lastInboundAt) : NaN;
  if (!Number.isFinite(t)) return { open: false, msLeft: 0 };
  const left = t + WINDOW_MS - WINDOW_MARGIN_MS - now;
  return { open: left > 0, msLeft: Math.max(0, left) };
}

export function hoursMinutes(ms: number) {
  const m = Math.floor(ms / 60000);
  return { h: Math.floor(m / 60), m: m % 60 };
}

/** "Pending 6 ghante se" / "2 din se" -- null agar jawab ho chuka. */
export function pendingAge(since: string | null, now = Date.now()): { n: number; unit: "min" | "hours" | "days" } | null {
  if (!since) return null;
  const ms = now - Date.parse(since);
  if (!Number.isFinite(ms) || ms < 0) return { n: 0, unit: "min" };
  if (ms < 3600e3) return { n: Math.floor(ms / 60e3), unit: "min" };
  if (ms < 48 * 3600e3) return { n: Math.floor(ms / 3600e3), unit: "hours" };
  return { n: Math.floor(ms / 86400e3), unit: "days" };
}
/** 6 ghante se zyada = gehra laal (urgent). */
export function pendingUrgent(since: string | null, now = Date.now()) {
  return !!since && now - Date.parse(since) >= 6 * 3600e3;
}

/** Bhejne ka faisla: khali, window band (template chahiye), ya sab theek. */
export function sendCheck(input: { text: string; templateKey: string | null; params: string[]; templateParamCount: number | null; lastInboundAt: string | null; now?: number }):
  { ok: true; mode: "text" | "template" } | { ok: false; reason: "empty" | "window_closed" | "template_params" } {
  const w = windowState(input.lastInboundAt, input.now);
  if (input.templateKey) {
    if (input.params.length !== (input.templateParamCount ?? -1) || input.params.some((p) => !p.trim())) return { ok: false, reason: "template_params" };
    return { ok: true, mode: "template" };
  }
  if (!w.open) return { ok: false, reason: "window_closed" };
  if (!input.text.trim()) return { ok: false, reason: "empty" };
  return { ok: true, mode: "text" };
}

/** Quick action kis par chal sakta hai (DB bhi yahi rokta hai). */
export function draftAllowed(kind: DraftKind, party: PartyKind, hasFarmer: boolean): boolean {
  if (party === "unknown" || party === "ambiguous") return false;
  if (kind === "demand") return hasFarmer;
  return true;
}
export function canLink(party: PartyKind, isAdmin: boolean) {
  return party === "unknown" || party === "ambiguous" || isAdmin;
}

export function rs(n: number | string | null | undefined) {
  return `Rs ${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
}

const D = {
  title: { en: "WhatsApp Inbox", rm: "WhatsApp Inbox", ur: "واٹس ایپ اِن باکس" },
  search: { en: "Search name, number, message…", rm: "Naam, number, paigham talash…", ur: "نام، نمبر، پیغام تلاش…" },
  f_all: { en: "All", rm: "Sab", ur: "سب" },
  f_farmer: { en: "Farmers", rm: "Kisan", ur: "کسان" },
  f_customer: { en: "Customers", rm: "Customers", ur: "گاہک" },
  f_staff: { en: "Staff", rm: "Staff", ur: "عملہ" },
  f_unknown: { en: "Anjaan numbers", rm: "Anjaan numbers", ur: "انجان نمبر" },
  f_unread: { en: "Unread", rm: "Na-parhe", ur: "نہ پڑھے" },
  f_mine: { en: "Assigned to me", rm: "Mere zimme", ur: "میرے ذمے" },
  naya: { en: "Naya", rm: "Naya", ur: "نیا" },
  pending: { en: "Pending", rm: "Pending", ur: "زیرِ التوا" },
  u_min: { en: "min se", rm: "min se", ur: "منٹ سے" },
  u_hours: { en: "ghante se", rm: "ghante se", ur: "گھنٹے سے" },
  u_days: { en: "din se", rm: "din se", ur: "دن سے" },
  with: { en: "with", rm: "paas:", ur: "کے پاس" },
  win_open: { en: "24h window open · {h}h {m}m left", rm: "24 ghante ki khirki khuli · {h}g {m}m baqi", ur: "24 گھنٹے کی کھڑکی کھلی · {h} گھنٹے {m} منٹ باقی" },
  win_closed: { en: "24h window closed — approved templates only", rm: "24 ghante guzar gaye — sirf manzoor template", ur: "24 گھنٹے گزر گئے — صرف منظور شدہ ٹیمپلیٹ" },
  template: { en: "Template", rm: "Template", ur: "ٹیمپلیٹ" },
  no_tpl: { en: "No approved template yet", rm: "Abhi koi manzoor template nahi", ur: "ابھی کوئی منظور شدہ ٹیمپلیٹ نہیں" },
  draft: { en: "AI draft — edit, then press Bhejo", rm: "AI draft — theek karein, phir Bhejo", ur: "AI مسودہ — درست کریں، پھر بھیجو" },
  send: { en: "Bhejo", rm: "Bhejo", ur: "بھیجو" },
  nosend: { en: "Nothing is sent automatically", rm: "Kuch khud nahi jata", ur: "کچھ خودبخود نہیں جاتا" },
  heard: { en: "Aap ne kaha", rm: "Aap ne kaha", ur: "آپ نے کہا" },
  assign: { en: "Assign", rm: "Sapurd", ur: "سپرد" },
  transfer: { en: "Transfer", rm: "Transfer", ur: "منتقل" },
  reason: { en: "Reason (required for transfer)", rm: "Wajah (transfer ke liye zaroori)", ur: "وجہ (منتقلی کے لیے لازمی)" },
  qa: { en: "Quick actions", rm: "Foran kaam", ur: "فوری کام" },
  q_order: { en: "Draft order", rm: "Order draft", ur: "آرڈر کا مسودہ" },
  q_payment: { en: "Draft payment", rm: "Payment draft", ur: "ادائیگی کا مسودہ" },
  q_demand: { en: "Draft demand", rm: "Demand draft", ur: "ڈیمانڈ کا مسودہ" },
  q_link: { en: "Link number", rm: "Number jorein", ur: "نمبر جوڑیں" },
  to_app: { en: "→ goes to Approvals", rm: "→ Approvals mein jata hai", ur: "← منظوری میں جاتا ہے" },
  p360: { en: "Party 360", rm: "Party 360", ur: "پارٹی 360" },
  kh: { en: "Khata balance", rm: "Khata baqaya", ur: "کھاتہ بقایا" },
  limit: { en: "Limit", rm: "Hadd", ur: "حد" },
  bills: { en: "Recent bills / orders", rm: "Akhri bill / order", ur: "حالیہ بل / آرڈر" },
  season: { en: "Season plan", rm: "Season plan", ur: "سیزن پلان" },
  prom: { en: "Payment promises", rm: "Adaigi ke wade", ur: "ادائیگی کے وعدے" },
  none: { en: "Nothing yet", rm: "Abhi kuch nahi", ur: "ابھی کچھ نہیں" },
  pick: { en: "Pick a conversation", rm: "Koi conversation chunein", ur: "کوئی گفتگو منتخب کریں" },
  unlinked: { en: "Not linked to any party", rm: "Kisi party se nahi jura", ur: "کسی پارٹی سے نہیں جڑا" },
  sample: { en: "Sample data · preview", rm: "Namoona data · preview", ur: "نمونہ ڈیٹا · پیش منظر" },
  off: { en: "WhatsApp Inbox is switched off.", rm: "WhatsApp Inbox band hai.", ur: "واٹس ایپ اِن باکس بند ہے۔" },
  unassigned: { en: "Unassigned", rm: "Bina sapurd", ur: "بغیر سپرد" },
  back: { en: "Back", rm: "Wapas", ur: "واپس" },
  sent_by: { en: "sent by", rm: "bheja:", ur: "بھیجا:" },
} as const;
export type InboxKey = keyof typeof D;
export function tx(lang: InboxLang, k: InboxKey, vars: Record<string, string | number> = {}) {
  let s: string = D[k][lang] ?? D[k].en;
  for (const [a, b] of Object.entries(vars)) s = s.replace(`{${a}}`, String(b));
  return s;
}
export function pendingText(lang: InboxLang, since: string | null, now = Date.now()) {
  const a = pendingAge(since, now);
  if (!a) return null;
  return `${tx(lang, "pending")} ${a.n} ${tx(lang, a.unit === "min" ? "u_min" : a.unit === "hours" ? "u_hours" : "u_days")}`;
}

/** Ek hi DB fehrist (scope DB ne lagaya) se filter + ginti -- chips ke adad. */
export function applyFilter(rows: ConversationRow[], f: InboxFilter, me: string | null): ConversationRow[] {
  switch (f) {
    case "farmer": return rows.filter((r) => r.party_kind === "farmer");
    case "customer": return rows.filter((r) => r.party_kind === "customer");
    case "staff": return rows.filter((r) => ["staff", "admin", "owner"].includes(r.party_kind));
    case "unknown": return rows.filter((r) => r.party_kind === "unknown" || r.party_kind === "ambiguous");
    case "unread": return rows.filter((r) => r.unread_count > 0);
    case "mine": return rows.filter((r) => !!me && r.assigned_to === me);
    default: return rows;
  }
}
export function filterCounts(rows: ConversationRow[], me: string | null): Record<InboxFilter, number> {
  return Object.fromEntries(FILTERS.map((f) => [f, applyFilter(rows, f, me).length])) as Record<InboxFilter, number>;
}
