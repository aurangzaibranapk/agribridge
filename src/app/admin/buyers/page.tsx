import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { BuyerForm } from "@/app/admin/buyers/buyer-form";
import { BuyersListClient } from "./buyers-list-client";
export const dynamic = "force-dynamic";
export default async function AdminBuyersPage() {
  const supabase = createClient();
  const { data: buyers } = await supabase.from("buyers").select("*").order("created_at", { ascending: false });
  return (
    <div>
      <PageHeader title="Buyers" description="Companies/traders who purchase produce from farmers via the Marketplace" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BuyersListClient buyers={buyers ?? []} />
        </div>
        <BuyerForm />
      </div>
    </div>
  );
}