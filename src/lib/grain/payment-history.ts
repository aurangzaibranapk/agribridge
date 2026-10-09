import type { GrainPaymentHistoryRow } from "@/components/grain/grain-payment-history";

/**
 * Grain payments ki history ke liye account ka naam aur ledger TXN number.
 *
 * Nayi payments (migration 516 ke baad) apne journal_entry_id aur
 * finance_transaction_id khud rakhti hain. Purani rows ke liye
 * journal_entry_sources se dhoonda jata hai; na mile to "TXN nahi mila"
 * dikhta hai -- chhupaya nahi jata. Sirf parhta hai, kuch likhta nahi.
 */
export async function loadGrainPaymentHistory(
  supabase: any,
  table: "grain_sale_payments" | "grain_procurement_payments",
  payments: any[],
  slipHref?: (id: string) => string
): Promise<GrainPaymentHistoryRow[]> {
  if (payments.length === 0) return [];
  const paymentIds = payments.map((p) => p.id);
  const ftIds = payments.map((p) => p.finance_transaction_id).filter(Boolean);
  const entryIds = new Set<string>(payments.map((p) => p.journal_entry_id).filter(Boolean));

  const [{ data: sources }, { data: fts }] = await Promise.all([
    supabase
      .from("journal_entry_sources")
      .select("entry_id, source_table, source_row_id")
      .in("source_table", [table, "finance_transactions"])
      .in("source_row_id", [...paymentIds, ...ftIds]),
    ftIds.length > 0
      ? supabase.from("finance_transactions").select("id, account_id").in("id", ftIds)
      : Promise.resolve({ data: [] }),
  ]);
  const entryByRow = new Map<string, string>();
  for (const s of sources ?? []) {
    entryByRow.set(s.source_row_id, s.entry_id);
    entryIds.add(s.entry_id);
  }
  const accountByFt = new Map<string, string>((fts ?? []).map((f: any) => [f.id, f.account_id]));
  const accountIds = new Set<string>();
  for (const p of payments) {
    const acc = p.account_id ?? (p.finance_transaction_id ? accountByFt.get(p.finance_transaction_id) : null);
    if (acc) accountIds.add(acc);
  }

  const [{ data: entries }, { data: accounts }] = await Promise.all([
    entryIds.size > 0
      ? supabase.from("journal_entries").select("id, entry_number").in("id", [...entryIds])
      : Promise.resolve({ data: [] }),
    accountIds.size > 0
      ? supabase.from("finance_accounts").select("id, name").in("id", [...accountIds])
      : Promise.resolve({ data: [] }),
  ]);
  const numberById = new Map<string, string>((entries ?? []).map((e: any) => [e.id, e.entry_number]));
  const accountName = new Map<string, string>((accounts ?? []).map((a: any) => [a.id, a.name]));

  return payments.map((p) => {
    const entryId =
      p.journal_entry_id ?? entryByRow.get(p.id) ?? (p.finance_transaction_id ? entryByRow.get(p.finance_transaction_id) : undefined);
    const acc = p.account_id ?? (p.finance_transaction_id ? accountByFt.get(p.finance_transaction_id) : null);
    return {
      id: p.id,
      date: p.payment_date ?? String(p.created_at ?? "").slice(0, 10),
      amount: Number(p.amount ?? 0),
      account_name: acc ? accountName.get(acc) ?? null : null,
      payment_method: p.payment_method ?? null,
      receipt_photo_url: p.receipt_photo_url ?? null,
      entry_number: entryId ? numberById.get(entryId) ?? null : null,
      notes: p.notes ?? null,
      slip_href: slipHref ? slipHref(p.id) : null,
    };
  });
}
