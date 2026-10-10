/**
 * Grain khareed ki payable (524).
 *
 * Kisan/party se anaj liya to hum par us ka dena banta hai:
 *   Dr 5020 (Grain khareed) / Cr 2040 (payable, kisan ya grain party ke naam).
 * Adaigi par ulta: Dr 2040 / Cr bank (fn_record_grain_procurement_payment_atomic).
 */
export interface GrainPayableLine {
  account: string;
  debit?: number;
  credit?: number;
  partyType?: string | null;
  partyId?: string | null;
  memo?: string | null;
}

export const GRAIN_PURCHASE_ACCOUNT = "5020";
export const GRAIN_PAYABLE_ACCOUNT = "2040";

export function grainPayableParty(args: { farmerId?: string | null; partyId?: string | null }): { partyType: string; partyId: string } | null {
  if (args.farmerId) return { partyType: "farmer", partyId: args.farmerId };
  if (args.partyId) return { partyType: "grain_party", partyId: args.partyId };
  return null;
}

export function grainPayableJournalLines(args: {
  farmerId?: string | null;
  partyId?: string | null;
  amount: number;
  memo: string;
}): GrainPayableLine[] {
  const amount = Math.round((Number(args.amount) + Number.EPSILON) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) return [];
  const party = grainPayableParty(args);
  if (!party) throw new Error("Grain payable ke liye kisan ya party zaroori hai.");
  return [
    { account: GRAIN_PURCHASE_ACCOUNT, debit: amount, memo: args.memo },
    { account: GRAIN_PAYABLE_ACCOUNT, credit: amount, memo: args.memo, partyType: party.partyType, partyId: party.partyId },
  ];
}
