import { ACC } from "@/lib/ledger/rules";

/**
 * Rozana ke kharche aur len-den — ek hi jagah se.
 *
 * =====================================================================
 * MALIK KI FARMAISH (6 September)
 * =====================================================================
 *
 *   *"Expense ka alag se tag hona chahiye slide bar mein, jis mein daily
 *   koi bhi bill hai wo add kar sakein, jis ki manzoori manager dega.
 *   Kisi ko paisa diya hai to us ke khaate mein add kar sakein; agar
 *   aaya to us ke khaate mein jama kar sakein."*
 *
 * Teen baatein us jumle mein hain, aur teeno alag hain:
 *
 *   1. Bill DARJ karna — dukan par baitha banda karta hai.
 *   2. MANZOORI — manager deta hai. Manzoori se pehle kuch bhi kitab
 *      mein nahi jata.
 *   3. Kis ke KHAATE mein — paisa kisi bande ke sath juda hua hai ya
 *      nahi, aur juda hai to us ka balance kis rukh hilta hai.
 *
 * =====================================================================
 * SAB SE AHEM FARQ: CASH JANA AUR KHARCHA HONA EK CHEEZ NAHI
 * =====================================================================
 *
 * Cash bohot si wajhon se bahar jata hai — supplier ko purani adaigi,
 * staff ko advance, kisan ko peshgi. In mein sirf EK kharcha hai; baqi
 * sab balance ki naql-o-harkat hai.
 *
 * Sab ko kharcha likh dena do nuqsan karta hai, aur dono chup chaap:
 *
 *   * Nafa asal se kam nazar aata hai (jo paisa wapas aana hai, wo
 *     kharche mein gina ja chuka hota hai).
 *   * Us bande ka khata kabhi kam nahi hota — supplier dobara wohi
 *     paise mangta hai, aur staff ka advance kabhi wapas nahi hota
 *     kyunki kahin likha hi nahi ke wo dena hai.
 *
 * Ye faisla AI nahi kar sakta: parchi par raqam nazar aati hai, niyat
 * nahi. Is liye qism CHUNNI parti hai, aur har qism ka apna khata neeche
 * likha hua hai.
 *
 * =====================================================================
 * `bill-cash.ts` SE FARQ KYA HAI
 * =====================================================================
 *
 * Wo file WhatsApp se aayi hui parchi ke liye hai: wahan manager ko sirf
 * ye batana hota hai ke ye cash kis khaane ka tha, aur qatar seedhi Cash
 * Book mein jati hai.
 *
 * Yahan poora raasta hai — darkhwast, manzoori, ledger, Cash Book, aur
 * us bande ka khata. Is liye khaton ka naqsha yahan apna hai. Qismein
 * jaan boojh kar milti julti rakhi gayi hain taake dono jagah ka banda
 * ek hi zaban bole.
 */

export type KharchaRukh = "gaya" | "aaya";

export interface KharchaQism {
  value: string;
  label: string;
  rukh: KharchaRukh;
  /**
   * Wo khata jo cash ke DOOSRI taraf baithta hai.
   *
   * NULL ka matlab hai "qism se tay hoga" — jaise asal kharcha, jahan
   * bijli ka bill 6040 par aur diesel 6010 par jata hai.
   */
  saamneWalaKhata: string | null;
  /** Kis fehrist se banda chunega. NULL = koi banda nahi. */
  bandaKahanSe: "supplier" | "staff" | "farmer" | "customer" | null;
  /** Ledger mein party ki qism. */
  partyType: string | null;
  /** Manager ko yaad dilane ke liye — is ka asar kya hoga. */
  asar: string;
  /** Ye asal kharcha hai (nafe mein se katega)? */
  asalKharcha: boolean;
}

