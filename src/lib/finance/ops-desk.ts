import { mayDecideEntry } from "@/lib/approval/guards";

/**
 * Tel / ops cards — sirf maujooda qatarein ka hisaab.
 * Koi naya float, koi naya tankhwah formula, koi teesra brand nahi.
 *
 * Branch verify aur milk approve ki role-fehrist
 * `src/actions/maintenance.ts` ke BRANCH_ROLES / MILK_ROLES ke barabar hai.
 */

export const BRANCH_VERIFY_ROLES = ["owner", "super_admin", "admin", "manager"] as const;
export const MAINT_APPROVE_ROLES = ["owner", "super_admin", "admin", "manager", "milk_collection"] as const;

export type OpsSource = "route_fuel" | "generator" | "maintenance" | "machine_diesel";

export type OpsReview =
  | { kind: "approve_fuel" }
  | { kind: "approve_generator" }
  | { kind: "branch_verify" }
  | { kind: "approve_maintenance" }
  | { kind: "open_claims" }
  | { kind: "held"; reason: "self" | "role" | "wait" };

export interface OpsQueueItem {
  id: string;
  source: OpsSource;
  title: string;
  who: string | null;
  asset: string | null;
  amount: number | null;
  date: string;
  statusLabel: string;
  anomaly: boolean;
  review: OpsReview;
  href: string;
}

export interface OpsSpendLine {
  label: string;
  amount: number | null;
}

export interface OpsSpendCard {
  key: string;
  title: string;
  titleUr: string;
  blurb: string;
  amount: number | null;
  pending: number | null;
  lines: OpsSpendLine[];
  href: string;
}

export interface OpsMovement {
  id: string;
  title: string;
  detail: string;
  amount: number | null;
  date: string;
  statusLabel: string;
}

export interface OpsPayrollStrip {
  read: boolean;
  status: string | null;
  staff: number | null;
  payable: number | null;
  href: string;
}

export interface OpsDeskModel {
  monthLabel: string;
  monthPrefix: string;
  cards: OpsSpendCard[];
  queue: OpsQueueItem[];
  movements: OpsMovement[];
  payroll: OpsPayrollStrip;
  notes: string[];
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Pakistan (UTC+5), payroll page ke usi hisaab se. */
export function karachiMonth(now = new Date()): { year: number; month: number; prefix: string; label: string } {
  const pkt = new Date(now.getTime() + 5 * 3600 * 1000);
  const year = pkt.getUTCFullYear();
  const month = pkt.getUTCMonth() + 1;
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return { year, month, prefix, label: `${MONTHS[month - 1]} ${year}` };
}

export function inKarachiMonth(date: string | null | undefined, prefix: string): boolean {
  return !!date && date.slice(0, 7) === prefix;
}

export function opsStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "pending":
      return "Manzoori baqi";
    case "approved":
      return "Manzoor";
    case "rejected":
      return "Rad";
    case "branch_verified":
      return "Branch verify";
    case "claimed":
      return "Dawa — manager";
    case "manager_confirmed":
      return "Finance ki manzoori";
    case "verified":
      return "Tasdeeq";
    case "cancelled":
      return "Mansookh";
    default:
      return status?.trim() ? status : "—";
  }
}

export interface SpendPart {
  read: boolean;
  amounts: number[];
  pending: number;
}

/** Koi hissa na parha jaye to poora card "—" — adhoori jama ko poora kharcha mat kaho. */
export function spendCard(parts: SpendPart[]): { amount: number | null; pending: number | null } {
  if (parts.length === 0 || parts.some((p) => !p.read)) return { amount: null, pending: null };
  return {
    amount: parts.reduce((s, p) => s + p.amounts.reduce((a, n) => a + n, 0), 0),
    pending: parts.reduce((s, p) => s + p.pending, 0),
  };
}

export function opsReview(input: {
  source: OpsSource;
  status: string;
  role: string;
  actorId: string;
  makers: Array<string | null | undefined>;
  canFuel: boolean;
  canGen: boolean;
  canVerifyClaim: boolean;
  canApproveClaim: boolean;
}): OpsReview {
  const { source, status, role, actorId, makers, canFuel, canGen, canVerifyClaim, canApproveClaim } = input;
  const allowed = mayDecideEntry(role, actorId, makers);

  if (source === "route_fuel" && status === "pending") {
    if (!allowed) return { kind: "held", reason: "self" };
    if (!canFuel) return { kind: "held", reason: "role" };
    return { kind: "approve_fuel" };
  }
  if (source === "generator" && status === "pending") {
    if (!allowed) return { kind: "held", reason: "self" };
    if (!canGen) return { kind: "held", reason: "role" };
    return { kind: "approve_generator" };
  }
  if (source === "maintenance" && status === "pending") {
    if (!(BRANCH_VERIFY_ROLES as readonly string[]).includes(role)) return { kind: "held", reason: "role" };
    if (!allowed) return { kind: "held", reason: "self" };
    return { kind: "branch_verify" };
  }
  if (source === "maintenance" && status === "branch_verified") {
    if (!(MAINT_APPROVE_ROLES as readonly string[]).includes(role)) return { kind: "held", reason: "role" };
    if (!allowed) return { kind: "held", reason: "self" };
    return { kind: "approve_maintenance" };
  }
  if (source === "machine_diesel" && (status === "claimed" || status === "manager_confirmed")) {
    const can = status === "claimed" ? canVerifyClaim : canApproveClaim;
    if (!allowed) return { kind: "held", reason: "self" };
    if (!can) return { kind: "held", reason: "role" };
    return { kind: "open_claims" };
  }
  return { kind: "held", reason: "wait" };
}

export function sortQueue<T extends { anomaly: boolean; date: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => Number(b.anomaly) - Number(a.anomaly) || b.date.localeCompare(a.date));
}

export function sourceTitle(source: OpsSource): string {
  switch (source) {
    case "route_fuel":
      return "Route ka tel";
    case "generator":
      return "Generator diesel";
    case "maintenance":
      return "Gaari ki marammat";
    case "machine_diesel":
      return "Machine diesel";
  }
}
