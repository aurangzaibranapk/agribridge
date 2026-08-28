import { createServiceClient } from "@/lib/supabase/service";
import { postJournal, type PostedEntry, type SourceClaim } from "@/lib/ledger/post";

/**
 * Kaarobari waqia -> journal entry. Sirf yahan.
 *
 * Har module ko ye maloom hai ke us ne kya kiya ("kisan ko beej udhaar
 * diya", "petrol ka kharcha manzoor hua"). Ye faisla ke us ka kaunsa
 * khata debit hoga aur kaunsa credit -- ye yahan hota hai, wahan nahi.
 *
 * Khata code (1000, 5010, ...) bees files mein bikher dena wohi raasta
 * hai jahan se "adjust kar dete hain" shuru hota hai: har jagah thora
 * mukhtalif hoti chali jati hai aur do saal baad koi nahi bata sakta ke
 * doodh ka kharcha kis khate mein jata hai. Is liye code sirf is file
 * mein hain.
 *
 * Do usool har poster par lagte hain:
 *
 *   1. EK waqia = EK entry. Waqia agar do tables mein likha gaya (kisan
 *      ka khata aur cash dono) to entry phir bhi ek hi banegi, aur wo
 *      DONO rows ka daawa karegi. Alag alag entries banane ka matlab
 *      hai wahi raqam do dafa gin lena.
 *
 *   2. Nakami chhupti nahi. Entry na ban sake to bulane wale ko wajah
 *      milti hai. Chup chaap chhor dene se wo raqam ledger se bahar reh
 *      jati hai -- aur bahar rehne wali raqam par koi sawal nahi poochha
 *      ja sakta.
 */

/** Har waqie ke sath ye maloomat chahiye. */
export interface EventContext {
  createdBy: string | null;
  branchId?: string | null;
  entryDate?: string;
  claims?: SourceClaim[];
}

export type PostResult = PostedEntry | { error: string };

export function failed(result: PostResult): result is { error: string } {
  return "error" in result;
}

// Khata code ek jagah -- taake naam se pukara ja sake, number se nahi.
export const ACC = {
  cash: "1000",
  bank: "1010",
  // 1020 bank ke raaste ka paisa hai (bheja, jama nahi hua).
  // 1030 kisi BANDE ke haath ka paisa hai. Dono ka khatra alag hai aur
  // peechha karne ka tareeqa bhi: bank ko phone kiya jata hai, bande se
  // poochha jata hai.
  inTransit: "1020",
  cashWithPerson: "1030",
  customerDue: "1100",
  branchDue: "1110",
  supplierAdvance: "1120",
  staffAdvance: "1130",
  farmerAdvance: "1140",
  farmerDue: "1150",
  dealerDue: "1160",
  stockGoods: "1200",
  stockMilk: "1210",
  stockGrain: "1220",
  supplierPayable: "2000",
  farmerPayable: "2010",
  staffPayable: "2020",
  salaryDue: "2025",
  customerAdvance: "2030",
  walletPayable: "2040",
  ownerCapital: "3000",
  ownerDrawings: "3100",
  openingEquity: "3200",
  salesShop: "4000",
  salesGrain: "4010",
  salesMilk: "4020",
  machineryIncome: "4030",
  otherIncome: "4090",
  cogs: "5000",
  milkPurchase: "5010",
  grainPurchase: "5020",
  salaries: "6000",
  fuel: "6010",
  vehicleRepair: "6020",
  rent: "6030",
  utilities: "6040",
  generatorDiesel: "6050",
  otherExpense: "6090",
  cashDifference: "6100",
  stockLoss: "6110",
  milkLoss: "6120",
  grainLoss: "6130",
  suspense: "9999",
} as const;

/**
 * Finance account (UBL / HBL / Cash in Hand) ka GL khata.
 *
 * Na mile to Suspense. Yahan rukna ghalat hoga: rukne se woh kaam bhi
 * ruk jayega jo theek tha, aur cash bina darj hue haath badal lega. Aur
 * chup chaap cash maan lena us se bhi bura -- bank ka paisa cash mein
 * gin liya jayega aur raat ko farq nikal aayega jis ki wajah nahi
 * milegi. Suspense mein rakha paisa Money Trail par surkh nazar aata
 * hai: theek karna aasan hai, kyunki dikhta hai.
 */
