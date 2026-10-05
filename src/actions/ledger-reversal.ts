"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { reverseJournal } from "@/lib/ledger/post";
import { logAudit } from "@/lib/audit";
import { REVERSAL_REASON_MIN } from "@/lib/ledger/audit-trail";
import { loadUserAccess, can } from "@/lib/access/permissions";
import { ACC } from "@/lib/ledger/rules";
import { postJournal } from "@/lib/ledger/post";

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
  if (!access || !can(access, "finance.reversal", "create")) return { error: "Is correction ki permission sirf Admin/Finance ke paas hai." };

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
  if (!access || !can(access, "finance.reversal", "create")) {
    return {
      error:
        "Entry ulti karne ki ijazat (finance.reversal) aap ke paas nahi. Ye Owner/Admin ke paas hai; zaroorat ho to Work Coach se darkhwast karein -- adaigi banane/manzoor karne wale ko ye nahi milni chahiye (SoD).",
    };
  }

  const { data: entry } = await service
    .from("journal_entries")
    .select("entry_number, description, source_module")
    .eq("id", entryId)
    .maybeSingle();

  // Journal reverse ke sath CRM ka customer balance bhi ulta hona chahiye.
  // Warna ledger theek hota hai magar POS/CRM mein Rs40 jaisi credit chhup
  // jati hai. Original customer line ka net record pehle le rahe hain.
  const { data: customerLines } = await service
    .from("journal_lines")
    .select("party_id, debit, credit")
    .eq("entry_id", entryId)
    .eq("party_type", "customer")
    .not("party_id", "is", null);

  const result = await reverseJournal(entryId, reason, user.id);
  if ("error" in result) return { error: result.error };

  const customerNet = new Map<string, number>();
  for (const line of customerLines ?? []) {
    const customerId = String(line.party_id ?? "");
    if (!customerId) continue;
    customerNet.set(customerId, (customerNet.get(customerId) ?? 0) + Number(line.debit ?? 0) - Number(line.credit ?? 0));
  }
  for (const [customerId, originalNet] of customerNet) {
    if (!originalNet) continue;
    const { data: customer } = await service.from("customers").select("current_balance").eq("id", customerId).maybeSingle();
    if (!customer) continue;
    const before = Number(customer.current_balance ?? 0);
    const after = Math.round((before - originalNet) * 100) / 100;
    await service.from("customers").update({ current_balance: after }).eq("id", customerId);
    await logAudit({
      actionType: "update",
      module: "customer_balance_reversal",
      recordId: customerId,
      recordLabel: entry?.entry_number,
      description: `Customer balance reversal ke sath update hua: ${entry?.entry_number ?? entryId}`,
      changes: { current_balance: { pehle: before, ab: after } },
    });
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
  return {
    success: true,
    message: `Reversal ban gaya (${result.entryNumber}) — Rs ${result.total.toLocaleString()}. Ledger aur linked customer balance update hua; stock aur cash refund ko alag verify karein.`,
  };
}
