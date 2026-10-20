"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { aajKaKhana } from "@/lib/utils/format";
import { failed, postPayrollApproved, postPayrollPaid, postStaffAdvance } from "@/lib/ledger/rules";
import { reverseJournal } from "@/lib/ledger/post";
import { reverseCashBookById } from "@/lib/finance/cash-book";
import { payrollApprovalLines, MONTHS_RU } from "@/lib/payroll/compute";
import { notifyUser } from "@/lib/notifications";

export interface PayrollState { error?: string; success?: string }
const ok = (success: string): PayrollState => ({ success });
const err = (e: unknown): PayrollState => ({ error: typeof e === "string" ? e : (e as any)?.message ?? "Kuch ghalat ho gaya." });

async function me() {
  const sb = createClient() as any;
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}
function paths() {
  ["/admin/hr/salary-structure", "/admin/hr/payroll", "/admin/hr/advances", "/admin/my-hr", "/admin/khata/qist"].forEach((p) => revalidatePath(p));
}

// ---------------- 551 Structure ----------------
export async function saveSalaryStructure(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const profileId = String(fd.get("profile_id") ?? "");
  const basic = Number(fd.get("basic") ?? 0);
  const effectiveFrom = String(fd.get("effective_from") ?? "");
  if (!profileId || !(basic > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return err("Staff, basic (sifar se zyada) aur laagu tareekh zaroori hain.");
  const { data: s, error } = await sb.from("staff_salary_structures")
    .insert({ profile_id: profileId, basic, effective_from: effectiveFrom, notes: (fd.get("notes") as string) || null, created_by: user.id })
    .select("id").single();
  if (error) return err(error);
  const items: { structure_id: string; component_id: string; amount: number | null; pct: number | null }[] = [];
  for (const [k, v] of fd.entries()) {
    const m = /^comp_(amount|pct)_(.+)$/.exec(k);
    if (!m || String(v).trim() === "") continue;
    const n = Number(v);
    if (!(n > 0)) continue;
    let it = items.find((x) => x.component_id === m[2]);
    if (!it) { it = { structure_id: s.id, component_id: m[2], amount: null, pct: null }; items.push(it); }
    if (m[1] === "amount") it.amount = n; else it.pct = n;
  }
  if (items.length) {
    const { error: e2 } = await sb.from("staff_salary_structure_items").insert(items);
    if (e2) return err(e2);
  }
  paths();
  return ok("Structure draft ban gaya -- ab Admin/Owner manzoor kare.");
}

export async function decideSalaryStructure(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb } = await me();
  const { error } = await sb.rpc("fn_salary_structure_decide", {
    p_id: String(fd.get("id")), p_approve: fd.get("decision") === "approve", p_reason: (fd.get("reason") as string) || null,
  });
  if (error) return err(error);
  paths();
  return ok(fd.get("decision") === "approve" ? "Structure manzoor ho gaya." : "Structure rad kar diya.");
}

export async function toggleSalaryComponent(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  const patch: Record<string, unknown> = { is_active: fd.get("is_active") === "true", updated_by: user?.id ?? null };
  if (fd.get("default_amount") !== null && fd.get("default_amount") !== "") patch.default_amount = Number(fd.get("default_amount"));
  if (fd.get("default_pct") !== null && fd.get("default_pct") !== "") patch.default_pct = Number(fd.get("default_pct"));
  const { error } = await sb.from("salary_components").update(patch).eq("id", String(fd.get("id")));
  if (error) return err(error);
  paths();
  return ok("Component update ho gaya.");
}

export async function addSalaryComponent(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  const name = String(fd.get("name") ?? "").trim();
  const kind = String(fd.get("kind") ?? "earning");
  const calc = String(fd.get("calc") ?? "fixed");
  if (name.length < 2) return err("Naam likhein.");
  const code = name.toUpperCase().replace(/[^A-Z0-9]+/g, "_").slice(0, 24) + "_" + Date.now().toString(36).slice(-4).toUpperCase();
  const { error } = await sb.from("salary_components").insert({ code, name, kind, calc, is_active: false, updated_by: user?.id ?? null });
  if (error) return err(error);
  paths();
  return ok("Naya component ban gaya (band). Chalu karne ke liye toggle karein.");
}

export async function savePayrollSettings(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  const cap = String(fd.get("advance_cap_pct") ?? "").trim();
  const { error } = await sb.from("hr_payroll_settings").update({
    advance_min_service_months: Number(fd.get("advance_min_service_months") ?? 6),
    advance_cap_pct: cap === "" ? null : Number(cap),
    updated_by: user?.id ?? null, updated_at: new Date().toISOString(),
  }).eq("id", 1);
  if (error) return err(error);
  paths();
  return ok("Settings save ho gayi.");
}

// ---------------- 553 Payroll run ----------------
export async function createPayrollRun(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const year = Number(fd.get("year")); const month = Number(fd.get("month"));
  const branchId = (fd.get("branch_id") as string) || null;
  let { data: run } = await sb.from("payroll_runs").select("id, status").eq("pay_year", year).eq("pay_month", month)
    .neq("status", "cancelled").is("branch_id", branchId as any).maybeSingle();
  if (branchId) {
    const r = await sb.from("payroll_runs").select("id, status").eq("pay_year", year).eq("pay_month", month).neq("status", "cancelled").eq("branch_id", branchId).maybeSingle();
    run = r.data;
  }
  if (!run) {
    const { data, error } = await sb.from("payroll_runs").insert({ pay_year: year, pay_month: month, branch_id: branchId, created_by: user.id }).select("id, status").single();
    if (error) return err(error);
    run = data;
  }
  if (run.status !== "draft") return err("Is mahine ka run pehle se aage ja chuka hai.");
  const { data: n, error } = await sb.rpc("fn_payroll_compute", { p_run: run.id, p_ack_unfinalized: fd.get("ack_unfinalized") === "yes" });
  if (error) return err(error);
  paths();
  return ok(`${n} staff ka hisaab ban gaya.`);
}

export async function payrollTransition(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  const runId = String(fd.get("run_id"));
  const action = String(fd.get("action"));
  if (action !== "approve") {
    const { error } = await sb.rpc("fn_payroll_transition", { p_run: runId, p_action: action, p_reason: (fd.get("reason") as string) || null });
    if (error) return err(error);
    paths();
    return ok("Ho gaya.");
  }
  // Manzoori: halat -> qist kattauti (SQL) -> journal -> nishan. Journal na bane to sab wapas.
  const { error } = await sb.rpc("fn_payroll_transition", { p_run: runId, p_action: "approve" });
  if (error) return err(error);
  const { data: run } = await sb.from("payroll_runs").select("id, pay_year, pay_month, branch_id").eq("id", runId).single();
  const { data: lines } = await sb.from("payroll_lines").select("gross, absent_deduction, other_deductions, advance_deduction, net").eq("run_id", runId);
  const totals = payrollApprovalLines((lines ?? []).map((l: any) => ({
    gross: Number(l.gross), absentDeduction: Number(l.absent_deduction), otherDeductions: Number(l.other_deductions), advance: Number(l.advance_deduction), net: Number(l.net),
  })));
  const label = `Payroll ${MONTHS_RU[run.pay_month - 1]} ${run.pay_year}`;
  const posted = await postPayrollApproved({ runId, label, totals, ctx: { createdBy: user?.id ?? null, branchId: run.branch_id, claims: [{ table: "payroll_runs", rowId: runId }] } });
  if (failed(posted)) {
    await sb.rpc("fn_payroll_transition", { p_run: runId, p_action: "unapprove" });
    return err(`Journal nahi bana, is liye manzoori wapas: ${posted.error}`);
  }
  const { error: e3 } = await sb.rpc("fn_payroll_set_journal", { p_run: runId, p_kind: "approve", p_journal: posted.id });
  if (e3) return err(e3);
  paths();
  return ok("Payroll manzoor -- journal ban gaya.");
}

export async function payPayrollRun(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  const runId = String(fd.get("run_id"));
  const accountId = String(fd.get("account_id") ?? "");
  if (!accountId) return err("Kis khate se ada ho rahi hai, wo chunein.");
  const { data: claim, error: claimError } = await sb.rpc("fn_payroll_claim_pay", { p_run: runId });
  if (claimError) return err(claimError);
  if (claim === "already_paid") return ok("Ye payroll pehle hi ada ho chuki hai. Dobara paisa nahi likha gaya.");
  const { data: run } = await sb.from("payroll_runs").select("id, status, pay_year, pay_month, branch_id, created_by, approve_journal_id").eq("id", runId).single();
  if (!run || run.status !== "approved" || !run.approve_journal_id) {
    await sb.rpc("fn_payroll_release_pay_lock", { p_run: runId });
    return err("Pehle manzoori aur journal.");
  }
  if (run.created_by === user?.id) {
    await sb.rpc("fn_payroll_release_pay_lock", { p_run: runId });
    return err("Banane wala khud ada nahi kar sakta.");
  }
  const { data: lines } = await sb.from("payroll_lines").select("profile_id, net").eq("run_id", runId);
  const total = Math.round((lines ?? []).reduce((s: number, l: any) => s + Number(l.net), 0) * 100) / 100;
  const label = `Tankhwah ada ${MONTHS_RU[run.pay_month - 1]} ${run.pay_year}`;
  const { data: txn, error: tErr } = await sb.from("finance_transactions").insert({
    account_id: accountId, transaction_type: "expense", category: "Salary", amount: total, transaction_date: aajKaKhana(), notes: label, created_by: user?.id ?? null,
  }).select("id").single();
  if (tErr) {
    await sb.rpc("fn_payroll_release_pay_lock", { p_run: runId });
    return err(`Cash book mein darj nahi hui: ${tErr.message}`);
  }
  const posted = await postPayrollPaid({ runId, label, amount: total, accountId, ctx: { createdBy: user?.id ?? null, branchId: run.branch_id, claims: [{ table: "finance_transactions", rowId: txn.id }] } });
  if (failed(posted)) {
    await reverseCashBookById(txn.id, "Payroll cash book ulti");
    await sb.rpc("fn_payroll_release_pay_lock", { p_run: runId });
    return err(`Ledger mein nahi gayi: ${posted.error}`);
  }
  const { error } = await sb.rpc("fn_payroll_set_journal", { p_run: runId, p_kind: "pay", p_journal: posted.id, p_account: accountId, p_txn: txn.id });
  if (error) {
    await reverseJournal(posted.id, "Payroll adaigi ka nishan nahi laga", user?.id ?? null);
    await reverseCashBookById(txn.id, "Payroll cash book ulti");
    await sb.rpc("fn_payroll_release_pay_lock", { p_run: runId });
    return err(error);
  }
  for (const l of lines ?? []) {
    await notifyUser(l.profile_id, `Tankhwah di gayi — ${MONTHS_RU[run.pay_month - 1]} ${run.pay_year}`, `Aap ki Rs ${Number(l.net).toLocaleString("en-PK")} tankhwah di gayi.`, "/admin/my-hr");
  }
  paths();
  revalidatePath("/admin/finance");
  return ok(`Rs ${total.toLocaleString("en-PK")} ada -- cash book aur ledger dono mein.`);
}

// ---------------- 552 Advance ----------------
export async function requestStaffAdvance(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const amount = Number(fd.get("amount")); const n = Number(fd.get("installments"));
  const [y, m] = String(fd.get("first_month") ?? "").split("-").map(Number);
  if (!(amount > 0) || !(n >= 1) || !y || !m) return err("Raqam, qiston ki tadaad aur pehla mahina zaroori hain.");
  const { error } = await sb.from("staff_advances").insert({
    profile_id: String(fd.get("profile_id")), amount, installments: n, installment_amount: Math.round(amount / n),
    first_year: y, first_month: m, reason: String(fd.get("reason") ?? ""), requested_by: user.id,
  });
  if (error) return err(error);
  paths();
  return ok("Darkhwast bhej di -- Admin/Owner manzoor kare.");
}

export async function decideStaffAdvance(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb } = await me();
  const { error } = await sb.rpc("fn_staff_advance_decide", { p_id: String(fd.get("id")), p_approve: fd.get("decision") === "approve", p_reason: (fd.get("reason") as string) || null });
  if (error) return err(error);
  paths();
  return ok("Ho gaya.");
}

