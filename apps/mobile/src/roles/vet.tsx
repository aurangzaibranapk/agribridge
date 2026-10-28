import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { karachiDate, liveGet, liveGetScoped, liveInsert, loadHealth, type HealthRow, type PartyRow } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { VetGlass } from "./glass-homes";
import { Btn, colors } from "../kit";
import { farmerPortrait } from "../farmer-portraits";
import type { MunshiAnimal, MunshiReminder } from "../../../../src/lib/mobile/digital-munshi";

export function RoleScreen({ tab, live, readOnly = false, onProfile, onTab }: { tab: string; live?: LiveBag; readOnly?: boolean; onProfile?: () => void; onTab?: (key: string) => void }) {
  const auth = liveAuth(live);
  const [health, setHealth] = useState<HealthRow[] | null>(null);
  const [error, setError] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [farmers, setFarmers] = useState<PartyRow[]>([]);
  const [animals, setAnimals] = useState<MunshiAnimal[]>([]);
  const [reminders, setReminders] = useState<MunshiReminder[]>([]);

  const load = useCallback(async () => {
    if (!auth) return;
    const [rows, farmerRows, animalRows, reminderRows] = await Promise.all([
      loadHealth(auth, fetch),
      liveGetScoped<PartyRow>(auth, "farmers?select=id,full_name,farmer_code&order=full_name.asc&limit=40", fetch),
      liveGet<MunshiAnimal & { farmer_id?: string | null }>(auth, "dairy_animals?select=id,farmer_id,tag_no,name,species,breed,status&order=tag_no.asc&limit=300", fetch),
      liveGet<MunshiReminder>(auth, "dairy_reminders?select=id,farmer_id,task,due_date,animal_id,seen_at&order=due_date.asc&limit=200", fetch),
    ]);
    if (!rows.ok) {
      setHealth([]);
      setError(rows.message);
    } else {
      setHealth(rows.rows);
      setError("");
    }
    if (farmerRows.ok) {
      setFarmers(farmerRows.rows);
    }
    if (animalRows.ok) setAnimals(animalRows.rows);
    if (reminderRows.ok) setReminders(reminderRows.rows);
    if (farmerRows.ok && farmerRows.rows[0]?.id) {
      setFarmerId((current) => current || farmerRows.rows[0].id || "");
      setFarmerName((current) => current || farmerRows.rows[0].full_name || "Kisan");
    }
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Vet"><Empty title="Login chahiye" body="Doctor ka record login ke baad khulta hai." /></Section></ScrollView>;
  if (!health) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  const selectedHealth = farmerId ? health.filter((row) => row.farmer_id === farmerId) : health;
  const selectedAnimals = farmerId ? animals.filter((row) => (row as MunshiAnimal & { farmer_id?: string | null }).farmer_id === farmerId) : animals;
  const selectedReminders = farmerId ? reminders.filter((row) => row.farmer_id === farmerId) : reminders;

  async function saveVisit() {
    if (!auth || readOnly) return;
    const text = diagnosis.trim();
    if (text.length < 2) { setNote("Diagnosis likhein."); return; }
    if (!farmerId) { setNote("TEST kisan nahi mila."); return; }
    setBusy(true);
    const saved = await liveInsert<HealthRow>(auth, "dairy_health_events", {
      farmer_id: farmerId,
      kind: "vet_visit",
      diagnosis: text.slice(0, 120),
      vet_name: "TEST Vet",
      event_date: karachiDate(),
      cost: null,
      payment: "cash",
      notes: "App vet visit",
    }, fetch);
    setBusy(false);
    if (!saved.ok) {
      setNote(saved.message);
      return;
    }
    setDiagnosis("");
    setNote("Ilaj save ho gaya. Kisan ke Vet tab par ye note dikhega.");
    await load();
  }

  if (tab === "home") {
    return <VetGlass live={live} health={health} error={error} onProfile={onProfile} onTab={onTab} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />;
  }

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {error ? <Section title="Vet"><Empty title="Record nahi khula" body={error} /></Section> : null}
      {note ? <Text style={{ color: colors.greenDark, marginBottom: 8 }}>{note}</Text> : null}
      <Section title="Kisan choose karein" sub={`${farmers.length} linked farmers`}>
        {farmers.length === 0 ? <Empty title="Kisan nahi mila" body="Vet ko allowed farmer list nazar aayegi." /> : null}
        {farmers.slice(0, 10).map((farmer, index) => (
          <Pressable key={farmer.id || String(index)} onPress={() => { if (farmer.id) setFarmerId(farmer.id); setFarmerName(farmer.full_name || "Kisan"); }} style={{ flexDirection: "row", alignItems: "center", padding: 8, marginBottom: 7, borderRadius: 14, backgroundColor: farmer.id === farmerId ? "#E3F6E8" : "#F7F8F3", borderWidth: 1, borderColor: farmer.id === farmerId ? colors.green : colors.line }}>
            <Image source={farmerPortrait(index)} style={{ width: 48, height: 48, borderRadius: 13, marginRight: 10 }} />
            <View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "800" }}>{farmer.full_name || "Kisan"}</Text><Text style={{ color: colors.muted }}>{farmer.farmer_code || "Farmer"}</Text></View>
            <Text style={{ color: colors.greenDark, fontWeight: "800" }}>{farmer.id === farmerId ? "Selected" : "Open ›"}</Text>
          </Pressable>
        ))}
      </Section>
      <Section title={`${farmerName || "Kisan"} · Vet overview`} sub={`${selectedAnimals.length} animals · ${selectedHealth.length} health records · ${selectedReminders.length} reminders`}>
        {selectedReminders.slice(0, 6).map((row) => <Text key={row.id || `${row.task}-${row.due_date}`} style={{ color: colors.text, marginBottom: 6 }}>{row.due_date || "—"} · {row.task || "Reminder"}</Text>)}
        {selectedAnimals.slice(0, 8).map((row) => <Text key={row.id || row.tag_no || row.name} style={{ color: colors.muted, marginBottom: 5 }}>#{row.tag_no || "—"} · {row.name || row.species || "Janwar"} · {row.status || "status —"}</Text>)}
      </Section>
      {tab === "visits" ? (
        <Section title={tab === "visits" ? "Visits" : "Doctor Home"} sub={farmerName || "Kisan"}>
          {selectedHealth.length === 0 ? <Empty title="Abhi koi visit nahi" body="Ilaj likhne par tareekh, naam aur diagnosis yahan aayenge." /> : null}
          {selectedHealth.map((row, index) => (
            <Text key={row.id || String(index)} style={{ color: colors.text, marginBottom: 6 }}>{row.event_date} · {row.kind === "vet_visit" ? "Vet visit" : row.kind} · {row.vet_name || "Doctor"} · {row.diagnosis || row.notes || "Note nahi"}</Text>
          ))}
        </Section>
      ) : null}
      {tab === "visits" || tab === "home" ? (
        <Section title="Ilaj entry" sub="Vet visit. Kharcha sifar nahi likhte.">
          {readOnly ? <Text style={{ color: colors.muted }}>Sirf dekhna. Ilaj band hai.</Text> : (
            <View>
              <TextInput value={diagnosis} onChangeText={setDiagnosis} placeholder="Diagnosis" style={input} />
              <Btn label={busy ? "Save ho raha hai" : "Ilaj save karein"} onPress={() => { if (!busy) void saveVisit(); }} />
            </View>
          )}
        </Section>
      ) : null}
      {tab === "stock" ? <Section title="Stock"><Empty title="Dawai stock yahan nahi" body="Asal stock is screen se nahi badalta. Ilaj Visits par hai." /></Section> : null}
      {tab === "more" ? <Section title="Aur"><Empty title="Profile upar hai" body="Visits aur ilaj Home par hain." /></Section> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

const input = { borderWidth: 1, borderColor: "#E2E8E0", borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#fff" };
