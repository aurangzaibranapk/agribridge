import { useCallback, useEffect, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { lrRangeError } from "../../../../src/lib/dairy/rules";
import { karachiDate, liveGetScoped, liveInsert, loadMilkList, rupees, shiftLabel, type MilkRow, type PartyRow } from "../../../../src/lib/mobile/live-read";
import { liveAuth, type LiveBag } from "../bits";
import { McaGlass } from "./glass-homes";
import { Btn, Card, Field } from "../kit";
import { colors } from "../kit";

async function photo() {
  try {
    const picked = await ImagePicker.launchCameraAsync({ quality: 0.4, base64: true });
    if (picked.canceled || !picked.assets[0]?.base64) return null;
    return { base64: picked.assets[0].base64, mime: picked.assets[0].mimeType ?? "image/jpeg" };
  } catch {
    return null;
  }
}

function uuid(): string {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.randomUUID) return cryptoObj.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16);
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function parseNum(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function RoleScreen({ tab, data, queueCount, onEnqueue, onSync, readOnly = false, live, onProfile }: { tab: string; data: any; queueCount: number; onEnqueue: (item: any) => void; onSync: () => void; readOnly?: boolean; live?: LiveBag; onProfile?: () => void }) {
  const auth = liveAuth(live);
  const [liters, setLiters] = useState("");
  const [lr, setLr] = useState("");
  const [shift, setShift] = useState<"morning" | "evening">("morning");
  const [farmerId, setFarmerId] = useState("");
  const [farmers, setFarmers] = useState<PartyRow[]>([]);
  const [farmerNote, setFarmerNote] = useState("");
  const [route, setRoute] = useState(String(data?.routeName || ""));
  const [chiller, setChiller] = useState(String(data?.chillerName || ""));
  const [km, setKm] = useState("");
  const [fuel, setFuel] = useState("");
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<MilkRow | null>(null);
  const [busy, setBusy] = useState(false);

  const loadFarmers = useCallback(async () => {
    if (!auth) return;
    const [listed, staff] = await Promise.all([
      liveGetScoped<PartyRow>(auth, "farmers?select=id,full_name,farmer_code&order=full_name.asc&limit=40", fetch),
      auth.userId
        ? liveGetScoped<{ milk_route_name?: string | null; milk_chiller_name?: string | null }>(auth, `staff_details?select=milk_route_name,milk_chiller_name&profile_id=eq.${encodeURIComponent(auth.userId)}&limit=1`, fetch)
        : Promise.resolve({ ok: true as const, rows: [] }),
    ]);
    if (listed.ok) {
      setFarmers(listed.rows);
      setFarmerId((current) => current || listed.rows[0]?.id || "");
      setFarmerNote(listed.rows.length ? "" : "TEST kisan nahi mila. Seed dobara chalao.");
    } else {
      setFarmerNote(listed.message);
    }
    if (staff.ok && staff.rows[0]) {
      if (staff.rows[0].milk_route_name) setRoute(staff.rows[0].milk_route_name);
      if (staff.rows[0].milk_chiller_name) setChiller(staff.rows[0].milk_chiller_name);
    }
  }, [auth?.token, auth?.url, auth?.userId, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void loadFarmers(); }, [loadFarmers]);

  async function attendance() {
    const pos = await Location.requestForegroundPermissionsAsync();
    if (!pos.granted) { setNote("GPS ki ijazat nahi mili."); return; }
    const here = await Location.getCurrentPositionAsync({});
    onEnqueue({ kind: "attendance", payload: { lat: here.coords.latitude, lng: here.coords.longitude } });
    setNote("Hazri queue mein hai.");
  }
  async function meter() {
    const shot = await photo();
    if (!shot) return;
    onEnqueue({ kind: "meter", payload: { km: Number(km), photo_base64: shot.base64, photo_mime: shot.mime } });
    setNote("Meter ki tasveer queue mein hai.");
  }
  async function petrol() {
    const shot = await photo();
    if (!shot) return;
    onEnqueue({ kind: "petrol", payload: { liters: Number(fuel), photo_base64: shot.base64, photo_mime: shot.mime } });
    setNote("Petrol bill queue mein hai. Rate settings se lock hai.");
  }
  function drop() {
    onEnqueue({ kind: "drop", payload: { liters: Number(liters), field_liters: Number(liters) } });
    setNote("Chiller drop queue mein hai.");
  }

  async function savePickup() {
    if (!auth || !auth.userId) { setNote("Login chahiye. Doodh save nahi hua."); return; }
    const litres = parseNum(liters);
    const lrValue = parseNum(lr);
    if (!farmerId) { setNote("Kisan chunein."); return; }
    if (litres == null || !(litres > 0)) { setNote("Litre sahi likhein."); return; }
    if (lrValue != null) {
      const lrError = lrRangeError(lrValue, false);
      if (lrError) { setNote(lrError); return; }
    }
    const body: Record<string, unknown> = {
      farmer_id: farmerId,
      entry_date: karachiDate(),
      shift,
      quantity_liters: litres,
      entry_channel: "app",
      collection_source: "mca_field",
      mca_profile_id: auth.userId,
      created_by: auth.userId,
      client_uuid: uuid(),
      route_name: route || null,
      chiller_name: chiller || null,
      notes: "App pickup",
      is_test: auth.testAccount === true,
      status: "pending_fat",
    };
    if (lrValue != null) body.lr = lrValue;
    setBusy(true);
    const savedRow = await liveInsert<MilkRow>(auth, "milk_entries", body, fetch);
    setBusy(false);
    if (!savedRow.ok) {
      const missing = /is_test|schema cache|42703|PGRST204/i.test(savedRow.detail || "");
      const denied = savedRow.status === 401 || savedRow.status === 403 || /42501|row-level security/i.test(savedRow.detail || "");
      setNote(missing || denied
        ? "Save nahi hua. Testing par 699 ke baad 700_app_test_milk_write.sql lagani hai."
        : savedRow.message);
      return;
    }
    const row = savedRow.rows[0] ?? null;
    setSaved(row);
    setLiters("");
    setLr("");
    const fresh = await loadMilkList(auth, fetch);
    if (fresh.ok && fresh.rows[0]) setSaved(fresh.rows[0]);
    setNote("Doodh save ho gaya. Entry MCC par Fat aur LR verification ke liye pending hai.");
  }

  const box = { borderWidth: 1, borderColor: "#E2E8E0", borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#fff" };
  const showPickup = tab === "route";
  if (tab === "home") return <McaGlass live={live} farmers={farmers} onProfile={onProfile} />;

  return (
    <ScrollView style={{ padding: 16 }}>
      <Card>
        <Field label="Route" value={route || "—"} />
        <Field label="Chiller" value={chiller || "—"} />
        <Field label="Offline queue" value={String(queueCount)} />
        <Text style={{ color: colors.muted }}>{note}</Text>
        {readOnly ? <Text style={{ color: colors.muted, marginTop: 8 }}>Sirf dekhna. GPS, meter, petrol, pickup aur drop band hain. Asal route par kuch nahi likhta.</Text> : <Btn label="Sync" kind="ghost" onPress={onSync} />}
      </Card>
      {showPickup ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>Doodh uthana</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Gate par kisan, shift aur litre. LR ho to optional; Fat MCC par.</Text>
          {farmerNote ? <Text style={{ color: colors.danger, marginTop: 6 }}>{farmerNote}</Text> : null}
          {farmers.map((farmer) => (
            <Text
              key={farmer.id}
              onPress={() => { if (!readOnly && farmer.id) setFarmerId(farmer.id); }}
              style={{ marginTop: 8, color: farmer.id === farmerId ? colors.greenDark : colors.text, fontWeight: farmer.id === farmerId ? "800" : "500" }}
            >
              {farmer.id === farmerId ? "● " : "○ "}{farmer.full_name || "Kisan"}{farmer.farmer_code ? ` · ${farmer.farmer_code}` : ""}
            </Text>
          ))}
          {!auth ? <Text style={{ color: colors.muted, marginTop: 8 }}>Login ke baghair kisan ki fehrist nahi khulti.</Text> : null}
          <View style={{ flexDirection: "row", marginTop: 10 }}>
            <Text onPress={() => { if (!readOnly) setShift("morning"); }} style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 10, overflow: "hidden", backgroundColor: shift === "morning" ? colors.green : "#E7F0E4", color: shift === "morning" ? "#fff" : colors.text, fontWeight: "700" }}>Subah</Text>
            <View style={{ width: 8 }} />
            <Text onPress={() => { if (!readOnly) setShift("evening"); }} style={{ flex: 1, textAlign: "center", padding: 10, borderRadius: 10, overflow: "hidden", backgroundColor: shift === "evening" ? colors.green : "#E7F0E4", color: shift === "evening" ? "#fff" : colors.text, fontWeight: "700" }}>Shaam</Text>
          </View>
          <TextInput value={liters} onChangeText={setLiters} editable={!readOnly} placeholder="Litre" keyboardType="decimal-pad" style={box} />
          <TextInput value={lr} onChangeText={setLr} editable={!readOnly} placeholder="LR (agar gate par ho) — optional" keyboardType="decimal-pad" style={box} />
          {readOnly ? <Text style={{ color: colors.muted, marginTop: 8 }}>Sirf dekhna · save band</Text> : <Btn label={busy ? "Save ho raha hai" : "Doodh save karein"} onPress={() => { if (!busy) void savePickup(); }} />}
          {saved ? (
            <Text style={{ color: colors.text, marginTop: 8 }}>
              Save: {saved.entry_date || karachiDate()} · {shiftLabel(saved.shift)} · {saved.quantity_liters} L · Fat {saved.fat_percentage ?? "—"} · SNF {saved.snf_percentage ?? "—"} · LR {saved.lr ?? "—"} · {saved.total_amount == null ? "raqam —" : rupees(Number(saved.total_amount))}
            </Text>
          ) : null}
        </Card>
      ) : null}
      {tab === "fuel" ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.text }}>Kisan</Text>
          {farmers.map((farmer) => <Text key={farmer.id} style={{ color: colors.text, marginTop: 8 }}>{farmer.full_name || "Kisan"}{farmer.farmer_code ? ` · ${farmer.farmer_code}` : ""}</Text>)}
          {!farmers.length ? <Text style={{ color: colors.muted, marginTop: 8 }}>{farmerNote || "Koi kisan nahi."}</Text> : null}
        </Card>
      ) : null}
      {!readOnly && tab === "more" ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>Hazri, meter, petrol</Text>
          <Btn label="GPS hazri" onPress={() => void attendance()} />
          <TextInput value={km} onChangeText={setKm} placeholder="Meter KM" keyboardType="decimal-pad" style={box} />
          <Btn label="Meter ki tasveer" onPress={() => void meter()} />
          <TextInput value={fuel} onChangeText={setFuel} placeholder="Petrol litre" keyboardType="decimal-pad" style={box} />
          <Btn label="Petrol bill" kind="gold" onPress={() => void petrol()} />
        </Card>
      ) : null}
      {!readOnly && tab === "drop" ? (
        <Card>
          <TextInput value={liters} onChangeText={setLiters} placeholder="Chiller par litre" keyboardType="decimal-pad" style={box} />
          <Btn label="Drop queue" onPress={drop} />
        </Card>
      ) : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
