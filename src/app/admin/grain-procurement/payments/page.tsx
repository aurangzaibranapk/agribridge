import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { GrainPaymentsClient } from "./payments-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

/**
 * Anaj: kisan ki adaigi.
 *
 * Adaigi pehle grain-client ke ek tab mein dabi hui thi, us safhe par
 * jahan naya anaj bhi darj hota hai. Do bilkul alag kaam ek hi jagah:
 * anaj lena subah ka kaam hai, adaigi shaam ka -- aur adaigi karte waqt
 * saamne sirf ye hona chahiye ke kis ka kitna baqi hai.
 */
export default async function GrainPaymentsPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: farmerBalances }, { data: entries }, { data: payments }, { data: parties }, { data: accounts }] =
    await Promise.all([
      supabase.from("grain_farmer_balances").select("*").order("balance_due", { ascending: false }),
      supabase.from("grain_procurement_entries").select("party_id, total_amount"),
      supabase.from("grain_procurement_payments").select("party_id, amount, farmer_id, payment_date, created_at").order("created_at", { ascending: false }),
      supabase.from("grain_parties").select("id, party_name, contact_person, phone"),
      supabase.from("finance_accounts").select("id, name").eq("is_active", true).order("account_type"),
    ]);

  // Party ka baqi view mein nahi aata -- wo sirf kisan ke liye hai. Is
  // liye yahan wohi hisaab party ke liye bhi banaya jata hai, warna
  // party ko diya jane wala paisa is safhe se ghayab reh jata.
  const partySupplied = new Map<string, number>();
  for (const e of entries ?? []) {
    if (!e.party_id) continue;
    partySupplied.set(e.party_id, (partySupplied.get(e.party_id) ?? 0) + Number(e.total_amount ?? 0));
  }
  const partyPaid = new Map<string, number>();
  for (const p of payments ?? []) {
    if (!p.party_id) continue;
    partyPaid.set(p.party_id, (partyPaid.get(p.party_id) ?? 0) + Number(p.amount ?? 0));
  }

  const rows = [
    ...(farmerBalances ?? [])
      .filter((b) => Number(b.balance_due ?? 0) !== 0 || Number(b.total_supplied ?? 0) > 0)
      .map((b) => ({
        id: b.farmer_id as string,
        seller_type: "farmer" as const,
        name: b.full_name ?? "-",
        sub: b.farmer_code ?? "",
        phone: b.phone_number ?? null,
        supplied: Number(b.total_supplied ?? 0),
        paid: Number(b.total_paid ?? 0),
        due: Number(b.balance_due ?? 0),
      })),
    ...(parties ?? [])
      .map((p) => ({
        id: p.id,
        seller_type: "party" as const,
        name: p.party_name,
        sub: p.contact_person ?? "",
        phone: p.phone ?? null,
        supplied: partySupplied.get(p.id) ?? 0,
        paid: partyPaid.get(p.id) ?? 0,
        due: (partySupplied.get(p.id) ?? 0) - (partyPaid.get(p.id) ?? 0),
      }))
      .filter((p) => p.supplied > 0 || p.paid > 0),
  ].sort((a, b) => b.due - a.due);

  const recent = (payments ?? []).slice(0, 15);

  return (
    <div>
      <PageHeader title={t("gp_title", lang)} description={t("gp_subtitle", lang)} />
      <GrainPaymentsClient
        rows={rows}
        accounts={(accounts ?? []).map((a) => ({ id: a.id, name: a.name }))}
        recentCount={recent.length}
      />
    </div>
  );
}
