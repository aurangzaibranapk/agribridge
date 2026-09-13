import { createServiceClient } from "@/lib/supabase/service";

/**
 * Miqdar aur paise ka milaan.
 *
 * Step 1 se 5 tak paise ka pehlu mukammal ho gaya. Magar paise ka
 * hisaab andar se bilkul theek ho sakta hai aur phir bhi ghalat ho --
 * kyunki wo sirf ye darj karta hai jo kisi ne KAHA ke hua. Miqdar us hi
 * waqie ka doosra gawah hai, aur wo pehle se azad hai:
 *
 *     Rs 72,500 kisan ko diye        -- paise ka gawah
 *     500 L uthaya, 480 L pahuncha   -- miqdar ka gawah
 *
 * Dono theek theek darj hain, kitab barabar hai, aur phir bhi 20 litre
 * ke paise us maal par gaye jo kabhi mila hi nahi.
 *
 * Ye kami system mein pehle se ginti hai, magar us ki QEEMAT kahin nahi
 * jati -- wo doodh ki khareed ke andar chhupi rehti hai jahan aam lagat
 * jaisi nazar aati hai. Yahan us ko us ka apna khana milta hai.
 */

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}
function round3(v: number): number {
  return Math.round((v + Number.EPSILON) * 1000) / 1000;
}

export interface StreamCheck {
  stream: "milk" | "grain" | "fuel" | "generator";
  label: string;
  unit: string;
  qtyIn: number;
  qtyInLabel: string;
  qtyOut: number;
  qtyOutLabel: string;
  gap: number;
  gapPercent: number;
  unitCost: number;
  gapValue: number;
  /**
   * Kya is farq ki raqam ledger mein apni jagah par hai?
   *
   * false ka matlab ye NAHI ke raqam ghayab hai -- wo kharch ho chuki
   * hai aur ledger mein maujood hai. Matlab ye hai ke wo "khareed" ke
   * andar chhupi hui hai, "nuqsan" ke khane mein nahi. Us par sawal
   * tabhi ho sakta hai jab wo alag nazar aaye.
   */
  booked: boolean;
  /** Sirf un streams par jahan reclassification maani rakhti hai. */
  canBook: boolean;
  /** Wo baatein jo adad ko ghalat samajhne se rokti hain. */
  caveats: string[];
}

export interface Period {
  month: number;
  year: number;
}

function monthRange(p: Period): { from: string; to: string } {
  const from = new Date(Date.UTC(p.year, p.month - 1, 1)).toISOString().slice(0, 10);
  const to = new Date(Date.UTC(p.year, p.month, 0)).toISOString().slice(0, 10);
  return { from, to };
}

/**
 * Doodh: maidan se uthaya vs chiller par pahuncha.
 *
 * Sirf MCA ke uthaye hue doodh ka milaan hota hai. Jo kisan khud chiller
 * par laya (self_delivery), wo pehle hi wahan hai -- us ka koi raasta
 * hai hi nahi jis mein kami ho sake. Use shamil karein to har mahine ek
 * jhooti "bachat" nazar aayegi aur asal kami us mein chhup jayegi.
 */
async function milkCheck(p: Period, branchId: string | null): Promise<StreamCheck> {
  const service = createServiceClient();
  const { from, to } = monthRange(p);
  const caveats: string[] = [];

  let entriesQ = service
    .from("milk_entries")
    .select("adjusted_volume, quantity_liters, total_amount, entry_date, route_name")
    .eq("collection_source", "mca_field")
    .neq("status", "rejected")
    .gte("entry_date", from)
    .lte("entry_date", to);
  if (branchId) entriesQ = entriesQ.eq("branch_id", branchId);

  let routesQ = service
    .from("milk_route_collections")
    .select("field_collected_volume, chiller_received_volume, collection_date")
    .gte("collection_date", from)
    .lte("collection_date", to);
  if (branchId) routesQ = routesQ.eq("branch_id", branchId);

  const [{ data: entries }, { data: routes }] = await Promise.all([entriesQ, routesQ]);

  const qtyIn = round3(
    (entries ?? []).reduce(
      (s, e) => s + Number(e.adjusted_volume ?? e.quantity_liters ?? 0),
      0
    )
  );
  const money = round2((entries ?? []).reduce((s, e) => s + Number(e.total_amount ?? 0), 0));
  const qtyOut = round3(
    (routes ?? []).reduce((s, r) => s + Number(r.chiller_received_volume ?? 0), 0)
  );

  // Jin dinon doodh utha magar chiller ki receipt darj nahi hui -- un
  // dinon ka doodh "gum" nazar aayega jab ke wo sirf likha nahi gaya.
  // Ye baat na batayein to safha har mahine ek bara chori ka ilzam
  // lagata rahega, aur log us par yaqeen karna chhor denge.
  const entryDays = new Set((entries ?? []).map((e) => e.entry_date));
  const routeDays = new Set((routes ?? []).map((r) => r.collection_date));
  const missing = [...entryDays].filter((d) => !routeDays.has(d));
  if (missing.length > 0) {
    caveats.push(
      `${missing.length} din ka doodh utha magar us din ki chiller receipt darj nahi hui. Un dinon ka doodh yahan "kam" nazar aa raha hai — pehle wo entriyan mukammal karein.`
    );
  }

  const gap = round3(qtyIn - qtyOut);
  const unitCost = qtyIn > 0 ? round2(money / qtyIn) : 0;

  return {
    stream: "milk",
    label: "Doodh — maidan se chiller tak",
    unit: "L",
    qtyIn,
    qtyInLabel: "MCA ne uthaya",
    qtyOut,
    qtyOutLabel: "Chiller par pahuncha",
    gap,
    gapPercent: qtyIn > 0 ? round2((gap / qtyIn) * 100) : 0,
    unitCost,
    gapValue: round2(gap * unitCost),
    booked: false,
    canBook: true,
    caveats,
  };
}

