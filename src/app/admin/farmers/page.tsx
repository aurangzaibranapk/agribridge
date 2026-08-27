import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { AddFarmerButton } from "@/app/admin/farmers/add-farmer-modal";
import { FarmersListClient } from "@/app/admin/farmers/farmers-list-client";

export const dynamic = "force-dynamic";

export default async function AdminFarmersPage() {
  const supabase = createClient();
  const { data: farmers } = await supabase.from("farmers").select("*").eq("is_deleted", false).order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader title="Farmers" description="Registrations from the public Farmer Registration form" actions={<AddFarmerButton />} />
      {!farmers || farmers.length === 0 ? (
        <EmptyState title="No farmers registered yet" />
      ) : (
        <FarmersListClient farmers={farmers} />
      )}
    </div>
  );
}