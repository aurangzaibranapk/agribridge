/** Pending Approvals decide: success, failure, own-entry.  npm run test:pending-decide */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adminPendingDict } from "../src/lib/i18n/dict/admin-pending";
import type { PendingItem } from "../src/lib/pending/categories";
import {
  actionFail,
  applyDeltas,
  decideMessage,
  deltaForItem,
  fail,
  groupLeft,
  normalizeDecideResult,
  runDecidePending,
  type DecidePorts,
  type DecideResult,
} from "../src/lib/pending/decide";

let n = 0;
function test(name: string, fn: () => void | Promise<void>) {
  const run = fn();
  if (run && typeof (run as Promise<void>).then === "function") {
    throw new Error(`test "${name}" returned a promise — use testAsync`);
  }
  n++;
  console.log(`ok  ${name}`);
}
async function testAsync(name: string, fn: () => Promise<void>) {
  await fn();
  n++;
  console.log(`ok  ${name}`);
}

const ID = "11111111-1111-4111-8111-111111111111";
const dict = adminPendingDict as Record<string, { en: string; rm: string; ur: string }>;

function item(p: Partial<PendingItem> = {}): PendingItem {
  return {
    category: "pos_returns",
    group_key: "sales",
    route: "/admin/pos/returns",
    item_id: ID,
    ref: "RET-2026-00014",
    title: null,
    amount: 130,
    created_at: "2026-10-05T00:00:00Z",
    entered_by: "anwar",
    entered_by_name: "Anwar Ul Hassan",
    actor_id: null,
    actor_name: "Admin / Owner",
    pending_with: "admin_owner",
    is_own: false,
    is_new: false,
    link: null,
    ...p,
  };
}

function form(decision: "approve" | "reject", extra?: { category?: string; id?: string; note?: string }) {
  const fd = new FormData();
  fd.set("category", extra?.category ?? "pos_returns");
  fd.set("id", extra?.id ?? ID);
  fd.set("decision", decision);
  if (extra?.note) fd.set("note", extra.note);
  return fd;
}

function ports(over: Partial<DecidePorts> = {}): DecidePorts {
  return {
    loadRow: async () => item(),
    actorId: async () => "owner-1",
    codeMakerId: async () => null,
    reviewPosReturn: async () => ({}),
    approveProductEdit: async () => ({}),
    rejectProductEdit: async () => ({}),
    approveProductMerge: async () => ({}),
    rejectProductMerge: async () => ({}),
    ...over,
  };
}

test("labels: Approved / Manzoor / منظور, toast Approve ho gaya, reject red — EN RM UR", () => {
  assert.equal(dict.apb_state_approved.en, "Approved");
  assert.equal(dict.apb_state_approved.rm, "Manzoor");
  assert.equal(dict.apb_state_approved.ur, "منظور");
  assert.equal(dict.apb_toast_approved.en, "Approve ho gaya");
  assert.equal(dict.apb_toast_approved.rm, "Approve ho gaya");
  assert.ok(dict.apb_toast_approved.ur);
  assert.equal(dict.apb_state_rejected.en, "Rejected");
  assert.ok(dict.apb_state_rejected.rm && dict.apb_state_rejected.ur);
  for (const k of ["apb_ask_approve", "apb_ask_reject", "apb_rules", "apb_cancel", "apb_saving", "apb_e_server", "apb_toast_rejected"]) {
    assert.ok(dict[k].en && dict[k].rm && dict[k].ur, k);
  }
});

test("empty server reply is a failure, never a green row", () => {
  for (const bad of [undefined, null, { ok: "yes" } as unknown as DecideResult]) {
    const res = normalizeDecideResult(bad);
    assert.equal(res.ok, false);
    if (!res.ok) assert.equal(res.code, "action");
  }
  assert.deepEqual(normalizeDecideResult({ ok: true, decision: "approve" }), { ok: true, decision: "approve" });
  assert.deepEqual(normalizeDecideResult(fail("own")), { ok: false, code: "own", error: "own" });
});

