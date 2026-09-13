import { createServiceClient } from "@/lib/supabase/service";
import type { Json } from "@/lib/types/database.types";

/**
 * Wo cheez jo qanoon nahi torti, magar tarteeb torti hai.
 *
 * Step 1 se 9 tak har rok QANOON ki rok hai -- debit credit ke barabar
 * ho, farq ki wajah likhi jaye, ginti chhoote nahi. Ye sab pakarti hain
 * ke kisi ne usool torha.
 *
 * Magar sab se maheen nuqsan usool nahi torta. Wo har rok se guzar jata
 * hai, har kaghaz theek rakhta hai, aur phir bhi ghalat hota hai --
 * kyunki wo TARTEEB torta hai:
 *
 *     Ek branch mein cash ka farq HAR DAFA kam nikalta hai, kabhi zyada
 *     nahi. Har farq ki wajah likhi hui, har ginti waqt par. Har raat
 *     qanoon ke mutabiq guzri. Magar ginti ki ghalti ittefaqi hoti hai
 *     -- kabhi kam, kabhi zyada. Jo cheez hamesha ek hi taraf jhukti
 *     ho, wo ghalti nahi hoti.
 *
 * Ye baat kisi ek raat ko dekh kar maloom nahi ho sakti.
 *
 * YAHAN AI ISTEMAL NAHI HOTA, aur ye faisla jaan boojh kar hai. Ye
 * safha logon ke naam le kar baat karta hai; aisi baat ka har lafz kisi
 * khane se nikalna chahiye aur dobara ginne par wohi nikalna chahiye.
 * AI se poochhein to jawab har dafa thora mukhtalif aata hai aur wajah
 * kabhi poori nahi milti -- yani jis shakhs par baat ho rahi ho, us ko
 * jawab dene ka mauqa hi nahi milta.
 *
 * Aur ek usool sab par lagta hai: NAMOONA CHHOTA HO TO KUCH NAHI KAHA
 * JATA. Kam data par baat karna sab se aasan hai aur sab se ghalat -- ek
 * dafa kisi be-gunah par ungli uth jaye to log poore nizam par bharosa
 * chhor dete hain, aur phir wo baat bhi nahi suni jati jo sach ho.
 */

/** Is se kam aankron par koi baat nahi banti. */
export const MIN_SAMPLE = 5;
export const REVIEW_NOTE_MIN = 5;

export interface Anomaly {
  detector: string;
  subjectType: string;
  subjectId: string | null;
  subjectLabel: string;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  sampleSize: number;
  severity: "high" | "medium" | "low";
}

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

/**
 * 1. Cash ka farq hamesha ek hi taraf.
 *
 * Ginti ki ghalti ittefaqi hoti hai: kabhi kam, kabhi zyada, aur lambe
 * arse mein dono taraf barabar. Jo branch hamesha kam nikale (ya hamesha
 * zyada), wahan koi cheez ittefaq nahi rahi.
 *
 * Sirf tab kehte hain jab kam az kam 5 raaton mein farq nikla ho aur 80%
 * se zyada ek hi taraf ho. Chhoti ginti par ye aankra ittefaq se bhi
 * bana ja sakta hai.
 */
