"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { postJournal } from "@/lib/ledger/post";
import { glForFinanceAccount } from "@/lib/ledger/rules";

/**
 * Cheque -- diye hue aur mile hue.
 *
 * Poore hisse ka ek hi usool hai: CHEQUE CASH NAHI HAI. Wo cash us din
 * banta hai jis din bank se guzarta hai. Is liye har cheque ki DO
 * entries hoti hain:
 *
 *   1. Darj hote waqt -- bande ka khata saaf, magar raqam bank mein
 *      nahi. Wo "cheque mile hue" (1180) ya "cheque diye hue" (2050)
 *      mein khaRi rehti hai.
 *   2. Guzarne par -- tab wo raqam bank mein jati hai.
 *
 * Bounce hone par pehli entry ulti ho jati hai: bande ka khata dobara
 * khul jata hai. Cheque ki qatar phir bhi rehti hai -- bounce us bande
 * ke bare mein sab se ahem maloomat hai, aur usay mita dena wo maloomat
 * zaya kar dena hai.
 */

const ROLES = ["owner", "super_admin", "admin", "finance"];
const PENDING_RECEIVED = "1180";
const PENDING_ISSUED = "2050";

export interface ChequeState {
  error?: string;
  success?: boolean;
  message?: string;
}

async function gate(): Promise<{ ok: true; userId: string; branchId: string | null } | { ok: false; error: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Login karein." };
  const { data: me } = await supabase
    .from("profiles")
    .select("role, is_active, branch_id")
    .eq("id", user.id)
    .maybeSingle();
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return { ok: false, error: "Cheque darj karne ki ijazat sirf Owner, Admin ya Finance ke paas hai." };
  }
  return { ok: true, userId: user.id, branchId: me.branch_id ?? null };
}

