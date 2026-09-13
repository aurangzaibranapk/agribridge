import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { MastersTabs } from "@/components/products/masters-tabs";
import { loadUnits, loadPackSizes } from "@/lib/units";
import { PackSizeForm, PackSizeDelete } from "./pack-size-form";

export const dynamic = "force-dynamic";

/** Product Masters > Pack Sizes (273): 5L, 20kg... aliases ke sath. */
export default async function PackSizesMasterPage() {
  const lang = getLanguageFromCookies("rm");
  const [units, packs] = await Promise.all([loadUnits(true), loadPackSizes(false)]);
  return (
    <div>
      <PageHeader title={t("at_pack_sizes", lang)} description={t("ps_desc", lang)} />
      <MastersTabs current="pack_sizes" lang={lang} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          {packs.map((p) => (
            <Card key={p.id} className={p.is_active ? "" : "opacity-60"}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{p.label}</span>
                {p.unit_code && <Badge tone="gray">{p.quantity ?? "?"} {p.unit_code}</Badge>}
                {!p.is_active && <Badge tone="amber">off</Badge>}
              </div>
              {p.aliases.length > 0 && <p className="mt-1 text-xs text-surface-500">{t("un_aliases", lang)}: {p.aliases.join(", ")}</p>}
              <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                <PackSizeForm lang={lang} pack={p} units={units} />
                <PackSizeDelete lang={lang} id={p.id} />
              </div>
            </Card>
          ))}
          {packs.length === 0 && <Card><p className="text-sm text-surface-500">—</p></Card>}
        </div>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">{t("ps_new", lang)}</h2>
          <PackSizeForm lang={lang} units={units} />
          <p className="mt-3 text-[11px] text-surface-500">{t("ps_alias_note", lang)}</p>
        </Card>
      </div>
    </div>
  );
}
