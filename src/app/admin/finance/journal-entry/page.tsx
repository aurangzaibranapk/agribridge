import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { JournalEntryForm } from "./jv-form";

export const dynamic = "force-dynamic";

const ROLES = ["owner", "super_admin", "admin", "finance"];

/**
 * Haath se journal entry.
 *
 * Ye safha rozana ka nahi hai -- aur usay rozana ka bana dena is nizam
 * ka sab se bara khatra hoga. Har waqia apni jagah se KHUD entry banata
 * hai; yahan sirf wo cheezein aati hain jin ka koi safha hai hi nahi:
 * malik ka sarmaya, bank ka munafa, purane khaton ka opening balance.
 */
export default async function JournalEntryPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle()
    : { data: null };
  if (!me?.is_active || !ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("je_only_finance", lang)}</div>;
  }

  const service = createServiceClient();
  const { data: accounts } = await service
    .from("gl_accounts")
    .select("code, name, account_type")
    .eq("is_active", true)
    .order("sort_order");

  return (
    <div className="space-y-4">
      <PageHeader title={t("je_title", lang)} description={t("je_desc", lang)} />
      <JournalEntryForm lang={lang} accounts={accounts ?? []} />
    </div>
  );
}
