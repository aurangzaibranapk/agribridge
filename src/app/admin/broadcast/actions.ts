"use server";
/**
 * Broadcast actions. Bhejna yahan se NAHI hota: sirf draft -> submit -> manzoori.
 * Audience hamesha server par banti hai (client ki list par bharosa nahi).
 * Maker-checker database (599) mein pakka hai; yahan sirf pehle se roka jata hai.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveAudience } from "@/lib/broadcast/load-audience";
import { parseCsv, type AudienceSpec, type Recipient } from "@/lib/broadcast/audience";
import { renderText, smsSegments, missingVars } from "@/lib/broadcast/text";
import { estimateCost, type CostEstimate } from "@/lib/broadcast/cost";
import { broadcastConfig } from "@/lib/broadcast/config";

const CREATOR_ROLES = ["owner", "super_admin", "admin", "manager"];

async function me() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: p } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).maybeSingle();
  if (!p || !CREATOR_ROLES.includes(p.role) || p.is_active === false) throw new Error("Ijazat nahi");
  return { supabase: supabase as unknown as SupabaseClient, uid: user.id };
}

export interface DraftInput {
  title: string;
  spec: AudienceSpec & { csvText?: string };
  channel: "whatsapp" | "sms" | "both";
  templateId: string | null;
  templateVars: string[];
  smsBody: { en?: string; rm?: string; ur?: string };
  lang: "en" | "rm" | "ur" | "pref";
  scheduleAt: string | null; // "2026-10-20T10:00" PKT
  season?: string;
}

function cleanSpec(s: DraftInput["spec"]): AudienceSpec {
  const arr = (v: unknown) => (Array.isArray(v) ? v.map(String).map((x) => x.trim()).filter(Boolean).slice(0, 500) : []);
  const n = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
  const role = ["farmers", "customers", "staff", "all", "custom"].includes(s.role) ? s.role : "farmers";
  return { role, villages: arr(s.villages), campaignIds: arr(s.campaignIds), udhaarDays: n(s.udhaarDays), udhaarMin: n(s.udhaarMin),
    dairyOnly: !!s.dairyOnly, departments: arr(s.departments), pickedIds: arr(s.pickedIds), csv: parseCsv(s.csvText ?? "").concat(Array.isArray(s.csv) ? s.csv : []) };
}

async function audience(spec: AudienceSpec, season = "") {
  // Service client sirf parhne ke liye (farmers/customers par RLS); kuch likha nahi jata.
  return resolveAudience(createServiceClient() as unknown as SupabaseClient, spec, season);
}

export async function countAudience(raw: DraftInput["spec"]) {
  await me();
  const r = await audience(cleanSpec(raw));
  return { count: r.recipients.length, noNumber: r.noNumber, duplicates: r.duplicates, sample: r.recipients.slice(0, 6).map((x) => ({ name: x.name, phone: x.phone.replace(/^(\d{4})\d+(\d{3})$/, "$1*****$2"), type: x.party_type, vars: x.vars })) };
}

function textFor(d: DraftInput, r: Recipient) {
  const lang = d.lang === "pref" ? r.lang : d.lang;
  return d.smsBody[lang] || d.smsBody.rm || d.smsBody.en || d.smsBody.ur || "";
}

async function templateOf(db: SupabaseClient, id: string | null) {
  if (!id) return null;
  const { data } = await db.from("message_templates").select("id, name, lang, category, body, var_count, meta_status").eq("id", id).maybeSingle();
  return data as { id: string; name: string; lang: string; category: "MARKETING" | "UTILITY"; body: string; var_count: number; meta_status: string } | null;
}

export async function previewBroadcast(d: DraftInput): Promise<{ count: number; rows: { name: string; phone: string; channel: string; wa: string | null; sms: string | null; missing: string[] }[]; cost: CostEstimate; segments: number; errors: string[] }> {
  const { supabase } = await me();
  const r = await audience(cleanSpec(d.spec), d.season ?? "");
  const tpl = await templateOf(supabase, d.templateId);
  const errors = validate(d, tpl);
  const segs = Math.max(0, ...r.recipients.slice(0, 200).map((x) => smsSegments(renderText(textFor(d, x), x.vars)).segments));
  const rows = r.recipients.slice(0, 12).map((x) => {
    const wa = d.channel !== "sms" && tpl ? tpl.body.replace(/\{\{(\d+)\}\}/g, (_, i) => renderText(`{${d.templateVars[Number(i) - 1] ?? ""}}`, x.vars)) : null;
    const smsT = d.channel !== "whatsapp" ? renderText(textFor(d, x), x.vars) : null;
    return { name: x.name, phone: x.phone.replace(/^(\d{4})\d+(\d{3})$/, "$1*****$2"), channel: d.channel, wa, sms: smsT, missing: missingVars(textFor(d, x), x.vars) };
  });
  return { count: r.recipients.length, rows, cost: estimateCost({ channel: d.channel, category: tpl?.category ?? null, recipients: r.recipients.length, smsSegments: segs || 1 }, broadcastConfig()), segments: segs, errors };
}

function validate(d: DraftInput, tpl: Awaited<ReturnType<typeof templateOf>>): string[] {
  const e: string[] = [];
  if (!d.title || d.title.trim().length < 3) e.push("title");
  if (d.channel !== "sms") {
    if (!tpl) e.push("WhatsApp: template zaroori (free text mana)");
    else if (tpl.meta_status !== "APPROVED") e.push(`WhatsApp: template "${tpl.name}" Meta se APPROVED nahi (${tpl.meta_status})`);
    else if (d.templateVars.filter(Boolean).length !== tpl.var_count) e.push(`WhatsApp: template ko ${tpl.var_count} variables chahiye`);
  }
  if (d.channel !== "whatsapp" && !Object.values(d.smsBody).some((x) => (x ?? "").trim())) e.push("SMS: matn zaroori");
  return e;
}

export async function submitBroadcast(d: DraftInput): Promise<{ error?: string; id?: string }> {
  const { supabase, uid } = await me();
  const tpl = await templateOf(supabase, d.channel === "sms" ? null : d.templateId);
  const errs = validate(d, tpl);
  if (errs.length) return { error: errs.join(" · ") };
  const spec = cleanSpec(d.spec);
  const r = await audience(spec, d.season ?? "");
  if (!r.recipients.length) return { error: "Koi wusool kuninda nahi" };
  const segs = Math.max(1, ...r.recipients.slice(0, 200).map((x) => smsSegments(renderText(textFor(d, x), x.vars)).segments));
  const cost = estimateCost({ channel: d.channel, category: tpl?.category ?? null, recipients: r.recipients.length, smsSegments: segs }, broadcastConfig());
  const schedule = d.scheduleAt ? new Date(`${d.scheduleAt}:00+05:00`) : null;
  const { data: row, error } = await supabase.from("broadcasts").insert({
    title: d.title.trim().slice(0, 140), audience_role: spec.role, audience_spec: { ...spec, csv: spec.csv?.length ? `${spec.csv.length} rows` : undefined },
    channel: d.channel, template_id: d.channel === "sms" ? null : d.templateId, template_vars: d.templateVars.filter(Boolean),
    sms_body: d.channel === "whatsapp" ? {} : d.smsBody, lang: d.lang, schedule_at: schedule && !isNaN(+schedule) ? schedule.toISOString() : null, created_by: uid,
  }).select("id").single();
  if (error || !row) return { error: error?.message ?? "save failed" };
  const recips = r.recipients.map((x) => ({ ...x, lang: d.lang === "pref" ? x.lang : d.lang }));
  const { error: e2 } = await supabase.rpc("broadcast_submit", { p_id: row.id, p_recipients: recips, p_cost_usd: cost.totalUsd ?? cost.waUsd });
  if (e2) return { error: e2.message, id: row.id };
  revalidatePath("/admin/broadcast");
  return { id: row.id };
}

async function rpc(fn: string, args: Record<string, unknown>, id: string) {
  const { supabase } = await me();
  const { error } = await supabase.rpc(fn, args);
  revalidatePath(`/admin/broadcast/${id}`);
  revalidatePath("/admin/broadcast");
  if (error) redirect(`/admin/broadcast/${id}?e=${encodeURIComponent(error.message.slice(0, 160))}`);
  redirect(`/admin/broadcast/${id}?ok=1`);
}
export async function approveAction(fd: FormData) { const id = String(fd.get("id")); await rpc("broadcast_approve", { p_id: id }, id); }
export async function rejectAction(fd: FormData) { const id = String(fd.get("id")); await rpc("broadcast_reject", { p_id: id, p_reason: String(fd.get("reason") ?? "") }, id); }
export async function cancelAction(fd: FormData) { const id = String(fd.get("id")); await rpc("broadcast_cancel", { p_id: id }, id); }
export async function reopenAction(fd: FormData) { const id = String(fd.get("id")); await rpc("broadcast_reopen", { p_id: id }, id); }
export async function retrySmsAction(fd: FormData) { const id = String(fd.get("id")); await rpc("broadcast_retry_sms", { p_id: id }, id); }

export async function addTemplateAction(fd: FormData) {
  const { supabase } = await me();
  const body = String(fd.get("body") ?? "");
  const vars = new Set([...body.matchAll(/\{\{(\d+)\}\}/g)].map((m) => m[1])).size;
  const row = { name: String(fd.get("name") ?? "").trim().toLowerCase(), lang: String(fd.get("lang") ?? "ur"), category: String(fd.get("category") ?? "UTILITY"), body, var_count: vars, meta_status: String(fd.get("meta_status") ?? "PENDING") };
  const { error } = await supabase.from("message_templates").upsert(row, { onConflict: "name,lang" });
  redirect(`/admin/broadcast?${error ? `e=${encodeURIComponent(error.message.slice(0, 160))}` : "ok=1"}`);
}

export async function addDndAction(fd: FormData) {
  const { supabase, uid } = await me();
  const { normalizePkMobile } = await import("@/lib/broadcast/text");
  const phone = normalizePkMobile(fd.get("phone"));
  if (!phone) redirect("/admin/broadcast?e=number");
  const { error } = await supabase.from("messaging_dnd").insert({ phone, reason: String(fd.get("reason") ?? "").slice(0, 200), added_by: uid });
  redirect(`/admin/broadcast?${error ? `e=${encodeURIComponent(error.message.slice(0, 160))}` : "ok=1"}`);
}
