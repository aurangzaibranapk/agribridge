/**
 * Intent: AI / keyword SIRF samajhta hai ke kya poocha gaya. Ye kuch likhta
 * nahi. Har intent ek band fehrist mein se -- AI kuch aur kahe to "unknown".
 */
export const READ_INTENTS = ["today_sales", "cash_position", "pending_approvals", "my_work", "my_khata", "my_bills", "my_orders", "help"] as const;
export const ACTION_INTENTS = ["approve", "reject", "new_order", "stock_transfer", "payment_entry", "demand"] as const;
export type ReadIntent = (typeof READ_INTENTS)[number];
export type ActionIntent = (typeof ACTION_INTENTS)[number];
export type Intent = ReadIntent | ActionIntent | "unknown";

export function isRead(i: Intent): i is ReadIntent {
  return (READ_INTENTS as readonly string[]).includes(i);
}
export function isAction(i: Intent): i is ActionIntent {
  return (ACTION_INTENTS as readonly string[]).includes(i);
}

const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/\s+/g, " ").trim();
const has = (t: string, words: string[]) => words.some((w) => (` ${t} `).includes(` ${w} `) || (w.includes(" ") && t.includes(w)));

// Tarteeb aham: pehle saaf "kaam" (approve / order ...), phir sawal, aakhir mein "chahiye" (demand).
const RULES: [Intent, string[]][] = [
  ["approve", ["approve", "manzoor", "منظور", "pass kar", "approve kar"]],
  ["reject", ["reject", "radd", "rad kar", "مسترد"]],
  ["stock_transfer", ["transfer", "muntaqil", "bhej do godam", "dispatch"]],
  ["new_order", ["order do", "order kar", "order chahiye", "naya order", "mangwa", "آرڈر"]],
  ["payment_entry", ["payment entry", "raqam darj", "wasooli darj", "jama kar"]],
  ["today_sales", ["sale", "sales", "bikri", "سیل", "بکری", "aaj ki sale"]],
  ["cash_position", ["cash position", "kitna cash", "cash kitna", "naqd kitna", "bank balance", "cash batao", "کیش کتنا"]],
  ["pending_approvals", ["pending", "approvals", "baqi kaam", "baqi approvals", "منظوری"]],
  ["my_work", ["mera kaam", "mere kaam", "my work", "aaj ka kaam", "میرا کام"]],
  ["my_orders", ["order", "orders", "order status", "آرڈر"]],
  ["my_bills", ["bill", "bills", "akhri bill", "بل"]],
  ["my_khata", ["khata", "baqaya", "balance", "hisaab", "hisab", "udhaar", "کھاتہ", "بقایا", "حساب"]],
  ["demand", ["chahiye", "chahie", "demand", "zaroorat", "چاہیے"]],
  ["help", ["help", "menu", "madad", "kya kar sakte", "مدد"]],
];

export function parseIntentKeywords(text: string | null | undefined): Intent {
  const t = norm(text ?? "");
  if (!t) return "unknown";
  if (t === "hi" || t === "salam" || t === "assalam o alaikum" || t === "aoa") return "help";
  for (const [intent, words] of RULES) if (has(t, words)) return intent;
  return "unknown";
}

/** AI ka jawab sirf tab qubool jab wo band fehrist mein ho. */
export function acceptAiIntent(raw: unknown): Intent {
  const v = String(raw ?? "").trim().toLowerCase();
  return (isRead(v as Intent) || isAction(v as Intent)) ? (v as Intent) : "unknown";
}

export async function parseIntent(text: string, ai?: (text: string) => Promise<unknown>): Promise<Intent> {
  const k = parseIntentKeywords(text);
  if (k !== "unknown" || !ai) return k;
  try {
    return acceptAiIntent(await ai(text));
  } catch {
    return "unknown";
  }
}
