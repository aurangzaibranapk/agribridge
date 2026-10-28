import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { PageHeader } from "@/components/ui/layout-primitives";
import { grantBranchExemption, revokeBranchExemption } from "@/actions/branch-credit-exemptions";

export const dynamic = "force-dynamic";

function pkDay(iso: string): string {
  return new Date(Date.parse(iso) + 5 * 3_600_000).toISOString().slice(0, 10).split("-").reverse().join("-");
}

export default async function BranchCreditExemptionsPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const service = createServiceClient() as any;
  const { data: me } = await service.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !UNRESTRICTED_ROLES.includes(me.role)) redirect("/admin");

  const { data: branches } = await service.from("branches").select("id, name").eq("is_active", true).order("name");
  const { data: rows } = await service
    .from("branch_credit_exemptions")
    .select("id, branch_id, reason, valid_from, valid_until, revoked_at, created_at")
    .order("created_at", { ascending: false })
    .limit(50);
  const names = new Map<string, string>((branches ?? []).map((b: any) => [String(b.id), String(b.name)]));
  const now = Date.now();
  const def = new Date(now + 5 * 3_600_000 + 30 * 86_400_000).toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <PageHeader title="Udhaar rok se chhoot" description="30 din wali rok se shop ko waqti ijazat (sirf Admin/Owner). Har istemal record hota hai." />
      <form action={grantBranchExemption} className="grid gap-3 rounded-xl border border-surface-200 p-4 sm:grid-cols-4" data-testid="exemption-grant">
        <select name="branch_id" required className="rounded-lg border border-surface-200 p-2 text-sm">
          <option value="">Shop chunein</option>
          {(branches ?? []).map((b: any) => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <input name="valid_until" type="date" required defaultValue={def} className="rounded-lg border border-surface-200 p-2 text-sm" />
        <input name="reason" required minLength={3} placeholder="Wajah" className="rounded-lg border border-surface-200 p-2 text-sm" />
        <button type="submit" className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white">Chhoot dein</button>
      </form>
      <div className="overflow-x-auto rounded-xl border border-surface-200">
        <table className="w-full text-sm">
          <thead><tr className="text-left"><th className="p-2">Shop</th><th className="p-2">Kab tak</th><th className="p-2">Wajah</th><th className="p-2">Halat</th><th className="p-2" /></tr></thead>
          <tbody>
            {(rows ?? []).map((r: any) => {
              const live = !r.revoked_at && Date.parse(r.valid_until) > now && Date.parse(r.valid_from) <= now;
              return (
                <tr key={r.id} className="border-t border-surface-200">
                  <td className="p-2">{names.get(r.branch_id) ?? "—"}</td>
                  <td className="p-2">{pkDay(r.valid_until)}</td>
                  <td className="p-2">{r.reason}</td>
                  <td className="p-2">{r.revoked_at ? "Wapas li gayi" : live ? "Chal rahi" : "Khatam"}</td>
                  <td className="p-2">
                    {live && (
                      <form action={revokeBranchExemption}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="text-xs text-red-600 underline">Wapas lein</button>
                      </form>
                    )}
                  </td>
                </tr>
              );
            })}
            {!rows?.length && <tr><td className="p-2 text-surface-500" colSpan={5}>Koi chhoot nahi.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
