/** Darje. Jo number bada, wo ooncha. Barabar darja ooncha nahi. */
export const ROLE_RANK: Record<string, number> = {
  owner: 6,
  super_admin: 5,
  admin: 4,
  manager: 3,
  hr: 2,
  finance: 2,
};

export function roleRank(role: string | null | undefined): number {
  if (!role) return 1;
  return ROLE_RANK[role] ?? 1;
}

/**
 * Actor ka darja target ke maujooda darje se ooncha ho, aur naye darje se bhi.
 * Admin doosra Admin nahi bana sakta, aur Super Admin ko neeche nahi gira sakta.
 */
export function roleChangeBlocked(
  actorRole: string | null | undefined,
  targetRole: string | null | undefined,
  nextRole: string | null | undefined,
): string | null {
  const actor = roleRank(actorRole);
  const current = roleRank(targetRole);
  const next = roleRank(nextRole);
  if (actor <= current) {
    return "Barabar ya oonche darje wale ka role aap nahi badal sakte.";
  }
  if (actor <= next) {
    return "Aap apne barabar ya ooncha darja nahi de sakte. Admin doosra Admin nahi bana sakta.";
  }
  return null;
}
