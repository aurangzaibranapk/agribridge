"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { offerTotal } from "@/lib/payroll/salary-offer";

/** 691: Bharti ki offer (hissay-war), counter, offer se structure, barhotri, adaigi ka hawala. */
export interface OfferState { error?: string; success?: string }
const ok = (success: string): OfferState => ({ success });
const err = (e: unknown): OfferState => ({ error: typeof e === "string" ? e : (e as { message?: string })?.message ?? "Kuch ghalat ho gaya." });

async function me() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sb = createClient() as any;
  const { data: { user } } = await sb.auth.getUser();
  return { sb, user };
}
const num = (fd: FormData, k: string): number | null => {
  const v = String(fd.get(k) ?? "").replace(/,/g, "").trim();
  if (v === "") return null;
  const x = Number(v);
  return isFinite(x) && x >= 0 ? x : null;
};
const txt = (fd: FormData, k: string): string | null => {
  const v = String(fd.get(k) ?? "").trim();
  return v === "" ? null : v;
};
function parts(fd: FormData) {
  return {
    basic: num(fd, "basic"), house_rent: num(fd, "house_rent"), travel: num(fd, "travel"), mobile: num(fd, "mobile"),
    bonus: txt(fd, "bonus"), incentive_pct: num(fd, "incentive_pct"), incentive_rule: txt(fd, "incentive_rule"),
  };
}
function paths(appId?: string) {
  ["/admin/hr/recruitment", "/admin/job-applications", "/admin/hr/salary-structure", "/admin/hr/increments"].forEach((p) => revalidatePath(p));
  if (appId) revalidatePath(`/admin/hr/recruitment/${appId}`);
}

/** Nayi ya badli hui offer bhejo. Pichli khuli offer `superseded_by` se nayi se jurti hai. */
export async function sendItemizedOffer(_p: OfferState, fd: FormData): Promise<OfferState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const applicationId = String(fd.get("application_id") ?? "");
  const p = parts(fd);
  if (!applicationId) return err("Application nahi mili.");
  if (!(Number(p.basic) > 0)) return err("Basic (sifar se zyada) zaroori hai.");
  const joining = txt(fd, "joining_date");
  if (joining && !/^\d{4}-\d{2}-\d{2}$/.test(joining)) return err("Joining tareekh ghalat hai.");
  const { data: prev } = await sb.from("job_offers").select("id, designation, branch_id, status")
    .eq("application_id", applicationId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (prev?.status === "accepted") return err("Offer pehle hi qubool ho chuki -- ab structure banayein.");
  const designation = txt(fd, "designation") ?? prev?.designation ?? "Staff";
  const total = offerTotal(p);
  const { data: offer, error } = await sb.from("job_offers").insert({
    application_id: applicationId, designation, branch_id: prev?.branch_id ?? null,
    proposed_salary: total, ...p,
    probation_months: num(fd, "probation_months"), joining_date: joining, created_by: user.id,
  }).select("id").single();
  if (error) return err(error);
  if (prev && prev.status !== "accepted") {
    await sb.from("job_offers").update({ superseded_by: offer.id, ...(prev.status === "pending" ? { status: "withdrawn" } : {}) }).eq("id", prev.id);
  }
  const { error: e2 } = await sb.from("job_offer_events").insert({
    offer_id: offer.id, application_id: applicationId, kind: prev ? "revised" : "sent", ...p, total, actor: user.id, via: "admin",
  });
  if (e2) return err(e2);
  await sb.from("job_applications").update({ status: "offered" }).eq("id", applicationId);
  paths(applicationId);
  return ok(prev ? "Nayi (revised) offer bhej di." : "Offer bhej di.");
}

/** Candidate ka counter darj karo (us ki maang hissay-war). */
export async function recordCounter(_p: OfferState, fd: FormData): Promise<OfferState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const applicationId = String(fd.get("application_id") ?? "");
  const p = parts(fd);
  const { data: o } = await sb.from("job_offers").select("id, status").eq("application_id", applicationId)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!o) return err("Pehle offer bhejein, phir counter darj karein.");
  if (o.status === "accepted") return err("Offer qubool ho chuki.");
  const { error } = await sb.from("job_offer_events").insert({
    offer_id: o.id, application_id: applicationId, kind: "countered", ...p, total: offerTotal(p), note: txt(fd, "note"), actor: user.id, via: "admin",
  });
  if (error) return err(error);
  const { error: e2 } = await sb.from("job_offers").update({ status: "countered" }).eq("id", o.id);
  if (e2) return err(e2);
  paths(applicationId);
  return ok("Counter darj ho gaya.");
}

