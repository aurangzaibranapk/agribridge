"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { sendWhatsAppTemplate } from "@/lib/whatsapp-client";
import { logAudit } from "@/lib/audit";
import {
  type PortalAccount, type PortalAccountRow, toAccount, deleteConfirmError, deleteNeedsChecker,
  whatsappSkipReason, SKIP_LABEL, accountNoticeText, accountNoticeParams, templateConfig,
  SUSPEND_DURATION, MAX_BULK_SEND,
} from "@/lib/portal-accounts/core";
import { signPreview, verifyPreview } from "@/lib/portal-accounts/token";

const PATH = "/admin/portal-accounts";
const MASTER = ["owner", "super_admin", "admin"];
type Result = { ok: true; message: string } | { ok: false; error: string };

async function requireMaster() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Login zaroori hai." } as const;
  const { data: me } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!me?.is_active || !MASTER.includes(String(me.role))) return { error: "Sirf Owner ya Admin ye kar sakta hai." } as const;
  return { user } as const;
}

/** Sirf portal accounts (staff kabhi nahi) -- DB function hi faisla karta hai. */
async function loadAccounts(ids?: string[]): Promise<PortalAccount[]> {
  const service = createServiceClient() as any;
  const { data, error } = await service.rpc("fn_portal_accounts");
  if (error) throw new Error(error.message);
  const all = ((data ?? []) as PortalAccountRow[]).map((r) => toAccount(r));
  return ids ? all.filter((a) => ids.includes(a.user_id)) : all;
}

async function logAction(actorId: string, a: PortalAccount, action: string, reason: string, ok = true, error?: string) {
  const service = createServiceClient() as any;
  await service.from("portal_account_actions").insert({
    actor_id: actorId, target_user_id: a.user_id, target_label: a.name !== "—" ? a.name : a.login_email,
    action, reason, ok, error: error ?? null,
  });
  await logAudit({ actionType: action === "delete" ? "delete" : "update", module: "portal_accounts", recordId: a.user_id,
    recordLabel: a.login_email ?? undefined, description: `${action}: ${reason}${error ? ` (${error})` : ""}` });
}

async function target(actorId: string, userId: string): Promise<PortalAccount | string> {
  if (!userId) return "Account nahi mila.";
  if (userId === actorId) return "Apna account khud band ya delete nahi kiya ja sakta.";
  const [a] = await loadAccounts([userId]);
  return a ?? "Ye portal account nahi (staff yahan se nahi badla ja sakta).";
}

async function ban(userId: string, on: boolean) {
  const service = createServiceClient();
  return service.auth.admin.updateUserById(userId, { ban_duration: on ? SUSPEND_DURATION : "none" } as any);
}

export async function setPortalSuspended(userId: string, suspend: boolean, reason: string): Promise<Result> {
  const who = await requireMaster();
  if ("error" in who) return { ok: false, error: who.error! };
  if (!reason?.trim()) return { ok: false, error: "Wajah likhna zaroori hai." };
  const a = await target(who.user.id, userId);
  if (typeof a === "string") return { ok: false, error: a };
  const { error } = await ban(userId, suspend);
  await logAction(who.user.id, a, suspend ? "suspend" : "activate", reason.trim(), !error, error?.message);
  revalidatePath(PATH);
  if (error) return { ok: false, error: error.message };
  return { ok: true, message: suspend ? "Account band kar diya gaya." : "Account dobara chaalu ho gaya." };
}

/** Auth user pehle mitao, ghalti dekho; na mite to band (suspend) kar do. Khata kabhi nahi mitta. */
async function performDelete(actorId: string, a: PortalAccount, reason: string): Promise<Result> {
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(a.user_id);
  if (!error) {
    await logAction(actorId, a, "delete", reason);
    return { ok: true, message: "Login account mita diya gaya. Khata mehfooz hai." };
  }
  const { error: banErr } = await ban(a.user_id, true);
  await logAction(actorId, a, "delete_fallback_suspend", reason, !banErr, `${error.message}${banErr ? `; ban: ${banErr.message}` : ""}`);
  if (banErr) return { ok: false, error: `Na mita saka, na band ho saka: ${error.message}` };
  return { ok: true, message: "Mitaya nahi ja saka, is liye account band (suspend) kar diya gaya." };
}

export async function deletePortalAccount(userId: string, typed: string, reason: string): Promise<Result> {
  const who = await requireMaster();
  if ("error" in who) return { ok: false, error: who.error! };
  const bad = deleteConfirmError(typed, reason);
  if (bad) return { ok: false, error: bad };
  const a = await target(who.user.id, userId);
  if (typeof a === "string") return { ok: false, error: a };
  let res: Result;
  if (deleteNeedsChecker(a)) {
    const service = createServiceClient() as any;
    const { error } = await service.from("portal_account_delete_requests").insert({
      target_user_id: a.user_id, target_label: a.name, reason: reason.trim(), requested_by: who.user.id,
    });
    if (error) return { ok: false, error: error.code === "23505" ? "Is account ki darkhwast pehle se pending hai." : error.message };
    await logAction(who.user.id, a, "delete_requested", reason.trim());
    res = { ok: true, message: "Is account se khata juda hai. Darkhwast ban gayi; doosra Admin manzoor karega." };
  } else {
    res = await performDelete(who.user.id, a, reason.trim());
  }
  revalidatePath(PATH);
  return res;
}

