import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aajKaKhana } from "@/lib/utils/format";
import { failed, postQistSettlement } from "@/lib/ledger/rules";
import { postFarmerLedger } from "@/lib/farmer-ledger";
import { receivableAccount, payoutAccount, type QistParty, type QistSource } from "@/lib/qist/schedule";

// Server-only helper (server action NAHI): sirf doosre server actions bulate hain,
// taake browser se koi seedha kattauti/journal na chala sake.
/**
 * Adaigi (doodh / anaj / supplier) ke waqt qist kaatna + khata + journal.
 * Journal na bane to kattauti wapas. Wapas: kitna kata.
 */
export async function applyQistAtPayout(a: {
  partyType: QistParty; partyId: string; source: Exclude<QistSource, "salary" | "cash">; payout: number;
  sourceTable: string; sourceId: string; createdBy: string | null; branchId?: string | null;
}): Promise<{ deducted: number; error?: string }> {
  const sb = createClient() as any;
  const { data, error } = await sb.rpc("fn_qist_apply", {
    p_party_type: a.partyType, p_party_id: a.partyId, p_source: a.source, p_as_of: aajKaKhana(),
    p_payout: a.payout, p_source_table: a.sourceTable, p_source_id: a.sourceId,
  });
  if (error) return { deducted: 0, error: error.message };
  const deducted = Number(data?.deduct ?? 0);
  if (deducted <= 0 || data?.already) return { deducted: data?.already ? deducted : 0 };
  const items: { plan_id: string; code: string; deduct: number }[] = data.items ?? [];
  const journalIds: string[] = [];
  for (const it of items.filter((x) => Number(x.deduct) > 0)) {
    const { data: plan } = await sb.from("qist_plans").select("origin").eq("id", it.plan_id).single();
    const posted = await postQistSettlement({
      partyType: a.partyType, partyId: a.partyId, receivable: receivableAccount(a.partyType, plan?.origin ?? "advance"),
      debitAccount: payoutAccount(a.source), amount: Number(it.deduct),
      description: `Qist ${it.code} -- ${a.source === "milk" ? "doodh" : a.source === "grain" ? "anaj" : "supplier bill"} ki adaigi se kati`,
      ctx: { createdBy: a.createdBy, branchId: a.branchId ?? null, claims: [{ table: `${a.sourceTable}:qist:${it.plan_id}`, rowId: a.sourceId }] },
    });
    if (failed(posted)) {
      await sb.rpc("fn_qist_reverse_source", { p_source_table: a.sourceTable, p_source_id: a.sourceId, p_reason: `Journal nakaam: ${posted.error}` });
      return { deducted: 0, error: `Qist journal nahi bana, kattauti wapas: ${posted.error}` };
    }
    journalIds.push(posted.id);
  }
  if (journalIds.length) await sb.rpc("fn_qist_set_deduction_journal", { p_source_table: a.sourceTable, p_source_id: a.sourceId, p_journal: journalIds[0] });
  if (a.partyType === "farmer") {
    // Kisan ka khata: doodh ka haq utna kam (debit) aur advance utna wasool (credit) -- dono nazar aayen.
    const src = a.source === "grain" ? "grain_procurement" : "milk";
    await postFarmerLedger({ farmerId: a.partyId, sourceType: src as any, ledgerType: "debit", amount: deducted, notes: `Adaigi se qist kati (Rs ${deducted})`, referenceId: a.sourceId, createdBy: a.createdBy });
    await postFarmerLedger({ farmerId: a.partyId, sourceType: "produce_repayment" as any, ledgerType: "credit", amount: deducted, notes: `Qist wasool -- ${items.map((i) => i.code).join(", ")}`, referenceId: a.sourceId, createdBy: a.createdBy });
  }
  return { deducted };
}