async function directionBias(): Promise<Anomaly[]> {
  const service = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data } = await service
    .from("cash_closings")
    .select("branch_id, difference, close_date, branches(name)")
    .neq("difference", 0)
    .gte("close_date", since.toISOString().slice(0, 10));

  const byBranch = new Map<
    string,
    { name: string; short: number; over: number; total: number; sum: number }
  >();

  for (const row of data ?? []) {
    const key = row.branch_id;
    const name = (row.branches as { name: string } | null)?.name ?? "—";
    const current = byBranch.get(key) ?? { name, short: 0, over: 0, total: 0, sum: 0 };
    const diff = Number(row.difference);
    if (diff < 0) current.short += 1;
    else current.over += 1;
    current.total += 1;
    current.sum += Math.abs(diff);
    byBranch.set(key, current);
  }

  const found: Anomaly[] = [];
  for (const [branchId, v] of byBranch) {
    if (v.total < MIN_SAMPLE) continue;
    const shortShare = v.short / v.total;
    const overShare = v.over / v.total;
    const biased = Math.max(shortShare, overShare);
    if (biased < 0.8) continue;

    const alwaysShort = shortShare > overShare;
    found.push({
      detector: "cash_direction_bias",
      subjectType: "branch",
      subjectId: branchId,
      subjectLabel: v.name,
      title: `${v.name} mein cash ka farq hamesha ${alwaysShort ? "KAM" : "ZYADA"} nikalta hai`,
      detail:
        `Pichhle 90 din mein ${v.total} raat farq nikla — ${v.short} dafa kam, ${v.over} dafa zyada. ` +
        `Ginti ki ghalti ittefaqi hoti hai aur lambe arse mein dono taraf barabar hoti hai. ` +
        `Jo cheez hamesha ek hi taraf jhukti ho, wo ittefaq nahi rehti.`,
      evidence: {
        kam_nikla: v.short,
        zyada_nikla: v.over,
        kul_raaten: v.total,
        kul_farq: round2(v.sum),
        ek_taraf_jhukao_percent: round2(biased * 100),
      },
      sampleSize: v.total,
      severity: biased >= 0.95 && v.total >= 8 ? "high" : "medium",
    });
  }

  return found;
}

/**
 * 2. Naapne wala jo hamesha wohi adad likhta hai.
 *
 * FAT aur LR asal naap hain -- har kisan ka doodh alag hota hai, aur
 * ek hi kisan ka bhi din ba din thora badalta hai. Jis ke bheje hue
 * adad hamesha wohi hon, wo naap nahi raha -- wo likh raha hai.
 *
 * Ye chori ka saboot nahi. Aksar ye sustii ya kharab machine hoti hai.
 * Magar us ki qeemat waise hi hoti hai: rate FAT par lagta hai, is liye
 * ghalat FAT ka matlab har kisan ko ghalat paisa.
 */
