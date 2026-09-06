import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { postSupplierPayment, failed, type EventContext } from "@/lib/ledger/rules";

type Client = SupabaseClient<Database>;

/**
 * Supplier ko adaigi -- qatar bhi, ledger bhi, ek hi jagah se.
 *
 * -------------------------------------------------------------------
 * YE FILE KYUN BANI
 *
 * `supplier_payments` mein qatar PAANCH jagah se parti thi: purchase
 * banate waqt, sheet se import karte waqt, bill se rate charhate waqt,
 * adaigi ki darkhwast manzoor hote waqt, aur seedhi adaigi likhte waqt.
 *
 * Paanchon jagah ek hi kaam ho raha tha aur paanchon mein se KISI ne
 * ledger ko nahi bataya. Nateeja 6 September ko Live par nikla: khata
 * 2000 (Supplier ko dena) mein sirf machinery vendor the -- Rs 112,048
 * ki kharid aur us ki adaigi ledger ke bahar thi.
 *
 * Chhata call-site banne par wohi ghalati chhati dafa hoti. Is liye ab
 * qatar aur entry ek sath, ek hi function se banti hain -- inhen alag
 * karna ab mushkil hai, aur yehi maqsad hai.
 *
 * -------------------------------------------------------------------
 * ENTRY NA BAN SAKE TO?
 *
 * Adaigi WAPAS nahi hoti -- paisa ja chuka hai, aur us ki qatar
 * `supplier_payments` mein rehni chahiye warna `current_payable` ghalat
 * ho jayega. Magar nakami chhupti bhi nahi: wajah wapas jati hai, aur
 * wo qatar `v_ledger_unposted` par surkh nazar aati hai (333) -- jahan
 * se us ka peechha kiya ja sakta hai.
 */
export async function payAndPost(
  client: Client,
  args: {
    supplierId: string;
    amount: number;
    paymentDate: string;
    paymentMethod?: string | null;
    /** finance_accounts ki id -- kis khate se paisa nikla. */
    accountId?: string | null;
    notes?: string | null;
    slipUrl?: string | null;
    purchaseId?: string | null;
    branchId?: string | null;
    createdBy: string | null;
  }
): Promise<{ paymentId: string } | { error: string }> {
  const { data: row, error } = await client
    .from("supplier_payments")
    .insert({
      supplier_id: args.supplierId,
      purchase_id: args.purchaseId ?? null,
      amount: args.amount,
      payment_date: args.paymentDate,
      payment_method: args.paymentMethod ?? null,
      notes: args.notes ?? null,
      slip_url: args.slipUrl ?? null,
      created_by: args.createdBy,
    })
    .select("id")
    .single();

  if (error || !row) return { error: error?.message ?? "Adaigi ki qatar nahi bani." };

  const ctx: EventContext = {
    createdBy: args.createdBy,
    branchId: args.branchId ?? null,
    entryDate: args.paymentDate,
    claims: [{ table: "supplier_payments", rowId: row.id }],
  };

  const posted = await postSupplierPayment({
    paymentId: row.id,
    supplierId: args.supplierId,
    amount: args.amount,
    accountId: args.accountId ?? null,
    description: args.notes?.trim() || "Supplier ko adaigi",
    ctx,
  });

  if (failed(posted)) {
    // Paisa ja chuka hai. Qatar rehne di jati hai (warna dena ghalat ho
    // jayega), magar bulane wale ko wajah milti hai.
    return { error: `Adaigi likh di gayi, magar ledger tak nahi pahunchi: ${posted.error}` };
  }

  return { paymentId: row.id };
}
