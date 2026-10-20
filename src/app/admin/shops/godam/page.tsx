import Link from "next/link";
import { requireAction } from "@/lib/access/guard";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { linkableGodams, type GodamWarehouse } from "@/lib/pos/godam-on-card";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ShopGodamForm } from "./godam-form";

export const dynamic = "force-dynamic";

export default async function ShopGodamPage({
  searchParams,
}: {
  searchParams: { shop?: string };
}) {
  const lang = getLanguageFromCookies("rm");
  const gate = await requireAction("shops.godam", "view");
  if ("error" in gate || !gate.caller.unrestricted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <p className="text-surface-600 dark:text-surface-300">{t("dgod_admin_only", lang)}</p>
      </div>
    );
  }

  const supabase = createClient();
  const { data: rawShops } = await supabase
    .from("shops")
    .select("id, name, code, branch_id, branches(name)")
    .order("name");
  const { data: rawWh } = await supabase
    .from("warehouses")
    .select("id, name, code, shop_id, is_quarantine, is_active, branch_id, branches(name)")
    .order("name");

  const { data: linkRows, error: linkErr } = await (supabase as unknown as {
    from: (table: string) => {
      select: (cols: string) => Promise<{ data: { shop_id: string; warehouse_id: string }[] | null; error: { message: string } | null }>;
    };
  })
    .from("shop_godams")
    .select("shop_id, warehouse_id");

  const shops = (rawShops ?? []).map((s: any) => ({
    id: s.id as string,
    name: s.name as string,
    code: (s.code as string | null) ?? "",
    branch: (Array.isArray(s.branches) ? s.branches[0]?.name : s.branches?.name) ?? "",
  }));
  const selected = shops.find((s) => s.id === searchParams.shop) ?? null;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={t("dgod_title", lang)}
        description={t("dgod_blurb", lang)}
        actions={
          <Link href="/admin/shops" className="rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-700 hover:bg-surface-50 dark:border-white/10 dark:text-surface-200 dark:hover:bg-white/5">
            {t("at_shops", lang)}
          </Link>
        }
      />

      {linkErr ? (
        <p className="rounded-lg border border-amber-200 bg-[#fff7e6] px-3 py-2 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
          Link abhi database par nahi. Migration 675 pehle Testing par chale, phir yahan godam judein.
        </p>
      ) : (
        <>
          <form method="get" action="/admin/shops/godam" className="mb-6 flex flex-wrap items-end gap-3">
            <label className="block text-sm">
              <span className="mb-1 block text-surface-600 dark:text-surface-300">{t("dgod_pick", lang)}</span>
              <select
                name="shop"
                defaultValue={selected?.id ?? ""}
                className="min-w-64 rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-[#101f42] dark:text-white"
              >
                <option value="">{t("dgod_pick", lang)}</option>
                {shops.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.branch ? ` — ${s.branch}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="rounded-lg border border-surface-200 px-3 py-2 text-sm dark:border-white/10 dark:text-white">
              {t("at_show", lang)}
            </button>
          </form>

          {selected && (
            <section className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-white/10 dark:bg-[#101f42]/80">
              <h2 className="mb-1 font-display text-lg font-semibold text-surface-900 dark:text-white">{selected.name}</h2>
              <p className="mb-4 text-xs text-surface-500 dark:text-surface-400">
                {[selected.code, selected.branch].filter(Boolean).join(" · ")}
              </p>
              <ShopGodamForm
                lang={lang}
                shopId={selected.id}
                linkedIds={(linkRows ?? []).filter((r) => r.shop_id === selected.id).map((r) => r.warehouse_id)}
                warehouses={linkableGodams((rawWh ?? []) as GodamWarehouse[]).map((w: any) => ({
                  id: w.id as string,
                  name: (w.name as string) || "Godam",
                  detail: [w.code, Array.isArray(w.branches) ? w.branches[0]?.name : w.branches?.name].filter(Boolean).join(" · "),
                }))}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}