export async function glForFinanceAccount(accountId: string): Promise<string> {
  const service = createServiceClient();
  const { data } = await service
    .from("finance_accounts")
    .select("gl_code")
    .eq("id", accountId)
    .maybeSingle();
  return data?.gl_code ?? ACC.suspense;
}

/**
 * Kharche ki qism -> khata.
 *
 * Category free text hai (log jo chahen likh dete hain), is liye yahan
 * milaan narm hai. Koi qism na pehchani jaye to 6090 (Deegar kharche) --
 * Suspense nahi, kyunki ye kharcha hai ye maloom hai; sirf ye maloom
 * nahi ke kaunsa. 6090 P&L mein nazar aata hai, Suspense nahi aata.
 */
export function expenseAccountFor(category: string | null | undefined): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("salary") || c.includes("tankhwah") || c.includes("wage")) return ACC.salaries;
  if (c.includes("generator")) return ACC.generatorDiesel;
  if (c.includes("fuel") || c.includes("petrol") || c.includes("diesel")) return ACC.fuel;
  if (c.includes("maintenance") || c.includes("repair") || c.includes("oil")) return ACC.vehicleRepair;
  if (c.includes("rent") || c.includes("kiraya")) return ACC.rent;
  if (c.includes("electric") || c.includes("bijli") || c.includes("gas") || c.includes("utility"))
    return ACC.utilities;
  if (c.includes("supplier_payment")) return ACC.supplierPayable;
  return ACC.otherExpense;
}

/** Aamdani ki qism -> khata. */
export function incomeAccountFor(category: string | null | undefined): string {
  const c = (category ?? "").toLowerCase();
  if (c.includes("milk") || c.includes("doodh")) return ACC.salesMilk;
  if (c.includes("grain") || c.includes("wheat") || c.includes("rice")) return ACC.salesGrain;
  if (c.includes("machinery") || c.includes("rental") || c.includes("kiraya")) return ACC.machineryIncome;
  if (c.includes("shop") || c.includes("pos") || c.includes("retail")) return ACC.salesShop;
  return ACC.otherIncome;
}

// =====================================================================
// Cash aur bank
// =====================================================================

/** Cash / bank mein paisa aaya. */
export async function postCashIn(args: {
  accountId: string;
  amount: number;
  category?: string | null;
  description: string;
  /** Aamdani na ho balke kisi ka udhaar wapas aaya ho to ye khata dein. */
  againstAccount?: string;
  partyType?: string | null;
  partyId?: string | null;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = await glForFinanceAccount(args.accountId);
  return postJournal({
    description: args.description,
    sourceModule: "finance",
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: gl, debit: args.amount, memo: args.description },
      {
        account: args.againstAccount ?? incomeAccountFor(args.category),
        credit: args.amount,
        partyType: args.partyType,
        partyId: args.partyId,
        memo: args.description,
      },
    ],
  });
}

/** Cash / bank se paisa gaya. */
export async function postCashOut(args: {
  accountId: string;
  amount: number;
  category?: string | null;
  description: string;
  againstAccount?: string;
  partyType?: string | null;
  partyId?: string | null;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = await glForFinanceAccount(args.accountId);
  return postJournal({
    description: args.description,
    sourceModule: "finance",
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      {
        account: args.againstAccount ?? expenseAccountFor(args.category),
        debit: args.amount,
        partyType: args.partyType,
        partyId: args.partyId,
        memo: args.description,
      },
      { account: gl, credit: args.amount, memo: args.description },
    ],
  });
}

/**
 * Ek account se doosre mein.
 *
 * Beech mein 1020 (Cash in Transit) jaan boojh kar hai. Paisa nikla aur
 * pahuncha -- dono qadam alag alag darj hote hain. Sirf pehla qadam ho
 * aur doosra na ho (bank bheja magar jama nahi hua) to 1020 mein raqam
 * pari reh jati hai aur Money Trail par nazar aati hai. Seedha nikaal
 * kar seedha daal dein to gum-shuda raqam kahin dikhti hi nahi.
 */
export async function postTransferOut(args: {
  fromAccountId: string;
  amount: number;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = await glForFinanceAccount(args.fromAccountId);
  return postJournal({
    description: args.description,
    sourceModule: "finance_transfer",
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: ACC.inTransit, debit: args.amount, memo: args.description },
      { account: gl, credit: args.amount, memo: args.description },
    ],
  });
}

