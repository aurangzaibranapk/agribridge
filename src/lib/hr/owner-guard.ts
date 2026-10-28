import { mayDecideEntry } from "@/lib/approval/guards";

/** Owner ka account band, suspend ya delete nahi hota — Admin se bhi nahi. */
export function ownerAccountChangeBlocked(targetRole: string | null | undefined): string | null {
  if (targetRole === "owner") return "Owner account suspend, band ya delete nahi ho sakta.";
  return null;
}

/** Staff apni entry nahi karta. Admin/Owner kar sakte hain (mayDecideEntry). */
export function makerCheckerBlock(
  actorId: string | null | undefined,
  makerId: string | null | undefined,
  role?: string | null,
): string | null {
  if (!actorId || !makerId || actorId !== makerId) return null;
  if (mayDecideEntry(role, actorId, [makerId])) return null;
  return "Apni entry khud manzoor nahi kar sakte.";
}
