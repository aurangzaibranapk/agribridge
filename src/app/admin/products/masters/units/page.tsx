import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { t } from "@/lib/i18n/translations";
import { MastersTabs } from "@/components/products/masters-tabs";
import { loadUnits } from "@/lib/units";
import { createServiceClient } from "@/lib/supabase/service";
import { UnitForm, UnitRowActions } from "./unit-form";

export const dynamic = "force-dynamic";

/** Product Masters > Units (273): ikai, qisam, base/factor, aliases. */
export default async function UnitsMasterPage() {
  const lang = getLanguageFromCookies("rm");
  const units = await loadUnits(false);
  const service = createServiceClient();
  const { data: usage } = await service.from("products").select("unit_code").eq("is_deleted", false).not("unit_code" as never, "is", null);
  const counts = new Map<string, number>();
  for (const r of (usage ?? []) as any[]) counts.set(r.unit_code, (counts.get(r.unit_code) ?? 0) + 1);
  const { count: noUnit } = await service.from("products").select("id", { count: "exact", head: true }).eq("is_deleted", false).is("unit_code" as never, null);

  return (
    <div>
      <PageHeader title={t("at_units", lang)} description={t("un_desc", lang)} />
      <MastersTabs current="units" lang={lang} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-2 lg:col-span-2">
          <p className="text-xs text-surface-500">
            {t("un_no_unit", lang)}: <strong className="tabular-nums">{noUnit ?? "—"}</strong>
          </p>
          {units.map((u) => (
            <Card key={u.code} className={u.is_active ? "" : "opacity-60"}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-surface-400">{u.code}</span>
                <span className="font-medium">{u.label}</span>
                <Badge tone="gray">{u.kind}</Badge>
                {u.base_code && u.factor != null && <Badge tone="blue">1 {u.code} = {u.factor} {u.base_code}</Badge>}
                {!u.is_active && <Badge tone="amber">off</Badge>}
                <span className="ml-auto text-xs text-surface-500 tabular-nums">{counts.get(u.code) ?? 0} products</span>
              </div>
              {u.aliases.length > 0 && <p className="mt-1 text-xs text-surface-500">{t("un_aliases", lang)}: {u.aliases.join(", ")}</p>}
              <div className="mt-2 flex flex-wrap items-start justify-between gap-2">
                <UnitForm lang={lang} unit={u} units={units} />
                <UnitRowActions lang={lang} unit={u} />
              </div>
            </Card>
          ))}
        </div>
        <Card>
          <h2 className="mb-2 text-sm font-semibold">{t("un_new", lang)}</h2>
          <UnitForm lang={lang} units={units} />
          <p className="mt-3 text-[11px] text-surface-500">{t("un_alias_note", lang)}</p>
        </Card>
      </div>
    </div>
  );
}
