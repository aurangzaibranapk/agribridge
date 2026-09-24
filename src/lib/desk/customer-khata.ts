import "server-only";
import { requireAction } from "@/lib/access/guard";
import { createServiceClient } from "@/lib/supabase/service";

export type KhataEntry = { date: string; number: string; description: string; module: string; debit: number; credit: number };
export type KhataCustomer = { id: string; name: string; phone: string | null; debit: number; credit: number; outstanding: number; promiseDate: string | null; promiseAmount: number | null; entries: KhataEntry[] };
export type KhataResult = { customers: KhataCustomer[]; error: string | null; scope: string; datesAvailable: boolean };

/** Reuse posted receivable journal lines. Never add source-table totals to ledger totals. */
export async function loadCustomerKhata(): Promise<KhataResult> {
  const access = await requireAction("crm", "view");
  const fail = (error: string): KhataResult => ({ customers: [], error, scope: "", datesAvailable: false });
  if ("error" in access) return fail(access.error);
  const c = access.caller;
  // This branch has no shop attribution on journal entries. A shared customer
  // or a sale in one shop does not authorize reading that customer's other shops.
  if (!c.unrestricted && c.scope !== "all" && c.scope !== "own_branch") {
    return fail("Shop-level customer ledger mapping abhi available nahi. Admin se scoped ledger access configure karwayein; doosri shops ka hisaab yahan nahi dikhaya gaya.");
  }
  if (!c.unrestricted && c.scope === "own_branch" && !c.branchId) return fail("Branch assign nahi hai.");
  const db = createServiceClient() as any;
  const lines: any[] = [];
  for (let offset = 0; ; offset += 500) {
    let q = db.from("journal_lines").select("id,party_id,debit,credit,memo,journal_entries!inner(entry_date,entry_number,description,source_module,branch_id)")
      .eq("account_code", "1100").eq("party_type", "customer").not("party_id", "is", null).order("id").range(offset, offset + 499);
    if (!c.unrestricted && c.scope === "own_branch") q = q.eq("journal_entries.branch_id", c.branchId);
    const { data, error } = await q;
    if (error) return fail("Customer ledger load nahi hua. Dobara refresh karein.");
    lines.push(...data);
    if (data.length < 500) break;
  }
  const ids = [...new Set(lines.map(r => String(r.party_id)))];
  const customers: any[] = [];
  const promises: any[] = [];
  let datesAvailable = true;
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const names = await db.from("customers").select("id,name,phone_number").in("id", batch);
    if (names.error) return fail("Customer names load nahi hue.");
    customers.push(...names.data);
    for (let offset = 0; ; offset += 500) {
      let q = db.from("payment_promises").select("id,party_id,promise_date,promised_amount,fulfilled_amount,status")
        .eq("party_type", "customer").in("party_id", batch).in("status", ["open", "due_today", "partial", "overdue"])
        .order("promise_date").order("id").range(offset, offset + 499);
      if (!c.unrestricted && c.scope === "own_branch") q = q.eq("branch_id", c.branchId);
      const result = await q;
      if (result.error) { datesAvailable = false; break; }
      promises.push(...result.data);
      if (result.data.length < 500) break;
    }
  }
  const rows = customers.map(customer => {
    const entries = lines.filter(l => l.party_id === customer.id).map(l => {
      const e = l.journal_entries;
      return { date: e.entry_date, number: e.entry_number, description: l.memo || e.description || "—", module: e.source_module || "—", debit: Number(l.debit || 0), credit: Number(l.credit || 0) };
    }).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
    const debit = entries.reduce((sum, e) => sum + e.debit, 0);
    const credit = entries.reduce((sum, e) => sum + e.credit, 0);
    const promise = promises.find(p => p.party_id === customer.id && Number(p.promised_amount) > Number(p.fulfilled_amount));
    return { id: customer.id, name: customer.name, phone: customer.phone_number, debit, credit, outstanding: Math.round((debit - credit) * 100) / 100, promiseDate: datesAvailable ? promise?.promise_date ?? null : null, promiseAmount: datesAvailable && promise ? Number(promise.promised_amount) - Number(promise.fulfilled_amount) : null, entries };
  });
  return { customers: rows, error: null, datesAvailable, scope: !c.unrestricted && c.scope === "own_branch" ? "Assigned branch ledger" : "Authorized company ledger" };
}
