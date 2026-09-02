import { createServiceClient } from "@/lib/supabase/service";
import { loadHeadPower, capGrant } from "@/lib/access/delegation";
import { loadRegistry } from "@/lib/access/registry";
import { isAction, isDataScope, narrowerScope, type Action, type DataScope } from "@/lib/access/types";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { notifyUser, notifyRoles } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { departmentByKey, DEPARTMENTS } from "@/lib/departments";

/**
 * Ijazat ki darkhwast (270) -- AI draft, insaan manzoor, engine lagata hai.
 *
 * Usool:
 *  1. Yahan koi ijazat NAHI lagti jab tak approve na ho. Approve par
 *     wahi user_feature_permissions (104) mein qatar -- koi naya raasta
 *     nahi.
 *  2. Department head apni ceiling ke andar (capGrant): jo us ke paas
 *     nahi wo wo nahi de sakta -- khud kat jata hai aur likha jata hai.
 *  3. High-risk sirf Owner/Admin.
 *  4. Har qadam access_request_events mein, append-only.
 */

export const MASTER = UNRESTRICTED_ROLES;

/** High-risk: finance ka approve/verify, users/permissions/security, reversal, delegation. */
const HIGH_RISK_FEATURE_PATTERNS = [/^permissions/, /^users/, /^security/, /^platform/, /^settings/, /^reset/, /reversal/, /^finance/, /^bank/, /^cash-custody/, /^wallets/, /^payouts/, /^money-trail/];
const HIGH_RISK_ACTIONS: Action[] = ["approve", "verify", "assign"];

export function riskLevel(featureKey: string | null, actions: Action[], kind: string, crossDepartment: boolean): "normal" | "high" {
  if (kind === "department_assign") return "high";
  if (featureKey && HIGH_RISK_FEATURE_PATTERNS.some((re) => re.test(featureKey))) return "high";
  if (actions.some((a) => HIGH_RISK_ACTIONS.includes(a)) && featureKey && /finance|payment|khata|credit|ledger|purchases|payouts/.test(featureKey)) return "high";
  if (crossDepartment && actions.some((a) => a !== "view")) return "high";
  return "normal";
}

export function expiryFor(duration: string, customIso?: string | null): string | null {
  const now = new Date();
  if (duration === "today") {
    const d = new Date(now);
    d.setHours(23, 59, 59, 0);
    return d.toISOString();
  }
  if (duration === "7d") return new Date(now.getTime() + 7 * 864e5).toISOString();
  if (duration === "30d") return new Date(now.getTime() + 30 * 864e5).toISOString();
  if (duration === "custom" && customIso) return new Date(customIso).toISOString();
  return null;
}

export interface AccessRequestInput {
  kind: "feature_access" | "department_assign";
  requestedFor: string;
  requestedBy: string;
  featureKey?: string | null;
  departmentKey?: string | null;
  actions: string[];
  dataScope?: string | null;
  branchId?: string | null;
  reason?: string | null;
  duration?: string | null;
  customExpiry?: string | null;
  aiInterpretation?: unknown;
}

export async function currentAccess(profileId: string, featureKey: string) {
  const service = createServiceClient();
  const { data } = await service.from("v_user_feature_access").select("actions, data_scope, is_temporary, expires_at").eq("profile_id", profileId).eq("feature_key", featureKey);
  const actions = new Set<string>();
  let scope: DataScope | null = null;
  for (const r of data ?? []) {
    for (const a of (r.actions as string[] | null) ?? []) actions.add(a);
    if (r.data_scope && isDataScope(r.data_scope)) scope = scope ? (narrowerScope(scope, r.data_scope) === scope ? r.data_scope : scope) : r.data_scope;
  }
  return { actions: [...actions], scope };
}

