import { createServiceClient } from "@/lib/supabase/service";

/**
 * Kis ne kya kiya.
 *
 * Do alag fehristen ek jagah:
 *
 *   1. LEDGER KI WO ENTRIYAN JO NAZAR MEIN RAHNI CHAHIYEN -- purani
 *      tareekh wali, aur wo jo ulti gayin. Dono jaiz kaam hain aur
 *      inhen rokna ghalat hoga: ghalti hoti hai, aur kabhi entry waqai
 *      us din ki hoti hai jo guzar chuka. Magar yehi do jagahen hain
 *      jahan haath ki safai chhup sakti hai -- is liye inhen roka nahi
 *      jata, NAZAR MEIN rakha jata hai.
 *
 *   2. AAM KAAMON KA RECORD -- kis ne kya banaya, badla, manzoor kiya.
 *
 * Ek hi shakhs har hafte purani tareekh mein entry daal raha ho, ya ek
 * hi qism ki entry baar baar ulti ja rahi ho -- ye baat sirf tab nazar
 * aati hai jab sab ek jagah ho.
 */

export const REVERSAL_REASON_MIN = 10;

export interface WatchEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceModule: string;
  kind: "reversal" | "backdated";
  reason: string | null;
  by: string | null;
  originalEntry: string | null;
  amount: number;
  /** Entry ki tareekh aur likhne ki tareekh ka faasla. */
  dayGap: number;
  createdAt: string;
}

export async function ledgerWatch(limit = 50): Promise<WatchEntry[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("v_ledger_watch")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id ?? "",
    entryNumber: r.entry_number ?? "",
    entryDate: r.entry_date ?? "",
    description: r.description ?? "",
    sourceModule: r.source_module ?? "",
    kind: (r.kism ?? "backdated") as "reversal" | "backdated",
    reason: r.wajah,
    by: r.kis_ne,
    originalEntry: r.asal_entry,
    amount: Number(r.raqam ?? 0),
    dayGap: Number(r.din_ka_faasla ?? 0),
    createdAt: r.created_at ?? "",
  }));
}

export interface RecentEntry {
  id: string;
  entryNumber: string;
  entryDate: string;
  description: string;
  sourceModule: string;
  amount: number;
  by: string | null;
  isReversal: boolean;
  /** Ye entry pehle hi ulti ja chuki hai? */
  reversedBy: string | null;
}

/**
 * Haal hi ki entriyan -- yahin se reversal shuru hota hai.
 *
 * Jo entry pehle ulti ja chuki hai, us par dobara reversal ka button
 * nahi aata. Database wese bhi rok deta hai, magar button dikha kar
 * phir mana karna logon ko ye sikha deta hai ke button ka matlab kuch
 * nahi -- aur phir wo baqi buttons par bhi sochna chhor dete hain.
 */
export async function recentEntries(limit = 40): Promise<RecentEntry[]> {
  const service = createServiceClient();

  const { data } = await service
    .from("journal_entries")
    .select(
      "id, entry_number, entry_date, description, source_module, is_reversal, created_by, profiles(full_name), journal_lines(debit)"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  const rows = data ?? [];

  const { data: reversals } = await service
    .from("journal_entries")
    .select("reversal_of, entry_number")
    .not("reversal_of", "is", null);

  const reversedMap = new Map(
    (reversals ?? []).map((r) => [r.reversal_of as string, r.entry_number])
  );

  return rows.map((r) => ({
    id: r.id,
    entryNumber: r.entry_number,
    entryDate: r.entry_date,
    description: r.description,
    sourceModule: r.source_module,
    amount: ((r.journal_lines ?? []) as { debit: number }[]).reduce(
      (s, l) => s + Number(l.debit),
      0
    ),
    by: (r.profiles as { full_name: string | null } | null)?.full_name ?? null,
    isReversal: r.is_reversal,
    reversedBy: reversedMap.get(r.id) ?? null,
  }));
}

export interface AuditRow {
  id: string;
  actorName: string | null;
  actorRole: string | null;
  actionType: string;
  module: string;
  recordLabel: string | null;
  description: string | null;
  createdAt: string;
}

export async function auditLog(limit = 60, module?: string | null): Promise<AuditRow[]> {
  const service = createServiceClient();
  let query = service
    .from("audit_logs")
    .select("id, actor_name, actor_role, action_type, module, record_label, description, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (module) query = query.eq("module", module);

  const { data } = await query;
  return (data ?? []).map((r) => ({
    id: r.id,
    actorName: r.actor_name,
    actorRole: r.actor_role,
    actionType: r.action_type,
    module: r.module,
    recordLabel: r.record_label,
    description: r.description,
    createdAt: r.created_at,
  }));
}
