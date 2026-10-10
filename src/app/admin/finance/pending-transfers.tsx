import { createClient } from "@/lib/supabase/server";
import { ReceiveTransferForm } from "@/app/admin/finance/receive-transfer-form";

/**
 * Raste mein paisa (Cash in Transit, 1020) -- jo transfer nikla magar
 * doosri taraf abhi wusool darj nahi hua (finance review #8).
 * Migration 522 na lagi ho to ye hissa chup rehta hai.
 */
export async function PendingTransfers() {
  const supabase = createClient() as unknown as { from: (t: string) => any };
  const { data: outs, error } = await supabase
    .from("finance_transactions")
    .select("id, related_transfer_id, amount, transaction_date, notes, account_id, transfer_to_account_id")
    .eq("transaction_type", "transfer_out")
    .not("transfer_to_account_id", "is", null)
    .order("transaction_date", { ascending: false })
    .limit(50);
  if (error || !outs?.length) return null;

  const ids = outs.map((o: { related_transfer_id: string }) => o.related_transfer_id);
  const { data: ins } = await supabase
    .from("finance_transactions")
    .select("related_transfer_id")
    .eq("transaction_type", "transfer_in")
    .in("related_transfer_id", ids);
  const done = new Set((ins ?? []).map((r: { related_transfer_id: string }) => r.related_transfer_id));
  const pending = outs.filter((o: { related_transfer_id: string }) => !done.has(o.related_transfer_id));
  if (pending.length === 0) return null;

  const { data: accs } = await supabase.from("finance_accounts").select("id, name");
  const name = new Map((accs ?? []).map((a: { id: string; name: string }) => [a.id, a.name]));

  return (
    <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <h3 className="mb-2 text-sm font-semibold text-amber-900 dark:text-amber-200">
        Raste mein paisa (Cash in Transit) — {pending.length} transfer wusooli ke muntazir
      </h3>
      <ul className="space-y-2">
        {pending.map((o: any) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span>
              {o.transaction_date}: {String(name.get(o.account_id) ?? "?")} → {String(name.get(o.transfer_to_account_id) ?? "?")} — Rs{" "}
              {Number(o.amount).toLocaleString()}
              {o.notes ? ` (${o.notes})` : ""}
            </span>
            <ReceiveTransferForm transferId={o.related_transfer_id} />
          </li>
        ))}
      </ul>
    </div>
  );
}
