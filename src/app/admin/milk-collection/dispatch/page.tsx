import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { parseDestination } from "@/lib/milk-handover";
import Link from "next/link";
import { DispatchClient } from "./dispatch-client";

export const dynamic = "force-dynamic";

/**
 * Doodh ki rawangi -- chiller se company tak.
 *
 * Doodh ka safar teen qadam ka hai: kisan -> gaari -> chiller ->
 * company. Pehle do pehle se darj hote the (Route & Shortage wala
 * safha); teesra kahin nahi hota tha.
 *
 * Aur wohi sab se ahem hai: AgriBridge doodh bechta nahi, jama karta hai
 * aur company ko deta hai FI LITRE service rate par. Yani kamai us adad
 * par hai jo COMPANY ne mana ke usay mila -- hamare apne adad par nahi.
 */
export default async function MilkDispatchPage() {
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const [{ data: branches }, dispatchRes, { data: auth }] = await Promise.all([
    supabase.from("branches").select("id, name").eq("is_active", true).order("name"),
    supabase
      .from("milk_dispatches")
      .select("id, dispatch_date, shift, branch_id, vehicle_name, driver_name, dispatched_liters, received_liters, shortage_liters, shortage_percentage, notes, created_by, received_by, destination, party_id, branches(name)")
      .order("dispatch_date", { ascending: false })
      .order("shift")
      .limit(60),
    supabase.auth.getUser(),
  ]);
  let rows = dispatchRes.data;
  let destReady = !dispatchRes.error;
  if (dispatchRes.error && /destination|party_id/i.test(dispatchRes.error.message)) {
    destReady = false;
    const again = await supabase
      .from("milk_dispatches")
      .select("id, dispatch_date, shift, branch_id, vehicle_name, driver_name, dispatched_liters, received_liters, shortage_liters, shortage_percentage, notes, created_by, received_by, branches(name)")
      .order("dispatch_date", { ascending: false })
      .order("shift")
      .limit(60);
    rows = again.data as typeof rows;
  }
  const partyIds = destReady ? [...new Set((rows ?? []).map((row) => row.party_id).filter((id): id is string => !!id))] : [];
  const { data: partyRows } = partyIds.length
    ? await supabase.from("milk_handover_parties").select("id, name").in("id", partyIds)
    : { data: [] as { id: string; name: string }[] };
  const partyNames = new Map((partyRows ?? []).map((party) => [party.id, party.name]));
  const { data: me } = auth.user
    ? await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle()
    : { data: null };
  const canCorrect = me?.role === "owner" || me?.role === "super_admin";

  return (
    <div>
      <PageHeader
        title={t("mdp_title", lang)}
        description={t("md_subtitle", lang)}
        actions={
          <Link href="/admin/milk-collection/handover" className="text-sm text-brand-700 underline">
            {t("mh_title", lang)}
          </Link>
        }
      />
      <DispatchClient
        lang={lang}
        branches={(branches ?? []).map((b) => ({ id: b.id, name: b.name }))}
        canCorrect={canCorrect}
        userId={auth.user?.id ?? null}
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
          createdBy: r.created_by ?? null,
          receivedBy: r.received_by ?? null,
          destinationLabel: !destReady ? "" : r.destination === "party"
            ? `${t("mh_flow_party", lang)}${r.party_id && partyNames.get(r.party_id) ? `: ${partyNames.get(r.party_id)}` : ""}`
            : parseDestination(r.destination) === "vendor"
              ? t("mh_flow_vendor", lang)
              : t("mh_flow_company", lang),
        }))}
      />
    </div>
  );
}
