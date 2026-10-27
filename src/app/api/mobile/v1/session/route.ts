import { NextResponse } from "next/server";
import { mobilePasswordLogin } from "@/actions/login-v5";
import { PRODUCT_VERSION } from "@/lib/product-version";
import { appRoleFor } from "@/lib/mobile/roles";
import { createServiceClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

/**
 * Mobile login: ID / mobile / CNIC + password.
 * Wahi accounts, wahi taala. Token app ke PIN/fingerprint ke peeche rehta hai.
 */
export async function POST(request: Request) {
  let body: { identifier?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON sahi nahi hai." }, { status: 400 });
  }
  const result = await mobilePasswordLogin(body.identifier, String(body.password ?? ""));
  if (!result.ok) {
    const status = result.error === "e_rate" || result.error === "e_locked" ? 429 : 401;
    return NextResponse.json({ ok: false, error: result.error, retryAfterSeconds: result.retryAfterSeconds ?? null }, { status });
  }

  const service = createServiceClient() as any;
  let fieldAppRole: string | null = null;
  let designation: string | null = null;
  const staff = await service.from("staff_details").select("designation, field_app_role").eq("profile_id", result.user_id).maybeSingle();
  if (!staff.error && staff.data) {
    fieldAppRole = staff.data.field_app_role ?? null;
    designation = staff.data.designation ?? null;
  } else {
    const again = await service.from("staff_details").select("designation").eq("profile_id", result.user_id).maybeSingle();
    designation = again.data?.designation ?? null;
  }

  return NextResponse.json({
    ok: true,
    version: PRODUCT_VERSION,
    access_token: result.access_token,
    refresh_token: result.refresh_token,
    expires_at: result.expires_at,
    user_id: result.user_id,
    role: result.role,
    appRole: appRoleFor({ role: result.role, designation, fieldAppRole }),
  });
}
