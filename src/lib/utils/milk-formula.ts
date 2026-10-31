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

/** lr/4 + fat×0.2 + constant. Handover aur kisan ki adaigi dono yahi raw hisaab. */
export function rawSnf(lr: number, fat: number, snfConstant: number): number {
  return lr / 4 + fat * 0.2 + snfConstant;
}

function expandScientific(text: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (!match) return text;
  const sign = match[1];
  const digits = match[2] + (match[3] ?? "");
  const point = match[2].length + Number(match[4]);
  let plain: string;
  if (point <= 0) plain = `0.${"0".repeat(-point)}${digits}`;
  else if (point >= digits.length) plain = digits + "0".repeat(point - digits.length);
  else plain = `${digits.slice(0, point)}.${digits.slice(point)}`;
  return sign + plain;
}

/**
 * Android DecimalFormat `0.000` + RoundingMode.CEILING.
 * Shortest decimal ke baad teen hisson par ceiling.
 * Fat 4.3, LR 27, constant 0.806: SNF 8.416, TS 12.717, qty 0.979.
 * Seedha Math.ceil(n*1000) kai dafa ek hissa zyada kar deta hai (8.175 → 8.176).
 */
export function roundLab3(n: number): number {
  if (!Number.isFinite(n) || n === 0) return 0;
  const neg = n < 0;
  let text = expandScientific(Math.abs(n).toString());
  if (text.startsWith(".")) text = `0${text}`;
  const [wholeRaw, frac = ""] = text.split(".");
  const whole = wholeRaw === "" ? "0" : wholeRaw;
  const head = (frac + "000").slice(0, 3);
  let milli = Number(whole) * 1000 + Number(head);
  if (/[1-9]/.test(frac.slice(3))) milli += 1;
  const rounded = milli / 1000;
  return neg ? -rounded : rounded;
}

export interface PhoneMilkLab {
  snf: number;
  ts: number;
  adjustedVolume: number;
  specificGravity: number;
  milkKg: number;
}

/** Phone "Milk TS% Volume" ke digits. Handover certificate yahi dikhata hai. */
export function calculatePhoneMilkLab(
  volume: number,
  fat: number,
  lr: number,
  snfConstant = 0.806,
  referenceTs = 13
): PhoneMilkLab {
  const snfRaw = rawSnf(lr, fat, snfConstant);
  const tsRaw = fat + snfRaw;
  const specificGravity = roundLab3(1 + lr / 1000);
  return {
    snf: roundLab3(snfRaw),
    ts: roundLab3(tsRaw),
    adjustedVolume: roundLab3(volume * (tsRaw / referenceTs)),
    specificGravity,
    milkKg: roundLab3(volume * (1 + lr / 1000)),
  };
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
  // Kisan ki SMS ab bhi 2 hisse: SNF pehle round, phir TS, phir litre.
  // Handover certificate calculatePhoneMilkLab (3 hisse, constant 0.806).
  const snf = Math.round(rawSnf(lr, fat, snfConstant) * 100) / 100;
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