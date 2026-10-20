import { NextRequest, NextResponse } from "next/server";
import { drainSmsOutbox } from "@/lib/sms/outbox";

export const dynamic = "force-dynamic";

/**
 * Queued SMS (complaint number, stage, test) Veevo par nikaalta hai.
 * CRON_SECRET ke baghair koi qataar nahi chalti.
 * Provider khali ho to qatarein queued rehti hain.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const bearer = req.headers.get("authorization");
  const token = req.nextUrl.searchParams.get("token");
  if (!secret || (bearer !== `Bearer ${secret}` && token !== secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await drainSmsOutbox();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "SMS queue nahi chali." }, { status: 500 });
  }
}

export const GET = run;
export const POST = run;
