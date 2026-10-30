import Link from "next/link";
import { aajKaKhana } from "@/lib/utils/format";
import { PageHeader } from "@/components/ui/layout-primitives";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { HandoverForm } from "./handover-form";
import { handoverGate, loadCertificate, loadHandoverOptions, type LoadedCertificate } from "@/lib/milk-handover-page";

export async function HandoverEditor({
  id,
  saved,
  dateHint,
}: {
  id?: string;
  saved?: boolean;
  dateHint?: string;
}) {
  const lang = getLanguageFromCookies("rm");
  const gate = await handoverGate(id ? "edit" : "create");
  if ("error" in gate) {
    return <p className="p-8 text-center text-sm text-surface-500">{gate.error}</p>;
  }
  if (!gate.canWrite && !id) {
    return <p className="p-8 text-center text-sm text-surface-500">Certificate likhne ki ijazat nahi.</p>;
  }

  const options = await loadHandoverOptions();
  if (options.migrationError) {
    return <p className="p-8 text-center text-sm text-surface-600">{options.migrationError}</p>;
  }

  let loaded: LoadedCertificate | null = null;
  if (id) {
    const row = await loadCertificate(id);
    if ("error" in row) return <p className="p-8 text-center text-sm text-surface-600">{row.error}</p>;
    if ("missing" in row) return <p className="p-8 text-center text-sm text-surface-500">Ye certificate nahi mila.</p>;
    if (gate.branchId && (gate.role === "manager" || gate.role === "milk_collection") && row.branchId !== gate.branchId) {
      return <p className="p-8 text-center text-sm text-surface-500">Ye aapki branch ki rawangi nahi.</p>;
    }
    loaded = row;
  }

  const scoped = gate.branchId && (gate.role === "manager" || gate.role === "milk_collection");
  const branches = scoped ? options.branches.filter((b) => b.id === gate.branchId) : options.branches;
  const branchList = branches.length > 0 ? branches : options.branches;
  const shops = scoped ? options.shops.filter((s) => !s.branchId || s.branchId === gate.branchId) : options.shops;

  const defaults = loaded
    ? {
        branchId: loaded.branchId,
        shopId: loaded.shopId,
        date: loaded.date,
        shift: loaded.shift,
        time: loaded.time,
        mccName: loaded.mccName,
        vehicle: loaded.vehicle,
        driver: loaded.driver,
        notes: loaded.notes,
        accepted: loaded.accepted,
        rejectionReason: loaded.rejectionReason,
        licenseeRep: loaded.licenseeRep,
        licenseeSignature: loaded.licenseeSignature,
        collectorSignature: loaded.collectorSignature,
        lines: loaded.lines,
      }
    : {
        branchId: gate.branchId && branchList.some((b) => b.id === gate.branchId) ? gate.branchId : "",
        shopId: "",
        date: dateHint && /^\d{4}-\d{2}-\d{2}$/.test(dateHint) ? dateHint : aajKaKhana(),
        shift: "morning",
        time: "",
        mccName: "",
        vehicle: "",
        driver: "",
        notes: "",
        accepted: "" as const,
        rejectionReason: "",
        licenseeRep: "",
        licenseeSignature: "",
        collectorSignature: "",
        lines: [],
      };

  return (
    <div>
      <PageHeader
        title={t("mh_title", lang)}
        description={t("mh_subtitle", lang)}
        actions={
          <div className="flex gap-3 text-sm">
            <Link href="/admin/milk-collection/handover" className="text-brand-700 underline">{t("mh_list", lang)}</Link>
            {id && (
              <Link href={`/admin/milk-collection/handover/${id}/print`} className="text-brand-700 underline">{t("mh_print", lang)}</Link>
            )}
            <Link href="/admin/milk-collection/dispatch" className="text-brand-700 underline">{t("mh_dispatch", lang)}</Link>
          </div>
        }
      />
      <p className="mb-3 text-sm text-surface-500">{t("mh_backfill", lang)}</p>
      {saved && <p className="mb-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">{t("mh_saved", lang)}</p>}
      <HandoverForm
        lang={lang}
        branches={branchList}
        shops={shops}
        specs={options.specs}
        formula={options.formula}
        myName={gate.myName}
        locked={loaded?.locked ?? false}
        priorGross={loaded?.priorGross ?? null}
        hadLines={loaded?.hadLines ?? true}
        dispatchId={loaded?.id ?? null}
        defaults={defaults}
      />
    </div>
  );
}
