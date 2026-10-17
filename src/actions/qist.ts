"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { aajKaKhana } from "@/lib/utils/format";
import { failed, postQistSettlement, postQistWriteOff } from "@/lib/ledger/rules";
import { postFarmerLedger } from "@/lib/farmer-ledger";
import { buildSchedule, scheduleError, receivableAccount, payoutAccount, type QistFrequency, type QistParty, type QistSource, type ScheduleRow } from "@/lib/qist/schedule";

export interface QistState { error?: string; success?: string; planId?: string }
const err = (e: unknown): QistState => ({ error: typeof e === "string" ? e : (e as any)?.message ?? "Kuch ghalat ho gaya." });
async function me() {
  const sb = createClient() as any;
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}
const paths = (id?: string) => {
  revalidatePath("/admin/khata/qist");
  if (id) revalidatePath(`/admin/khata/qist/${id}`);
};

/** Naya plan (draft) + schedule; "submit" ho to saath hi manzoori ke liye. */
export async function createQistPlan(_p: QistState, fd: FormData): Promise<QistState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const partyType = String(fd.get("party_type")) as QistParty;
  const partyId = String(fd.get("party_id") ?? "");
  const total = Number(fd.get("total"));
  const count = Number(fd.get("count"));
  const frequency = String(fd.get("frequency")) as QistFrequency;
  const source = String(fd.get("deduct_source")) as QistSource;
  const start = String(fd.get("start_date") ?? "");
  if (!partyId) return err("Member chunein.");
  if (!(total > 0) || !(count >= 1)) return err("Kul raqam aur qiston ki tadaad zaroori.");
  let rows: ScheduleRow[];
  try { rows = JSON.parse(String(fd.get("rows") ?? "[]")); } catch { return err("Schedule parha nahi gaya."); }
  if (!rows.length) rows = buildSchedule({ total, count, frequency, start });
  const se = scheduleError(total, rows);
  if (se) return err(se);
  if (rows.length !== count) return err("Qiston ki tadaad schedule se nahi milti.");
  const capPct = String(fd.get("cap_pct") ?? "").trim(); const capAmt = String(fd.get("cap_amount") ?? "").trim();
  const { data: plan, error } = await sb.from("qist_plans").insert({
    party_type: partyType, party_id: partyId, party_name: (fd.get("party_name") as string) || null,
    origin: String(fd.get("origin") ?? "advance"), total, installments_count: count,
    mode: fd.get("mode") === "custom" ? "custom" : "equal", frequency, deduct_source: source,
    cap_pct: capPct ? Number(capPct) : null, cap_amount: capAmt ? Number(capAmt) : null,
    start_date: start || rows[0].dueDate, notes: (fd.get("notes") as string) || null, created_by: user.id,
  }).select("id").single();
  if (error) return err(error);
  const { error: e2 } = await sb.from("qist_installments").insert(rows.map((r) => ({ plan_id: plan.id, seq: r.seq, due_date: r.dueDate, amount_due: r.amount })));
  if (e2) { await sb.from("qist_plans").delete().eq("id", plan.id); return err(e2); }
  if (fd.get("submit") === "yes") {
    const { error: e3 } = await sb.rpc("fn_qist_submit", { p_plan: plan.id });
    if (e3) return { error: e3.message, planId: plan.id };
  }
  paths(plan.id);
  return { success: fd.get("submit") === "yes" ? "Plan manzoori ke liye bhej diya." : "Draft save ho gaya.", planId: plan.id };
}

