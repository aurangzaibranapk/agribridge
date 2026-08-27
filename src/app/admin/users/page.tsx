import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { RoleSelector } from "@/app/admin/users/role-selector";
import { BranchSelector } from "@/app/admin/users/branch-selector";
import { ShopSelector } from "@/app/admin/users/shop-selector";
import { StaffStatusManager } from "@/app/admin/users/staff-status-manager";
import { formatDate } from "@/lib/utils/format";
export const dynamic = "force-dynamic";
export default async function UsersPage() {
  const supabase = createClient();
  const [{ data: profiles }, { data: branches }, { data: shops }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .in("role", ["super_admin", "admin", "manager", "sales_staff"])
      .order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("shops").select("id, name, branch_id, business_type").eq("is_active", true).order("name"),
  ]);
  return (
    <div>
      <PageHeader title="Users & Roles" description="Super Admin, Admin, Manager, and Sales Staff - role-based access control" />
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-left text-xs text-surface-400">
              <th className="pb-2">Name</th>
              <th className="pb-2">Role</th>
              <th className="pb-2">Branch</th>
              <th className="pb-2">Shop</th>
              <th className="pb-2">Joined</th>
              <th className="pb-2">Status</th>
              <th className="pb-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p: any) => (
              <>
                <tr key={p.id} className="border-b border-surface-50">
                  <td className="py-3">
                    <p className="font-medium text-surface-800">{p.full_name}</p>
                    {p.phone_number && <p className="text-xs text-surface-400">{p.phone_number}</p>}
                  </td>
                  <td className="py-3"><RoleSelector userId={p.id} currentRole={p.role} /></td>
                  <td className="py-3">
                    <BranchSelector userId={p.id} currentBranchId={p.branch_id} branches={branches ?? []} />
                  </td>
                  <td className="py-3">
                    <ShopSelector userId={p.id} currentShopId={p.shop_id} currentBranchId={p.branch_id} shops={shops ?? []} />
                  </td>
                  <td className="py-3 text-surface-500">{formatDate(p.created_at)}</td>
                  <td className="py-3">
                    {p.status === "suspended" ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">Suspended</span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Active</span>
                    )}
                  </td>
                  <td className="py-3"><StaffStatusManager userId={p.id} status={p.status ?? "active"} /></td>
                </tr>
                {p.status_reason && (
                  <tr key={`${p.id}-reason`}>
                    <td colSpan={7} className="pb-2 text-xs text-surface-500">
                      <strong>Wajah:</strong> {p.status_reason}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}