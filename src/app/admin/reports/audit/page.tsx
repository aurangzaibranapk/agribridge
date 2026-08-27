import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import { AlertTriangle, Clock, TrendingDown, ArrowLeftRight, ClipboardList, Truck } from "lucide-react";
import { ReportLossForm } from "./report-loss-form";
import { VerifyLossActions } from "./verify-loss-actions";

export const dynamic = "force-dynamic";

const LOSS_TYPE_LABELS: Record<string, string> = {
  damage: "Damage",
  expiry: "Expiry",
  theft: "Theft",
  shrinkage: "Shrinkage",
  other: "Other",
};

function statusTone(status: string) {
  if (status === "approved") return "green" as const;
  if (status === "rejected") return "red" as const;
  return "amber" as const;
}

export default async function AuditCenterPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("role, shop_id").eq("id", user?.id ?? "").maybeSingle();
  const isHQ = ["super_admin", "admin", "owner"].includes(profile?.role ?? "");

  const { data: verifierGrants } = user ? await supabase.from("loss_verifiers").select("shop_id").eq("profile_id", user.id) : { data: [] };
  const canVerifyAnyShop = isHQ;
  const verifiableShopIds = (verifierGrants ?? []).map((g) => g.shop_id).filter(Boolean) as string[];
  const canVerifySomeShop = canVerifyAnyShop || (verifierGrants ?? []).length > 0;

  const [{ data: shops }, { data: products }, { data: lossRecords }] = await Promise.all([
    supabase.from("shops").select("id, name, warehouses(id)").eq("is_active", true).order("name"),
    supabase.from("products").select("id, name, pack_size, purchase_price").eq("is_deleted", false).order("name"),
    supabase
      .from("stock_loss_records")
      .select("*, warehouses(name, shop_id, shops(name)), products(name)")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  const shopOptions = (shops ?? []).map((s: any) => ({
    id: s.id,
    name: s.name,
    warehouse_id: Array.isArray(s.warehouses) ? s.warehouses[0]?.id ?? null : s.warehouses?.id ?? null,
  }));

  const losses = (lossRecords ?? []).map((l: any) => {
    const warehouse = Array.isArray(l.warehouses) ? l.warehouses[0] : l.warehouses;
    const shop = warehouse ? (Array.isArray(warehouse.shops) ? warehouse.shops[0] : warehouse.shops) : null;
    const product = Array.isArray(l.products) ? l.products[0] : l.products;
    return {
      id: l.id,
      loss_number: l.loss_number,
      shop_name: shop?.name ?? warehouse?.name ?? "-",
      shop_id: warehouse?.shop_id ?? null,
      product_name: product?.name ?? "-",
      quantity: Number(l.quantity),
      unit_cost: Number(l.unit_cost),
      loss_value: Number(l.loss_value),
      loss_type: l.loss_type,
      reason: l.reason,
      photo_url: l.photo_url,
      status: l.status,
      rejection_reason: l.rejection_reason,
      created_at: l.created_at,
    };
  });

  const pendingLosses = losses.filter((l) => l.status === "pending");
  const totalApprovedLossValue = losses.filter((l) => l.status === "approved").reduce((s, l) => s + l.loss_value, 0);

  const today = new Date();
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const { data: expiringBatches } = await supabase
    .from("stock_batches")
    .select("id, batch_number, expiry_date, remaining_quantity, unit_cost, warehouse_id, product_id, products(name), warehouses(name, shop_id, shops(name))")
    .gt("remaining_quantity", 0)
    .not("expiry_date", "is", null)
    .lte("expiry_date", in30Days)
    .order("expiry_date", { ascending: true });

  const expiryRows = (expiringBatches ?? []).map((b: any) => {
    const product = Array.isArray(b.products) ? b.products[0] : b.products;
    const warehouse = Array.isArray(b.warehouses) ? b.warehouses[0] : b.warehouses;
    const shop = warehouse ? (Array.isArray(warehouse.shops) ? warehouse.shops[0] : warehouse.shops) : null;
    const isExpired = new Date(b.expiry_date) < today;
    return {
      id: b.id,
      product_name: product?.name ?? "-",
      shop_name: shop?.name ?? warehouse?.name ?? "-",
      batch_number: b.batch_number,
      expiry_date: b.expiry_date,
      quantity: Number(b.remaining_quantity),
      value: Number(b.remaining_quantity) * Number(b.unit_cost ?? 0),
      isExpired,
    };
  });
  const expiredNow = expiryRows.filter((r) => r.isExpired);
  const expiringWarning = expiryRows.filter((r) => !r.isExpired);
  const totalExpiredValue = expiredNow.reduce((s, r) => s + r.value, 0);
  const totalExpiringValue = expiringWarning.reduce((s, r) => s + r.value, 0);

  const ninetyDaysAgo = new Date(today.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
  const { data: allInventory } = await supabase
    .from("inventory")
    .select("id, quantity_on_hand, product_id, warehouse_id, products(name, purchase_price), warehouses(name, shop_id, shops(name))")
    .gt("quantity_on_hand", 0);

  const { data: recentSaleMovements } = await supabase
    .from("stock_movements")
    .select("inventory_id, created_at")
    .eq("movement_type", "sale_out")
    .gte("created_at", ninetyDaysAgo);
  const recentlySoldInventoryIds = new Set((recentSaleMovements ?? []).map((m) => m.inventory_id));

  const slowMovingRows = (allInventory ?? [])
    .filter((inv: any) => !recentlySoldInventoryIds.has(inv.id))
    .map((inv: any) => {
      const product = Array.isArray(inv.products) ? inv.products[0] : inv.products;
      const warehouse = Array.isArray(inv.warehouses) ? inv.warehouses[0] : inv.warehouses;
      const shop = warehouse ? (Array.isArray(warehouse.shops) ? warehouse.shops[0] : warehouse.shops) : null;
      const price = Number(product?.purchase_price ?? 0);
      return {
        id: inv.id,
        product_name: product?.name ?? "-",
        shop_name: shop?.name ?? warehouse?.name ?? "-",
        quantity: Number(inv.quantity_on_hand),
        value: Number(inv.quantity_on_hand) * price,
      };
    })
    .sort((a, b) => b.value - a.value);
  const totalSlowMovingValue = slowMovingRows.reduce((s, r) => s + r.value, 0);

  const { data: grnDiscrepancies } = await supabase
    .from("agri_grns")
    .select("id, grn_number, shortage_amount, damage_amount, discrepancy_status, order_id, agri_orders(order_number, shop_dealer_name)")
    .or("shortage_amount.gt.0,damage_amount.gt.0")
    .order("created_at", { ascending: false })
    .limit(30);
  const grnRows = (grnDiscrepancies ?? []).map((g: any) => {
    const order = Array.isArray(g.agri_orders) ? g.agri_orders[0] : g.agri_orders;
    return {
      id: g.id,
      grn_number: g.grn_number,
      order_number: order?.order_number ?? "-",
      shop_name: order?.shop_dealer_name ?? "-",
      shortage: Number(g.shortage_amount),
      damage: Number(g.damage_amount),
      status: g.discrepancy_status,
    };
  });
  const totalGrnLoss = grnRows.reduce((s, r) => s + r.shortage + r.damage, 0);

  const { data: deliveryDiscrepancies } = await supabase
    .from("agri_delivery_items")
    .select("id, product_name, short_qty, damaged_qty, reason, delivery_id, agri_deliveries(order_id, agri_orders(order_number, shop_dealer_name))")
    .or("short_qty.gt.0,damaged_qty.gt.0")
    .order("created_at", { ascending: false })
    .limit(30);
  const deliveryRows = (deliveryDiscrepancies ?? []).map((d: any) => {
    const delivery = Array.isArray(d.agri_deliveries) ? d.agri_deliveries[0] : d.agri_deliveries;
    const order = delivery ? (Array.isArray(delivery.agri_orders) ? delivery.agri_orders[0] : delivery.agri_orders) : null;
    return {
      id: d.id,
      product_name: d.product_name,
      order_number: order?.order_number ?? "-",
      shop_name: order?.shop_dealer_name ?? "-",
      short: Number(d.short_qty ?? 0),
      damaged: Number(d.damaged_qty ?? 0),
      reason: d.reason,
    };
  });

  const { data: transferDiscrepancies } = await supabase
    .from("stock_transfers")
    .select("id, transfer_number, quantity, confirmed_quantity, unit_price, discrepancy_notes, products(name)")
    .eq("status", "discrepancy")
    .order("created_at", { ascending: false })
    .limit(30);
  const transferRows = (transferDiscrepancies ?? []).map((t: any) => {
    const product = Array.isArray(t.products) ? t.products[0] : t.products;
    const shortQty = Number(t.quantity) - Number(t.confirmed_quantity ?? 0);
    return {
      id: t.id,
      transfer_number: t.transfer_number,
      product_name: product?.name ?? "-",
      shortQty,
      value: shortQty * Number(t.unit_price ?? 0),
      notes: t.discrepancy_notes,
    };
  });
  const totalTransferLoss = transferRows.reduce((s, r) => s + r.value, 0);

  const grandTotalLossExposure = totalApprovedLossValue + totalExpiredValue + totalGrnLoss + totalTransferLoss;

  return (
    <div>
      <PageHeader title="Audit Center - Poora Loss Ka Hisaab" description="Ek hi jagah se sab kuch: Manual Loss, Expiry, Slow-Moving Stock, GRN/Delivery/Transfer discrepancies" />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-card border-2 border-red-200 bg-red-50 p-4 shadow-card dark:border-red-900/40 dark:bg-red-950/20">
          <p className="text-xs text-red-600">Total Loss Exposure (Approved + Expired + GRN/Transfer)</p>
          <p className="mt-1 font-display text-xl font-bold text-red-700">Rs {grandTotalLossExposure.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-amber-200 bg-amber-50 p-4 shadow-card dark:border-amber-900/40 dark:bg-amber-950/20">
          <p className="text-xs text-amber-600">Pending Loss Reports</p>
          <p className="mt-1 font-display text-xl font-bold text-amber-700">{pendingLosses.length}</p>
        </div>
        <div className="rounded-card border border-orange-200 bg-orange-50 p-4 shadow-card dark:border-orange-900/40 dark:bg-orange-950/20">
          <p className="text-xs text-orange-600">Expiry Warning (30 din mein)</p>
          <p className="mt-1 font-display text-xl font-bold text-orange-700">Rs {totalExpiringValue.toLocaleString()}</p>
        </div>
        <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card dark:border-surface-800 dark:bg-surface-900">
          <p className="text-xs text-surface-400">Slow-Moving Stock (90+ din)</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-700 dark:text-surface-300">Rs {totalSlowMovingValue.toLocaleString()}</p>
        </div>
      </div>

      <div className="mb-4">
        <ReportLossForm shops={shopOptions} products={(products ?? []).map((p) => ({ id: p.id, name: p.name, pack_size: p.pack_size, purchase_price: Number(p.purchase_price ?? 0) }))} />
      </div>

      <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <AlertTriangle className="h-4 w-4 text-red-500" /> Manual Loss Reports (Damage / Theft / Shrinkage / Other)
      </h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">No.</th>
              <th className="px-3 py-2 font-medium text-surface-500">Shop</th>
              <th className="px-3 py-2 font-medium text-surface-500">Product</th>
              <th className="px-3 py-2 font-medium text-surface-500">Type</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Value</th>
              <th className="px-3 py-2 font-medium text-surface-500">Status</th>
              <th className="px-3 py-2 font-medium text-surface-500">Action</th>
            </tr>
          </thead>
          <tbody>
            {losses.map((l) => {
              const canVerifyThis = canVerifyAnyShop || (l.shop_id && verifiableShopIds.includes(l.shop_id));
              return (
                <tr key={l.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                  <td className="px-3 py-2 font-mono text-xs text-surface-500">{l.loss_number}</td>
                  <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{l.shop_name}</td>
                  <td className="px-3 py-2 text-surface-700 dark:text-surface-300">
                    {l.product_name}
                    <p className="text-xs text-surface-400">{l.reason}</p>
                    {l.photo_url && <a href={l.photo_url} target="_blank" rel="noopener noreferrer" className="text-xs text-brand-600 hover:underline">Photo Dekhein</a>}
                  </td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{LOSS_TYPE_LABELS[l.loss_type] ?? l.loss_type}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{l.quantity}</td>
                  <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {l.loss_value.toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <Badge tone={statusTone(l.status)}>{l.status}</Badge>
                    {l.rejection_reason && <p className="mt-0.5 text-xs text-surface-500">{l.rejection_reason}</p>}
                  </td>
                  <td className="px-3 py-2">
                    {l.status === "pending" && canVerifyThis && <VerifyLossActions lossId={l.id} />}
                  </td>
                </tr>
              );
            })}
            {losses.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-8 text-center text-surface-400">Koi loss report nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <Clock className="h-4 w-4 text-orange-500" /> Expiry Tracking (30 din pehle Warning, phir Loss)
      </h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Product</th>
              <th className="px-3 py-2 font-medium text-surface-500">Shop</th>
              <th className="px-3 py-2 font-medium text-surface-500">Batch</th>
              <th className="px-3 py-2 font-medium text-surface-500">Expiry Date</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Value</th>
              <th className="px-3 py-2 font-medium text-surface-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {[...expiredNow, ...expiringWarning].map((r) => (
              <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{r.product_name}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.shop_name}</td>
                <td className="px-3 py-2 font-mono text-xs text-surface-500">{r.batch_number}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.expiry_date}</td>
                <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{r.quantity}</td>
                <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {r.value.toLocaleString()}</td>
                <td className="px-3 py-2">
                  <Badge tone={r.isExpired ? "red" : "amber"}>{r.isExpired ? "Expired - Loss" : "Warning"}</Badge>
                </td>
              </tr>
            ))}
            {expiryRows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-8 text-center text-surface-400">Koi product expire hone wala nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <TrendingDown className="h-4 w-4 text-surface-500" /> Slow-Moving Stock (90+ din se bikaa nahi)
      </h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Product</th>
              <th className="px-3 py-2 font-medium text-surface-500">Shop</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Qty</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Value</th>
            </tr>
          </thead>
          <tbody>
            {slowMovingRows.slice(0, 20).map((r) => (
              <tr key={r.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{r.product_name}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{r.shop_name}</td>
                <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{r.quantity}</td>
                <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {r.value.toLocaleString()}</td>
              </tr>
            ))}
            {slowMovingRows.length === 0 && (
              <tr><td colSpan={4} className="px-3 py-8 text-center text-surface-400">Koi slow-moving stock nahi hai — sab acha bik raha hai.</td></tr>
            )}
          </tbody>
        </table>
        {slowMovingRows.length > 20 && <p className="p-2 text-center text-xs text-surface-400">Aur {slowMovingRows.length - 20} products bhi hain.</p>}
      </div>

      <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <ClipboardList className="h-4 w-4 text-blue-500" /> GRN Discrepancies (AgriBridge Orders)
      </h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">GRN No.</th>
              <th className="px-3 py-2 font-medium text-surface-500">Order</th>
              <th className="px-3 py-2 font-medium text-surface-500">Shop</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Shortage</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Damage</th>
              <th className="px-3 py-2 font-medium text-surface-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {grnRows.map((g) => (
              <tr key={g.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-mono text-xs text-surface-500">{g.grn_number}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{g.order_number}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{g.shop_name}</td>
                <td className="px-3 py-2 text-right text-red-600">Rs {g.shortage.toLocaleString()}</td>
                <td className="px-3 py-2 text-right text-red-600">Rs {g.damage.toLocaleString()}</td>
                <td className="px-3 py-2"><Badge tone={g.status === "completed" ? "green" : "amber"}>{g.status}</Badge></td>
              </tr>
            ))}
            {grnRows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-surface-400">Koi GRN discrepancy nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <Truck className="h-4 w-4 text-purple-500" /> Delivery Discrepancies (Short/Damaged mila tha)
      </h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Order</th>
              <th className="px-3 py-2 font-medium text-surface-500">Shop</th>
              <th className="px-3 py-2 font-medium text-surface-500">Product</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Short</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Damaged</th>
              <th className="px-3 py-2 font-medium text-surface-500">Wajah</th>
            </tr>
          </thead>
          <tbody>
            {deliveryRows.map((d) => (
              <tr key={d.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{d.order_number}</td>
                <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{d.shop_name}</td>
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{d.product_name}</td>
                <td className="px-3 py-2 text-right text-red-600">{d.short}</td>
                <td className="px-3 py-2 text-right text-red-600">{d.damaged}</td>
                <td className="px-3 py-2 text-xs text-surface-500">{d.reason ?? "-"}</td>
              </tr>
            ))}
            {deliveryRows.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-8 text-center text-surface-400">Koi delivery discrepancy nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <h3 className="mb-2 mt-6 flex items-center gap-1.5 text-sm font-semibold text-surface-900 dark:text-white">
        <ArrowLeftRight className="h-4 w-4 text-cyan-500" /> Stock Transfer Discrepancies
      </h3>
      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-3 py-2 font-medium text-surface-500">Transfer No.</th>
              <th className="px-3 py-2 font-medium text-surface-500">Product</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Short Qty</th>
              <th className="px-3 py-2 text-right font-medium text-surface-500">Value</th>
              <th className="px-3 py-2 font-medium text-surface-500">Notes</th>
            </tr>
          </thead>
          <tbody>
            {transferRows.map((t) => (
              <tr key={t.id} className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                <td className="px-3 py-2 font-mono text-xs text-surface-500">{t.transfer_number}</td>
                <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{t.product_name}</td>
                <td className="px-3 py-2 text-right text-red-600">{t.shortQty}</td>
                <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {t.value.toLocaleString()}</td>
                <td className="px-3 py-2 text-xs text-surface-500">{t.notes ?? "-"}</td>
              </tr>
            ))}
            {transferRows.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-8 text-center text-surface-400">Koi stock transfer discrepancy nahi hai.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {isHQ && (
        <p className="mt-6 text-center text-xs text-surface-400">
          Verification permissions manage karne ke liye <a href="/admin/reports/audit/verifiers" className="text-brand-600 hover:underline">Verifiers page</a> dekhein.
        </p>
      )}
    </div>
  );
}