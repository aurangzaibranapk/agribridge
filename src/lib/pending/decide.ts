import { isSelfApproveRole, mayDecideEntry, selfDecisionLabel } from "@/lib/approval/guards";
import { t, type Lang } from "@/lib/i18n/translations";
import { CODE_MAKER_COLS, INLINE_DECISIONS, type PendingItem } from "@/lib/pending/categories";

/**
 * Mere Kaam ka faisla -- natija seedha wapas, redirect nahi.
 *
 * Pehle server action manzoori save kar ke `redirect(?ok=1)` phenkta tha.
 * Save ho jata tha, magar browser purani list par hi atka rehta tha
 * (window.confirm transition ko rok deta hai, aur usi safhe par redirect
 * client par paint nahi hota). Is liye yahan plain object laut-ta hai:
 * safha khud qataar, ginti aur toast badalta hai. Maker-checker wahi hai.
 */

export type Decision = "approve" | "reject";
export type DecideCode = "bad" | "reason" | "gone" | "own" | "code" | "action";
export type DecideResult =
  | { ok: true; decision: Decision }
  | { ok: false; code: DecideCode; error: string };

const UUID = /^[0-9a-f-]{36}$/i;

const ERROR_KEY = {
  bad: "apb_e_bad",
  reason: "apb_e_reason",
  gone: "apb_e_gone",
  own: "apb_own_tip",
  code: "apb_code_tip",
} as const;

export function fail(code: Exclude<DecideCode, "action">): DecideResult {
  return { ok: false, code, error: code };
}

export function actionFail(error: string): Extract<DecideResult, { ok: false }> {
  const msg = error.replace(/\s+/g, " ").trim().slice(0, 300);
  return { ok: false, code: "action", error: msg || "error" };
}

/** Ghalat / khali jawab ko kabhi success na maano -- qataar hara na ho. */
export function normalizeDecideResult(res: DecideResult | null | undefined): DecideResult {
  if (!res || typeof res !== "object" || (res.ok !== true && res.ok !== false)) return actionFail("no response");
  if (res.ok === true) return res.decision === "approve" || res.decision === "reject" ? res : actionFail("no response");
  if (res.code === "action") return actionFail(typeof res.error === "string" ? res.error : "");
  if (res.code === "bad" || res.code === "reason" || res.code === "gone" || res.code === "own" || res.code === "code") return fail(res.code);
  return actionFail(typeof res.error === "string" ? res.error : "");
}

export function decideMessage(res: Extract<DecideResult, { ok: false }>, lang: Lang): string {
  if (res.code === "action") return res.error;
  return t(ERROR_KEY[res.code], lang);
}

export function pendingKey(category: string, id: string): string {
  return `${category}:${id}`;
}

export interface DecidePorts {
  loadRow: (category: string, id: string) => Promise<PendingItem | null>;
  actorId: () => Promise<string | null>;
  actorRole?: () => Promise<string | null>;
  codeMakerId: (category: string, id: string) => Promise<string | null>;
  logSelfDecision?: (category: string, id: string, decision: Decision, label: string) => Promise<void>;
  reviewPosReturn: (fd: FormData) => Promise<{ error?: string }>;
  approveProductEdit: (fd: FormData) => Promise<{ error?: string }>;
  rejectProductEdit: (fd: FormData) => Promise<{ error?: string }>;
  approveProductMerge: (fd: FormData) => Promise<{ error?: string }>;
  rejectProductMerge: (fd: FormData) => Promise<{ error?: string }>;
}

/**
 * Validation + maker-checker, phir wahi purana action.
 * Admin/Owner apni entry bhi aage jaati hai (timeline: Khud approve).
 * Manager aur baqi staff ki apni entry yahan rukti hai.
 */
