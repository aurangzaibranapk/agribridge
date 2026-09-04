import { postJournal, type JournalLine } from "@/lib/ledger/post";
import { ACC, glForFinanceAccount, type EventContext, type PostResult } from "@/lib/ledger/rules";

/**
 * Mustaqil asaason ke chaar waqiat -> journal entry.
 *
 * Ye file wohi kaam karti hai jo rules.ts baqi nizam ke liye karti hai:
 * kaarobari waqia yahan aata hai, khata code ka faisla YAHIN hota hai,
 * aur entry usi ek `journal_entries` mein jati hai jahan POS, kharid,
 * doodh aur machinery pehle se jati hain.
 *
 * Fixed Assets ka apna alag "hisaab" na banane ki wajah bilkul wohi hai
 * jo poore nizam mein hai: do jagah do adad ban jate hain, dono theek
 * lagte hain, aur koi nahi bata sakta ke sahi kaunsa hai.
 *
 * KHATA KAHAN SE AATA HAI: asaase ki QISM se (asset_categories), banda
 * apne haath se nahi chunta. Isi liye har gaari 1320 mein jati hai aur
 * har computer 1340 mein -- aur do saal baad bhi ye sawal ka jawab
 * milta hai ke "gaariyon par kitna laga hai".
 */

/** Paisa kahan se gaya jab asaasa khareeda gaya. */
export type AssetFunding =
  | { kind: "cash"; financeAccountId: string }
  | { kind: "credit"; supplierId: string | null }
  /** Pehle se apna tha -- nizam se pehle ka. Opening balance ki tarah. */
  | { kind: "opening" };

/**
 * Khareed. Asaasa apne khate mein charhta hai, aur paisa jahan se gaya
 * wahan se ghatta hai.
 *
 * Ye KHARCHA NAHI hai -- aur yehi is poore hisse ki buniyad hai. Rs 12
 * lakh ki gaari us mahine ka kharcha likh dena us mahine ka nafa kha
 * jata hai aur agle paanch saal ka nafa jhoota bara dikhata hai. Gaari
 * ki qeemat un saalon mein baanti jati hai jin mein wo chalti hai --
 * usi ka naam depreciation hai.
 */
export async function postAssetAcquisition(args: {
  assetId: string;
  code: string;
  name: string;
  assetAccount: string;
  amount: number;
  funding: AssetFunding;
  ctx: EventContext;
}): Promise<PostResult> {
  const memo = `${args.code} — ${args.name}`;
  let credit: JournalLine;

  if (args.funding.kind === "cash") {
    credit = {
      account: await glForFinanceAccount(args.funding.financeAccountId),
      credit: args.amount,
      memo,
    };
  } else if (args.funding.kind === "credit") {
    credit = {
      account: ACC.supplierPayable,
      credit: args.amount,
      partyType: args.funding.supplierId ? "supplier" : null,
      partyId: args.funding.supplierId,
      memo,
    };
  } else {
    credit = { account: ACC.openingEquity, credit: args.amount, memo };
  }

  return postJournal({
    description: `Asaasa khareeda: ${memo}`,
    sourceModule: "assets",
    sourceId: args.assetId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [{ account: args.assetAccount, debit: args.amount, memo }, credit],
  });
}

export interface DepreciationLine {
  expenseAccount: string;
  accumAccount: string;
  amount: number;
}

/**
 * Mahine ki ghisai.
 *
 * Qatarein khate ke hisaab se JAMA ki jati hain, har asaase ki alag
 * nahi. Sau asaason ki do sau qatarein ledger mein daal dene se journal
 * padhne ke qabil nahi rehta; kis asaase par kitni ghisai lagi, wo
 * `asset_depreciation_lines` mein poori tafseel se maujood hai aur asaase
 * ke apne safhe par nazar aati hai.
 */
