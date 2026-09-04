import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { TermsClient } from "./terms-client";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Adaigi ki shartein, aur har supplier ki apni shart.
 *
 * Shart NAYE purchase par lagti hai. Purane bill par jo tareekh likhi
 * ja chuki wo wohi rehti hai -- warna kisi din koi shart badal dega aur
 * purane bill ki tareekh chup chaap aage khisak jayegi.
 */
export default async function PaymentTermsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !VIEW_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("pt_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const [{ data: terms, error }, { data: suppliers }] = await Promise.all([
    service.from("payment_terms").select("*").eq("is_active", true).order("days"),
    service.from("suppliers").select("id, name, payment_term_id").eq("is_active", true).order("name"),
  ]);

  if (error) {
    return (
      <div className="space-y-4">
        <PageHeader title={t("pt_title", lang)} />
        <Card className="border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("pt_load_error", lang)}: {error.message}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("pt_title", lang)}
        description={t("pt_desc", lang)}
        actions={
          <Link
            href="/admin/finance/center"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("pt_back", lang)}
          </Link>
        }
      />

      <TermsClient
        lang={lang}
        canEdit={RUN_ROLES.includes(me.role)}
        terms={(terms ?? []).map((t2) => ({
          id: t2.id as string,
          name: t2.name as string,
          days: Number(t2.days),
          isDefault: t2.is_default as boolean,
        }))}
        suppliers={(suppliers ?? []).map((s) => ({
          id: s.id as string,
          name: s.name as string,
          termId: (s.payment_term_id as string | null) ?? null,
        }))}
      />
    </div>
  );
}
