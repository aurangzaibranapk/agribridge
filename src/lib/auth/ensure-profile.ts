/**
 * Login hai magar profile nahi -- to database se khud theek karwao (560).
 *
 * 17 Oct: malik ka kisan login "Account setup adhoora hai" deta raha,
 * kyunke public.profiles mein qatar gum thi. Ab login ke waqt ek dafa
 * `fn_ensure_my_profile()` chalta hai: wo SIRF juRe record (farmer,
 * customer, vendor...) se darja banata hai -- staff kabhi nahi. Koi
 * juRa record na ho to kuch nahi banta aur purana paighaam hi aata hai.
 *
 * Migration abhi live na ho to rpc ghalti deta hai -- us surat mein
 * chupchaap purana raasta (profile nahi = adhoora) chalta hai.
 */

import type { UserRole } from "@/lib/utils/roles";

export type ProfileRow = { role: UserRole; is_active: boolean };

type ProfileQuery = {
  from(table: "profiles"): {
    select(cols: string): {
      eq(col: string, val: string): { maybeSingle(): PromiseLike<{ data: unknown }> };
    };
  };
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: unknown }>;
};

export async function loadOrHealProfile(client: unknown, userId: string): Promise<ProfileRow | null> {
  const c = client as ProfileQuery;
  const read = async () => {
    const { data } = await c.from("profiles").select("role, is_active").eq("id", userId).maybeSingle();
    return (data as ProfileRow | null) ?? null;
  };
  const first = await read();
  if (first) return first;
  try {
    const { data, error } = await c.rpc("fn_ensure_my_profile");
    if (error || !data) return null;
  } catch {
    return null;
  }
  return read();
}

/** Service client se (server actions): kisi khaas login ki profile yaqeeni banao. */
export async function ensureProfileFor(service: unknown, userId: string): Promise<string | null> {
  try {
    const { data, error } = await (service as ProfileQuery).rpc("fn_ensure_profile", { p_user: userId });
    if (error) return null;
    return (data as string | null) ?? null;
  } catch {
    return null;
  }
}
