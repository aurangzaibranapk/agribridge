/**
 * Login ke baad agle safhe par jana -- poore safhe ke saath.
 *
 * =====================================================================
 * MALIK KI SHIKAYAT (17 October)
 * =====================================================================
 *
 * Kisan wale account se login kiya to "Safhe par kuch toot gaya" aaya,
 * wajah: "Cannot read properties of null (reading 'get')", aur URL
 * /login hi raha. error_log mein har dafa ek hi tarteeb milti hai:
 *
 *   1. "TypeError: network error"  -- agle safhe ka RSC jawab beech
 *      mein toot gaya (router.push aur foran router.refresh dono ek
 *      saath chalte hain; pehli fetch ka stream beech mein kat jata hai).
 *   2. do second baad "reading 'get'" -- jab "Dobara koshish karein"
 *      dabaya. Ye Next 14.2 ki apni ghalti hai: global-error ka
 *      reset() router ko dobara banata hai aur `parallelRoutes` null
 *      hota hai (vercel/next.js #66951, #55462).
 *
 * Login ke baad cookies badal chuki hoti hain -- is waqt client router
 * ke purane cache ke saath "naram" navigation ka koi faida nahi. Poora
 * safha lena (window.location.assign) sab se seedha aur pakka raasta
 * hai: naye cookies, naya layout, koi adhoora stream nahi.
 */

export const OFFLINE_ROUTE_KEY = "agribridge:last-login-route";

/**
 * Sirf apni website ke andar ka raasta. `redirectTo` URL se aata hai --
 * koi bhi `?redirectTo=https://bura.site` ya `//bura.site` laga kar
 * login ke baad bande ko bahar phenk sakta hai.
 */
export function safeInternalRoute(raw: string | null | undefined, fallback = "/"): string {
  const v = String(raw ?? "").trim();
  if (!v.startsWith("/")) return fallback;
  if (v.startsWith("//") || v.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(v)) return fallback;
  if (v === "/login" || v.startsWith("/login?") || v.startsWith("/login/")) return fallback;
  return v;
}

/** Login ke baad ki manzil: redirectTo (agar mehfooz ho) warna role ka ghar. */
export function routeAfterLogin(redirectTo: string | null | undefined, rolePath: string | null | undefined): string {
  const home = safeInternalRoute(rolePath, "/");
  return safeInternalRoute(redirectTo, home);
}

type NavWindow = {
  localStorage?: { setItem(k: string, v: string): void };
  location: { assign(url: string): void };
};

/** Manzil yaad rakho (offline ke liye) aur poora safha kholo. */
export function goAfterLogin(route: string, win: NavWindow | undefined = typeof window !== "undefined" ? (window as unknown as NavWindow) : undefined): void {
  if (!win) return;
  const target = safeInternalRoute(route, "/");
  try {
    win.localStorage?.setItem(OFFLINE_ROUTE_KEY, target);
  } catch {
    // Private window -- yaad na rahe to bhi login chalta hai.
  }
  win.location.assign(target);
}
