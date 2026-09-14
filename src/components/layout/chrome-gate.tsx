"use client";

import { usePathname, useSearchParams } from "next/navigation";

/**
 * Workspace overlay ke andar khulne wala safha apna topbar/sidebar
 * dobara nahi dikhata -- warna do topbar/sidebar ek dusre ke andar
 * nazar aate (InPageWorkspace pehle se apna khud ka Wapas/title
 * dikhata hai).
 *
 * `?workspace=1` sirf isi liye hai -- safhe ka apna kaam (permission
 * checks, data fetch) bilkul pehle jaisa hi chalta hai, sirf ye ek
 * layer (sidebar/topbar) chhup jati hai.
 *
 * `/admin/pos` bhi isi tarah -- malik (14 September): "POS open ho to
 * saari screen par aana chahiye". POS ka apna "← My Work" wapas jane
 * ka raasta upar khud maujood hai, is liye sidebar/topbar ki alag se
 * zaroorat nahi -- aur counter par cart/products ke liye poori chaurai
 * kaam ki hai.
 */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  const pathname = usePathname();
  if (params.get("workspace") === "1" || pathname === "/admin/pos") return null;
  return <>{children}</>;
}
