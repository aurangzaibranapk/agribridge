"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { approveProductEdit, rejectProductEdit } from "@/actions/product-permissions";
import { approveProductMerge, rejectProductMerge } from "@/actions/product-merge";
import { reviewPosReturn } from "@/actions/pos-returns";
import { isSelfApproveRole } from "@/lib/approval/guards";
import { CODE_MAKER_COLS, type PendingItem } from "@/lib/pending/categories";
import { runDecidePending, fail, type DecidePorts, type DecideResult } from "@/lib/pending/decide";

/**
 * "Mere Kaam" se faisla -- KOI NAYI manzoori ki logic nahi. Ye sirf purane
 * server action ko wahi FormData deta hai jo us ka apna safha deta hai;
 * har rok (ijazat, maker-checker, DB trigger) wahin lagti hai.
 *
 * Natija redirect nahi: caller ko `{ ok }` ya asal wajah milti hai, taake
 * qataar aur ginti usi waqt badal jayein. Save ke baad `revalidatePath`
 * agla load taaza rakhta hai.
 *
 * Upar se ek aur rok: apni entry (auth.uid() = darj karne wala) par
 * Approve/Reject yahan se chalta hi nahi. Koi message / WhatsApp / email nahi.
 */
type Rpc = (fn: string, a?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const P = "/admin/my-work/pending";
const UUID = /^[0-9a-f-]{36}$/i;

function ports(sb: ReturnType<typeof createClient>): DecidePorts {
  const rpc = sb.rpc.bind(sb) as unknown as Rpc;
  return {
    async loadRow(category, id) {
      const { data } = await rpc("fn_admin_pending_items", { p_limit: 200, p_category: category });
      return ((data as PendingItem[] | null) ?? []).find((r) => r.item_id === id) ?? null;
    },
    async actorId() {
      const {
        data: { user },
      } = await sb.auth.getUser();
      return user?.id ?? null;
    },
    async actorRole() {
      const {
        data: { user },
      } = await sb.auth.getUser();
      if (!user) return null;
      const { data: me } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
      return (me as { role?: string } | null)?.role ?? null;
    },
    async logSelfDecision(category, id, decision) {
      await rpc("fn_pending_log_self_decision", { p_category: category, p_item_id: id, p_decision: decision });
    },
    async codeMakerId(category, id) {
      const codeSrc = CODE_MAKER_COLS[category];
      if (!codeSrc) return null;
      const { data: rec } = await (sb.from(codeSrc.table as never) as unknown as {
        select: (c: string) => { eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: Record<string, string | null> | null }> } };
      })
        .select(codeSrc.col)
        .eq("id", id)
        .maybeSingle();
      return rec?.[codeSrc.col] ?? null;
    },
    reviewPosReturn: (f) => reviewPosReturn({}, f),
    approveProductEdit: (f) => approveProductEdit({}, f),
    rejectProductEdit: (f) => rejectProductEdit({}, f),
    approveProductMerge: (f) => approveProductMerge({}, f),
    rejectProductMerge: (f) => rejectProductMerge({}, f),
  };
}

export async function decidePending(fd: FormData): Promise<DecideResult> {
  const sb = createClient();
  const p = ports(sb);
  const category = String(fd.get("category") ?? "");
  const id = String(fd.get("id") ?? "");
  const row = UUID.test(id) ? await p.loadRow(category, id) : null;
  if (row) {
    const actor = await p.actorId();
    const role = p.actorRole ? await p.actorRole() : null;
    const code = await p.codeMakerId(category, id);
    const maker = row.is_own ? actor : null;
    const { data, error } = await (sb.rpc as unknown as Rpc)("fn_may_decide_entry", {
      p_maker: maker,
      p_also: code,
    });
    const missing = !!error && /does not exist|schema cache|could not find/i.test(error.message);
    if (!missing && data === false && !isSelfApproveRole(role)) {
      return fail(row.is_own ? "own" : "code");
    }
  }
  const result = await runDecidePending(fd, p);
  if (result.ok) revalidatePath(P);
  return result;
}

export async function saveDelayNote(fd: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createClient();
  const category = String(fd.get("category") ?? "");
  const id = String(fd.get("id") ?? "");
  const note = String(fd.get("note") ?? "").trim();
  if (!category || !UUID.test(id) || note.length < 3) return { ok: false, error: "Wajah kam az kam 3 harf." };
  const { error } = await (sb.rpc as unknown as Rpc)("fn_pending_delay_note", {
    p_category: category,
    p_item_id: id,
    p_note: note,
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(P);
  return { ok: true };
}

export async function saveEscalationSla(fd: FormData): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = createClient();
  const category = String(fd.get("category") ?? "");
  const hours = Number(fd.get("hours"));
  if (!category || !Number.isFinite(hours)) return { ok: false, error: "SLA sahi nahi." };
  const { error } = await (sb.rpc as unknown as Rpc)("fn_pending_escalation_set_sla", {
    p_category: category,
    p_hours: Math.round(hours),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath(P);
  return { ok: true };
}