async function constantReadings(): Promise<Anomaly[]> {
  const service = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const { data } = await service
    .from("milk_entries")
    .select("fat_percentage, lr, fat_by_profile_id, profiles!milk_entries_fat_by_profile_id_fkey(full_name)")
    .not("fat_percentage", "is", null)
    .not("fat_by_profile_id", "is", null)
    .gte("entry_date", since.toISOString().slice(0, 10));

  const byTester = new Map<string, { name: string; fats: number[] }>();
  for (const row of data ?? []) {
    const key = row.fat_by_profile_id as string;
    const name = (row.profiles as { full_name: string | null } | null)?.full_name ?? "—";
    const current = byTester.get(key) ?? { name, fats: [] };
    current.fats.push(Number(row.fat_percentage));
    byTester.set(key, current);
  }

  const found: Anomaly[] = [];
  for (const [profileId, v] of byTester) {
    if (v.fats.length < 10) continue;

    const counts = new Map<number, number>();
    for (const f of v.fats) counts.set(f, (counts.get(f) ?? 0) + 1);
    const [topValue, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    const share = topCount / v.fats.length;
    if (share < 0.7) continue;

    found.push({
      detector: "constant_fat",
      subjectType: "staff",
      subjectId: profileId,
      subjectLabel: v.name,
      title: `${v.name} ke bheje hue FAT adad hamesha wohi hain`,
      detail:
        `${v.fats.length} entriyon mein se ${topCount} par FAT ${topValue} likha gaya (${round2(share * 100)}%). ` +
        `Har kisan ka doodh alag hota hai aur ek hi kisan ka bhi din ba din badalta hai. ` +
        `Ye chori ka saboot nahi — aksar machine kharab hoti hai ya naap nahi liya jata. ` +
        `Magar rate FAT par lagta hai, is liye ghalat FAT ka matlab har kisan ko ghalat paisa.`,
      evidence: {
        kul_entriyan: v.fats.length,
        sab_se_aam_fat: topValue,
        kitni_dafa: topCount,
        hissa_percent: round2(share * 100),
        alag_alag_adad: counts.size,
      },
      sampleSize: v.fats.length,
      severity: share >= 0.9 ? "high" : "medium",
    });
  }

  return found;
}

/**
 * 3. Wohi shakhs jis ke haath se cash baar baar kam pahunchta hai.
 *
 * Ek dafa kam pahunchna har kisi ke sath ho sakta hai. Do dafa bhi.
 * Magar jab wohi naam baar baar aaye, to wo baat khud sawal ban jati
 * hai -- aur us sawal ka jawab us shakhs ka haq hai, is liye baat naam
 * ke sath honi chahiye, sirginti ke sath nahi.
 */
async function repeatShortfall(): Promise<Anomaly[]> {
  const service = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data } = await service
    .from("cash_handovers")
    .select(
      "difference, status, sent_at, carrier_profile_id, from_profile_id, carrier:profiles!cash_handovers_carrier_profile_id_fkey(full_name), sender:profiles!cash_handovers_from_profile_id_fkey(full_name)"
    )
    .gte("sent_at", since.toISOString());

  const byPerson = new Map<
    string,
    { name: string; short: number; total: number; amount: number }
  >();

  for (const row of data ?? []) {
    const carrierId = row.carrier_profile_id as string | null;
    const id = carrierId ?? (row.from_profile_id as string);
    const name =
      (row.carrier as { full_name: string | null } | null)?.full_name ??
      (row.sender as { full_name: string | null } | null)?.full_name ??
      "—";
    const current = byPerson.get(id) ?? { name, short: 0, total: 0, amount: 0 };
    current.total += 1;
    if (row.status === "short") {
      current.short += 1;
      current.amount += Math.abs(Number(row.difference ?? 0));
    }
    byPerson.set(id, current);
  }

  const found: Anomaly[] = [];
  for (const [profileId, v] of byPerson) {
    if (v.total < MIN_SAMPLE) continue;
    if (v.short < 3) continue;
    const share = v.short / v.total;
    if (share < 0.4) continue;

    found.push({
      detector: "repeat_shortfall",
      subjectType: "staff",
      subjectId: profileId,
      subjectLabel: v.name,
      title: `${v.name} ke haath se cash baar baar kam pahuncha`,
      detail:
        `${v.total} handover mein se ${v.short} dafa kam pahuncha — kul Rs ${Math.round(v.amount).toLocaleString()}. ` +
        `Ek dafa kam pahunchna har kisi ke sath ho sakta hai, do dafa bhi. ` +
        `Magar jab wohi naam baar baar aaye to us se baat karni chahiye — ye ilzam nahi, sawal hai.`,
      evidence: {
        kul_handover: v.total,
        kam_pahuncha: v.short,
        kul_kami: round2(v.amount),
        hissa_percent: round2(share * 100),
      },
      sampleSize: v.total,
      severity: share >= 0.6 ? "high" : "medium",
    });
  }

  return found;
}

/**
 * 4. Gaari ka mileage waqt ke sath girta hua.
 *
 * Gaari purani hone se mileage girta hai -- ye qudrati hai. Magar teiz
 * girawat do baaton mein se ek hoti hai: gaari ko marammat chahiye, ya
 * jitna petrol likha gaya utna gaari mein nahi gaya. Dono baaton ka
 * jawab dhoondna zaroori hai, aur dono ka pehla qadam ek hi hai --
 * gaari dekhna.
 */
