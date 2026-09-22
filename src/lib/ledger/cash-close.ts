import { createServiceClient } from "@/lib/supabase/service";

/**
 * Raat ki cash ginti.
 *
 * Ledger ye bata deta hai ke kaghaz par kitna cash hona chahiye. Magar
 * kaghaz ka adad khud ko kabhi ghalat nahi kehta: golak mein Rs 50 kam
 * hon to bhi Trial Balance barabar rahega, kyunki jo likha gaya wo
 * theek likha gaya tha -- bas jo hua wo likha nahi gaya.
 *
 * Kaghaz aur haqeeqat ka faasla sirf haath se gin kar maloom hota hai.
 * Yahi wo ek qadam hai jo baqi poore hisaab ko haqeeqat se bandhta hai;
 * is ke baghair double-entry sirf ek khoobsurat, mukammal, aur mumkina
 * tor par ghalat kahani hai.
 */

/** Pakistani note aur sikkay -- barhe se chhote ki tarteeb mein. */
export const DENOMINATIONS = [5000, 1000, 500, 100, 50, 20, 10, 5, 2, 1] as const;

export type DenominationCount = Record<string, number>;

export function totalFromDenominations(counts: DenominationCount): number {
  return DENOMINATIONS.reduce((sum, note) => sum + note * (counts[String(note)] ?? 0), 0);
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * Us branch ke paas is tareekh tak kitna cash hona chahiye.
 *
 * Seedha journal ki qataron se ginta hai -- kisi alag rakhe hue balance
 * se nahi. Alag rakha balance ek din asal qataron se hat jata hai aur
 * phir ginti us ghalat adad se milayi jati hai: farq sifar aata hai aur
 * masla nazar hi nahi aata.
 */
export async function expectedCash(branchId: string, upToDate: string): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("journal_lines")
    .select("debit, credit, journal_entries!inner(entry_date, branch_id)")
    .eq("account_code", "1000")
    .eq("journal_entries.branch_id", branchId)
    .lte("journal_entries.entry_date", upToDate);

  return round2(
    (data ?? []).reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0)
  );
}

/**
 * Wo cash jo kisi branch ke naam nahi.
 *
 * Har branch apna cash ginti hai, is liye jis entry par branch likha hi
 * nahi gaya wo kisi ki ginti mein nahi aati -- yani us par kabhi sawal
 * nahi hota. Ye raqam yahan alag se ginti hai taake ye khaamoshi se na
 * baithi rahe.
 */
export async function unattributedCash(): Promise<number> {
  const service = createServiceClient();
  const { data } = await service
    .from("journal_lines")
    .select("debit, credit, journal_entries!inner(branch_id)")
    .eq("account_code", "1000")
    .is("journal_entries.branch_id", null);

  return round2(
    (data ?? []).reduce((sum, line) => sum + Number(line.debit) - Number(line.credit), 0)
  );
}

export interface ClosingRow {
  id: string;
  branchId: string;
  branchName: string;
  closeDate: string;
  expected: number;
  counted: number;
  difference: number;
  reason: string | null;
  countedByName: string | null;
  createdAt: string;
}

export async function recentClosings(limit = 30, branchId?: string | null): Promise<ClosingRow[]> {
  const service = createServiceClient();
  let query = service
    .from("cash_closings")
    .select(
      "id, branch_id, close_date, expected_amount, counted_amount, difference, difference_reason, created_at, branches(name), profiles!cash_closings_counted_by_fkey(full_name)"
    )
    .order("close_date", { ascending: false })
    .limit(limit);

  if (branchId) query = query.eq("branch_id", branchId);

  const { data } = await query;

  return (data ?? []).map((r) => ({
    id: r.id,
    branchId: r.branch_id,
    branchName: (r.branches as { name: string } | null)?.name ?? "—",
    closeDate: r.close_date,
    expected: Number(r.expected_amount),
    counted: Number(r.counted_amount),
    difference: Number(r.difference),
    reason: r.difference_reason,
    countedByName: (r.profiles as { full_name: string | null } | null)?.full_name ?? null,
    createdAt: r.created_at,
  }));
}

export interface MissingClose {
  branchId: string;
  branchName: string;
  closeDate: string;
}

/**
 * Jin dinon cash hila magar raat ko ginti nahi hui.
 *
 * Chhoot jane wale din sab se aasan darwaza hain: jis din ginti nahi
 * hui, us din ka farq kabhi maloom nahi hoga. Is liye ye fehrist khali
 * rehni chahiye.
 */
export async function missingClosings(limit = 60): Promise<MissingClose[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("v_cash_close_missing")
    .select("branch_id, branch_name, close_date")
    .order("close_date", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    branchId: r.branch_id ?? "",
    branchName: r.branch_name ?? "—",
    closeDate: r.close_date ?? "",
  }));
}

/** Kitna farq "dekh lena chahiye" ke daire se bahar hai. */
export const DIFFERENCE_ALERT_THRESHOLD = 500;
export const REASON_MIN = 5;
export const REASON_MAX = 255;
