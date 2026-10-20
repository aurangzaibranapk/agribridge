import { createServiceClient } from "@/lib/supabase/service";
import { cashBookReversalFields } from "@/lib/finance/money-guards";

/** Cash Book ki qatar mitao nahi — ulti qatar daalo taake net sifar ho. */
export async function reverseCashBookById(id: string, reason: string): Promise<string | null> {
  const service = createServiceClient();
  const { data: row, error: readError } = await service
    .from("finance_transactions")
    .select("account_id, transaction_type, category, amount, transaction_date, notes, created_by")
    .eq("id", id)
    .maybeSingle();
  if (readError) return readError.message;
  if (!row) return "Cash book ki qatar nahi mili.";
  const fields = cashBookReversalFields(
    {
      account_id: row.account_id,
      transaction_type: row.transaction_type,
      category: row.category,
      amount: Number(row.amount),
      transaction_date: row.transaction_date,
      notes: row.notes,
      created_by: row.created_by,
    },
    reason
  );
  if ("error" in fields) return fields.error;
  const { error } = await service.from("finance_transactions").insert(fields);
  return error?.message ?? null;
}
