import { createClient } from "@/lib/supabase/server";
import { GrainBillClient } from "./grain-bill-client";

export const dynamic = "force-dynamic";

export default async function GrainBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: entry } = await supabase
    .from("grain_procurement_entries")
    .select("*, farmers(full_name, farmer_code, phone_number), grain_parties(party_name, contact_person, phone), warehouses(name)")
    .eq("id", id)
    .maybeSingle();

  if (!entry) {
    return <div className="p-8 text-center text-surface-400">Entry nahi mili.</div>;
  }

  const farmer = Array.isArray(entry.farmers) ? entry.farmers[0] : entry.farmers;
  const party = Array.isArray(entry.grain_parties) ? entry.grain_parties[0] : entry.grain_parties;
  const warehouse = Array.isArray(entry.warehouses) ? entry.warehouses[0] : entry.warehouses;

  const bill = {
    id: entry.id,
    entry_date: entry.entry_date,
    grain_type: entry.grain_type,
    gross_weight_kg: Number(entry.gross_weight_kg ?? entry.weight_kg),
    cut_percentage: Number(entry.cut_percentage ?? 0),
    cut_kg: Number(entry.cut_kg ?? 0),
    weight_kg: Number(entry.weight_kg),
    moisture_percentage: entry.moisture_percentage,
    quality_grade: entry.quality_grade,
    rate_per_kg: Number(entry.rate_per_kg),
    total_amount: Number(entry.total_amount),
    warehouse_name: warehouse?.name ?? "-",
    seller_name: farmer?.full_name ?? party?.party_name ?? "-",
    seller_code: farmer?.farmer_code ?? null,
    seller_phone: farmer?.phone_number ?? party?.phone ?? null,
    seller_type: farmer ? "Farmer" : "Party",
    notes: entry.notes,
  };

  return <GrainBillClient bill={bill} />;
}