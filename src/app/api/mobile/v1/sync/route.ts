import { NextResponse } from "next/server";
import { requestUser } from "@/lib/api-auth";
import { syncMobile } from "@/lib/mobile/server-sync";
import type { OutboxItem } from "@/lib/mobile/queue";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requestUser(request);
  if (!auth) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  let body: { since?: string | null; items?: OutboxItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON sahi nahi hai." }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
  const result = await syncMobile({
    userId: auth.userId,
    userClient: auth.supabase,
    items,
    since: typeof body.since === "string" ? body.since : null,
  });
  if ("error" in result && result.status !== 200) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json(result.body);
}
