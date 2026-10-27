import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { escalateOpenCash } from "@/lib/ledger/open-cash";

export const dynamic = "force-dynamic";

/**
 * Pending approvals: Manager SLA ke baad Admin + Owner.
 * Idempotent. Sirf in-app notification (function ke andar). SMS/WhatsApp nahi.
 *
 * curl -s "https://alranatraders.pk/api/cron/pending-escalation?token=CRON_SECRET"
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const sb = createServiceClient();
  const { data, error } = await (sb as unknown as { rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }> }).rpc(
    "fn_pending_escalate",
  );
  if (error) return NextResponse.json({ error: "Escalation nahi chali." }, { status: 500 });
  // 713 SQL cron sirf fn_pending_escalate chalata hai. Cash ka 24h
  // alert isi HTTP cron par hai, maujooda tables par. Nayi migration nahi.
  const cashOpen = await escalateOpenCash().catch(() => ({ error: "cash open escalate nahi chali" }));
  return NextResponse.json({ ...(typeof data === "object" && data ? data as object : { ok: true }), cashOpen });
}

export const GET = run;
export const POST = run;
