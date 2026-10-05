export type PartyBalanceStatus = "receivable" | "payable" | "settled";

/**
 * Positive signed balance means the party owes the company.
 * Negative signed balance means the company owes the party.
 * Keep the signed value for accounting; only use this helper for display.
 */
export function partyBalanceStatus(balance: number): PartyBalanceStatus {
  if (Math.abs(balance) < 0.005) return "settled";
  return balance > 0 ? "receivable" : "payable";
}

export function partyBalanceLabel(balance: number): string {
  const status = partyBalanceStatus(balance);
  if (status === "receivable") return "Receivable — lena hai";
  if (status === "payable") return "Payable — dena hai";
  return "Settled — khata clear";
}

export function partyBalanceAmount(balance: number): number {
  return Math.abs(balance);
}