export async function postAssetDepreciation(args: {
  runId: string;
  periodLabel: string;
  lines: DepreciationLine[];
  ctx: EventContext;
}): Promise<PostResult> {
  const expense = new Map<string, number>();
  const accum = new Map<string, number>();
  for (const l of args.lines) {
    expense.set(l.expenseAccount, (expense.get(l.expenseAccount) ?? 0) + l.amount);
    accum.set(l.accumAccount, (accum.get(l.accumAccount) ?? 0) + l.amount);
  }

  const lines: JournalLine[] = [];
  for (const [account, amount] of expense) {
    lines.push({ account, debit: Math.round(amount * 100) / 100, memo: `Depreciation ${args.periodLabel}` });
  }
  for (const [account, amount] of accum) {
    lines.push({ account, credit: Math.round(amount * 100) / 100, memo: `Depreciation ${args.periodLabel}` });
  }

  return postJournal({
    description: `Depreciation — ${args.periodLabel}`,
    sourceModule: "assets.depreciation",
    sourceId: args.runId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}

/**
 * Farokht ya kitab se kharij.
 *
 * Chaar rukh ek sath: asaasa kitab se nikalta hai (poori qeemat par),
 * us par jama shuda ghisai bhi nikalti hai, paisa jo aaya wo andar aata
 * hai, aur jo farq bacha wo nafa ya nuqsan hai.
 *
 * Sab se aam ghalti yahan ye hoti hai ke sirf aaya hua paisa aamdani
 * likh diya jaye. Us surat mein Rs 12 lakh ki gaari Rs 3 lakh mein bikne
 * par kitab mein Rs 3 lakh ka NAFA nazar aata hai, jabke asal mein
 * nuqsan bhi ho sakta hai.
 */
export async function postAssetDisposal(args: {
  disposalId: string;
  code: string;
  name: string;
  assetAccount: string;
  accumAccount: string;
  grossValue: number;
  accumulated: number;
  proceeds: number;
  financeAccountId: string | null;
  ctx: EventContext;
}): Promise<PostResult> {
  const memo = `${args.code} — ${args.name}`;
  const bookValue = Math.round((args.grossValue - args.accumulated) * 100) / 100;
  const gain = Math.round((args.proceeds - bookValue) * 100) / 100;

  const lines: JournalLine[] = [{ account: args.assetAccount, credit: args.grossValue, memo }];
  if (args.accumulated > 0) {
    lines.push({ account: args.accumAccount, debit: args.accumulated, memo });
  }
  if (args.proceeds > 0 && args.financeAccountId) {
    lines.push({
      account: await glForFinanceAccount(args.financeAccountId),
      debit: args.proceeds,
      memo,
    });
  }
  if (gain > 0) {
    lines.push({ account: ACC.assetSaleGain, credit: gain, memo });
  } else if (gain < 0) {
    lines.push({ account: ACC.assetSaleLoss, debit: -gain, memo });
  }

  return postJournal({
    description: `Asaasa kitab se kharij: ${memo}`,
    sourceModule: "assets.disposal",
    sourceId: args.disposalId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}

/**
 * Dobara qeemat.
 *
 * Qeemat BARHNE par wo nafa nahi hoti -- cheez bikī nahi, sirf uski
 * qeemat kaghaz par barhi hai. Aisi barhat sarmaye mein (3300) jati hai.
 * Usay aamdani likh dena wo raasta hai jis se kitab mein nafa dikhta hai
 * aur haath mein ek rupya nahi aata.
 *
 * Qeemat GHATNE par pehle wohi barhat khatam hoti hai jo isi asaase par
 * pehle likhi gayi thi; us se zyada kami asal kharcha (6220) hai.
 */
export async function postAssetRevaluation(args: {
  revaluationId: string;
  code: string;
  name: string;
  assetAccount: string;
  /** Musbat = barhi, manfi = ghati. */
  difference: number;
  surplusPart: number;
  expensePart: number;
  ctx: EventContext;
}): Promise<PostResult> {
  const memo = `${args.code} — ${args.name}`;
  const lines: JournalLine[] = [];

  if (args.difference > 0) {
    lines.push({ account: args.assetAccount, debit: args.difference, memo });
    // Pehle jo kami kharcha likhi gayi thi, wo pehle wapas hoti hai.
    if (args.expensePart > 0) lines.push({ account: ACC.assetWriteDown, credit: args.expensePart, memo });
    if (args.surplusPart > 0) lines.push({ account: ACC.revaluationSurplus, credit: args.surplusPart, memo });
  } else {
    lines.push({ account: args.assetAccount, credit: -args.difference, memo });
    if (args.surplusPart > 0) lines.push({ account: ACC.revaluationSurplus, debit: args.surplusPart, memo });
    if (args.expensePart > 0) lines.push({ account: ACC.assetWriteDown, debit: args.expensePart, memo });
  }

  return postJournal({
    description: `Asaase ki dobara qeemat: ${memo}`,
    sourceModule: "assets.revaluation",
    sourceId: args.revaluationId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}
