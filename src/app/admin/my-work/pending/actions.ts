"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { approveProductEdit, rejectProductEdit } from "@/actions/product-permissions";
import { approveProductMerge, rejectProductMerge } from "@/actions/product-merge";
import { reviewPosReturn } from "@/actions/pos-returns";
import { INLINE_DECISIONS, type PendingItem } from "@/lib/pending/categories";

/**
 * "Mere Kaam" se faisla -- KOI NAYI manzoori ki logic nahi. Ye sirf purane
 * server action ko wahi FormData de deta hai jo us ka apna safha deta hai;
 * har rok (ijazat, maker-checker, DB trigger) wahin lagti hai.
 *
 * Upar se ek aur rok: apni entry (auth.uid() = darj karne wala) par
 * Approve/Reject yahan se chalta hi nahi. Koi message / WhatsApp / email nahi.
 */
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const UUID = /^[0-9a-f-]{36}$/i;
const P = "/admin/my-work/pending";
const back = (q: string): never => redirect(`${P}?${q}`);

export async function decidePending(fd: FormData) {
  const category = String(fd.get("category") ?? "");
  const id = String(fd.get("id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 300);
  const rule = INLINE_DECISIONS[category];
  if (!rule || !UUID.test(id) || !["approve", "reject"].includes(decision)) back("e=bad");
  if (decision === "reject" && rule.rejectNeedsReason && note.length < 5) back("e=reason");

  const sb = createClient();
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;
  const { data } = await rpc("fn_admin_pending_items", { p_limit: 200, p_category: category });
  const row = ((data as PendingItem[] | null) ?? []).find((r) => r.item_id === id);
  if (!row) back("e=gone");
  if (row!.is_own) back("e=own");

  const f = new FormData();
  let res: { error?: string } = {};
  if (category === "pos_returns") {
    f.set("return_id", id);
    f.set("decision", decision === "approve" ? "approved" : "flagged");
    if (note) f.set("note", note);
    res = await reviewPosReturn({}, f);
  } else if (category === "product_edits") {
    f.set("request_id", id);
    if (note) f.set("review_notes", note);
    res = decision === "approve" ? await approveProductEdit({}, f) : await rejectProductEdit({}, f);
  } else if (category === "product_merge") {
    f.set("request_id", id);
    if (note) f.set("review_notes", note);
    res = decision === "approve" ? await approveProductMerge({}, f) : await rejectProductMerge({}, f);
  }
  revalidatePath(P);
  back(res.error ? `e=${encodeURIComponent(res.error.slice(0, 140))}` : "ok=1");
}
