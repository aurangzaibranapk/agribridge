"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { custGate, customerContext, todayPk } from "@/lib/portal/customer-load";
import { dbErrorKey, proofOk, proofPath, validateChange, validateClaim, validateDispute, validatePromise, TERMS_VERSION } from "@/lib/portal/customer";

/**
 * Gahak ki darkhwastein -- sirf 573 ke checked functions (fn_my_*) se.
 * Koi seedha insert nahi, koi service role nahi, koi message nahi bhejta.
 */
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
async function me(back: string) {
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect(`${back}?e=pc_err_generic`);
  if (!(await custGate(ctx)).allowed) redirect("/portal/c/profile");
  const sb = createClient();
  return { ctx, sb, rpc: sb.rpc.bind(sb) as unknown as Rpc, customerId: ctx.profile.customers[0].id };
}
const back = (path: string, r: { error: { message: string } | null }, hash = "") =>
  redirect(`${path}?${r.error ? `e=${dbErrorKey(r.error.message)}` : "ok=1"}${hash}`);

export async function submitClaimAction(fd: FormData) {
  const P = "/portal/c/payments";
  const { sb, rpc, customerId } = await me(P);
  const v = validateClaim(fd, todayPk());
  if (!v.ok) redirect(`${P}?e=${v.error}#proof`);
  let path: string | null = null;
  const f = fd.get("proof");
  if (f instanceof File && f.size > 0) {
    if (!proofOk(f)) redirect(`${P}?e=pc_err_file#proof`);
    path = proofPath(customerId, crypto.randomUUID(), f.type);
    const up = await sb.storage.from("customer-proofs").upload(path, f, { contentType: f.type, upsert: false });
    if (up.error) redirect(`${P}?e=pc_err_generic#proof`);
  }
  const r = await rpc("fn_my_submit_payment_claim", {
    p_amount: v.value.amount, p_method: v.value.method, p_paid_on: v.value.paid_on, p_reference: v.value.reference,
    p_proof_path: path, p_note: v.value.note, p_customer: customerId,
  });
  revalidatePath(P);
  back(P, r, "#history");
}

export async function requestPromiseAction(fd: FormData) {
  const P = "/portal/c/payments";
  const { rpc, customerId } = await me(P);
  const v = validatePromise(fd, todayPk());
  if (!v.ok) redirect(`${P}?e=${v.error}#promise`);
  const r = await rpc("fn_my_request_promise", { p_amount: v.value.amount, p_promise_date: v.value.promise_date, p_terms_version: TERMS_VERSION, p_accept: true, p_customer: customerId });
  revalidatePath(P);
  back(P, r, "#promise");
}

export async function requestChangeAction(fd: FormData) {
  const P = "/portal/c/profile";
  const ctx = await customerContext();
  if (!ctx) redirect("/login");
  if (!ctx.profile) redirect(`${P}?e=pc_err_generic`);
  const v = validateChange(fd);
  if (!v.ok) redirect(`${P}?e=${v.error}`);
  const sb = createClient();
  const r = await (sb.rpc.bind(sb) as unknown as Rpc)("fn_my_request_change", { p_field: v.value.field, p_new_value: v.value.value, p_customer: ctx.profile.customers[0].id });
  revalidatePath(P);
  back(P, r);
}

export async function openDisputeAction(fd: FormData) {
  const P = "/portal/c/khata";
  const { rpc, customerId } = await me(P);
  const v = validateDispute(fd);
  if (!v.ok) redirect(`${P}?e=${v.error}#dispute`);
  const r = await rpc("fn_my_open_dispute", { p_message: v.value.message, p_ref: v.value.ref, p_customer: customerId });
  revalidatePath(P);
  back(P, r, "#dispute");
}
