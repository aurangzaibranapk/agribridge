"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { UNRESTRICTED_ROLES } from "@/lib/access/permissions";
import { logAudit } from "@/lib/audit";
import { pkEndOfDayIso, validateGrant } from "@/lib/recovery/exemption";

const PATH = "/admin/branch-credit/exemptions";

async function requireAdmin(): Promise<{ id: string } | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const service = createServiceClient() as any;
  const { data: p } = await service.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!p?.is_active || !UNRESTRICTED_ROLES.includes(p.role)) return null;
  return { id: user.id };
}

export async function grantBranchExemption(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  if (!me) throw new Error("Sirf Admin/Owner chhoot de sakta hai.");
  const branchId = String(formData.get("branch_id") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  const untilIso = pkEndOfDayIso(String(formData.get("valid_until") ?? ""));
  const err = !branchId ? "Shop chunein." : validateGrant({ reason, untilIso });
  if (err) throw new Error(err);
  const service = createServiceClient() as any;
  const { data, error } = await service.from("branch_credit_exemptions")
    .insert({ branch_id: branchId, reason, valid_until: untilIso, approved_by: me.id })
    .select("id").single();
  if (error) throw new Error(error.message);
  await logAudit({ actionType: "create", module: "branch_credit_exemptions", recordId: data.id, recordLabel: branchId, description: `Udhaar rok se chhoot ${untilIso} tak: ${reason}` });
  revalidatePath(PATH);
}

export async function revokeBranchExemption(formData: FormData): Promise<void> {
  const me = await requireAdmin();
  if (!me) throw new Error("Sirf Admin/Owner chhoot wapas le sakta hai.");
  const id = String(formData.get("id") ?? "");
  const service = createServiceClient() as any;
  const { error } = await service.from("branch_credit_exemptions")
    .update({ revoked_at: new Date().toISOString(), revoked_by: me.id }).eq("id", id).is("revoked_at", null);
  if (error) throw new Error(error.message);
  await logAudit({ actionType: "update", module: "branch_credit_exemptions", recordId: id, recordLabel: id, description: "Chhoot wapas li" });
  revalidatePath(PATH);
}
