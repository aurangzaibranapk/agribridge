import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// Google/Facebook sign-in lands here with a ?code param. This exchanges
// it for a session (setting the auth cookie), then — for a first-time
// sign-in only — creates the matching farmers row, the same way
// registerFarmer does for mobile/email sign-ups. Everything past that
// (name, CNIC, farming details, documents) is filled in later from the
// Farmer Portal profile page, same as every other sign-up path.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");

  // This app is only ever deployed at this one domain, so the redirect
  // target is hardcoded rather than derived from the incoming request —
  // behind cPanel/Passenger's reverse proxy, Next.js sees the internal
  // request (often http://localhost:PORT), not the public domain, and
  // relying on forwarded headers turned out to be unreliable on this
  // host. Local development (`npm run dev`) isn't affected since OAuth
  // sign-in isn't tested that way.
  const origin = "https://alranatraders.pk";

  if (code) {
    const supabase = createClient();
    const { data } = await supabase.auth.exchangeCodeForSession(code);

    if (data.user) {
      const serviceClient = createServiceClient();
      const { data: existingFarmer } = await serviceClient
        .from("farmers")
        .select("id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (!existingFarmer) {
        // The database trigger that creates the profiles row on signup
        // only assigns role='farmer' when raw_user_meta_data.role is set
        // to that — which isn't possible to pass through an OAuth
        // provider redirect, so it otherwise falls back to 'sales_staff'.
        // This callback is only ever reached from the public farmer
        // registration/login pages, so it's safe to correct that default
        // here, immediately after a brand new sign-in.
        await serviceClient.from("profiles").update({ role: "farmer" }).eq("id", data.user.id).eq("role", "sales_staff");

        await serviceClient.from("farmers").insert({
          user_id: data.user.id,
          email: data.user.email ?? null,
          full_name: (data.user.user_metadata?.full_name as string) || (data.user.user_metadata?.name as string) || null,
        });
      }
    }
  }

  return NextResponse.redirect(`${origin}/portal/dashboard`);
}