import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isStaffRole } from "@/lib/utils/roles";
import { accessFrom, canOpen } from "@/lib/effective-permissions";
import { homePageForRole } from "@/lib/departments";

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

  // Safha kholne ki rok. Owner/Super Admin/Admin ko har cheez khulti
  // hai; baqi sab ko sirf wo jo un ke apne set mein ho, warna un ke
  // department ke set mein. Ye rok seedhe URL par bhi lagti hai, sirf
  // menu chhupane par nahi -- warna rok koi rok hi nahi hoti.
  if (pathname.startsWith("/admin")) {
    const ownPages = (profile.allowed_pages as string[] | null) ?? null;

    // Department ka set sirf tab poochhte hain jab shakhs ka apna khali
    // ho -- har request par ek fazool query dalna poore admin ko dhima
    // kar deta.
    let rolePages: string[] | null = null;
    if (!ownPages || ownPages.length === 0) {
      const { data: rolePerm } = await supabase
        .from("role_page_permissions")
        .select("allowed_pages")
        .eq("role", profile.role)
        .maybeSingle();
      rolePages = (rolePerm?.allowed_pages as string[] | null) ?? [];
    }

    const access = accessFrom(profile.role, ownPages, rolePages);
    if (!canOpen(access, pathname)) {
      const url = request.nextUrl.clone();
      // Ghar bhejte hain, "ijazat nahi" wale safhe par nahi -- banda
      // aksar sirf ghalat link par pahunch gaya hota hai, aur us ka
      // apna dashboard us ke liye zyada kaam ka hai.
      const home = homePageForRole(profile.role);
      url.pathname = canOpen(access, home) ? home : (access.pages[2] ?? "/admin/permissions-denied");
      return NextResponse.redirect(url);
    }
  }

  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};