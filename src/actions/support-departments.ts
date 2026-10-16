"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";

/** Departments (539) -- sirf Owner/Super Admin/Admin badal sakta hai. */
async function adminCtx() {
  const { data: { user } } = await createClient().auth.getUser();
  if (!user) throw new Error("Login zaroori hai.");
  const service = createServiceClient() as any;
  const { data: me } = await service.from("profiles").select("id,role,organization_id,is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !UNRESTRICTED_ROLES.includes(me.role)) throw new Error("Sirf Admin/Owner departments badal sakta hai.");
  return { service, me };
}

async function ownDept(service: any, orgId: string, id: string) {
  const { data } = await service.from("support_departments").select("id").eq("id", id).eq("organization_id", orgId).maybeSingle();
  if (!data) throw new Error("Department nahi mila.");
}

export async function createSupportDepartment(formData: FormData): Promise<void> {
  const { service, me } = await adminCtx();
  const name = String(formData.get("name") ?? "").trim();
  if (name.length < 2) throw new Error("Naam likhein.");
  const { error } = await service.from("support_departments").insert({ organization_id: me.organization_id, name: name.slice(0, 80), description: String(formData.get("description") ?? "").trim() || null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/support-center/departments");
}

export async function updateSupportDepartment(formData: FormData): Promise<void> {
  const { service, me } = await adminCtx();
  const id = String(formData.get("id") ?? "");
  await ownDept(service, me.organization_id, id);
  const returnTo = String(formData.get("return_to_department_id") ?? "") || null;
  if (returnTo) await ownDept(service, me.organization_id, returnTo);
  const scope = formData.get("notify_scope") === "all_staff" ? "all_staff" : "reporter_team";
  if (formData.get("is_default_intake") === "on") {
    await service.from("support_departments").update({ is_default_intake: false }).eq("organization_id", me.organization_id).neq("id", id);
  }
  const { error } = await service.from("support_departments").update({
    return_to_department_id: returnTo === id ? null : returnTo, notify_scope: scope, is_default_intake: formData.get("is_default_intake") === "on",
  }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/support-center/departments");
}

export async function addSupportDepartmentMember(formData: FormData): Promise<void> {
  const { service, me } = await adminCtx();
  const departmentId = String(formData.get("department_id") ?? "");
  await ownDept(service, me.organization_id, departmentId);
  const raw = String(formData.get("member") ?? "");
  const [kind, value] = [raw.slice(0, raw.indexOf(":")), raw.slice(raw.indexOf(":") + 1)];
  let row: Record<string, unknown>;
  if (kind === "person") {
    const { data: p } = await service.from("profiles").select("id,organization_id,is_active").eq("id", value).maybeSingle();
    if (!p?.is_active || p.organization_id !== me.organization_id) throw new Error("Staff nahi mila.");
    row = { department_id: departmentId, member_kind: "person", profile_id: p.id };
  } else if (kind === "agent" && /^[a-z0-9_-]{2,60}$/.test(value)) {
    row = { department_id: departmentId, member_kind: "agent", agent_key: value, agent_label: String(formData.get("agent_label") ?? "").trim() || value };
  } else throw new Error("Member chunein.");
  const { error } = await service.from("support_department_members").upsert({ ...row, is_active: true }, { onConflict: kind === "person" ? "department_id,profile_id" : "department_id,agent_key", ignoreDuplicates: false });
  if (error) {
    // partial unique index par upsert na chale to seedha insert/activate.
    const q = service.from("support_department_members").update({ is_active: true }).eq("department_id", departmentId);
    const { error: e2 } = kind === "person" ? await q.eq("profile_id", value) : await q.eq("agent_key", value);
    if (e2) throw new Error(error.message);
  }
  revalidatePath("/admin/support-center/departments");
}

export async function removeSupportDepartmentMember(formData: FormData): Promise<void> {
  const { service, me } = await adminCtx();
  const id = String(formData.get("id") ?? "");
  const { data: m } = await service.from("support_department_members").select("id,department_id").eq("id", id).maybeSingle();
  if (!m) throw new Error("Member nahi mila.");
  await ownDept(service, me.organization_id, m.department_id);
  // Delete nahi -- sirf band (audit ke liye).
  const { error } = await service.from("support_department_members").update({ is_active: false }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/support-center/departments");
}
