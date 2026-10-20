/** Admin pending badges (582) -- pure helpers + wiring.  npm run test:admin-badges */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  CATEGORY_KEYS, ROLE_KEYS, GROUP_ORDER, INLINE_DECISIONS, approveState, markCodeOwn, adjustMineForCode, CODE_MAKER_COLS, ageDays, ageTone, live, totals,
  badgeForHref, badgeForGroup, categoriesForPath, newArrivals, groupItems, fmtRs, catLabelKey, roleLabelKey, groupLabelKey,
  type PendingCount, type PendingItem,
} from "../src/lib/pending/categories";
import { adminPendingDict } from "../src/lib/i18n/dict/admin-pending";

let n = 0;
function test(name: string, fn: () => void) { fn(); n++; console.log(`ok  ${name}`); }
const NOW = Date.parse("2026-10-19T12:00:00Z");
const ago = (d: number) => new Date(NOW - d * 86400000).toISOString();
const row = (p: Partial<PendingCount>): PendingCount => ({
  category: "x", group_key: "sales", route: "/admin/x", pending: 0, naya: 0, mine_to_act: 0, oldest_at: null, newest_at: null,
  amount: null, pending_with: "admin", seen_until: null, is_info: false, readable: true, ...p,
} as PendingCount);
const SQL = readFileSync("supabase/migrations/582_admin_pending_badges.sql", "utf8");
const dict = adminPendingDict as Record<string, { en: string; rm: string; ur: string }>;

