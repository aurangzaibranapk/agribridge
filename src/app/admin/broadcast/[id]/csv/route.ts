import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Delivery report CSV. RLS: sirf banane wala / owner-admin dekh sakta hai. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const db = createClient() as unknown as SupabaseClient;
  const { data: { user } } = await db.auth.getUser();
  if (!user) return NextResponse.json({ error: "login" }, { status: 401 });
  const { data, error } = await db.from("broadcast_recipients").select("name, phone, channel, status, error, sent_at, delivered_at, read_at, failed_at").eq("broadcast_id", params.id).order("created_at").limit(50000);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const head = "name,phone,channel,status,error,sent_at,delivered_at,read_at,failed_at";
  const body = [head, ...(data ?? []).map((r: any) => [r.name, r.phone, r.channel, r.status, r.error, r.sent_at, r.delivered_at, r.read_at, r.failed_at].map(esc).join(","))].join("\n");
  return new NextResponse(body, { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="broadcast-${params.id.slice(0, 8)}.csv"` } });
}