export const KHARCHA_QISMEIN: KharchaQism[] = [
  // ---------------- PAISA GAYA ----------------
  {
    value: "kharcha",
    label: "Kharcha (chai, marammat, bijli, safai, kiraya)",
    rukh: "gaya",
    saamneWalaKhata: null, // qism se tay hoga
    bandaKahanSe: null,
    partyType: null,
    asar: "Ye asal kharcha hai — nafe mein se kat jayega. Kisi ka khata nahi hilega.",
    asalKharcha: true,
  },
  {
    value: "supplier_ko_diya",
    label: "Supplier ko adaigi",
    rukh: "gaya",
    saamneWalaKhata: ACC.supplierPayable,
    bandaKahanSe: "supplier",
    partyType: "supplier",
    asar: "Ye kharcha NAHI — maal pehle aa chuka. Supplier ka dena kam ho jayega.",
    asalKharcha: false,
  },
  {
    value: "staff_ko_advance",
    label: "Staff ko advance ya qarz",
    rukh: "gaya",
    saamneWalaKhata: ACC.staffAdvance,
    bandaKahanSe: "staff",
    partyType: "staff",
    asar: "Ye kharcha NAHI — us se wapas lena hai. Us ke khaate mein charh jayega.",
    asalKharcha: false,
  },
  {
    value: "kisan_ko_advance",
    label: "Kisan ko peshgi / advance",
    rukh: "gaya",
    saamneWalaKhata: ACC.farmerAdvance,
    bandaKahanSe: "farmer",
    partyType: "farmer",
    asar: "Ye kharcha NAHI — kisan se maal ya paisa wapas aana hai.",
    asalKharcha: false,
  },

  // ---------------- PAISA AAYA ----------------
  {
    value: "customer_se_wasooli",
    label: "Customer se udhaar ki wasooli",
    rukh: "aaya",
    saamneWalaKhata: ACC.customerDue,
    bandaKahanSe: "customer",
    partyType: "customer",
    asar: "Ye aamdani NAHI — purana udhaar wapas aaya. Us ka khata kam hoga.",
    asalKharcha: false,
  },
  {
    value: "staff_se_wapas",
    label: "Staff se advance wapas",
    rukh: "aaya",
    saamneWalaKhata: ACC.staffAdvance,
    bandaKahanSe: "staff",
    partyType: "staff",
    asar: "Ye aamdani NAHI — jo advance diya tha wo wapas aaya.",
    asalKharcha: false,
  },
  {
    value: "kisan_se_wapas",
    label: "Kisan se peshgi wapas",
    rukh: "aaya",
    saamneWalaKhata: ACC.farmerAdvance,
    bandaKahanSe: "farmer",
    partyType: "farmer",
    asar: "Ye aamdani NAHI — jo peshgi di thi wo wapas aayi.",
    asalKharcha: false,
  },
  {
    value: "aamdani",
    label: "Aamdani (kiraya, scrap, deegar)",
    rukh: "aaya",
    saamneWalaKhata: ACC.otherIncome,
    bandaKahanSe: null,
    partyType: null,
    asar: "Ye asal aamdani hai — nafe mein shamil hogi.",
    asalKharcha: false,
  },
];

export function qismDhoondein(value: string): KharchaQism | null {
  return KHARCHA_QISMEIN.find((q) => q.value === value) ?? null;
}

/**
 * Bill ki qismein — wohi jo `/admin/company-expenses` par pehle se chal
 * rahi hain.
 *
 * Jaan boojh kar wohi rakhi gayi hain: WhatsApp se aaya bill, purane
 * safhe ka bill aur yahan ka bill ek hi report mein aane chahiye, do
 * alag jagah nahi.
 */
export const BILL_QISMEIN = [
  { value: "utility_bill", label: "Bijli / Gas ka bill" },
  { value: "rent", label: "Dukan ka kiraya" },
  { value: "fuel", label: "Petrol / Diesel" },
  { value: "maintenance", label: "Marammat" },
  { value: "salary", label: "Tankhwah" },
  { value: "transport", label: "Transport / kiraya bhara" },
  { value: "tea_food", label: "Chai / khana" },
  { value: "stationery", label: "Stationery" },
  { value: "cleaning", label: "Safai" },
  { value: "spray", label: "Spray / dawai ka kaam" },
  { value: "labour", label: "Mazdoori / dihaari" },
  { value: "ghar", label: "Ghar ka kharcha" },
  { value: "loading", label: "Loading / unloading" },
  { value: "packing", label: "Packing / boriyan" },
  { value: "phone_internet", label: "Phone / internet" },
  { value: "security", label: "Chowkidar / security" },
  { value: "medical", label: "Ilaaj / dawai" },
  { value: "govt_fee", label: "Sarkari fees ya challan" },
  { value: "guest", label: "Mehmaan nawazi" },
  { value: "other", label: "Deegar — apni qism likhein" },
];

