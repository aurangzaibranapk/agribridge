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
  // 0.805 tabhi jab bulane wala settings na bheje. Adaigi ka raasta
  // (fn_apply_milk_fat) settings ke baghair yahan nahi aata.
  // Raqam rounded adjusted volume se — SMS ka litre × rate wahi amount ho.
  const snf = Math.round((lr / 4 + fat * 0.2 + snfConstant) * 100) / 100;
  const ts = Math.round((fat + snf) * 100) / 100;
  const adjustedVolume = Math.round(volume * (ts / referenceTs) * 100) / 100;
  const amount = Math.round(adjustedVolume * ratePerLiter * 100) / 100;
  return { snf, ts, adjustedVolume, amount };
}

export function buildMilkReceiptSms(
  farmerName: string,
  entryDateTime: Date,
  volume: number,
  fat: number,
  lr: number,
  result: MilkCalcResult
): string {
  const dateStr = entryDateTime.toLocaleDateString("en-GB", {
    timeZone: "Asia/Karachi",
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const timeStr = entryDateTime.toLocaleTimeString("en-GB", {
    timeZone: "Asia/Karachi",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return `Dear ${farmerName}\nMilk Received: ${dateStr} ${timeStr}\nVol: ${volume.toFixed(1)}L, Fat: ${fat.toFixed(1)}%\nLR: ${lr.toFixed(1)}, SNF: ${result.snf.toFixed(2)}%\nAdj Vol: ${result.adjustedVolume.toFixed(2)}L\nAmount: Rs. ${result.amount.toFixed(2)}\nSubject to Verification`;
}