export async function decidePortalDelete(requestId: string, approve: boolean): Promise<Result> {
  const who = await requireMaster();
  if ("error" in who) return { ok: false, error: who.error! };
  const service = createServiceClient() as any;
  const { data: req } = await service.from("portal_account_delete_requests").select("*").eq("id", requestId).eq("status", "pending").maybeSingle();
  if (!req) return { ok: false, error: "Darkhwast nahi mili." };
  if (req.requested_by === who.user.id) return { ok: false, error: "Apni darkhwast khud manzoor nahi kar sakte (maker-checker)." };
  const a = await target(who.user.id, req.target_user_id);
  if (typeof a === "string") return { ok: false, error: a };
  const { error } = await service.from("portal_account_delete_requests")
    .update({ status: approve ? "approved" : "rejected", decided_by: who.user.id, decided_at: new Date().toISOString() })
    .eq("id", requestId).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  const res = approve ? await performDelete(who.user.id, a, req.reason)
    : (await logAction(who.user.id, a, "delete_rejected", req.reason), { ok: true as const, message: "Darkhwast rad kar di." });
  revalidatePath(PATH);
  return res;
}

export interface WaPreviewItem { userId: string; name: string; phone: string | null; text: string | null; skip: string | null }
export interface WaPreview { items: WaPreviewItem[]; token: string; templateReady: boolean; templateName: string | null }

function secret() {
  const s = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!s) throw new Error("Server secret missing");
  return s;
}

function buildItems(list: PortalAccount[]): WaPreviewItem[] {
  return list.map((a) => {
    const skip = whatsappSkipReason(a);
    const name = a.name !== "—" ? a.name : "Mohtaram";
    return { userId: a.user_id, name, phone: a.phone, text: skip ? null : accountNoticeText(name, a.phone!), skip: skip ? SKIP_LABEL[skip] : null };
  });
}

export async function previewPortalWhatsApp(userIds: string[]): Promise<{ ok: true; preview: WaPreview } | { ok: false; error: string }> {
  const who = await requireMaster();
  if ("error" in who) return { ok: false, error: who.error! };
  const ids = [...new Set(userIds)].slice(0, MAX_BULK_SEND);
  if (!ids.length) return { ok: false, error: "Koi account nahi chuna." };
  const items = buildItems(await loadAccounts(ids));
  const cfg = templateConfig();
  const sendable = items.filter((i) => !i.skip).map((i) => i.userId);
  return { ok: true, preview: { items, token: signPreview(secret(), who.user.id, sendable), templateReady: cfg.ready, templateName: cfg.name } };
}

/** Sirf Admin ke "bhejein" dabane par -- preview token aur tasdeeq dono zaroori. */
export async function sendPortalWhatsApp(userIds: string[], token: string, confirmed: boolean): Promise<Result & { sent?: number; failed?: number }> {
  const who = await requireMaster();
  if ("error" in who) return { ok: false, error: who.error! };
  if (!confirmed) return { ok: false, error: "Pehle tasdeeq ka nishan lagayein." };
  const cfg = templateConfig();
  if (!cfg.ready) return { ok: false, error: "WhatsApp template (WHATSAPP_ACCOUNT_TEMPLATE) abhi server par set nahi. Kuch nahi bheja gaya." };
  const ids = [...new Set(userIds)];
  if (!verifyPreview(secret(), token, who.user.id, ids)) return { ok: false, error: "Preview purana ho gaya ya badal gaya. Dobara preview karein." };
  const service = createServiceClient() as any;
  const items = buildItems(await loadAccounts(ids));
  let sent = 0, failed = 0;
  for (const i of items) {
    if (i.skip || !i.phone) {
      await service.from("portal_whatsapp_sends").insert({ sent_by: who.user.id, target_user_id: i.userId, phone: i.phone, template: cfg.name, status: "skipped", error: i.skip });
      continue;
    }
    try {
      await sendWhatsAppTemplate(i.phone, cfg.name!, cfg.lang, accountNoticeParams(i.name, i.phone));
      sent++;
      await service.from("portal_whatsapp_sends").insert({ sent_by: who.user.id, target_user_id: i.userId, phone: i.phone, template: cfg.name, status: "sent" });
    } catch (e) {
      failed++;
      await service.from("portal_whatsapp_sends").insert({ sent_by: who.user.id, target_user_id: i.userId, phone: i.phone, template: cfg.name, status: "failed", error: String((e as Error).message).slice(0, 500) });
    }
  }
  await logAudit({ actionType: "update", module: "portal_accounts", description: `WhatsApp account notice: ${sent} gaye, ${failed} nakaam` });
  revalidatePath(PATH);
  return { ok: true, message: `${sent} message bheje gaye${failed ? `, ${failed} nakaam` : ""}.`, sent, failed };
}
