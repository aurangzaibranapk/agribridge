// Recovery/Money form: kis party ke liye kaunsa ledger account (migration 535 se mel).
export const PARTY_ACCOUNTS: Record<string, string[]> = {
  customer: ["1100", "2030"],
  supplier: ["2000", "1120"],
  farmer: ["1150", "1140", "2010"],
  staff: ["1130", "2020", "2025"],
};
export const PARTY_ONLY_ACCOUNTS = Object.values(PARTY_ACCOUNTS).flat();

export function defaultAgainstAccount(partyType: string | undefined | null, direction: string): string {
  switch (partyType) {
    case "customer": return "1100";
    case "farmer": return direction === "receive" ? "1150" : "1140";
    case "staff": return direction === "receive" ? "1130" : "2020";
    case "supplier": return direction === "receive" ? "1120" : "2000";
    default: return direction === "receive" ? "1100" : "2000";
  }
}

/** Server guard ka mirror: null = theek, warna wajah. */
export function partyAccountProblem(partyType: string | undefined | null, partyId: string | undefined | null, account: string): string | null {
  const type = (partyType || "other").toLowerCase();
  const allowed = PARTY_ACCOUNTS[type];
  if (allowed) {
    if (!partyId) return `Party list se chunein (${type} ka record zaroori hai).`;
    if (!allowed.includes(account)) return `Account ${account} is party (${type}) ke khate ka nahi. Sahi account: ${allowed.join(", ")}.`;
    return null;
  }
  if (type === "other" && PARTY_ONLY_ACCOUNTS.includes(account)) {
    return `Account ${account} ke liye customer/supplier/farmer/staff party chunein.`;
  }
  return null;
}
