"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";

/**
 * Party links (621) — customer aur supplier ko ek banda dikhana.
 * Sirf DIKHANE ka jorr hai: koi balance khud nahi katta. Set-off sirf
 * Settlements ki manzoori (maker-checker) se.
 */
export interface LinkState { error?: string; success?: boolean; message?: string }

const LINK_ROLES = ["owner", "super_admin", "admin", "finance"];

async function who() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." } as const;
  const { data: p } = await supabase.from("profiles").select("role, is_active, organization_id").eq("id", user.id).maybeSingle();
  if (!p?.is_active) return { error: "Ye account fa'aal nahi hai." } as const;
  if (!LINK_ROLES.includes(String(p.role))) return { error: "Party link sirf Owner/Admin/Finance bana sakta hai." } as const;
  return { userId: user.id, orgId: (p.organization_id as string | null) ?? null };
}

const svc = () => createServiceClient() as unknown as { from: (t: string) => any };

export async function partyLinkBanayein(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const w = await who();
  if ("error" in w) return { error: w.error };
  const customerId = String(formData.get("customer_id") ?? "").trim();
  const supplierId = String(formData.get("supplier_id") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  if (!customerId || !supplierId) return { error: "Customer aur supplier dono chunein." };

  const db = svc();
  const [{ data: c }, { data: s }] = await Promise.all([
    db.from("customers").select("id, name").eq("id", customerId).maybeSingle(),
    db.from("suppliers").select("id, name").eq("id", supplierId).maybeSingle(),
  ]);
  if (!c || !s) return { error: "Customer ya supplier nahi mila." };

  const { data: row, error } = await db.from("party_links")
    .insert({ customer_id: customerId, supplier_id: supplierId, note, organization_id: w.orgId, created_by: w.userId })
    .select("id").single();
  if (error) {
    if (String(error.code) === "23505") return { error: "Ye dono pehle se linked hain." };
    return { error: error.message };
  }
  await logAudit({ actionType: "create", module: "party_links", recordId: row?.id, recordLabel: `${c.name} ↔ ${s.name}`,
    description: `Customer "${c.name}" aur supplier "${s.name}" ek banda mark hue.${note ? ` Note: ${note}` : ""}` });
  revalidatePath("/admin/party-links");
  return { success: true, message: `${c.name} ↔ ${s.name} link ho gaye.` };
}

export async function partyLinkKhatam(_prev: LinkState, formData: FormData): Promise<LinkState> {
  const w = await who();
  if ("error" in w) return { error: w.error };
  const id = String(formData.get("id") ?? "").trim();
  if (!id) return { error: "Link nahi mila." };
  const db = svc();
  const { count } = await db.from("party_settlements").select("id", { count: "exact", head: true })
    .eq("party_link_id", id).eq("status", "pending");
  if ((count ?? 0) > 0) return { error: "Is link par adjustment manzoori ke intezar mein hai — pehle us ka faisla karein." };
  const { error } = await db.from("party_links")
    .update({ is_active: false, deactivated_by: w.userId, deactivated_at: new Date().toISOString() })
    .eq("id", id).eq("is_active", true);
  if (error) return { error: error.message };
  await logAudit({ actionType: "update", module: "party_links", recordId: id, recordLabel: id, description: "Party link band kiya." });
  revalidatePath("/admin/party-links");
  return { success: true, message: "Link band ho gaya." };
}
