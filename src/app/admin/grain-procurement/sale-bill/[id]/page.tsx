import { createClient } from "@/lib/supabase/server";
import { loadGrainPaymentHistory } from "@/lib/grain/payment-history";
import { GrainSaleBillClient, type SaleBill } from "./grain-sale-bill-client";

export const dynamic = "force-dynamic";

/** Notes se "Gross ... (18,652 kg)" aur "Katoti ... = 466.3 kg" nikalta hai (agar likha ho). */
function parseNotes(notes: string | null): { gross: number | null; cut: number | null } {
  if (!notes) return { gross: null, cut: null };
  const num = (s?: string) => (s ? Number(s.replace(/,/g, "")) : null);
  const g = notes.match(/gross[^()]*\(([\d,.]+)\s*kg\)/i) ?? notes.match(/gross[^\d]*([\d,.]+)\s*kg/i);
  const c = notes.match(/katoti[^=]*=\s*([\d,.]+)\s*kg/i);
  return { gross: num(g?.[1]), cut: num(c?.[1]) };
}

export default async function GrainSaleBillPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = createClient();

  const { data: s } = await (supabase as any)
    .from("grain_sales")
    .select("*, buyers(*), warehouses(name)")
    .eq("id", id)
    .maybeSingle();

  if (!s) return <div className="p-8 text-center text-surface-400">Bikri ka record nahi mila.</div>;

  const buyer = Array.isArray(s.buyers) ? s.buyers[0] : s.buyers;
  const warehouse = Array.isArray(s.warehouses) ? s.warehouses[0] : s.warehouses;

  const { data: rawPayments } = await (supabase as any)
    .from("grain_sale_payments").select("*").eq("sale_id", id).order("created_at", { ascending: true });
  const payments = await loadGrainPaymentHistory(supabase, "grain_sale_payments", rawPayments ?? []);

  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const isAdmin = ["owner", "super_admin", "admin"].includes(String(me?.role ?? ""));

  const parsed = parseNotes(s.notes ?? null);
  const bill: SaleBill = {
    id: s.id,
    sale_number: s.sale_number ?? `GRN-SALE-${String(s.id).slice(0, 8).toUpperCase()}`,
    sale_date: s.sale_date,
    grain_type: s.grain_type,
    quality_grade: s.quality_grade ?? null,
    quantity_kg: Number(s.quantity_kg),
    gross_weight_kg: s.gross_weight_kg != null ? Number(s.gross_weight_kg) : parsed.gross,
    cut_kg: s.cut_kg != null ? Number(s.cut_kg) : parsed.cut,
    rate_per_kg: Number(s.rate_per_kg),
    total_amount: Number(s.total_amount),
    total_cogs: Number(s.total_cogs ?? 0),
    profit: Number(s.profit ?? 0),
    amount_received: Number(s.amount_received ?? 0),
    warehouse_name: warehouse?.name ?? "-",
    buyer: {
      name: buyer?.business_name ?? "-",
      code: buyer?.buyer_code ?? null,
      owner: buyer?.contact_person ?? null,
      phone: buyer?.phone_number ?? null,
      ntn: buyer?.ntn ?? buyer?.ntn_number ?? null,
      address: buyer?.address ?? null,
    },
    notes: s.notes ?? null,
  };

  return <GrainSaleBillClient bill={bill} payments={payments} isAdmin={isAdmin} />;
}