test("counts: one decision drops pending, mine and rupees; null amount is not zeroed; floor at 0", () => {
  const counts = [
    { category: "pos_returns", amount: 2419082 },
    { category: "product_edits", amount: null },
  ];
  const base = { pending: 102, mine: 102, naya: 0, amount: 2419082, oldTypes: 8 };
  const next = applyDeltas(base, [deltaForItem(counts, item({ amount: 130 }))]);
  assert.equal(next.pending, 101);
  assert.equal(next.mine, 101);
  assert.equal(next.naya, 0);
  assert.equal(next.amount, 2419082 - 130);
  assert.equal(next.oldTypes, 8);
  const edit = deltaForItem(counts, item({ category: "product_edits", amount: 500, is_new: true }));
  assert.deepEqual(edit, { pending: 1, mine: 1, naya: 1, amount: 0 });
  assert.equal(deltaForItem(counts, item({ is_own: true, amount: 130 })).mine, 0);
  assert.equal(deltaForItem(counts, item({ code_own: true, amount: 130 })).mine, 0);
  assert.deepEqual(groupLeft(8, 1, [{ isNew: false }]), { pending: 7, naya: 1 });
  assert.equal(applyDeltas({ pending: 0, mine: 0, naya: 0, amount: 10 }, [deltaForItem(counts, item({ amount: 130 }))]).pending, 0);
  assert.equal(applyDeltas({ pending: 0, mine: 0, naya: 0, amount: 10 }, [deltaForItem(counts, item({ amount: 130 }))]).amount, 0);
});

