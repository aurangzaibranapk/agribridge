import { createServiceClient } from "@/lib/supabase/service";
import { postJournal, type JournalLine, type PostedEntry, type SourceClaim } from "@/lib/ledger/post";

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
  cropLifterDue: "1170",
  fixedAssetAccum: "1390",
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
  revaluationSurplus: "3300",
  salesShop: "4000",
  salesGrain: "4010",
  salesMilk: "4020",
  machineryIncome: "4030",
  cropCommission: "4040",
  otherIncome: "4090",
  assetSaleGain: "4095",
  cogs: "5000",
  milkPurchase: "5010",
  grainPurchase: "5020",
  salaries: "6000",
  fuel: "6010",
  vehicleRepair: "6020",
  rent: "6030",
  utilities: "6040",
  generatorDiesel: "6050",
  depreciation: "6200",
  assetSaleLoss: "6210",
  assetWriteDown: "6220",
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

// =====================================================================
// Machinery -- booking se paisay tak
// =====================================================================
// Yahan ek hi baat baar baar dohrayi gayi hai, kyunki isi ek baat par
// poora machinery ka hisaab tikka hai:
//
//   ADVANCE AAMDANI NAHI HAI.
//
// Jab kisan kattai se pehle Rs 20,000 deta hai, wo paisa hamare paas
// AMANAT hai -- kaam abhi hua hi nahi. Us waqt cash barhta hai aur
// saath hi hamara BOJH barhta hai (khata 2030: "customer ka advance").
// Aamdani us din banti hai jis din bill banta hai, aur utni hi jitna
// kaam waqai hua.
//
// Ye farq na rakhein to do nuqsan hote hain: mahine ka munafa us paise
// se barh jata hai jo abhi kamaya hi nahi, aur bill ke din wahi
// Rs 20,000 dobara aamdani ban jata hai -- yani ek hi raqam do dafa.

/**
 * Kisan ne booking par advance diya.
 *
 * Cash/bank barha, aur utna hi bojh barha. Koi aamdani nahi.
 */
export async function postMachineryAdvance(args: {
  bookingId: string;
  farmerId: string;
  amount: number;
  accountId?: string | null;
  /** Advance ka cash kis ke paas gaya. Sirf cash par. */
  custodyProfileId?: string | null;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  // Advance ka cash bhi wahi qanoon: jis ke haath aaya, us ke naam.
  const gl = args.custodyProfileId
    ? ACC.cashWithPerson
    : args.accountId
      ? await glForFinanceAccount(args.accountId)
      : ACC.cash;

  return postJournal({
    description: args.description,
    sourceModule: "machinery_advance",
    sourceId: args.bookingId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      {
        account: gl,
        debit: args.amount,
        partyType: args.custodyProfileId ? "staff" : null,
        partyId: args.custodyProfileId ?? null,
        memo: args.description,
      },
      {
        account: ACC.customerAdvance,
        credit: args.amount,
        partyType: "farmer",
        partyId: args.farmerId,
        memo: args.description,
      },
    ],
  });
}

/**
 * Final bill bana -- yahan aamdani paida hoti hai.
 *
 * Teen jorey ek hi entry mein:
 *
 *   1. Kisan par poora bojh aaya             (1150 debit, gross)
 *   2. Us mein se hamari aamdani sirf         (4030 credit, commission)
 *      commission hai
 *   3. Baqi vendor ka hai, hamare paas amanat (2000 credit, vendor ka hissa)
 *   4. Jo advance pehle pakRa tha, wo khula   (2030 / 1150)
 *
 * Sab se ahem baat teesri hai: machine vendor ki hai. Kisan Rs 71,250 deta
 * hai magar hamara us mein sirf 12% hai -- baqi Rs 62,700 vendor ka hai aur
 * sirf hamare paas se guzar raha hai. Poora gross aamdani ginana mahine ka
 * munafa asal se kai guna zyada dikhata hai, aur wo ghalti cash barabar
 * rehne ki wajah se kabhi khud nazar nahi aati.
 *
 * Dono ek hi entry mein is liye hain ke ye ek hi waqia hai. Alag alag
 * entries banane par ye mumkin ho jata hai ke pehli ban jaye aur doosri
 * reh jaye -- aur phir kisan se advance ke Rs 20,000 dobara maange
 * jayen, jabke wo de chuka hai.
 *
 * Amount hamesha ASAL kaam ka: actual acre x wo rate jis par kisan raazi
 * hua. Booking ka andaza yahan nahi aata.
 */
