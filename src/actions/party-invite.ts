"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppMessage } from "@/lib/whatsapp-client";
import { sendDeptMail } from "@/lib/mailer";
import { sendVeevoSms, veevoEnv } from "@/lib/sms/veevo";
import { logAudit } from "@/lib/audit";
import { siteOrigin } from "@/lib/payroll/site-origin";
import {
  canCreatePartyInvite,
  dispatchInvite,
  loginEmailFor,
  mapAccount,
  mapSend,
  parsePartyForm,
  partyCode,
  partyRow,
  phoneKey,
  planSend,
  roleSpec,
  type InviteAccount,
  type InviteSend,
} from "@/lib/party-invite";

export interface CreateInviteState {
  error?: string;
  account?: InviteAccount;
}

export interface SendInviteState {
  error?: string;
  send?: InviteSend;
}

type Loose = {
  from(table: string): {
    select(cols: string): any;
    insert(row: Record<string, unknown>): any;
    update(row: Record<string, unknown>): any;
    delete(): any;
    eq(col: string, val: string): any;
    maybeSingle(): Promise<{ data: any; error: { message: string } | null }>;
    single(): Promise<{ data: any; error: { message: string } | null }>;
  };
  rpc(fn: string, args: Record<string, unknown>): Promise<{ data: unknown; error: { message: string } | null }>;
  auth: {
    admin: {
      createUser(input: Record<string, unknown>): Promise<{ data: { user: { id: string } | null }; error: { message: string } | null }>;
      deleteUser(id: string): Promise<{ error: { message: string } | null }>;
    };
  };
};

function loose(client: unknown): Loose {
  return client as Loose;
}

async function caller() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." as const };
  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role, is_active, full_name")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active || !profile.organization_id || !canCreatePartyInvite(profile.role)) {
    return { error: "Sirf Admin ya Owner naya dealer / buyer bana sakta hai." as const };
  }
  return { userId: user.id, organizationId: profile.organization_id as string, name: profile.full_name as string };
}

function loginUrl() {
  return `${siteOrigin()}/login`;
}

export async function createPartyInvite(_prev: CreateInviteState, formData: FormData): Promise<CreateInviteState> {
  const who = await caller();
  if ("error" in who) return { error: who.error };

  const parsed = parsePartyForm({
    role: formData.get("role"),
    fullName: formData.get("full_name"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    branchId: formData.get("branch_id"),
  });
  if (!parsed.ok) return { error: parsed.error };
  const form = parsed.value;
  const spec = roleSpec(form.role);
  if (!spec) return { error: "Role theek nahi." };
  const key = phoneKey(form.phone);
  if (!key) return { error: "Mobile poora likhein." };

  const service = loose(createServiceClient());
  const { data: branch, error: branchError } = await service
    .from("branches")
    .select("id, name, organization_id, is_active")
    .eq("id", form.branchId)
    .maybeSingle();
  if (branchError) return { error: branchError.message };
  if (!branch || branch.organization_id !== who.organizationId || branch.is_active === false) {
    return { error: "Branch is organization ki nahi hai." };
  }

  const taken = await service.rpc("fn_party_invite_phone_taken", { p_key: key });
  if (taken.error) {
    return { error: "Phone check nahi ho saka. Migration 698 testing par lagayein, phir dobara." };
  }
  if (taken.data === true) return { error: "Ye mobile pehle se kisi account par hai." };

  const email = loginEmailFor(key, form.email);
  const { data: created, error: createError } = await service.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: form.fullName, phone_number: form.phone, role: spec.profileRole },
  });
  if (createError || !created.user) {
    const message = createError?.message ?? "Account nahi bana.";
    if (/already|registered|exists/i.test(message)) return { error: "Ye email pehle se kisi account par hai." };
    return { error: message };
  }
  const userId = created.user.id;

  const rollback = async (partyTable?: string, partyId?: string) => {
    if (partyTable && partyId) await service.from(partyTable).delete().eq("id", partyId);
    await service.auth.admin.deleteUser(userId);
  };

  const { error: profileError } = await service
    .from("profiles")
    .update({
      full_name: form.fullName,
      role: spec.profileRole,
      phone_number: form.phone,
      branch_id: form.branchId,
      organization_id: who.organizationId,
      is_active: true,
    })
    .eq("id", userId);
  if (profileError) {
    await rollback();
    return { error: profileError.message };
  }

  const code = partyCode(form.role, Date.now(), randomBytes(3).toString("hex"));
  const row = partyRow({
    role: form.role,
    userId,
    organizationId: who.organizationId,
    fullName: form.fullName,
    phone: form.phone,
    code,
    createdBy: who.userId,
  });
  const { data: party, error: partyError } = await service.from(spec.table).insert(row).select("id").single();
  if (partyError || !party?.id) {
    await rollback();
    return { error: partyError?.message ?? "Party record nahi bana." };
  }

  const { data: invite, error: inviteError } = await service
    .from("party_invite_accounts")
    .insert({
      organization_id: who.organizationId,
      profile_id: userId,
      party_role: form.role,
      party_table: spec.table,
      party_id: party.id,
      full_name: form.fullName,
      phone: form.phone,
      phone_key: key,
      email: form.email,
      branch_id: form.branchId,
      branch_name: branch.name,
      created_by: who.userId,
    })
    .select("id, party_role, full_name, phone, email, branch_name, created_at")
    .single();
  if (inviteError || !invite) {
    await rollback(spec.table, party.id);
    return { error: inviteError?.message ?? "Invite record nahi bana." };
  }

  const account = mapAccount(invite);
  await logAudit({
    actionType: "create",
    module: "party_invite",
    recordId: invite.id,
    recordLabel: form.fullName,
    description: `${spec.label} account bana: ${form.fullName}, ${form.phone}, branch ${branch.name}.`,
  });
  revalidatePath("/admin/hr/users");
  revalidatePath("/admin/dealers");
  revalidatePath("/admin/buyers");
  revalidatePath("/admin/investors");
  return account ? { account } : { error: "Account ban gaya magar screen par nahi aaya." };
}