export async function saveCheque(_prev: ChequeState, formData: FormData): Promise<ChequeState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const direction = String(formData.get("direction") ?? "");
  const chequeNumber = String(formData.get("cheque_number") ?? "").trim();
  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim();
  const counterAccount = String(formData.get("counter_account") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const issueDate = String(formData.get("issue_date") ?? "").trim();
  const dueDate = String(formData.get("due_date") ?? "").trim();
  const partyName = String(formData.get("party_name") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  const bookId = String(formData.get("book_id") ?? "").trim();

  if (direction !== "issued" && direction !== "received") return { error: "Cheque diya hai ya mila — ye chunein." };
  if (!chequeNumber) return { error: "Cheque ka number likhein." };
  if (!financeAccountId) return { error: "Bank ka khata chunein." };
  if (!counterAccount) return { error: "Kis khate ke badle — wo chunein." };
  if (!(amount > 0)) return { error: "Raqam likhein." };
  if (!issueDate || !dueDate) return { error: "Dono tareekhein chunein." };
  if (dueDate < issueDate) return { error: "Cheque ki tareekh likhe jane ki tareekh se pehle nahi ho sakti." };
  if (!partyName) return { error: "Kis ka cheque hai — naam likhein." };

  const service = createServiceClient();
  const { data: cheque, error: insErr } = await service
    .from("cheques")
    .insert({
      direction,
      cheque_number: chequeNumber,
      book_id: bookId || null,
      finance_account_id: financeAccountId,
      counter_account: counterAccount,
      party_name: partyName,
      amount,
      issue_date: issueDate,
      due_date: dueDate,
      note: note || null,
      created_by: g.userId,
    })
    .select("id")
    .single();

  if (insErr || !cheque) {
    if (insErr?.code === "23505") {
      return { error: `Is bank par cheque number ${chequeNumber} pehle se darj hai. Ek hi number do dafa nahi jata.` };
    }
    return { error: `Cheque darj nahi hua: ${insErr?.message ?? "maloom nahi"}` };
  }

  const memo = `Cheque ${chequeNumber} — ${partyName}`;
  const posted = await postJournal({
    description: direction === "received" ? `Cheque mila: ${memo}` : `Cheque diya: ${memo}`,
    sourceModule: "cheque",
    sourceId: cheque.id,
    entryDate: issueDate,
    branchId: g.branchId,
    createdBy: g.userId,
    claims: [{ table: "cheques", rowId: cheque.id }],
    lines:
      direction === "received"
        ? [
            // Raqam BANK mein nahi -- intezar wale khate mein.
            { account: PENDING_RECEIVED, debit: amount, memo },
            { account: counterAccount, credit: amount, memo },
          ]
        : [
            { account: counterAccount, debit: amount, memo },
            { account: PENDING_ISSUED, credit: amount, memo },
          ],
  });

  if ("error" in posted) {
    await service.from("cheques").delete().eq("id", cheque.id);
    return { error: `Ledger ki entry nahi bani, is liye cheque bhi darj nahi hua: ${posted.error}` };
  }

  await service.from("cheques").update({ entry_id: posted.id }).eq("id", cheque.id);

  await logAudit({
    actionType: "create",
    module: "finance",
    recordId: cheque.id,
    recordLabel: chequeNumber,
    description: `${direction === "received" ? "Cheque mila" : "Cheque diya"}: ${chequeNumber}, ${partyName}, Rs ${Math.round(amount).toLocaleString()} (${dueDate}) — ${posted.entryNumber}`,
  });

  revalidatePath("/admin/finance/cheques");
  return { success: true, message: `Cheque darj ho gaya (${posted.entryNumber}). Raqam bank mein tab jayegi jab cheque guzre.` };
}

/** Bank se guzar gaya -- ab ye raqam waqai bank mein hai. */
export async function clearCheque(_prev: ChequeState, formData: FormData): Promise<ChequeState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("cheque_id") ?? "").trim();
  const clearedOn = String(formData.get("cleared_on") ?? "").trim() || new Date().toISOString().slice(0, 10);
  if (!id) return { error: "Cheque nahi mila." };

  const service = createServiceClient();
  const { data: c } = await service.from("cheques").select("*").eq("id", id).maybeSingle();
  if (!c) return { error: "Cheque nahi mila." };
  if (c.status !== "pending") return { error: "Is cheque ka faisla pehle ho chuka hai." };
  if (clearedOn < String(c.issue_date)) return { error: "Guzarne ki tareekh cheque ki tareekh se pehle nahi ho sakti." };

  const bankGl = await glForFinanceAccount(c.finance_account_id as string);
  const amount = Number(c.amount);
  const memo = `Cheque ${c.cheque_number} — ${c.party_name ?? ""}`;

  const posted = await postJournal({
    description: `Cheque bank se guzar gaya: ${memo}`,
    sourceModule: "cheque.clear",
    sourceId: id,
    entryDate: clearedOn,
    createdBy: g.userId,
    lines:
      c.direction === "received"
        ? [
            { account: bankGl, debit: amount, memo },
            { account: PENDING_RECEIVED, credit: amount, memo },
          ]
        : [
            { account: PENDING_ISSUED, debit: amount, memo },
            { account: bankGl, credit: amount, memo },
          ],
  });
  if ("error" in posted) return { error: `Ledger ki entry nahi bani: ${posted.error}` };

  const { error } = await service
    .from("cheques")
    .update({ status: "cleared", cleared_on: clearedOn, settle_entry_id: posted.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { error: `Entry ${posted.entryNumber} ban gayi magar cheque ka darja nahi badla: ${error.message}. Finance ko batayein.` };
  }

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: id,
    recordLabel: String(c.cheque_number),
    description: `Cheque guzar gaya: ${c.cheque_number} Rs ${Math.round(amount).toLocaleString()} — ${posted.entryNumber}`,
  });

  revalidatePath("/admin/finance/cheques");
  return { success: true, message: `Cheque guzar gaya (${posted.entryNumber}).` };
}

