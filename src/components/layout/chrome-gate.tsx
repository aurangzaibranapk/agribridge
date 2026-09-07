"use client";

import { useSearchParams } from "next/navigation";

/**
 * Workspace overlay ke andar khulne wala safha apna topbar/sidebar
 * dobara nahi dikhata -- warna do topbar/sidebar ek dusre ke andar
 * nazar aate (InPageWorkspace pehle se apna khud ka Wapas/title
 * dikhata hai).
 *
 * `?workspace=1` sirf isi liye hai -- safhe ka apna kaam (permission
 * checks, data fetch) bilkul pehle jaisa hi chalta hai, sirf ye ek
 * layer (sidebar/topbar) chhup jati hai.
 */
export function ChromeGate({ children }: { children: React.ReactNode }) {
  const params = useSearchParams();
  if (params.get("workspace") === "1") return null;
  return <>{children}</>;
}