/**
 * Jo qism fehrist mein nahi hai.
 *
 * Malik (6 September): *"agar koi us se alag expense ke andar add karna
 * chahe to naam kar sake."*
 *
 * Wo theek keh rahe the. Bandhi hui fehrist ka anjaam hamesha ek hi
 * hota hai: banda "Deegar" chun kar tafseel mein asal baat likh deta
 * hai, aur phir koi report qism ke hisaab se jorr hi nahi sakti --
 * "Deegar" mein aadha mahina para hota hai.
 *
 * Is liye "Deegar" chunne par apna naam likhne ka khana khulta hai, aur
 * wohi naam qism ban kar mehfooz hota hai. Agle mahine wo naam apne aap
 * report mein alag qatar bana leta hai.
 */
export const APNI_QISM = "other";

/**
 * Qism ka naam saaf karna -- taake "Spray Wala", "spray wala" aur
 * "SPRAY  WALA" teen alag qismein na banein.
 *
 * Chhote harf aur ek hi space. Isi se report mein qatarein jorti hain.
 */
export function qismKaNaamSaaf(naam: string): string {
  return naam.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
}

export function billQismKaLabel(value: string | null | undefined): string {
  const v = String(value ?? "").trim();
  if (!v) return "(qism likhi nahi)";
  const mila = BILL_QISMEIN.find((b) => b.value === v);
  if (mila) return mila.label;
  // Malik ki apni likhi hui qism -- wo waise hi dikhai jati hai.
  return v.charAt(0).toUpperCase() + v.slice(1);
}

/**
 * Kaun le gaya.
 *
 * Malik (6 September): *"aaj ghar ke liye 4000 — kaun le gaya, Mohsin le
 * gaya. Aaj bill diya maintenance ka, aaj petrol ka diya — kaun le gaya,
 * Baba le gaya. Bill diya — kaun le gaya, Rana le gaya. Saath payment
 * bhi kitni gayi. Aaj spray wala le gaya, kitna — 3000."*
 *
 * Ye har qatar par poochha jata hai, chahe wo asal kharcha ho. Wajah ye
 * hai ke sawal hamesha yehi hota hai: "ye 4000 kis ne liye the?" -- aur
 * agar wo naam usi waqt na likha jaye to mahine baad kisi ko yaad nahi
 * rehta.
 *
 * -------------------------------------------------------------------
 * NAAM LIKHNA AUR KHATA BANNA DO ALAG BAATEIN HAIN
 *
 * Naam har qatar par likha jata hai. KHATA sirf us waqt banta hai jab
 * qism khud kehti ho ke paisa wapas aana hai (advance, adaigi,
 * wasooli).
 *
 * Ye farq jaan boojh kar rakha gaya hai. "Mohsin ghar ka kharcha le
 * gaya" ek kharcha hai -- Mohsin par wo udhaar nahi. Us ko us ke khaate
 * mein daal dena us se aisa paisa mangwane lagta jo us ne kabhi liya hi
 * nahi tha.
 *
 * Magar agar wohi banda registered hai (kisan, staff, supplier,
 * customer) to us ki ID bhi mehfooz hoti hai -- malik ka jumla: *"agar
 * koi farmer aa jata hai to wo already register hoga, us ki id aani
 * chahiye."* Us se us bande ka poora record ek dhaage mein rehta hai,
 * chahe us qatar se us ka balance na hila ho.
 */
export const BANDE_KI_QISMEIN = [
  { value: "staff", label: "Staff" },
  { value: "farmer", label: "Kisan" },
  { value: "supplier", label: "Supplier" },
  { value: "customer", label: "Customer" },
] as const;

export type BandeKiQism = (typeof BANDE_KI_QISMEIN)[number]["value"];

/** Manzoori ke darje — kis stage par hai. */
export const HALAT_LABEL: Record<string, string> = {
  pending: "Manzoori ka intezar",
  approved: "Manzoor — kitab mein darj",
  rejected: "Radd",
};
