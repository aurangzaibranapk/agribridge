/** Owner dashboard look: "old" (default, purana) ya "new" (Render). Query param cookie se pehle. */
export const DASH_LOOK_COOKIE = "ab_dash_look";
export type DashLook = "old" | "new";
export function resolveDashLook(param: string | string[] | undefined, cookie: string | undefined): DashLook {
  const q = Array.isArray(param) ? param[0] : param;
  if (q === "new" || q === "old") return q;
  return cookie === "new" ? "new" : "old";
}
