// Pakistan dairy industry standard 13-TS adjustment formula, used to
// standardize raw volume against quality (Fat + SNF) so a farmer
// bringing richer milk gets credited for MORE volume than they
// physically delivered, and thinner milk gets adjusted down - not the
// raw litres, always the adjusted litres, get paid.

export interface MilkCalcResult {
  snf: number;
  ts: number;
  adjustedVolume: number;
  amount: number;
}

export function calculateMilkValue(
  volume: number,
  fat: number,
  lr: number,
  ratePerLiter: number,
  snfConstant = 0.805,
  referenceTs = 13
): MilkCalcResult {
  const snf = lr / 4 + fat * 0.2 + snfConstant;
  const ts = fat + snf;
  const adjustedVolume = volume * (ts / referenceTs);
  const amount = adjustedVolume * ratePerLiter;
  return {
    snf: Math.round(snf * 100) / 100,
    ts: Math.round(ts * 100) / 100,
    adjustedVolume: Math.round(adjustedVolume * 100) / 100,
    amount: Math.round(amount * 100) / 100,
  };
}

export function buildMilkReceiptSms(
  farmerName: string,
  entryDateTime: Date,
  volume: number,
  fat: number,
  lr: number,
  result: MilkCalcResult
): string {
  const dateStr = entryDateTime.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
  const timeStr = entryDateTime.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `Dear ${farmerName}\nMilk Received: ${dateStr} ${timeStr}\nVol: ${volume.toFixed(1)}L, Fat: ${fat.toFixed(1)}%\nLR: ${lr.toFixed(1)}, SNF: ${result.snf.toFixed(2)}%\nAdj Vol: ${result.adjustedVolume.toFixed(2)}L\nAmount: Rs. ${result.amount.toFixed(2)}\nSubject to Verification`;
}