export async function postMachineryBill(args: {
  bookingId: string;
  farmerId: string;
  vendorId?: string | null;
  /**
   * Kisan ke zimme kitna khara hota hai -- yani bill mein se riayat aur
   * us ka apna diesel nikal kar.
   *
   * Pehle yahan poora gross jata tha, aur wo sirf us soorat mein theek
   * tha jab kisan ne diesel na daala ho. Diesel daala ho to entry
   * barabar hi nahi hoti thi: debit gross, aur credit (commission +
   * vendor ka hissa) = gross - diesel. Farq diesel ke barabar. Aisi
   * entry post hi nahi hoti, is liye bill banta hi nahi tha -- aur
   * safha "Ledger mein nahi gaya" keh kar chup ho jata.
   *
   * Diesel kisan ne apne haath se vendor ko diya tha. Wo paisa ART se
   * hokar guzra hi nahi, is liye us ka koi khana nahi banta -- bas
   * kisan ka qarza utna kam hota hai.
   */
  farmerDue: number;
  commissionAmount: number;
  vendorPayable: number;
  advanceAdjusted: number;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const lines: JournalLine[] = [
    {
      account: ACC.farmerDue,
      debit: args.farmerDue,
      partyType: "farmer",
      partyId: args.farmerId,
      memo: args.description,
    },
    { account: ACC.machineryIncome, credit: args.commissionAmount, memo: `${args.description} — hamara commission` },
  ];

  if (args.vendorPayable > 0) {
    lines.push({
      account: ACC.supplierPayable,
      credit: args.vendorPayable,
      partyType: "machinery_vendor",
      partyId: args.vendorId ?? null,
      memo: `${args.description} — vendor ka hissa`,
    });
  }

  if (args.advanceAdjusted > 0) {
    lines.push({
      account: ACC.customerAdvance,
      debit: args.advanceAdjusted,
      partyType: "farmer",
      partyId: args.farmerId,
      memo: "Booking ka advance bill mein adjust hua",
    });
    lines.push({
      account: ACC.farmerDue,
      credit: args.advanceAdjusted,
      partyType: "farmer",
      partyId: args.farmerId,
      memo: "Booking ka advance bill mein adjust hua",
    });
  }

  return postJournal({
    description: args.description,
    sourceModule: "machinery_bill",
    sourceId: args.bookingId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}

/**
 * Bill ke baad kisan ne baqi paisa diya.
 *
 * `method` batata hai ke paisa kis raaste aaya, aur har raaste ka rukh
 * alag hai:
 *
 *   cash / bank / other -> us khate mein jama, kisan ka bojh kam
 *   wallet              -> hum kisan ko jo dene the, us mein se kata
 *   khata               -> KOI ENTRY NAHI
 *
 * Khata par koi entry is liye nahi ke khata "paisa mila" hai hi nahi.
 * Bill bante waqt wo raqam pehle hi kisan ke naam 1150 mein likhi ja
 * chuki hai; "khata par daal do" ka matlab sirf itna hai ke wo wahin
 * pari rahegi. Yahan entry banate to wo 1150 se 1150 hi hoti -- yani
 * kuch bhi nahi, magar dekhne mein aisa lagta ke paisa aa gaya.
 *
 * Bulane wale ka kaam: khata ke liye ye poster bulao hi mat.
 */
/**
 * Kisan ne paisa VENDOR ko de diya.
 *
 * Cash yahan kahin nahi hila -- hamare kisi khate mein wo paisa aaya hi
 * nahi. Jo hua wo ye hai: kisan ka zimma khatam, aur wo raqam ab kisi
 * aur ke paas hai. "Kisi aur" do mein se ek hai:
 *
 *   kept         -- vendor ne apne hisse mein se rakh liya. Hamare zimme
 *                   jo us ka paisa tha wo utna kam ho gaya (2000).
 *   handed_over  -- vendor ne rakha hai magar hamein dena hai. Ye hamara
 *                   paisa hai jo ek bande ke haath mein hai (1030) --
 *                   isi khate ka poora maqsad yehi hai.
 *
 * Ise "cash aa gaya" likh dena sab se aasan aur sab se ghalat raasta
 * hota: cash book us din se ghalat ho jati aur mahine ke aakhir mein
 * milan nahi hota.
 */
export async function postMachineryVendorCollected(args: {
  bookingId: string;
  farmerId: string;
  vendorId: string;
  amount: number;
  settlement: "kept" | "handed_over";
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const debit =
    args.settlement === "kept"
      ? { account: ACC.supplierPayable, partyType: "machinery_vendor", partyId: args.vendorId }
      : { account: ACC.cashWithPerson, partyType: "machinery_vendor", partyId: args.vendorId };

  return postJournal({
    description: args.description,
    sourceModule: "machinery_payment",
    sourceId: args.bookingId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      {
        account: debit.account,
        debit: args.amount,
        partyType: debit.partyType,
        partyId: debit.partyId,
        memo: args.description,
      },
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
 * Fasal uthane wale ka settlement -- ek hi entry, teen sabab.
 *
 * Uthane wale ne fasal utha li. Us ke baad teen cheezein ek sath hoti
 * hain, aur teenon ek hi lamhe ka hissa hain -- is liye ek hi entry:
 *
 *   1. Kattai ka baqi kisan ke zimme se nikal kar us ke zimme
 *   2. Kisan ka purana baqi bhi usi tarah
 *   3. Hamara commission -- ye kisan se NAHI aata, uthane wale ki apni
 *      jeb se hai (malik ka faisla), is liye us ki credit aamdani mein
 *      jati hai, kisan ke khate mein nahi
 *
 * KISAN KA KHATA DONO PEHLI DO SE SAAF HOTA HAI, TEESRI SE NAHI. Agar
 * commission bhi kisan ke khate se credit karte to us ka qarza us raqam
 * se kam ho jata jo us ne kabhi di hi nahi -- aur wo raqam phir kabhi
 * kisi se wasool na hoti.
 *
 * Ye `postMachineryVendorCollected` ka bara bhai hai: wahan bhi paisa
 * kisi khate mein nahi aata, sirf us ka MALIK badalta hai.
 */
export async function postCropLiftSettlement(args: {
  bookingId: string;
  farmerId: string;
  lifterId: string;
  /** Kattai ka wo baqi jo is ke zimme gaya. */
  harvestDue: number;
  /** Kattai ke alawa kisan ka purana baqi. */
  oldDue: number;
  /** Hamara commission -- uthane wale ki jeb se. */
  commission: number;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  // Paise ke jor ko goal karna zaroori hai: 0.1 + 0.2 JavaScript mein
  // 0.30000000000000004 deta hai, aur postJournal debit/credit ka farq
  // dekh kar entry rok deta hai. Wo rukawat theek hai -- magar us ki
  // wajah hisaab nahi, hisaab ka tareeqa hoti.
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const fromFarmer = r2(args.harvestDue + args.oldDue);
  const total = r2(fromFarmer + args.commission);

  if (total <= 0) {
    return { error: "Is bill par kuch bhi uthane wale ke zimme nahi ja raha — na kattai, na purana baqi, na commission." };
  }

  const lines: JournalLine[] = [
    {
      account: ACC.cropLifterDue,
      debit: total,
      partyType: "crop_lifter",
      partyId: args.lifterId,
      memo: args.description,
    },
  ];

  // Kisan ka zimma utna hi kam hota hai jitna waqai us se uthane wale ke
  // paas gaya. Sifar ho to qatar banti hi nahi -- khali qatar entry ko
  // sirf lamba karti hai aur parhne wale ko ye sochne par majboor karti
  // hai ke ye kis cheez ki hai.
  if (fromFarmer > 0) {
    lines.push({
      account: ACC.farmerDue,
      credit: fromFarmer,
      partyType: "farmer",
      partyId: args.farmerId,
      memo: `${args.description} — kisan ka zimma uthane wale ke paas`,
    });
  }

  if (args.commission > 0) {
    lines.push({
      account: ACC.cropCommission,
      credit: args.commission,
      memo: `${args.description} — hamara commission`,
    });
  }

  return postJournal({
    description: args.description,
    sourceModule: "crop_lift",
    sourceId: args.bookingId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}

/**
 * Uthane wale ne hamein paisa de diya.
 *
 * Yahan paisa WAQAI aata hai -- is liye khata lazmi hai (cash ke ilawa,
 * jo lene wale ke haath mein hota hai; wohi faisla jo 171 mein hua tha).
 */
export async function postCropLifterPayment(args: {
  paymentId: string;
  lifterId: string;
  amount: number;
  /** Bank/wallet ka khata. Cash par khali. */
  toAccount: string;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  return postJournal({
    description: args.description,
    sourceModule: "crop_lifter_payment",
    sourceId: args.paymentId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: args.toAccount, debit: args.amount, memo: args.description },
      {
        account: ACC.cropLifterDue,
        credit: args.amount,
        partyType: "crop_lifter",
        partyId: args.lifterId,
        memo: args.description,
      },
    ],
  });
}

/**
 * Vendor ne wo paisa hamein de diya.
 *
 * Ye upar wale ka doosra qadam hai aur aksar doosre din hota hai: paisa
 * us ke haath se nikal kar hamare khate mein aata hai. Kisan ka is se
 * koi taalluq nahi -- us ka hisaab pehle qadam par hi barabar ho chuka
 * tha.
 */
export async function postVendorCashHandover(args: {
  vendorId: string;
  accountId: string;
  amount: number;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = await glForFinanceAccount(args.accountId);
  return postJournal({
    description: args.description,
    sourceModule: "machinery_payment",
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      { account: gl, debit: args.amount, memo: args.description },
      {
        account: ACC.cashWithPerson,
        credit: args.amount,
        partyType: "machinery_vendor",
        partyId: args.vendorId,
        memo: args.description,
      },
    ],
  });
}

/**
 * Kisan ki adaigi.
 *
 * Cash kahan jata hai, ye us baat par hai ke wo KIS KE HAATH aaya.
 *
 * Khet par ya counter par cash lene wale ke paas wo cash waqai maujood
 * hota hai -- kisi khate mein nahi. Usay seedha khate mein likh dena
 * ye kehta hai ke paisa daftar pahunch gaya, jabke wo abhi us bande ki
 * jeb mein hai. Aur jis din wo nahi pahunchta, kisi ke naam par kuch
 * khara nahi hota.
 *
 * Is liye cash lene wale ke NAAM par khara hota hai (1030) aur wahin
 * rehta hai jab tak handover na ho aur lene wala tasdeeq na kare.
 *
 * Bank, wallet aur online is se guzarte hi nahi -- un mein paisa kisi
 * ke haath mein aata hi nahi.
 */
export async function postMachineryPayment(args: {
  bookingId: string;
  farmerId: string;
  amount: number;
  method: string;
  accountId?: string | null;
  /** Cash kis ke paas gaya. Sirf cash par. */
  custodyProfileId?: string | null;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  if (args.method === "khata") {
    return { error: "Khata par paisa nahi aata -- is ke liye entry nahi banti." };
  }

  const custody = args.method === "cash" && args.custodyProfileId ? args.custodyProfileId : null;

  const debitAccount = custody
    ? ACC.cashWithPerson
    : args.method === "wallet"
      ? ACC.walletPayable
      : args.accountId
        ? await glForFinanceAccount(args.accountId)
        : ACC.cash;

  const debitParty = custody
    ? { partyType: "staff", partyId: custody }
    : args.method === "wallet"
      ? { partyType: "farmer", partyId: args.farmerId }
      : { partyType: null, partyId: null };

  return postJournal({
    description: args.description,
    sourceModule: "machinery_payment",
    sourceId: args.bookingId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines: [
      {
        account: debitAccount,
        debit: args.amount,
        partyType: debitParty.partyType,
        partyId: debitParty.partyId,
        memo: args.description,
      },
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
 * Vendor ko us ka hissa diya.
 *
 * Ye kharcha NAHI hai. Kharcha us din ho chuka tha jis din bill bana aur
 * vendor ka hissa 2000 mein rakha gaya. Aaj sirf wo bojh utar raha hai.
 * Ise dobara kharcha ginana wahi ek raqam do dafa ginana hoga -- aur us
 * soorat mein munafa asal se kam dikhta hai, jo utni hi bari ghalti hai
 * jitni zyada dikhana.
 */
/**
 * Vendor ko us ka hissa dena.
 *
 * Do lakeeron ka kaam tha, ab teen ho sakti hain: agar ART ne us ke
 * liye diesel diya tha, to wo raqam isi waqt wapas aati hai.
 *
 * `amount` wo POORI raqam hai jo us ke naam par khari thi. Us mein se
 * `dieselRecovered` haath mein nahi jata -- wo pehle hi diesel ki
 * shakal mein ja chuka. Cash sirf farq hai.
 *
 * Ye ek hi entry mein hona zaroori hai. Alag alag karein to beech ka
 * lamha aisa hota hai jahan vendor ka payable saaf ho chuka hota hai
 * magar us ka diesel wala advance abhi khara hota hai -- aur us lamhe
 * mein jo bhi report chale wo jhoot bolti hai.
 */
export async function postMachineryVendorPayout(args: {
  bookingId: string;
  vendorId?: string | null;
  amount: number;
  /** ART ka diya hua diesel jo isi adaigi mein wapas aa raha hai. */
  dieselRecovered?: number;
  accountId?: string | null;
  description: string;
  ctx: EventContext;
}): Promise<PostResult> {
  const gl = args.accountId ? await glForFinanceAccount(args.accountId) : ACC.cash;
  const diesel = Math.round((args.dieselRecovered ?? 0) * 100) / 100;
  const cash = Math.round((args.amount - diesel) * 100) / 100;

  const lines: JournalLine[] = [
    {
      account: ACC.supplierPayable,
      debit: args.amount,
      partyType: "machinery_vendor",
      partyId: args.vendorId ?? null,
      memo: args.description,
    },
  ];

  if (diesel > 0) {
    lines.push({
      account: ACC.supplierAdvance,
      credit: diesel,
      partyType: "machinery_vendor",
      partyId: args.vendorId ?? null,
      memo: `${args.description} — ART ka diesel wapas`,
    });
  }

  if (cash > 0) {
    lines.push({ account: gl, credit: cash, memo: args.description });
  }

  return postJournal({
    description: args.description,
    sourceModule: "machinery_vendor_payout",
    sourceId: args.bookingId,
    branchId: args.ctx.branchId,
    entryDate: args.ctx.entryDate,
    createdBy: args.ctx.createdBy,
    claims: args.ctx.claims,
    lines,
  });
}
