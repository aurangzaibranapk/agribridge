/**
 * Nasal aur Sehat (Phase 4) -- tareekhein, kaam, zarkhezi, validation, admin CSV, dictionary aur wiring ke tests.
 * Chalayein: npm run test:portal-breeding   (569-571 ka asal SQL test: tests/portal-breeding-sql.mjs)
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  adminBreedCsv, adminBreedFilter, adminBreedTotal, calendarItems, coveragePct, fertilityStats, gestationDays, groupTasks, herdRepro, monthGrid,
  parseAdminBreed, parseEvents, parseHealth, parseRepro, parseTasks, previewDates, priorityTasks, shiftMonth, validateBreeding, validateCalving,
  validateHealth, withdrawalUntil, PREF_TASKS, TASKS, VACCINES, EVENT_TYPES, HEAT_SIGNS, PD_RESULTS, PD_METHODS, CALVING_EASE, HEALTH_KINDS,
} from "../src/lib/portal/breeding";
import { portalBreedingDict } from "../src/lib/i18n/dict/portal-breeding";

let passed = 0;
const test = (n: string, fn: () => void) => { fn(); passed++; console.log(`  ok  ${n}`); };
const AS = "2026-10-19";
const A = "11111111-1111-4111-8111-111111111111", S = "22222222-2222-4222-8222-222222222222";
const fd = (o: Record<string, string | string[]>) => ({
  get: (k: string) => (k in o ? (Array.isArray(o[k]) ? (o[k] as string[])[0] : o[k]) : null),
  getAll: (k: string) => (k in o ? (Array.isArray(o[k]) ? (o[k] as string[]) : [o[k]]) : []),
});
const ev = (id: string, animal: string, type: string, date: string, extra: Record<string, unknown> = {}) => ({ id, animal_id: animal, event_type: type, event_date: date, ...extra });

test("gestation + preview dates (SQL 569 jaisa)", () => {
  assert.equal(gestationDays("cow"), 283); assert.equal(gestationDays("buffalo"), 310); assert.equal(gestationDays("goat"), 150);
  const p = previewDates("cow", "2026-02-02");
  assert.equal(p.calving, "2026-11-12"); assert.equal(p.dryOff, "2026-09-13"); assert.equal(p.nextHeat, "2026-02-23");
  assert.equal(p.pdFrom, "2026-03-09"); assert.equal(p.pdTo, "2026-03-19");
  assert.equal(previewDates("buffalo", "2026-01-01").calving, "2026-11-07");
});

test("parsers: ghalat/khali data se crash nahi", () => {
  assert.deepEqual(parseEvents(null), []); assert.deepEqual(parseHealth("x"), []); assert.deepEqual(parseRepro(undefined), []);
  const e = parseEvents([ev("e1", A, "ai", "2026-02-02T00:00:00", { cost: "650", bull_name: "SPU-4410" })])[0];
  assert.equal(e.event_date, "2026-02-02"); assert.equal(e.cost, 650); assert.equal(e.bull_name, "SPU-4410");
  assert.equal(parseEvents([ev("e2", A, "hack", "2026-02-02")])[0].event_type, "heat");
  const t = parseTasks([{ task_key: "x:1", task: "evil", due_date: AS }, { task_key: "pd_due:1", task: "pd_due", due_date: AS, severity: "today", info: {} }]);
  assert.equal(t.length, 1); assert.equal(t[0].task, "pd_due");
});

test("tasks: group + priority (overdue pehle, withheld 'active' hafte mein)", () => {
  const raw = [
    { task_key: "a", task: "calving", due_date: "2026-10-30", severity: "later", info: {} },
    { task_key: "b", task: "dry_off", due_date: "2026-09-13", severity: "overdue", info: {} },
    { task_key: "c", task: "withheld", due_date: "2026-10-22", severity: "active", info: {} },
    { task_key: "d", task: "pd_due", due_date: AS, severity: "today", info: {} },
    { task_key: "e", task: "heat_watch", due_date: "2026-10-23", severity: "week", info: {} },
  ];
  const tasks = parseTasks(raw);
  const g = groupTasks(tasks);
  assert.deepEqual([g.overdue.length, g.today.length, g.week.length, g.later.length], [1, 1, 2, 1]);
  assert.deepEqual(priorityTasks(tasks, 3).map((x) => x.task_key), ["b", "d", "c"]);
});

test("herd donut + fertility", () => {
  const repro = parseRepro([
    { animal_id: "1", tag_no: "108", status: "milking", pregnant: true }, { animal_id: "2", tag_no: "104", status: "milking", pd_pending: true },
    { animal_id: "3", tag_no: "131", status: "milking" }, { animal_id: "4", tag_no: "129", status: "heifer" }, { animal_id: "5", tag_no: "133", status: "calf" },
  ]);
  assert.deepEqual(herdRepro(repro), { pregnant: 1, pdPending: 1, open: 1, young: 1, total: 4 });
  const evs = parseEvents([
    ev("c0", "x", "calving", "2025-01-10"), ev("s1", "x", "ai", "2025-12-01"), ev("p1", "x", "pd", "2026-01-10", { pd_result: "negative", service_id: "s1" }),
    ev("s2", "x", "ai", "2026-02-02"), ev("p2", "x", "pd", "2026-03-15", { pd_result: "positive", service_id: "s2" }),
    ev("t1", "y", "ai", "2026-03-01"), ev("tp", "y", "pd", "2026-04-10", { pd_result: "positive", service_id: "t1" }),
    ev("c1", "z", "calving", "2025-03-01"), ev("c2", "z", "calving", "2026-04-01"),
  ]);
  const f = fertilityStats(evs, AS);
  assert.equal(f.conception, 50);          // x ki pehli AI negative, y ki pehli positive
  assert.equal(f.aiPerPregnancy, 1.5);     // 3 AI / 2 hamal
  assert.equal(f.calvingIntervalMonths, 13); // 396 din
  assert.equal(f.daysOpen, 388);           // x: 10 Jan 2025 -> 2 Feb 2026
  assert.equal(fertilityStats([], AS).conception, null);
});

test("calendar: Monday se, 7 ke dabbe, waqiat + kaam", () => {
  const g = monthGrid("2026-10");
  assert.equal(g.length % 7, 0); assert.equal(g[0].date, "2026-09-28"); assert.equal(g.filter((c) => c.inMonth).length, 31);
  assert.equal(monthGrid("2026-02")[0].date, "2026-01-26");
  assert.equal(shiftMonth("2026-12", 1), "2027-01"); assert.equal(shiftMonth("2026-01", -1), "2025-12");
  const items = calendarItems(parseEvents([ev("e", A, "pd", "2026-10-05", { pd_result: "positive" }), ev("v", A, "ai", "2026-10-01", { voided: true })]),
    parseHealth([{ id: "h", animal_id: null, kind: "vaccine", vaccine_code: "FMD", event_date: "2026-10-02" }]),
    parseTasks([{ task_key: "k", task: "calving", due_date: "2026-10-30", severity: "later", tag_no: "120", info: {} }]), () => "#104");
  assert.deepEqual(items.map((i) => `${i.date}:${i.type}:${i.label}`), ["2026-10-02:vaccine:× FMD", "2026-10-05:pd:#104 PD ✓", "2026-10-30:calving:#120 ?"]);
});

test("coverage + withdrawal", () => {
  assert.equal(coveragePct(5, 5), 100); assert.equal(coveragePct(7, 5), 100); assert.equal(coveragePct(3, 4), 75); assert.equal(coveragePct(0, 0), null);
  assert.equal(withdrawalUntil("2026-10-17", 3, 4), "2026-10-23"); assert.equal(withdrawalUntil("2026-10-17", 1, 0), null);
});

test("validateBreeding: AI, heat, PD, ghaltiyan", () => {
  const ok = validateBreeding(fd({ event_type: "ai", animal_id: A, event_date: "2026-10-18", bull_name: "SPU-4410", semen_breed: "Sahiwal", cost: "650", payment: "cash", technician_phone: "0300-1234567" }), AS);
  assert.ok(ok.ok); if (ok.ok) { assert.equal(ok.value.cost, 650); assert.equal(ok.value.event_type, "ai"); }
  const heat = validateBreeding(fd({ event_type: "heat", animal_id: A, event_date: AS, heat_signs: ["mucus", "<script>", "bellow"] }), AS);
  assert.ok(heat.ok); if (heat.ok) assert.deepEqual(heat.value.heat_signs, ["mucus", "bellow"]);
  const bad = (o: Record<string, string>, e: string) => { const r = validateBreeding(fd(o), AS); assert.ok(!r.ok); if (!r.ok) assert.equal(r.error, e); };
  bad({ event_type: "ai", animal_id: A, event_date: AS }, "bh_err_bull");
  bad({ event_type: "ai", animal_id: "x", event_date: AS, bull_name: "B" }, "bh_err_animal");
  bad({ event_type: "ai", animal_id: A, event_date: "2026-10-20", bull_name: "B" }, "bh_err_date");
  bad({ event_type: "pd", animal_id: A, event_date: AS, pd_result: "positive" }, "bh_err_pd");
  bad({ event_type: "calving", animal_id: A, event_date: AS }, "bh_err_type"); // byaana alag RPC se
  bad({ event_type: "ai", animal_id: A, event_date: AS, bull_name: "B", cost: "-5" }, "bh_err_cost");
  assert.ok(validateBreeding(fd({ event_type: "pd", animal_id: A, event_date: AS, pd_result: "positive", service_id: S }), AS).ok);
});

test("validateCalving + validateHealth", () => {
  const c = validateCalving(fd({ animal_id: A, event_date: AS, calving_ease: "easy", calf_alive: "1", calf_sex: "F", calf_tag: "133" }), AS);
  assert.ok(c.ok); if (c.ok) { assert.equal(c.value.calf.tag_no, "133"); assert.equal(c.value.service, null); }
  const dead = validateCalving(fd({ animal_id: A, event_date: AS, calving_ease: "vet", calf_alive: "0" }), AS);
  assert.ok(dead.ok); if (dead.ok) assert.equal(dead.value.calf.tag_no, null);
  const noTag = validateCalving(fd({ animal_id: A, event_date: AS, calving_ease: "easy", calf_alive: "1" }), AS);
  assert.ok(!noTag.ok && noTag.error === "bh_err_calf_tag");
  const v = validateHealth(fd({ kind: "vaccine", animal_id: "", event_date: AS, vaccine_code: "FMD" }), AS);
  assert.ok(v.ok); if (v.ok) assert.equal(v.value.animal_id, null); // poora rewar
  const tr = validateHealth(fd({ kind: "treatment", animal_id: A, event_date: AS, medicine: "Oxytet", withdrawal_days: "4", doses: "3" }), AS);
  assert.ok(tr.ok); if (tr.ok) assert.equal(tr.value.withdrawal_days, 4);
  const h = (o: Record<string, string>, e: string) => { const r = validateHealth(fd(o), AS); assert.ok(!r.ok); if (!r.ok) assert.equal(r.error, e); };
  h({ kind: "vaccine", event_date: AS, vaccine_code: "XYZ" }, "bh_err_vaccine");
  h({ kind: "treatment", animal_id: A, event_date: AS }, "bh_err_medicine");
  h({ kind: "treatment", animal_id: A, event_date: AS, medicine: "Oxy", withdrawal_days: "500" }, "bh_err_withdrawal");
  h({ kind: "deworm", event_date: AS, medicine: "Alb", next_due: "2026-10-01" }, "bh_err_next");
  h({ kind: "junk", event_date: AS }, "bh_err_kind");
});

test("admin: filter, jama (wazan ke saath), CSV (BOM + formula guard)", () => {
  const rows = parseAdminBreed([
    { farmer_id: "f1", farmer_code: "FRM-000003", full_name: "Aslam", village: "Chak 12", animals: 10, pregnant: 4, calvings_30: 2, conception_pct: 50, services_known: 4, fmd_pct: 100, hs_pct: 80, lsd_pct: null, bq_pct: null, fmd_missing: 0, withheld: 1, overdue: 2, vets_cost: 2500 },
    { farmer_id: "f2", farmer_code: "FRM-000009", full_name: "=cmd()", village: "Chak 9", animals: 30, pregnant: 6, calvings_30: 0, conception_pct: 100, services_known: 2, fmd_pct: 60, hs_pct: null, lsd_pct: null, bq_pct: null, fmd_missing: 12, withheld: 0, overdue: 0, vets_cost: 500 },
  ]);
  assert.deepEqual(adminBreedFilter(rows, "overdue", "").map((r) => r.farmer_id), ["f1"]);
  assert.deepEqual(adminBreedFilter(rows, "lowvax", "").map((r) => r.farmer_id), ["f2"]);
  assert.deepEqual(adminBreedFilter(rows, "calving", "").map((r) => r.farmer_id), ["f1"]);
  assert.deepEqual(adminBreedFilter(rows, "all", "chak 9").map((r) => r.farmer_id), ["f2"]);
  const t = adminBreedTotal(rows);
  assert.equal(t.animals, 40); assert.equal(t.fmd, 70); assert.equal(t.conception, 67); assert.equal(t.hs, 80); assert.equal(t.overdueFarmers, 1);
  const csv = adminBreedCsv(rows, AS);
  assert.ok(csv.startsWith("\uFEFF")); assert.match(csv, /GRAND TOTAL/); assert.ok(!/,=cmd/.test(csv), "formula injection");
});

test("dictionary: har bh_ key teeno zabanon mein, khali nahi", () => {
  const d = portalBreedingDict as Record<string, { en: string; rm: string; ur: string }>;
  for (const [k, v] of Object.entries(d)) { assert.ok(v.en && v.rm && v.ur, k); assert.match(k, /^(bh_|nav_dairy_)/, k); }
  const need = [
    ...TASKS.map((x) => `bh_t_${x}`), ...EVENT_TYPES.map((x) => `bh_ty_${x}`), ...HEAT_SIGNS.map((x) => `bh_sign_${x}`), ...PD_RESULTS.map((x) => `bh_pd_${x}`),
    ...PD_METHODS.map((x) => `bh_pdm_${x}`), ...CALVING_EASE.map((x) => `bh_ease_${x}`), ...HEALTH_KINDS.map((x) => `bh_k_${x}`), ...VACCINES.map((x) => `bh_vx_${x}`),
    "nav_dairy_breeding", "nav_dairy_health", "bh_ch_wa_note",
  ];
  for (const k of need) assert.ok(k in d, `missing ${k}`);
  // har bh_err_ jo code mein hai, dictionary mein ho
  const code = ["src/lib/portal/breeding.ts", "src/app/portal/dairy/breeding/actions.ts"].map((f) => fs.readFileSync(f, "utf8")).join("\n");
  for (const k of Array.from(new Set(code.match(/bh_err_[a-z_]+/g) ?? []))) assert.ok(k in d, `missing ${k}`);
});

test("wiring + hifazat", () => {
  const PAGES = ["src/app/portal/dairy/breeding/page.tsx", "src/app/portal/dairy/breeding/animal/[id]/page.tsx", "src/app/portal/dairy/breeding/new/page.tsx", "src/app/portal/dairy/health/page.tsx", "src/app/portal/dairy/alerts/page.tsx", "src/app/admin/dairy/breeding/page.tsx", "src/app/admin/dairy/breeding/export/route.ts"];
  for (const f of PAGES) assert.ok(fs.existsSync(f), f);
  const sb = fs.readFileSync("src/lib/portal/nav.ts", "utf8"); // phase 6: menu ab yahan
  assert.match(sb, /\/portal\/dairy\/breeding/); assert.match(sb, /\/portal\/dairy\/health/); assert.match(sb, /\/portal\/dairy\/hisaab/);
  assert.match(fs.readFileSync("src/app/portal/dairy/page.tsx", "utf8"), /loadTasks/);
  assert.ok(!/Phase 4/.test(fs.readFileSync("src/app/portal/dairy/animals/[id]/page.tsx", "utf8")), "placeholder hata");
  assert.match(fs.readFileSync("src/app/admin/dairy/page.tsx", "utf8"), /\/admin\/dairy\/breeding/);
  for (const f of ["src/app/admin/dairy/breeding/page.tsx", "src/app/admin/dairy/breeding/export/route.ts"]) assert.match(fs.readFileSync(f, "utf8"), /isBreedAdmin\(\)/, f);
  assert.match(fs.readFileSync("src/lib/portal/breeding-load.ts", "utf8"), /"owner", "super_admin", "admin"|ADMIN_ROLES/);
  const act = fs.readFileSync("src/app/portal/dairy/breeding/actions.ts", "utf8");
  assert.match(act, /gate\.allowed/); assert.match(act, /fn_dairy_record_calving/);
  assert.ok(!/String\(fd\.get\("back"\)\)/.test(act), "back param must be validated (no open redirect / null)");
  const ALL = [...PAGES, "src/app/portal/dairy/breeding/actions.ts", "src/lib/portal/breeding.ts", "src/lib/portal/breeding-load.ts", "src/components/portal/breeding/breed-parts.tsx", "src/components/portal/breeding/link-cost.tsx", "src/components/portal/breeding/breed-preview.tsx"];
  for (const f of ALL) {
    const s = fs.readFileSync(f, "utf8").replace(/\/\/.*$/gm, "");
    assert.ok(!/service_role|SERVICE_ROLE|createAdminClient/.test(s), `service role in ${f}`);
    assert.ok(!/\.delete\(/.test(s), `delete in ${f}`);
    assert.ok(!/wa\.me|whatsapp\.com|graph\.facebook|sendWhatsapp|sendSms|twilio/i.test(s), `messaging in ${f}`);
  }
  // WhatsApp sirf band toggle (admin manzoori)
  const al = fs.readFileSync("src/app/portal/dairy/alerts/page.tsx", "utf8");
  assert.match(al, /aria-disabled/); assert.match(al, /bh_ch_wa_note/);
  assert.match(fs.readFileSync("package.json", "utf8"), /"test:portal-breeding"/);
  for (const m of ["569_dairy_breeding.sql", "570_dairy_health.sql", "571_dairy_reminders.sql"]) assert.ok(fs.existsSync(`supabase/migrations/${m}`), m);
  assert.deepEqual([...PREF_TASKS].sort(), ["calving", "deworm", "dry_off", "heat_watch", "pd_due", "vaccine", "withheld"]);
});
console.log(`\n${passed} passed`);