/** Wapas aa gaya -- pehli entry ulti hoti hai, bande ka khata dobara khulta hai. */
export async function bounceCheque(_prev: ChequeState, formData: FormData): Promise<ChequeState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const id = String(formData.get("cheque_id") ?? "").trim();
  const reason = String(formData.get("bounce_reason") ?? "").trim();
  if (!id) return { error: "Cheque nahi mila." };
  if (reason.length < 5) return { error: "Wapas aane ki wajah likhein (kam az kam paanch harf)." };

  const service = createServiceClient();
  const { data: c } = await service.from("cheques").select("*").eq("id", id).maybeSingle();
  if (!c) return { error: "Cheque nahi mila." };
  if (c.status !== "pending") return { error: "Is cheque ka faisla pehle ho chuka hai." };

  const amount = Number(c.amount);
  const memo = `Cheque ${c.cheque_number} wapas — ${reason}`;
  const aaj = new Date().toISOString().slice(0, 10);

  const posted = await postJournal({
    description: `Cheque wapas aa gaya (bounce): ${c.cheque_number}`,
    sourceModule: "cheque.bounce",
    sourceId: id,
    entryDate: aaj,
    createdBy: g.userId,
    lines:
      c.direction === "received"
        ? [
            // Bande ka khata dobara khul gaya.
            { account: c.counter_account as string, debit: amount, memo },
            { account: PENDING_RECEIVED, credit: amount, memo },
          ]
        : [
            { account: PENDING_ISSUED, debit: amount, memo },
            { account: c.counter_account as string, credit: amount, memo },
          ],
  });
  if ("error" in posted) return { error: `Ledger ki entry nahi bani: ${posted.error}` };

  const { error } = await service
    .from("cheques")
    .update({ status: "bounced", bounce_reason: reason, settle_entry_id: posted.id, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) {
    return { error: `Entry ${posted.entryNumber} ban gayi magar cheque ka darja nahi badla: ${error.message}. Finance ko batayein.` };
  }

  await logAudit({
    actionType: "update",
    module: "finance",
    recordId: id,
    recordLabel: String(c.cheque_number),
    description: `Cheque WAPAS aa gaya: ${c.cheque_number} Rs ${Math.round(amount).toLocaleString()} — wajah: ${reason} (${posted.entryNumber})`,
  });

  revalidatePath("/admin/finance/cheques");
  return { success: true, message: `Cheque wapas darj ho gaya. ${c.direction === "received" ? "Us bande ka khata dobara khul gaya." : "Adaigi dobara baqi ho gayi."}` };
}

export async function saveChequeBook(_prev: ChequeState, formData: FormData): Promise<ChequeState> {
  const g = await gate();
  if (!g.ok) return { error: g.error };

  const financeAccountId = String(formData.get("finance_account_id") ?? "").trim();
  const bookName = String(formData.get("book_name") ?? "").trim();
  const prefix = String(formData.get("prefix") ?? "").trim();
  const first = Math.round(Number(formData.get("first_number") ?? 0));
  const last = Math.round(Number(formData.get("last_number") ?? 0));

  if (!financeAccountId) return { error: "Bank ka khata chunein." };
  if (bookName.length < 2) return { error: "Book ka naam likhein." };
  if (!(first > 0) || !(last >= first)) return { error: "Number ki hadd theek likhein (pehla aur aakhri)." };

  const service = createServiceClient();
  const { error } = await service.from("cheque_books").insert({
    finance_account_id: financeAccountId,
    book_name: bookName,
    prefix: prefix || null,
    first_number: first,
    last_number: last,
    created_by: g.userId,
  });
  if (error) return { error: error.message };

  await logAudit({
    actionType: "create",
    module: "finance",
    recordLabel: bookName,
    description: `Nayi cheque book: ${bookName} (${first}–${last})`,
  });

  revalidatePath("/admin/finance/cheques");
  return { success: true, message: "Cheque book darj ho gayi." };
}
