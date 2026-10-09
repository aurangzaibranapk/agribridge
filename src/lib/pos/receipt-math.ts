export function receiptBalances(outstandingAfterSale: number, khataThisSale: number) {
  const outstanding = Number(outstandingAfterSale) || 0;
  const khata = Number(khataThisSale) || 0;
  return {
    previous: Math.round((outstanding - khata) * 100) / 100,
    current: Math.round(outstanding * 100) / 100,
  };
}

export function receiptLineSumMatches(itemSum: number, discount: number, grandTotal: number) {
  return Math.round((Number(itemSum) - Number(discount)) * 100) / 100 === Math.round(Number(grandTotal) * 100) / 100;
}
