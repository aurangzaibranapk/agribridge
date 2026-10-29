import { ACC } from "@/lib/ledger/rules";

/**
 * HQ → shop (aur shop → shop) agri maal andaruni muntaqili hai.
 *
 * Dispatch bhejne wale godam se batch ghatata hai aur kitab mein
 * Dr COGS 5000 / Cr Stock 1200 likhta hai — taake raaste ke dauran
 * 1200 aur godam dono se wahi raqam nikal jaye. Ye bikri NAHI.
 *
 * GRN lene wale godam mein batch usi lagat par banati hai jo dispatch
 * ne nikali thi (order ki transfer price par nahi), aur Dr 1200 / Cr 5000
 * se wahi raqam wapas laati hai. Poori miqdar, bina extra kharche:
 * 1200 aur batch value dono wapas, COGS sifar.
 *
 * Kami / toota wapas nahi aata, is liye us ki lagat 5000 par rehti hai.
 * Order price sirf branch credit / payable ke liye hai — P&L par
 * dukaan ko "sale" nahi.
 */

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function roundQty(value: number): number {
  return Math.round((value + Number.EPSILON) * 1000) / 1000;
}

export interface JournalSide {
  account: string;
  debit?: number;
  credit?: number;
  memo?: string;
}

export interface DispatchCostSlice {
  productId: string;
  taken: number;
  /** taken × batch unit_cost, abhi round na kiya ho to bhi chalega. */
  cost: number;
}

export interface InternalReceiptInput {
  lineKey: string;
  productId: string;
  receivedQty: number;
  /** Sirf freight baantne ke liye. Stock is qeemat par nahi likha jata. */
  orderUnitPrice: number;
  /** Is line ka hissa additional charges mein se (rupee). */
  freightAmount?: number;
}

export interface InternalReceiptLine {
  lineKey: string;
  productId: string;
  receivedQty: number;
  /** numeric(14,2). receivedQty × unitCost = stockValue. */
  unitCost: number;
  /** Dr 1200, aur shop batch ki value. */
  stockValue: number;
}

export interface InternalReceiptPlan {
  lines: InternalReceiptLine[];
  /** Debit 1200. Batch value, freight shamil. */
  stockValue: number;
  /** Credit 5000. stockValue ke barabar, taake entry barabar rahe. */
  cogsReversal: number;
  /** Dispatch se mili FIFO lagat, freight aur unit rounding se pehle. */
  fifoRecovered: number;
}

export interface InternalTransferNet {
  /** Dispatch ke baad aur GRN ke baad 1200 ka mila jula asar. */
  stock1200: number;
  /** Mila jula COGS. Poori muntaqili par sifar. */
  cogs5000: number;
  /** Batch value ka mila jula asar (nikli lagat, phir nayi batch). */
  batchValue: number;
  /** batchValue − stock1200. Sifar = godam aur 1200 ka farq nahi barha. */
  gap: number;
}

/** Bhejne wale godam se nikalna: Dr 5000, Cr 1200. */
export function issueJournalLines(cost: number): JournalSide[] {
  const amount = roundMoney(cost);
  if (!(amount > 0)) return [];
  return [
    { account: ACC.cogs, debit: amount, memo: "Andaruni muntaqili — bhejne wale godam se maal nikla" },
    { account: ACC.stockGoods, credit: amount, memo: "Stock 1200 se nikla; GRN par wapas aayega" },
  ];
}

/** Lene wale godam mein aana: Dr 1200, Cr 5000. Dispatch ka ulta. */
export function receiptJournalLines(stockValue: number): JournalSide[] {
  const amount = roundMoney(stockValue);
  if (!(amount > 0)) return [];
  return [
    { account: ACC.stockGoods, debit: amount, memo: "Andaruni muntaqili — lene wale godam mein maal aaya" },
    { account: ACC.cogs, credit: amount, memo: "Dispatch ka COGS ulta — ye bikri nahi" },
  ];
}

/**
 * Shop batch ki lagat = jitni lagat bhejne wale batch se nikli, us mein
 * se jitni miqdar waqai mili, aur us par freight. Order price shamil nahi.
 */
export function planAgriInternalReceipt(args: {
  slices: DispatchCostSlice[];
  lines: InternalReceiptInput[];
}): InternalReceiptPlan {
  const pools = new Map<string, { takenLeft: number; costLeft: number }>();
  for (const slice of args.slices) {
    if (!slice.productId || !(slice.taken > 0)) continue;
    const cur = pools.get(slice.productId) ?? { takenLeft: 0, costLeft: 0 };
    cur.takenLeft += Number(slice.taken) || 0;
    cur.costLeft += Number(slice.cost) || 0;
    pools.set(slice.productId, cur);
  }
  for (const pool of pools.values()) {
    pool.takenLeft = roundQty(pool.takenLeft);
    pool.costLeft = roundMoney(pool.costLeft);
  }

  const lines: InternalReceiptLine[] = [];
  let fifoRecovered = 0;
  for (const line of args.lines) {
    const receivedQty = roundQty(Math.max(0, Number(line.receivedQty) || 0));
    if (!line.productId || !(receivedQty > 0)) continue;
    const pool = pools.get(line.productId);
    let fifo = 0;
    if (pool && pool.takenLeft > 0 && pool.costLeft > 0) {
      const covered = Math.min(receivedQty, pool.takenLeft);
      const takesAll = roundQty(pool.takenLeft - covered) <= 0;
      fifo = takesAll ? pool.costLeft : roundMoney((covered / pool.takenLeft) * pool.costLeft);
      if (fifo > pool.costLeft) fifo = pool.costLeft;
      pool.takenLeft = roundQty(pool.takenLeft - covered);
      pool.costLeft = roundMoney(pool.costLeft - fifo);
    }
    fifoRecovered = roundMoney(fifoRecovered + fifo);
    const freight = Math.max(0, Number(line.freightAmount) || 0);
    const raw = roundMoney(fifo + freight);
    const unitCost = receivedQty > 0 ? roundMoney(raw / receivedQty) : 0;
    const stockValue = roundMoney(receivedQty * unitCost);
    lines.push({
      lineKey: line.lineKey,
      productId: line.productId,
      receivedQty,
      unitCost,
      stockValue,
    });
  }

  const stockValue = roundMoney(lines.reduce((sum, line) => sum + line.stockValue, 0));
  return { lines, stockValue, cogsReversal: stockValue, fifoRecovered };
}

/**
 * Dispatch ki lagat dono taraf se nikalti hai (batch aur 1200).
 * GRN wahi raqam dono taraf wapas rakhti hai. Farq sirf us hissa ka
 * rehta hai jo wapas godam mein nahi aaya.
 */
export function internalTransferNet(dispatchCost: number, plan: InternalReceiptPlan): InternalTransferNet {
  const issued = roundMoney(Math.max(0, Number(dispatchCost) || 0));
  const back = roundMoney(plan.stockValue);
  const stock1200 = roundMoney(-issued + back);
  const batchValue = stock1200;
  const cogs5000 = roundMoney(issued - roundMoney(plan.cogsReversal));
  return {
    stock1200,
    cogs5000,
    batchValue,
    gap: roundMoney(batchValue - stock1200),
  };
}
