import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { RoleSelector } from "@/app/admin/users/role-selector";
import { ExtraDepartments } from "@/app/admin/users/extra-departments";
import { BranchSelector } from "@/app/admin/users/branch-selector";
import { ShopSelector } from "@/app/admin/users/shop-selector";
import { StaffStatusManager } from "@/app/admin/users/staff-status-manager";
import { formatDate } from "@/lib/utils/format";
import { STAFF_ROLES } from "@/lib/utils/roles";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { createServiceClient } from "@/lib/supabase/service";
import { gapsFor } from "@/lib/access/profile-gaps";
export const dynamic = "force-dynamic";

/**
 * Safha har MULAZIM dikhata hai -- sirf chaar role wale nahi.
 *
 * Pehle yahan chaar role haath se likhe hue the. Nateeja: jis banday ko
 * ek dafa Finance ya HR laga diya, wo is fehrist se ghayab ho jata --
 * na us ka role badla ja sakta, na branch, na status. Aur naya
 * department (Machinery) to yahan kabhi aa hi nahi sakta tha.
 *
 * Ab fehrist STAFF_ROLES se banti hai -- wohi jagah jo tay karti hai ke
 * mulazim kaun hai.
 */
export default async function UsersPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const [{ data: profiles }, { data: branches }, { data: shops }] = await Promise.all([
    supabase
      .from("profiles")
      .select("*")
      .in("role", STAFF_ROLES)
      .order("created_at", { ascending: false }),
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase.from("shops").select("id, name, branch_id, business_type").eq("is_active", true).order("name"),
  ]);

  // HR ka record ek hi dafa, sab ke liye. Har bande ke liye alag sawal
  // poochne se safha dheema ho jata hai aur us ka jawab wohi rehta hai.
  //
  // Ye service client se parha jata hai kyunki staff_details par rok
  // fn_hr_can_view_staff ki hai: manager ko sirf apni team dikhti hai,
  // aur us khali jawab ko "profile poori hai" samajh lena bilkul ulta
  // natija de deta -- safha kehta "sab theek", aur role dene par rok lag
  // jati, bina wajah bataye.
  const service = createServiceClient();
  const { data: staffRows, error: staffErr } = await service
    .from("staff_details")
    .select("profile_id, cnic, designation, department_key, hire_date, reports_to, employee_code, emergency_contact_name, emergency_contact_phone");

  const hrById = new Map((staffRows ?? []).map((r) => [r.profile_id as string, r]));
  return (
    <div>
      <PageHeader
        title={t("us_title", lang)}
        description="Har mulazim ka department, branch aur darja — ek hi jagah se"
      />
      <Card className="mb-4 border-surface-200 bg-surface-50 dark:border-surface-800 dark:bg-surface-900/50">
        <p className="text-sm text-surface-700 dark:text-surface-300">
          <b>Poori profile ke baghair role nahi.</b> Kisi ko Manager, HR, Finance ya Admin banane se pehle
          us ka HR record mukammal hona chahiye — CNIC, ohda, shoba, afsar, aur kab se kaam par hai.
        </p>
        <p className="mt-1 text-xs leading-relaxed text-surface-500 dark:text-surface-400">
          Wajah tarteeb nahi, takleef hai: CNIC na ho to tankhwah ki adaigi rukti hai; afsar darj na ho to
          us ki har chhutti seedhi HR ke paas jati hai aur manager ko khabar tak nahi hoti; shoba na ho to
          wo team ke darakht mein kahin nazar nahi aata. Role <b>wapas lena ya kam karna</b> hamesha
          chalta hai — rok sirf ikhtiyar barhane par hai.
        </p>
      </Card>
      <Card>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-100 text-left text-xs text-surface-400">
              <th className="pb-2">{t("c_name", lang)}</th>
              <th className="pb-2">{t("c_role", lang)}</th>
              <th className="pb-2">Profile</th>
              <th className="pb-2">{t("us_extra_departments", lang)}</th>
              <th className="pb-2">{t("c_branch", lang)}</th>
              <th className="pb-2">{t("c_shop", lang)}</th>
              <th className="pb-2">{t("c_joined", lang)}</th>
              <th className="pb-2">{t("c_status", lang)}</th>
              <th className="pb-2">{t("c_action", lang)}</th>
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
                  {/* Kami PEHLE dikhti hai, role badalne ki koshish ke
                      baad nahi. Warna banda option chunta, rok lagti,
                      aur wo dobara wohi koshish karta rehta. */}
                  <td className="py-3">
                    {staffErr ? (
                      <span className="text-xs text-amber-700">record parha nahi gaya</span>
                    ) : (
                      (() => {
                        const gaps = gapsFor(p.role, p, hrById.get(p.id) ?? null);
                        if (gaps.length === 0) {
                          return <span className="text-xs text-brand-700">poori</span>;
                        }
                        return (
                          <span
                            className="text-xs text-amber-700"
                            title={gaps.map((g) => g.label).join(", ")}
                          >
                            {gaps.length} khana khali
                            <span className="block text-[10px] text-amber-600/80">
                              {gaps.slice(0, 2).map((g) => g.label).join(", ")}
                              {gaps.length > 2 ? "…" : ""}
                            </span>
                          </span>
                        );
                      })()
                    )}
                  </td>
                  {/* Asli department us ke saath wale khane mein hai --
                      wohi us ka ghar hai. Ye khana us ke ILAWA hai. */}
                  <td className="py-3">
                    <ExtraDepartments
                      userId={p.id}
                      mainRole={p.role}
                      current={(p.extra_roles as string[] | null) ?? []}
                    />
                  </td>
                  <td className="py-3">
                    <BranchSelector userId={p.id} currentBranchId={p.branch_id} branches={branches ?? []} />
                  </td>
                  <td className="py-3">
                    <ShopSelector userId={p.id} currentShopId={p.shop_id} currentBranchId={p.branch_id} shops={shops ?? []} />
                  </td>
                  <td className="py-3 text-surface-500">{formatDate(p.created_at)}</td>
                  <td className="py-3">
                    {p.status === "suspended" ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">{t("c_suspended", lang)}</span>
                    ) : (
                      <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">{t("c_active", lang)}</span>
                    )}
                  </td>
                  <td className="py-3"><StaffStatusManager userId={p.id} status={p.status ?? "active"} /></td>
                </tr>
                {p.status_reason && (
                  <tr key={`${p.id}-reason`}>
                    <td colSpan={9} className="pb-2 text-xs text-surface-500">
                      <strong>{t("br_reason_label", lang)}</strong> {p.status_reason}
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