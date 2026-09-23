"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { adjustStock, transferStock, type ActionState } from "@/actions/inventory";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { AlertTriangle, Package, DollarSign, Settings2, ArrowLeftRight, Pencil, X, Printer } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface InventoryRow {
  id: string;
  product_id: string;
  batch_id: string | null;
  product_name: string;
  pack_size: string | null;
  batch_number: string | null;
  expiry_date: string | null;
  days_left: number | null;
  batch_count: number;
  warehouse_id: string;
  warehouse_name: string;
  quantity_on_hand: number;
  purchase_price: number;
  selling_price: number | null;
  wholesale_price: number | null;
  mrp_price: number | null;
  min_stock_threshold: number;
}

interface Warehouse {
  id: string;
  name: string;
  shop_id: string | null;
}

interface Shop {
  id: string;
  name: string;
}

const initialState: ActionState = {};

export function InventoryClient({ rows, warehouses, shops }: { rows: InventoryRow[]; warehouses: Warehouse[]; shops: Shop[] }) {
  const lang = useLang();
  const [adjustTarget, setAdjustTarget] = useState<{ row: InventoryRow; direction: "increase" | "decrease" } | null>(null);
  const [transferTarget, setTransferTarget] = useState<InventoryRow | null>(null);
  const [shopFilter, setShopFilter] = useState("");
  const [warehouseFilter, setWarehouseFilter] = useState("");
  // "62 items ka rate missing" sirf ginti dikhata tha -- malik (13
  // September): "iske niche link hona chahiye, hum us par click karein
  // to inke asal page par chale jayein". Ab wahi ginti click hone par
  // neeche wali fehrist inhi products tak simat jati hai, aur har ek ke
  // aage Edit ka raasta hai.
  const [missingFilter, setMissingFilter] = useState<null | "trade" | "sale" | "wholesale" | "credit">(null);

  // Shop select hone par us shop ke sare warehouses ki IDs nikalo
  const shopWarehouseIds = useMemo(
    () => shopFilter ? new Set(warehouses.filter((w) => w.shop_id === shopFilter).map((w) => w.id)) : null,
    [shopFilter, warehouses]
  );

  // Warehouse dropdown mein sirf selected shop ke warehouses dikhao
  const visibleWarehouses = useMemo(
    () => shopFilter ? warehouses.filter((w) => w.shop_id === shopFilter) : warehouses,
    [shopFilter, warehouses]
  );

  const warehouseFiltered = useMemo(() => {
    let result = rows;
    if (shopWarehouseIds) result = result.filter((r) => shopWarehouseIds.has(r.warehouse_id));
    if (warehouseFilter) result = result.filter((r) => r.warehouse_id === warehouseFilter);
    return result;
  }, [rows, shopWarehouseIds, warehouseFilter]);

  const MISSING_RATE_KEY: Record<"trade" | "sale" | "wholesale" | "credit", (r: InventoryRow) => number | null> = {
    trade: (r) => r.purchase_price,
    sale: (r) => r.selling_price,
    wholesale: (r) => r.wholesale_price,
    credit: (r) => r.mrp_price,
  };

  const filteredRows = useMemo(() => {
    if (!missingFilter) return warehouseFiltered;
    const getRate = MISSING_RATE_KEY[missingFilter];
    return warehouseFiltered.filter((r) => getRate(r) == null && r.quantity_on_hand > 0);
  }, [warehouseFiltered, missingFilter]);

  const totalValue = useMemo(
    () => warehouseFiltered.reduce((sum, r) => sum + r.quantity_on_hand * r.purchase_price, 0),
    [warehouseFiltered]
  );
  const lowStockRows = useMemo(
    () => warehouseFiltered.filter((r) => r.min_stock_threshold > 0 && r.quantity_on_hand <= r.min_stock_threshold),
    [warehouseFiltered]
  );

  // Har rate ke hisaab se qeemat -- jis cheez ka wo rate darj hi nahi,
  // us ko sifar samajh kar jama mein nahi lete (CLAUDE.md: NULL aur
  // sifar ek cheez nahi). Missing count alag se dikhaya jata hai. Ye
  // hamesha WAREHOUSE-filtered set par ginta hai, "missingFilter" par
  // nahi -- warna neeche wali fehrist chhoti hone par ginti bhi ghat
  // jati, aur banda samajhta "sab theek ho gaya".
  const rateBreakdown = useMemo(() => {
    const calc = (getRate: (r: InventoryRow) => number | null) => {
      let value = 0;
      let missing = 0;
      for (const r of warehouseFiltered) {
        const rate = getRate(r);
        if (rate == null) {
          if (r.quantity_on_hand > 0) missing += 1;
        } else {
          value += rate * r.quantity_on_hand;
        }
      }
      return { value, missing };
    };
    return {
      trade: calc((r) => r.purchase_price),
      sale: calc((r) => r.selling_price),
      wholesale: calc((r) => r.wholesale_price),
      credit: calc((r) => r.mrp_price),
    };
  }, [warehouseFiltered]);

  return (
    <div>
      {/* Print-only header — sirf print par dikhe */}
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Maal / Stock — {new Date().toLocaleDateString("en-PK")}</h1>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3 print:hidden">
        {shops.length > 0 && (
          <div className="min-w-[180px]">
            <Label htmlFor="shop-filter">Shop / Dukan</Label>
            <Select
              id="shop-filter"
              value={shopFilter}
              onChange={(e) => {
                setShopFilter(e.target.value);
                setWarehouseFilter("");
              }}
            >
              <option value="">Sab Shops</option>
              {shops.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
        )}
        <div className="min-w-[180px]">
          <Label htmlFor="warehouse-filter">{t("inv_filter_warehouse", lang)}</Label>
          <Select id="warehouse-filter" value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)}>
            <option value="">{shopFilter ? "Sab Godaam (Is Shop Ke)" : t("inv_all_warehouses", lang)}</option>
            {visibleWarehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </Select>
        </div>
        {/* Print button */}
        <div className="ml-auto self-end">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-2 rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm font-medium text-surface-700 hover:bg-surface-50 dark:border-surface-700 dark:bg-surface-900 dark:text-surface-200 dark:hover:bg-surface-800"
          >
            <Printer className="h-4 w-4" />
            Print / PDF
          </button>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
          <div className="flex items-center gap-2 text-surface-500">
            <Package className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("inv_stock_lines", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{filteredRows.length}</p>
        </Card>
        <Card className="border-brand-200 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/30">
          <div className="flex items-center gap-2 text-brand-600">
            <DollarSign className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("inv_total_value", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-brand-700 dark:text-brand-300">
            Rs {totalValue.toLocaleString()}
          </p>
        </Card>
        <Card className="border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("inv_low_stock", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            {lowStockRows.length}
          </p>
        </Card>
      </div>

      <div className="mb-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h3 className="mb-3 font-display text-sm font-semibold text-surface-900 dark:text-white">{t("inv_value_by_rate", lang)}</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              { key: "trade", label: t("inv_trade_rate", lang) },
              { key: "sale", label: t("inv_sale_rate", lang) },
              { key: "wholesale", label: t("inv_wholesale_rate", lang) },
              { key: "credit", label: t("inv_credit_rate", lang) },
            ] as const
          ).map(({ key, label }) => {
            const { value, missing } = rateBreakdown[key];
            const active = missingFilter === key;
            return (
              <div
                key={key}
                className={`rounded-lg border p-3 ${active ? "border-amber-400 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/20" : "border-surface-100 dark:border-surface-800"}`}
              >
                <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{label}</p>
                <p className="mt-1 font-display text-lg font-semibold text-surface-900 dark:text-white">Rs {value.toLocaleString()}</p>
                {missing > 0 && (
                  <button
                    type="button"
                    onClick={() => setMissingFilter(active ? null : key)}
                    className="mt-0.5 text-[11px] font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-300"
                  >
                    {missing} {t("inv_rate_missing_note", lang)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {missingFilter && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/20 dark:text-amber-300">
          <span>{t("inv_missing_filter_active", lang)}</span>
          <button type="button" onClick={() => setMissingFilter(null)} className="font-medium underline">
            {t("inv_missing_filter_clear", lang)}
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
              <th className="px-4 py-3 font-medium text-surface-500">{t("inv_product", lang)}</th>
              <th className="px-4 py-3 font-medium text-surface-500">{t("inv_warehouse", lang)}</th>
              <th className="px-4 py-3 font-medium text-surface-500">{t("inv_batch", lang)}</th>
              <th className="px-4 py-3 font-medium text-surface-500">{t("inv_expiry", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("inv_qty", lang)}</th>
              <th className="px-4 py-3 text-right font-medium text-surface-500">{t("inv_value", lang)}</th>
              <th className="px-4 py-3 font-medium text-surface-500">{t("inv_actions", lang)}</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((r) => {
              const isLow = r.min_stock_threshold > 0 && r.quantity_on_hand <= r.min_stock_threshold;
              return (
                <tr key={r.id} className={`border-b border-surface-100 last:border-0 dark:border-surface-800 ${isLow ? "bg-red-50/50 dark:bg-red-950/10" : ""}`}>
                  <td className="px-4 py-3 font-medium text-surface-800 dark:text-surface-200">
                    <Link href={`/admin/inventory/product/${r.product_id}`} className="hover:text-brand-600 hover:underline">
                      {r.product_name}{r.pack_size ? ` (${r.pack_size})` : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-400">{r.warehouse_name}</td>
                  <td className="px-4 py-3 text-surface-500">
                    {r.batch_number ?? "-"}
                    {r.batch_count > 1 && <span className="ml-1 text-xs text-surface-400">+{r.batch_count - 1}</span>}
                  </td>
                  <td className={`px-4 py-3 ${r.days_left != null && r.days_left <= 30 ? "font-medium text-red-600" : r.days_left != null && r.days_left <= 90 ? "text-amber-700 dark:text-amber-400" : "text-surface-500"}`}>
                    {r.expiry_date ?? "-"}
                    {r.days_left != null && r.days_left <= 90 && (
                      <span className="ml-1 text-xs">({r.days_left < 0 ? t("inv_expired", lang) : `${r.days_left} ${t("inv_days", lang)}`})</span>
                    )}
                  </td>
                  <td className={`px-4 py-3 text-right font-semibold ${isLow ? "text-red-600" : "text-surface-800 dark:text-surface-200"}`}>
                    <Link href={`/admin/inventory/product/${r.product_id}`} className="hover:text-brand-600 hover:underline" title={t("inv_qty_report_hint", lang)}>
                      {r.quantity_on_hand}
                    </Link>
                    {isLow && <span className="ml-1 text-xs">({t("inv_low", lang)})</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-surface-700 dark:text-surface-300">
                    Rs {(r.quantity_on_hand * r.purchase_price).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAdjustTarget({ row: r, direction: "increase" })}
                        className="rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-emerald-700"
                        title="Stock Daalen (IN)"
                      >
                        + IN
                      </button>
                      <button
                        onClick={() => setAdjustTarget({ row: r, direction: "decrease" })}
                        className="rounded bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white hover:bg-red-600"
                        title="Stock Nikalen (OUT)"
                      >
                        − OUT
                      </button>
                      <button onClick={() => setTransferTarget(r)} className="text-surface-400 hover:text-brand-600" title={t("inv_transfer", lang)}>
                        <ArrowLeftRight className="h-4 w-4" />
                      </button>
                      <Link href={`/admin/products/${r.product_id}/edit`} className="text-surface-400 hover:text-brand-600" title={t("inv_edit_product", lang)}>
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-surface-400">
                  {t("inv_empty", lang)}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {adjustTarget && (
        <AdjustModal row={adjustTarget.row} direction={adjustTarget.direction} onClose={() => setAdjustTarget(null)} />
      )}
      {transferTarget && (
        <TransferModal row={transferTarget} warehouses={warehouses} onClose={() => setTransferTarget(null)} />
      )}
    </div>
  );
}

function AdjustModal({ row, direction, onClose }: { row: InventoryRow; direction: "increase" | "decrease"; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(adjustStock, initialState);
  const [qty, setQty] = useState("");
  const [rate, setRate] = useState(String(row.purchase_price > 0 ? row.purchase_price : ""));

  const amount = qty && rate ? (Number(qty) * Number(rate)).toLocaleString("en-PK") : "—";
  const isIn = direction === "increase";

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl dark:bg-surface-900 sm:rounded-card">
        <div className="mb-1 flex items-center justify-between">
          <h3 className={`font-display text-base font-semibold ${isIn ? "text-emerald-700" : "text-red-600"}`}>
            {isIn ? "Stock Daalen (IN)" : "Stock Nikalen (OUT)"}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-xs text-surface-500">
          {row.product_name}{row.pack_size ? ` (${row.pack_size})` : ""} — {row.warehouse_name}
          <span className="ml-2 font-medium text-surface-700 dark:text-surface-300">Maujood: {row.quantity_on_hand}</span>
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Ho gaya!</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="inventory_id" value={row.id} />
          <input type="hidden" name="direction" value={direction} />
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Miqdar (Qty)</Label>
              <Input
                type="number"
                name="quantity"
                min={0.001}
                step="0.001"
                required
                placeholder="0"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label>Rate (Rs)</Label>
              <Input
                type="number"
                name="purchase_price"
                min={0}
                step="0.01"
                placeholder="0"
                value={rate}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div>
              <Label>Raqam</Label>
              <div className="flex h-10 items-center rounded-lg border border-surface-200 bg-surface-50 px-3 text-sm font-semibold tabular-nums text-surface-700 dark:border-surface-700 dark:bg-surface-800 dark:text-surface-200">
                {amount}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Bill No. (optional)</Label>
              <Input type="text" name="bill_no" placeholder="e.g. INV-123" />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Input type="text" name="notes" placeholder="Wajah ya note" />
            </div>
          </div>
          <SubmitButton
            label={isIn ? "Stock Daalen" : "Stock Nikalen"}
            className={isIn ? "w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700" : "w-full rounded-lg bg-red-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-600"}
          />
        </form>
      </div>
    </div>
  );
}

function TransferModal({ row, warehouses, onClose }: { row: InventoryRow; warehouses: Warehouse[]; onClose: () => void }) {
  const lang = useLang();
  const [state, formAction] = useFormState(transferStock, initialState);

  if (state.success) {
    setTimeout(onClose, 800);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("inv_transfer", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700 dark:hover:text-surface-200">
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-3 text-sm text-surface-500">
          {row.product_name} — {t("inv_currently_at", lang)} {row.warehouse_name} ({t("inv_qty", lang)}: {row.quantity_on_hand})
        </p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <p className="mb-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{t("inv_transferred", lang)}</p>}
        <form action={formAction} className="space-y-3">
          <input type="hidden" name="product_id" value={row.product_id} />
          <input type="hidden" name="batch_id" value={row.batch_id ?? ""} />
          <div>
            <Label>{t("inv_from_warehouse", lang)}</Label>
            <Select name="from_warehouse_id" defaultValue={row.warehouse_id} disabled>
              <option value={row.warehouse_id}>{row.warehouse_name}</option>
            </Select>
          </div>
          <div>
            <Label>{t("inv_to_warehouse", lang)}</Label>
            <Select name="to_warehouse_id" required>
              <option value="">{t("inv_select", lang)}</option>
              {warehouses.filter((w) => w.id !== row.warehouse_id).map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("inv_quantity", lang)}</Label>
            <Input type="number" name="quantity" min={0.001} max={row.quantity_on_hand} step="0.001" required />
          </div>
          <div>
            <Label>{t("inv_notes", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label={t("inv_transfer", lang)} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label, className }: { label: string; className?: string }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className={className ?? "w-full"}>{pending ? t("inv_processing", lang) : label}</Button>;
}