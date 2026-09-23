/**
 * "Ye do naam ek hi cheez ke to nahi?"
 *
 * Testing par 42 categories thin aur un mein "Cooking Oil & Ghee" bhi
 * tha aur "Ghee & Cooking Oil" bhi -- ek hi cheez, do jagah. Aisi har
 * jodi stock ki qeemat do hisson mein baant deti hai, aur "is category
 * mein kitna maal hai" ka jawab hamesha kam aata hai bina kisi ko pata
 * chale ke kam kyun hai.
 *
 * Ye code FAISLA NAHI karta -- sirf jodiyan saamne rakhta hai. Kaunsi
 * kis mein milani hai, ye malik tay karte hain. Naam mil-te julte hone
 * ka matlab hamesha "ek hi cheez" nahi hota: "Poultry Feed" aur
 * "Cattle/Dairy Feed" ke aadhe lafz ek hain magar wo do alag cheezein
 * hain.
 */

export interface CategoryLite {
  id: string;
  name: string;
  products: number;
  parentId: string | null;
}

export interface Jodi {
  a: CategoryLite;
  b: CategoryLite;
  /** 0 se 1 -- kitne lafz mushtarak hain. */
  milaan: number;
  wajah: string;
}

/** Bemaani lafz jo har naam mein aate hain aur kuch batate nahi. */
const CHOTE_LAFZ = new Set(["and", "the", "of", "items", "product"]);

function lafz(name: string): Set<string> {
  return new Set(
    name
      .toLowerCase()
      .replace(/[(),/&.-]/g, " ")
      .split(/\s+/)
      .map((w) => w.trim())
      // Angrezi ki jama (plural) hata dete hain, warna "Pesticide" aur
      // "Pesticides" do alag lafz reh jate hain.
      .map((w) => (w.length > 4 && w.endsWith("s") ? w.slice(0, -1) : w))
      .filter((w) => w.length > 1 && !CHOTE_LAFZ.has(w))
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let mushtarak = 0;
  for (const w of a) if (b.has(w)) mushtarak += 1;
  return mushtarak / (a.size + b.size - mushtarak);
}

/**
 * Mil-ti julti jodiyan — sab se pehle wo jo sab se zyada milti hain.
 *
 * Hadd 0.45 par rakhi hai. Is se neeche ki jodiyan itni zyada hoti hain
 * ke fehrist parhi hi nahi jati -- aur jo fehrist parhi na jaye wo bhi
 * utni hi bekaar hai jitni koi fehrist na hona.
 */
export function joRiyan(list: CategoryLite[], hadd = 0.45): Jodi[] {
  const words = new Map(list.map((c) => [c.id, lafz(c.name)]));
  const out: Jodi[] = [];

  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i];
      const b = list[j];
      const wa = words.get(a.id)!;
      const wb = words.get(b.id)!;

      const m = jaccard(wa, wb);
      // Ek naam doosre ke andar poora aa jaye ("Pulses (Daal)" banaam
      // "Pulses, Grains & Sugar") -- ye jaccard mein kam aata hai magar
      // dekhne layak hota hai.
      const andar =
        wa.size > 0 && wb.size > 0 &&
        ([...wa].every((w) => wb.has(w)) || [...wb].every((w) => wa.has(w)));

      if (m < hadd && !andar) continue;

      out.push({
        a,
        b,
        milaan: Math.round(m * 100) / 100,
        wajah: andar && m < hadd ? "ek naam doosre ke andar aa jata hai" : "naam bohot milte hain",
      });
    }
  }

  return out.sort((x, y) => y.milaan - x.milaan);
}
