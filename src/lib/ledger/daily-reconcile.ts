import { createServiceClient } from "@/lib/supabase/service";
import { trialBalance } from "@/lib/ledger/money-trail";
import { quantityReport } from "@/lib/ledger/quantity-money";
import { loadCostSheet } from "@/lib/milk-cost-per-liter";
import { TRANSIT_ALERT_DAYS } from "@/lib/ledger/handover";
import { DIFFERENCE_ALERT_THRESHOLD } from "@/lib/ledger/cash-close";

/**
 * Roz ka khud-kar milaan.
 *
 * Step 1 se 6 tak har rok apni jagah lag chuki hai. Un sab mein ek
 * kamzori mushtarak hai: dekhne ke liye kisi ko SAFHA KHOLNA parta hai.
 * Aur koi nahi kholta -- jis din sab theek ho us din kholna bekaar
 * lagta hai, aur jis din kuch ghalat ho usi din sab se zyada
 * masroofiyat hoti hai. Yani jo cheez sab se zyada tawajjah maangti
 * hai, wohi sab se der se nazar aati hai.
 *
 * Ab system khud roz dekhta hai.
 *
 * Har jaanch ke TEEN nateeje ho sakte hain, do nahi. "Check nahi ho
 * saka" ko "theek hai" ginana sab se aam aur sab se mehnga jhoot hai:
 * data na mile to report khud ko sabz dikha deti hai, aur jitna data kam
 * ho utni report achhi lagti hai -- yani jab system sab se kam jaanta
 * hai tab sab se zyada tasalli deta hai.
 */

/** Baat band karte waqt wajah kitni chhoti ho sakti hai. */
export const NOTE_MIN = 5;

export type CheckOutcome = "pass" | "fail" | "skip";

