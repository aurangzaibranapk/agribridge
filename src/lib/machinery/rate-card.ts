/**
 * Rate card ka match -- ek hi jagah (177).
 *
 * Ye rule server par bhi chalta hai aur screen par bhi. Do jagah likha
 * hota to kisi din booking form ek rate dikhata aur server doosra bhar
 * deta -- aur staff ko pata bhi na chalta.
 *
 * YE SIRF DEFAULT HAI. Rate ka malik booking hai: ek qism ho to
 * final_rate, dono qism hon to sabit_rate aur kutra_rate (176). Card
 * sirf pehli dafa khana bharta hai; us ke baad staff jo marzi likhe,
 * upar ya neeche. Bill banate waqt card ko dekha hi nahi jata.
 */

export interface RateCard {
  id: string;
  /** Khali = har fasal. */
  crop_key: string | null;
  /** Khali = har machine. */
  machine_type: string | null;
  harvest_type: "sabit" | "kutra";
  rate: number;
  effective_from: string;
  is_active: boolean;
}

/** Machine ki qism hath se likhi jati hai -- "Harvester" aur " harvester " ek hi cheez hain. */
function norm(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/**
 * Sab se khaas qatar jeetti hai.
 *
 * Fasal + machine dono mile to wo; sirf fasal mile to wo; sirf machine
 * mile to wo; warna aam qatar. Barabari ki soorat mein nayi tareekh
 * wali.
 *
 * Aaj se aage ki tareekh wali qatar abhi nahi lagti -- rate pehle se
 * daal dena aam baat hai ("agle hafte se ye rate"), aur wo aaj ki
 * booking par nahi lagna chahiye.
 */
export function pickDefaultRate(
  cards: RateCard[],
  opts: { crop?: string | null; machineType?: string | null; harvestType: "sabit" | "kutra"; onDate?: string }
): RateCard | null {
  const today = opts.onDate ?? new Date().toISOString().slice(0, 10);
  const crop = norm(opts.crop);
  const machine = norm(opts.machineType);

  const usable = cards.filter(
    (c) =>
      c.is_active &&
      c.harvest_type === opts.harvestType &&
      c.effective_from <= today &&
      (c.crop_key === null || norm(c.crop_key) === crop) &&
      (c.machine_type === null || norm(c.machine_type) === machine)
  );
  if (usable.length === 0) return null;

  const score = (c: RateCard) => (c.crop_key ? 2 : 0) + (c.machine_type ? 1 : 0);
  usable.sort((a, b) => score(b) - score(a) || b.effective_from.localeCompare(a.effective_from));
  return usable[0];
}