export async function postTransferIn(args: {
  toAccountId: string;
  amount: number;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = await glForFinanceAccount(args.toAccountId);
  return postJournal({
    description: args.description,
    sourceModule: "finance_transfer",
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: gl, debit: args.amount, memo: args.description },
      { account: ACC.inTransit, credit: args.amount, memo: args.description },
    ],
  });
}

// =====================================================================
// Kisan
// =====================================================================

/**
 * Kisan ko maal udhaar diya (beej, khaad, wanda).
 *
 * Stock kam hua, kisan ka bojh barha. Dukan se maal utha kar dena bhi
 * paisa dena hi hai -- is liye ye ledger mein utni hi tafseel se aata
 * hai jitna cash.
 */
export async function postFarmerCreditGiven(args: {
  farmerId: string;
  amount: number;
  sourceType: string;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const st = args.sourceType.toLowerCase();
  const against =
    st === "machinery" ? ACC.machineryIncome
    : st === "opening_balance" ? ACC.openingEquity
    : st === "other" ? ACC.suspense
    : ACC.stockGoods;

  return postJournal({
    description: args.description,
    sourceModule: "farmer_credit",
    sourceId: args.farmerId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      {
        account: ACC.farmerDue,
        debit: args.amount,
        partyType: "farmer",
        partyId: args.farmerId,
        memo: args.description,
      },
      { account: against, credit: args.amount, memo: args.description },
    ],
  });
}

/**
 * Kisan ka bojh ghata -- cash se, ya doodh/fasal ki qeemat se.
 *
 * `settledBy` batata hai ke ghata kis se. Cash aaya ho to us ka khata
 * aata hai; doodh ki qeemat kati ho to kharcha ka khata (kyunki doodh
 * hum ne khareeda, paise ki jagah us ka udhaar kata).
 */
export async function postFarmerCreditRepaid(args: {
  farmerId: string;
  amount: number;
  settledBy: string;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  return postJournal({
    description: args.description,
    sourceModule: "farmer_credit",
    sourceId: args.farmerId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: args.settledBy, debit: args.amount, memo: args.description },
      {
        account: ACC.farmerDue,
        credit: args.amount,
        partyType: "farmer",
        partyId: args.farmerId,
        memo: args.description,
      },
    ],
  });
}

/**
 * Doodh khareeda.
 *
 * Kharcha abhi darj hota hai, paisa baad mein jata hai -- is liye doosri
 * taraf "Farmer ko dena" hai, cash nahi. Sirf paisa dete waqt likhein to
 * mahine ke beech mein ye nazar hi nahi aata ke kitna dena ban chuka
 * hai.
 */
export async function postMilkPurchase(args: {
  farmerId: string;
  amount: number;
  description: string;
  collectionId?: string | null;
  ctx: EventContext;
}): Promise<PostResult> {
  return postJournal({
    description: args.description,
    sourceModule: "milk_collection",
    sourceId: args.collectionId ?? args.farmerId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: ACC.milkPurchase, debit: args.amount, memo: args.description },
      {
        account: ACC.farmerPayable,
        credit: args.amount,
        partyType: "farmer",
        partyId: args.farmerId,
        memo: args.description,
      },
    ],
  });
}

// =====================================================================
// Wallet
// =====================================================================

/**
 * Wallet mein paisa aaya ya gaya.
 *
 * Wallet hamare paas para kisi aur ka paisa hai -- is liye ye hamari
 * milkiyat nahi, hamare zimme hai (2040). Ise aamdani samajh lena wo
 * ghalti hai jis se kaarobar apne aap ko asal se ameer samajhne lagta
 * hai.
 */
