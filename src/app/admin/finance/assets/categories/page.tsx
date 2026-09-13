import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { CategoryClient } from "./cat-client";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Asaason ki qismein.
 *
 * Har qism apne teen khate rakhti hai: asaasa kis khate mein charhta
 * hai, us ki jama shuda ghisai kahan jama hoti hai, aur mahine ka
 * kharcha kis khate mein jata hai. Ye faisla YAHAN ek dafa hota hai --
 * har naye asaase par dobara nahi.
 */
export default async function AssetCategoriesPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !VIEW_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("fa_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const [{ data: cats, error }, { data: accounts }, { data: counts }] = await Promise.all([
    service.from("asset_categories").select("*").order("name"),
    service.from("gl_accounts").select("code, name, account_type").eq("is_active", true).order("sort_order"),
    service.from("fixed_assets").select("category_id"),
  ]);

  const perCat = new Map<string, number>();
  for (const c of counts ?? []) {
    const k = c.category_id as string;
    perCat.set(k, (perCat.get(k) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("fa_cats_title", lang)}
        description={t("fa_cats_desc", lang)}
        actions={
          <Link
            href="/admin/finance/assets"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("fa_back_register", lang)}
          </Link>
        }
      />

      {error ? (
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("fa_load_error", lang)}: {error.message}
        </Card>
      ) : (
        <CategoryClient
          lang={lang}
          canEdit={RUN_ROLES.includes(me.role)}
          categories={(cats ?? []).map((c) => ({
            id: c.id as string,
            name: c.name as string,
            asset_account: c.asset_account as string,
            accum_account: c.accum_account as string,
            expense_account: c.expense_account as string,
            life: Number(c.default_life_months),
            method: c.default_method as string,
            rate: c.default_rate === null ? null : Number(c.default_rate),
            // "Kitne asaasay" -- jawab na mile to yahan sifar likh dena
            // ghalat hota; count query alag hai aur us ki nakami upar
            // pakRi jati hai.
            used: perCat.get(c.id as string) ?? 0,
          }))}
          accounts={(accounts ?? []).map((a) => ({
            code: a.code as string,
            name: a.name as string,
            type: a.account_type as string,
          }))}
        />
      )}
    </div>
  );
}
