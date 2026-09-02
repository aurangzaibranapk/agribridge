import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import type { Action, DataScope } from "@/lib/access/types";

/**
 * Ijazat ka takraao (271) -- Separation of Duties.
 *
 * Usool (malik, 2 September):
 *  - Qawaid database mein (access_conflict_rules), code mein nahi.
 *  - Ye report aur mashwara hai: yahan se koi ijazat NAHI hatti. AI
 *    dhoondta hai, samjhata hai, behtar tarteeb batata hai; faisla insaan ka.
 *  - Manzoori se pehle jaanch: "is ijazat se ye takraao banega".
 *    - advise   -> batao, manzoori chal sakti hai (likha jata hai)
 *    - override -> HIGH/CRITICAL: sirf Owner/Admin, wajah + miyaad ke sath
 *    - block    -> koi nahi, override bhi nahi
 *  - Department head apni ceiling se bahar na takraao hal kare na de.
 *  - Har qadam access_conflict_events mein (append-only).
 */

export type Severity = "info" | "warning" | "high" | "critical";
export type Enforcement = "advise" | "override" | "block";

export const SEVERITY_RANK: Record<Severity, number> = { info: 1, warning: 2, high: 3, critical: 4 };
export const SEVERITY_LABEL: Record<Severity, string> = { info: "Info", warning: "Warning", high: "High", critical: "Critical" };

export interface MatchedDuty {
  duty: string;
  feature_key: string;
  actions: string[];
  scope: string;
  sources: string[];
  preview: boolean;
}

export interface ConflictRow {
  profile_id: string;
  full_name: string | null;
  role: string;
  rule_id: string | null;
  rule_code: string;
  kind: string;
  label: string;
  severity: Severity;
  enforcement: Enforcement;
  recommendation: string | null;
  matched: MatchedDuty[];
  fingerprint: string;
  involves_extra: boolean;
}

export interface ConflictPreview {
  /** Jo pehle se hain (is nayi ijazat ke baghair). */
  existing: ConflictRow[];
  /** Jo is nayi ijazat se banenge. */
  created: ConflictRow[];
  /** Sab se ooncha darja jo nayi ijazat se banta hai. */
  highest: Severity | null;
  /** Kisi block rule se takrata hai -- koi manzoor nahi kar sakta. */
  blocked: boolean;
  /** HIGH/CRITICAL override rule -- sirf Owner/Admin wajah likh kar. */
  needsOverride: boolean;
  /** Approver ko dikhane ke liye saade jumle. */
  messages: string[];
}

function normalize(rows: any[] | null): ConflictRow[] {
  return (rows ?? []).map((r) => ({
    ...r,
    matched: Array.isArray(r.matched) ? (r.matched as MatchedDuty[]) : [],
    involves_extra: !!r.involves_extra,
  })) as ConflictRow[];
}

/** Asal takraao (kisi ek ke liye ya sab ke liye). Kuch badalta nahi. */
export async function currentConflicts(profileId?: string | null): Promise<ConflictRow[]> {
  const service = createServiceClient();
  const { data, error } = await (service as any).rpc("fn_access_conflicts", { p_profile: profileId ?? null, p_extra_feature: null, p_extra_actions: null, p_extra_scope: null });
  if (error) return [];
  return normalize(data);
}

/**
 * "Agar ye ijazat bhi mil jaye to" -- manzoori se pehle ki jaanch.
 * created = wo takraao jo nayi ijazat ke sath hain magar pehle nahi the.
 */
export async function previewConflicts(profileId: string, featureKey: string, actions: Action[] | string[], scope: DataScope | string, targetName?: string | null): Promise<ConflictPreview> {
  const service = createServiceClient();
  const [{ data: before }, { data: after }] = await Promise.all([
    (service as any).rpc("fn_access_conflicts", { p_profile: profileId, p_extra_feature: null, p_extra_actions: null, p_extra_scope: null }),
    (service as any).rpc("fn_access_conflicts", { p_profile: profileId, p_extra_feature: featureKey, p_extra_actions: actions, p_extra_scope: scope }),
  ]);
  return diffConflicts(normalize(before), normalize(after), targetName ?? null, featureKey);
}

/**
 * Pehle aur baad ka farq (khalis function -- test ke liye alag).
 * Naya = pehle tha hi nahi, ya tha magar darja upar chala gaya (warning -> high).
 */
