import { createServiceClient } from "@/lib/supabase/service";

/**
 * Cash haath badalne ka hisaab.
 *
 * Branch manager driver ko Rs 50,000 deta hai ke HQ pahuncha do. HQ par
 * Rs 48,000 pahunchte hain. Rs 2,000 kahan gaye?
 *
 * Is sawal ka jawab tabhi mumkin hai jab DONO taraf alag alag likhein.
 * Ek taraf ka record kaafi nahi: branch ki raat ki ginti mein cash kam
 * niklega aur wajah "HQ bhej diya" likh di jayegi; HQ ki ginti mein
 * jitna aaya utna hi darj hoga. Dono jagah hisaab mil jayega aur farq
 * kahin nazar nahi aayega.
 *
 * Beech ke arse mein raqam 1030 "Cash raaste mein" khate mein rehti hai
 * -- kisi ke naam ke sath. Yahi wo khata hai jo raat ko dekhna chahiye.
 */

/** Itne din se raaste mein hai to ab ye intezar nahi, masla hai. */
export const TRANSIT_ALERT_DAYS = 2;
export const REASON_MIN = 5;

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

export interface TransitRow {
  id: string;
  amount: number;
  sentAt: string;
  daysOld: number;
  fromBranch: string | null;
  toBranch: string | null;
  sentBy: string | null;
  toPerson: string | null;
  carrier: string | null;
  note: string | null;
}

/**
 * Wo raqam jo abhi kisi ke haath mein hai.
 *
 * "Raaste mein" ka matlab ye nahi ke sab theek hai -- matlab ye hai ke
 * us raqam ka abhi ek zimmedar hai, aur jitna waqt guzarta hai utna kam
 * mumkin hota jata hai ke wo kabhi wapas mile. Is liye din ginte hain.
 */
export async function cashInTransit(): Promise<TransitRow[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("v_cash_in_transit")
    .select("*")
    .order("sent_at", { ascending: true });

  return (data ?? []).map((r) => ({
    id: r.id ?? "",
    amount: Number(r.amount_sent ?? 0),
    sentAt: r.sent_at ?? "",
    daysOld: Number(r.din_guzray ?? 0),
    fromBranch: r.from_branch,
    toBranch: r.to_branch,
    sentBy: r.bheja,
    toPerson: r.lene_wala,
    carrier: r.le_jane_wala,
    note: r.sent_note,
  }));
}

export interface HandoverRow extends TransitRow {
  status: string;
  received: number | null;
  difference: number | null;
  reason: string | null;
  receivedAt: string | null;
}

export async function recentHandovers(limit = 40): Promise<HandoverRow[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("cash_handovers")
    .select(
      `id, amount_sent, amount_received, difference, difference_reason, status,
       sent_at, received_at, sent_note,
       from_branch:branches!cash_handovers_from_branch_id_fkey(name),
       to_branch:branches!cash_handovers_to_branch_id_fkey(name),
       sender:profiles!cash_handovers_from_profile_id_fkey(full_name),
       receiver:profiles!cash_handovers_to_profile_id_fkey(full_name),
       carrier:profiles!cash_handovers_carrier_profile_id_fkey(full_name)`
    )
    .order("sent_at", { ascending: false })
    .limit(limit);

  const named = (v: unknown) => (v as { full_name: string | null } | null)?.full_name ?? null;
  const branchName = (v: unknown) => (v as { name: string } | null)?.name ?? null;

  return (data ?? []).map((r) => ({
    id: r.id,
    amount: Number(r.amount_sent),
    sentAt: r.sent_at,
    daysOld: Math.floor((Date.now() - new Date(r.sent_at).getTime()) / 86_400_000),
    fromBranch: branchName(r.from_branch),
    toBranch: branchName(r.to_branch),
    sentBy: named(r.sender),
    toPerson: named(r.receiver),
    carrier: named(r.carrier),
    note: r.sent_note,
    status: r.status,
    received: r.amount_received === null ? null : Number(r.amount_received),
    difference: r.difference === null ? null : Number(r.difference),
    reason: r.difference_reason,
    receivedAt: r.received_at,
  }));
}

