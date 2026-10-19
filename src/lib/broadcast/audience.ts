/**
 * Audience builder. Server candidates load karta hai (load-audience.ts), yeh pure
 * function filter / dedupe / scoping karta hai -- test ke qabil.
 */
import { normalizePkMobile } from "./text";

export type AudienceRole = "farmers" | "customers" | "staff" | "all" | "custom";
export type PartyType = "farmer" | "customer" | "staff" | "custom";

export interface AudienceSpec {
  role: AudienceRole;
  villages?: string[];          // farmers / customers (farmer se jure)
  campaignIds?: string[];       // season plan (Gandum / Munji) ke shurakaa
  udhaarDays?: number | null;   // itne din se purana baqaya
  udhaarMin?: number | null;    // kam az kam raqam
  dairyOnly?: boolean;          // doodh dene wale
  departments?: string[];       // staff
  pickedIds?: string[];         // naam se chune hue (party ids)
  csv?: { name: string; phone: string }[]; // custom numbers
}

export interface Candidate {
  type: PartyType;
  id: string | null;
  name: string;
  phone: string | null;
  lang?: "en" | "rm" | "ur";
  village?: string | null;
  department?: string | null;
  campaignIds?: string[];
  udhaarDays?: number | null;
  balance?: number | null;
  dairy?: boolean;
}

export interface Recipient { party_type: PartyType; party_id: string | null; name: string; phone: string; lang: "en" | "rm" | "ur"; vars: Record<string, string> }

const ROLE_TYPES: Record<AudienceRole, PartyType[]> = {
  farmers: ["farmer"], customers: ["customer"], staff: ["staff"], all: ["farmer", "customer", "staff"], custom: [],
};

const lc = (s: string | null | undefined) => String(s ?? "").trim().toLowerCase();
const fmtRs = (n: number | null | undefined) => (n == null ? "" : `Rs ${Math.round(n).toLocaleString("en-US")}`);

export function applyAudience(cands: Candidate[], spec: AudienceSpec, season = ""): { recipients: Recipient[]; noNumber: number; duplicates: number } {
  const types = new Set(ROLE_TYPES[spec.role] ?? []);
  const villages = new Set((spec.villages ?? []).map(lc).filter(Boolean));
  const camps = new Set(spec.campaignIds ?? []);
  const depts = new Set(spec.departments ?? []);
  const picked = new Set(spec.pickedIds ?? []);
  const pickedOnly = picked.size > 0;
  const keep = cands.filter((c) => {
    if (pickedOnly) return c.id != null && picked.has(c.id) && (spec.role === "custom" || types.has(c.type));
    if (!types.has(c.type)) return false;
    if (villages.size && c.type !== "staff" && !villages.has(lc(c.village))) return false;
    if (camps.size && !(c.campaignIds ?? []).some((x) => camps.has(x))) return false;
    if (spec.udhaarDays != null && spec.udhaarDays > 0 && !((c.udhaarDays ?? -1) >= spec.udhaarDays)) return false;
    if (spec.udhaarMin != null && spec.udhaarMin > 0 && !((c.balance ?? 0) >= spec.udhaarMin)) return false;
    if (spec.dairyOnly && !c.dairy) return false;
    if (depts.size && (c.type !== "staff" || !depts.has(String(c.department ?? "")))) return false;
    return true;
  });
  const extra: Candidate[] = (spec.csv ?? []).map((r) => ({ type: "custom", id: null, name: String(r.name ?? "").slice(0, 120), phone: r.phone }));
  const seen = new Set<string>();
  let noNumber = 0, duplicates = 0;
  const recipients: Recipient[] = [];
  for (const c of [...keep, ...extra]) {
    const phone = normalizePkMobile(c.phone);
    if (!phone) { noNumber++; continue; }
    if (seen.has(phone)) { duplicates++; continue; }
    seen.add(phone);
    recipients.push({
      party_type: c.type, party_id: c.id, name: c.name || "—", phone, lang: c.lang ?? "rm",
      vars: { naam: c.name || "", baqi_raqam: fmtRs(c.balance), gaon: c.village ?? "", season },
    });
  }
  return { recipients, noNumber, duplicates };
}

/** CSV: "name,phone" (header ho ya na ho). Ziada se ziada 5000 qataarein. */
export function parseCsv(text: string): { name: string; phone: string }[] {
  return String(text ?? "").split(/\r?\n/).map((l) => l.split(",").map((x) => x.trim().replace(/^"|"$/g, "")))
    .filter((p) => p.length >= 2 && /\d{7,}/.test(p[1].replace(/\D/g, "")))
    .slice(0, 5000).map(([name, phone]) => ({ name, phone }));
}
