import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { BranchForm } from "@/app/admin/branches/branch-form";
import { BranchesListClient } from "@/app/admin/branches/branches-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

export default async function AdminBranchesPage() {
  const lang = getLanguageFromCookies("rm");
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

  // Har shaakh ki apni dukanein.
  //
  // Malik (6 September): *"pehle branch create hona chahiye, phir option
  // branch ke andar create shop ka."*
  //
  // Wo theek keh rahe the, aur ye khana na hone ka nuqsan usi din
  // saamne aaya: Live par "Main Branch" naam ki DO shaakhein thin -- ek
  // ke neeche do dukanein, doosri bilkul khali -- aur Users ke safhe par
  // dono bilkul ek jaisi nazar aati thin. Malik ne khali wali chun li,
  // aur Shop ka khana khali hi raha. Kisi safhe par ye likha hi nahi tha
  // ke kis shaakh ke neeche kya hai.
  const { data: shops } = await supabase
    .from("shops")
    .select("id, name, business_type, branch_id, is_active")
    .order("name");

  const shopsByBranch: Record<string, { id: string; name: string; business_type: string; is_active: boolean }[]> = {};
  (shops ?? []).forEach((sh) => {
    if (!sh.branch_id) return;
    const list = shopsByBranch[sh.branch_id] ?? [];
    list.push({ id: sh.id, name: sh.name, business_type: sh.business_type, is_active: sh.is_active !== false });
    shopsByBranch[sh.branch_id] = list;
  });

  const staffByBranch: Record<string, { full_name: string; role: string }[]> = {};
  (staff ?? []).forEach((s) => {
    if (!s.branch_id) return;
    const list = staffByBranch[s.branch_id] ?? [];
    list.push({ full_name: s.full_name, role: s.role });
    staffByBranch[s.branch_id] = list;
  });

  return (
    <div>
      <PageHeader title={t("br_shops_branches", lang)} description="Your physical shop locations" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          {!branches || branches.length === 0 ? (
            <EmptyState title={t("br_no_shops", lang)} />
          ) : (
            <BranchesListClient branches={branches} staffByBranch={staffByBranch} shopsByBranch={shopsByBranch} />
          )}
        </div>
        <BranchForm />
      </div>
    </div>
  );
}