import { createServiceClient } from "@/lib/supabase/service";
import type { JournalInput, PostedEntry } from "./post";
import type { CashBookQatar } from "./cash-book";

/** The action must authorize the caller before using this service-only writer. */
export async function postDeskTransaction(
  input: JournalInput,
  cashBook: CashBookQatar[],
  source?: { table: "load_transactions" | "bank_transfer_transactions" | "supplier_payments"; row: Record<string, unknown> }
): Promise<(PostedEntry & { balances: Record<string, number>; sourceId?: string }) | { error: string }> {
  const { data, error } = await (createServiceClient() as any).rpc("post_desk_transaction_atomic", {
    p_input: input, p_cashbook: cashBook, p_table: source?.table ?? null, p_row: source?.row ?? null,
  });
  if (error || !data?.id) return { error: error?.message ?? "Desk transaction save nahi hui." };
  return data;
}
