import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Button } from "@/components/ui/form";
import { Package, DollarSign, AlertTriangle, ShoppingCart, Plus } from "lucide-react";
import { DeleteButton } from "@/app/admin/products/delete-button";
import { formatDate } from "@/lib/utils/format";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";
export async function CategoryDashboard({ categoryName, title }: { categoryName: string; title: string }) {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();
  const { data: category } = await supabase
    .from("categories")
    .select("id")
    .eq("name", categoryName)
    .single();
  if (!category) {
    return (
      <div>
        <PageHeader title={title} description={`Products, stock, and sales for ${categoryName}`} />
        <EmptyState title={`"${categoryName}" category not found`} description="Add it from the Categories page first." />
      </div>
    );
  }

  const { data: subCategories } = await supabase
    .from("categories")
    .select("id")
    .eq("parent_category_id", category.id);
  const categoryIds = [category.id, ...(subCategories ?? []).map((c) => c.id)];

  const { data: products } = await supabase
    .from("products")
    .select("id, name, pack_size, selling_price, purchase_price, min_stock_threshold")
    .in("category_id", categoryIds)
    .eq("is_deleted", false);
  const productIds = (products ?? []).map((p) => p.id);
  // Stock aur miyaad DO alag sawal se aate hain, ek nested embed se
  // nahi. Is project mein nested embed nakaam ho kar KHALI lauta deta
  // hai -- aur khali ka matlab yahan "kuch nahi hai" ban jata, jo jhoot
  // hota. Miyaad ke liye batch alag se poochhe ja rahe hain.
  const { data: rawInventory, error: invError } = productIds.length
    ? await supabase.from("inventory").select("product_id, quantity_on_hand, batch_id").in("product_id", productIds)
    : { data: [], error: null };
  const stockByProduct: Record<string, number> = {};
  (rawInventory ?? []).forEach((row: any) => {
    stockByProduct[row.product_id] = (stockByProduct[row.product_id] ?? 0) + Number(row.quantity_on_hand);
  });

  const batchIds = Array.from(new Set((rawInventory ?? []).map((r: any) => r.batch_id).filter(Boolean)));
  const { data: batchRows } = batchIds.length
    ? await supabase.from("stock_batches").select("id, expiry_date").in("id", batchIds)
    : { data: [] as { id: string; expiry_date: string | null }[] };
  const expiryByBatch = new Map((batchRows ?? []).map((b: any) => [b.id as string, b.expiry_date as string | null]));
  // Stock ki qeemat: jo maal is waqt para hai, us ki KHARID ki qeemat
  // par. Bikri ki qeemat par nahi -- wo abhi kamai nahi hui.
  //
  // Malik ne 5 September ko poocha: "stock value ki samajh nahi aa
  // rahi". Adad khud kabhi apna matlab nahi batata, aur is safhe par to
  // bilkul nahi: 146 cheezon mein se sirf 2 par maal para hai, is liye
  // Rs 7,442 dekh kar lagta hai jaise poori dukan itni ki hai.
  //
  // Do baatein us adad ke sath likhni parti hain: ye kitni cheezon ka
  // hai, aur kya koi aisi cheez hai jis ki KHARID KI QEEMAT DARJ HI
  // NAHI -- kyunki us ka maal is jamaa mein sifar ki tarah aata hai, aur
  // "sifar" ka matlab "kuch nahi hai" nahi, "maloom nahi" hota.
  const stockWaliQatarein = (products ?? []).filter((p) => (stockByProduct[p.id] ?? 0) > 0);
  const totalStockValue = stockWaliQatarein.reduce(
    (sum, p) => sum + (stockByProduct[p.id] ?? 0) * Number(p.purchase_price),
    0
  );
  const binaKharidQeemat = stockWaliQatarein.filter((p) => !(Number(p.purchase_price) > 0));
  // "Kam stock" ka jawab tabhi maani rakhta hai jab kisi cheez par hadd
  // (min_stock_threshold) lagi ho. Ek bhi hadd na lagi ho to "0 cheezein
  // kam hain" kehna jhoot hai -- sach ye hai ke ye HISAAB HI NAHI RAKHA
  // JA RAHA. Is liye aisi surat mein "—" jata hai, sifar nahi.
  const haddWali = (products ?? []).filter((p) => Number(p.min_stock_threshold) > 0);
  const lowStockProducts = haddWali.filter((p) => (stockByProduct[p.id] ?? 0) <= Number(p.min_stock_threshold));
  const lowStockCount: number | null = haddWali.length === 0 ? null : lowStockProducts.length;
  const now = new Date();
  const sixtyDaysOut = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000);
  const expiringBatches = (rawInventory ?? []).filter((row: any) => {
    const expiry = row.batch_id ? expiryByBatch.get(row.batch_id) : null;
    if (!expiry) return false;
    const exp = new Date(expiry);
    return exp <= sixtyDaysOut && exp >= now;
  });

  // Fehrist wo tarteeb mein jo counter par kaam aati hai: jis cheez ka
  // maal para hai wo pehle. Pehle fehrist database ki apni tarteeb mein
  // aati thi, aur us mein sab se upar wali qatarein aksar sifar wali
  // hoti thin -- 146 cheezon ke safhe par sirf sifar nazar aate the,
  // aur us se ye lagta tha ke dukan khali hai (malik ne 5 September ko
  // yehi poocha).
  const sortedProducts = [...(products ?? [])].sort((a, b) => {
    const sa = stockByProduct[a.id] ?? 0;
    const sb = stockByProduct[b.id] ?? 0;
    if (sa !== sb) return sb - sa;
    return String(a.name).localeCompare(String(b.name));
  });
  const stockWali = sortedProducts.filter((p) => (stockByProduct[p.id] ?? 0) > 0).length;
  // Jis cheez par QISM likhi hi nahi, wo KISI qism ke safhe par nazar
  // nahi aati -- na yahan, na kisi aur jagah. Malik ne 5 September ko
  // yehi poocha: "mere paas stock to zyada hai, yahan kam kyun bata raha
  // hai?"
  //
  // Us waqt yahan likha aa raha tha "146 mein se 2 par stock hai,
  // Rs 7,442" -- aur wo adad is safhe ke liye bilkul theek tha. Asal
  // maal Rs 91,545 ka tha, magar 52 cheezon ki qism darj nahi thi, is
  // liye wo poore system mein kahin dikhta hi nahi tha.
  //
  // Safha ab khamosh nahi rehta. Ye ginti SERVICE client se aati hai --
  // ye poore idare ki baat hai, sirf is qism ki nahi.
  const { data: binaQism } = await createServiceClient()
    .from("products")
    .select("id, purchase_price")
    .is("category_id", null)
    .eq("is_deleted", false);
  const binaQismIds = (binaQism ?? []).map((p) => p.id);
  const { data: binaQismStock } = binaQismIds.length
    ? await createServiceClient()
        .from("inventory")
        .select("product_id, quantity_on_hand")
        .in("product_id", binaQismIds)
        .gt("quantity_on_hand", 0)
    : { data: [] as { product_id: string; quantity_on_hand: number }[] };
  const kharidById = new Map((binaQism ?? []).map((p) => [p.id as string, Number(p.purchase_price)]));
  const binaQismCheezein = new Set((binaQismStock ?? []).map((r) => r.product_id as string)).size;
  const binaQismQeemat = (binaQismStock ?? []).reduce(
    (sum, r) => sum + Number(r.quantity_on_hand) * (kharidById.get(r.product_id as string) ?? 0),
    0
  );

  const { data: recentPurchases } = productIds.length
    ? await supabase
        .from("purchase_items")
        .select("quantity, unit_cost, line_total, purchases(purchase_number, purchase_date, suppliers(name))")
        .in("product_id", productIds)
        .order("id", { ascending: false })
        .limit(10)
    : { data: [] };
  return (
    <div>
      <PageHeader
        title={title}
        description={`Products, stock, and sales for ${categoryName}`}
        actions={
          <Link href="/admin/products/new">
            <Button><Plus className="h-4 w-4" />{t("c_add_product", lang)}</Button>
          </Link>
        }
      />
      {/* Wo maal jo kisi bhi qism ke safhe par nazar nahi aata. Ye
          khamoshi sab se mehngi thi: adad theek tha, magar wo poori
          tasveer nahi tha. */}
      {binaQismCheezein > 0 && (
        <Card className="mb-4 border-amber-300 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20">
          <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
            {binaQismCheezein} cheezon par maal para hai (kharid ki qeemat Rs {Math.round(binaQismQeemat).toLocaleString()}) —
            magar un ki <strong>qism darj nahi</strong>.
          </p>
          <p className="mt-1 text-xs leading-relaxed text-amber-800/80 dark:text-amber-300/80">
            Har qism ka safha sirf apni qism ka maal dikhata hai. Jis cheez par qism likhi hi nahi, wo kisi bhi
            safhe par nazar nahi aati — is liye upar wala &ldquo;Stock Value&rdquo; poori dukan ka nahi, sirf is qism ka hai.
          </p>
          <Link
            href="/admin/products/setup?f=category"
            className="mt-2 inline-block rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-800"
          >
            Qism darj karein
          </Link>
        </Card>
      )}
      {invError && (
        <Card className="mb-4 border-rose-200 bg-rose-50 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/30 dark:text-rose-300">
          {t("cd_stock_error", lang)}: {invError.message}
        </Card>
      )}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <div className="flex items-center gap-2 text-surface-500">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("c_products", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">
            {products?.length ?? 0}
          </p>
        </Card>
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("cd_stock_value", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
            Rs {totalStockValue.toLocaleString()}
          </p>
          {/* Adad khud apna matlab nahi batata. Ye teen jumle wohi teen
              sawal hain jo malik ne 5 September ko poochhe. */}
          <p className="mt-1 text-[11px] leading-relaxed text-brand-700/70 dark:text-brand-300/70">
            {stockWaliQatarein.length === 0
              ? "Abhi kisi cheez ka maal para nahi hai."
              : `${stockWaliQatarein.length} cheezon ka jo maal is waqt para hai, us ki KHARID ki qeemat. Bikri ki qeemat nahi — wo abhi kamai nahi hui.`}
          </p>
          {binaKharidQeemat.length > 0 && (
            <p className="mt-1 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
              {binaKharidQeemat.length} cheez par maal to para hai magar kharid ki qeemat darj nahi — us ka maal is
              jamaa mein shaamil nahi hai.
            </p>
          )}
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("cd_low_stock", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            {lowStockCount === null ? "—" : lowStockCount}
          </p>
          {lowStockCount === null && (
            <p className="mt-1 text-[11px] text-red-700/70 dark:text-red-300/70">{t("cd_no_threshold", lang)}</p>
          )}
        </Card>
        <Card className="border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/30">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("cd_expiring_60", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-amber-700 dark:text-amber-300">
            {expiringBatches.length}
          </p>
        </Card>
      </div>
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
            {t("cd_products_in_stock", lang)}{" "}
            <span className="font-normal text-surface-500">
              — {t("cd_with_stock", lang).replace("{n}", String(stockWali)).replace("{kul}", String(products?.length ?? 0))}
            </span>
          </h2>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_product", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_stock", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_price", lang)}</th>
                  {/* Fehrist dekhne ki jagah thi, badalne ki nahi.
                      Naam theek karna ho ya cheez khatam karni ho to
                      banda Products ke poore safhe par dhoondhta phirta
                      tha (malik ne 5 September ko yehi kaha). */}
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_actions", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {sortedProducts.map((p) => {
                  const stock = stockByProduct[p.id] ?? 0;
                  const isLow = Number(p.min_stock_threshold) > 0 && stock <= Number(p.min_stock_threshold);
                  return (
                    <tr key={p.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-3 py-2 text-surface-800 dark:text-surface-200">
                        {p.name}
                        {p.pack_size ? ` (${p.pack_size})` : ""}
                      </td>
                      <td className={`px-3 py-2 text-right ${isLow ? "font-semibold text-red-600" : "text-surface-600 dark:text-surface-400"}`}>
                        {stock}
                      </td>
                      <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                        Rs {Number(p.selling_price).toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/admin/products/${p.id}/edit`}
                            className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                          >
                            {t("at_edit", lang)}
                          </Link>
                          {/* Cheez mit'ti nahi -- nishan lagta hai
                              (`is_deleted`), aur purani bikri apni jagah
                              rehti hai. Ijazat ki rok server par hai:
                              sirf Admin/Owner. */}
                          <DeleteButton productId={p.id} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(!products || products.length === 0) && (
                  <tr>
                    <td colSpan={4} className="px-3 py-8 text-center text-surface-400">{t("cd_no_products_cat", lang)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">{t("cd_recent_purchases", lang)}</h2>
          <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_supplier", lang)}</th>
                  <th className="px-3 py-2 font-medium text-surface-500">{t("c_date", lang)}</th>
                  <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_amount", lang)}</th>
                </tr>
              </thead>
              <tbody>
                {(recentPurchases ?? []).map((rp: any, idx: number) => {
                  const purchase = Array.isArray(rp.purchases) ? rp.purchases[0] : rp.purchases;
                  const supplier = Array.isArray(purchase?.suppliers) ? purchase.suppliers[0] : purchase?.suppliers;
                  return (
                    <tr key={idx} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                      <td className="px-3 py-2 text-surface-800 dark:text-surface-200">{supplier?.name ?? "-"}</td>
                      <td className="px-3 py-2 text-surface-500">{purchase?.purchase_date ? formatDate(purchase.purchase_date) : "-"}</td>
                      <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">
                        Rs {Number(rp.line_total).toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
                {(!recentPurchases || recentPurchases.length === 0) && (
                  <tr>
                    <td colSpan={3} className="px-3 py-8 text-center text-surface-400">{t("cd_no_purchases", lang)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}