/**
 * Grain: khareeda vs becha.
 *
 * Baqi maal godam mein hona chahiye. Us ka asal milaan Step 5 ki ginti
 * karti hai -- yahan sirf ye dekha jata hai ke jitna becha, us ki lagat
 * theek se gini gayi ya nahi.
 */
async function grainCheck(p: Period): Promise<StreamCheck> {
  const service = createServiceClient();
  const { from, to } = monthRange(p);
  const caveats: string[] = [];

  const [{ data: bought }, { data: sold }] = await Promise.all([
    service
      .from("grain_procurement_entries")
      .select("weight_kg, total_amount")
      .gte("entry_date", from)
      .lte("entry_date", to),
    service
      .from("grain_sales")
      .select("quantity_kg, total_cogs")
      .gte("sale_date", from)
      .lte("sale_date", to),
  ]);

  const qtyIn = round3((bought ?? []).reduce((s, r) => s + Number(r.weight_kg ?? 0), 0));
  const money = round2((bought ?? []).reduce((s, r) => s + Number(r.total_amount ?? 0), 0));
  const qtyOut = round3((sold ?? []).reduce((s, r) => s + Number(r.quantity_kg ?? 0), 0));
  const unitCost = qtyIn > 0 ? round2(money / qtyIn) : 0;

  caveats.push(
    "Khareed aur bikri ka farq godam mein hona chahiye — wo apne aap nuqsan nahi. Asal milaan “Maal ki Ginti” karti hai; ye adad us ke sath dekha jaye."
  );

  const gap = round3(qtyIn - qtyOut);

  return {
    stream: "grain",
    label: "Grain — khareeda vs becha",
    unit: "kg",
    qtyIn,
    qtyInLabel: "Khareeda",
    qtyOut,
    qtyOutLabel: "Becha",
    gap,
    gapPercent: qtyIn > 0 ? round2((gap / qtyIn) * 100) : 0,
    unitCost,
    gapValue: round2(gap * unitCost),
    booked: false,
    canBook: false,
    caveats,
  };
}

/**
 * Diesel: litre vs kilometre.
 *
 * Yahan koi entry NAHI banti, aur ye jaan boojh kar hai. Petrol ka paisa
 * pehle hi 6010 mein darj hai aur wahin us ki sahi jagah hai. Miqdar ka
 * milaan naya paisa nahi dhoondta -- wo ye batata hai ke us kharche ka
 * kitna hissa kisi safar ke badle mein nahi tha.
 *
 * Ise dobara kisi khate mein daalna wohi ghalti hoti jo hum rok rahe
 * hain: ek hi raqam do dafa gin li jati, aur kitab phir bhi barabar
 * rehti.
 */