export interface CheckResult {
  key: string;
  outcome: CheckOutcome;
  severity: "red" | "amber" | "grey";
  title: string;
  detail: string;
  amount?: number;
  href?: string;
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function pass(key: string, title: string, detail: string): CheckResult {
  return { key, outcome: "pass", severity: "grey", title, detail };
}
function fail(
  key: string,
  severity: "red" | "amber",
  title: string,
  detail: string,
  amount?: number,
  href?: string
): CheckResult {
  return { key, outcome: "fail", severity, title, detail, amount, href };
}
/** Jaanch chal hi nahi saki -- ye "theek hai" NAHI hai. */
function skip(key: string, title: string, detail: string, href?: string): CheckResult {
  return { key, outcome: "skip", severity: "grey", title, detail, href };
}

// =====================================================================
// Jaanchein
// =====================================================================

/** 1. Kitab barabar hai? */
async function checkBalanced(): Promise<CheckResult> {
  const tb = await trialBalance();
  if (tb.totalDebit === 0 && tb.totalCredit === 0) {
    return skip(
      "ledger_balanced",
      "Kitab mein abhi koi entry nahi",
      "Barabri jaanchne ke liye kuch hai hi nahi. Ye theek hone ka nishan nahi — sirf khali hone ka.",
      "/admin/money-trail"
    );
  }
  if (tb.balanced) {
    return pass("ledger_balanced", "Kitab barabar hai", `Debit aur Credit dono Rs ${Math.round(tb.totalDebit).toLocaleString()}.`);
  }
  return fail(
    "ledger_balanced",
    "red",
    "Kitab BARABAR NAHI",
    "Ye kisi ke paisa lene ka nishan nahi, balke is baat ka ke system mein kuch bunyadi tor par toota hai. Is waqt baqi har adad par shak karna chahiye.",
    Math.abs(tb.difference),
    "/admin/money-trail"
  );
}

/** 2. Har raqam ledger tak pahunchi? */
async function checkAllPosted(): Promise<CheckResult> {
  const service = createServiceClient();
  const { data } = await service.from("v_ledger_coverage").select("source_table, pending, pending_amount");
  const rows = data ?? [];
  if (rows.length === 0) {
    return pass("all_posted", "Har raqam ledger tak pahunch chuki", "Koi entry apni purani table mein akeli nahi pari.");
  }
  const total = round2(rows.reduce((s, r) => s + Number(r.pending_amount ?? 0), 0));
  const count = rows.reduce((s, r) => s + Number(r.pending ?? 0), 0);
  return fail(
    "all_posted",
    "red",
    `${count} raqmein ledger tak nahi pahunchin`,
    `${rows.map((r) => r.source_table).join(", ")} — in ka double-entry record nahi bana. Trial Balance phir bhi barabar rahega, is liye ye khud nazar nahi aata.`,
    total,
    "/admin/money-trail"
  );
}

/** 3. Suspense khali hai? */
async function checkSuspense(): Promise<CheckResult> {
  const tb = await trialBalance();
  const row = tb.rows.find((r) => r.code === "9999");
  const amount = round2(row?.balance ?? 0);
  if (amount === 0) {
    return pass("suspense_empty", "Suspense khata khali hai", "Koi raqam aisi nahi jis ki wajah maloom na ho.");
  }
  return fail(
    "suspense_empty",
    "amber",
    "Suspense khate mein raqam pari hai",
    "Ye wo paisa hai jis ki wajah abhi maloom nahi. Is khate mein kuch bhi hona ek kaam hai jo baqi hai.",
    Math.abs(amount),
    "/admin/money-trail?account=9999"
  );
}

/** 4. Cash kisi ke haath mein kitne din se? */
async function checkTransit(): Promise<CheckResult> {
  const service = createServiceClient();
  const { data } = await service.from("v_cash_in_transit").select("amount_sent, din_guzray, lene_wala, le_jane_wala");
  const rows = data ?? [];
  if (rows.length === 0) {
    return pass("cash_transit", "Koi cash raaste mein nahi", "Har bheji hui raqam wusool ho chuki hai.");
  }
  const stale = rows.filter((r) => Number(r.din_guzray ?? 0) >= TRANSIT_ALERT_DAYS);
  const total = round2(rows.reduce((s, r) => s + Number(r.amount_sent ?? 0), 0));

  if (stale.length === 0) {
    return pass("cash_transit", "Raaste ka cash taza hai", `${rows.length} handover ki tasdeeq baqi hai, magar koi ${TRANSIT_ALERT_DAYS} din se purana nahi.`);
  }
  const names = Array.from(new Set(stale.map((r) => r.le_jane_wala ?? r.lene_wala ?? "—")));
  return fail(
    "cash_transit",
    "red",
    `${stale.length} raqam ${TRANSIT_ALERT_DAYS}+ din se kisi ke haath mein`,
    `${names.join(", ")} — tasdeeq abhi tak nahi hui. Jitna waqt guzarta hai, utna kam mumkin hota jata hai ke wo mile.`,
    total,
    "/admin/cash-handover"
  );
}

/** 5. Bank bheja hua pahuncha? */
async function checkBankTransit(): Promise<CheckResult> {
  const tb = await trialBalance();
  const amount = round2(tb.rows.find((r) => r.code === "1020")?.balance ?? 0);
  if (amount === 0) {
    return pass("bank_transit", "Bank ka koi paisa raaste mein nahi", "Jo bheja gaya wo pahunch chuka hai.");
  }
  return fail(
    "bank_transit",
    "amber",
    "Bank bheja gaya magar pahuncha nahi",
    "Ek taraf ka qadam darj hai, doosra nahi. Ya to jama hona baqi hai, ya wo entry reh gayi hai.",
    Math.abs(amount),
    "/admin/money-trail?account=1020"
  );
}

/** 6. Jin dinon cash hila magar ginti nahi hui. */
async function checkCashCloseMissing(): Promise<CheckResult> {
  const service = createServiceClient();
  const { data } = await service.from("v_cash_close_missing").select("branch_name, close_date");
  const rows = data ?? [];
  if (rows.length === 0) {
    return pass("cash_close_days", "Har din ki cash ginti hui", "Koi din chhoota nahi.");
  }
  const names = Array.from(new Set(rows.map((r) => r.branch_name ?? "—")));
  return fail(
    "cash_close_days",
    rows.length >= 3 ? "red" : "amber",
    `${rows.length} din ki cash ginti nahi hui`,
    `${names.join(", ")} — un dinon cash hila magar raat ko gina nahi gaya. Us din ka farq ab maloom nahi ho sakta.`,
    undefined,
    "/admin/cash-close"
  );
}

/** 7. Ginti mein nikla hua farq. */
async function checkCashGaps(): Promise<CheckResult> {
  const service = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 30);

