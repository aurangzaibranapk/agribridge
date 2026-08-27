import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { DealersListClient } from "./dealers-list-client";
export const dynamic = "force-dynamic";
export default async function AdminDealersPage() {
  const supabase = createClient();
  const { data: dealers } = await supabase
    .from("dealers")
    .select("*")
    .order("created_at", { ascending: false });

  const typedDealers = (dealers ?? []).map((d) => ({
    ...d,
    current_payable: d.current_payable ? Number(d.current_payable) : 0,
  }));

  return (
    <div>
      <PageHeader title="Dealers" description="Third-party dealer partners using AgriBridge's Bridge Order system" />
      <DealersListClient dealers={typedDealers} />
    </div>
  );
}