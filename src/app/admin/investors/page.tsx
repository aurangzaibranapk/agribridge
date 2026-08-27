import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { InvestorsListClient } from "./investors-list-client";

export const dynamic = "force-dynamic";

export default async function AdminInvestorsPage() {
  const supabase = createClient();
  const { data: rawInvestors } = await supabase
    .from("investors")
    .select("*, investment_deals(id, deal_type, amount_invested, profit_share_percentage, status)")
    .order("created_at", { ascending: false });

  const investors = (rawInvestors ?? []).map((inv: any) => ({
    id: inv.id,
    investor_code: inv.investor_code,
    full_name: inv.full_name,
    phone_number: inv.phone_number,
    total_invested: Number(inv.total_invested),
    is_active: inv.is_active,
    created_at: inv.created_at,
    deals: (inv.investment_deals ?? []).map((d: any) => ({
      id: d.id,
      deal_type: d.deal_type,
      amount_invested: Number(d.amount_invested),
      profit_share_percentage: d.profit_share_percentage,
      status: d.status,
    })),
  }));

  return (
    <div>
      <PageHeader title="Investors" description="People who've invested in AgriBridge products or business deals" />
      <InvestorsListClient investors={investors} />
    </div>
  );
}