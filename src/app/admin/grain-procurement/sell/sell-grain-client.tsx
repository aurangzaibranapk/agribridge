"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { aajKaKhana } from "@/lib/utils/format";
import { useFormState, useFormStatus } from "react-dom";
import { createGrainSale, recordGrainSalePayment, type ActionState } from "@/actions/grain-sales";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { X } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { enqueue, allActions, type QueuedAction } from "@/lib/offline/queue";
import { registerSender, syncQueue } from "@/lib/offline/sync";
import {
  GrainPaymentActionId,
  GrainPaymentAccountField,
  GrainPaymentDateField,
  GrainPaymentSlipField,
  GrainPaymentSuccess,
} from "@/components/grain/grain-payment-fields";
import { GrainBillSummary, GrainPaymentHistory, type GrainPaymentHistoryRow } from "@/components/grain/grain-payment-history";
import { Fragment } from "react";
import Link from "next/link";

const initialState: ActionState = {};

interface Buyer { id: string; business_name: string; contact_person: string | null; phone_number: string | null; }
interface Warehouse { id: string; name: string; }
interface FinanceAccount { id: string; name: string; account_type: string; }
interface Sale {
  id: string;
  sale_number: string;
  buyer_name: string;
  warehouse_name: string;
  grain_type: string;
  quantity_kg: number;
  rate_per_kg: number;
  total_amount: number;
  total_cogs: number;
  profit: number;
  amount_received: number;
  sale_date: string;
  /** Admin approval se bani bikri (migration 520). */
  draft_id?: string | null;
}

/** "Draft (Admin approval)" bikri -- abhi stock/ledger mein nahi. */
export interface SaleDraftRow {
  id: string;
  status: "pending" | "approving" | "approved" | "rejected";
  sale_date: string;
  buyer_name: string;
  grain_type: string;
  quantity_kg: number;
  rate_per_kg: number;
  total_amount: number;
  reject_reason: string | null;
}

