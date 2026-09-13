import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { AddFarmerButton } from "@/app/admin/farmers/add-farmer-modal";
import { FarmersListClient } from "@/app/admin/farmers/farmers-list-client";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { canDo } from "@/lib/access/guard";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export const dynamic = "force-dynamic";

export default async function AdminFarmersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: farmers } = await supabase.from("farmers").select("*").eq("is_deleted", false).order("created_at", { ascending: false });

  // Kaun kya kar sakta hai.
  //
  // Malik (6 September): *"Farmers ki jagah staff ko Farmers/Membership
  // aana chahiye, jis se ye SIRF member add kar sakein."*
  //
  // Member banana staff ka kaam hai. Tasdeeq (kaghaz dekhna) aur mitana
  // us se ooper ka faisla hai -- wo sirf un ke paas jinhein ijazat mili
  // ho.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = await supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle();
  const sabKuchWala = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));

  const [banaSakta, tasdeeqKarSakta] = await Promise.all([
    canDo("farmers", "create"),
    canDo("farmers", "verify"),
  ]);

  return (
    <div>
      <PageHeader
        title="Farmers / Membership"
        description="Naya member banayein — poori maloomat aur CNIC ki copy ke sath"
        actions={banaSakta ? <AddFarmerButton /> : undefined}
      />
      {!farmers || farmers.length === 0 ? (
        <EmptyState title={t("fp_none_registered", lang)} />
      ) : (
        <FarmersListClient
          farmers={farmers}
          tasdeeqKarSakta={tasdeeqKarSakta || sabKuchWala}
          mitaSakta={sabKuchWala}
        />
      )}
    </div>
  );
}