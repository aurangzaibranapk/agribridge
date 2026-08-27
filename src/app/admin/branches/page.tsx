import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { BranchForm } from "@/app/admin/branches/branch-form";
import { BranchesListClient } from "@/app/admin/branches/branches-list-client";

export const dynamic = "force-dynamic";

export default async function AdminBranchesPage() {
  const supabase = createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, district, tehsil, address, is_main_branch, status, status_reason")
    .order("is_main_branch", { ascending: false })
    .order("name");

  const { data: staff } = await supabase
    .from("profiles")
    .select("id, full_name, role, branch_id")
    .in("role", ["manager", "sales_staff"])
    .eq("is_active", true);

  const staffByBranch: Record<string, { full_name: string; role: string }[]> = {};
  (staff ?? []).forEach((s) => {
    if (!s.branch_id) return;
    const list = staffByBranch[s.branch_id] ?? [];
    list.push({ full_name: s.full_name, role: s.role });
    staffByBranch[s.branch_id] = list;
  });

  return (
    <div>
      <PageHeader title="Shops / Branches" description="Your physical shop locations" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!branches || branches.length === 0 ? (
            <EmptyState title="No shops yet" />
          ) : (
            <BranchesListClient branches={branches} staffByBranch={staffByBranch} />
          )}
        </div>
        <BranchForm />
      </div>
    </div>
  );
}