export async function runDecidePending(fd: FormData, ports: DecidePorts): Promise<DecideResult> {
  const category = String(fd.get("category") ?? "");
  const id = String(fd.get("id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);
  const rule = INLINE_DECISIONS[category];
  if (!rule || !UUID.test(id) || (decision !== "approve" && decision !== "reject")) return fail("bad");
  if (decision === "reject" && rule.rejectNeedsReason && note.length < 5) return fail("reason");

  const row = await ports.loadRow(category, id);
  if (!row || row.item_id !== id) return fail("gone");
  const actor = await ports.actorId();
  const role = ports.actorRole ? await ports.actorRole() : null;
  const makers: Array<string | null> = [];
  if (row.is_own && actor) makers.push(actor);
  let codeMaker: string | null = null;
  if (CODE_MAKER_COLS[category]) {
    codeMaker = await ports.codeMakerId(category, id);
    if (codeMaker) makers.push(codeMaker);
  }
  if (!mayDecideEntry(role, actor, makers)) {
    if (row.is_own) return fail("own");
    return fail("code");
  }
  const self = !!role && !!actor && (row.is_own || codeMaker === actor);

  const f = new FormData();
  let res: { error?: string } = {};
  if (category === "pos_returns") {
    f.set("return_id", id);
    f.set("decision", decision === "approve" ? "approved" : "flagged");
    if (note) f.set("note", note);
    res = await ports.reviewPosReturn(f);
  } else if (category === "product_edits") {
    f.set("request_id", id);
    if (note) f.set("review_notes", note);
    res = decision === "approve" ? await ports.approveProductEdit(f) : await ports.rejectProductEdit(f);
  } else if (category === "product_merge") {
    f.set("request_id", id);
    if (note) f.set("review_notes", note);
    res = decision === "approve" ? await ports.approveProductMerge(f) : await ports.rejectProductMerge(f);
  } else {
    return fail("bad");
  }
  if (!res || typeof res !== "object") return actionFail("no response");
  if (res.error) return actionFail(res.error);
  if (self && role && isSelfApproveRole(role)) {
    await ports.logSelfDecision?.(category, id, decision, selfDecisionLabel(role, decision));
  }
  return { ok: true, decision };
}

const num = (v: number | string | null | undefined): number => {
  const n = typeof v === "string" ? Number(v) : v ?? 0;
  return Number.isFinite(n) ? n : 0;
};

export interface CountDelta {
  pending: number;
  mine: number;
  naya: number;
  amount: number;
}

/** Category ki amount tabhi ghatao jab SQL ne raqam jori ho (NULL ka matlab sifar nahi). */
export function deltaForItem(
  counts: { category: string; amount: number | string | null }[],
  item: Pick<PendingItem, "category" | "amount" | "is_new" | "is_own" | "code_own">
): CountDelta {
  const cat = counts.find((c) => c.category === item.category);
  const tracked = !!cat && cat.amount != null && cat.amount !== "";
  return {
    pending: 1,
    mine: !item.is_own && !item.code_own ? 1 : 0,
    naya: item.is_new ? 1 : 0,
    amount: tracked ? Math.max(0, num(item.amount)) : 0,
  };
}

export function applyDeltas<T extends { pending: number; mine: number; naya: number; amount: number }>(base: T, deltas: CountDelta[]): T {
  const d = deltas.reduce(
    (s, x) => ({ pending: s.pending + x.pending, mine: s.mine + x.mine, naya: s.naya + x.naya, amount: s.amount + x.amount }),
    { pending: 0, mine: 0, naya: 0, amount: 0 }
  );
  return {
    ...base,
    pending: Math.max(0, base.pending - d.pending),
    mine: Math.max(0, base.mine - d.mine),
    naya: Math.max(0, base.naya - d.naya),
    amount: Math.max(0, base.amount - d.amount),
  };
}

export function groupLeft(pending: number, naya: number, hits: { isNew: boolean }[]): { pending: number; naya: number } {
  return {
    pending: Math.max(0, pending - hits.length),
    naya: Math.max(0, naya - hits.filter((h) => h.isNew).length),
  };
}

/** Hara/surkh state thodi der dikhe, phir qataar halki ho kar list se hat jaye. */
export const DECISION_FADE_MS = 4200;
export const DECISION_HIDE_MS = 4900;