async function main() {
await testAsync("success: POS approve calls the existing review and returns ok", async () => {
  let decision = "";
  let returnId = "";
  const res = await runDecidePending(form("approve"), ports({
    reviewPosReturn: async (fd) => {
      decision = String(fd.get("decision"));
      returnId = String(fd.get("return_id"));
      const reply: { error?: string; success: boolean; returnNumber: string } = { success: true, returnNumber: "RET-2026-00014" };
      return reply;
    },
  }));
  assert.deepEqual(res, { ok: true, decision: "approve" });
  assert.equal(decision, "approved");
  assert.equal(returnId, ID);
});

await testAsync("success: reject sends flagged + note through the same action", async () => {
  let decision = "";
  let note = "";
  const res = await runDecidePending(form("reject", { note: "galat wapsi hai" }), ports({
    reviewPosReturn: async (fd) => {
      decision = String(fd.get("decision"));
      note = String(fd.get("note"));
      return {};
    },
  }));
  assert.deepEqual(res, { ok: true, decision: "reject" });
  assert.equal(decision, "flagged");
  assert.equal(note, "galat wapsi hai");
});

await testAsync("failure: original action's reason is returned unchanged (not swallowed)", async () => {
  const msg = "Ye wapsi aap ne khud ki hai — review Owner / doosra Admin karega.";
  const res = await runDecidePending(form("approve"), ports({
    reviewPosReturn: async () => ({ error: msg }),
  }));
  assert.equal(res.ok, false);
  if (!res.ok) {
    assert.equal(res.code, "action");
    assert.equal(res.error, msg);
    assert.equal(decideMessage(res, "en"), msg);
    assert.equal(decideMessage(res, "rm"), msg);
    assert.equal(decideMessage(res, "ur"), msg);
  }
  const perm = await runDecidePending(form("approve", { category: "product_edits" }), ports({
    loadRow: async () => item({ category: "product_edits" }),
    approveProductEdit: async () => ({ error: "Aapke paas edits verify karne ki ijazat nahi hai." }),
  }));
  assert.equal(perm.ok, false);
  if (!perm.ok) assert.match(perm.error, /ijazat nahi/);
});

await testAsync("manager own-entry block: stopped before any approval action", async () => {
  let called = 0;
  const res = await runDecidePending(form("approve"), ports({
    actorRole: async () => "manager",
    loadRow: async () => item({ is_own: true }),
    reviewPosReturn: async () => {
      called++;
      return {};
    },
    approveProductEdit: async () => {
      called++;
      return {};
    },
  }));
  assert.deepEqual(res, fail("own"));
  assert.equal(called, 0);
  if (!res.ok) {
    assert.equal(decideMessage(res, "rm"), "Apni entry — koi doosra approve karega");
    assert.match(decideMessage(res, "en"), /own entry/i);
  }
});

await testAsync("admin and owner may approve their own entry and it is logged", async () => {
  const seen: string[] = [];
  const admin = await runDecidePending(form("approve"), ports({
    actorId: async () => "admin-1",
    actorRole: async () => "admin",
    loadRow: async () => item({ is_own: true, entered_by: "admin-1" }),
    logSelfDecision: async (_c, _id, decision, label) => { seen.push(`${decision}:${label}`); },
  }));
  assert.equal(admin.ok, true);
  const owner = await runDecidePending(form("reject", { note: "wajah likhi hai" }), ports({
    actorId: async () => "owner-1",
    actorRole: async () => "owner",
    loadRow: async () => item({ is_own: true }),
    logSelfDecision: async (_c, _id, decision, label) => { seen.push(`${decision}:${label}`); },
  }));
  assert.equal(owner.ok, true);
  assert.deepEqual(seen, ["approve:Khud approve (Admin)", "reject:Khud reject (Owner)"]);
  const staff = await runDecidePending(form("approve"), ports({
    actorId: async () => "staff-1",
    actorRole: async () => "sales_staff",
    loadRow: async () => item({ is_own: true }),
    reviewPosReturn: async () => { seen.push("staff"); return {}; },
  }));
  assert.equal(staff.ok, false);
  assert.ok(!seen.includes("staff"));
});

await testAsync("code-maker block: manager who authorised the return cannot approve it", async () => {
  let called = 0;
  const res = await runDecidePending(form("approve"), ports({
    actorId: async () => "mgr-1",
    codeMakerId: async () => "mgr-1",
    reviewPosReturn: async () => {
      called++;
      return {};
    },
  }));
  assert.deepEqual(res, fail("code"));
  assert.equal(called, 0);
  const other = await runDecidePending(form("approve"), ports({
    actorId: async () => "owner-1",
    codeMakerId: async () => "mgr-1",
    reviewPosReturn: async () => {
      called++;
      return {};
    },
  }));
  assert.equal(other.ok, true);
  assert.equal(called, 1);
});

await testAsync("failure: bad id, missing row, reject without a reason — no action call", async () => {
  let called = 0;
  const bump: Partial<DecidePorts> = { reviewPosReturn: async () => { called++; return {}; } };
  const bad = await runDecidePending(form("approve", { id: "nope" }), ports(bump));
  const gone = await runDecidePending(form("approve"), ports({ ...bump, loadRow: async () => null }));
  const reason = await runDecidePending(form("reject", { note: "ab" }), ports(bump));
  assert.deepEqual(bad, fail("bad"));
  assert.deepEqual(gone, fail("gone"));
  assert.deepEqual(reason, fail("reason"));
  assert.equal(called, 0);
  if (!reason.ok) assert.match(decideMessage(reason, "rm"), /5/);
});

await testAsync("product edit / merge still go to their own actions", async () => {
  const seen: string[] = [];
  const p = ports({
    loadRow: async (_c, id) => item({ category: "product_edits", item_id: id }),
    approveProductEdit: async (fd) => { seen.push("edit:" + fd.get("request_id")); return {}; },
    rejectProductMerge: async (fd) => { seen.push("merge:" + fd.get("request_id")); return {}; },
  });
  const ok = await runDecidePending(form("approve", { category: "product_edits" }), p);
  assert.equal(ok.ok, true);
  const no = await runDecidePending(form("reject", { category: "product_merge", note: "duplicate nahi" }), ports({
    loadRow: async (_c, id) => item({ category: "product_merge", item_id: id }),
    rejectProductMerge: async (fd) => { seen.push("merge:" + fd.get("review_notes")); return {}; },
  }));
  assert.equal(no.ok, true);
  assert.deepEqual(seen, ["edit:" + ID, "merge:duplicate nahi"]);
});

test("UI wiring: no browser confirm, no redirect, in-app dialog, green/red badge", () => {
  const btn = readFileSync("src/app/admin/my-work/pending/decide-buttons.tsx", "utf8");
  const act = readFileSync("src/app/admin/my-work/pending/actions.ts", "utf8");
  const rows = readFileSync("src/app/admin/my-work/pending/pending-rows.tsx", "utf8");
  const page = readFileSync("src/app/admin/my-work/pending/page.tsx", "utf8");
  assert.ok(!/window\.confirm|window\.prompt|window\.alert/.test(btn + rows + page));
  assert.ok(!/redirect\(/.test(act));
  assert.match(act, /if \(result\.ok\) revalidatePath/);
  assert.match(btn, /role="dialog"/);
  assert.match(btn, /disabled=\{busy\}/);
  assert.match(rows, /data-decision-badge/);
  assert.match(rows, /apb_state_approved/);
  assert.match(rows, /apb_state_rejected/);
  assert.match(page, /<PendingLive/);
  assert.equal(actionFail("  line\nbreak  ").error, "line break");
});

console.log(`\n${n} pending-decide tests passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
