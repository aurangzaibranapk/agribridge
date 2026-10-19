/**
 * global-error se wapsi -- bina Next 14.2 ke reset() ke.
 *
 * `reset()` global-error mein toota hua hai: wo router dobara banata hai,
 * `parallelRoutes` null milta hai, aur nayi kharabi aati hai
 * "Cannot read properties of null (reading 'get')" (vercel/next.js
 * #66951). Malik ko 17 October login ke baad yehi nazar aaya. Is liye
 * "Dobara koshish karein" ab poora safha naya leta hai.
 */

/**
 * Raaste ki aarzi kharabi -- jawab beech mein toot gaya ya pahuncha hi
 * nahi. Har browser apne alfaz likhta hai: Chrome "network error" (jab
 * stream beech mein kate) aur "Failed to fetch", Firefox "NetworkError
 * when attempting to fetch resource", Safari "Load failed".
 */
export function aarziNetworkKharabi(error: unknown): boolean {
  if (!error) return false;
  const m = String((error as { message?: string }).message ?? "").trim();
  return (
    /^network error$/i.test(m) ||
    /^failed to fetch$/i.test(m) ||
    /networkerror when attempting to fetch/i.test(m) ||
    /^load failed$/i.test(m) ||
    /failed to fetch rsc payload/i.test(m)
  );
}

/** Wohi URL, ek nishan ke saath taake browser cache se purana safha na de. */
export function nayaSafhaUrl(href: string, now = Date.now()): string {
  const url = new URL(href);
  url.searchParams.set("_r", String(now));
  return url.toString();
}

/** Kharabi ke safhe se "wapas" kahan jaye -- kisan ko /admin nahi bhejna. */
export function wapsiKaRaasta(pathname: string | null | undefined): { href: string; label: string } {
  const p = String(pathname ?? "");
  if (p.startsWith("/portal")) return { href: "/portal/dashboard", label: "Dashboard par wapas" };
  if (p.startsWith("/vendor")) return { href: "/vendor", label: "Vendor safhe par wapas" };
  if (p.startsWith("/admin")) return { href: "/admin/my-work", label: "Mera Kaam par wapas" };
  return { href: "/", label: "Shuru ke safhe par" };
}

type ReloadWindow = { location: { href: string; replace(url: string): void } };

export function poraSafhaDobara(win: ReloadWindow | undefined = typeof window !== "undefined" ? (window as unknown as ReloadWindow) : undefined): void {
  if (!win) return;
  win.location.replace(nayaSafhaUrl(win.location.href));
}
