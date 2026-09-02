import { Type, type FunctionDeclaration } from "@google/genai";
import { createServiceClient } from "@/lib/supabase/service";
import { bestMatches } from "@/lib/product-match";
import { createAccessRequest, currentAccess, riskLevel, MASTER } from "@/lib/access/access-requests";
import { previewConflicts, currentConflicts, explainConflict, loadFindings, SEVERITY_RANK } from "@/lib/access/conflicts";
import { ACTIONS, type Action } from "@/lib/access/types";
import { DEPARTMENTS } from "@/lib/departments";
import type { CoachContext } from "@/lib/ai/work-coach";

/**
 * Work Coach ka tool: ijazat ki darkhwast (270).
 * confirmed=false -> draft (kis ke liye, feature, actions, scope,
 * miyaad, risk, abhi kya hai, kaun manzoor karega). confirmed=true
 * (staff/admin ki haan ke baad) -> darkhwast darj. AI kabhi ijazat
 * nahi lagata -- sirf darkhwast.
 */
export const ACCESS_TOOL: FunctionDeclaration = {
  name: "request_access",
  description:
    "Kisi safhe/kaam ki ijazat ya department ki darkhwast (apne liye, ya Admin kisi aur ke liye). PEHLE confirmed=false: jawab mein draft (feature, actions, scope, miyaad, risk, abhi kya hai, kaun manzoor karega) aur milte julte features -- staff ko dikhayein: 'Aap X ka VIEW maang rahe hain, edit/approve nahi. Bhej doon?'. HAAN par confirmed=true. Ijazat AI nahi lagata; approver lagata hai. Actions: view (dekhna), create (banana), edit (badalna), verify (tasdeeq), approve (manzoor), reject, export, assign.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      confirmed: { type: Type.BOOLEAN, description: "false = draft; true = haan ke baad darj" },
      for_user_name: { type: Type.STRING, description: "Kis ke liye (naam) -- sirf jab Admin kisi aur ke liye maange; khali = apne liye" },
      feature_query: { type: Type.STRING, description: "Safha/feature ka naam ya kaam, jaise 'Stock', 'Inventory Report', 'stock transfer'" },
      department_key: { type: Type.STRING, description: "Sirf department assign ke liye: sales | finance | warehouse | procurement | dairy | machinery | hr | admin_office | manager" },
      actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "view, create, edit, verify, approve, reject, export, assign -- sirf jo maanga" },
      data_scope: { type: Type.STRING, description: "all | own_branch | own_shop | own_records (default own_branch)" },
      duration: { type: Type.STRING, description: "today | 7d | 30d | custom | permanent (default permanent)" },
      custom_expiry: { type: Type.STRING, description: "duration=custom par ISO date" },
      reason: { type: Type.STRING, description: "Kyun chahiye (staff ke lafz)" },
    },
    required: ["confirmed"],
  },
};

const WORD_TO_ACTION: [RegExp, Action][] = [
  [/dekh|view|read|report/i, "view"],
  [/bana|create|entry|add|likh/i, "create"],
  [/badal|edit|update|theek/i, "edit"],
  [/tasdeeq|verify/i, "verify"],
  [/manzoor|approve/i, "approve"],
  [/radd|reject/i, "reject"],
  [/export|nikal|download/i, "export"],
  [/assign|dena|delegate/i, "assign"],
];

