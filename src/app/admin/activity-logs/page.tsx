import { createClient } from "@/lib/supabase/server";
import { PageHeader, EmptyState } from "@/components/ui/layout-primitives";

export const dynamic = "force-dynamic";

function actionColor(action: string) {
  if (action === "delete" || action === "reject") return "bg-red-100 text-red-700";
  if (action === "create" || action === "approve") return "bg-green-100 text-green-700";
  if (action === "login") return "bg-blue-100 text-blue-700";
  return "bg-surface-100 text-surface-600";
}

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<{ module?: string; action_type?: string; actor?: string }>;
}) {
  const sp = await searchParams;
  const supabase = createClient();

  let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(150);
  if (sp.module) query = query.eq("module", sp.module);
  if (sp.action_type) query = query.eq("action_type", sp.action_type);
  if (sp.actor) query = query.ilike("actor_name", `%${sp.actor}%`);

  const { data: logs } = await query;
  const { data: moduleRows } = await supabase.from("audit_logs").select("module").limit(500);
  const uniqueModules = [...new Set((moduleRows ?? []).map((r) => r.module))].sort();

  return (
    <div>
      <PageHeader title="Audit Log" description="Kaun, kya, kab - har zaroori action ka poora record" />

      <form className="mb-4 flex flex-wrap items-center gap-2">
        <select name="module" defaultValue={sp.module ?? ""} className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">Sab Modules</option>
          {uniqueModules.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select name="action_type" defaultValue={sp.action_type ?? ""} className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">Sab Actions</option>
          <option value="create">Create</option>
          <option value="update">Update</option>
          <option value="delete">Delete</option>
          <option value="approve">Approve</option>
          <option value="reject">Reject</option>
          <option value="login">Login</option>
        </select>
        <input name="actor" defaultValue={sp.actor ?? ""} placeholder="Staff naam se filter" className="rounded-lg border border-surface-200 p-2 text-sm" />
        <button type="submit" className="rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700">Filter Karein</button>
      </form>

      {!logs || logs.length === 0 ? (
        <EmptyState title="Koi activity abhi tak nahi hai" />
      ) : (
        <div className="overflow-hidden rounded-card border border-surface-200 bg-white shadow-card dark:border-surface-800 dark:bg-surface-900">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-100 text-left text-xs font-medium uppercase tracking-wide text-surface-400 dark:border-surface-800 dark:text-surface-500">
                <th className="px-4 py-3">Kisne</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Module</th>
                <th className="px-4 py-3">Detail</th>
                <th className="px-4 py-3 text-right">Kab</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b border-surface-50 last:border-0 dark:border-surface-800/60">
                  <td className="px-4 py-3 text-surface-800 dark:text-surface-200">
                    {l.actor_name ?? "System"}
                    {l.actor_role && <span className="ml-1 text-xs text-surface-400">({l.actor_role})</span>}
                  </td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${actionColor(l.action_type)}`}>{l.action_type}</span></td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{l.module}</td>
                  <td className="px-4 py-3 text-surface-600 dark:text-surface-300">{l.record_label ?? l.description ?? "-"}</td>
                  <td className="px-4 py-3 text-right text-xs text-surface-400 dark:text-surface-500">{new Date(l.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}