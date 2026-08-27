import { createClient } from "@/lib/supabase/server";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { Badge } from "@/components/ui/form";
import Link from "next/link";
import { Undo2, Clock, CheckCircle2, XCircle, Plus } from "lucide-react";

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
  const supabase = createClient();

  const { data: returns } = await supabase
    .from("agri_order_returns")
    .select("id, return_number, reason, status, total_amount, created_at, branches(name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = returns ?? [];
  const pending = rows.filter((r) => r.status === "pending");
  const received = rows.filter((r) => r.status === "received");
  const pendingValue = pending.reduce((sum, r) => sum + Number(r.total_amount), 0);
  const receivedValue = received.reduce((sum, r) => sum + Number(r.total_amount), 0);

  return (
    <div>
      <PageHeader
        title="Returns (Branch se HQ)"
        description="Shop maal wapas bhejti hai, HQ receive kar ke khate se kam karta hai."
        actions={
          <Link href="/admin/agri-returns/new" className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Naya Return
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><Clock className="h-3.5 w-3.5 text-amber-600" /> HQ ke intezar mein</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{pending.length}</p>
          <p className="text-xs text-surface-500">Rs {pendingValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><CheckCircle2 className="h-3.5 w-3.5 text-green-600" /> Receive ho chuke</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{received.length}</p>
          <p className="text-xs text-surface-500">Rs {receivedValue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1.5 text-xs text-surface-500"><XCircle className="h-3.5 w-3.5 text-red-500" /> Reject huye</p>
          <p className="mt-1 font-display text-xl font-bold text-surface-900 dark:text-white">{rows.filter((r) => r.status === "rejected").length}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <EmptyState title="Abhi tak koi return nahi hai." description="Shop jab maal wapas bhejegi to yahan nazar aayega." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-200 bg-surface-50 text-left dark:border-surface-800 dark:bg-surface-800">
                <th className="px-3 py-2 font-medium text-surface-500">Return No.</th>
                <th className="px-3 py-2 font-medium text-surface-500">Shop</th>
                <th className="px-3 py-2 font-medium text-surface-500">Wajah</th>
                <th className="px-3 py-2 text-right font-medium text-surface-500">Value</th>
                <th className="px-3 py-2 font-medium text-surface-500">Haalat</th>
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
