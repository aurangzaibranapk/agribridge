import { NextResponse } from "next/server";
import { requestUser } from "@/lib/api-auth";
import { createServiceClient } from "@/lib/supabase/service";
import { fileMobileReport } from "@/lib/support/mobile-report";
import { reportContext } from "@/lib/mobile/report";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requestUser(request);
  if (!auth) return NextResponse.json({ error: "Login zaroori hai." }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON sahi nahi hai." }, { status: 400 });
  }
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("full_name, organization_id, role, is_active").eq("id", auth.userId).maybeSingle();
  if (!profile?.is_active || !profile.organization_id) return NextResponse.json({ error: "Ye account fa'aal nahi hai." }, { status: 403 });
  const ctxIn = (body.context && typeof body.context === "object" ? body.context : {}) as Record<string, unknown>;
  const filed = await fileMobileReport({
    userId: auth.userId,
    organizationId: profile.organization_id,
    fullName: profile.full_name ?? "User",
    text: String(body.text ?? ""),
    context: reportContext({
      screen: String(ctxIn.screen ?? "unknown"),
      route: String(ctxIn.route ?? "/"),
      userId: auth.userId,
      role: String(profile.role),
      appRole: ctxIn.appRole == null ? null : String(ctxIn.appRole),
      deviceModel: String(ctxIn.deviceModel ?? ""),
      os: String(ctxIn.os ?? ""),
      appVersion: String(ctxIn.appVersion ?? ""),
      network: String(ctxIn.network ?? ""),
      channel: String(ctxIn.channel ?? ""),
    }),
    screenshotBase64: typeof body.screenshot_base64 === "string" ? body.screenshot_base64 : null,
    screenshotMime: typeof body.screenshot_mime === "string" ? body.screenshot_mime : null,
    voiceBase64: typeof body.voice_base64 === "string" ? body.voice_base64 : null,
    voiceMime: typeof body.voice_mime === "string" ? body.voice_mime : null,
  });
  if (!filed.ok) return NextResponse.json({ error: filed.error }, { status: 400 });
  return NextResponse.json({ success: true, ticket: filed.ticket });
}
