"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reverseJournal } from "@/lib/ledger/post";
import { logAudit } from "@/lib/audit";
import { REVERSAL_REASON_MIN } from "@/lib/ledger/audit-trail";
import { loadUserAccess } from "@/lib/access/permissions";
import { ACC } from "@/lib/ledger/rules";
import { postJournal } from "@/lib/ledger/post";
import {
  customerBalanceFromLedger,
  dealerPayableWrite,
  isMoneyWriter,
  originalEntryAmount,
  payableFromLedger,
  restorePayableGate,
  selfReversalGate,
} from "@/lib/finance/money-guards";

export interface ActionState {
  error?: string;
  success?: boolean;
  message?: string;
}

/** Legitimate sale-return ke baad customer ka purana credit restore karna. */
export async function restoreCustomerPayable(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const relatedEntryId = String(formData.get("related_entry_id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim();
  const amount = Number(String(formData.get("amount") ?? "").replace(/,/g, ""));
  if (!customerId || !relatedEntryId) return { error: "Customer aur related entry zaroori hai." };
  if (!Number.isFinite(amount) || amount <= 0) return { error: "Restore amount Rs 0 se zyada likhein." };
  if (reason.length < REVERSAL_REASON_MIN) return { error: `Wajah kam az kam ${REVERSAL_REASON_MIN} harf ki likhein.` };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };
  const access = await loadUserAccess(user.id);
  if (!access) return { error: "Login karein." };
  const { data: originalLines } = await service
    .from("journal_lines")
    .select("account_code, debit, credit, party_id")
    .eq("entry_id", relatedEntryId);
  const originalCap = originalEntryAmount(originalLines ?? [], customerId);
  const restoreGate = restorePayableGate(access.role, amount, originalCap);
  if (!restoreGate.ok) return { error: restoreGate.error };

  const { data: customer } = await service.from("customers").select("name, current_balance").eq("id", customerId).maybeSingle();
  if (!customer) return { error: "Customer nahi mila." };
  const { data: original } = await service.from("journal_entries").select("entry_number").eq("id", relatedEntryId).maybeSingle();
  if (!original) return { error: "Related entry nahi mili." };

  const { data: already } = await service
    .from("journal_entries")
    .select("entry_number")
    .eq("source_module", "customer_balance_correction")
    .eq("source_id", relatedEntryId)
    .maybeSingle();
  if (already) return { error: `Is entry ki credit correction pehle hi ho chuki hai (${already.entry_number}).` };

  const posted = await postJournal({
    description: `Customer payable restore — ${customer.name} — ${original.entry_number}`,
    sourceModule: "customer_balance_correction",
    sourceId: relatedEntryId,
    createdBy: user.id,
    lines: [
      { account: ACC.suspense, debit: amount, memo: `Correction against ${original.entry_number}` },
      { account: ACC.customerDue, credit: amount, partyType: "customer", partyId: customerId, memo: `Customer credit restore — ${reason}` },
    ],
  });
  if ("error" in posted) return { error: posted.error };

  const before = Number(customer.current_balance ?? 0);
  const after = Math.round((before - amount) * 100) / 100;
  const { error: updateError } = await service.from("customers").update({ current_balance: after }).eq("id", customerId);
  if (updateError) return { error: `Ledger correction ban gayi magar customer balance update nahi hua: ${updateError.message}` };

  await logAudit({
    actionType: "update",
    module: "customer_balance_correction",
    recordId: customerId,
    recordLabel: original.entry_number,
    description: `Customer payable Rs ${amount.toLocaleString()} restore hua: ${reason}`,
    changes: { current_balance: { pehle: before, ab: after } },
  });
  revalidatePath("/admin/finance/khata-control");
  revalidatePath("/admin/crm");
  revalidatePath(`/admin/crm/${customerId}/statement`);
  return { success: true, message: `Rs ${amount.toLocaleString()} payable restore ho gaya (${posted.entryNumber}).` };
}

/** Hisaab ka zimmedar kaun -- reversal ek maali kaam hai. */

/**
 * Ghalti theek karne ka wahid raasta.
 *
 * 106 se ye baat baar baar kahi ja rahi hai ke ghalti mitane se nahi,
 * reversal se theek hoti hai -- magar us ko bulane ka koi raasta nahi
 * tha. Aisa nizam logon ko database tak jane par majboor karta hai,
 * yani theek us jagah jahan koi rok nahi.
 *
 * Reversal purani entry ko chhoota nahi. Wo us ke ulat ek nayi entry
 * banata hai. Dono nazar aati rehti hain, aur yehi maqsad hai: mita
 * dene se ghalti ke sath us ka saboot bhi chala jata hai, aur phir ye
 * sawal kabhi jawab nahi paata ke wo raqam thi kahan.
 */
export async function reverseEntry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = createClient();
  const service = createServiceClient();

  const entryId = String(formData.get("entry_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();

  if (!entryId) return { error: "Kaunsi entry ulti karni hai, wo saaf nahi." };
  if (reason.length < REVERSAL_REASON_MIN) {
    return {
      error: `Reversal ki wajah likhna zaroori hai — kam az kam ${REVERSAL_REASON_MIN} harf. Ye wajah hamesha ke liye darj rahegi.`,
    };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Login karein." };

  // Reversal ab apna feature hai (finance.reversal, 274): role se kisi ko
  // nahi, Owner/Admin unrestricted; baqi ko darkhwast se ijazat milti hai.
  const access = await loadUserAccess(user.id);
  if (!access || !isMoneyWriter(access.role)) {
    return { error: "Entry ulti karna sirf Owner, Super Admin ya Admin ka kaam hai." };
  }

  const { data: entry } = await service
    .from("journal_entries")
    .select("entry_number, description, source_module, created_by")
    .eq("id", entryId)
    .maybeSingle();
  const reversalGate = selfReversalGate(entry?.created_by, user.id);
  if (!reversalGate.ok) return { error: reversalGate.error };

  // Finance review #4: reversal journal ki HAR party line ulti karta hai
  // (reverse_journal_atomic party_type/party_id samait qataren copy karta
  // hai), is liye supplier, kisan, staff, vendor ke khate -- jo ledger se
  // hi bante hain -- khud barabar ho jate hain. Sirf customer ka ek
  // alag rakha hua adad (customers.current_balance) hai; us ko ab
  // "pehle minus farq" se nahi, ledger (1100) se dobara gin kar likhte
  // hain -- RPC pehle hi likh de to bhi dobara minus nahi hota.
  const { data: partyLines, error: partyErr } = await service
    .from("journal_lines")
    .select("account_code, party_type, party_id, debit, credit")
    .eq("entry_id", entryId)
    .not("party_id", "is", null);
  if (partyErr) return { error: `Entry ki party qataren nahi parhi ja sakin, reversal nahi kiya: ${partyErr.message}` };

  const result = await reverseJournal(entryId, reason, user.id);
  if ("error" in result) return { error: result.error };

  const parties = new Map<string, Set<string>>();
  for (const line of partyLines ?? []) {
    const t = String(line.party_type ?? "");
    const id = String(line.party_id ?? "");
    if (!t || !id) continue;
    if (!parties.has(t)) parties.set(t, new Set());
    parties.get(t)!.add(id);
  }

  const balanceErrors: string[] = [];
  for (const customerId of parties.get("customer") ?? []) {
    const { data: customer, error: readErr } = await service
      .from("customers")
      .select("current_balance")
      .eq("id", customerId)
      .maybeSingle();
    if (readErr || !customer) {
      balanceErrors.push(`customer ${customerId}: ${readErr?.message ?? "nahi mila"}`);
      continue;
    }
    const { data: rows, error: sumErr } = await service
      .from("journal_lines")
      .select("debit, credit")
      .eq("account_code", ACC.customerDue)
      .eq("party_type", "customer")
      .eq("party_id", customerId);
    if (sumErr) {
      balanceErrors.push(`customer ${customerId}: ${sumErr.message}`);
      continue;
    }
    const before = Number(customer.current_balance ?? 0);
    const after = customerBalanceFromLedger(rows ?? []);
    if (after == null) {
      balanceErrors.push(`customer ${customerId}: ledger mein indraj nahi — sifar nahi likha`);
      continue;
    }
    if (Math.abs(after - before) < 0.005) continue;
    const { error: updErr } = await service.from("customers").update({ current_balance: after }).eq("id", customerId);
    if (updErr) {
      balanceErrors.push(`customer ${customerId}: ${updErr.message}`);
      continue;
    }
    await logAudit({
      actionType: "update",
      module: "customer_balance_reversal",
      recordId: customerId,
      recordLabel: entry?.entry_number,
      description: `Customer balance reversal ke sath ledger se dobara gina gaya: ${entry?.entry_number ?? entryId}`,
      changes: { current_balance: { pehle: before, ab: after } },
    });
  }

  for (const supplierId of parties.get("supplier") ?? []) {
    const { data: rows, error: sumErr } = await service
      .from("journal_lines")
      .select("debit, credit")
      .eq("account_code", ACC.supplierPayable)
      .eq("party_type", "supplier")
      .eq("party_id", supplierId);
    if (sumErr) {
      balanceErrors.push(`supplier ${supplierId}: ${sumErr.message}`);
      continue;
    }
    const after = payableFromLedger(rows ?? []);
    if (after == null) continue;
    const { data: supplier } = await service.from("suppliers").select("current_payable").eq("id", supplierId).maybeSingle();
    const before = supplier?.current_payable == null ? null : Number(supplier.current_payable);
    if (before != null && Math.abs(after - before) < 0.005) continue;
    const { error: updErr } = await service.from("suppliers").update({ current_payable: after }).eq("id", supplierId);
    if (updErr) balanceErrors.push(`supplier ${supplierId}: ${updErr.message}`);
  }

  for (const dealerId of parties.get("dealer") ?? []) {
    const { data: rows, error: sumErr } = await service
      .from("journal_lines")
      .select("debit, credit")
      .eq("account_code", "2016")
      .eq("party_type", "dealer")
      .eq("party_id", dealerId);
    if (sumErr) {
      balanceErrors.push(`dealer ${dealerId}: ${sumErr.message}`);
      continue;
    }
    const entryDealerLines = (partyLines ?? []).filter(
      (line) => line.party_type === "dealer" && line.party_id === dealerId && line.account_code === "2016"
    );
    const movement = entryDealerLines.reduce(
      (sum, line) => sum + Number(line.debit ?? 0) - Number(line.credit ?? 0),
      0
    );
    const { data: dealer } = await service.from("dealers").select("current_payable").eq("id", dealerId).maybeSingle();
    const before = dealer?.current_payable == null ? null : Number(dealer.current_payable);
    const after = dealerPayableWrite({
      stored: before,
      ledgerNet: payableFromLedger(rows ?? []),
      movement,
    });
    if (after == null) continue;
    if (before != null && Math.abs(after - before) < 0.005) continue;
    const { error: updErr } = await service.from("dealers").update({ current_payable: after }).eq("id", dealerId);
    if (updErr) balanceErrors.push(`dealer ${dealerId}: ${updErr.message}`);
  }

  const { error: markError } = await (service.from("journal_entries") as any)
    .update({ posting_status: "reversed" })
    .eq("id", entryId);
  if (markError) balanceErrors.push(`source reversed mark: ${markError.message}`);

  const { data: sources } = await service
    .from("journal_entry_sources")
    .select("source_table, source_row_id")
    .eq("entry_id", entryId);
  for (const source of sources ?? []) {
    if (source.source_table !== "finance_transactions" || !source.source_row_id) continue;
    const { error: srcErr } = await (service.from("finance_transactions") as any)
      .update({ reversed_at: new Date().toISOString() })
      .eq("id", source.source_row_id);
    if (srcErr) balanceErrors.push(`cash book reversed mark: ${srcErr.message}`);
  }

  await logAudit({
    actionType: "update",
    module: "ledger_reversal",
    recordId: entryId,
    recordLabel: entry?.entry_number,
    description: `Entry ${entry?.entry_number ?? entryId} ulti gayi (${result.entryNumber}): ${reason}`,
  });

  revalidatePath("/admin/audit-trail");
  revalidatePath("/admin/money-trail");

  // Stock/maal ki physical ginti aur cash refund ka operational kaam
  // apni jagah verify karna hota hai; reversal ledger aur linked customer
  // balance ko theek karta hai.
  if (balanceErrors.length > 0) {
    return {
      error: `Reversal ban gaya (${result.entryNumber}) magar kuch customer balance update nahi hue — Admin dekhe: ${balanceErrors.join("; ")}`,
    };
  }

  const partySummary = [...parties.entries()].map(([t, ids]) => `${t} ${ids.size}`).join(", ");
  return {
    success: true,
    message: `Reversal ban gaya (${result.entryNumber}) — Rs ${result.total.toLocaleString()}. Ledger aur har linked party ka khata ulta hua${partySummary ? ` (${partySummary})` : ""}; stock aur cash refund ko alag verify karein.`,
  };
}