  const { data } = await service
    .from("cash_closings")
    .select("difference, close_date")
    .neq("difference", 0)
    .gte("close_date", since.toISOString().slice(0, 10));

  const rows = data ?? [];
  if (rows.length === 0) {
    return pass("cash_gaps", "Cash ginti mein koi farq nahi", "Pichhle 30 din golak aur hisaab barabar mile.");
  }
  const total = round2(rows.reduce((s, r) => s + Math.abs(Number(r.difference ?? 0)), 0));
  const big = rows.filter((r) => Math.abs(Number(r.difference ?? 0)) >= DIFFERENCE_ALERT_THRESHOLD);

  return fail(
    "cash_gaps",
    big.length > 0 ? "red" : "amber",
    `Cash ginti mein ${rows.length} raat farq nikla`,
    `Har farq "Cash ka farq" khate mein darj hai. ${big.length > 0 ? `${big.length} raat ka farq Rs ${DIFFERENCE_ALERT_THRESHOLD} se zyada tha.` : "Sab chhote farq hain."}`,
    total,
    "/admin/cash-close"
  );
}

/** 8. Godam ki ginti. */
async function checkStockCounts(): Promise<CheckResult> {
  const service = createServiceClient();
  const { data } = await service.from("v_stock_count_overdue").select("warehouse_name, din_guzray");
  const rows = data ?? [];
  if (rows.length === 0) {
    return pass("stock_counts", "Har godam ki ginti waqt par hui", "Koi godam ek mahine se zyada arse se bin gina nahi.");
  }
  const never = rows.filter((r) => Number(r.din_guzray ?? 0) >= 9999);
  const names = rows.map((r) => r.warehouse_name ?? "—");
  return fail(
    "stock_counts",
    never.length > 0 ? "red" : "amber",
    `${rows.length} godam ki ginti arse se nahi hui`,
    never.length > 0
      ? `${never.length} godam to kabhi gina hi nahi gaya (${names.join(", ")}). Wahan farq ka jama hona shuru se jari hai.`
      : `${names.join(", ")} — ek mahine se zyada ho gaya.`,
    undefined,
    "/admin/stock-count"
  );
}

/** 9. Bank ki qataren jo hamare khate mein nahi. */
async function checkBankUnmatched(): Promise<CheckResult> {
  const service = createServiceClient();
  const [{ data: lines }, { data: all }] = await Promise.all([
    service.from("bank_statement_lines").select("amount").eq("status", "unmatched"),
    service.from("bank_statement_lines").select("id").limit(1),
  ]);

  if ((all ?? []).length === 0) {
    return skip(
      "bank_matched",
      "Bank statement daali hi nahi gayi",
      "Bank se milaan tabhi ho sakta hai jab statement daali jaye. Ab tak koi qatar nahi aayi — is liye ye jaanch chal hi nahi saki.",
      "/admin/bank-reconcile"
    );
  }
  const rows = lines ?? [];
  if (rows.length === 0) {
    return pass("bank_matched", "Bank ki har qatar khate mein maujood", "Bank aur hamara khata ek baat kehte hain.");
  }
  const total = round2(rows.reduce((s, r) => s + Math.abs(Number(r.amount ?? 0)), 0));
  return fail(
    "bank_matched",
    "amber",
    `Bank ki ${rows.length} qatar hamare khate mein nahi`,
    "Bank ghalat nahi hota — ye entriyan hamari taraf reh gayi hain (charges, munafa, ya koi adaigi jo kisi ne likhi hi nahi).",
    total,
    "/admin/bank-reconcile"
  );
}

