import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { PageHeader, Card } from "@/components/ui/layout-primitives";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { configuredSupportAgents } from "@/lib/support/agent-dispatch";
import { addSupportDepartmentMember, createSupportDepartment, removeSupportDepartmentMember, updateSupportDepartment } from "@/actions/support-departments";

export const dynamic = "force-dynamic";
const MANAGERS = new Set(["owner", "super_admin", "admin", "manager", "admin_assistant"]);

/** Support departments (539): Development Team = AI agents + developers; wapsi aur notification ki setting. */
export default async function SupportDepartmentsPage() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) redirect("/login");
  const service = createServiceClient() as any;
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !MANAGERS.has(String(me.role))) return <div className="p-8 text-center text-surface-500">Ijazat nahi hai.</div>;
  const canEdit = UNRESTRICTED_ROLES.includes(me.role);
  const [{ data: depts, error }, { data: staff }, { data: openTickets }] = await Promise.all([
    service.from("support_departments").select("*").eq("organization_id", me.organization_id).order("name"),
    service.from("profiles").select("id,full_name,role").eq("organization_id", me.organization_id).eq("is_active", true).not("role", "in", "(customer,farmer,dealer,investor,machinery_vendor,company_rep)").order("full_name"),
    service.from("support_tickets").select("department_id,status").eq("organization_id", me.organization_id).neq("status", "resolved"),
  ]);
  if (error) return <div className="p-8 text-center text-amber-700">Departments abhi set nahi (migration 539 live nahi?).</div>;
  const ids = (depts ?? []).map((d: any) => d.id);
  const { data: members } = ids.length ? await service.from("support_department_members").select("*, person:profiles(full_name,role)").in("department_id", ids).eq("is_active", true) : { data: [] };
  const agents = configuredSupportAgents();
  const openCount = (id: string) => (openTickets ?? []).filter((t: any) => t.department_id === id).length;
  return (
    <div className="space-y-4">
      <PageHeader title="Support Departments" description="Chat bot Support tab ke issues intake department (Development Team) mein aate hain. Resolve ke baad wapsi Admin ko, phir verify & close par notification." />
      <div className="grid gap-4 lg:grid-cols-2">
        {(depts ?? []).map((d: any) => {
          const list = (members ?? []).filter((m: any) => m.department_id === d.id);
          return (
            <Card key={d.id} className="space-y-3 p-4 text-sm">
              <div className="flex items-center justify-between"><b className="text-base">{d.name}</b><span className="text-xs text-surface-500">{openCount(d.id)} khule{d.is_default_intake ? " · intake" : ""}</span></div>
              {d.description && <p className="text-xs text-surface-500">{d.description}</p>}
              <ul className="divide-y divide-surface-100">
                {list.map((m: any) => (
                  <li key={m.id} className="flex items-center gap-2 py-2">
                    <span>{m.member_kind === "agent" ? "🤖" : "👤"}</span>
                    <span className="flex-1">{m.member_kind === "agent" ? m.agent_label ?? m.agent_key : m.person?.full_name ?? "Staff"}<span className="ml-1 text-[10px] text-surface-400">{m.member_kind === "agent" ? `AI agent${agents.some((a) => a.key === m.agent_key) ? " · connected" : " · server par connect nahi"}` : m.person?.role}</span></span>
                    {canEdit && <form action={removeSupportDepartmentMember}><input type="hidden" name="id" value={m.id} /><button className="text-[10px] text-red-600">Hatayein</button></form>}
                  </li>
                ))}
                {list.length === 0 && <li className="py-2 text-xs text-surface-400">Koi member nahi</li>}
              </ul>
              {canEdit && (
                <>
                  <form action={addSupportDepartmentMember} className="flex gap-1">
                    <input type="hidden" name="department_id" value={d.id} />
                    <select name="member" className="input min-w-0 flex-1 text-xs" defaultValue="">
                      <option value="">+ Member / Agent</option>
                      <optgroup label="Staff / Developer">{(staff ?? []).map((p: any) => <option key={p.id} value={`person:${p.id}`}>{p.full_name} · {p.role}</option>)}</optgroup>
                      <optgroup label="AI Agents">{[{ key: "agribridge_assistant", label: "AgriBridge Assistant" }, ...agents].map((a) => <option key={a.key} value={`agent:${a.key}`}>{a.label}</option>)}</optgroup>
                    </select>
                    <button className="btn-primary rounded-md px-2 text-xs">Shamil</button>
                  </form>
                  <form action={updateSupportDepartment} className="grid grid-cols-2 gap-2 text-xs">
                    <input type="hidden" name="id" value={d.id} />
                    <label>Resolve ke baad wapsi<select name="return_to_department_id" defaultValue={d.return_to_department_id ?? ""} className="input mt-1 w-full"><option value="">Admin (default)</option>{(depts ?? []).filter((x: any) => x.id !== d.id).map((x: any) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
                    <label>Hal hone par notification<select name="notify_scope" defaultValue={d.notify_scope} className="input mt-1 w-full"><option value="reporter_team">Reporter + team</option><option value="all_staff">Sab staff</option></select></label>
                    <label className="col-span-2 flex items-center gap-2"><input type="checkbox" name="is_default_intake" defaultChecked={d.is_default_intake} /> Naye issues isi department mein (intake)</label>
                    <button className="col-span-2 rounded-md border px-2 py-1">Mehfooz</button>
                  </form>
                </>
              )}
            </Card>
          );
        })}
      </div>
      {canEdit && (
        <Card className="p-4">
          <form action={createSupportDepartment} className="flex flex-wrap gap-2 text-sm"><input name="name" placeholder="Naya department (e.g. Accounts)" className="input" /><input name="description" placeholder="Tafseel" className="input flex-1" /><button className="btn-primary rounded-md px-3">Banayein</button></form>
        </Card>
      )}
    </div>
  );
}