export async function createAccessRequest(input: AccessRequestInput): Promise<{ ok: boolean; number?: string; id?: string; message: string; risk?: string }> {
  const service = createServiceClient();
  const actions = [...new Set(input.actions.filter(isAction))] as Action[];
  if (input.kind === "feature_access") {
    if (!input.featureKey) return { ok: false, message: "Feature saaf nahi." };
    if (actions.length === 0) actions.push("view");
    if (!actions.includes("view")) actions.unshift("view");
  }
  const scope = input.dataScope && isDataScope(input.dataScope) ? input.dataScope : "own_branch";
  const duration = ["today", "7d", "30d", "custom", "permanent"].includes(input.duration ?? "") ? (input.duration as string) : "permanent";

  const { data: target } = await service.from("profiles").select("id, role, full_name, is_active").eq("id", input.requestedFor).maybeSingle();
  if (!target?.is_active) return { ok: false, message: "Jis ke liye maanga wo account fa'aal nahi." };

  // Cross-department: feature is banday ke department ke dashboard mein nahi.
  let cross = false;
  if (input.featureKey) {
    const registry = await loadRegistry();
    const dept = DEPARTMENTS.find((d) => d.role === target.role);
    const { data: deptRow } = dept ? await service.from("departments").select("dashboard_key").eq("key", dept.key).maybeSingle() : { data: null };
    const keys = deptRow?.dashboard_key ? registry.byDashboard.get(deptRow.dashboard_key) ?? [] : [];
    cross = keys.length > 0 && !keys.includes(input.featureKey);
  }
  const risk = riskLevel(input.featureKey ?? null, actions, input.kind, cross);

  const { data, error } = await service
    .from("access_requests")
    .insert({
      kind: input.kind,
      requested_for: input.requestedFor,
      requested_by: input.requestedBy,
      feature_key: input.featureKey ?? null,
      department_key: input.departmentKey ?? null,
      actions,
      data_scope: scope,
      branch_id: input.branchId ?? null,
      reason: input.reason?.trim() || null,
      duration,
      expires_at: expiryFor(duration, input.customExpiry),
      risk_level: risk,
      ai_interpretation: (input.aiInterpretation as any) ?? null,
    })
    .select("id, number")
    .single();
  if (error || !data) return { ok: false, message: error?.message ?? "Darkhwast nahi bani." };

  await service.from("access_request_events").insert({ request_id: data.id, actor_id: input.requestedBy, event: "requested", detail: { actions, scope, duration, risk, ai: input.aiInterpretation ?? null } as any });

  const label = input.featureKey ?? `department ${input.departmentKey}`;
  const approvers = risk === "high" ? MASTER : [...MASTER, "manager"];
  await notifyRoles(approvers, `Ijazat ki darkhwast ${data.number}`, `${target.full_name}: ${label} -- ${actions.join(", ")} (${duration})`, `/admin/access-requests?id=${data.id}`);
  if (input.requestedFor !== input.requestedBy) {
    await notifyUser(input.requestedFor, `Aap ke liye ijazat maangi gayi ${data.number}`, `${label} -- manzoori ke baad khud lag jayegi.`, "/admin/my-access");
  }
  return { ok: true, number: data.number, id: data.id, risk, message: `Darkhwast ${data.number} approver ke paas gayi (${risk === "high" ? "sirf Owner/Admin" : "Owner/Admin/Manager ya department head"}).` };
}

