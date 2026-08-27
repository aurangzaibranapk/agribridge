import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { SettingRow } from "@/app/admin/settings/setting-row";

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
  const supabase = createClient();
  const { data: settings } = await supabase.from("website_settings").select("*").order("key");

  return (
    <div>
      <PageHeader title="Website Settings" description="Site-wide values used across the public pages" />
      <div className="max-w-2xl space-y-3">
        {(settings ?? []).map((s) => (
          <SettingRow key={s.key} settingKey={s.key} label={LABELS[s.key] ?? s.key} value={typeof s.value === "string" ? s.value : JSON.stringify(s.value)} />
        ))}
      </div>
    </div>
  );
}
