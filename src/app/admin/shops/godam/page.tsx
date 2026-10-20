import Link from "next/link";
import { requireAction } from "@/lib/access/guard";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
import { linkableGodams, type GodamWarehouse } from "@/lib/pos/godam-on-card";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/layout-primitives";
import { ShopGodamForm } from "./godam-form";
import { ShopCategoriesForm, type CatView } from "./categories-form";
import { effectiveChecked, splitTree, type AllowedRow, type CategoryNode } from "@/lib/shops/allowed-categories";

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
    .select("id, name, code, branch_id, business_type, branches(name)")
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

  // ---- 686: har dukan ko HQ godam ki kaunsi qism dikhe ----
  const { data: rawCats } = await supabase.from("categories").select("id, name, parent_category_id");
  const { data: rawProds } = await supabase.from("products").select("category_id").eq("is_deleted", false);
  const { data: allowedRows, error: allowedErr } = await (supabase as any)
    .from("shop_allowed_categories")
    .select("shop_id, category_id, include");
  const catNodes = (rawCats ?? []) as CategoryNode[];
  const perCat = new Map<string, number>();
  for (const p of (rawProds ?? []) as { category_id: string | null }[]) {
    if (p.category_id) perCat.set(p.category_id, (perCat.get(p.category_id) ?? 0) + 1);
  }
  const tree = splitTree(catNodes);
  const catViews: CatView[] = tree.tops
    .map((c) => {
      const subs = (tree.subsOf.get(c.id) ?? []).map((x) => ({ id: x.id, name: x.name, count: perCat.get(x.id) ?? 0 }));
      return { id: c.id, name: c.name, subs, count: (perCat.get(c.id) ?? 0) + subs.reduce((a, x) => a + x.count, 0) };
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

  const shops = (rawShops ?? []).map((s: any) => ({
    id: s.id as string,
    name: s.name as string,
    code: (s.code as string | null) ?? "",
    branch: (Array.isArray(s.branches) ? s.branches[0]?.name : s.branches?.name) ?? "",
    businessType: (s.business_type as string | null) ?? "",
  }));
  const selected = shops.find((s) => s.id === searchParams.shop) ?? null;

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={t("dgod_title", lang)}
        description={`${t("dgod_blurb", lang)} ${t("dgod_hq", lang)}`}
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

          <section className="mt-8" data-testid="shop-categories-section">
            <h2 className="font-display text-lg font-semibold text-surface-900 dark:text-white">{t("dgcat_title", lang)}</h2>
            <p className="mb-4 text-sm text-surface-600 dark:text-surface-300">{t("dgcat_blurb", lang)}</p>
            {allowedErr ? (
              <p className="rounded-lg border border-amber-200 bg-[#fff7e6] px-3 py-2 text-sm text-amber-950 dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
                {t("dgcat_no_table", lang)}
              </p>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {shops.map((s) => {
                    const rows = ((allowedRows ?? []) as (AllowedRow & { shop_id: string })[]).filter((r) => r.shop_id === s.id);
                    return (
                      <ShopCategoriesForm
                        key={s.id}
                        lang={lang}
                        shopId={s.id}
                        shopName={s.name}
                        businessType={s.businessType}
                        linkedHq={(linkRows ?? []).some((r) => r.shop_id === s.id)}
                        cats={catViews}
                        checked={Array.from(effectiveChecked(catNodes, rows))}
                        canEdit={gate.caller.unrestricted}
                      />
                    );
                  })}
                </div>
                <p className="mt-4 rounded-xl border border-dashed border-brand-300 bg-white px-4 py-3 text-xs text-brand-800 dark:border-white/20 dark:bg-white/5 dark:text-brand-100">
                  {t("dgcat_note", lang)}
                </p>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
