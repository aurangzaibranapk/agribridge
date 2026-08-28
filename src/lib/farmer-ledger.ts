import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/types/database.types";

/**
 * Kisan ke khate mein entry daalne ki ek hi jagah.
 *
 * `balance_after` database mein LAZMI hai, magar us ka koi default nahi
 * -- yani jo code use nahi bhejta, us ki entry chup chaap nakaam ho jati
 * hai. Poore system mein yahi hota raha: milk, credit aur procurement,
 * teenon jagah balance_after chhut gaya tha, is liye khate ki table aaj
 * tak khali hai.
 *
 * Ise har jagah alag alag ginne se bachne ke liye yahan ek hi jagah rakh
 * diya gaya hai. Usool wahi hai jo /admin/farmer-credit dikhata hai:
 * debit se bojh barhta hai, credit se ghatta hai.
 */

type SourceType = Database["public"]["Enums"]["credit_source_type"];
type WalletType = Database["public"]["Enums"]["wallet_transaction_type"];

export interface LedgerPost {
  farmerId: string;
  sourceType: SourceType;
  ledgerType: "debit" | "credit";
  amount: number;
  notes: string;
  referenceId?: string | null;
  createdBy: string | null;
}

/** Kisan ka maujooda bojh (debit barhata hai, credit ghatata hai). */
export async function farmerBalanceDue(farmerId: string): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("farmer_credit_ledger")
    .select("ledger_type, amount")
    .eq("farmer_id", farmerId);
  return (data ?? []).reduce(
    (sum, r) => (r.ledger_type === "debit" ? sum + Number(r.amount) : sum - Number(r.amount)),
    0
  );
}

export async function postFarmerLedger(input: LedgerPost): Promise<{ error?: string }> {
  const service = createServiceClient();
  const before = await farmerBalanceDue(input.farmerId);
  const after = input.ledgerType === "debit" ? before + input.amount : before - input.amount;

  const { error } = await service.from("farmer_credit_ledger").insert({
    farmer_id: input.farmerId,
    source_type: input.sourceType,
    ledger_type: input.ledgerType,
    amount: input.amount,
    balance_after: Math.round(after * 100) / 100,
    reference_id: input.referenceId ?? null,
    notes: input.notes,
    created_by: input.createdBy,
  });

  return error ? { error: error.message } : {};
}

export interface WalletPost {
  farmerId: string;
  type: WalletType;
  direction: "debit" | "credit";
  amount: number;
  notes: string;
  referenceType: string;
  referenceId?: string | null;
  createdBy: string | null;
}

/**
 * Wallet ki entry. Wallet na ho to chup chaap chhor dete hain -- har
 * kisan ka wallet nahi hota, aur is wajah se doodh ki entry rok dena
 * ghalat hoga.
 */
export async function postFarmerWallet(input: WalletPost): Promise<void> {
  const service = createServiceClient();
  const { data: wallet } = await service
    .from("wallets")
    .select("id, balance")
    .eq("owner_type", "farmer")
    .eq("owner_id", input.farmerId)
    .maybeSingle();
  if (!wallet) return;

  const delta = input.direction === "credit" ? input.amount : -input.amount;
  const after = Math.round((Number(wallet.balance) + delta) * 100) / 100;

  await service.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    type: input.type,
    direction: input.direction,
    amount: input.amount,
    balance_after: after,
    reference_type: input.referenceType,
    reference_id: input.referenceId ?? null,
    notes: input.notes,
    created_by: input.createdBy,
  });

  await service.from("wallets").update({ balance: after }).eq("id", wallet.id);
}