async function mileageDecline(): Promise<Anomaly[]> {
  const service = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 90);

  const { data } = await service
    .from("vehicle_daily_logs")
    .select("vehicle_id, km_per_liter, log_date, vehicles(vehicle_name)")
    .not("km_per_liter", "is", null)
    .gt("km_per_liter", 0)
    .gte("log_date", since.toISOString().slice(0, 10))
    .order("log_date");

  const byVehicle = new Map<string, { name: string; rows: { date: string; kmpl: number }[] }>();
  for (const row of data ?? []) {
    const key = row.vehicle_id as string;
    const name = (row.vehicles as { vehicle_name: string } | null)?.vehicle_name ?? "—";
    const current = byVehicle.get(key) ?? { name, rows: [] };
    current.rows.push({ date: row.log_date, kmpl: Number(row.km_per_liter) });
    byVehicle.set(key, current);
  }

  const found: Anomaly[] = [];
  for (const [vehicleId, v] of byVehicle) {
    if (v.rows.length < 10) continue;

    // Pehla aur aakhri aadha -- saada muqabla, aur samjhane mein aasan.
    // Koi behtar hisaab bhi ho sakta tha, magar wo safhe par samjhaya
    // nahi ja sakta, aur jo baat samjhai na ja sake us par faisla nahi
    // hota.
    const half = Math.floor(v.rows.length / 2);
    const older = v.rows.slice(0, half);
    const recent = v.rows.slice(half);
    const avg = (rows: { kmpl: number }[]) => rows.reduce((s, r) => s + r.kmpl, 0) / rows.length;
    const before = round2(avg(older));
    const after = round2(avg(recent));
    if (before <= 0) continue;

    const drop = ((before - after) / before) * 100;
    if (drop < 15) continue;

    found.push({
      detector: "mileage_decline",
      subjectType: "vehicle",
      subjectId: vehicleId,
      subjectLabel: v.name,
      title: `${v.name} ka mileage ${round2(drop)}% gir gaya`,
      detail:
        `Pehle ${before} km/litre, ab ${after} km/litre (${v.rows.length} logon par gina gaya). ` +
        `Gaari purani hone se mileage girta hai, magar itni teiz girawat do baaton mein se ek hoti hai: ` +
        `gaari ko marammat chahiye, ya jitna petrol likha gaya utna gaari mein nahi gaya. ` +
        `Dono ka pehla qadam ek hi hai — gaari dekhna.`,
      evidence: {
        pehle_kmpl: before,
        ab_kmpl: after,
        girawat_percent: round2(drop),
        kul_log: v.rows.length,
      },
      sampleSize: v.rows.length,
      severity: drop >= 30 ? "high" : "medium",
    });
  }

  return found;
}

/**
 * 5. Wo raqmein jo hamesha gol hoti hain.
 *
 * Asal naapa hua kharcha gol nahi hota -- petrol Rs 2,847 ka aata hai,
 * Rs 3,000 ka nahi. Jahan har raqam gol ho, wahan naap nahi hui, andaza
 * lagaya gaya. Andaza chori nahi hai, magar andaze par chalne wala
 * hisaab kabhi theek nahi ho sakta -- aur andaze ke peeche kuch bhi
 * chhup sakta hai.
 */
async function roundNumbers(): Promise<Anomaly[]> {
  const service = createServiceClient();
  const since = new Date();
  since.setDate(since.getDate() - 60);

  const { data } = await service
    .from("company_expense_requests")
    .select("amount, category, requested_by, profiles!company_expense_requests_requested_by_fkey(full_name)")
    .eq("status", "approved")
    .gte("created_at", since.toISOString());

  const byPerson = new Map<string, { name: string; amounts: number[] }>();
  for (const row of data ?? []) {
    const key = (row.requested_by as string) ?? "unknown";
    const name = (row.profiles as { full_name: string | null } | null)?.full_name ?? "—";
    const current = byPerson.get(key) ?? { name, amounts: [] };
    current.amounts.push(Number(row.amount));
    byPerson.set(key, current);
  }

  const found: Anomaly[] = [];
  for (const [profileId, v] of byPerson) {
    if (v.amounts.length < 10) continue;
    const round = v.amounts.filter((a) => a % 500 === 0).length;
    const share = round / v.amounts.length;
    if (share < 0.8) continue;

    found.push({
      detector: "round_amounts",
      subjectType: "staff",
      subjectId: profileId === "unknown" ? null : profileId,
      subjectLabel: v.name,
      title: `${v.name} ke kharche hamesha gol raqam mein hain`,
      detail:
        `${v.amounts.length} kharchon mein se ${round} bilkul gol the (${round2(share * 100)}%). ` +
        `Asal naapa hua kharcha gol nahi hota — petrol Rs 2,847 ka aata hai, Rs 3,000 ka nahi. ` +
        `Andaza chori nahi hai, magar andaze par chalne wala hisaab kabhi theek nahi ho sakta.`,
      evidence: {
        kul_kharche: v.amounts.length,
        gol_raqmein: round,
        hissa_percent: round2(share * 100),
      },
      sampleSize: v.amounts.length,
      severity: "low",
    });
  }

  return found;
}