export async function executeAccessTool(args: Record<string, any>, ctx: CoachContext | null) {
  if (!ctx) return { ok: false, message: "Context nahi mila." };
  const service = createServiceClient();
  const isMaster = MASTER.includes(ctx.role);

  // Kis ke liye
  let targetId = ctx.userId;
  let targetName = ctx.fullName;
  const forName = String(args.for_user_name ?? "").trim();
  if (forName) {
    if (!isMaster && ctx.role !== "manager") return { ok: false, message: "Kisi aur ke liye ijazat sirf Owner/Admin/Manager maang sakta hai. Aap apne liye maang sakte hain." };
    const { data: people } = await service.from("profiles").select("id, full_name, role").eq("is_active", true).ilike("full_name", `%${forName}%`).limit(5);
    if (!people || people.length === 0) return { ok: false, message: `"${forName}" naam ka koi staff nahi mila.` };
    if (people.length > 1) return { ok: false, message: "Ek se zyada log milte hain -- poora naam batayein.", candidates: people.map((p) => `${p.full_name} (${p.role})`) };
    targetId = people[0].id;
    targetName = people[0].full_name;
  }

  const kind: "feature_access" | "department_assign" = args.department_key ? "department_assign" : "feature_access";
  let feature: { key: string; label: string; route: string } | null = null;
  let candidates: { label: string; route: string; score: number }[] = [];
  if (kind === "feature_access") {
    const q = String(args.feature_query ?? "").trim();
    if (!q) return { ok: false, message: "Kaun sa safha ya kaam? (jaise 'Stock', 'Inventory Report')" };
    const m = bestMatches(q, null, ctx.features.map((f) => ({ ...f, name: `${f.label} ${f.key}` })), 4);
    candidates = m.map((c) => ({ label: c.item.label, route: c.item.route, score: Math.round(c.score * 100) }));
    if (m.length === 0) return { ok: false, message: "Aisa koi feature nahi mila." };
    if (m.length > 1 && m[0].score - m[1].score < 0.15 && m[0].score < 0.95) {
      return { ok: false, stage: "ambiguous", message: "Do features milte hain -- kaun sa?", candidates };
    }
    feature = m[0].item;
  } else if (!DEPARTMENTS.some((d) => d.key === args.department_key)) {
    return { ok: false, message: "Department key sahi nahi." };
  }

  // Actions: diye hue, ya reason/query ke lafzon se; kuch na mile to view.
  let actions = ((args.actions as string[] | undefined) ?? []).map((a) => a.toLowerCase()).filter((a): a is Action => (ACTIONS as readonly string[]).includes(a));
  if (actions.length === 0) {
    const text = `${args.feature_query ?? ""} ${args.reason ?? ""}`;
    for (const [re, a] of WORD_TO_ACTION) if (re.test(text)) actions.push(a);
    if (actions.length === 0) actions = ["view"];
  }
  actions = [...new Set(["view", ...actions])] as Action[];
  const scope = ["all", "own_branch", "own_shop", "own_records"].includes(args.data_scope) ? args.data_scope : "own_branch";
  const duration = ["today", "7d", "30d", "custom", "permanent"].includes(args.duration) ? args.duration : "permanent";

  const current = feature ? await currentAccess(targetId, feature.key) : null;
  const alreadyHas = current ? actions.every((a) => current.actions.includes(a)) : false;
  const risk = riskLevel(feature?.key ?? null, actions, kind, false);
  // Takraao (271): "is ijazat se ye existing access conflict create hoga"
  const conflicts = feature ? await previewConflicts(targetId, feature.key, actions, scope, targetName) : null;
  const draft = {
    requested_for: targetName,
    requested_by: ctx.fullName,
    current_department: ctx.departmentLabel,
    feature: feature ? `${feature.label} (${feature.route})` : null,
    department: args.department_key ?? null,
    actions_requested: actions,
    actions_not_requested: (ACTIONS as readonly string[]).filter((a) => !actions.includes(a as Action)),
    data_scope: scope,
    duration,
    reason: args.reason ?? null,
    currently_has: current,
    risk,
    approver: risk === "high" || kind === "department_assign" ? "sirf Owner/Admin" : "Owner/Admin/Manager ya department head (apni ceiling ke andar)",
    access_conflicts: conflicts
      ? {
          highest: conflicts.highest,
          blocked: conflicts.blocked,
          needs_override: conflicts.needsOverride,
          warnings: conflicts.messages,
          note: conflicts.blocked
            ? "Policy hard block: ye combination kisi ko nahi mil sakti -- staff ko batayein ke pehle purani ijazat alag karni hogi."
            : conflicts.needsOverride
              ? "HIGH/CRITICAL takraao: sirf Owner/Admin wajah + miyaad likh kar override kar sakta hai. Staff ko warning saaf dikhayein aur behtar tarteeb batayein."
              : conflicts.created.length
                ? "Advisory takraao -- approver ko dikhega, manzoori chal sakti hai."
                : null,
        }
      : null,
  };

  if (!args.confirmed) {
    return {
      ok: true,
      stage: "draft",
      draft,
      already_has_all: alreadyHas,
      candidates,
      instruction: alreadyHas
        ? "Ye ijazat pehle se hai -- staff ko batayein, darkhwast ki zaroorat nahi."
        : `Draft staff ko saaf dikhayein: kya maang rahe hain aur kya NAHI maang rahe, kab tak, kaun manzoor karega.${conflicts?.messages.length ? " access_conflicts.warnings ke jumle WAISE KE WAISE dikhayein (Access Conflict warning) aur Recommended tarteeb batayein." : ""} Phir poochein 'Darkhwast bhej doon?'. Haan par confirmed=true.`,
    };
  }
  if (alreadyHas) return { ok: false, message: "Ye ijazat pehle se hai." };

  const res = await createAccessRequest({
    kind,
    requestedFor: targetId,
    requestedBy: ctx.userId,
    featureKey: feature?.key ?? null,
    departmentKey: args.department_key ?? null,
    actions,
    dataScope: scope,
    reason: args.reason ?? null,
    duration,
    customExpiry: args.custom_expiry ?? null,
    aiInterpretation: { args, draft },
  });
  return res.ok ? { ok: true, stage: "submitted", number: res.number, risk: res.risk, message: res.message } : { ok: false, message: res.message };
}

/**
 * Takraao ki jaanch (271) -- Owner/Admin/Manager/head ke liye.
 * "Kis ke paas takraao hai?", "Ahmed ko payouts verify dena theek hai?"
 * Sirf dhoondta aur samjhata hai; kuch badalta nahi.
 */