export function SaleDraftBadge({ status }: { status: SaleDraftRow["status"] }) {
  const map: Record<SaleDraftRow["status"], { label: string; cls: string }> = {
    pending: { label: "Draft (Admin approval)", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" },
    approving: { label: "Approve ho rahi hai", cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300" },
    approved: { label: "Approved (Admin)", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
  };
  const item = map[status] ?? map.pending;
  return <span className={`ml-1 inline-block rounded-full px-2 py-0.5 align-middle text-[10px] font-semibold ${item.cls}`}>{item.label}</span>;
}

const GRAIN_LABELS: Record<string, string> = { wheat: "Wheat (Gandum)", rice: "Rice (Chawal)", maize: "Maize (Makai)" };

export function SellGrainClient({
  buyers,
  warehouses,
  financeAccounts,
  sales,
  paymentsBySale = {},
  stockByWarehouseAndType,
  draftRows = [],
  canApprove = false,
}: {
  buyers: Buyer[];
  warehouses: Warehouse[];
  financeAccounts: FinanceAccount[];
  sales: Sale[];
  paymentsBySale?: Record<string, GrainPaymentHistoryRow[]>;
  stockByWarehouseAndType: Record<string, Record<string, number>>;
  draftRows?: SaleDraftRow[];
  canApprove?: boolean;
}) {
  const [payingSale, setPayingSale] = useState<Sale | null>(null);
  const [openSale, setOpenSale] = useState<string | null>(null);
  const lang = useLang();
  const openDrafts = draftRows.filter((d) => d.status === "pending" || d.status === "approving");

  return (
    <div className="space-y-6">
      {openDrafts.length > 0 && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {openDrafts.length} bikri &quot;Draft (Admin approval)&quot; mein hain -- in ka stock, lagat aur kharcha abhi darj nahi hua.{" "}
          {canApprove && <Link href="/admin/grain-procurement/sale-approvals" className="font-semibold underline">Review karein</Link>}
        </div>
      )}
      <NewSaleForm buyers={buyers} warehouses={warehouses} financeAccounts={financeAccounts} stockByWarehouseAndType={stockByWarehouseAndType} />

      <div>
        <h3 className="mb-2 text-sm font-semibold text-surface-900 dark:text-white">{t("gs_sales_history", lang)}</h3>
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_no_short", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_buyer", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("gs_grain", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_qty", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_total", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_profit", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_received", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_action", lang)}</th>
              </tr>
            </thead>
            <tbody>
              {draftRows.filter((d) => d.status !== "approved").map((d) => (
                <tr key={`draft-${d.id}`} className="border-b border-surface-100 bg-amber-50/50 last:border-0 dark:border-surface-800 dark:bg-amber-950/10">
                  <td className="px-3 py-2 font-mono text-xs text-surface-400">{d.sale_date}</td>
                  <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">
                    {d.buyer_name} <SaleDraftBadge status={d.status} />
                    {d.status === "rejected" && d.reject_reason && <p className="text-[11px] font-normal text-red-700">Wajah: {d.reject_reason}</p>}
                  </td>
                  <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{GRAIN_LABELS[d.grain_type]}</td>
                  <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{d.quantity_kg} kg</td>
                  <td className="px-3 py-2 text-right font-medium text-surface-500">Rs {d.total_amount.toLocaleString()}</td>
                  <td className="px-3 py-2 text-right text-surface-400">—</td>
                  <td className="px-3 py-2 text-right text-surface-400">—</td>
                  <td className="px-3 py-2">
                    {canApprove && d.status !== "rejected" ? (
                      <Link href={`/admin/grain-procurement/sale-approvals#d-${d.id}`} className="text-xs font-medium text-amber-700 hover:underline">Review</Link>
                    ) : (
                      <span className="text-[11px] text-surface-400">{d.status === "rejected" ? "Darj nahi hui" : "Hisaab mein nahi"}</span>
                    )}
                  </td>
                </tr>
              ))}
              {sales.map((s) => {
                const remaining = s.total_amount - s.amount_received;
                const history = paymentsBySale[s.id] ?? [];
                const missingSlips = history.filter((h) => !h.receipt_photo_url).length;
                return (
                  <Fragment key={s.id}>
                  <tr className="border-b border-surface-100 last:border-0 dark:border-surface-800">
                    <td className="px-3 py-2 font-mono text-xs text-surface-500">{s.sale_number}</td>
                    <td className="px-3 py-2 font-medium text-surface-800 dark:text-surface-200">{s.buyer_name}{s.draft_id && <> <SaleDraftBadge status="approved" /></>}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{GRAIN_LABELS[s.grain_type]}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">{s.quantity_kg} kg</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {s.total_amount.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-600">Rs {s.profit.toLocaleString()}</td>
                    <td className="px-3 py-2 text-right text-surface-600 dark:text-surface-400">Rs {s.amount_received.toLocaleString()}</td>
                    <td className="px-3 py-2">
                      {remaining > 0 && (
                        <button onClick={() => setPayingSale(s)} className="mr-2 text-xs font-medium text-brand-600 hover:underline">{t("c_payment_word", lang)}</button>
                      )}
                      <button
                        onClick={() => setOpenSale(openSale === s.id ? null : s.id)}
                        className="text-xs font-medium text-surface-600 hover:underline dark:text-surface-300"
                      >
                        History ({history.length}){missingSlips > 0 ? " ⚠" : ""}
                      </button>
                    </td>
                  </tr>
                  {openSale === s.id && (
                    <tr className="border-b border-surface-100 bg-surface-50/60 dark:border-surface-800 dark:bg-surface-800/40">
                      <td colSpan={8} className="space-y-3 px-3 py-3">
                        <p className="text-xs font-semibold text-surface-700 dark:text-surface-200">
                          {s.sale_number} — {s.buyer_name} · Bill ki tareekh {s.sale_date}
                        </p>
                        <GrainBillSummary total={s.total_amount} paid={s.amount_received} labelPaid="Wasool hua" />
                        <GrainPaymentHistory rows={history} emptyText="Is bill par abhi koi wasooli darj nahi hui." />
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
              {sales.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-8 text-center text-surface-400">{t("gs_no_sale", lang)}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {payingSale && (
        <SalePaymentModal sale={payingSale} financeAccounts={financeAccounts} onClose={() => setPayingSale(null)} />
      )}
    </div>
  );
}

export function NewSaleForm({
  buyers,
  warehouses,
  financeAccounts,
  stockByWarehouseAndType,
}: {
  buyers: Buyer[];
  warehouses: Warehouse[];
  financeAccounts: FinanceAccount[];
  stockByWarehouseAndType: Record<string, Record<string, number>>;
}) {
  const [state, formAction] = useFormState(createGrainSale, initialState);
  const lang = useLang();
  const [warehouseId, setWarehouseId] = useState("");
  const [grainType, setGrainType] = useState("wheat");
  const [quantity, setQuantity] = useState("");
  const [rate, setRate] = useState("");
  const [deliveryTerm, setDeliveryTerm] = useState("load_deliver");
  const [bardanaCost, setBardanaCost] = useState("0");
  const [mazdooriCost, setMazdooriCost] = useState("0");
  const [saveMode, setSaveMode] = useState<"post" | "draft">("post");
  const [offlineNotice, setOfflineNotice] = useState("");
  const [offlinePending, setOfflinePending] = useState(0);

  useEffect(() => {
    registerSender("grain.sale", async (action: QueuedAction) => {
      try {
        const res = await fetch("/api/grain-sales/entry", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ fields: action.payload.fields ?? {} }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, retryable: res.status >= 500, error: json.error || "Grain sale sync fail ho gayi." };
        return { ok: true };
      } catch (error) {
        return { ok: false, retryable: true, error: error instanceof Error ? error.message : "Network error" };
      }
    });
    const refresh = async () => {
      const rows = await allActions().catch(() => []);
      setOfflinePending(rows.filter((row) => row.action_type === "grain.sale" && (row.sync_status === "pending" || row.sync_status === "syncing")).length);
    };
    const restored = async () => { await syncQueue().catch(() => undefined); await refresh(); };
    void refresh();
    window.addEventListener("online", restored);
    window.addEventListener("agribridge:offline-queue-changed", refresh);
    return () => {
      window.removeEventListener("online", restored);
      window.removeEventListener("agribridge:offline-queue-changed", refresh);
    };
  }, []);

  const availableStock = stockByWarehouseAndType[warehouseId]?.[grainType] ?? 0;
  const total = (parseFloat(quantity) || 0) * (parseFloat(rate) || 0);
  const combinedCost = (parseFloat(bardanaCost) || 0) + (parseFloat(mazdooriCost) || 0);

  if (state.success) setTimeout(() => window.location.reload(), 900);

  return (
    <div className="rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
      <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-white">{t("gs_new_sale", lang)}</h2>
      {state.error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
      {state.success && <p className="mb-3 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{state.draftId ? state.notice : t("gs_sale_done", lang)}</p>}
      {offlineNotice && <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{offlineNotice}</p>}
      {offlinePending > 0 && <p className="mb-3 text-xs text-amber-700 dark:text-amber-400">{offlinePending} grain sales sync ka intezar kar rahi hain.</p>}
      <form action={formAction} className="space-y-3" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        if (typeof navigator === "undefined" || navigator.onLine !== false) return;
        event.preventDefault();
        const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
        await enqueue({ actionType: "grain.sale", entityType: "grain_sales", payload: { fields } });
        setOfflineNotice("Internet band hai. Grain sale device par save ho gayi; connection aate hi sync ho jayegi.");
      }}>
        <input type="hidden" name="save_mode" value={saveMode} />
        <div>
          <Label>{t("gd_buyer_req", lang)}</Label>
          <Select name="buyer_id" required>
            <option value="">- select -</option>
            {buyers.map((b) => (
              <option key={b.id} value={b.id}>{b.business_name}{b.contact_person ? ` - ${b.contact_person}` : ""}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("gd_warehouse_req", lang)}</Label>
            <Select name="warehouse_id" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)} required>
              <option value="">- select -</option>
              {warehouses.map((w) => (
                <option key={w.id} value={w.id}>{w.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>{t("gd_grain_type_req", lang)}</Label>
            <Select name="grain_type" value={grainType} onChange={(e) => setGrainType(e.target.value)}>
              <option value="wheat">{t("gs_wheat", lang)}</option>
              <option value="rice">{t("gs_rice", lang)}</option>
              <option value="maize">{t("gs_maize", lang)}</option>
            </Select>
          </div>
        </div>
        {warehouseId && (
          <p className="text-xs text-surface-400">{t("gs_available_stock", lang)}<span className="font-medium text-surface-600">{availableStock.toLocaleString()} kg</span></p>
        )}
        <div>
          <Label>{t("c_date", lang)}</Label>
          <Input type="date" name="sale_date" defaultValue={aajKaKhana()} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t("gd_qty_kg_req", lang)}</Label>
            <Input type="number" step="0.1" name="quantity_kg" value={quantity} onChange={(e) => setQuantity(e.target.value)} max={saveMode === "draft" ? undefined : availableStock} required />
          </div>
          <div>
            <Label>{t("gd_rate_kg_req", lang)}</Label>
            <Input type="number" step="0.01" name="rate_per_kg" value={rate} onChange={(e) => setRate(e.target.value)} required />
          </div>
        </div>
        <div className="rounded-lg border border-surface-200 p-3 dark:border-surface-700">
          <Label>{t("gs_delivery_term", lang)}</Label>
          <select name="delivery_term" value={deliveryTerm} onChange={(e) => setDeliveryTerm(e.target.value)} className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
            <option value="load_deliver">{t("gs_loaded", lang)}</option>
            <option value="unload_deliver">{t("gs_unloaded", lang)}</option>
            <option value="buyer_pickup">{t("gs_buyer_pickup", lang)}</option>
            <option value="we_deliver">{t("gs_we_deliver", lang)}</option>
          </select>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div>
              <Label>{t("gs_bardana_cost", lang)}</Label>
              <Input type="number" step="0.01" name="bardana_cost" value={bardanaCost} onChange={(e) => setBardanaCost(e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>{t("gs_labour_cost", lang)}</Label>
              <Input type="number" step="0.01" name="mazdoori_cost" value={mazdooriCost} onChange={(e) => setMazdooriCost(e.target.value)} placeholder="0" />
            </div>
          </div>
          {combinedCost > 0 && (
            <div>
              <Label>{t("gd_which_account_out", lang)}</Label>
              <Select name="cost_account_id" required>
                <option value="">- select -</option>
                {financeAccounts.map((a) => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
          )}
          <p className="mt-1 text-[11px] text-surface-400">{t("gs_both_minus_profit", lang)}</p>
        </div>
        <div>
          <Label>{t("c_notes", lang)}</Label>
          <Textarea name="notes" rows={2} />
        </div>
        <div className="rounded-lg bg-surface-50 p-3 dark:bg-surface-800">
          <div className="flex justify-between text-sm"><span className="text-surface-500">{t("gs_total_from_buyer", lang)}</span><span className="font-medium">Rs {total.toLocaleString()}</span></div>
          {combinedCost > 0 && (
            <div className="flex justify-between text-xs text-red-600"><span>{t("gs_bardana_labour", lang)}</span><span>- Rs {combinedCost.toLocaleString()}</span></div>
          )}
        </div>
        <div className={`rounded-lg border-2 p-3 ${saveMode === "draft" ? "border-amber-400 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20" : "border-surface-200 dark:border-surface-700"}`}>
          <Label>Bikri kaise save karni hai?</Label>
          <div className="mt-1 grid gap-2 sm:grid-cols-2">
            <button type="button" aria-pressed={saveMode === "post"} onClick={() => setSaveMode("post")} className={`rounded-lg border px-3 py-2 text-left text-sm ${saveMode === "post" ? "border-brand-500 bg-brand-50 text-brand-700" : "border-surface-200 text-surface-500"}`}>
              <span className="block font-medium">Abhi darj karein (Normal)</span>
              <span className="block text-[11px]">Stock foran niklega, lagat ledger aur kharcha darj.</span>
            </button>
            <button type="button" aria-pressed={saveMode === "draft"} onClick={() => setSaveMode("draft")} className={`rounded-lg border px-3 py-2 text-left text-sm ${saveMode === "draft" ? "border-amber-500 bg-amber-100 text-amber-900" : "border-surface-200 text-surface-500"}`}>
              <span className="block font-medium">Draft (Admin approval)</span>
              <span className="block text-[11px]">Abhi kuch darj nahi hoga. Admin Approve karega, tab bikri ki tareekh par stock aur hisaab darj hoga.</span>
            </button>
          </div>
        </div>
        <SubmitButton label={saveMode === "draft" ? "Draft (Admin approval) par save karein" : t("gs_record_sale", lang)} />
      </form>
    </div>
  );
}

function SalePaymentModal({ sale, financeAccounts, onClose }: { sale: Sale; financeAccounts: FinanceAccount[]; onClose: () => void }) {
  const [state, formAction] = useFormState(recordGrainSalePayment, initialState);
  const lang = useLang();
  const remaining = sale.total_amount - sale.amount_received;
  const [offlineNotice, setOfflineNotice] = useState("");
  const [offlinePending, setOfflinePending] = useState(0);
  useEffect(() => {
    registerSender("grain.sale.payment", async (action: QueuedAction, evidence) => {
      try {
        const photo = (evidence ?? []).find((item) => item.slot === "receipt_photo");
        let res: Response;
        if (photo) {
          // Slip ke sath: multipart (route dono shaklen leta hai).
          const body = new FormData();
          body.set("fields", JSON.stringify(action.payload.fields ?? {}));
          body.set("receipt_photo", photo.blob, "grain-sale-slip.jpg");
          res = await fetch("/api/grain-sales/payment", { method: "POST", body });
        } else {
          res = await fetch("/api/grain-sales/payment", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ fields: action.payload.fields ?? {} }),
          });
        }
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, retryable: res.status >= 500, error: json.error || "Grain sale payment sync fail ho gayi." };
        return { ok: true };
      } catch (error) {
        return { ok: false, retryable: true, error: error instanceof Error ? error.message : "Network error" };
      }
    });
    const refresh = async () => {
      const rows = await allActions().catch(() => []);
      setOfflinePending(rows.filter((row) => row.action_type === "grain.sale.payment" && (row.sync_status === "pending" || row.sync_status === "syncing")).length);
    };
    const restored = async () => { await syncQueue().catch(() => undefined); await refresh(); };
    void refresh();
    window.addEventListener("online", restored);
    window.addEventListener("agribridge:offline-queue-changed", refresh);
    return () => {
      window.removeEventListener("online", restored);
      window.removeEventListener("agribridge:offline-queue-changed", refresh);
    };
  }, []);
  // Kamyabi ka paighaam (ledger TXN, bank/cash book) parhne ka waqt dein.
  useEffect(() => {
    if (!state.success) return;
    const timer = setTimeout(onClose, 6000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">{t("gs_receive_payment", lang)}</h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700"><X className="h-5 w-5" /></button>
        </div>
        <p className="mb-3 text-sm text-surface-500">{sale.buyer_name} - Baaqi: Rs {remaining.toLocaleString()}</p>
        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700 dark:bg-red-900/30 dark:text-red-300">{state.error}</p>}
        {state.success && <GrainPaymentSuccess fallback={t("gs_payment_recorded", lang)} notice={state.notice} />}
        <div className="mb-3"><GrainBillSummary total={sale.total_amount} paid={sale.amount_received} labelPaid="Wasool hua" /></div>
        {offlineNotice && <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{offlineNotice}</p>}
        {offlinePending > 0 && <p className="mb-2 text-[11px] text-amber-700 dark:text-amber-400">{offlinePending} grain payment sync ka intezar kar rahi hai.</p>}
        <form action={formAction} encType="multipart/form-data" className="space-y-3" onSubmit={async (event: FormEvent<HTMLFormElement>) => {
          if (typeof navigator === "undefined" || navigator.onLine !== false) return;
          event.preventDefault();
          const formData = new FormData(event.currentTarget);
          const photo = formData.get("receipt_photo");
          const fields = Object.fromEntries(formData.entries());
          delete (fields as Record<string, FormDataEntryValue>).receipt_photo;
          const evidence = photo instanceof File && photo.size > 0 ? [{ blob: photo, slot: "receipt_photo" }] : undefined;
          await enqueue({ actionType: "grain.sale.payment", entityType: "grain_sale_payments", payload: { fields }, evidence });
          setOfflineNotice("Internet band hai. Payment device par save ho gayi; connection aate hi sync ho jayegi.");
        }}>
          <input type="hidden" name="sale_id" value={sale.id} />
          <GrainPaymentActionId />
          <div>
            <Label>{t("gd_amount_req", lang)}</Label>
            <Input type="number" step="0.01" name="amount" max={remaining} defaultValue={Math.round(remaining * 100) / 100} required />
            <p className="mt-1 text-[11px] text-surface-500">Jitna paisa asal mein mila, utna likhein (jaise 100000). Baqi raqam bill par baqi rahegi.</p>
          </div>
          <div>
            <Label>{t("c_payment_method", lang)}</Label>
            <Select name="payment_method">
              <option value="cash">{t("c_cash", lang)}</option>
              <option value="bank_transfer">{t("c_bank_transfer", lang)}</option>
              <option value="easypaisa">EasyPaisa</option>
              <option value="jazzcash">JazzCash</option>
            </Select>
          </div>
          <GrainPaymentDateField direction="in" />
          <GrainPaymentAccountField accounts={financeAccounts} direction="in" />
          <GrainPaymentSlipField />
          <div>
            <Label>{t("c_notes", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <SubmitButton label="Wasooli darj karein" />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <Button type="submit" disabled={pending} className="w-full">{pending ? "Saving..." : label}</Button>;
}
