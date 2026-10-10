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

const MASTER_ROLES = ["owner", "admin", "super_admin"];

/**
 * Purchase approve (fix/approval-queue-gaps): staff ki purchase pehle Manager
 * verify kare, phir doosra Owner/Admin approve. Owner/Admin ki banayi purchase
 * ke liye verify marhala nahi (wo khud manager se upar hain) magar approve
 * phir bhi doosra Owner/Admin karega (isSelfApproval alag check).
 */
export function purchaseApproveCheck(
  p: { review_status: string | null; verified_by?: string | null },
  creatorRole: string | null | undefined,
  approverId: string
): { ok: true } | { ok: false; error: string } {
  const rs = p.review_status ?? "submitted";
  if (rs === "approved") return { ok: false, error: "Ye purchase pehle hi manzoor ho chuki hai." };
  if (rs === "sent_back" || rs === "rejected") return { ok: false, error: "Ye purchase wapas bheji/radd ho chuki hai — banane wala pehle dobara submit kare." };
  const creatorIsMaster = MASTER_ROLES.includes(creatorRole ?? "");
  if (rs === "submitted" && !creatorIsMaster) return { ok: false, error: "Pehle Manager verify kare, phir manzoori hogi." };
  if (rs === "verified" && isSelfApproval(p.verified_by, approverId)) return { ok: false, error: "Jis ne verify kiya wo khud manzoor nahi kar sakta — doosra Owner/Admin kare." };
  if (rs !== "submitted" && rs !== "verified") return { ok: false, error: "Purchase manzoori ke marhale mein nahi." };
  return { ok: true };
}

/** Partial/force-close ginti: jis ne force-close (verify) kiya wo post nahi kar sakta. */
export function partialCountPosterCheck(unfilled: number, verifiedBy: string | null | undefined, posterId: string): { ok: true } | { ok: false; error: string } {
  if (unfilled > 0 && isSelfApproval(verifiedBy, posterId)) {
    return { ok: false, error: "Na-gini cheezon wali ginti aap ne band ki hai — post doosra Admin/Owner karega." };
  }
  return { ok: true };
}

/** Agri return receive (shop ka credit) sirf Owner/Admin -- warehouse akela nahi. */
export function canFinalizeAgriReturn(role: string | null | undefined): boolean {
  return MASTER_ROLES.includes(role ?? "");
}

/** POS wapsi: code wala manager aur counter wala ek nahi; Admin review doosra banda. */
export function posReturnReviewCheck(
  r: { created_by?: string | null; authorized_by?: string | null; admin_review_status?: string | null },
  reviewerRole: string | null | undefined,
  reviewerId: string
): { ok: true } | { ok: false; error: string } {
  if (!MASTER_ROLES.includes(reviewerRole ?? "")) return { ok: false, error: "POS wapsi ka review sirf Owner/Admin kar sakta hai." };
  if ((r.admin_review_status ?? "pending") !== "pending") return { ok: false, error: "Is wapsi ka review ho chuka hai." };
  if (isSelfApproval(r.created_by, reviewerId) || isSelfApproval(r.authorized_by, reviewerId)) {
    return { ok: false, error: "Jis ne wapsi ki ya apna code lagaya wo khud review nahi kar sakta." };
  }
  return { ok: true };
}
