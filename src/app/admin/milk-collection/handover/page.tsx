import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { handoverGate, loadHandoverDay } from "@/lib/milk-handover-page";
import { HandoverDaySummary } from "./day-summary";
import { HandoverTabs } from "./tabs";

export const dynamic = "force-dynamic";

export default async function MilkHandoverSummary({ searchParams }: { searchParams?: { date?: string } }) {
  const lang = getLanguageFromCookies("rm");
  const gate = await handoverGate("view");
  if ("error" in gate) return <p className="p-8 text-center text-sm text-surface-500">{gate.error}</p>;

  const date = searchParams?.date && /^\d{4}-\d{2}-\d{2}$/.test(searchParams.date) ? searchParams.date : aajKaKhana();
  const branchId = gate.branchId && (gate.role === "manager" || gate.role === "milk_collection") ? gate.branchId : null;
  const day = await loadHandoverDay({ date, branchId });

  return (
    <div>
      <PageHeader
        title={t("mh_title", lang)}
        description={t("mh_sub_summary", lang)}
        actions={
          <Link href="/admin/milk-collection/dispatch" className="self-center text-sm text-brand-700 underline">{t("mh_dispatch", lang)}</Link>
        }
      />
      <HandoverTabs lang={lang} current="summary" date={date} />
      {!day.ready && <p className="mb-3 text-sm text-amber-800">{t("mh_migration_729", lang)}</p>}
      <Card className="mb-3">
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-sm">
            Date
            <input type="date" name="date" defaultValue={date} className="ml-2 h-10 rounded-lg border border-surface-200 px-2" />
          </label>
          <button type="submit" className="h-10 rounded-lg border border-surface-200 px-3 text-sm">Dekhein</button>
        </form>
      </Card>
      {day.error && <p className="mb-3 text-sm text-surface-600">{day.error}</p>}
      <HandoverDaySummary lang={lang} date={date} summary={day.summary} />
      {gate.canWrite && (
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href={`/admin/milk-collection/handover/company/new?date=${date}`} className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white">{t("mh_new_company", lang)}</Link>
          <Link href={`/admin/milk-collection/handover/vendor/new?date=${date}`} className="rounded-lg border border-surface-300 px-3 py-2 font-medium">{t("mh_new_vendor", lang)}</Link>
          <Link href={`/admin/milk-collection/handover/party/new?date=${date}`} className="rounded-lg border border-surface-300 px-3 py-2 font-medium">{t("mh_new_party", lang)}</Link>
        </div>
      )}
    </div>
  );
}