export async function sendPartyInvite(_prev: SendInviteState, formData: FormData): Promise<SendInviteState> {
  const who = await caller();
  if ("error" in who) return { error: who.error };
  const accountId = String(formData.get("account_id") ?? "");
  const channelRaw = String(formData.get("channel") ?? "");
  if (!accountId) return { error: "Account chunein." };

  const service = loose(createServiceClient());
  const { data: row, error: loadError } = await service
    .from("party_invite_accounts")
    .select("id, organization_id, party_role, full_name, phone, email, branch_name")
    .eq("id", accountId)
    .maybeSingle();
  if (loadError) return { error: loadError.message };
  if (!row || row.organization_id !== who.organizationId) return { error: "Account nahi mila." };

  const spec = roleSpec(row.party_role);
  if (!spec) return { error: "Role theek nahi." };
  const plan = planSend({
    channel: channelRaw,
    fullName: row.full_name,
    role: spec.key,
    branchName: row.branch_name || "—",
    phone: row.phone,
    email: row.email,
    loginUrl: loginUrl(),
  });

  let status: "sent" | "failed" = "failed";
  let reason = plan.error;
  if (plan.ok && plan.channel) {
    const sent = await dispatchInvite(plan.channel, plan.recipient, plan.text, plan.subject, {
      sendWhatsapp: (phone, text) => sendWhatsAppMessage(phone, text),
      sendEmail: async (to, subject, html) => {
        const result = await sendDeptMail({ dept: "hr", to, subject, html });
        return result.sent ? { sent: true } : { sent: false, error: result.error };
      },
      sendSms: async (phone, text) => {
        const result = await sendVeevoSms({ to: phone, text, env: veevoEnv() });
        return { sent: result.sent, reason: result.reason };
      },
    });
    status = sent.ok ? "sent" : "failed";
    reason = sent.error;
  }

  const { data: saved, error: saveError } = await service
    .from("party_invite_sends")
    .insert({
      account_id: row.id,
      organization_id: who.organizationId,
      channel: plan.channel ?? channelRaw,
      recipient: plan.recipient || "—",
      subject: plan.subject,
      content: plan.text,
      status,
      error: reason,
      sent_by: who.userId,
    })
    .select("id, account_id, channel, recipient, subject, content, status, error, created_at")
    .single();

  const send = saved ? mapSend(saved) : null;
  await logAudit({
    actionType: "create",
    module: "party_invite",
    recordId: saved?.id ?? row.id,
    recordLabel: row.full_name,
    description: `Invite ${plan.channel ?? channelRaw} ${status} → ${plan.recipient || "—"}${reason ? ` — ${reason}` : ""}. Poora paigham timeline mein.`,
  });

  revalidatePath("/admin/hr/users");
  if (saveError || !send) {
    const head = status === "sent" ? "Paigham gaya" : `Paigham nahi gaya${reason ? `: ${reason}` : ""}`;
    return { error: `${head}. Timeline nahi likhi: ${saveError?.message ?? "record nahi bana"}.`, send: send ?? undefined };
  }
  if (status === "failed") return { error: reason ?? "Nahi gaya.", send };
  return { send };
}
