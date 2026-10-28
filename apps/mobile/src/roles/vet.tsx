import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { karachiDate, liveGet, liveGetScoped, liveInsert, loadHealth, type HealthRow } from "../../../../src/lib/mobile/live-read";
import type { MunshiReminder } from "../../../../src/lib/mobile/digital-munshi";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";
import { ApprovedVetApp, type VetAnimal, type VetFarmer, type VetHealth, type VetTreatment } from "./vet-approved";

type ProfileRow = { full_name?: string | null; designation?: string | null };

function validFutureDate(value: string, today: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value > today;
}

export function RoleScreen({
  tab,
  live,
  readOnly = false,
  onProfile,
  onTab,
}: {
  tab: string;
  live?: LiveBag;
  readOnly?: boolean;
  onProfile?: () => void;
  onTab?: (key: string) => void;
}) {
  const auth = liveAuth(live);
  const today = karachiDate();
  const [health, setHealth] = useState<VetHealth[] | null>(null);
  const [farmers, setFarmers] = useState<VetFarmer[]>([]);
  const [animals, setAnimals] = useState<VetAnimal[]>([]);
  const [reminders, setReminders] = useState<MunshiReminder[]>([]);
  const [vetName, setVetName] = useState("");
  const [place, setPlace] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth) return;
    const profilePath = auth.userId
      ? `profiles?select=full_name,designation&id=eq.${encodeURIComponent(auth.userId)}&limit=1`
      : "profiles?select=full_name,designation&limit=0";
    const [healthRows, farmerRows, animalRows, reminderRows, profileRows] = await Promise.all([
      loadHealth(auth, fetch),
      liveGetScoped<VetFarmer>(auth, "farmers?select=id,full_name,farmer_code,village,phone_number&order=full_name.asc&limit=200", fetch),
      liveGet<VetAnimal>(auth, "dairy_animals?select=id,farmer_id,tag_no,name,species,breed,sex,dob,status&order=tag_no.asc&limit=500", fetch),
      liveGet<MunshiReminder>(auth, "dairy_reminders?select=id,farmer_id,task,due_date,animal_id,seen_at&order=due_date.asc&limit=300", fetch),
      liveGet<ProfileRow>(auth, profilePath, fetch),
    ]);
    const messages: string[] = [];
    if (healthRows.ok) setHealth(healthRows.rows);
    else { setHealth([]); messages.push(healthRows.message); }
    if (farmerRows.ok) setFarmers(farmerRows.rows);
    else { setFarmers([]); messages.push(farmerRows.message); }
    if (animalRows.ok) setAnimals(animalRows.rows);
    else { setAnimals([]); messages.push(animalRows.message); }
    if (reminderRows.ok) setReminders(reminderRows.rows);
    else { setReminders([]); messages.push(reminderRows.message); }
    const profile = profileRows.ok ? profileRows.rows[0] : null;
    setVetName(String(profile?.full_name || "").trim());
    setPlace(String((farmerRows.ok ? farmerRows.rows.find((row) => row.village)?.village : "") || "").trim());
    setError([...new Set(messages)].join(" "));
  }, [auth?.token, auth?.url, auth?.userId, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);

  async function saveTreatment(input: VetTreatment) {
    if (!auth || readOnly || busy) return;
    setNote("");
    const diagnosis = input.diagnosis.trim();
    const medicine = input.medicine.trim();
    if (!input.farmerId) { setNote("Pehle farmer choose karein."); return; }
    if (diagnosis.length < 2) { setNote("Diagnosis likhein."); return; }
    if (medicine.length < 2) { setNote("Medicine likhein."); return; }
    if (input.nextDue.trim() && !validFutureDate(input.nextDue.trim(), today)) { setNote("Follow-up date aaj ke baad YYYY-MM-DD mein likhein."); return; }
    const costText = input.cost.trim();
    const cost = costText ? Number(costText) : null;
    if (costText && (!Number.isFinite(cost) || Number(cost) < 0)) { setNote("Treatment cost durust likhein."); return; }
    const details = [
      input.symptoms.length ? `Symptoms: ${input.symptoms.join(", ")}` : "",
      input.temperature.trim() ? `Temperature: ${input.temperature.trim()} C` : "",
      "Vet mobile app",
    ].filter(Boolean).join(" · ").slice(0, 300);
    setBusy(true);
    const saved = await liveInsert<HealthRow>(auth, "dairy_health_events", {
      farmer_id: input.farmerId,
      animal_id: input.animalId,
      kind: "treatment",
      diagnosis: diagnosis.slice(0, 120),
      medicine: medicine.slice(0, 120),
      dose: input.dose.trim().slice(0, 60) || null,
      event_date: today,
      next_due: input.nextDue.trim() || null,
      cost,
      payment: "cash",
      vet_name: vetName || "Vet Team",
      notes: details,
    }, fetch);
    setBusy(false);
    if (!saved.ok) { setNote(saved.message); return; }
    setNote("Treatment save ho gaya. Farmer history aur Admin report dono update ho gaye.");
    await load();
  }

  async function completeVaccine(farmerId: string, animalId: string | null, code: string) {
    if (!auth || readOnly || busy) return;
    if (!farmerId || !code) { setNote("Vaccine farmer/code record mukammal nahi."); return; }
    setBusy(true);
    setNote("");
    const saved = await liveInsert<HealthRow>(auth, "dairy_health_events", {
      farmer_id: farmerId,
      animal_id: animalId,
      kind: "vaccine",
      vaccine_code: code,
      diagnosis: `Vaccine ${code}`,
      event_date: today,
      payment: "cash",
      vet_name: vetName || "Vet Team",
      notes: "Vet mobile app vaccination",
    }, fetch);
    setBusy(false);
    if (!saved.ok) { setNote(saved.message); return; }
    setNote(`${code} vaccination complete save ho gayi. Next due system khud banayega.`);
    await load();
  }

  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Vet"><Empty title="Login chahiye" body="Vet Team ka record login ke baad khulta hai." /></Section></ScrollView>;
  if (!health) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  return <ApprovedVetApp
    tab={tab}
    today={today}
    vetName={vetName}
    place={place}
    farmers={farmers}
    animals={animals}
    health={health}
    reminders={reminders}
    note={note}
    error={error}
    refreshing={refreshing}
    busy={busy}
    readOnly={readOnly}
    onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
    onProfile={onProfile}
    onTab={onTab}
    onSaveTreatment={(input) => { void saveTreatment(input); }}
    onCompleteVaccine={(farmerId, animalId, code) => { void completeVaccine(farmerId, animalId, code); }}
    onReport={() => setNote("Admin report live hai. Saved Vet records Admin dashboard par available hain.")}
  />;
}
