/**
 * Kis dukan mein kaunsa maal aata hai.
 *
 * Malik ka usool (6 September): *"karyana ke POS mein ya ordering mein
 * karyana hi aana chahiye — phir agri inputs ke kyun aa rahe hain?"*
 *
 * Aur us se pehle bhi: *"karyana mein sirf karyana stock ho, koi aur
 * nahi."*
 *
 * -------------------------------------------------------------------
 * YE FEHRIST EK HI JAGAH KYUN HAI
 *
 * Pehle ye fehrist `pos/ordering/new` ke safhe ke andar likhi hui thi --
 * usi ek safhe ke liye. Nateeja ye tha ke `agri-orders/new` par koi
 * filter tha hi nahi: wahan karyana wali dukan ko urea aur poultry feed
 * bhi nazar aate the.
 *
 * Do safhon ka ek hi sawal do jagah tay ho raha tha, aur ek jagah wo tay
 * hi nahi hua tha. Ab dono yahan se poochte hain.
 *
 * -------------------------------------------------------------------
 * BHEJNE PAR YE ROK NAHI LAGTI
 *
 * Ye rok sirf MANGWANE par hai (ordering). Stock TRANSFER par jaan
 * boojh kar nahi lagti -- kyunki us ka poora maqsad hi ye hai ke jo
 * ghalat maal karyana mein para hai wo godam wapas bheja ja sake. Wahan
 * filter lagana usi kaam ka darwaza band kar deta jo malik ne maanga
 * tha.
 */

/** Har qism ki dukan ki JAR wali categories -- naam se. */
const JAREIN: Record<string, string[]> = {
  karyana: ["Grocery", "Cold/Soft Drink", "Dairy Products"],
  agri_inputs: [
    "Fertilizer",
    "Pesticide",
    "Pesticides",
    "Seeds",
    "Animal Feed",
    "Animal Feed (Wanda)",
    "Veterinary Medicines",
    "Agricultural Products",
  ],
  dairy: ["Dairy Products"],
};

export interface CatNode {
  id: string;
  name: string;
  parent_category_id: string | null;
}

/** Jar se le kar us ki saari aulad tak. */
export function aulaadSameit(rootIds: string[], all: CatNode[]): Set<string> {
  const out = new Set<string>(rootIds);
  let badla = true;
  while (badla) {
    badla = false;
    for (const c of all) {
      if (c.parent_category_id && out.has(c.parent_category_id) && !out.has(c.id)) {
        out.add(c.id);
        badla = true;
      }
    }
  }
  return out;
}

/**
 * Is qism ki dukan ko kaunsi categories khulti hain.
 *
 * NULL ka matlab hai "sab kuch" -- aur wo jaan boojh kar hai: HQ ya
 * admin kisi ek dukan ka nahi hota, us ko poora maal dikhna chahiye.
 * Khali Set dena ghalat hota: us se safha bilkul khali aata aur banda
 * samajhta ke maal hai hi nahi.
 */
export function categoriesForShop(businessType: string | null | undefined, all: CatNode[]): Set<string> | null {
  const naam = businessType ? JAREIN[businessType] : undefined;
  if (!naam || naam.length === 0) return null;

  const rootIds = all.filter((c) => !c.parent_category_id && naam.includes(c.name)).map((c) => c.id);
  if (rootIds.length === 0) return null;

  return aulaadSameit(rootIds, all);
}
