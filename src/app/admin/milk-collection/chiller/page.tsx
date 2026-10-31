import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { createClient } from "@/lib/supabase/server";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { signedLrUrl, NO_ROUTE } from "@/lib/milk-collection";
import { karachiShift } from "@/lib/dairy/rules";
import { loadHandoverDay } from "@/lib/milk-handover-page";
import { phoneReferenceTs, phoneSnfConstant } from "@/lib/milk-phone-lab";
import { HandoverDaySummary } from "../handover/day-summary";
import { ChillerClient, type RouteGroup, type PendingEntry } from "./chiller-client";
import { ChillerTotalForm } from "./total-form";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"];
const PICK_BRANCH = ["owner", "super_admin", "admin"];

function missingTotals(message: string): boolean {
  return /milk_chiller_totals|schema cache|does not exist/i.test(message);
}

export default async function ChillerPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; shift?: string; branch?: string }>;
}) {
  const params = await searchParams;
  const supabase = createClient();
  const lang = getLanguageFromCookies("rm");

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: me } = user
    ? await supabase.from("profiles").select("role, is_active, branch_id").eq("id", user.id).maybeSingle()
    : { data: null };

  if (!me?.is_active || !ALLOWED_ROLES.includes(me.role)) {
    return <div className="p-8 text-center text-surface-400">{t("ch_only_chiller", lang)}</div>;
  }

  const date = params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date) ? params.date : aajKaKhana();
  const shift = params.shift === "evening" || params.shift === "morning" ? params.shift : karachiShift();
  const canManage = ["owner", "super_admin", "admin", "manager"].includes(me.role);
  const canPick = PICK_BRANCH.includes(me.role);

  const [{ data: branchRows }, { data: rate }] = await Promise.all([
    supabase.from("branches").select("id, name, is_main_branch").order("is_main_branch", { ascending: false }).order("name"),
    supabase.from("milk_rate_settings").select("snf_constant, reference_ts").limit(1).maybeSingle(),
  ]);
  const branches = branchRows ?? [];
  const requested = params.branch && /^[0-9a-f-]{36}$/i.test(params.branch) ? params.branch : null;
  const branchId = canPick
    ? requested ?? me.branch_id ?? branches.find((row) => row.is_main_branch)?.id ?? branches[0]?.id ?? null
    : me.branch_id;
  const branch = branches.find((row) => row.id === branchId) ?? null;

  const snfConstant = phoneSnfConstant(rate?.snf_constant == null ? null : Number(rate.snf_constant));
  const referenceTs = phoneReferenceTs(rate?.reference_ts == null ? null : Number(rate.reference_ts));

  let totalsReady = true;
  let saved: {
    chiller_no: string;
    gross_liters: number;
    fat_percentage: number;
    lr: number;
  } | null = null;
  if (branchId) {
    const tot = await supabase
      .from("milk_chiller_totals")
      .select("chiller_no, gross_liters, fat_percentage, lr")
      .eq("branch_id", branchId)
      .eq("entry_date", date)
      .eq("shift", shift)
      .maybeSingle();
    if (tot.error && missingTotals(tot.error.message)) totalsReady = false;
    else if (tot.data) {
      saved = {
        chiller_no: tot.data.chiller_no,
        gross_liters: Number(tot.data.gross_liters),
        fat_percentage: Number(tot.data.fat_percentage),
        lr: Number(tot.data.lr),
      };
    }
  }

  const day = branchId
    ? await loadHandoverDay({ date, branchId })
    : null;

  const [{ data: entries }, { data: receipts }] = await Promise.all([
    supabase
      .from("milk_entries")
      .select("id, collection_number, quantity_liters, lr, status, entry_channel, collection_source, route_name, lr_image_path, flags, possible_duplicate_of, duplicate_cleared_at, farmers(full_name, farmer_code)")
      .eq("entry_date", date)
      .eq("shift", shift)
      .neq("status", "rejected")
      .order("created_at"),
    supabase
      .from("milk_route_collections")
      .select("route_name, chiller_received_volume, shortage_liters, is_red_alert")
      .eq("collection_date", date)
      .eq("shift", shift),
  ]);

  const groups = new Map<string, RouteGroup>();
  let pendingCount = 0;
  let totalLiters = 0;
  let selfDeliveryLiters = 0;
  let selfDeliveryCount = 0;

  for (const row of entries ?? []) {
    const liters = Number(row.quantity_liters);
    totalLiters += liters;
    if (row.collection_source === "self_delivery") {
      selfDeliveryLiters += liters;
      selfDeliveryCount += 1;
      continue;
    }
    const route = row.route_name ?? NO_ROUTE;
    let group = groups.get(route);
    if (!group) {
      const receipt = (receipts ?? []).find((r) => r.route_name === route);
      group = {
        route,
        entries: [],
        liters: 0,
        received: receipt?.chiller_received_volume == null ? null : Number(receipt.chiller_received_volume),
        shortageLiters: receipt?.shortage_liters == null ? null : Number(receipt.shortage_liters),
        redAlert: receipt?.is_red_alert ?? false,
      };
      groups.set(route, group);
    }
    group.liters += liters;
    if (row.status !== "pending_fat") continue;
    pendingCount += 1;
    const farmer = Array.isArray(row.farmers) ? row.farmers[0] : row.farmers;
    const entry: PendingEntry = {
      id: row.id,
      collection_number: row.collection_number ?? "—",
      farmer_label: `${farmer?.farmer_code ?? "—"} — ${farmer?.full_name ?? "—"}`,
      liters,
      lr: row.lr == null ? null : Number(row.lr),
      channel: row.entry_channel,
      collectionSource: row.collection_source,
      lr_url: await signedLrUrl(row.lr_image_path),
      flags: Array.isArray(row.flags) ? (row.flags as string[]) : [],
      needsDuplicateClear: Boolean(row.possible_duplicate_of) && !row.duplicate_cleared_at,
      canManage,
    };
    group.entries.push(entry);
  }

  const list = [...groups.values()].sort((a, b) => a.route.localeCompare(b.route));
  const q = `date=${date}${branchId ? `&branch=${branchId}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader title={t("mk_chiller_title", lang)} description={t("mk_chiller_subtitle", lang)} />

      <Card className="p-3">
        <form className="flex flex-wrap items-end gap-3" method="get">
          {canPick && (
            <div>
              <label className="text-xs text-surface-500">{t("ct_branch", lang)}</label>
              <select name="branch" defaultValue={branchId ?? ""} className="mt-1 rounded-lg border border-surface-200 p-2 text-sm">
                {branches.map((row) => (
                  <option key={row.id} value={row.id}>{row.name}</option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="text-xs text-surface-500">{t("c_date", lang)}</label>
            <input name="date" type="date" defaultValue={date} className="mt-1 rounded-lg border border-surface-200 p-2 text-sm" />
          </div>
          <div>
            <label className="text-xs text-surface-500">{t("ch_shift", lang)}</label>
            <select name="shift" defaultValue={shift} className="mt-1 rounded-lg border border-surface-200 p-2 text-sm">
              <option value="morning">{t("mk_morning", lang)}</option>
              <option value="evening">{t("mk_evening", lang)}</option>
            </select>
          </div>
          <button type="submit" className="rounded-lg border border-surface-300 px-3 py-2 text-sm">{t("ch_show", lang)}</button>
        </form>
      </Card>

      {!branchId || !branch ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{t("ct_no_branch", lang)}</p>
      ) : (
        <>
          <p className="text-xs text-surface-500">{t("ct_shift_note", lang)}</p>
          {day && <HandoverDaySummary lang={lang} date={date} summary={day.summary} />}
          {day?.intakeSource === "legacy" && <p className="text-sm text-amber-800">{t("ct_migration", lang)}</p>}
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href={`/admin/milk-collection/handover?date=${date}`} className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white">{t("ct_link_summary", lang)}</Link>
            <Link href={`/admin/milk-collection/handover/company/new?${q}`} className="rounded-lg border border-surface-300 px-3 py-2">{t("ct_link_company", lang)}</Link>
            <Link href={`/admin/milk-collection/handover/vendor/new?${q}`} className="rounded-lg border border-surface-300 px-3 py-2">{t("ct_link_vendor", lang)}</Link>
            <Link href={`/admin/milk-collection/handover/party/new?${q}`} className="rounded-lg border border-surface-300 px-3 py-2">{t("ct_link_party", lang)}</Link>
          </div>
          <Card className="p-4">
            <ChillerTotalForm
              lang={lang}
              branchId={branch.id}
              date={date}
              shift={shift}
              chillerNo={(saved?.chiller_no || branch.name).slice(0, 40)}
              grossL={saved ? String(saved.gross_liters) : ""}
              fat={saved ? String(saved.fat_percentage) : ""}
              lr={saved ? String(saved.lr) : ""}
              snfConstant={snfConstant}
              referenceTs={referenceTs}
              ready={totalsReady}
            />
          </Card>
        </>
      )}

      <details className="rounded-lg border border-surface-200 bg-white p-3">
        <summary className="cursor-pointer text-sm font-medium text-surface-700">{t("ct_farmer_lines", lang)}</summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card className="p-4">
              <p className="text-xs text-surface-500">{t("ch_mca_milk", lang)}</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
                {Math.round((totalLiters - selfDeliveryLiters) * 10) / 10} L
              </p>
              <p className="text-xs text-surface-400">{list.length} route</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-surface-500">{t("ch_farmer_brought", lang)}</p>
              <p className="mt-1 text-2xl font-semibold text-surface-900 dark:text-white">
                {Math.round(selfDeliveryLiters * 10) / 10} L
              </p>
              <p className="text-xs text-surface-400">{selfDeliveryCount} entries</p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-surface-500">{t("ch_total_received", lang)}</p>
              <p className="mt-1 text-2xl font-semibold text-brand-700 dark:text-brand-400">
                {Math.round(totalLiters * 10) / 10} L
              </p>
            </Card>
            <Card className="p-4">
              <p className="text-xs text-surface-500">{t("ch_waiting_fat", lang)}</p>
              <p className="mt-1 text-2xl font-semibold text-amber-600">{pendingCount}</p>
            </Card>
          </div>
          <p className="px-1 text-xs text-surface-400">
            Neeche ke route sirf MCA ka doodh dikhate hain. Jo kisan khud le kar aaye, wo kisi MCA ke trip
            mein nahi ginta — warna us ka nuqsan aur karkardagi dono ghalat nikalte. Din ka aaya in qatarein se nahi banta.
          </p>
          <div className="flex justify-end">
            <Link href="/admin/milk-collection/verify" className="rounded-lg border border-surface-300 px-3 py-2 text-sm">{t("ch_manager_verify", lang)}</Link>
          </div>
          <ChillerClient groups={list} date={date} shift={shift} />
        </div>
      </details>
    </div>
  );
}
