import { createClient } from "@/lib/supabase/server";
import { GrainStatementClient } from "./grain-statement-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat (Gandum)", rice: "Rice (Chawal)", maize: "Maize (Makai)" };

export default async function GrainStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ seller_type?: string; seller_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();
  const sellerType = params.seller_type === "party" ? "party" : "farmer";
  const sellerId = params.seller_id ?? "";
  const lang = getLanguageFromCookies("rm");

  if (!sellerId) {
    return <div className="p-8 text-center text-surface-400">{t("gst_select_party", lang)}</div>;
  }

  let sellerName = "-";
  let sellerCode: string | null = null;
  let sellerPhone: string | null = null;

  if (sellerType === "farmer") {
    const { data } = await supabase.from("farmers").select("full_name, farmer_code, phone_number").eq("id", sellerId).maybeSingle();
    sellerName = data?.full_name ?? "-";
    sellerCode = data?.farmer_code ?? null;
    sellerPhone = data?.phone_number ?? null;
  } else {
    const { data } = await supabase.from("grain_parties").select("party_name, phone").eq("id", sellerId).maybeSingle();
    sellerName = data?.party_name ?? "-";
    sellerPhone = data?.phone ?? null;
  }

  const filterColumn = sellerType === "farmer" ? "farmer_id" : "party_id";

  const [{ data: rawEntries }, { data: rawPayments }] = await Promise.all([
    supabase
      .from("grain_procurement_entries")
      .select("*")
      .eq(filterColumn, sellerId)
      .order("entry_date", { ascending: true }),
    supabase
      .from("grain_procurement_payments")
      .select("*")
      .eq(filterColumn, sellerId)
      .order("created_at", { ascending: true }),
  ]);

  const entries = (rawEntries ?? []).map((e: any) => ({
    id: e.id,
    date: e.entry_date,
    type: "entry" as const,
    grain_type: e.grain_type,
    weight_kg: Number(e.weight_kg),
    rate_per_kg: Number(e.rate_per_kg),
    amount: Number(e.total_amount),
  }));

  const payments = (rawPayments ?? []).map((p: any) => ({
    id: p.id,
    date: p.created_at,
    type: "payment" as const,
    payment_method: p.payment_method,
    notes: p.notes,
    amount: Number(p.amount),
  }));

  const combined = [
    ...entries.map((e) => ({ ...e, kind: "entry" as const })),
    ...payments.map((p) => ({ ...p, kind: "payment" as const })),
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let running = 0;
  const ledger = combined.map((row) => {
    if (row.kind === "entry") {
      running += row.amount;
    } else {
      running -= row.amount;
    }
    return { ...row, balance_after: running };
  });

  const totalSupplied = entries.reduce((s, e) => s + e.amount, 0);
  const totalPaid = payments.reduce((s, p) => s + p.amount, 0);
  const balanceDue = totalSupplied - totalPaid;

  const byGrainType = ["wheat", "rice", "maize"].map((type) => {
    const typeEntries = entries.filter((e) => e.grain_type === type);
    return {
      grain_type: type,
      label: GRAIN_LABELS[type],
      totalKg: typeEntries.reduce((s, e) => s + e.weight_kg, 0),
      totalValue: typeEntries.reduce((s, e) => s + e.amount, 0),
    };
  }).filter((g) => g.totalKg > 0);

  return (
    <GrainStatementClient
      sellerName={sellerName}
      sellerType={sellerType}
      sellerCode={sellerCode}
      sellerPhone={sellerPhone}
      ledger={ledger}
      totalSupplied={totalSupplied}
      totalPaid={totalPaid}
      balanceDue={balanceDue}
      byGrainType={byGrainType}
    />
  );
}