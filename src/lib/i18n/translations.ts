import { portalDict } from "./dict/portal";
import { posDict } from "./dict/pos";
import { machineryDict } from "./dict/machinery";
import { myWorkDict } from "./dict/my-work";
import { machineryQueueDict } from "./dict/machinery-queue";
import { leaveDict } from "./dict/leave";
import { milkDispatchDict } from "./dict/milk-dispatch";
import { milkDict, milkPageDict, milkFuelDict, milkOpsDict } from "./dict/milk";
import { financeDict } from "./dict/finance";
import { assetsDict } from "./dict/assets";
import { cashCloseDict } from "./dict/cash-close";
import { cashHandoverDict } from "./dict/cash-handover";
import { hrDict, attendanceLogDict } from "./dict/hr";
import { inventoryDict, stockCountDict, stockTransferDict } from "./dict/inventory";
import { purchasesDict } from "./dict/purchases";
import { grainDict, grainSaleDict } from "./dict/grain";
import { purchaseGrainPagesDict } from "./dict/purchase-grain-pages";
import { dashboardDict } from "./dict/dashboard";
import { commonDict } from "./dict/common";
import { shopRentDict } from "./dict/shop-rent";
import { farmerCreditDict } from "./dict/farmer-credit";
import { reportsDict, reportsMoreDict } from "./dict/reports";
import { agriOrdersDict, agriOrdersMoreDict } from "./dict/agri-orders";
import { hrJobsDict, adminFarmerDict, subscriptionDict } from "./dict/hr-jobs";
import { miscAdminDict } from "./dict/misc-admin";
import { statementsDict, opsPagesDict } from "./dict/statements";
import { partnersDict, peoplePagesDict } from "./dict/partners";
import { financeGrainDict, grainDashDict } from "./dict/finance-grain";
import { catalogUsersDict } from "./dict/catalog-users";
import { approvalsDict } from "./dict/approvals";
import { aiMasterDict } from "./dict/ai-master";
import { siteAdminDict } from "./dict/site-admin";
import { opsExtraDict } from "./dict/ops-extra";
import { ownerToolsDict } from "./dict/owner-tools";
import { machinerySlipDict } from "./dict/machinery-slip";
import { branchOpsDict } from "./dict/branch-ops";
import { watchPagesDict } from "./dict/watch-pages";
import { tailADict } from "./dict/tail-a";
import { vendorDict } from "./dict/vendor";
import { arhtiDict } from "./dict/arhti";
import { hrAttendanceDict } from "./dict/hr-attendance";
import { siteHomeDict } from "./dict/site-home";
import { sitePagesDict } from "./dict/site-pages";
import { trustDict } from "./dict/trust";
import { outsideDict } from "./dict/outside";
import { adminTailDict } from "./dict/admin-tail";
import { portalMoreDict } from "./dict/portal-more";
import { authDict } from "./dict/auth";
import { sharedDict } from "./dict/shared";
import { productsFlowDict } from "./dict/products-flow";

/**
 * Teen zabanein, ek hi safha.
 *
 *   en  English            -- daftar, reports, bahar bhejne wali cheezein
 *   rm  Roman Urdu         -- "Nayi Machinery Booking" (abhi jo likha hai)
 *   ur  Urdu script        -- اردو، khet aur counter ke staff ke liye
 *
 * `rm` jaan boojh kar optional hai. Portal ke 262 alfaz pehle se en/ur
 * mein hain; un sab ka Roman ek sath likhna is kaam ko rok deta. Jab tak
 * kisi lafz ka Roman na ho, us ki jagah URDU aata hai -- English nahi.
 *
 * Wajah: Roman Urdu aur Urdu script EK HI ZABAN hain, sirf harf alag
 * hain. Jis bande ne Roman chuna, us ke liye Urdu script parhna English
 * parhne se kahin qareeb hai.
 *
 * ---------------------------------------------------------------------
 * Fehrist module ke module baanti gayi hai (dict/ ke andar)
 * ---------------------------------------------------------------------
 * Poore admin panel mein taqreeban 3,300 alfaz hain. Wo sab ek file mein
 * daal dene ka anjaam ye hota ke koi bhi lafz dhoondna namumkin ho jata
 * aur ek hi cheez ke do naam alag alag jagah likhe jate.
 *
 * Ab har module ki apni file hai, aur lookup ek hi rehta hai -- t().
 * Do jagah dekhne ki zaroorat nahi.
 *
 * Naya module likhte waqt PEHLE glossary.ts dekhein: us mein likha hai
 * ke kis cheez ka kya naam pehle se tay ho chuka hai.
 */
export type Lang = "en" | "rm" | "ur";

const dict = {
  ...portalDict,
  ...posDict,
  ...machineryDict,
  ...myWorkDict,
  ...machineryQueueDict,
  ...leaveDict,
  ...milkDispatchDict,
  ...milkDict,
  ...milkPageDict,
  ...financeDict,
  ...assetsDict,
  ...cashCloseDict,
  ...cashHandoverDict,
  ...hrDict,
  ...attendanceLogDict,
  ...inventoryDict,
  ...stockCountDict,
  ...stockTransferDict,
  ...purchasesDict,
  ...grainDict,
  ...purchaseGrainPagesDict,
  ...dashboardDict,
  // Sanjhe alfaz AAKHIR mein nahi, sab se PEHLE hone chahiye the -- magar
  // yahan tartib se farq nahi paRta: c_ wale naam kisi aur file mein hain
  // hi nahi, is liye koi lafz kisi doosre ko dhaanp nahi sakta.
  ...commonDict,
  ...shopRentDict,
  ...farmerCreditDict,
  ...reportsDict,
  ...agriOrdersDict,
  ...grainSaleDict,
  ...milkFuelDict,
  ...hrJobsDict,
  ...adminFarmerDict,
  ...subscriptionDict,
  ...milkOpsDict,
  ...miscAdminDict,
  ...statementsDict,
  ...opsPagesDict,
  ...reportsMoreDict,
  ...agriOrdersMoreDict,
  ...partnersDict,
  ...peoplePagesDict,
  ...financeGrainDict,
  ...catalogUsersDict,
  ...approvalsDict,
  ...aiMasterDict,
  ...siteAdminDict,
  ...opsExtraDict,
  ...ownerToolsDict,
  ...grainDashDict,
  ...machinerySlipDict,
  ...branchOpsDict,
  ...watchPagesDict,
  ...tailADict,
  ...vendorDict,
  ...arhtiDict,
  ...hrAttendanceDict,
  ...siteHomeDict,
  ...sitePagesDict,
  ...trustDict,
  ...outsideDict,
  ...adminTailDict,
  ...portalMoreDict,
  ...authDict,
  ...sharedDict,
  ...productsFlowDict,
};

export type TranslationKey = keyof typeof dict;

export function t(key: TranslationKey, lang: Lang): string {
  const entry = dict[key] as { en: string; rm?: string; ur: string } | undefined;
  if (!entry) return String(key);
  if (lang === "rm") return entry.rm ?? entry.ur;
  return entry[lang] ?? entry.en;
}

/** Har zaban ka apna naam -- apni hi zaban mein. */
export const LANG_LABELS: Record<Lang, string> = {
  en: "English",
  rm: "Roman Urdu",
  ur: "اردو",
};
