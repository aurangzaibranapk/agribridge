import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SuppliersListClient } from "./suppliers-list-client";

export const dynamic = "force-dynamic";

export default async function AdminSuppliersPage() {
  const supabase = createClient();
  const { data: suppliers } = await supabase.from("suppliers").select("*").order("name");

  const typedSuppliers = (suppliers ?? []).map((s) => ({
    ...s,
    credit_limit: s.credit_limit ? Number(s.credit_limit) : 0,
    current_payable: s.current_payable ? Number(s.current_payable) : 0,
  }));

  return (
    <div>
      <PageHeader title="Suppliers" description="Companies/vendors you purchase stock from" />
      <SuppliersListClient suppliers={typedSuppliers} />
    </div>
  );
}