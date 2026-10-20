/** Owner ka account band, suspend ya delete nahi hota — Admin se bhi nahi. */
export function ownerAccountChangeBlocked(targetRole: string | null | undefined): string | null {
  if (targetRole === "owner") return "Owner account suspend, band ya delete nahi ho sakta.";
  return null;
}

/** Banane wala apni entry khud manzoor nahi karta. */
export function makerCheckerBlock(actorId: string | null | undefined, makerId: string | null | undefined): string | null {
  if (actorId && makerId && actorId === makerId) return "Apni entry khud manzoor nahi kar sakte.";
  return null;
}