export interface DetectorRun {
  found: Anomaly[];
  /** Kaunse detector chal hi nahi sake -- data hi kaafi nahi tha. */
  insufficient: string[];
}

const DETECTORS = [
  { key: "cash_direction_bias", label: "Cash ka farq ek hi taraf", run: directionBias },
  { key: "constant_fat", label: "Naapne wala jo wohi adad likhta hai", run: constantReadings },
  { key: "repeat_shortfall", label: "Baar baar kam pahunchne wala cash", run: repeatShortfall },
  { key: "mileage_decline", label: "Girta hua mileage", run: mileageDecline },
  { key: "round_amounts", label: "Hamesha gol raqmein", run: roundNumbers },
];

/**
 * Saare detector chalata hai.
 *
 * Jo detector kuch na de, us ka matlab do mein se ek hai: ya sab theek
 * hai, ya data itna nahi tha ke kuch kaha ja sake. Dono ko ek jaisa
 * dikhana wohi ghalti hogi jo Step 7 mein rok di gayi thi -- is liye
 * yahan bhi dono alag rehte hain.
 */
export async function runDetectors(): Promise<DetectorRun> {
  const found: Anomaly[] = [];
  const insufficient: string[] = [];

  for (const detector of DETECTORS) {
    try {
      const results = await detector.run();
      found.push(...results);
    } catch {
      insufficient.push(detector.label);
    }
  }

  return { found, insufficient };
}

/** Nayi baatein mahfooz karna. Usi din ki wohi baat dobara nahi banti. */
export async function saveAnomalies(anomalies: Anomaly[]): Promise<number> {
  if (anomalies.length === 0) return 0;
  const service = createServiceClient();

  const { data } = await service
    .from("anomaly_findings")
    .upsert(
      anomalies.map((a) => ({
        detector: a.detector,
        subject_type: a.subjectType,
        subject_id: a.subjectId,
        subject_label: a.subjectLabel,
        title: a.title,
        detail: a.detail,
        evidence: a.evidence as Json,
        sample_size: a.sampleSize,
        severity: a.severity,
      })),
      { onConflict: "detector,subject_label,detected_on", ignoreDuplicates: true }
    )
    .select("id");

  return data?.length ?? 0;
}

export interface StoredAnomaly {
  id: string;
  detector: string;
  subjectLabel: string;
  subjectType: string;
  title: string;
  detail: string;
  evidence: Record<string, unknown>;
  sampleSize: number;
  severity: string;
  status: string;
  detectedOn: string;
  reviewNote: string | null;
}

export async function openAnomalies(limit = 40): Promise<StoredAnomaly[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("anomaly_findings")
    .select("*")
    .eq("status", "open")
    .order("severity")
    .order("detected_on", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    detector: r.detector,
    subjectLabel: r.subject_label,
    subjectType: r.subject_type,
    title: r.title,
    detail: r.detail,
    evidence: (r.evidence ?? {}) as Record<string, unknown>,
    sampleSize: r.sample_size,
    severity: r.severity,
    status: r.status,
    detectedOn: r.detected_on,
    reviewNote: r.review_note,
  }));
}

export async function reviewedAnomalies(limit = 20): Promise<StoredAnomaly[]> {
  const service = createServiceClient();
  const { data } = await service
    .from("anomaly_findings")
    .select("*")
    .neq("status", "open")
    .order("reviewed_at", { ascending: false })
    .limit(limit);

  return (data ?? []).map((r) => ({
    id: r.id,
    detector: r.detector,
    subjectLabel: r.subject_label,
    subjectType: r.subject_type,
    title: r.title,
    detail: r.detail,
    evidence: (r.evidence ?? {}) as Record<string, unknown>,
    sampleSize: r.sample_size,
    severity: r.severity,
    status: r.status,
    detectedOn: r.detected_on,
    reviewNote: r.review_note,
  }));
}

export const DETECTOR_LABELS = Object.fromEntries(DETECTORS.map((d) => [d.key, d.label]));