async function fuelCheck(p: Period): Promise<StreamCheck> {
  const service = createServiceClient();
  const { from, to } = monthRange(p);

  const { data: logs } = await service
    .from("vehicle_daily_logs")
    .select("fuel_liters, expected_liters, fuel_amount, liters_difference")
    .gte("log_date", from)
    .lte("log_date", to)
    .not("fuel_liters", "is", null);

  const rows = logs ?? [];
  const qtyIn = round3(rows.reduce((s, r) => s + Number(r.fuel_liters ?? 0), 0));
  const qtyOut = round3(rows.reduce((s, r) => s + Number(r.expected_liters ?? 0), 0));
  const money = round2(rows.reduce((s, r) => s + Number(r.fuel_amount ?? 0), 0));
  const unitCost = qtyIn > 0 ? round2(money / qtyIn) : 0;
  const gap = round3(qtyIn - qtyOut);

  return {
    stream: "fuel",
    label: "Diesel — litre vs kilometre",
    unit: "L",
    qtyIn,
    qtyInLabel: "Daala gaya",
    qtyOut,
    qtyOutLabel: "Safar ke hisaab se banta tha",
    gap,
    gapPercent: qtyIn > 0 ? round2((gap / qtyIn) * 100) : 0,
    unitCost,
    gapValue: round2(gap * unitCost),
    booked: true,
    canBook: false,
    caveats: [
      "Is ka paisa pehle hi “Petrol / Diesel” khate mein darj hai — yahan koi nayi entry nahi banti. Ye adad sirf ye batata hai ke us kharche ka kitna hissa kisi safar ke badle mein nahi tha.",
      "Traffic, bojh, aur khali chalna bhi faasla barhate hain. Har farq chori nahi hota — magar har mahine wohi gaari zyada dikhaye to us par sawal banta hai.",
    ],
  };
}

/** Generator: diesel vs chalne ke ghante. */
async function generatorCheck(p: Period): Promise<StreamCheck> {
  const service = createServiceClient();
  const { from, to } = monthRange(p);

  const { data: logs } = await service
    .from("generator_logs")
    .select("diesel_liters_purchased, diesel_cost, hours_run, liters_per_hour")
    .gte("log_date", from)
    .lte("log_date", to);

  const rows = logs ?? [];
  const qtyIn = round3(rows.reduce((s, r) => s + Number(r.diesel_liters_purchased ?? 0), 0));
  const hours = round3(rows.reduce((s, r) => s + Number(r.hours_run ?? 0), 0));
  const money = round2(rows.reduce((s, r) => s + Number(r.diesel_cost ?? 0), 0));

  // "Hona chahiye" ka koi tay shuda adad nahi -- har generator alag
  // hota hai. Is liye us hi generator ka apna aam rawaiya bunyad banta
  // hai: is mahine ke apne dinon ka darmiyana. Bahar se koi adad utha
  // kar lagana ek jhoota mayaar bana deta.
  const perHourRows = rows.filter((r) => Number(r.hours_run ?? 0) > 0);
  const avgPerHour =
    perHourRows.length > 0
      ? round3(
          perHourRows.reduce((s, r) => s + Number(r.diesel_liters_purchased ?? 0), 0) /
            perHourRows.reduce((s, r) => s + Number(r.hours_run ?? 0), 0)
        )
      : 0;
  const expected = round3(hours * avgPerHour);
  const unitCost = qtyIn > 0 ? round2(money / qtyIn) : 0;

  return {
    stream: "generator",
    label: "Generator — diesel vs ghante",
    unit: "L",
    qtyIn,
    qtyInLabel: "Diesel daala",
    qtyOut: expected,
    qtyOutLabel: `Ghanton ke hisaab se (${avgPerHour} L/ghanta)`,
    gap: round3(qtyIn - expected),
    gapPercent: qtyIn > 0 ? round2(((qtyIn - expected) / qtyIn) * 100) : 0,
    unitCost,
    gapValue: round2((qtyIn - expected) * unitCost),
    booked: true,
    canBook: false,
    caveats: [
      "“Hona chahiye” ka adad is hi generator ke apne dinon ka darmiyana hai — bahar se koi mayaar nahi lagaya gaya. Is liye ye adad tabhi kaam ka hai jab kuch din darj ho chuke hon.",
      "Is ka paisa pehle hi diesel ke khate mein hai; yahan koi nayi entry nahi banti.",
    ],
  };
}

export interface QuantityReport {
  period: Period;
  streams: StreamCheck[];
  /** Wo kami jis ki qeemat abhi "khareed" ke andar chhupi hui hai. */
  hiddenLossValue: number;
}

export async function quantityReport(
  period: Period,
  branchId: string | null = null
): Promise<QuantityReport> {
  const service = createServiceClient();

  const [milk, grain, fuel, generator, { data: booked }] = await Promise.all([
    milkCheck(period, branchId),
    grainCheck(period),
    fuelCheck(period),
    generatorCheck(period),
    service
      .from("quantity_reconciliations")
      .select("stream")
      .eq("period_month", period.month)
      .eq("period_year", period.year),
  ]);

  const bookedStreams = new Set((booked ?? []).map((b) => b.stream));
  milk.booked = bookedStreams.has("milk");
  grain.booked = bookedStreams.has("grain");

  const streams = [milk, grain, fuel, generator];
  const hiddenLossValue = round2(
    streams
      .filter((s) => s.canBook && !s.booked && s.gapValue > 0)
      .reduce((sum, s) => sum + s.gapValue, 0)
  );

  return { period, streams, hiddenLossValue };
}

export const REASON_MIN = 5;
