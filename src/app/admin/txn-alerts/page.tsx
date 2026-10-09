import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { formatPkr, formatAlertDate } from "@/lib/txn-alerts/format";
import { TxnAlertSettingsForm } from "./txn-alerts-client";
import { MessageSquare } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: "Qatar mein", cls: "bg-amber-50 text-amber-700" },
  processing: { text: "Ja raha hai", cls: "bg-blue-50 text-blue-700" },
  sent: { text: "Bhej diya", cls: "bg-emerald-50 text-emerald-700" },
  failed: { text: "Nakaam", cls: "bg-red-50 text-red-700" },
  skipped: { text: "Chhor diya", cls: "bg-surface-100 text-surface-600" },
};

/**
 * WhatsApp len-den alerts -- qatar, bheje gaye aur nakaam (migration 517).
 * Har row ek journal entry hai; entry_id unique, is liye ek entry ka
 * ek hi paighaam.
 */
export default async function TxnAlertsPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [viewGuard, editGuard] = await Promise.all([
    requireAction("system.txn_alerts", "view"),
    requireAction("system.txn_alerts", "edit"),
  ]);
  if ("error" in viewGuard) {
    return <div className="p-8 text-center text-surface-400">{viewGuard.error}</div>;
  }
  const canEdit = !("error" in editGuard);

  const service = createServiceClient() as any;
  const [{ data: settings }, { data: rows }] = await Promise.all([
    service.from("txn_whatsapp_alert_settings").select("*").eq("id", true).maybeSingle(),
    service
      .from("txn_whatsapp_alerts")
      .select(
        "id, entry_number, entry_date, source_module, alert_type, amount, party_label, account_label, detail, status, attempts, last_error, sent_at, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(150),
  ]);

  const list = (rows ?? []) as any[];
  const counts = list.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  const templateSet = Boolean(process.env.WHATSAPP_TXN_TEMPLATE);

  return (
    <div className="space-y-4">
      <PageHeader
        title="WhatsApp Len-den Alerts"
        description="Rs 1,000 se upar har payment aayi/gayi, udhaar, recovery aur bank/cash transfer ka malik ko WhatsApp paighaam."
      />

      <Card className="space-y-3 p-4">
        <div className="flex items-start gap-3">
          <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-surface-500" />
          <div className="space-y-1 text-xs text-surface-600 dark:text-surface-400">
            <p>
              Har ledger entry ka <strong>ek</strong> hi paighaam jata hai. POS sale, shift close, correction,
              repair, opening balance aur customer import shamil nahi.
            </p>
            <p>
              WhatsApp template:{" "}
              {templateSet ? (
                <strong className="text-green-700">laga hua hai (WHATSAPP_TXN_TEMPLATE)</strong>
              ) : (
                <strong className="text-amber-700">
                  abhi nahi laga -- alerts qatar mein jama ho rahe hain, bheje nahi ja rahe
                </strong>
              )}
              . {settings?.max_age_hours ?? 24} ghante se purane alerts bheje nahi jate.
            </p>
            <p className="flex flex-wrap gap-2 pt-1">
              {Object.entries(STATUS_LABEL).map(([k, v]) => (
                <span key={k} className={`rounded-md px-2 py-0.5 ${v.cls}`}>
                  {v.text}: <strong>{counts[k] ?? 0}</strong>
                </span>
              ))}
            </p>
          </div>
        </div>
        {canEdit && settings && (
          <TxnAlertSettingsForm enabled={Boolean(settings.enabled)} minAmount={Number(settings.min_amount)} />
        )}
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-xs">
          <thead className="bg-surface-50 text-surface-500 dark:bg-surface-800">
            <tr>
              <th className="px-3 py-2 text-left">Tareekh</th>
              <th className="px-3 py-2 text-left">Qism</th>
              <th className="px-3 py-2 text-right">Raqam</th>
              <th className="px-3 py-2 text-left">Party</th>
              <th className="px-3 py-2 text-left">Account</th>
              <th className="px-3 py-2 text-left">Ref</th>
              <th className="px-3 py-2 text-left">Halat</th>
            </tr>
          </thead>
          <tbody>
            {list.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-surface-400">
                  Abhi koi alert nahi.
                </td>
              </tr>
            ) : (
              list.map((r) => {
                const st = STATUS_LABEL[r.status] ?? { text: r.status, cls: "" };
                return (
                  <tr key={r.id} className="border-t border-surface-100 align-top dark:border-surface-800">
                    <td className="px-3 py-2 whitespace-nowrap">{formatAlertDate(r)}</td>
                    <td className="px-3 py-2">
                      <div className="font-semibold">{r.alert_type}</div>
                      <div className="text-[10px] text-surface-400">{r.source_module}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-semibold whitespace-nowrap">Rs {formatPkr(r.amount)}</td>
                    <td className="px-3 py-2">{r.party_label}</td>
                    <td className="px-3 py-2">{r.account_label}</td>
                    <td className="px-3 py-2">
                      <div className="font-mono">{r.entry_number}</div>
                      <div className="max-w-xs text-[10px] text-surface-400">{r.detail}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-full px-2 py-0.5 font-semibold ${st.cls}`}>{st.text}</span>
                      {r.last_error && (
                        <div className="mt-1 max-w-xs text-[10px] text-red-600">{r.last_error}</div>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