/** 10. Wo nuqsan jo khareed ke andar chhupa hua hai. */
async function checkHiddenLoss(): Promise<CheckResult> {
  const now = new Date();
  const report = await quantityReport({ month: now.getMonth() + 1, year: now.getFullYear() });

  const bookable = report.streams.filter((s) => s.canBook);
  if (bookable.every((s) => s.qtyIn === 0)) {
    return skip(
      "hidden_loss",
      "Miqdar ka milaan nahi ho saka",
      "Is mahine doodh ya grain ka koi record nahi. Miqdar ke baghair ye nahi kaha ja sakta ke nuqsan hai ya nahi.",
      "/admin/quantity-money"
    );
  }
  if (report.hiddenLossValue === 0) {
    return pass("hidden_loss", "Koi chhupa hua nuqsan nahi", "Uthaya hua aur pahuncha hua maal barabar hai.");
  }
  const worst = bookable
    .filter((s) => !s.booked && s.gapValue > 0)
    .sort((a, b) => b.gapValue - a.gapValue)[0];

  return fail(
    "hidden_loss",
    report.hiddenLossValue >= 10000 ? "red" : "amber",
    "Nuqsan abhi khareed ke andar chhupa hua hai",
    worst
      ? `Sab se bara: ${worst.label} — ${Math.abs(worst.gap)} ${worst.unit} ka farq. Alag khane mein daalne se kul kharcha nahi badalta, magar nuqsan nazar aane lagta hai.`
      : "Alag khane mein daalne se kul kharcha nahi badalta, magar nuqsan nazar aane lagta hai.",
    report.hiddenLossValue,
    "/admin/quantity-money"
  );
}

/** 11. Fi litre ka hisaab poora hai? */
async function checkCostSheet(): Promise<CheckResult> {
  const now = new Date();
  const sheet = await loadCostSheet(now.getMonth() + 1, now.getFullYear(), null);

  if (sheet.liters === 0) {
    return skip(
      "cost_sheet",
      "Fi litre ka hisaab nahi ho saka",
      "Is mahine abhi doodh ka koi record nahi. Litre ke baghair fi litre kharcha nikalta hi nahi.",
      "/admin/milk-collection/cost-per-liter"
    );
  }
  if (sheet.missing.length === 0) {
    return pass("cost_sheet", "Fi litre ka hisaab poora hai", "Har kharche ka khana bhara hua hai.");
  }
  return fail(
    "cost_sheet",
    sheet.missing.length >= 3 ? "red" : "amber",
    `Fi litre ka hisaab adhoora — ${sheet.missing.length} khane khali`,
    `${sheet.missing.join(", ")} darj nahi huye. Khali khana sifar ki tarah ginta hai, is liye fi litre kharcha asal se KAM nazar aata hai — yani munafa asal se ZYADA.`,
    undefined,
    "/admin/milk-collection/cost-per-liter"
  );
}

