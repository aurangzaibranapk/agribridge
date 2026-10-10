/**
 * Approval-path guards (10 Oct 2026). Pure functions -- server actions
 * inhe call karte hain, tests/approval-guards.cjs inhe seedha jaanchta hai.
 */

/** Banane wala aur manzoor karne wala ek hi shakhs? (null creator = purana record, rok nahi). */
export function isSelfApproval(creatorId: string | null | undefined, actorId: string | null | undefined): boolean {
  return Boolean(creatorId) && Boolean(actorId) && creatorId === actorId;
}

/** Stock count post: sirf verified, aur starter khud post nahi kar sakta. */
export function stockCountPostCheck(
  count: { status: string; started_by?: string | null },
  posterId: string
): { ok: true } | { ok: false; error: string } {
  if (count.status === "counting") return { ok: false, error: "Pehle ginti ki tasdeeq (verify) zaroori hai — phir post hogi." };
  if (count.status !== "verified") return { ok: false, error: "Ye ginti pehle hi mukammal ho chuki hai." };
  if (isSelfApproval(count.started_by, posterId)) return { ok: false, error: "Ye ginti aap ne shuru ki hai — post doosra approver karega." };
  return { ok: true };
}

/** Extra item ki ginti qatar: stock nahi hilta, farq = mila hua (post par chalega). */
export function extraItemCountLine(onHand: number, foundQty: number) {
  const r = (v: number) => Math.round(v * 100) / 100;
  return { expected_qty: r(onHand), counted_qty: r(onHand + foundQty), difference_qty: r(foundQty) };
}

/** Purchase "abhi diya" ab manzoori tak ruka -- sirf approve par aur sirf ek dafa post. */
export function shouldPostHeldPayment(
  decision: string,
  held: { amount: number; posted?: boolean } | null | undefined
): boolean {
  return decision === "approve" && Boolean(held) && !held!.posted && Number(held!.amount) > 0;
}
