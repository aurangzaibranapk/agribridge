export type CommissionRule =
  | { kind: "percent"; percent: number; minimum?: number | null }
  | { kind: "fixed"; amount: number };

export type CommissionSnapshot = {
  gross: number;
  commission: number;
  merchantNet: number;
  label: string;
};

function money(value: number): number {
  return Math.round(Math.max(0, value) * 100) / 100;
}

/**
 * Commission order banne ke waqt snapshot hota hai. Baad mein Admin rule
 * badle to purane order ka hisaab nahi badalta.
 */
export function snapshotCommission(grossInput: number, rule: CommissionRule): CommissionSnapshot {
  const gross = money(grossInput);
  if (!(gross > 0)) return { gross: 0, commission: 0, merchantNet: 0, label: "—" };
  if (rule.kind === "fixed") {
    const commission = Math.min(gross, money(rule.amount));
    return { gross, commission, merchantNet: money(gross - commission), label: `Fixed Rs ${commission.toLocaleString("en-PK")}` };
  }
  const percent = Math.max(0, Math.min(100, Number(rule.percent) || 0));
  const calculated = money(gross * percent / 100);
  const minimum = money(Number(rule.minimum) || 0);
  const commission = Math.min(gross, Math.max(calculated, minimum));
  const minimumLabel = minimum > calculated ? ` · minimum Rs ${minimum.toLocaleString("en-PK")}` : "";
  return { gross, commission, merchantNet: money(gross - commission), label: `${percent}%${minimumLabel}` };
}

export type WeeklyAdjustment = {
  milkPayable: number;
  installmentApplied: number;
  farmerBankTransfer: number;
  stillOutstanding: number;
};

/** Qist pehle, bachi weekly milk payment farmer ke bank mein. */
export function weeklyMilkAdjustment(input: {
  milkPayable: number;
  installmentDue: number;
  outstanding: number;
}): WeeklyAdjustment {
  const milkPayable = money(input.milkPayable);
  const outstanding = money(input.outstanding);
  const due = Math.min(outstanding, money(input.installmentDue));
  const installmentApplied = Math.min(milkPayable, due);
  return {
    milkPayable,
    installmentApplied,
    farmerBankTransfer: money(milkPayable - installmentApplied),
    stillOutstanding: money(outstanding - installmentApplied),
  };
}

export function merchantRoleLabel(role: "supplier" | "dealer"): string {
  return role === "supplier" ? "Supplier" : "Dealer";
}
