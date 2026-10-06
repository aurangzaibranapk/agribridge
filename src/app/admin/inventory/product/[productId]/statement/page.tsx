import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, FileText, AlertTriangle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { Card, PageHeader } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

type Params = { productId: string };
type SearchParams = { warehouse?: string; from?: string; to?: string; movement?: string; supplier?: string };

const IN_TYPES = new Set(["purchase_in", "transfer_in", "adjustment_increase", "return_in"]);
const OUT_TYPES = new Set(["sale_out", "transfer_out", "adjustment_decrease", "damaged_out", "expired_out"]);

function number(value: unknown) {
  return Number(value ?? 0);
}

function label(type: string) {
  return type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function dateLabel(value: string) {
  return new Date(value).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" });
}

export default async function ProductStatementPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams?: SearchParams;
}) {
  const supabase = createClient();
  const from = searchParams?.from ?? "";
  const to = searchParams?.to ?? "";
  const selectedMovement = searchParams?.movement ?? "";
  const selectedSupplier = searchParams?.supplier ?? "";

  const [{ data: product }, { data: inventoryRows }] = await Promise.all([
    supabase.from("products").select("id, name, pack_size, units_per_pack, purchase_price, selling_price").eq("id", params.productId).maybeSingle(),
    supabase.from("inventory").select("id, warehouse_id, quantity_on_hand").eq("product_id", params.productId),
  ]);
  if (!product) notFound();

  const inventoryIds = (inventoryRows ?? []).map((r: any) => r.id);
  if (!inventoryIds.length) {
    return <EmptyStatement productName={product.name} productId={product.id} />;
  }

  let movementQuery = supabase
    .from("stock_movements")
    .select("id, inventory_id, movement_type, quantity, balance_after, reference_type, reference_id, notes, created_at, created_by")
    .in("inventory_id", inventoryIds)
    .order("created_at", { ascending: true });
  const { data: rawMoves } = await movementQuery.limit(5000);
  const moves = rawMoves ?? [];

  const warehouseIds = [...new Set((inventoryRows ?? []).map((row: any) => row.warehouse_id).filter(Boolean))];
  const { data: warehouseRows } = warehouseIds.length
    ? await supabase.from("warehouses").select("id, name").in("id", warehouseIds)
    : { data: [] as any[] };
  const warehouseNameById = new Map((warehouseRows ?? []).map((row: any) => [row.id, row.name]));
  const warehouseMap = new Map<string, string>();
  const inventoryWarehouse = new Map<string, string>();
  for (const row of inventoryRows ?? []) {
    inventoryWarehouse.set((row as any).id, (row as any).warehouse_id);
    warehouseMap.set((row as any).warehouse_id, warehouseNameById.get((row as any).warehouse_id) ?? "Unknown warehouse");
  }

  const purchaseIds = [...new Set(moves.filter((m: any) => m.reference_type === "purchase" && m.reference_id).map((m: any) => m.reference_id))];
  const saleIds = [...new Set(moves.filter((m: any) => m.reference_type === "pos_sale" && m.reference_id).map((m: any) => m.reference_id))];
  const transferIds = [...new Set(moves.filter((m: any) => m.reference_type === "stock_transfer" && m.reference_id).map((m: any) => m.reference_id))];
  const countIds = [...new Set(moves.filter((m: any) => m.reference_type === "stock_count" && m.reference_id).map((m: any) => m.reference_id))];

  const [{ data: purchases }, { data: sales }, { data: transfers }, { data: counts }] = await Promise.all([
    purchaseIds.length ? supabase.from("purchases").select("id, purchase_number, supplier_bill_no, supplier_id, purchase_date, total_amount, invoice_total, suppliers(name)").in("id", purchaseIds) : Promise.resolve({ data: [] as any[] }),
    saleIds.length ? supabase.from("pos_sales").select("id, payment_mode, cash_paid, khata_amount, crm_customer_id, customer_id, shop_id").in("id", saleIds) : Promise.resolve({ data: [] as any[] }),
    transferIds.length ? supabase.from("stock_transfers").select("id, transfer_number, from_warehouse_id, to_warehouse_id").in("id", transferIds) : Promise.resolve({ data: [] as any[] }),
    countIds.length ? supabase.from("stock_counts").select("id, count_date, status, notes").in("id", countIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const crmIds = [...new Set((sales ?? []).map((r: any) => r.crm_customer_id).filter(Boolean))];
  const dealerCustomerIds = [...new Set((sales ?? []).map((r: any) => r.customer_id).filter(Boolean))];
  const shopIds = [...new Set((sales ?? []).map((r: any) => r.shop_id).filter(Boolean))];
  const [{ data: crmCustomers }, { data: dealerCustomers }, { data: shops }] = await Promise.all([
    crmIds.length ? supabase.from("customers").select("id, name").in("id", crmIds) : Promise.resolve({ data: [] as any[] }),
    dealerCustomerIds.length ? supabase.from("dealer_customers").select("id, name").in("id", dealerCustomerIds) : Promise.resolve({ data: [] as any[] }),
    shopIds.length ? supabase.from("shops").select("id, name").in("id", shopIds) : Promise.resolve({ data: [] as any[] }),
  ]);

  const purchaseMap = new Map((purchases ?? []).map((r: any) => [r.id, r]));
  const saleMap = new Map((sales ?? []).map((r: any) => [r.id, r]));
  const transferMap = new Map((transfers ?? []).map((r: any) => [r.id, r]));
  const countMap = new Map((counts ?? []).map((r: any) => [r.id, r]));
  const crmNameById = new Map((crmCustomers ?? []).map((r: any) => [r.id, r.name]));
  const dealerNameById = new Map((dealerCustomers ?? []).map((r: any) => [r.id, r.name]));
  const shopNameById = new Map((shops ?? []).map((r: any) => [r.id, r.name]));

  const runningByWarehouse = new Map<string, number>();
  const rows = moves.map((m: any) => {
    const warehouseId = inventoryWarehouse.get(m.inventory_id) ?? "";
    const previous = runningByWarehouse.get(warehouseId) ?? 0;
    const qty = number(m.quantity);
    const delta = IN_TYPES.has(m.movement_type) ? qty : OUT_TYPES.has(m.movement_type) ? -qty : 0;
    const balance = previous + delta;
    runningByWarehouse.set(warehouseId, balance);

    let detail = label(m.movement_type);
    let party = "—";
    let reference = m.reference_id ? String(m.reference_id).slice(0, 8) : "—";
    let payment = "—";
    let warning = false;
    if (m.reference_type === "purchase") {
      const purchase: any = purchaseMap.get(m.reference_id);
      const supplier = Array.isArray(purchase?.suppliers) ? purchase.suppliers[0] : purchase?.suppliers;
      detail = `Purchase${purchase?.supplier_bill_no ? ` · Bill ${purchase.supplier_bill_no}` : ""}`;
      party = supplier?.name ?? "Supplier not linked";
      reference = purchase?.purchase_number ?? reference;
    } else if (m.reference_type === "pos_sale") {
      const sale: any = saleMap.get(m.reference_id);
      detail = "POS Sale";
      party = (sale?.crm_customer_id ? crmNameById.get(sale.crm_customer_id) : null) ?? (sale?.customer_id ? dealerNameById.get(sale.customer_id) : null) ?? (sale?.shop_id ? shopNameById.get(sale.shop_id) : null) ?? "Walk-in customer";
      payment = sale?.payment_mode ?? "Cash";
      reference = `POS ${String(m.reference_id).slice(0, 8)}`;
    } else if (m.reference_type === "stock_transfer") {
      const transfer: any = transferMap.get(m.reference_id);
      const from = warehouseMap.get(transfer?.from_warehouse_id) ?? "Unknown";
      const to = warehouseMap.get(transfer?.to_warehouse_id) ?? "Unknown";
      detail = `Stock Transfer · ${from} → ${to}`;
      party = to;
      reference = transfer?.transfer_number ?? reference;
    } else if (m.reference_type === "stock_count") {
      const count: any = countMap.get(m.reference_id);
      detail = `Stock Count${count?.count_date ? ` · ${count.count_date}` : ""}`;
      party = count?.status ?? "Count";
      reference = "Stock Count";
    } else if (m.reference_type === "data_correction" || m.reference_type === "duplicate_data_correction_reversal" || m.reference_type === "manual_adjustment") {
      detail = `Stock Adjustment · ${m.reference_type}`;
      party = m.notes ?? "Manual adjustment";
      // A recorded reversal is history, not another pending candidate.
      warning = m.reference_type !== "duplicate_data_correction_reversal";
    }
    return { ...m, warehouseId, warehouse: warehouseMap.get(warehouseId) ?? "Unknown", qty, delta, balance, detail, party, reference, payment, warning, supplierId: m.reference_type === "purchase" ? purchaseMap.get(m.reference_id)?.supplier_id ?? "" : "" };
  }).reverse();

  const selectedWarehouse = searchParams?.warehouse ?? "";
  const visibleRows = rows.filter((r: any) => {
    if (selectedWarehouse && r.warehouseId !== selectedWarehouse) return false;
    if (selectedMovement && r.movement_type !== selectedMovement) return false;
    if (selectedSupplier && r.supplierId !== selectedSupplier) return false;
    if (from && new Date(r.created_at) < new Date(`${from}T00:00:00`)) return false;
    if (to && new Date(r.created_at) > new Date(`${to}T23:59:59.999`)) return false;
    return true;
  });
  const totalIn = visibleRows.filter((r: any) => r.delta > 0).reduce((s: number, r: any) => s + r.qty, 0);
  const totalOut = visibleRows.filter((r: any) => r.delta < 0).reduce((s: number, r: any) => s + r.qty, 0);
  const currentByWarehouse = new Map<string, number>();
  for (const row of inventoryRows ?? []) currentByWarehouse.set((row as any).warehouse_id, number((row as any).quantity_on_hand) + (currentByWarehouse.get((row as any).warehouse_id) ?? 0));
  const currentTotal = [...currentByWarehouse.values()].reduce((s, n) => s + n, 0);
  const issueRows = visibleRows.filter((r: any) => r.warning);
  // Running balances were calculated in transaction order above. Reorder
  // only the display so correction candidates are easy to inspect first.
  const displayRows = [...visibleRows].sort((a: any, b: any) => Number(b.warning) - Number(a.warning));
  const supplierOptions = [...new Map((purchases ?? []).map((p: any) => {
    const supplier = Array.isArray(p.suppliers) ? p.suppliers[0] : p.suppliers;
    return [p.supplier_id, supplier?.name ?? "Supplier not linked"];
  }))];

  return (
    <div className="space-y-4">
      <PageHeader title={`${product.name} — Product Statement`} description="Bank statement jaisa complete stock movement aur running balance" actions={<Link href={`/admin/inventory/product/${product.id}`} className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"><ArrowLeft className="h-4 w-4" /> Product detail</Link>} />

      <Card className="flex flex-wrap items-center justify-between gap-3 border-brand-200 bg-brand-50/60 dark:border-brand-900/40 dark:bg-brand-950/20">
        <div><p className="text-xl font-semibold text-surface-900 dark:text-white">{product.name}</p><p className="text-xs text-surface-500">{product.pack_size ?? ""} · {product.units_per_pack ? `${product.units_per_pack} units/pack` : "Piece"}</p></div>
        <form className="flex flex-wrap items-center gap-2 text-sm">
          <select name="warehouse" defaultValue={selectedWarehouse} className="rounded-lg border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900"><option value="">All locations</option>{[...warehouseMap.entries()].map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <select name="movement" defaultValue={selectedMovement} className="rounded-lg border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900"><option value="">All movements</option>{[...new Set(moves.map((m: any) => m.movement_type))].map((type: string) => <option key={type} value={type}>{label(type)}</option>)}</select>
          <select name="supplier" defaultValue={selectedSupplier} className="rounded-lg border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900"><option value="">All suppliers</option>{supplierOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>
          <input name="from" type="date" defaultValue={from} className="rounded-lg border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900" />
          <input name="to" type="date" defaultValue={to} className="rounded-lg border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900" />
          <button className="rounded-lg bg-brand-600 px-3 py-2 font-medium text-white">Apply</button>
          <a href={`/admin/inventory/product/${product.id}/statement`} className="rounded-lg border border-surface-200 bg-white px-3 py-2 dark:border-surface-700 dark:bg-surface-900">Reset</a>
        </form>
      </Card>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Summary label="Total In / Credit" value={totalIn} tone="green" />
        <Summary label="Total Out / Debit" value={totalOut} tone="red" />
        <Summary label="Current Stock" value={currentTotal} tone="blue" />
        <Summary label="Locations" value={currentByWarehouse.size} tone="slate" />
        <Summary label="Issue Entries" value={issueRows.length} tone={issueRows.length ? "amber" : "green"} />
      </div>

      {issueRows.length > 0 && <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>Review required:</strong> {issueRows.length} manual/data-correction entries ledger ke top par dikh rahi hain. Reference aur asli transaction check kar ke reversal karein; original history mehfooz rahe.</span></div>}

      <Card className="overflow-x-auto">
        <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-surface-900 dark:text-white">Statement Ledger</h2><div className="flex gap-2"><button className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><FileText className="h-3.5 w-3.5" /> Print</button><button className="inline-flex items-center gap-1 rounded-lg border px-3 py-1.5 text-xs"><Download className="h-3.5 w-3.5" /> Export</button></div></div>
        <table className="w-full min-w-[1150px] text-sm"><thead><tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800"><th className="px-3 py-2">Date</th><th className="px-3 py-2">Reference</th><th className="px-3 py-2">Details</th><th className="px-3 py-2">Customer / Supplier</th><th className="px-3 py-2">Location</th><th className="px-3 py-2 text-right text-emerald-700">Credit / In</th><th className="px-3 py-2 text-right text-red-600">Debit / Out</th><th className="px-3 py-2 text-right">Balance</th><th className="px-3 py-2">Payment / Note</th><th className="px-3 py-2">Bill</th></tr></thead><tbody>{displayRows.map((r: any) => <tr key={r.id} className={`border-b border-surface-100 dark:border-surface-800 ${r.warning ? "bg-amber-50/60 dark:bg-amber-950/10" : ""}`}><td className="whitespace-nowrap px-3 py-2 text-xs text-surface-500">{dateLabel(r.created_at)}</td><td className="px-3 py-2 font-mono text-xs">{r.reference}</td><td className="px-3 py-2"><span className="font-medium">{r.detail}</span>{r.notes && <span className="block max-w-[260px] truncate text-[11px] text-surface-400">{r.notes}</span>}</td><td className="px-3 py-2">{r.party}</td><td className="px-3 py-2 text-xs text-surface-500">{r.warehouse}</td><td className="px-3 py-2 text-right font-semibold text-emerald-700">{r.delta > 0 ? `+${r.qty}` : "—"}</td><td className="px-3 py-2 text-right font-semibold text-red-600">{r.delta < 0 ? `−${r.qty}` : "—"}</td><td className="px-3 py-2 text-right font-semibold tabular-nums">{r.balance}</td><td className="px-3 py-2 text-xs text-surface-500">{r.payment}</td><td className="px-3 py-2">{r.reference_type === "purchase" ? <Link className="text-xs font-medium text-brand-600 hover:underline" href={`/admin/inventory/product/${product.id}/statement/purchase/${r.reference_id}`}>View bill</Link> : "—"}</td></tr>)}</tbody></table>
        {visibleRows.length === 0 && <p className="py-8 text-center text-sm text-surface-500">Is filter ke liye koi movement nahi.</p>}
      </Card>

      <Card><h2 className="mb-3 font-semibold text-surface-900 dark:text-white">Warehouse Balance</h2><div className="grid gap-3 md:grid-cols-2">{[...currentByWarehouse.entries()].map(([id, qty]) => <Link key={id} href={`/admin/inventory/product/${product.id}/statement?warehouse=${id}`} className="rounded-lg border border-surface-200 p-3 hover:border-brand-400 dark:border-surface-800"><p className="text-xs text-surface-500">{warehouseMap.get(id)}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{qty}</p><p className="text-xs text-surface-500">Current balance</p></Link>)}</div></Card>
    </div>
  );
}

function Summary({ label, value, tone }: { label: string; value: number; tone: "green" | "red" | "blue" | "slate" | "amber" }) {
  const colors = { green: "text-emerald-700", red: "text-red-600", blue: "text-brand-700", slate: "text-surface-700", amber: "text-amber-700" };
  return <Card className="p-3"><p className="text-[11px] text-surface-500">{label}</p><p className={`mt-1 text-2xl font-semibold tabular-nums ${colors[tone]}`}>{value.toLocaleString()}</p><p className="text-[11px] text-surface-400">units</p></Card>;
}

function EmptyStatement({ productName, productId }: { productName: string; productId: string }) {
  return <div className="space-y-4"><PageHeader title={`${productName} — Product Statement`} description="Complete stock movement statement" actions={<Link href={`/admin/inventory/product/${productId}`} className="text-sm text-brand-600">Back</Link>} /><Card><p className="text-sm text-surface-500">Is product ka abhi koi inventory record nahi mila.</p></Card></div>;
}
