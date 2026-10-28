const HQ = new Set(["owner", "super_admin", "admin"]);

/** Statement sirf apni branch ka. Owner/Admin sab dekh sakte hain. */
export function statementPartyVisible(args: {
  role: string | null | undefined;
  active?: boolean;
  callerBranchId: string | null | undefined;
  partyBranchId: string | null | undefined;
}): boolean {
  if (args.active === false) return false;
  const role = String(args.role ?? "");
  if (HQ.has(role)) return true;
  if (!args.callerBranchId || !args.partyBranchId) return false;
  return args.callerBranchId === args.partyBranchId;
}