export async function qistAction(_p: QistState, fd: FormData): Promise<QistState> {
  const { sb, user } = await me();
  const planId = String(fd.get("plan_id")); const action = String(fd.get("action")); const reason = (fd.get("reason") as string) || "";
  let res: { error: any; data?: any };
  if (action === "submit") res = await sb.rpc("fn_qist_submit", { p_plan: planId });
  else if (action === "approve" || action === "reject") res = await sb.rpc("fn_qist_decide", { p_plan: planId, p_approve: action === "approve", p_reason: reason || null });
  else if (["pause", "resume", "cancel"].includes(action)) res = await sb.rpc("fn_qist_set_status", { p_plan: planId, p_action: action, p_reason: reason });
  else if (action === "reschedule") {
    let rows: { dueDate: string; amount: number }[] = [];
    try { rows = JSON.parse(String(fd.get("rows") ?? "[]")); } catch { return err("Schedule parha nahi gaya."); }
    const capPct = String(fd.get("cap_pct") ?? "").trim(); const capAmt = String(fd.get("cap_amount") ?? "").trim();
    res = await sb.rpc("fn_qist_reschedule", {
      p_plan: planId, p_rows: rows.map((r) => ({ due_date: r.dueDate, amount: r.amount })), p_reason: reason,
      p_cap_pct: capPct ? Number(capPct) : null, p_cap_amount: capAmt ? Number(capAmt) : null, p_set_cap: true,
    });
  } else if (action === "write_off") {
    const { data: plan } = await sb.from("qist_plans").select("party_type, party_id, origin, code, branch_id").eq("id", planId).single();
    res = await sb.rpc("fn_qist_write_off", { p_plan: planId, p_reason: reason });
    if (!res.error && Number(res.data) > 0) {
      const posted = await postQistWriteOff({
        partyType: plan.party_type, partyId: plan.party_id, receivable: receivableAccount(plan.party_type, plan.origin),
        amount: Number(res.data), description: `Qist ${plan.code} maaf: ${reason}`,
        ctx: { createdBy: user?.id ?? null, branchId: plan.branch_id, claims: [{ table: "qist_plans", rowId: planId }] },
      });
      if (failed(posted)) return err(`Write-off ho gaya magar journal nahi bana: ${posted.error} -- Finance ko batayein.`);
      await sb.rpc("fn_qist_set_event_journal", { p_plan: planId, p_action: "written_off", p_journal: posted.id });
    }
  } else return err("Ghalat action.");
  if (res.error) return err(res.error);
  paths(planId);
  return { success: "Ho gaya." };
}

/** Adaigi se pehle: kitni qist kategi (likhta kuch nahi). */
export async function previewQist(partyType: QistParty, partyId: string, source: QistSource, payout: number) {
  const { sb } = await me();
  const { data, error } = await sb.rpc("fn_qist_preview", { p_party_type: partyType, p_party_id: partyId, p_source: source, p_as_of: aajKaKhana(), p_payout: payout });
  if (error) return { due: 0, deduct: 0, items: [] as any[] };
  return data as { due: number; deduct: number; items: { plan_id: string; code: string; due: number; deduct: number; shortfall: number }[] };
}

