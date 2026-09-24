"use client";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { createCreditRequest, farmerAcceptCreditRequest, farmerRejectCreditRequest, type ActionState } from "@/actions/credit-requests";
import { Check, X, Wheat } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { t, type Lang } from "@/lib/i18n/translations";

const initialState: ActionState = {};

interface Product {
  id: string;
  name: string;
  pack_size: string | null;
  mrp_price: number | null;
  selling_price: number;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

interface CreditRequest {
  id: string;
  category: string;
  quantity: number;
  mrp_rate: number;
  base_amount: number;
  margin_percentage: number;
  total_amount: number;
  admin_comments: string | null;
  status: string;
  product_name: string;
}

export function CreditRequestForm({
  categories,
  products,
  requests,
}: {
  categories: Category[];
  products: Product[];
  requests: CreditRequest[];
}) {
  const { language: lang } = useLanguage();
  const [state, formAction] = useFormState(createCreditRequest, initialState);
  const [categoryValue, setCategoryValue] = useState("fertilizer");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");

  const CATEGORY_MAP: Record<string, string> = { seed: t("cat_seed", lang), fertilizer: t("fertilizer_stat", lang), pesticide: t("cat_pesticide", lang) };

  const filteredProducts = selectedCategoryId ? products.filter((p) => p.category_id === selectedCategoryId) : products;

  const pendingForFarmer = requests.filter((r) => r.status === "admin_approved");
  const otherRequests = requests.filter((r) => r.status !== "admin_approved" && r.status !== "pending" || r.status === "pending");

  function statusLabel(status: string) {
    const map: Record<string, string> = {
      pending: t("status_pending", lang),
      admin_approved: t("status_admin_approved", lang),
      farmer_accepted: t("status_farmer_accepted", lang),
      farmer_rejected: t("status_farmer_rejected", lang),
      admin_rejected: t("status_admin_rejected", lang),
    };
    return map[status] ?? status;
  }

  return (
    <div>
      {pendingForFarmer.length > 0 && (
        <div className="mb-6 space-y-3">
          <h2 className="font-display text-lg font-semibold text-surface-900">{t("your_response_needed", lang)}</h2>
          {pendingForFarmer.map((r) => (
            <div key={r.id} className="rounded-card border border-amber-200 bg-amber-50 p-4">
              <p className="font-medium text-surface-900">
                {CATEGORY_MAP[r.category]}: {r.product_name} - {r.quantity}
              </p>
              <div className="mt-2 space-y-1 text-sm text-surface-600">
                <p>{t("mrp_rate_label", lang)}: Rs {r.mrp_rate.toLocaleString()}</p>
                <p>{t("base_amount_label", lang)}: Rs {r.base_amount.toLocaleString()}</p>
                <p>{t("credit_charge_label", lang)}: {r.margin_percentage}%</p>
                <p className="font-semibold text-surface-900">{t("total_payable_label", lang)}: Rs {r.total_amount.toLocaleString()}</p>
              </div>
              {r.admin_comments && (
                <p className="mt-2 rounded-lg bg-white p-2 text-xs text-surface-600">
                  <strong>{t("admin_note_label", lang)}:</strong> {r.admin_comments}
                </p>
              )}
              <RequestResponseButtons requestId={r.id} />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-card border border-surface-200 bg-white p-4 shadow-card">
        <h2 className="font-display text-sm font-semibold text-surface-900">{t("new_credit_request", lang)}</h2>
        {state.error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && <p className="mt-2 rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">{t("request_sent_msg", lang)}</p>}
        <form action={formAction} className="mt-3 space-y-3">
          <div>
            <label className="text-xs font-medium text-surface-600">{t("category_label", lang)}</label>
            <select
              name="category"
              value={categoryValue}
              onChange={(e) => setCategoryValue(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            >
              <option value="seed">{t("cat_seed", lang)}</option>
              <option value="fertilizer">{t("fertilizer_stat", lang)}</option>
              <option value="pesticide">{t("cat_pesticide", lang)}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("category_group_filter", lang)}</label>
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm"
            >
              <option value="">{t("all_products_option", lang)}</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("product_label", lang)}</label>
            <select name="product_id" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm">
              <option value="">{t("select_placeholder", lang)}</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.pack_size ? `(${p.pack_size})` : ""} - MRP Rs {(p.mrp_price ?? p.selling_price).toLocaleString()}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-surface-600">{t("quantity_label", lang)}</label>
            <input type="number" step="1" min="1" name="quantity" required className="mt-1 w-full rounded-lg border border-surface-200 p-2 text-sm" placeholder={t("eg_2", lang)} />
          </div>
          <SubmitButton lang={lang} />
        </form>
      </div>

      {otherRequests.length > 0 && (
        <div className="mt-6">
          <h2 className="mb-3 font-display text-lg font-semibold text-surface-900">{t("credit_request_history", lang)}</h2>
          <div className="space-y-2">
            {otherRequests.map((r) => (
              <div key={r.id} className="flex items-center justify-between rounded-card border border-surface-200 bg-white p-3 text-sm">
                <div className="flex items-center gap-2">
                  <Wheat className="h-4 w-4 text-brand-600" />
                  <span>{CATEGORY_MAP[r.category]}: {r.product_name} x{r.quantity}</span>
                </div>
                <span className="text-xs text-surface-500">{statusLabel(r.status)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RequestResponseButtons({ requestId }: { requestId: string }) {
  const [, acceptAction] = useFormState(farmerAcceptCreditRequest, initialState);
  const [, rejectAction] = useFormState(farmerRejectCreditRequest, initialState);
  return (
    <div className="mt-3 flex gap-2">
      <form action={acceptAction}>
        <input type="hidden" name="request_id" value={requestId} />
        <AcceptButton />
      </form>
      <form action={rejectAction}>
        <input type="hidden" name="request_id" value={requestId} />
        <RejectButton />
      </form>
    </div>
  );
}

function AcceptButton() {
  const { language: lang } = useLanguage();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
      <Check className="h-3.5 w-3.5" /> {t("accept_btn", lang)}
    </button>
  );
}

function RejectButton() {
  const { language: lang } = useLanguage();
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="flex items-center gap-1 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100">
      <X className="h-3.5 w-3.5" /> {t("reject_btn", lang)}
    </button>
  );
}

function SubmitButton({ lang }: { lang: Lang }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="w-full rounded-lg bg-brand-600 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60">
      {pending ? t("sending_label", lang) : t("send_request_btn", lang)}
    </button>
  );
}