import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isStaffRole } from "@/lib/utils/roles";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let response = NextResponse.next({ request: { headers: request.headers } });
  if (!pathname.startsWith("/admin") && !pathname.startsWith("/portal")) return response;
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: "", ...options });
          response = NextResponse.next({ request: { headers: request.headers } });
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(url);
  }
  const { data: profile } = await supabase.from("profiles").select("role, is_active, allowed_pages").eq("id", user.id).single();
  if (!profile || !profile.is_active) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/admin") && !isStaffRole(profile.role)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Page-level access control: Owner/Super Admin/Admin see everything.
  // Every other staff role (Manager/Sales Staff) can ONLY visit pages
  // an admin has specifically checked for them on /admin/permissions -
  // this blocks direct URL access, not just hiding the sidebar link.
  if (pathname.startsWith("/admin")) {
    const isUnrestricted = profile.role === "owner" || profile.role === "super_admin" || profile.role === "admin";
    if (!isUnrestricted) {
      const allowedPages = (profile.allowed_pages as string[] | null) ?? [];
      const alwaysAllowed = ["/admin/permissions-denied", "/admin/my-attendance"];
      const isAllowed =
        alwaysAllowed.some((p) => pathname === p) ||
        allowedPages.some((p) => pathname === p || pathname.startsWith(p + "/"));
      if (!isAllowed) {
        const url = request.nextUrl.clone();
        url.pathname = allowedPages[0] ?? "/admin/permissions-denied";
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};