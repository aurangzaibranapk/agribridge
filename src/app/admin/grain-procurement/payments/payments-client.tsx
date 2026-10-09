"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { recordGrainPayment, type ActionState } from "@/actions/grain-procurement";
import { Button, Input, Label, Select, Textarea } from "@/components/ui/form";
import { Card } from "@/components/ui/layout-primitives";
import { Search, X, Wallet, AlertTriangle } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { useLang } from "@/lib/i18n/lang-context";
import { enqueue, allActions, type QueuedAction } from "@/lib/offline/queue";
import { registerSender, syncQueue } from "@/lib/offline/sync";
import Link from "next/link";
import {
  GrainPaymentActionId,
  GrainPaymentAccountField,
  GrainPaymentDateField,
  GrainPaymentSlipField,
  GrainPaymentSuccess,
} from "@/components/grain/grain-payment-fields";

const initialState: ActionState = {};

interface Row {
  id: string;
  seller_type: "farmer" | "party";
  name: string;
  sub: string;
  phone: string | null;
  supplied: number;
  paid: number;
  due: number;
}

export function GrainPaymentsClient({
  rows,
  accounts,
}: {
  rows: Row[];
  accounts: { id: string; name: string }[];
  recentCount: number;
}) {
  const lang = useLang();
  const [query, setQuery] = useState("");
  const [draftQuery, setDraftQuery] = useState("");
  const [paying, setPaying] = useState<Row | null>(null);
  const [offlinePending, setOfflinePending] = useState(0);

  useEffect(() => {
    registerSender("grain.payment", async (action: QueuedAction, evidence) => {
      try {
        const body = new FormData();
        body.set("fields", JSON.stringify(action.payload.fields ?? {}));
        const photo = evidence.find((item) => item.slot === "receipt_photo");
        if (photo) body.set("receipt_photo", photo.blob, "grain-receiving-photo.jpg");
        const res = await fetch("/api/grain-procurement/payment", { method: "POST", body });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return { ok: false, retryable: res.status >= 500, error: json.error || "Grain payment sync fail ho gayi." };
        return { ok: true };
      } catch (error) {
        return { ok: false, retryable: true, error: error instanceof Error ? error.message : "Network error" };
      }
    });
    const refresh = async () => {
      const rows = await allActions().catch(() => []);
      setOfflinePending(rows.filter((row) => row.action_type === "grain.payment" && (row.sync_status === "pending" || row.sync_status === "syncing")).length);
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

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.sub.toLowerCase().includes(q) ||
        (r.phone ?? "").includes(q)
    );
  }, [rows, query]);

  const totalDue = rows.reduce((s, r) => s + Math.max(0, r.due), 0);
  const owedCount = rows.filter((r) => r.due > 0).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Card className="border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/30">
          <div className="flex items-center gap-2 text-red-600">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-medium uppercase tracking-wide">{t("gp_total_due", lang)}</span>
          </div>
          <p className="mt-2 font-display text-xl font-semibold text-red-700 dark:text-red-300">
            Rs {Math.round(totalDue).toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-surface-500">{t("gp_owed_count", lang)}</p>
          <p className="mt-2 font-display text-xl font-semibold text-surface-900 dark:text-white">{owedCount}</p>
        </Card>
      </div>
      {offlinePending > 0 && <p className="text-xs text-amber-700 dark:text-amber-400">{offlinePending} grain payments sync ka intezar kar rahi hain.</p>}

      <form onSubmit={(event) => { event.preventDefault(); setQuery(draftQuery); }} className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-surface-400" />
        <input
          value={draftQuery}
          onChange={(e) => setDraftQuery(e.target.value)}
          placeholder={t("gp_search", lang)}
          className="w-full rounded-lg border border-surface-200 p-2 pl-9 text-sm dark:border-surface-800 dark:bg-surface-900"
        />
        </div>
        <button type="submit" className="h-10 shrink-0 rounded-lg bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">Apply</button>
      </form>

      {matches.length === 0 ? (
        <Card className="p-8 text-center text-sm text-surface-400">{t("gp_none", lang)}</Card>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left text-xs text-surface-500 dark:border-surface-800 dark:bg-surface-800">
                <th className="px-4 py-2 font-medium">{t("gp_seller", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("gp_supplied", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("gp_paid", lang)}</th>
                <th className="px-4 py-2 text-right font-medium">{t("gp_due", lang)}</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100 dark:divide-surface-800">
              {matches.map((r) => (
                <tr key={`${r.seller_type}-${r.id}`}>
                  <td className="px-4 py-2">
                    <span className="font-medium text-surface-800 dark:text-surface-200">{r.name}</span>
                    <span className="block text-xs text-surface-400">
                      {r.seller_type === "party" ? t("gr_party", lang) : t("gr_farmer", lang)}
                      {r.sub ? ` • ${r.sub}` : ""}
                      {r.phone ? ` • ${r.phone}` : ""}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                    Rs {Math.round(r.supplied).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums text-surface-600 dark:text-surface-400">
                    Rs {Math.round(r.paid).toLocaleString()}
                  </td>
                  <td
                    className={`px-4 py-2 text-right font-semibold tabular-nums ${
                      r.due > 0
                        ? "text-red-700 dark:text-red-400"
                        : r.due < 0
                          ? "text-amber-700 dark:text-amber-400"
                          : "text-green-700 dark:text-green-400"
                    }`}
                  >
                    Rs {Math.round(r.due).toLocaleString()}
                    {/* Manfi baqi ka matlab hai zyada paisa ja chuka hai --
                        ye chhupana nahi chahiye, wo bhi ek sawal hai. */}
                    {r.due < 0 && (
                      <span className="block text-xs font-normal">{t("gp_overpaid", lang)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <Link
                      href={`/admin/grain-procurement/statement?seller_type=${r.seller_type}&seller_id=${r.id}`}
                      className="mr-2 text-xs font-medium text-brand-600 hover:underline"
                    >
                      History
                    </Link>
                    {r.due > 0 && (
                      <button
                        onClick={() => setPaying(r)}
                        className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        {r.seller_type === "party" ? "Receive Payment" : t("gp_pay", lang)}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {paying && <PayModal row={paying} accounts={accounts} onClose={() => setPaying(null)} />}
    </div>
  );
}

function PayModal({
  row,
  accounts,
  onClose,
}: {
  row: Row;
  accounts: { id: string; name: string }[];
  onClose: () => void;
}) {
  const lang = useLang();
  const [state, formAction] = useFormState(recordGrainPayment, initialState);
  const [method, setMethod] = useState("cash");
  const [offlineNotice, setOfflineNotice] = useState("");
  // Kamyabi ka paighaam parhne ka waqt dein (kahan darj hua), phir taaza karein.
  useEffect(() => {
    if (!state.success) return;
    const timer = setTimeout(() => window.location.reload(), 5000);
    return () => clearTimeout(timer);
  }, [state.success]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-card bg-white p-5 shadow-xl dark:bg-surface-900">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-surface-900 dark:text-white">
            {row.seller_type === "party" ? "Receive Payment" : t("gp_pay_title", lang)}
          </h3>
          <button onClick={onClose} className="text-surface-400 hover:text-surface-700">
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mb-3 text-sm text-surface-500">
          {row.name} — {row.seller_type === "party" ? "Pending from buyer" : t("gp_due", lang)}: <strong className="text-red-600">Rs {Math.round(row.due).toLocaleString()}</strong>
        </p>

        {state.error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{state.error}</p>}
        {state.success && (
          <GrainPaymentSuccess
            fallback={row.seller_type === "party" ? "Wasooli darj ho gayi." : "Payment darj ho gayi."}
            notice={state.notice}
          />
        )}
        {state.success && state.paymentId && (
          <p className="mb-2 text-xs">
            <Link href={`/admin/grain-procurement/payment-slip/${state.paymentId}`} className="text-brand-600 underline">Payment slip dekhein</Link>
            {" · "}
            <Link href={`/admin/grain-procurement/statement?seller_type=${row.seller_type}&seller_id=${row.id}`} className="text-brand-600 underline">Poori history</Link>
          </p>
        )}

        <form
          action={formAction}
          encType="multipart/form-data"
          onSubmit={async (event: FormEvent<HTMLFormElement>) => {
            if (typeof navigator === "undefined" || navigator.onLine !== false) return;
            event.preventDefault();
            try {
              const formData = new FormData(event.currentTarget);
              const photo = formData.get("receipt_photo");
              const fields = Object.fromEntries(formData.entries());
              delete (fields as Record<string, FormDataEntryValue>).receipt_photo;
              const evidence = photo instanceof File && photo.size > 0 ? [{ blob: photo, slot: "receipt_photo" }] : undefined;
              await enqueue({
                actionType: "grain.payment",
                entityType: "grain_procurement_payments",
                payload: { fields },
                evidence,
              });
              setOfflineNotice("Internet nahi hai. Payment device par save ho gayi; internet aate hi farmer/buyer ledger mein post hogi.");
            } catch {
              setOfflineNotice("Offline grain payment save nahi ho saki.");
            }
          }}
          className="space-y-3"
        >
          <input type="hidden" name="seller_type" value={row.seller_type} />
          <input type="hidden" name={row.seller_type === "party" ? "party_id" : "farmer_id"} value={row.id} />
          <GrainPaymentActionId />

          <div>
            <Label>{t("gp_amount", lang)}</Label>
            <Input type="number" step="0.01" name="amount" max={row.due} defaultValue={Math.round(row.due)} required />
            <p className="mt-1 text-[11px] text-surface-500">
              {row.seller_type === "party"
                ? "Jitna paisa asal mein mila, utna likhein. Baqi raqam khate mein baqi rahegi."
                : "Jitna paisa asal mein diya, utna likhein. Kisan ka purana udhaar ho to wo khud is mein se kat jata hai."}
            </p>
          </div>

          <div>
            <Label>{t("gr_payment_method", lang)}</Label>
            <Select name="payment_method" value={method} onChange={(e) => setMethod(e.target.value)}>
              <option value="cash">{t("gr_cash", lang)}</option>
              <option value="bank_transfer">{t("gr_bank_transfer", lang)}</option>
            </Select>
          </div>

          <GrainPaymentDateField direction={row.seller_type === "party" ? "in" : "out"} />

          <GrainPaymentAccountField accounts={accounts} direction={row.seller_type === "party" ? "in" : "out"} />

          {/* Naqad par kisan ki signed raseed lazmi hai -- ye rok server par
              bhi hai. Baqi har payment par slip optional hai. */}
          {method === "cash" && row.seller_type === "farmer" ? (
            <GrainPaymentSlipField
              required
              requiredNote={`${t("gr_receiving_note", lang)} (Cash payment par Kisan ki signed raseed ki photo zaroori hai.)`}
            />
          ) : (
            <GrainPaymentSlipField />
          )}
          <div>
            <Label>{t("gr_notes", lang)}</Label>
            <Textarea name="notes" rows={2} />
          </div>

          {offlineNotice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">{offlineNotice}</p>}

          <SubmitButton label={row.seller_type === "party" ? "Wasooli darj karein" : "Payment darj karein"} />
        </form>
      </div>
    </div>
  );
}

function SubmitButton({ label = "Record Received Payment" }: { label?: string }) {
  const lang = useLang();
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? t("gr_saving", lang) : label}
    </Button>
  );
}
