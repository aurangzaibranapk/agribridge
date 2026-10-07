import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database.types";
import { ACC, glForFinanceAccount } from "@/lib/ledger/rules";
import { postDeskTransaction } from "@/lib/ledger/desk";

type Client = SupabaseClient<Database>;

/** Supplier source, journal and cash book save together, or none save. */
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
    /** Purani tareekh ki adaigi ho to wajah — warna ledger post nahi hoti. */
    backdateReason?: string | null;
    clientActionId?: string | null;
  }
): Promise<{ paymentId: string } | { error: string }> {
  const { data: { user } } = await client.auth.getUser();
  if (!user || user.id !== args.createdBy) return { error: "Supplier payment caller verify nahi hua." };
  // Preserve the same RLS write permission as the old authenticated insert.
  const { data: allowed, error: permissionError } = await client.rpc("fn_has_dept", { p_roles: ["owner", "super_admin", "admin", "manager"] });
  if (permissionError || !allowed) return { error: "Supplier payment ki ijazat nahi." };
  if (!args.accountId) return { error: "Supplier payment ka finance account chunein." };
  if (!Number.isFinite(args.amount) || args.amount <= 0) return { error: "Payment amount positive honi chahiye." };
  const gl = await glForFinanceAccount(args.accountId);
  if (gl === ACC.suspense) return { error: "Finance account ka ledger mapping missing hai." };
  const description = args.notes?.trim() || "Supplier ko adaigi";
  const posted = await postDeskTransaction({
    description, sourceModule: "supplier_payment", branchId: args.branchId,
    createdBy: user.id, entryDate: args.paymentDate, backdateReason: args.backdateReason,
    clientActionId: args.clientActionId,
    lines: [{ account: ACC.supplierPayable, debit: args.amount, partyType: "supplier", partyId: args.supplierId }, { account: gl, credit: args.amount }],
  }, [{ accountId: args.accountId, amount: args.amount, rukh: "gaya", category: "supplier_payment", notes: description, tareekh: args.paymentDate }], {
    table: "supplier_payments", row: {
      supplier_id: args.supplierId, purchase_id: args.purchaseId ?? null,
      amount: args.amount, payment_date: args.paymentDate, payment_method: args.paymentMethod ?? null,
      notes: args.notes ?? null, slip_url: args.slipUrl ?? null,
    },
  });
  if ("error" in posted) return { error: `Supplier payment save nahi hui: ${posted.error}` };
  if (!posted.sourceId) return { error: "Supplier payment ka record ID nahi mila." };
  return { paymentId: posted.sourceId };
}
