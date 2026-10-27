/**
 * Ek test login har role ka ghar dekh sakta hai.
 * Switcher sirf test flag + debug/internal par. Production par chhupa.
 * Password aur auth user is file mein nahi.
 */

import type { AppChannel } from "./channel";
import type { FetchLike } from "./live-login";
import { liveGet, type LiveAuth } from "./live-read";
import { isPortalAdmin, type AppRole } from "./roles";

export const TEST_LOGIN_EMAIL = "app-test@alranatraders.pk";

export const SWITCH_ROLES = ["admin", "farmer", "customer", "mca", "mco", "vet", "staff", "dealer"] as const;

export type SwitchRole = (typeof SWITCH_ROLES)[number];

const LABELS: Record<SwitchRole, string> = {
  admin: "Admin",
  farmer: "Kisan",
  customer: "Customer",
  mca: "MCA",
  mco: "MCO",
  vet: "Vet",
  staff: "Staff",
  dealer: "Dealer",
};

export function isSwitchRole(value: string | null | undefined): value is SwitchRole {
  return (SWITCH_ROLES as readonly string[]).includes(String(value ?? ""));
}

export function switchRoleLabel(role: AppRole): string {
  return isSwitchRole(role) ? LABELS[role] : role;
}

/** Production channel par flag ho to bhi button nahi. */
export function showRoleSwitch(channel: AppChannel, isTestAccount: boolean): boolean {
  return isTestAccount === true && (channel === "debug" || channel === "internal");
}

/** Admin/owner ka Role dekho. Test account ka Role badlo alag rehta hai. */
export function showRolePreview(channel: AppChannel, portalRole: string | null | undefined, isTestAccount: boolean): boolean {
  return isTestAccount !== true && (channel === "debug" || channel === "internal") && isPortalAdmin(portalRole);
}

/** Column na ho to false. Asal admin ka ghar isi wajah se nahi tut-ta. */
export async function readTestAccount(auth: LiveAuth, userId: string, fetchImpl: FetchLike): Promise<boolean> {
  if (!userId.trim()) return false;
  const res = await liveGet<{ is_test_account?: boolean }>(
    auth,
    `profiles?id=eq.${encodeURIComponent(userId)}&select=is_test_account`,
    fetchImpl,
  );
  if (!res.ok) return false;
  return res.rows.some((row) => row.is_test_account === true);
}