test("CATEGORY_KEYS == SQL registry keys (582)", () => {
  const reg = SQL.slice(SQL.indexOf("fn_admin_pending_sources"));
  const keys = [...reg.matchAll(/^\s*\('([a-z_]+)',\s*'[a-z-]+',\s*'\//gm)].map((m) => m[1]);
  assert.equal(keys.length, 52);
  assert.deepEqual([...keys].sort(), [...CATEGORY_KEYS].sort());
  assert.equal(new Set(CATEGORY_KEYS).size, CATEGORY_KEYS.length);
});
test("every category / role / group has EN + RM + UR labels", () => {
  for (const k of [...CATEGORY_KEYS.map(catLabelKey), ...ROLE_KEYS.map(roleLabelKey), ...GROUP_ORDER.map(groupLabelKey)]) {
    const e = dict[k];
    assert.ok(e && e.en && e.rm && e.ur, `missing ${k}`);
  }
  assert.equal(dict.apb_own_tip.rm, "Apni entry — koi doosra approve karega");
  assert.equal(dict.apb_pending.rm, "PENDING · BAQI");
  assert.equal(dict.apb_new.rm, "Naya");
});
test("apb_ keys unique and not used by other dictionaries", () => {
  const dir = "src/lib/i18n/dict";
  const others = readdirSync(dir).filter((f) => f !== "admin-pending.ts").map((f) => readFileSync(`${dir}/${f}`, "utf8")).join("\n");
  assert.ok(!/\bapb_[a-z_]+\s*:/.test(others));
  const own = [...readFileSync(`${dir}/admin-pending.ts`, "utf8").matchAll(/^\s+(apb_[a-z_]+):/gm)].map((m) => m[1]);
  assert.equal(new Set(own).size, own.length);
});
test("approveState: own entry -> 'own' (Approve band), others inline only for existing flows", () => {
  assert.equal(approveState({ category: "product_edits", is_own: true }), "own");
  assert.equal(approveState({ category: "pos_returns", is_own: true }), "own");
  assert.equal(approveState({ category: "product_merge", is_own: false }), "enabled");
  assert.equal(approveState({ category: "expenses", is_own: false }), "page");
  assert.equal(approveState({ category: "expenses", is_own: true }), "page");
  assert.deepEqual(Object.keys(INLINE_DECISIONS).sort(), ["pos_returns", "product_edits", "product_merge"]);
  assert.equal(INLINE_DECISIONS.pos_returns.rejectNeedsReason, true);
});
test("POS wapsi: manager code wala (authorized_by) Approve nahi kar sakta, magar doosra kar sakta", () => {
  const it = (p: Partial<PendingItem>): PendingItem => ({ category: "pos_returns", group_key: "sales", route: "/admin/pos/returns", item_id: "r1",
    ref: null, title: null, amount: 130, created_at: ago(15), entered_by: "anwar", entered_by_name: "Anwar", actor_id: null, actor_name: null,
    pending_with: "admin_owner", is_own: false, is_new: false, link: null, ...p });
  const items = [it({ item_id: "r1" }), it({ item_id: "r2" }), it({ item_id: "r3", is_own: true })];
  const codeBy = new Map([["r1", "admin"], ["r2", "other_mgr"], ["r3", "admin"]]);
  const asAdmin = markCodeOwn(items, codeBy, "admin");
  assert.equal(approveState(asAdmin[0]), "code");
  assert.equal(approveState(asAdmin[1]), "enabled");
  assert.equal(approveState(asAdmin[2]), "own");           // apni darj ki hui: "own" hi rahe
  assert.equal(asAdmin[0].is_own, false);                   // "darj kiya" Anwar hi dikhe
  const asOwner = markCodeOwn(items, codeBy, "owner");
  assert.equal(approveState(asOwner[0]), "enabled");        // Owner review kar sakta
  assert.equal(approveState({ category: "product_edits", is_own: false, code_own: true }), "code");
  assert.equal(approveState({ category: "expenses", is_own: false, code_own: true }), "page");
  assert.deepEqual(CODE_MAKER_COLS.pos_returns, { table: "pos_returns", col: "authorized_by" });
  const c = [row({ category: "pos_returns", pending: 3, mine_to_act: 2 }), row({ category: "settlements", pending: 4, mine_to_act: 4 })];
  const adj = adjustMineForCode(c, asAdmin);
  assert.equal(adj[0].mine_to_act, 1);
  assert.equal(adj[1].mine_to_act, 4);
  // sab qatarein list mein nahi -> ginti na chherein
  assert.equal(adjustMineForCode([row({ category: "pos_returns", pending: 50, mine_to_act: 40 })], asAdmin)[0].mine_to_act, 40);
  assert.ok(dict.apb_code_tip.en && dict.apb_code_tip.rm && dict.apb_code_tip.ur);
});
test("Mere Kaam action: code wala bhi server par roka jata hai (code block, redirect nahi)", () => {
  const gate = readFileSync("src/lib/pending/decide.ts", "utf8");
  assert.match(gate, /CODE_MAKER_COLS\[category\]/);
  assert.match(gate, /return fail\("code"\)/);
  assert.match(gate, /row\.is_own\) return fail\("own"\)/);
  const act = readFileSync("src/app/admin/my-work/pending/actions.ts", "utf8");
  assert.ok(!/redirect\(/.test(act), "redirect same page par UI atka deta tha");
  const btn = readFileSync("src/app/admin/my-work/pending/decide-buttons.tsx", "utf8");
  assert.match(btn, /code_own: codeOwn/);
  assert.ok(!/window\.confirm/.test(btn));
});
test("age: days + tone (blue <3, amber 3-6, red 7+)", () => {
  assert.equal(ageDays(ago(0.2), NOW), 0);
  assert.equal(ageDays(ago(15.5), NOW), 15);
  assert.equal(ageDays(null, NOW), null);
  assert.equal(ageTone(2), "blue");
  assert.equal(ageTone(3), "amber");
  assert.equal(ageTone(7), "red");
});
test("totals: excludes info + unreadable, counts mine/naya/amount/old", () => {
  const c = [
    row({ category: "product_edits", route: "/admin/products/permissions", pending: 38, naya: 2, mine_to_act: 36, oldest_at: ago(15), amount: null }),
    row({ category: "load_proof", group_key: "finance", route: "/admin/finance/load", pending: 13, naya: 0, mine_to_act: 13, oldest_at: ago(4), amount: "52000" as unknown as number }),
    row({ category: "data_health", is_info: true, pending: 1220 }),
    row({ category: "expenses", readable: false, pending: null as unknown as number }),
  ];
  const t = totals(c, NOW);
  assert.equal(t.pending, 51);
  assert.equal(t.naya, 2);
  assert.equal(t.mine, 49);
  assert.equal(t.amount, 52000);
  assert.equal(t.oldTypes, 1);
  assert.equal(t.oldestDays, 15);
  assert.equal(t.info, 1220);
  assert.deepEqual(t.unreadable, ["expenses"]);
  assert.equal(live(c).length, 2);
});
test("badges: item by exact route, group by key or child href", () => {
  const c = [
    row({ category: "a", group_key: "hr", route: "/admin/hr/leave", pending: 3, naya: 1, oldest_at: ago(5), pending_with: "manager" }),
    row({ category: "b", group_key: "hr", route: "/admin/hr/advances?tab=p", pending: 2, oldest_at: ago(1) }),
    row({ category: "c", group_key: "admin", route: "/admin/support", pending: 4 }),
  ];
  assert.deepEqual(badgeForHref(c, "/admin/hr/leave", NOW)?.pending, 3);
  assert.equal(badgeForHref(c, "/admin/hr/advances", NOW)?.pending, 2);
  assert.equal(badgeForHref(c, "/admin/hr", NOW), null);
  const g = badgeForGroup(c, "hr", [], NOW)!;
  assert.equal(g.pending, 5); assert.equal(g.naya, 1); assert.equal(g.oldestDays, 5); assert.equal(g.pendingWith, "manager");
  assert.equal(badgeForGroup(c, "ops", ["/admin/support"], NOW)?.pending, 4);
  assert.equal(badgeForGroup(c, "ops", [], NOW), null);
});
test("seen-on-open + toast only on growth", () => {
  const prev = [row({ category: "a", route: "/admin/hr/leave", pending: 3, naya: 1 })];
  const next = [row({ category: "a", route: "/admin/hr/leave", pending: 4, naya: 2 }), row({ category: "z", route: "/admin/z", pending: 1, naya: 1 })];
  assert.deepEqual(newArrivals(null, next), []);
  assert.deepEqual(newArrivals(prev, next).sort(), ["a", "z"]);
  assert.deepEqual(newArrivals(next, next), []);
  assert.deepEqual(categoriesForPath(next, "/admin/hr/leave/123"), ["a"]);
  assert.deepEqual(categoriesForPath(next, "/admin/hr/leaves"), []);
});
test("groupItems follows department order; fmtRs", () => {
  const g = groupItems([{ group_key: "admin" }, { group_key: "sales" }, { group_key: "zzz" }, { group_key: "sales" }]);
  assert.deepEqual(g.map((x) => x.group), ["sales", "admin", "zzz"]);
  assert.equal(g[0].items.length, 2);
  assert.equal(fmtRs(null), "—");
  assert.equal(fmtRs("52000"), "Rs 52,000");
});
test("page wiring: approveState + own tooltip; actions reuse existing flows + refuse own", () => {
  const btn = readFileSync("src/app/admin/my-work/pending/decide-buttons.tsx", "utf8");
  assert.ok(btn.includes("approveState(") && btn.includes('"apb_own_tip"') && btn.includes('"apb_code_tip"') && /disabled[\s\S]{0,40}title=\{ownTip\}/.test(btn));
  const act = readFileSync("src/app/admin/my-work/pending/actions.ts", "utf8");
  for (const f of ["approveProductEdit", "rejectProductEdit", "approveProductMerge", "rejectProductMerge", "reviewPosReturn"]) assert.ok(act.includes(f));
  assert.ok(/is_own\) return fail\("own"\)/.test(readFileSync("src/lib/pending/decide.ts", "utf8")));
  assert.ok(!/\.from\([^)]*\)\s*\.(update|insert|delete|upsert)\(/.test(act), "no direct writes -- only existing actions");
  assert.ok(readFileSync("src/app/admin/my-work/pending/pending-rows.tsx", "utf8").includes('data-decision-badge'));
});
test("sidebar never collapses; provider polls every 60s; layout wires provider", () => {
  const sb = readFileSync("src/components/layout/sidebar.tsx", "utf8");
  assert.ok(!/collapse|setCollapsed|w-16|w-20\b/i.test(sb.replace(/koi collapse/g, "")));
  assert.ok(sb.includes("w-72") && sb.includes("usePending"));
  const ctx = readFileSync("src/components/pending/pending-context.tsx", "utf8");
  assert.ok(ctx.includes("PENDING_POLL_MS = 60_000") && ctx.includes("fn_admin_pending_counts"));
  assert.ok(readFileSync("src/app/admin/layout.tsx", "utf8").includes("<PendingProvider allowedRoutes={allowedPages}"));
  assert.ok(readFileSync("src/components/layout/notification-bell.tsx", "utf8").includes("PendingBellList"));
  assert.ok(readFileSync("src/components/layout/mobile-sidebar.tsx", "utf8").includes("badgeForHref"));
});
test("no WhatsApp / email / SMS in any new file", () => {
  const files = [
    "src/lib/pending/categories.ts", "src/components/pending/pending-context.tsx", "src/components/pending/pending-ui.tsx",
    "src/components/pending/pending-toast.tsx", "src/components/pending/pending-bell-panel.tsx",
    "src/app/admin/my-work/pending/page.tsx", "src/app/admin/my-work/pending/actions.ts", "src/app/admin/my-work/pending/decide-buttons.tsx",
    "src/app/admin/my-work/pending/live-state.tsx", "src/app/admin/my-work/pending/pending-rows.tsx", "src/lib/pending/decide.ts",
  ];
  for (const f of files) {
    const s = readFileSync(f, "utf8");
    assert.ok(!/from\s+["'][^"']*(whatsapp|mail|sms|twilio|resend|notify)[^"']*["']/i.test(s), `${f}: send import`);
    assert.ok(!/\bsend(WhatsApp|Wa|Email|Mail|Sms|Message)\w*\s*\(|wa\.me\/|api\.whatsapp/i.test(s), `${f}: send call`);
  }
});
console.log(`\n${n} admin-badges TS tests passed`);