export async function payStaffAdvance(_p: PayrollState, fd: FormData): Promise<PayrollState> {
  const { sb, user } = await me();
  const id = String(fd.get("id")); const accountId = String(fd.get("account_id") ?? "");
  if (!accountId) return err("Khata chunein.");
  const { data: a } = await sb.from("staff_advances").select("id, profile_id, amount, status").eq("id", id).single();
  if (!a || a.status !== "approved") return err("Pehle manzoori zaroori hai.");
  if (a.profile_id === user?.id) return err("Apna advance khud ada nahi kiya ja sakta.");
  const { data: txn, error: tErr } = await sb.from("finance_transactions").insert({
    account_id: accountId, transaction_type: "expense", category: "Staff Advance", amount: a.amount, transaction_date: aajKaKhana(), notes: "Staff advance", created_by: user?.id ?? null,
  }).select("id").single();
  if (tErr) return err(tErr);
  const posted = await postStaffAdvance({ profileId: a.profile_id, amount: Number(a.amount), accountId, description: "Staff advance (qiston mein)", ctx: { createdBy: user?.id ?? null, claims: [{ table: "finance_transactions", rowId: txn.id }] } });
  if (failed(posted)) { await reverseCashBookById(txn.id, "Payroll cash book ulti"); return err(posted.error); }
  const { error } = await sb.rpc("fn_staff_advance_mark_paid", { p_id: id, p_account: accountId, p_txn: txn.id, p_journal: posted.id });
  if (error) {
    await reverseJournal(posted.id, "Advance ka nishan nahi laga", user?.id ?? null);
    await reverseCashBookById(txn.id, "Payroll cash book ulti");
    return err(error);
  }
  await sb.from("staff_credit_ledger").insert({ profile_id: a.profile_id, ledger_type: "debit", source_type: "advance", amount: a.amount, notes: "Staff advance -- qiston mein tankhwah se", created_by: user?.id ?? null });
  paths();
  return ok("Advance ada -- qist plan tankhwah se chalu.");
}
