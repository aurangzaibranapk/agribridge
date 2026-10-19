"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Checker ki line -- sirf 573 ke functions. Maker-checker database khud lagata hai:
 * darj karne wala / check karne wala approve nahi kar sakta. Koi message nahi bhejta.
 */
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const UUID = /^[0-9a-f-]{36}$/i;
const P = "/admin/customer-portal";

export async function queueAction(fd: FormData) {
  const op = String(fd.get("op") ?? "");
  const kind = String(fd.get("kind") ?? "");
  const id = String(fd.get("id") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);
  if (!UUID.test(id) || !["claim", "change", "promise", "dispute"].includes(kind)) redirect(`${P}?e=bad`);
  const sb = createClient();
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;
  let r: { error: { message: string } | null } = { error: null };
  if (kind === "dispute") {
    if (op !== "review" && op !== "close") redirect(`${P}?e=bad`);
    r = await rpc("fn_cp_dispute_update", { p_id: id, p_status: op === "review" ? "reviewed" : "closed", p_note: note });
  } else if (op === "check") {
    r = await rpc("fn_cp_check", { p_kind: kind, p_id: id, p_note: note || null });
  } else if (op === "approve") {
    const acc = String(fd.get("finance_account") ?? "");
    r = await rpc("fn_cp_approve", { p_kind: kind, p_id: id, p_finance_account: kind === "claim" && UUID.test(acc) ? acc : null });
  } else if (op === "reject") {
    r = await rpc("fn_cp_reject", { p_kind: kind, p_id: id, p_reason: note });
  } else redirect(`${P}?e=bad`);
  revalidatePath(P);
  redirect(`${P}?${r.error ? `e=${encodeURIComponent(r.error.message.slice(0, 140))}` : "ok=1"}#queue`);
}