/** 12. Wo cash jo kisi branch ke naam nahi. */
async function checkOrphanCash(): Promise<CheckResult> {
  const service = createServiceClient();
  const { data } = await service
    .from("journal_lines")
    .select("debit, credit, journal_entries!inner(branch_id)")
    .eq("account_code", "1000")
    .is("journal_entries.branch_id", null);

  const amount = round2(
    (data ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
  );
  if (amount === 0) {
    return pass("orphan_cash", "Har cash kisi branch ke naam hai", "Koi raqam ginti se bahar nahi.");
  }
  return fail(
    "orphan_cash",
    "amber",
    "Kuch cash kisi branch ke naam darj nahi",
    "Har branch sirf apna cash ginti hai, is liye ye raqam kisi ki bhi ginti mein nahi aati — yani is par kabhi farq nahi nikalta.",
    Math.abs(amount),
    "/admin/cash-close"
  );
}

// =====================================================================
// Poora amal
// =====================================================================

export interface RunSummary {
  verdict: "clean" | "issues" | "partial";
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  summary: string;
  results: CheckResult[];
}

/**
 * Sab jaanchein chalata hai.
 *
 * Har jaanch alag se chalti hai aur apni nakami khud sambhalti hai --
 * ek ke tootne se poora amal nahi rukta. Warna ek chhoti si kharabi
 * poore din ka milaan rok deti, aur wo din khamoshi se guzar jata.
 */
export async function runChecks(): Promise<RunSummary> {
  const checks = [
    checkBalanced,
    checkAllPosted,
    checkSuspense,
    checkTransit,
    checkBankTransit,
    checkCashCloseMissing,
    checkCashGaps,
    checkStockCounts,
    checkBankUnmatched,
    checkHiddenLoss,
    checkCostSheet,
    checkOrphanCash,
  ];

  const results: CheckResult[] = [];
  for (const check of checks) {
    try {
      results.push(await check());
    } catch (error) {
      // Jaanch khud toot gayi. Ise "theek hai" ginana sab se bura
      // hoga: wo kharabi hamesha ke liye chhup jayegi.
      results.push(
        skip(
          check.name,
          "Ye jaanch chal nahi saki",
          `Jaanch ke dauran kharabi aayi: ${error instanceof Error ? error.message : "wajah maloom nahi"}`
        )
      );
    }
  }

  const passed = results.filter((r) => r.outcome === "pass").length;
  const failed = results.filter((r) => r.outcome === "fail").length;
  const skipped = results.filter((r) => r.outcome === "skip").length;

  // Tarteeb ahem hai: masla sab se pehle. Aur "adhoora" ko sabz nahi
  // kaha jata -- jaanch chal hi na sake to nateeja maloom nahi, theek
  // nahi.
  const verdict = failed > 0 ? "issues" : skipped > 0 ? "partial" : "clean";

  const red = results.filter((r) => r.outcome === "fail" && r.severity === "red").length;
  const summary =
    verdict === "clean"
      ? `Saari ${passed} jaanch guzar gayi — koi masla nahi.`
      : verdict === "issues"
        ? `${failed} masle nikle${red > 0 ? ` (${red} foran dekhne wale)` : ""}${skipped > 0 ? `, aur ${skipped} jaanch chal hi nahi saki` : ""}.`
        : `${passed} jaanch theek, magar ${skipped} chal hi nahi saki — un ka nateeja maloom NAHI hai.`;

  return { verdict, total: results.length, passed, failed, skipped, summary, results };
}

/**
 * Nateeja mahfooz karna.
 *
 * Jo baat pehle bhi nikli thi aur abhi tak band nahi hui, us ki umar
 * purani tareekh se ginti hai. Rozana nayi tareekh dena us ko har roz
 * "nayi" bana deta -- aur wohi baat jo do mahine se khari hai, hamesha
 * taza lagti rehti.
 */
export async function saveRun(run: RunSummary, triggeredBy: string): Promise<{ id: string } | { error: string }> {
  const service = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: existing } = await service
    .from("reconciliation_runs")
    .select("id")
    .eq("run_date", today)
    .maybeSingle();
  if (existing) return { error: "Aaj ki jaanch pehle ho chuki hai." };

  const { data: header, error } = await service
    .from("reconciliation_runs")
    .insert({
      run_date: today,
      checks_total: run.total,
      checks_passed: run.passed,
      checks_failed: run.failed,
      checks_skipped: run.skipped,
      verdict: run.verdict,
      summary: run.summary,
      triggered_by: triggeredBy,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const notable = run.results.filter((r) => r.outcome !== "pass");
  if (notable.length > 0) {
    // Purani khuli baaton ki asal tareekh dhoondte hain.
    const { data: older } = await service
      .from("reconciliation_findings")
      .select("check_key, first_seen_date")
      .is("resolved_at", null)
      .in("check_key", notable.map((r) => r.key));

    const firstSeen = new Map<string, string>();
    for (const row of older ?? []) {
      const current = firstSeen.get(row.check_key);
      if (!current || row.first_seen_date < current) firstSeen.set(row.check_key, row.first_seen_date);
    }

    await service.from("reconciliation_findings").insert(
      notable.map((r) => ({
        run_id: header.id,
        check_key: r.key,
        severity: r.severity,
        title: r.title,
        detail: r.detail,
        amount: r.amount ?? null,
        href: r.href ?? null,
        first_seen_date: firstSeen.get(r.key) ?? today,
      }))
    );
  }

  return { id: header.id };
}
