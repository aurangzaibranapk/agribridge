import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SettingRow } from "@/app/admin/settings/setting-row";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { addressNeedsOwner, unwrapWebsiteSetting } from "@/lib/cms/website-setting";

export const dynamic = "force-dynamic";

const LABELS: Record<string, string> = {
  site_name: "Site Name",
  contact_email: "Contact Email",
  contact_phone: "Contact Phone",
  contact_address: "Contact Address",
  business_hours: "Business Hours",
  google_maps_embed_url: "Google Maps Embed URL",
  seo_default_title: "Default SEO Title",
  seo_default_description: "Default SEO Description",
  stats_cities_served: "Homepage Stat — Cities We Serve",
  stats_partner_brands: "Homepage Stat — Partner Brands",
  stats_years_of_trust: "Homepage Stat — Years of Trust",
};

export default async function AdminSettingsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: settings } = await supabase.from("website_settings").select("*").order("key");

  return (
    <div>
      <PageHeader title={t("at_website_settings", lang)} description="Site-wide values used across the public pages" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href="/admin/settings/credit-policy" className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">Udhaar Policy (purane baqaye ki rok)</Link>
        <Link href="/admin/receivable-reminders/overrides" className="rounded-lg border border-surface-200 px-3 py-2 text-sm">Udhaar Override Log</Link>
      </div>
      <div className="max-w-2xl space-y-3">
        {(settings ?? []).map((s) => {
          const shown = unwrapWebsiteSetting(s.value);
          const addressFlag = s.key === "contact_address" && addressNeedsOwner(shown);
          return (
            <div key={s.key}>
              <SettingRow settingKey={s.key} label={LABELS[s.key] ?? s.key} value={shown} />
              {addressFlag && (
                <p className="mt-1 text-xs font-medium text-amber-700">Pata abhi placeholder hai. Asal pata owner dega — yahan khud se nahi bhara gaya.</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
