"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, MessageSquareWarning, PackageCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/layout-primitives";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";

interface ActionRequest {
  id: string;
  created_at: string;
  action_type: string;
  description: string;
  details: string | null;
  status: "pending" | "approved" | "rejected" | "needs_changes";
  review_notes: string | null;
  product_id: string | null;
  product_name: string | null;
  product_purchase_price: number | null;
  suggested_quantity: number | null;
  created_purchase_id: string | null;
}

interface Option {
  id: string;
  name: string;
}

export default function ActionRequestsPage() {
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const lang = useLang();
  const [suppliers, setSuppliers] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [supplierDrafts, setSupplierDrafts] = useState<Record<string, string>>({});
  const [branchDrafts, setBranchDrafts] = useState<Record<string, string>>({});
  const [quantityDrafts, setQuantityDrafts] = useState<Record<string, string>>({});
  const [unitCostDrafts, setUnitCostDrafts] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/bridge-ai/action-requests");
      const data = await res.json();
      setRequests(data.requests ?? []);
      setSuppliers(data.suppliers ?? []);
      setBranches(data.branches ?? []);

      const qDrafts: Record<string, string> = {};
      const cDrafts: Record<string, string> = {};
      (data.requests ?? []).forEach((r: ActionRequest) => {
        if (r.suggested_quantity) qDrafts[r.id] = String(r.suggested_quantity);
        if (r.product_purchase_price) cDrafts[r.id] = String(r.product_purchase_price);
      });
      setQuantityDrafts((d) => ({ ...qDrafts, ...d }));
      setUnitCostDrafts((d) => ({ ...cDrafts, ...d }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function decide(id: string, status: "approved" | "rejected" | "needs_changes") {
    setBusyId(id);
    try {
      await fetch(`/api/bridge-ai/action-requests/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          reviewNotes: noteDrafts[id] ?? "",
          supplierId: supplierDrafts[id] ?? null,
          branchId: branchDrafts[id] ?? null,
          quantity: quantityDrafts[id] ?? null,
          unitCost: unitCostDrafts[id] ?? null,
        }),
      });
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const pending = requests.filter((r) => r.status === "pending");
  const decided = requests.filter((r) => r.status !== "pending");

  return (
    <div>
      <PageHeader
        title={t("ba_action_requests", lang)}
        description="AI ne jo bhi actions propose kiye hain - unhe yahan approve, reject, ya 'changes chahiye' mark karein. Jab tak approve na ho, koi database change nahi hota."
      />

      <div className="mt-4 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Pending ({pending.length})
        </h2>
        {loading ? (
          <p className="text-sm text-surface-400">{t("ba_loading", lang)}</p>
        ) : pending.length === 0 ? (
          <p className="text-sm text-surface-400">{t("ba_no_pending", lang)}</p>
        ) : (
          <div className="space-y-4">
            {pending.map((r) => (
              <div key={r.id} className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
                      {r.action_type}
                    </span>
                    <p className="mt-2 text-sm font-medium text-surface-900 dark:text-surface-100">{r.description}</p>
                    {r.details && <p className="mt-1 text-sm text-surface-600 dark:text-surface-400">{r.details}</p>}
                    {r.product_name && (
                      <p className="mt-1 text-xs font-medium text-brand-700 dark:text-brand-400">
                        Product identified: {r.product_name}
                      </p>
                    )}
                  </div>
                  <span className="shrink-0 text-xs text-surface-400">{new Date(r.created_at).toLocaleString()}</span>
                </div>

                {r.product_id && (
                  <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border border-surface-200 bg-white p-3 dark:border-surface-700 dark:bg-surface-900 sm:grid-cols-4">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-surface-500">{t("c_supplier", lang)}</label>
                      <select
                        value={supplierDrafts[r.id] ?? ""}
                        onChange={(e) => setSupplierDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-800"
                      >
                        <option value="">{t("ba_select", lang)}</option>
                        {suppliers.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                      <label className="text-xs text-surface-500">{t("c_branch", lang)}</label>
                      <select
                        value={branchDrafts[r.id] ?? ""}
                        onChange={(e) => setBranchDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-800"
                      >
                        <option value="">{t("ba_select", lang)}</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-surface-500">{t("c_quantity", lang)}</label>
                      <input
                        type="number"
                        value={quantityDrafts[r.id] ?? ""}
                        onChange={(e) => setQuantityDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-800"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-surface-500">{t("ba_unit_cost", lang)}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={unitCostDrafts[r.id] ?? ""}
                        onChange={(e) => setUnitCostDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                        className="mt-1 w-full rounded-lg border border-surface-200 bg-white px-2 py-1.5 text-xs dark:border-surface-700 dark:bg-surface-800"
                      />
                    </div>
                  </div>
                )}

                <textarea
                  placeholder={t("ba_note_optional", lang)}
                  value={noteDrafts[r.id] ?? ""}
                  onChange={(e) => setNoteDrafts((d) => ({ ...d, [r.id]: e.target.value }))}
                  rows={2}
                  className="mt-3 w-full rounded-lg border border-surface-200 bg-white px-3 py-2 text-sm dark:border-surface-700 dark:bg-surface-800"
                />

                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => decide(r.id, "approved")}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    {r.product_id ? "Approve & Create Purchase Order" : "Approve"}
                  </button>
                  <button
                    onClick={() => decide(r.id, "needs_changes")}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    <MessageSquareWarning className="h-3.5 w-3.5" />{t("at_changes_needed", lang)}</button>
                  <button
                    onClick={() => decide(r.id, "rejected")}
                    disabled={busyId === r.id}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                  >
                    <XCircle className="h-3.5 w-3.5" />{t("at_reject", lang)}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-card border border-surface-200 bg-white p-5 shadow-card dark:border-surface-800 dark:bg-surface-900">
        <h2 className="mb-3 font-display text-base font-semibold text-surface-900 dark:text-surface-100">
          Pehle Decide Hui Requests ({decided.length})
        </h2>
        {decided.length === 0 ? (
          <p className="text-sm text-surface-400">{t("ba_no_decision_yet", lang)}</p>
        ) : (
          <div className="space-y-3">
            {decided.map((r) => (
              <div key={r.id} className="rounded-lg border border-surface-100 p-3 dark:border-surface-800">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-surface-700 dark:text-surface-300">{r.description}</p>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                      r.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : r.status === "rejected"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-700"
                    }`}
                  >
                    {r.status === "approved" ? "Approved" : r.status === "rejected" ? "Rejected" : "Changes Chahiye"}
                  </span>
                </div>
                {r.review_notes && <p className="mt-1 text-xs text-surface-500">{r.review_notes}</p>}
                {r.created_purchase_id && (
                  <Link
                    href="/admin/purchases"
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-600 hover:underline"
                  >
                    <PackageCheck className="h-3.5 w-3.5" />{t("at_po_created", lang)}</Link>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}