export function diffConflicts(existing: ConflictRow[], afterRows: ConflictRow[], targetName: string | null, featureKey?: string | null): ConflictPreview {
  const beforeKey = new Map(existing.map((r) => [r.fingerprint, r]));
  const created = afterRows.filter((r) => {
    const prev = beforeKey.get(r.fingerprint);
    if (!prev) return r.involves_extra;
    return r.involves_extra && SEVERITY_RANK[r.severity] > SEVERITY_RANK[prev.severity];
  });
  let highest: Severity | null = null;
  for (const c of created) if (!highest || SEVERITY_RANK[c.severity] > SEVERITY_RANK[highest]) highest = c.severity;
  const blocked = created.some((c) => c.enforcement === "block");
  const needsOverride = !blocked && created.some((c) => c.enforcement === "override" && SEVERITY_RANK[c.severity] >= SEVERITY_RANK.high);
  const messages = created.map((c) => explainConflict(c, targetName, featureKey));
  return { existing, created, highest, blocked, needsOverride, messages };
}

/**
 * Saada jumla, malik ke namoone par:
 * "High Access Conflict: Ahmed ke paas Supplier Payment Create aur Supplier
 *  Payment Verify already hai. Payment Reverse dene se ek hi user payment
 *  create, verify aur reverse kar sakega. Recommended: ..."
 */
export function explainConflict(c: ConflictRow, targetName: string | null, newFeature?: string | null): string {
  const name = targetName || c.full_name || "Is user";
  const have = c.matched.filter((m) => !m.preview);
  const adding = c.matched.filter((m) => m.preview);
  const fmt = (m: MatchedDuty) => `${m.duty} (${m.feature_key}: ${m.actions.join("/")}, ${m.scope})`;
  const parts: string[] = [];
  parts.push(`${SEVERITY_LABEL[c.severity]} Access Conflict [${c.rule_code}]: ${c.label}.`);
  if (have.length) parts.push(`${name} ke paas ${have.map(fmt).join(" aur ")} already hai.`);
  if (adding.length) {
    const all = c.matched.map((m) => m.duty);
    parts.push(`${adding.map((m) => `${m.feature_key} (${m.actions.join("/")})`).join(", ")} dene se ek hi user ${[...new Set(all)].join(", ")} sab kar sakega.`);
  } else if (newFeature) {
    parts.push(`${newFeature} dene ke baad ye takraao is darje par aa jata hai.`);
  }
  if (c.enforcement === "block") parts.push("Policy: hard block -- ye combination kisi ko nahi di ja sakti.");
  else if (c.enforcement === "override" && SEVERITY_RANK[c.severity] >= SEVERITY_RANK.high) parts.push("Sirf Owner/Admin wajah aur miyaad likh kar override kar sakta hai.");
  if (c.recommendation) parts.push(`Recommended: ${c.recommendation}`);
  return parts.join(" ");
}

export function canOverride(role: string): boolean {
  return UNRESTRICTED_ROLES.includes(role);
}

/** Findings (scan ka nateeja) -- sirf parhne ke liye. */
export async function loadFindings(opts?: { status?: string[]; profileId?: string }) {
  const service = createServiceClient();
  let q = service
    .from("access_conflict_findings" as never)
    .select("*, profiles!access_conflict_findings_profile_id_fkey(full_name, role), by:profiles!access_conflict_findings_status_by_fkey(full_name)")
    .order("last_seen_at", { ascending: false })
    .limit(500);
  if (opts?.status?.length) q = q.in("status", opts.status);
  if (opts?.profileId) q = q.eq("profile_id", opts.profileId);
  const { data } = await q;
  return (data ?? []) as any[];
}

/** Scan chalao: sirf report banti hai, ijazat nahi badalti. */
export async function runConflictScan(actorId: string, trigger: "manual" | "approval" | "scheduled" = "manual"): Promise<{ ok: boolean; scanId?: string; message: string }> {
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("role, is_active").eq("id", actorId).maybeSingle();
  if (!me?.is_active) return { ok: false, message: "Account fa'aal nahi." };
  const { data, error } = await (service as any).rpc("fn_run_access_conflict_scan", { p_trigger: trigger, p_actor: actorId });
  if (error) return { ok: false, message: error.message };
  const { data: scan } = await service.from("access_conflict_scans" as never).select("findings, new_findings, resolved, by_severity").eq("id", data).maybeSingle();
  const s = scan as any;
  return { ok: true, scanId: data, message: `Scan ho gaya: ${s?.findings ?? "—"} takraao (${s?.new_findings ?? 0} naye, ${s?.resolved ?? 0} khatam). Kuch hataya nahi gaya.` };
}

/**
 * Finding ka darja badalna: acknowledged (dekh liya), overridden (jaan
 * boojh kar rehne diya -- sirf Owner/Admin, wajah + miyaad), open (wapas).
 * Ijazat yahan se NAHI hatti -- wo /admin/permissions ya darkhwast se.
 */
