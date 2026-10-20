"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface CcState {
  error?: string;
  ok?: string;
  number?: string;
  login?: string;
  password?: string;
}

async function session() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." } as const;
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active) return { error: "Ye account fa'aal nahi hai." } as const;
  return { supabase, role: String(me.role) };
}

/** Category form se. Channel hamesha SMS — client ki choice nahi. */
export async function createComplaint(_prev: CcState, formData: FormData): Promise<CcState> {
  const who = await session();
  if ("error" in who) return { error: who.error };
  const kind = String(formData.get("kind") ?? "");
  const partyId = String(formData.get("party_id") ?? "");
  const category = String(formData.get("category") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const { data, error } = await (who.supabase as unknown as {
    rpc: (fn: string, args: Record<string, string>) => Promise<{ data: { number?: string; sms?: string } | null; error: { message: string } | null }>;
  }).rpc("fn_cc_create_complaint", {
    p_kind: kind,
    p_id: partyId,
    p_category: category,
    p_description: description,
    p_channel: "sms",
  });
  if (error) return { error: error.message };
  revalidatePath("/admin/call-center");
  revalidatePath("/admin/call-center/complaints");
  const sms = data?.sms === "queued" ? "SMS queue mein hai." : "Mobile darj nahi — SMS nahi gayi.";
  return { ok: `Shikayat ${data?.number ?? ""} darj ho gayi. ${sms}`, number: data?.number };
}

export async function setComplaintStatus(_prev: CcState, formData: FormData): Promise<CcState> {
  const who = await session();
  if ("error" in who) return { error: who.error };
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  const { data, error } = await (who.supabase as unknown as {
    rpc: (fn: string, args: Record<string, string>) => Promise<{ data: { number?: string; status?: string } | null; error: { message: string } | null }>;
  }).rpc("fn_cc_set_complaint_status", { p_id: id, p_status: status });
  if (error) return { error: error.message };
  revalidatePath("/admin/call-center/complaints");
  return { ok: `${data?.number ?? "Shikayat"} ab ${data?.status ?? status} hai.` };
}

/**
 * Admin seedha account banata hai. Koi joining email nahi. Jawab sirf SMS.
 * Password sirf isi jawab mein ek dafa.
 */
export async function createCallCenterAgent(_prev: CcState, formData: FormData): Promise<CcState> {
  const who = await session();
  if ("error" in who) return { error: who.error };
  if (!["owner", "super_admin", "admin"].includes(who.role)) {
    return { error: "Agent sirf Admin banata hai." };
  }
  const name = String(formData.get("full_name") ?? "").trim();
  const digits = String(formData.get("mobile") ?? "").replace(/\D/g, "");
  if (name.length < 3) return { error: "Naam likhein." };
  if (!/^03\d{9}$/.test(digits)) return { error: "Mobile 03 se shuru, 11 hindse." };

  const service = createServiceClient();
  const password = `${randomBytes(9).toString("base64url")}Aa1`;
  const login = `cc.${digits}@staff.alrana.local`;
  const phone = `+92${digits.slice(1)}`;
  let userId: string | null = null;
  const withPhone = await service.auth.admin.createUser({
    email: login,
    password,
    email_confirm: true,
    phone,
    phone_confirm: true,
    user_metadata: { full_name: name },
  });
  if (withPhone.error || !withPhone.data.user) {
    const emailOnly = await service.auth.admin.createUser({
      email: login,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (emailOnly.error || !emailOnly.data.user) {
      return { error: emailOnly.error?.message ?? withPhone.error?.message ?? "Account nahi bana." };
    }
    userId = emailOnly.data.user.id;
  } else {
    userId = withPhone.data.user.id;
  }

  const { data, error } = await (who.supabase as unknown as {
    rpc: (fn: string, args: Record<string, string>) => Promise<{ data: { agent_code?: string } | null; error: { message: string } | null }>;
  }).rpc("fn_cc_register_agent", { p_profile: userId, p_mobile: digits, p_name: name });
  if (error || !data?.agent_code) {
    await service.auth.admin.deleteUser(userId);
    return { error: error?.message ?? "Agent register nahi hua." };
  }
  revalidatePath("/admin/call-center/agents");
  return {
    ok: `${data.agent_code} ban gaya. Ye password dobara nahi dikhega.`,
    login,
    password,
    number: data.agent_code,
  };
}
