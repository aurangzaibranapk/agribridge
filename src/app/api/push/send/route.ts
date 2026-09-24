import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { createServiceClient } from "@/lib/supabase/service";

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY ?? "";
const INTERNAL_SECRET = process.env.PUSH_SEND_SECRET ?? "";

interface PushSub { endpoint: string; p256dh: string; auth_key: string; }

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("x-push-secret");
  if (!INTERNAL_SECRET || authHeader !== INTERNAL_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return NextResponse.json({ error: "VAPID keys not set" }, { status: 500 });
  }

  webpush.setVapidDetails("mailto:aurangzaibranapk@gmail.com", VAPID_PUBLIC, VAPID_PRIVATE);

  const { title, body, url, user_ids } = await req.json();
  if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = createServiceClient() as any;
  let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth_key");
  if (user_ids?.length) query = query.in("user_id", user_ids);

  const { data: subs }: { data: PushSub[] | null } = await query;
  if (!subs?.length) return NextResponse.json({ sent: 0 });

  const payload = JSON.stringify({ title, body: body ?? "", url: url ?? "/admin" });
  const results = await Promise.allSettled(
    subs.map((s) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth_key } },
        payload
      )
    )
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const expired = results
    .map((r, i) =>
      r.status === "rejected" && (r.reason as { statusCode?: number })?.statusCode === 410
        ? subs[i].endpoint
        : null
    )
    .filter(Boolean) as string[];

  if (expired.length) {
    await supabase.from("push_subscriptions").delete().in("endpoint", expired);
  }

  return NextResponse.json({ sent, expired: expired.length });
}
