/** Sending/load/bill: collected minus principal. Receiving: principal minus cash paid. */
export function deskFee(principal: string, cashTotal: string, direction: "sending" | "receiving" = "sending") {
  const amount = Number(principal.replace(/,/g, ""));
  const total = cashTotal.trim() === "" ? amount : Number(cashTotal.replace(/,/g, ""));
  const difference = direction === "receiving" ? amount - total : total - amount;
  const valid = Number.isFinite(amount) && Number.isFinite(total) && amount >= 0 && total >= 0 && difference >= 0;
  return { fee: valid ? Math.round((difference + Number.EPSILON) * 100) / 100 : 0, valid };
}
