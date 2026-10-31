/**
 * Chiller ka shift total. Kisan ki alag qatar nahi.
 * SNF / TS / Adjusted phone lab se. Client ke bheje hue lab adad nahi.
 */

import { phoneLab, phoneReferenceTs, phoneSnfConstant, type PhoneLab } from "@/lib/milk-phone-lab";

export interface ChillerTotalDraft {
  chillerNo: string;
  grossL: string;
  fat: string;
  lr: string;
  snfConstant: number | null;
  referenceTs: number | null;
}

export interface ParsedChillerTotal {
  chillerNo: string;
  grossL: number;
  fat: number;
  lr: number;
  snfConstant: number;
  referenceTs: number;
  lab: PhoneLab;
}

function parseNum(raw: string, label: string): number | string {
  const text = raw.trim();
  if (!text) return `${label} likhein.`;
  if (!/^\d+(\.\d+)?$/.test(text)) return `${label} sahi adad nahi.`;
  const n = Number(text);
  if (!Number.isFinite(n)) return `${label} sahi adad nahi.`;
  return n;
}

export function parseChillerTotal(draft: ChillerTotalDraft): ParsedChillerTotal | { error: string } {
  const chillerNo = draft.chillerNo.trim();
  if (!chillerNo) return { error: "Chiller number likhein." };
  if (chillerNo.length > 40) return { error: "Chiller number 40 haroof se chhota rakhein." };

  const gross = parseNum(draft.grossL, "Gross miqdar");
  if (typeof gross === "string") return { error: gross };
  if (!(gross > 0) || gross > 100000) return { error: "Gross miqdar 0 se 100000 litre ke darmiyan ho." };

  const fat = parseNum(draft.fat, "FAT");
  if (typeof fat === "string") return { error: fat };
  if (!(fat > 0) || fat > 15) return { error: "FAT 0 se 15 ke darmiyan ho." };

  const lr = parseNum(draft.lr, "LR");
  if (typeof lr === "string") return { error: lr };
  if (!(lr > 0) || lr > 40) return { error: "LR 0 se 40 ke darmiyan ho." };

  const snfConstant = phoneSnfConstant(draft.snfConstant);
  const referenceTs = phoneReferenceTs(draft.referenceTs);
  const lab = phoneLab(gross, fat, lr, referenceTs, snfConstant);
  if (!lab) return { error: "SNF aur Adjusted nahi bane. Gross, FAT aur LR dobara dekhein." };

  return {
    chillerNo,
    grossL: Math.round(gross * 1000) / 1000,
    fat: Math.round(fat * 1000) / 1000,
    lr: Math.round(lr * 1000) / 1000,
    snfConstant,
    referenceTs,
    lab,
  };
}
