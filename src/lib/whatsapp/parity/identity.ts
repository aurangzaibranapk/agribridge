/**
 * WhatsApp = App, Phase 1 (19 Oct 2026): number -> tasdeeq-shuda account.
 * Pure qaida (tests) + 610 ka RPC. 610 abhi live par nahi -- RPC na mile
 * to "unavailable" aur webhook purane raaste par chalta hai.
 */
export type WaKind = "owner" | "admin" | "staff" | "farmer" | "customer" | "unknown" | "ambiguous" | "unavailable";

export interface WaCandidate {
  source: "profile" | "staff_whatsapp" | "farmer" | "customer";
  user_id: string | null;
  profile_role: string | null;
}

export interface WaIdentity {
  kind: WaKind;
  userId: string | null;
  role: string | null;
  branchId: string | null;
  fullName: string | null;
  farmerId: string | null;
  customerIds: string[];
  listedAdmin: boolean;
}

export const UNKNOWN: WaIdentity = { kind: "unknown", userId: null, role: null, branchId: null, fullName: null, farmerId: null, customerIds: [], listedAdmin: false };

/** Wohi qaida jo 610 fn_wa_resolve_identity chalata hai (test dono ko milata hai). */
export function kindForRole(role: string | null, hasFarmerCandidate: boolean): WaKind {
  if (role === "owner") return "owner";
  if (role === "super_admin" || role === "admin") return "admin";
  if (role === "farmer" || (role == null && hasFarmerCandidate)) return "farmer";
  if (role == null || role === "customer" || role === "customer_portal") return "customer";
  return "staff";
}

export function resolveCandidates(cands: WaCandidate[]): { kind: WaKind; userId: string | null; role: string | null } {
  const users = [...new Set(cands.map((c) => c.user_id).filter((u): u is string => !!u))];
  if (users.length === 0) return { kind: "unknown", userId: null, role: null };
  if (users.length > 1) return { kind: "ambiguous", userId: null, role: null };
  const mine = cands.filter((c) => c.user_id === users[0]);
  const role = mine.find((c) => c.profile_role)?.profile_role ?? null;
  return { kind: kindForRole(role, mine.some((c) => c.source === "farmer")), userId: users[0], role };
}

type Rpc = (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;

export async function identifySender(rpc: Rpc, phoneKey: string | null): Promise<WaIdentity> {
  if (!phoneKey || phoneKey.length !== 10) return UNKNOWN;
  const { data, error } = await rpc("fn_wa_resolve_identity", { p_phone_key: phoneKey });
  if (error) return { ...UNKNOWN, kind: "unavailable" };
  const r = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | undefined;
  if (!r) return UNKNOWN;
  const kind = String(r.kind ?? "unknown") as WaKind;
  const known: WaKind[] = ["owner", "admin", "staff", "farmer", "customer", "unknown", "ambiguous"];
  if (!known.includes(kind)) return UNKNOWN;
  return {
    kind,
    userId: (r.user_id as string) ?? null,
    role: (r.profile_role as string) ?? null,
    branchId: (r.branch_id as string) ?? null,
    fullName: (r.full_name as string) ?? null,
    farmerId: (r.farmer_id as string) ?? null,
    customerIds: Array.isArray(r.customer_ids) ? (r.customer_ids as string[]) : [],
    listedAdmin: Boolean(r.listed_admin),
  };
}
