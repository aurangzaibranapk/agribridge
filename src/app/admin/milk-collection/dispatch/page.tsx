import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { DispatchClient } from "./dispatch-client";

export const dynamic = "force-dynamic";

/**
 * Doodh ki rawangi -- chiller se company tak.
 *
 * Doodh ka safar teen qadam ka hai: kisan -> gaari -> chiller ->
 * company. Pehle do pehle se darj hote the (Route & Shortage wala
 * safha); teesra kahin nahi hota tha.
 *
 * Aur wohi sab se ahem hai: Al Rana doodh bechta nahi, jama karta hai
 * aur company ko deta hai FI LITRE service rate par. Yani kamai us adad
 * par hai jo COMPANY ne mana ke usay mila -- hamare apne adad par nahi.
 */
export default async function MilkDispatchPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: branches }, { data: rows }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("milk_dispatches")
      .select("id, dispatch_date, shift, branch_id, vehicle_name, driver_name, dispatched_liters, received_liters, shortage_liters, shortage_percentage, notes, branches(name)")
      .order("dispatch_date", { ascending: false })
      .order("shift")
      .limit(60),
  ]);

  return (
    <div>
      <PageHeader title={t("mdp_title", lang)} description={t("md_subtitle", lang)} />
      <DispatchClient
        lang={lang}
        branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))}
        rows={((rows ?? []) as any[]).map((r) => ({
          id: r.id,
          date: r.dispatch_date,
          shift: r.shift,
          chiller: r.branches?.name ?? "—",
          vehicle: r.vehicle_name,
          driver: r.driver_name,
          sent: Number(r.dispatched_liters),
          received: r.received_liters === null ? null : Number(r.received_liters),
          shortage: r.shortage_liters === null ? null : Number(r.shortage_liters),
          shortagePct: r.shortage_percentage === null ? null : Number(r.shortage_percentage),
        }))}
      />
    </div>
  );
}