/** Faisla: approve -> lagao; reject. Ceiling: head ke liye capGrant; master ke liye poora. */
export async function decideAccessRequest(requestId: string, deciderId: string, decision: "approved" | "rejected", note: string | null): Promise<{ ok: boolean; message: string; refused?: string[] }> {
  const service = createServiceClient();
  const { data: me } = await service.from("profiles").select("role, full_name, is_active").eq("id", deciderId).maybeSingle();
  if (!me?.is_active) return { ok: false, message: "Account fa'aal nahi." };
  const isMaster = MASTER.includes(me.role);
  const { data: req } = await service.from("access_requests").select("*").eq("id", requestId).maybeSingle();
  if (!req) return { ok: false, message: "Darkhwast nahi mili." };
  if (req.status !== "pending") return { ok: false, message: "Is par faisla ho chuka hai." };
  if (req.requested_for === deciderId) return { ok: false, message: "Apni darkhwast khud manzoor nahi kar sakte." };

  const head = isMaster ? null : await loadHeadPower(deciderId);
  if (!isMaster && !head && me.role !== "manager") return { ok: false, message: "Faisla sirf Owner/Admin, Manager ya department head kar sakta hai." };
  if (req.risk_level === "high" && !isMaster) return { ok: false, message: "High-risk ijazat sirf Owner/Admin manzoor kar sakta hai." };

  if (decision === "rejected") {
    if (!note) return { ok: false, message: "Radd ki wajah likhein." };
    await service.from("access_requests").update({ status: "rejected", decided_by: deciderId, decided_at: new Date().toISOString(), decision_note: note }).eq("id", requestId);
    await service.from("access_request_events").insert({ request_id: requestId, actor_id: deciderId, event: "rejected", detail: { note } as any });
    await notifyUser(req.requested_for, `Ijazat ${req.number}: radd`, note, "/admin/my-access");
    return { ok: true, message: "Radd ho gayi, staff ko paighaam gaya." };
  }

  // ---- APPROVE: lagao ----
  const wantActions = ((req.actions as string[]) ?? []).filter(isAction) as Action[];
  const wantScope = (isDataScope(req.data_scope) ? req.data_scope : "own_branch") as DataScope;
  let applied: { feature_key: string; actions: Action[]; scope: DataScope }[] = [];
  let refused: string[] = [];
  const oldSnap: Record<string, unknown> = {};

  const applyOne = async (featureKey: string, actions: Action[], scope: DataScope) => {
    oldSnap[featureKey] = await currentAccess(req.requested_for, featureKey);
    let final = { actions, scope, refused: [] as Action[] };
    if (!isMaster) {
      if (!head) return { refused: actions.map(String) };
      const c = capGrant(head, featureKey, actions, scope);
      final = { actions: c.actions, scope: c.scope, refused: c.refused };
      if (final.actions.length === 0) return { refused: c.refused.map(String) };
    }
    if (!final.actions.includes("view")) final.actions.unshift("view");
    await service.from("user_feature_permissions").delete().eq("profile_id", req.requested_for).eq("feature_key", featureKey);
    const { error } = await service.from("user_feature_permissions").insert({
      profile_id: req.requested_for,
      feature_key: featureKey,
      actions: final.actions,
      data_scope: final.scope,
      expires_at: req.expires_at,
      starts_at: req.starts_at,
      reason: `${req.number}${req.reason ? `: ${req.reason}` : ""}`,
      granted_by: deciderId,
    });
    if (error) return { refused: [error.message] };
    applied.push({ feature_key: featureKey, actions: final.actions, scope: final.scope });
    return { refused: final.refused.map(String) };
  };

  if (req.kind === "feature_access" && req.feature_key) {
    const r = await applyOne(req.feature_key, wantActions, wantScope);
    refused = r.refused;
  } else if (req.kind === "department_assign" && req.department_key) {
    if (!isMaster) return { ok: false, message: "Department dena sirf Owner/Admin ka kaam hai." };
    const dept = departmentByKey(req.department_key);
    const { data: deptRow } = await service.from("departments").select("dashboard_key").eq("key", req.department_key).maybeSingle();
    const registry = await loadRegistry();
    const keys = deptRow?.dashboard_key ? registry.byDashboard.get(deptRow.dashboard_key) ?? [] : [];
    for (const k of keys) await applyOne(k, wantActions.length ? wantActions : ["view"], wantScope);
    if (dept) {
      const { data: prof } = await service.from("profiles").select("extra_roles").eq("id", req.requested_for).maybeSingle();
      const extra = new Set<string>(((prof?.extra_roles as string[] | null) ?? []).map(String));
      extra.add(dept.role);
      await service.from("profiles").update({ extra_roles: [...extra] as any }).eq("id", req.requested_for);
    }
  }

  if (applied.length === 0) {
    return { ok: false, message: `Kuch nahi laga: ${refused.join(", ") || "ceiling se bahar"}`, refused };
  }

  await service
    .from("access_requests")
    .update({
      status: "approved",
      decided_by: deciderId,
      decided_at: new Date().toISOString(),
      decision_note: note,
      applied_at: new Date().toISOString(),
      old_permissions: oldSnap as any,
      new_permissions: applied as any,
    })
    .eq("id", requestId);
  await service.from("access_request_events").insert({ request_id: requestId, actor_id: deciderId, event: "approved_applied", detail: { note, applied, refused, expires_at: req.expires_at } as any });
  await logAudit({ actionType: "update", module: "access_requests", recordId: requestId, recordLabel: req.number, description: `Manzoor: ${applied.map((a) => `${a.feature_key} [${a.actions.join(",")}/${a.scope}]`).join("; ")}${refused.length ? ` — nahi diya: ${refused.join(", ")}` : ""}` });
  await notifyUser(req.requested_for, `Access Granted ${req.number}`, `${applied.map((a) => a.feature_key).join(", ")}${req.expires_at ? ` (${new Date(req.expires_at).toLocaleDateString("en-GB")} tak)` : ""}`, "/admin/my-access");
  return { ok: true, message: `Lag gayi: ${applied.map((a) => a.feature_key).join(", ")}${refused.length ? `. Nahi diya (ceiling): ${refused.join(", ")}` : ""}`, refused };
}