/** HR offer ki halat badle: qubool (candidate ne zabaani/kaghaz par mana), rad ya wapas. */
export async function setOfferStatus(_p: OfferState, fd: FormData): Promise<OfferState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const id = String(fd.get("offer_id") ?? "");
  const status = String(fd.get("status") ?? "");
  if (!["accepted", "rejected", "withdrawn"].includes(status)) return err("Ghalat status.");
  const { data: o, error } = await sb.from("job_offers").update({ status, responded_at: new Date().toISOString() }).eq("id", id).select("application_id").single();
  if (error) return err(error);
  if (status === "accepted") await sb.from("job_applications").update({ status: "accepted" }).eq("id", o.application_id);
  paths(o.application_id);
  return ok(status === "accepted" ? "Offer qubool darj ho gayi." : "Offer ki halat badal di.");
}

/** Qubool offer se DRAFT structure (fn_salary_structure_from_offer). Manzoori doosra admin kare. */
export async function structureFromOffer(_p: OfferState, fd: FormData): Promise<OfferState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const profileId = String(fd.get("profile_id") ?? "");
  if (profileId === user.id) return err("Apni tankhwah ka structure khud nahi banaya ja sakta.");
  const { error } = await sb.rpc("fn_salary_structure_from_offer", {
    p_profile: profileId, p_offer: String(fd.get("offer_id") ?? ""), p_effective: txt(fd, "effective_from"),
  });
  if (error) return err(error);
  paths();
  return ok("Offer se draft structure ban gaya -- ab doosra Admin/Owner manzoor kare.");
}

/** Barhotri tay karein: naya DRAFT structure (purana structure ke hissay saath). */
export async function proposeIncrement(_p: OfferState, fd: FormData): Promise<OfferState> {
  const { sb, user } = await me();
  if (!user) return err("Login zaroori hai.");
  const profileId = String(fd.get("profile_id") ?? "");
  if (profileId === user.id) return err("Apni barhotri khud tay nahi ki ja sakti.");
  const eff = String(fd.get("effective_from") ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eff)) return err("Laagu tareekh zaroori hai.");
  const reason = String(fd.get("change_reason") ?? "annual");
  const current = num(fd, "current_basic") ?? 0;
  let basic = num(fd, "basic");
  const pct = num(fd, "pct");
  if (!(Number(basic) > 0) && Number(pct) > 0 && current > 0) basic = Math.round(current * (1 + Number(pct) / 100));
  if (!(Number(basic) > 0)) return err("Naya basic ya % likhein.");
  const { data: prev } = await sb.from("staff_salary_structures").select("id, staff_salary_structure_items(component_id, amount, pct)")
    .eq("profile_id", profileId).eq("status", "approved").lte("effective_from", eff)
    .order("effective_from", { ascending: false }).limit(1).maybeSingle();
  const { data: s, error } = await sb.from("staff_salary_structures").insert({
    profile_id: profileId, basic, effective_from: eff, notes: txt(fd, "notes"), created_by: user.id,
    change_reason: reason, prev_structure_id: prev?.id ?? null,
  }).select("id").single();
  if (error) return err(error);
  const items = (prev?.staff_salary_structure_items ?? []).map((i: { component_id: string; amount: number | null; pct: number | null }) => ({ structure_id: s.id, component_id: i.component_id, amount: i.amount, pct: i.pct }));
  if (items.length) {
    const { error: e2 } = await sb.from("staff_salary_structure_items").insert(items);
    if (e2) return err(e2);
  }
  paths();
  revalidatePath(`/admin/hr/staff/${profileId}/salary`);
  return ok("Barhotri ka draft structure ban gaya -- doosra Admin/Owner manzoor karega.");
}

/** Payroll line par adaigi ka tareeqa aur hawala (slip par chhapta hai). */
export async function setLinePayment(_p: OfferState, fd: FormData): Promise<OfferState> {
  const { sb } = await me();
  const { error } = await sb.rpc("fn_payroll_line_set_payment", {
    p_line: String(fd.get("line_id") ?? ""), p_method: String(fd.get("pay_method") ?? "bank_transfer"), p_ref: txt(fd, "pay_ref"), p_paid_at: null,
  });
  if (error) return err(error);
  revalidatePath(`/admin/hr/payslip/${fd.get("line_id")}`);
  return ok("Adaigi ka hawala darj ho gaya.");
}
