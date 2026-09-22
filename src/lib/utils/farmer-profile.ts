import type { Database } from "@/lib/types/database.types";
type Farmer = Database["public"]["Tables"]["farmers"]["Row"];

/**
 * Farmer 360 Profile -- paanch hissay.
 *
 * Registration sirf teen cheezein leti hai (naam, mobile, zila) taake
 * kisan counter par rukk na jaye. Baqi sab kuch EK BAAR yahan bharta hai,
 * aur phir har service isi ko parhti hai: machinery, milk, grain,
 * marketplace, wallet. Kisi service ka dobara CNIC ya bank poochhna is
 * poore intezam ko bemani kar deta hai.
 *
 * Hissay isi tarteeb mein hain jis tarteeb mein banda jawab de sakta hai:
 * pehle wo jo usay zabani yaad hai, aakhir mein wo jis ke liye kaghaz
 * dhoondna paRta hai.
 */
export interface ProfileCompletion {
  percent: number;
  isComplete: boolean;
  identityComplete: boolean;
  locationComplete: boolean;
  farmingComplete: boolean;
  paymentComplete: boolean;
  documentsComplete: boolean;
  /** Purane naam se bulane walon ke liye -- identityComplete hi hai. */
  basicComplete: boolean;
}

function filled(v: unknown): boolean {
  return typeof v === "string" ? v.trim() !== "" : v !== null && v !== undefined;
}

export function computeProfileCompletion(farmer: Farmer): ProfileCompletion {
  const f = farmer as any;

  // Walid ka naam is liye zaroori hai ke gaon mein ek hi naam ke kai log
  // hote hain, aur CNIC har kisi ke paas nahi hoti.
  const identityComplete = filled(f.full_name) && filled(f.father_name) && filled(f.cnic) && filled(f.phone_number);

  const locationComplete = filled(f.village) && filled(f.tehsil) && filled(f.district) && filled(f.address);

  const farmingComplete = f.land_size_acres !== null && f.land_size_acres !== undefined && (f.crop_types?.length ?? 0) > 0;

  // Bank ya mobile wallet -- koi ek. Bank ko lazmi karna ghalat hoga:
  // bohot se kisanon ke paas khata hai hi nahi, aur unhein rok dene ka
  // matlab ye ke un ka paisa hamare paas para rehta hai.
  const paymentComplete = filled(f.bank_account_number) || filled(f.mobile_wallet_number);

  const documentsComplete = filled(f.cnic_image_url) && filled(f.cnic_back_image_url);

  const sections = [identityComplete, locationComplete, farmingComplete, paymentComplete, documentsComplete];
  const done = sections.filter(Boolean).length;

  return {
    percent: Math.round((done / sections.length) * 100),
    isComplete: done === sections.length,
    identityComplete,
    locationComplete,
    farmingComplete,
    paymentComplete,
    documentsComplete,
    basicComplete: identityComplete,
  };
}