export async function setFindingStatus(findingId: string, actorId: string, status: "acknowledged" | "overridden" | "open", note: string | null, overrideExpiresAt?: string | null): Promise<{ ok: boolean; message: string }> {
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("role, is_active").eq("id", actorId).maybeSingle();
  if (!me?.is_active) return { ok: false, message: "Account fa'aal nahi." };
  const isMaster = canOverride(me.role);
  const { data: f } = await service.from("access_conflict_findings" as never).select("id, status, severity, enforcement, profile_id, rule_code").eq("id", findingId).maybeSingle();
  const finding = f as any;
  if (!finding) return { ok: false, message: "Takraao nahi mila." };
  if (finding.profile_id === actorId) return { ok: false, message: "Apne takraao par khud faisla nahi kar sakte." };
  if (status === "overridden") {
    if (!isMaster) return { ok: false, message: "Override sirf Owner/Admin kar sakta hai -- department head apni ceiling se bahar nahi." };
    if (finding.enforcement === "block") return { ok: false, message: "Ye policy hard block hai -- override nahi ho sakta. Ijazat alag karein." };
    if (!note || note.trim().length < 5) return { ok: false, message: "Override ki wajah likhein (lazmi)." };
  }
  if (status === "acknowledged" && !isMaster && me.role !== "manager") {
    // Head: sirf apne department ke banday par
    const { data: head } = await service.from("department_head_grants").select("department_key").eq("profile_id", actorId).maybeSingle();
    if (!head) return { ok: false, message: "Sirf Owner/Admin/Manager ya department head." };
  }
  const now = new Date().toISOString();
  const { error } = await service
    .from("access_conflict_findings" as never)
    .update({
      status,
      status_by: actorId,
      status_at: now,
      status_note: note,
      override_expires_at: status === "overridden" ? (overrideExpiresAt ?? null) : null,
    } as never)
    .eq("id", findingId);
  if (error) return { ok: false, message: error.message };
  await service.from("access_conflict_events" as never).insert({
    finding_id: findingId,
    actor_id: actorId,
    event: status === "overridden" ? "overridden" : status === "acknowledged" ? "acknowledged" : "reopened",
    detail: { note, override_expires_at: overrideExpiresAt ?? null, previous_status: finding.status, severity: finding.severity, rule: finding.rule_code },
  } as never);
  return { ok: true, message: status === "overridden" ? "Override darj -- wajah, aap ka naam, waqt aur miyaad mehfooz. Ijazat waise hi hai." : status === "acknowledged" ? "Dekh liya likh diya." : "Wapas khol diya." };
}

export interface RuleInput {
  label?: string;
  description?: string | null;
  severity?: Severity;
  enforcement?: Enforcement;
  min_scope?: DataScope;
  narrow_scope_severity?: Severity | null;
  duties?: unknown;
  params?: unknown;
  recommendation?: string | null;
  is_active?: boolean;
  applies_to_departments?: string[] | null;
}

/** Qawaid badalna -- sirf Owner/Admin. Duties JSON hi rehta hai (code mein kuch nahi). */
export async function updateConflictRule(ruleId: string, actorId: string, input: RuleInput): Promise<{ ok: boolean; message: string }> {
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("role, is_active").eq("id", actorId).maybeSingle();
  if (!me?.is_active || !canOverride(me.role)) return { ok: false, message: "Qawaid sirf Owner/Admin badal sakta hai." };
  if (input.duties !== undefined) {
    if (!Array.isArray(input.duties) || input.duties.some((d: any) => !d || !Array.isArray(d.features) || !Array.isArray(d.actions) || !d.label)) {
      return { ok: false, message: "Duties ka JSON: [{label, features[], actions[]}, ...]" };
    }
  }
  const { data: old } = await service.from("access_conflict_rules" as never).select("*").eq("id", ruleId).maybeSingle();
  if (!old) return { ok: false, message: "Rule nahi mila." };
  const patch: Record<string, unknown> = { updated_by: actorId, updated_at: new Date().toISOString() };
  for (const k of ["label", "description", "severity", "enforcement", "min_scope", "narrow_scope_severity", "duties", "params", "recommendation", "is_active", "applies_to_departments"] as const) {
    if (input[k] !== undefined) patch[k] = input[k];
  }
  const { error } = await service.from("access_conflict_rules" as never).update(patch as never).eq("id", ruleId);
  if (error) return { ok: false, message: error.message };
  await service.from("access_conflict_events" as never).insert({ actor_id: actorId, event: "rule_updated", detail: { rule: (old as any).code, before: old, after: patch } } as never);
  return { ok: true, message: "Rule badal gaya. Agla scan is ke mutabiq hoga." };
}

export async function listRules() {
  const service = createServiceClient();
  const { data } = await service.from("access_conflict_rules" as never).select("*").order("severity", { ascending: false }).order("code");
  return (data ?? []) as any[];
}
