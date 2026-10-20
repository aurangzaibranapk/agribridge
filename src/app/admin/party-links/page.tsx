import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { loadLinkedParties } from "@/lib/party-links/load";
import { PartyLinksClient } from "./party-links-client";

export const dynamic = "force-dynamic";
const ROLES = ["owner", "super_admin", "admin", "finance"];

/** 621: Customer + supplier ek banda (jaise Yasir Ali: saman leta, diesel deta). */
export default async function PartyLinksPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: me } = user ? await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle() : { data: null };
  if (!me?.is_active || !ROLES.includes(String(me.role))) {
    return <div className="p-8 text-center text-surface-400">{t("pl_only_finance", lang)}</div>;
  }
  const service = createServiceClient();
  const [links, { data: customers }, { data: suppliers }] = await Promise.all([
    loadLinkedParties({ db: service }),
    service.from("customers").select("id, name, phone_number").eq("is_deleted", false).order("name").limit(2000),
    service.from("suppliers").select("id, name, phone_number").order("name").limit(1000),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader title={t("pl_title", lang)} description={t("pl_desc", lang)} />
      <PartyLinksClient
        lang={lang}
        links={links}
        customers={(customers ?? []).map((c: any) => ({ id: c.id, label: c.phone_number ? `${c.name} — ${c.phone_number}` : c.name }))}
        suppliers={(suppliers ?? []).map((s: any) => ({ id: s.id, label: s.phone_number ? `${s.name} — ${s.phone_number}` : s.name }))}
      />
    </div>
  );
}
