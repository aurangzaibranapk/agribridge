/**
 * Support assign choice -- "person:<uuid>" / "agent:<key>" / "" (unassigned).
 * Test: npm run test:support
 */
export type AssignChoice = { kind: "person"; id: string } | { kind: "agent"; key: string } | { kind: "unassigned" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function parseAssignChoice(raw: unknown): AssignChoice | { kind: "invalid" } {
  const value = String(raw ?? "").trim();
  if (!value || value === "unassigned") return { kind: "unassigned" };
  const [kind, rest] = [value.slice(0, value.indexOf(":")), value.slice(value.indexOf(":") + 1)];
  if (kind === "person" && UUID.test(rest)) return { kind: "person", id: rest };
  if (kind === "agent" && /^[a-z0-9_-]{1,60}$/i.test(rest)) return { kind: "agent", key: rest.toLowerCase() };
  return { kind: "invalid" };
}

/** Raiser ko har tabdeeli ka paighaam -- khud tabdeeli karne wale ko nahi. */
export function reporterNotice(input: { reporterId: string | null; actorId: string; event: "assigned" | "status" | "resolved"; ref: string; detail: string }) {
  if (!input.reporterId || input.reporterId === input.actorId) return null;
  const title = input.event === "resolved" ? `${input.ref} · Hal ho gaya ✅` : input.event === "assigned" ? `${input.ref} · Assign ho gaya` : `${input.ref} · Status update`;
  return { userId: input.reporterId, title, message: input.detail, link: "/admin/my-work" };
}