export async function postWalletMovement(args: {
  ownerType: string;
  ownerId: string;
  amount: number;
  direction: "credit" | "debit";
  against: string;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const walletLine = {
    account: ACC.walletPayable,
    partyType: args.ownerType,
    partyId: args.ownerId,
    memo: args.description,
  };
  const otherLine = { account: args.against, memo: args.description };

  return postJournal({
    description: args.description,
    sourceModule: "wallet",
    sourceId: args.ownerId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines:
      args.direction === "credit"
        ? // Wallet barha -- hamara zimma barha.
          [{ ...otherLine, debit: args.amount }, { ...walletLine, credit: args.amount }]
        : // Wallet se nikla -- zimma ghata.
          [{ ...walletLine, debit: args.amount }, { ...otherLine, credit: args.amount }],
  });
}

// =====================================================================
// Staff
// =====================================================================

/**
 * Staff ke khate ki entry.
 *
 * Yahan credit aur debit ka matlab kisan ke khate se ULTA hai, aur ye
 * jaan boojh kar hai kyunki rishta hi ulta hai: kisan hamara maqrooz
 * hota hai, staff ka hum par haq banta hai.
 *
 *   credit -> staff ne kamaya (dihari, tankhwah). Hamara bojh barha.
 *   debit  -> staff ne liya (advance, saudа). Hamara bojh ghata.
 *
 * Mahine ke aakhir wala qadam (month_end_processed) paisa nahi hilata --
 * wo sirf khate ka bojh "tankhwah baqi" mein badal deta hai. Ise kharcha
 * gin lena us mahine ka kharcha dugna dikha deta, kyunki dihari pehle hi
 * kharcha gin li gayi thi.
 */
export async function postStaffLedger(args: {
  profileId: string;
  amount: number;
  ledgerType: "credit" | "debit";
  sourceType: string;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const staffLine = {
    account: ACC.staffPayable,
    partyType: "staff",
    partyId: args.profileId,
    memo: args.description,
  };

  let other: string;
  if (args.sourceType === "month_end_processed") other = ACC.salaryDue;
  else if (args.ledgerType === "credit") other = ACC.salaries;
  else other = ACC.cash;

  return postJournal({
    description: args.description,
    sourceModule: "staff_khata",
    sourceId: args.profileId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines:
      args.ledgerType === "credit"
        ? [{ account: other, debit: args.amount, memo: args.description }, { ...staffLine, credit: args.amount }]
        : [{ ...staffLine, debit: args.amount }, { account: other, credit: args.amount, memo: args.description }],
  });
}

/** Staff ko advance diya. */
export async function postStaffAdvance(args: {
  profileId: string;
  amount: number;
  accountId?: string | null;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = args.accountId ? await glForFinanceAccount(args.accountId) : ACC.cash;
  return postJournal({
    description: args.description,
    sourceModule: "staff_khata",
    sourceId: args.profileId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      {
        account: ACC.staffAdvance,
        debit: args.amount,
        partyType: "staff",
        partyId: args.profileId,
        memo: args.description,
      },
      { account: gl, credit: args.amount, memo: args.description },
    ],
  });
}

/**
 * Tankhwah di gayi.
 *
 * Pehle liya hua advance yahin kat jata hai. Alag se kaatein to advance
 * kaghaz par khara rehta hai aur agle mahine dobara kat sakta hai.
 */
export async function postSalaryPaid(args: {
  profileId: string;
  gross: number;
  advanceAdjusted: number;
  accountId?: string | null;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = args.accountId ? await glForFinanceAccount(args.accountId) : ACC.cash;
  const netPaid = Math.round((args.gross - args.advanceAdjusted) * 100) / 100;

  const lines = [
    {
      account: ACC.salaries,
      debit: args.gross,
      partyType: "staff",
      partyId: args.profileId,
      memo: args.description,
    },
  ] as Array<{
    account: string;
    debit?: number;
    credit?: number;
    partyType?: string | null;
    partyId?: string | null;
    memo?: string | null;
  }>;

  if (args.advanceAdjusted > 0) {
    lines.push({
      account: ACC.staffAdvance,
      credit: args.advanceAdjusted,
      partyType: "staff",
      partyId: args.profileId,
      memo: "Advance kaata gaya",
    });
  }
  if (netPaid > 0) lines.push({ account: gl, credit: netPaid, memo: args.description });

  return postJournal({
    description: args.description,
    sourceModule: "salary",
    sourceId: args.profileId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}

// =====================================================================
// Branch
// =====================================================================

/** Branch ne advance bheja, ya us par order ka charge para. */
export async function postBranchCredit(args: {
  branchId: string;
  amount: number;
  transactionType: string;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const t = args.transactionType;
  const branchLine = {
    account: ACC.branchDue,
    partyType: "branch",
    partyId: args.branchId,
    memo: args.description,
  };

  // advance_payment: branch ne paisa bheja -> cash barha, us ka lena ghata.
  // order_charge:    branch ne maal liya -> us ka lena barha.
  // refund:          us ko wapas kiya.
  // adjustment:      wajah maloom nahi -- Suspense, taake nazar aaye.
  const other =
    t === "advance_payment" ? ACC.cash
    : t === "order_charge" ? ACC.salesShop
    : t === "refund" ? ACC.cash
    : ACC.suspense;

  const branchOwesMore = t === "order_charge" || t === "refund";

  return postJournal({
    description: args.description,
    sourceModule: "branch_credit",
    sourceId: args.branchId,
    branchId: args.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: branchOwesMore
      ? [{ ...branchLine, debit: args.amount }, { account: other, credit: args.amount, memo: args.description }]
      : [{ account: other, debit: args.amount, memo: args.description }, { ...branchLine, credit: args.amount }],
  });
}

// =====================================================================
// Kharcha
// =====================================================================

/**
 * Company ka kharcha manzoor hua.
 *
 * Manzoori par darj hota hai, darkhwast par nahi -- jo cheez manzoor
 * nahi hui wo abhi kharcha nahi hai. Doosri taraf "Supplier ko dena"
 * hai, cash nahi: manzoori ka matlab ye nahi ke paisa us waqt nikla.
 */
export async function postExpenseApproved(args: {
  expenseId: string;
  amount: number;
  category: string | null;
  description: string;
  supplierId?: string | null;
  ctx: EventContext;
}): Promise<PostResult> {
  const isSupplierPayment = (args.category ?? "").toLowerCase().includes("supplier_payment");

  return postJournal({
    description: args.description,
    sourceModule: "company_expense",
    sourceId: args.expenseId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      {
        account: expenseAccountFor(args.category),
        debit: args.amount,
        partyType: args.supplierId ? "supplier" : null,
        partyId: args.supplierId ?? null,
        memo: args.description,
      },
      {
        account: isSupplierPayment ? ACC.cash : ACC.supplierPayable,
        credit: args.amount,
        partyType: args.supplierId ? "supplier" : null,
        partyId: args.supplierId ?? null,
        memo: args.description,
      },
    ],
  });
}

// =====================================================================
// Bikri
// =====================================================================

/** Bikri hui -- cash mein ya udhaar par. */
export async function postSale(args: {
  amount: number;
  cost?: number;
  onCredit: boolean;
  customerId?: string | null;
  incomeAccount?: string;
  stockAccount?: string;
  description: string;
  sourceModule: string;
  sourceId?: string | null;
  ctx: EventContext;
}): Promise<PostResult> {
  const lines: Array<{
    account: string;
    debit?: number;
    credit?: number;
    partyType?: string | null;
    partyId?: string | null;
    memo?: string | null;
  }> = [
    {
      account: args.onCredit ? ACC.customerDue : ACC.cash,
      debit: args.amount,
      partyType: args.customerId ? "customer" : null,
      partyId: args.customerId ?? null,
      memo: args.description,
    },
    { account: args.incomeAccount ?? ACC.salesShop, credit: args.amount, memo: args.description },
  ];

  // Maal ki lagat alag qatar mein. Sirf bikri likhna aur lagat chhor
  // dena nafa asal se zyada dikhata hai -- aur ye ghalti mahinon chalti
  // rehti hai kyunki cash to theek hi rehta hai.
  if (args.cost && args.cost > 0) {
    lines.push({ account: ACC.cogs, debit: args.cost, memo: "Beche hue maal ki lagat" });
    lines.push({ account: args.stockAccount ?? ACC.stockGoods, credit: args.cost, memo: "Stock kam hua" });
  }

  return postJournal({
    description: args.description,
    sourceModule: args.sourceModule,
    sourceId: args.sourceId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}

/** Customer ne udhaar wapas kiya. */
export async function postCustomerPayment(args: {
  customerId: string;
  amount: number;
  accountId?: string | null;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = args.accountId ? await glForFinanceAccount(args.accountId) : ACC.cash;
  return postJournal({
    description: args.description,
    sourceModule: "customer_ledger",
    sourceId: args.customerId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: gl, debit: args.amount, memo: args.description },
      {
        account: ACC.customerDue,
        credit: args.amount,
        partyType: "customer",
        partyId: args.customerId,
        memo: args.description,
      },
    ],
  });
}