/** Wo handovers jo IS shakhs ke naam bheje gaye aur abhi wusool nahi huay. */
export async function awaitingMe(profileId: string): Promise<HandoverRow[]> {
  const all = await recentHandovers(100);
  const service = createServiceClient();
  const { data } = await service
    .from("cash_handovers")
    .select("id")
    .eq("to_profile_id", profileId)
    .eq("status", "sent");

  const mine = new Set((data ?? []).map((r) => r.id));
  return all.filter((h) => mine.has(h.id));
}

// =====================================================================
// Bank
// =====================================================================

export interface BankLine {
  id: string;
  accountId: string;
  accountName: string;
  txnDate: string;
  description: string;
  amount: number;
  status: string;
}

export async function unmatchedBankLines(limit = 100): Promise<BankLine[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("bank_statement_lines")
    .select("id, account_id, txn_date, description, amount, status, finance_accounts(name)")
    .eq("status", "unmatched")
    .order("txn_date", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    accountId: r.account_id,
    accountName: (r.finance_accounts as { name: string } | null)?.name ?? "—",
    txnDate: r.txn_date,
    description: r.description,
    amount: Number(r.amount),
    status: r.status,
  }));
}

export interface BankAccountTotal {
  accountId: string;
  accountName: string;
  perBank: number;
  unmatchedCount: number;
}

export interface BankCompare {
  accounts: BankAccountTotal[];
  /** Sab banks mila kar, bank ki qataron ke mutabiq. */
  perBank: number;
  /** Sab banks mila kar, hamare khate ke mutabiq (journal se). */
  perBooks: number;
  difference: number;
  matched: boolean;
  unmatchedCount: number;
}

/**
 * Bank kya kehta hai, hum kya kehte hain.
 *
 * Bank kabhi ghalat nahi hota -- wo paisa asal mein rakhta hai. Farq
 * hamesha hamari taraf hota hai: koi entry reh gayi, ya do dafa lag
 * gayi, ya charges kate jo kisi ne likhe hi nahi. "Bank ki ghalti hogi"
 * keh kar chhor dena sab se aam aur sab se mehnga bahana hai.
 *
 * Milaan SAB BANKS KA MILA KAR hota hai, har bank ka alag nahi. Wajah
 * ye hai ke ledger mein teenon banks ek hi khate (1010) mein jate hain
 * -- yani "UBL ke mutabiq hamare khate mein itna hai" jaisa adad
 * maujood hi nahi. Wo adad bana kar dikhana aasan tha, magar wo ek aisa
 * milaan dikhata jo asal mein hua hi nahi -- aur ghalat tasalli us se
 * behtar hoti hai jo koi tasalli na ho.
 *
 * Har bank ka apna adad chahiye to us ka apna GL khata banana parega
 * (finance_accounts.gl_code).
 */
export async function bankComparison(): Promise<BankCompare> {
  const service = createServiceClient();

  const [{ data: accounts }, { data: lines }, { data: journal }] = await Promise.all([
    service.from("finance_accounts").select("id, name").eq("account_type", "bank"),
    service.from("bank_statement_lines").select("account_id, amount, status"),
    service.from("journal_lines").select("debit, credit").eq("account_code", "1010"),
  ]);

  const perAccount: BankAccountTotal[] = (accounts ?? []).map((a) => {
    const mine = (lines ?? []).filter((l) => l.account_id === a.id);
    return {
      accountId: a.id,
      accountName: a.name,
      perBank: round2(mine.reduce((s, l) => s + Number(l.amount), 0)),
      unmatchedCount: mine.filter((l) => l.status === "unmatched").length,
    };
  });

  const perBank = round2((lines ?? []).reduce((s, l) => s + Number(l.amount), 0));
  const perBooks = round2(
    (journal ?? []).reduce((s, l) => s + Number(l.debit) - Number(l.credit), 0)
  );
  const difference = round2(perBank - perBooks);

  return {
    accounts: perAccount,
    perBank,
    perBooks,
    difference,
    matched: difference === 0,
    unmatchedCount: (lines ?? []).filter((l) => l.status === "unmatched").length,
  };
}