/** Naqad qist wasooli (cash source ya kisi bhi plan par haath se). */
export async function receiveQistCash(_p: QistState, fd: FormData): Promise<QistState> {
  const { sb, user } = await me();
  const planId = String(fd.get("plan_id")); const amount = Number(fd.get("amount")); const accountId = String(fd.get("account_id") ?? "");
  if (!(amount > 0) || !accountId) return err("Raqam aur khata zaroori.");
  const { data: plan } = await sb.from("qist_plans").select("id, code, party_type, party_id, origin, branch_id, deduct_source, status").eq("id", planId).single();
  if (!plan || plan.status !== "active") return err("Sirf chalu plan par wasooli.");
  if (plan.deduct_source !== "cash") return err("Is plan ki qist adaigi se katti hai -- naqad wasooli sirf 'Naqad' plan par.");
  const { data: txn, error: tErr } = await sb.from("finance_transactions").insert({
    account_id: accountId, transaction_type: "income", category: "Qist wasooli", amount, transaction_date: aajKaKhana(), notes: `Qist ${plan.code}`, created_by: user?.id ?? null,
  }).select("id").single();
  if (tErr) return err(tErr);
  const { data: applied, error } = await sb.rpc("fn_qist_apply", {
    p_party_type: plan.party_type, p_party_id: plan.party_id, p_source: "cash", p_as_of: "2999-12-31",
    p_payout: amount, p_source_table: "finance_transactions", p_source_id: txn.id,
  });
  if (error) { await sb.from("finance_transactions").delete().eq("id", txn.id); return err(error); }
  const got = Number(applied?.deduct ?? 0);
  if (got <= 0) { await sb.from("finance_transactions").delete().eq("id", txn.id); return err("Koi qist wajib nahi."); }
  if (got < amount) await sb.from("finance_transactions").update({ amount: got }).eq("id", txn.id);
  const posted = await postQistSettlement({
    partyType: plan.party_type, partyId: plan.party_id, receivable: receivableAccount(plan.party_type, plan.origin),
    cashAccountId: accountId, amount: got, description: `Qist ${plan.code} -- naqad wasooli`,
    ctx: { createdBy: user?.id ?? null, branchId: plan.branch_id, claims: [{ table: "finance_transactions", rowId: txn.id }] },
  });
  if (failed(posted)) {
    await sb.rpc("fn_qist_reverse_source", { p_source_table: "finance_transactions", p_source_id: txn.id, p_reason: posted.error });
    await sb.from("finance_transactions").delete().eq("id", txn.id);
    return err(posted.error);
  }
  await sb.rpc("fn_qist_set_deduction_journal", { p_source_table: "finance_transactions", p_source_id: txn.id, p_journal: posted.id });
  if (plan.party_type === "farmer") await postFarmerLedger({ farmerId: plan.party_id, sourceType: "other" as any, ledgerType: "credit", amount: got, notes: `Qist ${plan.code} naqad`, referenceId: txn.id, createdBy: user?.id ?? null });
  if (plan.party_type === "staff") await sb.from("staff_credit_ledger").insert({ profile_id: plan.party_id, ledger_type: "credit", source_type: "advance_repaid", amount: got, notes: `Qist ${plan.code} naqad`, created_by: user?.id ?? null });
  paths(planId);
  return { success: `Rs ${got.toLocaleString("en-PK")} wasool${got < amount ? " (baqi qist wajib nahi thi)" : ""}.` };
}

/** Member talaash (staff, kisan, customer, dealer, supplier). */
export async function searchQistMembers(term: string) {
  const { sb } = await me();
  const t = term.trim();
  if (t.length < 2) return [] as { type: QistParty; id: string; name: string; code: string | null }[];
  const like = `%${t}%`;
  const [f, c, s, d, sp] = await Promise.all([
    sb.from("farmers").select("id, full_name, farmer_code").ilike("full_name", like).limit(8),
    sb.from("customers").select("id, name, phone").ilike("name", like).limit(8),
    sb.from("profiles").select("id, full_name, role").ilike("full_name", like).not("role", "in", "(farmer,customer)").limit(8),
    sb.from("dealers").select("id, business_name").ilike("business_name", like).limit(5),
    sb.from("suppliers").select("id, name").ilike("name", like).limit(5),
  ]);
  return [
    ...(f.data ?? []).map((r: any) => ({ type: "farmer" as const, id: r.id, name: r.full_name, code: r.farmer_code })),
    ...(s.data ?? []).map((r: any) => ({ type: "staff" as const, id: r.id, name: r.full_name, code: r.role })),
    ...(c.data ?? []).map((r: any) => ({ type: "customer" as const, id: r.id, name: r.name, code: r.phone })),
    ...(d.data ?? []).map((r: any) => ({ type: "dealer" as const, id: r.id, name: r.business_name, code: null })),
    ...(sp.data ?? []).map((r: any) => ({ type: "supplier" as const, id: r.id, name: r.name, code: null })),
  ];
}
