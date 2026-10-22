import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { karachiDate, liveGetScoped, liveInsert, loadHealth, type HealthRow, type PartyRow } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { Btn, colors } from "../kit";

export function RoleScreen({ tab, live, readOnly = false }: { tab: string; live?: LiveBag; readOnly?: boolean }) {
  const auth = liveAuth(live);
  const [health, setHealth] = useState<HealthRow[] | null>(null);
  const [error, setError] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [farmerName, setFarmerName] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth) return;
    const [rows, farmers] = await Promise.all([
      loadHealth(auth, fetch),
      liveGetScoped<PartyRow>(auth, "farmers?select=id,full_name&order=full_name.asc&limit=10", fetch),
    ]);
    if (!rows.ok) {
      setHealth([]);
      setError(rows.message);
    } else {
      setHealth(rows.rows);
      setError("");
    }
    if (farmers.ok && farmers.rows[0]?.id) {
      setFarmerId(farmers.rows[0].id);
      setFarmerName(farmers.rows[0].full_name || "Kisan");
    }
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Vet"><Empty title="Login chahiye" body="Doctor ka record login ke baad khulta hai." /></Section></ScrollView>;
  if (!health) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

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

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {error ? <Section title="Vet"><Empty title="Record nahi khula" body={error} /></Section> : null}
      {note ? <Text style={{ color: colors.greenDark, marginBottom: 8 }}>{note}</Text> : null}
      {tab === "home" || tab === "visits" ? (
        <Section title={tab === "visits" ? "Visits" : "Doctor Home"} sub={farmerName || "Kisan"}>
          {health.length === 0 ? <Empty title="Abhi koi visit nahi" body="Ilaj likhne par tareekh, naam aur diagnosis yahan aayenge." /> : null}
          {health.map((row, index) => (
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
