export type SalaryAmountInput = {
  basic: number;
  bonus: number;
  overtime: number;
  deductions: number;
  advance: number;
};

/** Manfi, NaN, ya sifar net tankhwah darj nahi hoti. */
export function salaryPaymentAmounts(input: SalaryAmountInput): { error: string } | { net: number } {
  const parts: [string, number][] = [
    ["Basic", input.basic],
    ["Bonus", input.bonus],
    ["Overtime", input.overtime],
    ["Kattauti", input.deductions],
    ["Advance", input.advance],
  ];
  for (const [label, n] of parts) {
    if (!Number.isFinite(n)) return { error: `${label} ka adad sahi nahi.` };
    if (n < 0) return { error: `${label} manfi nahi ho sakti.` };
  }
  const net = input.basic + input.bonus + input.overtime - input.deductions - input.advance;
  if (!Number.isFinite(net) || net <= 0) {
    return { error: "Net tankhwah sifar ya manfi nahi ho sakti." };
  }
  return { net };
}
