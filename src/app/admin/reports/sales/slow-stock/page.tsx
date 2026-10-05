import Link from "next/link";
import { ArrowLeft, Clock3, PackageSearch } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ days?: string; branch?: string; shop?: string; q?: string }>;

function dateText(value: string | null) {
  if (!value) return "Record nahi";
  return new Date(value).toLocaleDateString("en-PK", { day: "2-digit", month: "short", year: "numeric" });
}

function daysSince(value: string | null, now: number) {
  if (!value) return null;
  return Math.max(0, Math.floor((now - new Date(value).getTime()) / (24 * 60 * 60 * 1000)));
}

/**
 * Current stock ke andar wo qatarein jin par 20+ din se koi movement nahi.
 *
 * `stock_movements` ko asal source rakha gaya hai. Agar purani inventory row
 * ka movement record na ho to `inventory.updated_at` fallback hai; isay page
 * par saaf likha gaya hai taake old data ko sale samajh kar ghalat claim na ho.
 */
export default async function SlowStockPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const requestedDays = Number.parseInt(params.days ?? "20", 10);
  const days = Number.isFinite(requestedDays) && requestedDays >= 1 && requestedDays <= 365 ? requestedDays : 20;
  const query = (params.q ?? "").trim().toLowerCase();
  const db = createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const { data: me } = await db.from("profiles").select("role, shop_id, branch_id").eq("id", user?.id ?? "").maybeSingle();
  const unrestricted = UNRESTRICTED_ROLES.includes(String(me?.role ?? ""));
  const ownShop = !unrestricted ? ((me?.shop_id as string | null) ?? null) : null;
  const branchId = ownShop ? "" : params.branch ?? "";
  const shopId = ownShop ? "" : params.shop ?? "";

  const { data: warehouses } = await db.from("warehouses").select("id, name, branch_id, shop_id").eq("is_active", true).order("name");
  const visibleWarehouses = (warehouses ?? []).filter((w: any) => {
    if (ownShop) return w.shop_id === ownShop;
    if (shopId) return w.shop_id === shopId;
    if (branchId) return w.branch_id === branchId;
    return true;
  });
  const warehouseIds = visibleWarehouses.map((w: any) => w.id);
  const warehouseMap = new Map(visibleWarehouses.map((w: any) => [w.id, w.name]));

  const { data: inventory } = warehouseIds.length
    ? await db.from("inventory").select("id, product_id, warehouse_id, quantity_on_hand, updated_at").in("warehouse_id", warehouseIds).gt("quantity_on_hand", 0)
    : { data: [] as any[] };
  const inventoryIds = (inventory ?? []).map((r: any) => r.id);
  const productIds = [...new Set((inventory ?? []).map((r: any) => r.product_id))];
  const [{ data: products }, { data: movements }] = await Promise.all([
    productIds.length ? db.from("products").select("id, name, pack_size, purchase_price").in("id", productIds).eq("is_deleted", false) : Promise.resolve({ data: [] as any[] }),
    inventoryIds.length ? db.from("stock_movements").select("inventory_id, movement_type, created_at").in("inventory_id", inventoryIds).order("created_at", { ascending: false }).limit(20000) : Promise.resolve({ data: [] as any[] }),
  ]);

  const productMap = new Map((products ?? []).map((p: any) => [p.id, p]));
  const latestMovement = new Map<string, { created_at: string; movement_type: string }>();
  for (const movement of movements ?? []) {
    if (!latestMovement.has(movement.inventory_id)) latestMovement.set(movement.inventory_id, movement);
  }
  const now = Date.now();
  const cutoff = now - days * 24 * 60 * 60 * 1000;
  const grouped = new Map<string, any>();
  for (const row of inventory ?? []) {
    const product = productMap.get(row.product_id);
    if (!product) continue;
    const movement = latestMovement.get(row.id);
    const lastDate = movement?.created_at ?? row.updated_at ?? null;
    if (!lastDate || new Date(lastDate).getTime() >= cutoff) continue;
    const key = `${row.product_id}:${row.warehouse_id}`;
    const existing = grouped.get(key);
    const qty = Number(row.quantity_on_hand ?? 0);
    if (existing) {
      existing.quantity += qty;
      if (new Date(lastDate).getTime() > new Date(existing.lastDate).getTime()) {
        existing.lastDate = lastDate;
        existing.lastMovement = movement?.movement_type ?? null;
        existing.usedFallback = !movement;
      }
    } else {
      grouped.set(key, {
        productId: product.id,
        productName: product.name,
        packSize: product.pack_size,
        warehouseId: row.warehouse_id,
        warehouseName: warehouseMap.get(row.warehouse_id) ?? "Unknown location",
        quantity: qty,
        purchasePrice: Number(product.purchase_price ?? 0),
        lastDate,
        lastMovement: movement?.movement_type ?? null,
        usedFallback: !movement,
      });
    }
  }
  const rows = [...grouped.values()]
    .map((row) => ({ ...row, idleDays: daysSince(row.lastDate, now) ?? 0, value: row.quantity * row.purchasePrice }))
    .filter((row) => !query || `${row.productName} ${row.packSize ?? ""} ${row.warehouseName}`.toLowerCase().includes(query))
    .sort((a, b) => b.idleDays - a.idleDays || a.productName.localeCompare(b.productName));

  const totalUnits = rows.reduce((sum, row) => sum + row.quantity, 0);
  const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
  const qs = (nextDays: number) => `/admin/reports/sales/slow-stock?days=${nextDays}${branchId ? `&branch=${branchId}` : ""}${shopId ? `&shop=${shopId}` : ""}`;

  return (
    <div className="space-y-4">
      <PageHeader
        title="20+ din se na bika hua stock"
        description="Maujooda stock jo aakhri movement ke baad se diye gaye dinon tak nahi hila. Product statement khol kar poora credit/debit ledger dekhein."
        actions={<Link href="/admin/reports/sales" className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Sales report</Link>}
      />

      <Card className="border-amber-200 bg-amber-50 dark:border-surface-800 dark:bg-surface-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-300"><Clock3 className="h-4 w-4" /> Har product aur location alag dikh rahi hai</div>
          <div className="flex flex-wrap gap-2 text-xs">
            {[20, 30, 60, 90].map((option) => <Link key={option} href={qs(option)} className={`rounded-full px-3 py-1 font-semibold ${days === option ? "bg-amber-700 text-white" : "bg-white text-amber-800 hover:bg-amber-100 dark:bg-surface-800 dark:text-amber-300"}`}>{option}+ din</Link>)}
          </div>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-400">Aakhri movement sale, purchase, transfer ya adjustment ho sakti hai. Jahan movement record purane data mein nahi mila, wahan inventory ki last update date fallback ke taur par dikhayi gayi hai.</p>
      </Card>

      <form className="flex flex-wrap gap-2" method="get">
        <input type="hidden" name="days" value={days} />
        {branchId && <input type="hidden" name="branch" value={branchId} />}
        {shopId && <input type="hidden" name="shop" value={shopId} />}
        <input name="q" defaultValue={params.q ?? ""} placeholder="Product ya shop search karein" className="h-10 min-w-[260px] flex-1 rounded-xl border border-surface-200 bg-white px-3 text-sm outline-none focus:border-brand-500 dark:border-surface-700 dark:bg-surface-900" />
        <button className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Search</button>
      </form>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="p-4"><p className="text-xs text-surface-500">Slow stock lines</p><p className="mt-1 text-2xl font-bold">{rows.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-surface-500">Total units</p><p className="mt-1 text-2xl font-bold">{totalUnits.toLocaleString()}</p></Card>
        <Card className="col-span-2 p-4 md:col-span-1"><p className="text-xs text-surface-500">Purchase value</p><p className="mt-1 text-2xl font-bold">Rs. {Math.round(totalValue).toLocaleString()}</p></Card>
      </div>

      {rows.length === 0 ? <EmptyState title="20+ din wala stock nahi mila" description="Is filter ke mutabiq koi positive stock nahi mila." /> : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-sm">
            <thead><tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800"><th className="px-4 py-3">Product</th><th className="px-4 py-3">Shop / Godam</th><th className="px-4 py-3 text-right">Stock</th><th className="px-4 py-3">Aakhri movement</th><th className="px-4 py-3 text-right">Idle days</th><th className="px-4 py-3 text-right">Value</th><th className="px-4 py-3">Statement</th></tr></thead>
            <tbody>{rows.map((row) => <tr key={`${row.productId}:${row.warehouseId}`} className="border-b border-surface-100 last:border-0 dark:border-surface-800"><td className="px-4 py-3 font-semibold text-surface-900 dark:text-surface-100">{row.productName}{row.packSize ? <span className="ml-1 text-xs font-normal text-surface-500">({row.packSize})</span> : null}</td><td className="px-4 py-3 text-surface-600 dark:text-surface-300">{row.warehouseName}</td><td className="px-4 py-3 text-right font-semibold tabular-nums">{row.quantity.toLocaleString()}</td><td className="px-4 py-3 text-surface-600 dark:text-surface-300">{dateText(row.lastDate)}<span className="block text-[11px] text-surface-400">{row.usedFallback ? "Inventory update fallback" : String(row.lastMovement ?? "movement").replace(/_/g, " ")}</span></td><td className="px-4 py-3 text-right font-bold tabular-nums text-amber-700 dark:text-amber-300">{row.idleDays} din</td><td className="px-4 py-3 text-right tabular-nums">Rs. {Math.round(row.value).toLocaleString()}</td><td className="px-4 py-3"><Link href={`/admin/inventory/product/${row.productId}/statement?warehouse=${row.warehouseId}`} className="inline-flex items-center gap-1 text-brand-600 hover:underline"><PackageSearch className="h-4 w-4" /> Open</Link></td></tr>)}</tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
