import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/utils/format";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import { Undo2, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";
import { t } from "@/lib/i18n/translations";
import { getLanguageFromCookies } from "@/lib/i18n/get-language";

export const dynamic = "force-dynamic";

function statusTone(status: string) {
  if (status === "received") return "green" as const;
  if (status === "rejected") return "red" as const;
  return "amber" as const;
}

const STATUS_LABEL: Record<string, string> = {
  pending: "HQ ke intezar mein",
  received: "HQ ne receive kar liya",
  rejected: "Reject hua",
};

const REASON_LABEL: Record<string, string> = {
  damaged: "Maal kharab tha",
  unsold: "Bika nahi",
  both: "Kharab + Bika nahi",
};

export default async function AgriReturnsPage() {
  const lang = getLanguageFromCookies("rm");
  const supabase = createClient();

  const { data: returns } = await supabase
    .from("agri_order_returns")
    .select("id, return_number, reason, status, total_amount, created_at, received_at, created_by, received_by, rejection_reason, branches(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = returns ?? [];

  // Kis stage par kaun -- naam ke sath.
  //
  // Malik (6 September): *"return kis stage par kia hua wo track."*
  //
  // Table mein `created_by` aur `received_by` pehle se the, magar safhe
  // par sirf "pending / received" ka thappa nazar aata tha. Us se ye
  // sawal kabhi jawab nahi paata: kis ne bheja, aur kis ne andar liya?
  // Wapsi ka jhagRa hamesha isi sawal par hota hai.
  const bandeIds = [
    ...new Set(rows.flatMap((r) => [r.created_by, r.received_by]).filter((x): x is string => !!x)),
  ];
  const naamMap = new Map<string, string>();
  if (bandeIds.length > 0) {
    const { data: log } = await supabase.from("profiles").select("id, full_name").in("id", bandeIds);
    for (const p of log ?? []) naamMap.set(p.id, p.full_name ?? "—");
  }
  const naam = (id: string | null) => (id ? (naamMap.get(id) ?? "—") : "—");
  const pending = rows.filter((r) => r.status === "pending");
  const received = rows.filter((r) => r.status === "received");
  const pendingValue = pending.reduce((sum, r) => sum + Number(r.total_amount), 0);
  const receivedValue = received.reduce((sum, r) => sum + Number(r.total_amount), 0);

  return (
    <div>
      <PageHeader
        title={t("agr_title", lang)}
        description="Shop maal wapas bhejti hai, HQ receive kar ke khate se kam karta hai."
        actions={
          <Link href="/admin/agri-returns/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" />{t("at_new_return", lang)}</Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Clock className="h-3.5 w-3.5 text-amber-600" />{t("ar_waiting_hq", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{pending.length}</p>
          <p className="text-xs text-surface-500">Rs {pendingValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" />{t("ar_received_done", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{received.length}</p>
          <p className="text-xs text-surface-500">Rs {receivedValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><XCircle className="h-3.5 w-3.5 text-red-500" />{t("ar_rejected_done", lang)}</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{rows.filter((r) => r.status === "rejected").length}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={t("agr_none_yet", lang)} description="Shop jab maal wapas bhejegi to yahan nazar aayega." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">{t("ar_return_no", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_shop", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_reason", lang)}</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">{t("c_value", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">{t("c_status", lang)}</th>
                <th className="px-3 py-2 font-medium text-surface-500">Kis stage par, kaun</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const branchRel: any = (r as any).branches;
                const branchName = Array.isArray(branchRel) ? branchRel[0]?.name : branchRel?.name;
                return (
                  <tr key={r.id} className="border-b border-surface-100 last:border-0 hover:bg-surface-50 dark:border-surface-800 dark:hover:bg-surface-800/50">
                    <td className="px-3 py-2">
                      <Link href={`/admin/agri-returns/${r.id}`} className="flex items-center gap-1.5 font-mono text-xs text-brand-600 hover:underline">
                        <Undo2 className="h-3.5 w-3.5" /> {r.return_number}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-surface-700 dark:text-surface-300">{branchName ?? "-"}</td>
                    <td className="px-3 py-2 text-surface-600 dark:text-surface-400">{REASON_LABEL[r.reason] ?? r.reason}</td>
                    <td className="px-3 py-2 text-right font-medium text-surface-900 dark:text-white">Rs {Number(r.total_amount).toLocaleString()}</td>
                    <td className="px-3 py-2"><Badge tone={statusTone(r.status)}>{STATUS_LABEL[r.status] ?? r.status}</Badge></td>
                    <td className="px-3 py-2 text-[11px] leading-relaxed text-surface-500 dark:text-surface-400">
                      <span className="block">
                        Bheja: <b className="font-medium text-surface-700 dark:text-surface-300">{naam(r.created_by)}</b>{" "}
                        · {formatDate(r.created_at)}
                      </span>
                      {r.received_at ? (
                        <span className="block">
                          {r.status === "rejected" ? "Radd kia" : "Andar liya"}:{" "}
                          <b className="font-medium text-surface-700 dark:text-surface-300">{naam(r.received_by)}</b>{" "}
                          · {formatDate(r.received_at)}
                        </span>
                      ) : (
                        // "Abhi kisi ne dekha nahi" aur "radd ho gaya" do
                        // alag baatein hain -- dono ko ek jaisa likhna
                        // wapsi ke jhagRe ka sab se aam sabab hai.
                        <span className="block text-amber-700 dark:text-amber-400">HQ ne abhi andar nahi liya</span>
                      )}
                      {r.rejection_reason && (
                        <span className="block text-red-600 dark:text-red-400">Wajah: {r.rejection_reason}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
