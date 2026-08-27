import { createClient } from "@/lib/supabase/server";
import { FarmerCreditStatementClient } from "./statement-client";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  seed: "Seed",
  fertilizer: "Fertilizer",
  pesticide: "Pesticide",
  machinery: "Machinery",
  milk: "Milk (Weekly Auto-Deduct)",
  wanda: "Wanda",
  opening_balance: "Opening Balance (DigiKhata)",
  produce_repayment: "Produce Repayment",
  other: "Other",
};

export default async function FarmerCreditStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ farmer_id?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();
  const farmerId = params.farmer_id ?? "";

  if (!farmerId) {
    return <div className="p-8 text-center text-surface-400">Farmer select karein.</div>;
  }

  const { data: farmer } = await supabase.from("farmers").select("full_name, farmer_code, phone_number, credit_limit").eq("id", farmerId).maybeSingle();
  const { data: rawLedger } = await supabase
    .from("farmer_credit_ledger")
    .select("*")
    .eq("farmer_id", farmerId)
    .order("created_at", { ascending: true });

  let running = 0;
  const ledger = (rawLedger ?? []).map((r: any) => {
    if (r.ledger_type === "debit") running += Number(r.amount);
    else running -= Number(r.amount);
    return {
      id: r.id,
      date: r.created_at,
      source_type: r.source_type,
      source_label: SOURCE_LABELS[r.source_type] ?? r.source_type,
      ledger_type: r.ledger_type,
      amount: Number(r.amount),
      collected_by: r.collected_by,
      notes: r.notes,
      balance_after: running,
    };
  });

  const totalDebit = ledger.filter((r) => r.ledger_type === "debit").reduce((s, r) => s + r.amount, 0);
  const totalCredit = ledger.filter((r) => r.ledger_type === "credit").reduce((s, r) => s + r.amount, 0);
  const balanceDue = totalDebit - totalCredit;

  const bySource: Record<string, number> = {};
  ledger.filter((r) => r.ledger_type === "debit").forEach((r) => {
    bySource[r.source_type] = (bySource[r.source_type] ?? 0) + r.amount;
  });

  return (
    <FarmerCreditStatementClient
      farmerName={farmer?.full_name ?? "-"}
      farmerCode={farmer?.farmer_code ?? "-"}
      farmerPhone={farmer?.phone_number ?? null}
      creditLimit={farmer?.credit_limit ? Number(farmer.credit_limit) : null}
      ledger={ledger}
      totalDebit={totalDebit}
      totalCredit={totalCredit}
      balanceDue={balanceDue}
      bySource={Object.entries(bySource).map(([source, amt]) => ({ label: SOURCE_LABELS[source] ?? source, amount: amt }))}
    />
  );
}