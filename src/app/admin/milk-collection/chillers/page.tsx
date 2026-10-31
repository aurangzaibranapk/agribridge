import { createClient } from "@/lib/supabase/server";
import { requireAction } from "@/lib/access/guard";
import { PageHeader, Card, EmptyState } from "@/components/ui/layout-primitives";
import { AddChillerForm, RenameChillerForm, ActiveChillerForm } from "./chiller-forms";

export const dynamic = "force-dynamic";

const ADMIN_ROLES = ["owner", "super_admin", "admin"];

export default async function ChillerMasterPage({ searchParams }: { searchParams: Promise<{ branch?: string }> }) {
  const params = await searchParams;
  const gate = await requireAction("milk-collection.chiller", "view");
  if ("error" in gate) return <div className="p-8 text-center text-surface-400">{gate.error}</div>;
  if (!ADMIN_ROLES.includes(gate.caller.role)) {
    return <div className="p-8 text-center text-surface-400">Chiller ki list sirf Admin badal sakta hai.</div>;
  }

  const supabase = createClient() as any;
  const { data: branchRows } = await supabase
    .from("branches")
    .select("id, name, is_main_branch")
    .order("is_main_branch", { ascending: false })
    .order("name");
  const branches = (branchRows ?? []) as { id: string; name: string; is_main_branch: boolean }[];
  const requested = params.branch && /^[0-9a-f-]{36}$/i.test(params.branch) ? params.branch : null;
  const branchId = requested ?? branches.find((b) => b.is_main_branch)?.id ?? branches[0]?.id ?? null;
  const branchName = branches.find((b) => b.id === branchId)?.name ?? "";

  const { data: chillers, error } = branchId
    ? await supabase.from("milk_chiller_master").select("id, sort_no, name, is_active").eq("branch_id", branchId).order("sort_no")
    : { data: [], error: null };

  return (
    <div className="space-y-6">
      <PageHeader title="Chiller ki list" description={`${branchName} · naam aur tadad sirf Admin badalta hai`} />

      <form className="flex flex-wrap items-end gap-3" method="get">
        <label className="flex flex-col text-sm">
          Branch
          <select name="branch" defaultValue={branchId ?? ""} className="rounded border px-2 py-1">
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded bg-surface-900 px-3 py-1.5 text-sm text-white">Dekhein</button>
      </form>

      {error && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Chiller ki list nahi mili. Migration 737 is database par check karein.
        </div>
      )}

      <Card className="p-4">
        <h2 className="mb-3 text-sm font-semibold text-surface-600">Chiller (slip mein isi tarteeb se aayenge)</h2>
        {branchId && (chillers ?? []).length > 0 ? (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-surface-500">
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Naam</th>
                <th className="px-3 py-2">Haal</th>
                <th className="px-3 py-2">Band / faal</th>
              </tr>
            </thead>
            <tbody>
              {(chillers as { id: string; sort_no: number; name: string; is_active: boolean }[]).map((c) => (
                <tr key={c.id} className="border-t border-surface-100 align-top">
                  <td className="px-3 py-2">{c.sort_no}</td>
                  <td className="px-3 py-2"><RenameChillerForm id={c.id} name={c.name} /></td>
                  <td className="px-3 py-2">{c.is_active ? "Faal" : "Band"}</td>
                  <td className="px-3 py-2"><ActiveChillerForm id={c.id} active={c.is_active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState title="Is branch ka chiller nahi" description="Neeche se naya chiller jorein." />
        )}
      </Card>

      {branchId && (
        <Card className="p-4">
          <h2 className="mb-3 text-sm font-semibold text-surface-600">Naya chiller jorein</h2>
          <AddChillerForm branchId={branchId} />
        </Card>
      )}
    </div>
  );
}
