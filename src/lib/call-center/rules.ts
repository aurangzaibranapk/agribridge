/**
 * Call Center — qaiday jo UI, server aur SQL teeno ek jaise rakhte hain.
 * SQL (625) inhi adad par chalti hai. Test dono ko milata hai.
 */

export const CALL_CENTER_ROLE = "call_center_agent";

export const CATEGORIES = [
  "doodh",
  "khaad",
  "payment",
  "khata_ghalat",
  "delivery",
  "other",
] as const;

export type ComplaintCategory = (typeof CATEGORIES)[number];
export type ComplaintStatus = "open" | "in_progress" | "resolved";
export type PartyKind = "farmer" | "customer" | "dealer";
export type SlaTone = "on_time" | "near" | "late" | "none";

export interface CategoryRoute {
  department: "dairy" | "accounts" | "logistics" | "sales" | "general";
  priority: "high" | "normal";
  slaHours: number;
}

/** Khata ghalat mockup: Accounts, High, 24h. Baqi isi usool par. */
export const CATEGORY_ROUTE: Record<ComplaintCategory, CategoryRoute> = {
  doodh: { department: "dairy", priority: "high", slaHours: 24 },
  khaad: { department: "sales", priority: "normal", slaHours: 48 },
  payment: { department: "accounts", priority: "high", slaHours: 24 },
  khata_ghalat: { department: "accounts", priority: "high", slaHours: 24 },
  delivery: { department: "logistics", priority: "normal", slaHours: 48 },
  other: { department: "general", priority: "normal", slaHours: 72 },
};

const DEPT_ROLES: Record<CategoryRoute["department"], readonly string[]> = {
  dairy: ["milk_collection"],
  accounts: ["finance"],
  logistics: ["warehouse"],
  sales: ["sales_staff"],
  general: ["admin", "admin_assistant"],
};

const OVERSIGHT = ["owner", "super_admin"];

export function isCallCenterRole(role: string | null | undefined, extra?: readonly string[] | null): boolean {
  if (role === CALL_CENTER_ROLE) return true;
  return (extra ?? []).includes(CALL_CENTER_ROLE);
}

/** 03221234576 -> 0322-*****76 (pehli 4, aakhri 2). */
export function maskPhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length < 6) return "****";
  const stars = "*".repeat(Math.max(4, digits.length - 6));
  return `${digits.slice(0, 4)}-${stars}${digits.slice(-2)}`;
}

export function formatComplaintNumber(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error("Complaint number 1 se shuru hota hai.");
  return `CMP-${String(n).padStart(6, "0")}`;
}

export function formatAgentCode(n: number): string {
  if (!Number.isInteger(n) || n < 1) throw new Error("Agent code 1 se shuru hota hai.");
  return `AGT-${String(n).padStart(4, "0")}`;
}

/** WhatsApp band hai. Sirf SMS. */
export function assertSmsChannel(channel: string): void {
  if (channel !== "sms") {
    throw new Error("Shikayat ka number sirf SMS se jaata hai. WhatsApp band hai.");
  }
}

export function routeFor(category: string): CategoryRoute | null {
  if (!CATEGORIES.includes(category as ComplaintCategory)) return null;
  return CATEGORY_ROUTE[category as ComplaintCategory];
}

export function departmentCanClose(roles: readonly string[], department: string): boolean {
  if (roles.some((r) => OVERSIGHT.includes(r))) return true;
  const allowed = DEPT_ROLES[department as CategoryRoute["department"]];
  if (!allowed) return false;
  return roles.some((r) => allowed.includes(r));
}

/**
 * Maker-checker: banane wala kabhi band nahi karta.
 * Call center ka ohda status badal hi nahi sakta.
 * Sirf assigned department (ya owner / super admin).
 */
export function mayResolve(args: {
  actorId: string;
  createdBy: string;
  actorRoles: readonly string[];
  department: string;
}): boolean {
  if (!args.actorId || args.actorId === args.createdBy) return false;
  if (args.actorRoles.includes(CALL_CENTER_ROLE)) return false;
  return departmentCanClose(args.actorRoles, args.department);
}

export function slaTone(status: string, createdAt: string, slaDue: string, now: Date): SlaTone {
  if (status === "resolved") return "none";
  const due = new Date(slaDue).getTime();
  const start = new Date(createdAt).getTime();
  const t = now.getTime();
  if (!Number.isFinite(due) || !Number.isFinite(start)) return "none";
  if (t > due) return "late";
  const window = Math.max(due - start, 1);
  const left = due - t;
  if (left / window <= 0.25) return "near";
  return "on_time";
}

export function ageLabel(createdAt: string, now: Date): string {
  const ms = now.getTime() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  if (mins < 60) return `${Math.max(mins, 1)}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

export const CATEGORY_LABEL: Record<ComplaintCategory, { en: string; rm: string; ur: string }> = {
  doodh: { en: "Doodh", rm: "Doodh", ur: "دودھ" },
  khaad: { en: "Khaad", rm: "Khaad", ur: "کھاد" },
  payment: { en: "Payment", rm: "Payment", ur: "ادائیگی" },
  khata_ghalat: { en: "Khata ghalat", rm: "Khata ghalat", ur: "کھاتہ غلط" },
  delivery: { en: "Delivery", rm: "Delivery", ur: "ڈلیوری" },
  other: { en: "Other", rm: "Other", ur: "دیگر" },
};

export const DEPT_LABEL: Record<CategoryRoute["department"], string> = {
  dairy: "Dairy",
  accounts: "Accounts",
  logistics: "Logistics",
  sales: "Sales",
  general: "Admin",
};