export const CONFLICT_TOOL: FunctionDeclaration = {
  name: "check_access_conflicts",
  description:
    "Ijazat ka takraao (Separation of Duties). Bina user_name: sab khule takraao (kis ke paas kya ek sath hai, darja, mashwara). user_name ke sath: us banday ke takraao. user_name + feature_query (+ actions) ke sath: 'agar ye ijazat de di jaye to kya takraao banega' -- manzoori se pehle ki jaanch. Sirf report: yahan se ijazat nahi hatti, faisla insaan ka.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      user_name: { type: Type.STRING, description: "Kis banday ke liye (naam); khali = sab" },
      feature_query: { type: Type.STRING, description: "Agar ye feature dena ho to -- naam ya kaam" },
      actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "view, create, edit, verify, approve, reject, export, assign" },
      data_scope: { type: Type.STRING, description: "all | own_branch | own_shop | own_records" },
    },
  },
};

export async function executeConflictTool(args: Record<string, any>, ctx: CoachContext | null) {
  if (!ctx) return { ok: false, message: "Context nahi mila." };
  const service = createServiceClient();
  const isMaster = MASTER.includes(ctx.role);
  if (!isMaster && ctx.role !== "manager") {
    const { data: head } = await service.from("department_head_grants").select("department_key").eq("profile_id", ctx.userId).maybeSingle();
    if (!head) return { ok: false, message: "Takraao ki report sirf Owner/Admin/Manager ya department head dekh sakta hai. Aap apni ijazat /admin/my-access par dekh sakte hain." };
  }
  let targetId: string | null = null;
  let targetName: string | null = null;
  const uname = String(args.user_name ?? "").trim();
  if (uname) {
    const { data: people } = await service.from("profiles").select("id, full_name, role").eq("is_active", true).ilike("full_name", `%${uname}%`).limit(5);
    if (!people || people.length === 0) return { ok: false, message: `"${uname}" naam ka koi staff nahi mila.` };
    if (people.length > 1) return { ok: false, message: "Ek se zyada log milte hain -- poora naam batayein.", candidates: people.map((p) => `${p.full_name} (${p.role})`) };
    targetId = people[0].id;
    targetName = people[0].full_name;
  }
  const q = String(args.feature_query ?? "").trim();
  if (targetId && q) {
    const m = bestMatches(q, null, ctx.features.map((f) => ({ ...f, name: `${f.label} ${f.key}` })), 3);
    if (m.length === 0) return { ok: false, message: "Aisa koi feature nahi mila." };
    const feature = m[0].item;
    let actions = ((args.actions as string[] | undefined) ?? []).map((a) => a.toLowerCase()).filter((a): a is Action => (ACTIONS as readonly string[]).includes(a));
    if (actions.length === 0) actions = ["view"];
    const scope = ["all", "own_branch", "own_shop", "own_records"].includes(args.data_scope) ? args.data_scope : "own_branch";
    const p = await previewConflicts(targetId, feature.key, actions, scope, targetName);
    return {
      ok: true,
      stage: "preview",
      user: targetName,
      feature: `${feature.label} (${feature.key})`,
      actions,
      scope,
      would_create: p.created.map((c) => ({ rule: c.rule_code, severity: c.severity, enforcement: c.enforcement, label: c.label, recommendation: c.recommendation })),
      warnings: p.messages,
      blocked: p.blocked,
      needs_override: p.needsOverride,
      already_has_conflicts: p.existing.map((c) => `${c.severity}:${c.rule_code}`),
      instruction: p.created.length
        ? "warnings ke jumle waise ke waise dikhayein, phir Recommended tarteeb. Aap kuch badalte nahi -- faisla insaan ka; darkhwast request_access se banti hai."
        : "Koi naya takraao nahi banta -- batayein, aur agar chahein to request_access se darkhwast banayein.",
    };
  }
  const rows = targetId ? await currentConflicts(targetId) : await loadFindings({ status: ["open", "acknowledged", "overridden"] });
  const list = targetId
    ? rows.map((c: any) => ({ user: c.full_name, rule: c.rule_code, severity: c.severity, enforcement: c.enforcement, label: c.label, explanation: explainConflict(c, c.full_name), recommendation: c.recommendation }))
    : (rows as any[])
        .sort((a, b) => (SEVERITY_RANK[b.severity as keyof typeof SEVERITY_RANK] ?? 0) - (SEVERITY_RANK[a.severity as keyof typeof SEVERITY_RANK] ?? 0))
        .slice(0, 25)
        .map((f: any) => ({
          user: (Array.isArray(f.profiles) ? f.profiles[0] : f.profiles)?.full_name ?? "—",
          rule: f.rule_code,
          severity: f.severity,
          enforcement: f.enforcement,
          status: f.status,
          label: f.label,
          duties: (f.matched as any[]).map((m) => `${m.duty}: ${m.feature_key} [${(m.actions ?? []).join("/")}, ${m.scope}]`),
          recommendation: f.recommendation,
        }));
  return {
    ok: true,
    stage: "report",
    count: list.length,
    conflicts: list,
    page: "/admin/access-requests?tab=conflicts",
    instruction: "Sab se ooncha darja pehle. Har ek ke liye: kis ke paas kya ek sath hai, kyun masla hai, Recommended tarteeb. Aap kuch hatate nahi -- Owner/Admin /admin/permissions par alag karta hai ya Conflicts tab par override/acknowledge.",
  };
}
