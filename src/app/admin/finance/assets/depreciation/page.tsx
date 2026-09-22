import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { ArrowLeft } from "lucide-react";
import { DepreciationClient } from "./dep-client";

export const dynamic = "force-dynamic";

const RUN_ROLES = ["owner", "super_admin", "admin", "finance"];
const VIEW_ROLES = [...RUN_ROLES, "manager"];

/**
 * Har mahine ki ghisai -- do qadam mein.
 *
 * Pehle SIRF HISAAB (draft), phir dekh kar LEDGER. Ye do qadam jaan
 * boojh kar hain: depreciation saal ka sab se bara aisa kharcha hai jis
 * mein ek rupya bhi haath se nahi nikalta, aur usay bina dekhe ledger
 * mein chala dena wohi jagah hai jahan ek ghalat umar ya ghalat rate
 * mahinon tak pakRa nahi jata.
 */
export default async function DepreciationPage({
  searchParams,
}: {
  searchParams: { period?: string };
}) {
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
  const canRun = RUN_ROLES.includes(me.role);

  const aaj = new Date();
  const defaultPeriod = `${aaj.getFullYear()}-${String(aaj.getMonth() + 1).padStart(2, "0")}`;
  const period = searchParams.period ?? defaultPeriod;

  const service = createServiceClient();
  const { data: run, error: runErr } = await service
    .from("asset_depreciation_runs")
    .select("id, period, status, total_amount, computed_at, posted_at, entry_id")
    .eq("period", `${period}-01`)
    .maybeSingle();

  let lines: { asset: string; code: string; months: number; amount: number; opening: number; closing: number }[] = [];
  let lineError: string | null = null;

  if (run) {
    const { data: ls, error: lErr } = await service
      .from("asset_depreciation_lines")
      .select("asset_id, months, amount, opening_book, closing_book")
      .eq("run_id", run.id);
    if (lErr) {
      lineError = lErr.message;
    } else {
      // Naam alag query se. Nested embed yahan khali laut sakta hai aur
      // khali fehrist "koi ghisai nahi bani" keh degi -- jo jhoot hoga.
      const ids = (ls ?? []).map((l) => l.asset_id as string);
      const { data: assets } = ids.length
        ? await service.from("fixed_assets").select("id, code, name").in("id", ids)
        : { data: [] as { id: string; code: string; name: string }[] };
      const byId = new Map((assets ?? []).map((a) => [a.id as string, a]));
      lines = (ls ?? []).map((l) => {
        const a = byId.get(l.asset_id as string);
        return {
          asset: a?.name ?? t("fa_unknown_asset", lang),
          code: a?.code ?? "—",
          months: Number(l.months),
          amount: Number(l.amount),
          opening: Number(l.opening_book),
          closing: Number(l.closing_book),
        };
      });
    }
  }

  const { data: history } = await service
    .from("asset_depreciation_runs")
    .select("id, period, status, total_amount, posted_at")
    .eq("status", "posted")
    .order("period", { ascending: false })
    .limit(12);

  return (
    <div className="space-y-4">
      <PageHeader
        title={t("fa_dep_title", lang)}
        description={t("fa_dep_desc", lang)}
        actions={
          <Link
            href="/admin/finance/assets"
            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <ArrowLeft className="h-4 w-4" /> {t("fa_back_register", lang)}
          </Link>
        }
      />

      <DepreciationClient
        lang={lang}
        canRun={canRun}
        period={period}
        maxPeriod={defaultPeriod}
        run={
          run
            ? {
                id: run.id as string,
                status: run.status as string,
                total: Number(run.total_amount),
                postedAt: (run.posted_at as string | null) ?? null,
              }
            : null
        }
        runError={runErr?.message ?? lineError}
        lines={lines}
        history={(history ?? []).map((h) => ({
          id: h.id as string,
          period: String(h.period),
          total: Number(h.total_amount),
        }))}
      />
    </div>
  );
}
