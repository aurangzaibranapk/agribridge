import { createClient } from "@/lib/supabase/server";
import { GrainBillClient } from "./grain-bill-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function GrainBillPage({ params }: { params: Promise<{ id: string }> }) {
  const lang = getLanguageFromCookies("rm");
  const { id } = await params;
  const supabase = createClient();

  const { data: entry } = await supabase
    .from("grain_procurement_entries")
    .select("*, farmers(full_name, farmer_code, phone_number), grain_parties(party_name, contact_person, phone), warehouses(name)")
    .eq("id", id)
    .maybeSingle();

  if (!entry) {
    return <div className="p-8 text-center text-surface-400">{t("gb_entry_not_found", lang)}</div>;
  }

  const farmer = Array.isArray(entry.farmers) ? entry.farmers[0] : entry.farmers;
  const party = Array.isArray(entry.grain_parties) ? entry.grain_parties[0] : entry.grain_parties;
  const warehouse = Array.isArray(entry.warehouses) ? entry.warehouses[0] : entry.warehouses;
  const entryRule = entry as typeof entry & { bag_weight_kg?: number | null; bag_count?: number | null; cut_per_bag_kg?: number | null; chungi_per_bag_kg?: number | null };

  const bill = {
    id: entry.id,
    entry_date: entry.entry_date,
    grain_type: entry.grain_type,
    gross_weight_kg: Number(entry.gross_weight_kg ?? entry.weight_kg),
    cut_percentage: Number(entry.cut_percentage ?? 0),
    cut_kg: Number(entry.cut_kg ?? 0),
    weight_kg: Number(entry.weight_kg),
    chungi_type: String(entry.chungi_type ?? "cash"),
    chungi_kg: Number(entry.chungi_kg ?? 0),
    chungi_amount: Number(entry.chungi_amount ?? 0),
    bag_weight_kg: entryRule.bag_weight_kg == null ? null : Number(entryRule.bag_weight_kg),
    bag_count: entryRule.bag_count == null ? null : Number(entryRule.bag_count),
    cut_per_bag_kg: entryRule.cut_per_bag_kg == null ? null : Number(entryRule.cut_per_bag_kg),
    chungi_per_bag_kg: entryRule.chungi_per_bag_kg == null ? null : Number(entryRule.chungi_per_bag_kg),
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
    stock_weight_kg: (entry as { stock_weight_kg?: number | null }).stock_weight_kg == null ? null : Number((entry as { stock_weight_kg?: number | null }).stock_weight_kg),
  };

  return <GrainBillClient bill={bill} />;
}
