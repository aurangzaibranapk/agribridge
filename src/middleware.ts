import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isStaffRole } from "@/lib/utils/roles";
import { homePageForRole } from "@/lib/departments";
import { ACCESS_REVIEW_ROUTE, roleCanReviewAccess, headGrantActive } from "@/lib/access/reviewer-routes";

/** Ye hamesha khulte hain, chahe ijazat mein likhe hon ya na hon. */
const ALWAYS_OPEN = ["/admin/permissions-denied", "/admin/my-attendance"];

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
  const { data: profile } = await supabase.from("profiles").select("role, is_active, allowed_pages, extra_roles").eq("id", user.id).single();
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
  // hai; baqi sab ko sirf wo feature jin par un ki 'view' ki ijazat ho.
  // Ye rok seedhe URL par bhi lagti hai, sirf menu chhupane par nahi --
  // warna rok koi rok hi nahi hoti.
  if (pathname.startsWith("/admin")) {
    const unrestricted =
      profile.role === "owner" || profile.role === "super_admin" || profile.role === "admin";

    if (!unrestricted) {
      // Ek hi query: is banday ki poori ijazat (role ki + apni + waqti),
      // wahi view jise menu bhi parhta hai. Do jagah alag hisaab hota to
      // ek din menu aur rok alag baat kehne lagte.
      const { data: rows } = await supabase
        .from("v_user_feature_access")
        .select("route, actions")
        .eq("profile_id", user.id);

      // Apna department dashboard hamesha khulta hai. Wo feature ki
      // fehrist mein nahi hai (wo kaam nahi, kaam ka ghar hai), aur ise
      // bhoolne ka matlab hota ke banda login ke foran baad rok par ja
      // takraye -- pehli hi cheez jo wo dekhta, wo "ijazat nahi" hoti.
      const allowed = [...ALWAYS_OPEN, homePageForRole(profile.role)];
      for (const row of rows ?? []) {
        if (!row.route) continue;
        if (!((row.actions as string[] | null) ?? []).includes("view")) continue;
        allowed.push(row.route);
      }

      // Ijazat ki darkhwastein: Manager aur chalta hua Department Head
      // wahan ja sakte hain, chahe koi feature permission na ho. Shart
      // wahi hai jo menu (nav.ts) aur safha (page.tsx) parhte hain --
      // teenon reviewer-routes.ts se. Pehle sirf menu theek kiya gaya
      // tha aur rok yahan purani reh gayi thi: card nazar aata tha,
      // click par banda wapas My Work par pahunch jata tha.
      if (roleCanReviewAccess(profile.role)) {
        allowed.push(ACCESS_REVIEW_ROUTE);
      } else {
        const { data: headGrant } = await supabase
          .from("department_head_grants")
          .select("starts_at, expires_at")
          .eq("profile_id", user.id)
          .maybeSingle();
        if (headGrantActive(headGrant)) allowed.push(ACCESS_REVIEW_ROUTE);
      }

      // Nayi ijazat kahin se na mile to purane raaste par -- warna wo
      // banda apne hi system se bahar ho jata hai. Ghalat menu se band
      // system kahin bura hai.
      if (!rows || rows.length === 0) {
        const ownPages = (profile.allowed_pages as string[] | null) ?? null;
        let rolePages: string[] = [];
        if (!ownPages || ownPages.length === 0) {
          // Apna department AUR jo doosre diye gaye hon (193) -- sab ke
          // safhe jore jate hain. Sirf apna dekhna doosre department ko
          // bemaani kar deta.
          const { data: rolePerm } = await supabase
            .from("role_page_permissions")
            .select("allowed_pages")
            .in("role", [profile.role, ...((profile.extra_roles as string[] | null) ?? [])]);
          rolePages = [
            ...new Set((rolePerm ?? []).flatMap((r) => (r.allowed_pages as string[] | null) ?? [])),
          ];
        }
        allowed.push(...(ownPages && ownPages.length > 0 ? ownPages : rolePages));
      }

      // Sab se lamba milta hua raasta jeetta hai -- warna
      // /admin/milk-collection ki ijazat chiller ka darwaza bhi khol
      // deti.
      const canOpenPath = (path: string) =>
        allowed.some((r) => path === r || path.startsWith(r + "/"));

      if (!canOpenPath(pathname)) {
        const url = request.nextUrl.clone();
        // Ghar bhejte hain, "ijazat nahi" wale safhe par nahi -- banda
        // aksar sirf ghalat link par pahunch gaya hota hai.
        const home = homePageForRole(profile.role);
        url.pathname = canOpenPath(home)
          ? home
          : (allowed.find((r) => r.startsWith("/admin/") && !ALWAYS_OPEN.includes(r)) ??
             "/admin/permissions-denied");
        return NextResponse.redirect(url);
      }
    }
  }

  return response;
}
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};