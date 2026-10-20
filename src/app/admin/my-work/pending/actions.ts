"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { approveProductEdit, rejectProductEdit } from "@/actions/product-permissions";
import { approveProductMerge, rejectProductMerge } from "@/actions/product-merge";
import { reviewPosReturn } from "@/actions/pos-returns";
import { CODE_MAKER_COLS, type PendingItem } from "@/lib/pending/categories";
import { runDecidePending, type DecidePorts, type DecideResult } from "@/lib/pending/decide";

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
  const result = await runDecidePending(fd, ports(sb));
  if (result.ok) revalidatePath(P);
  return result;
}
