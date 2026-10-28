import { useCallback, useEffect, useState } from "react";
import { Image, Modal, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { lrRangeError } from "../../../../src/lib/dairy/rules";
import { karachiDate, liveGetScoped, liveInsert, loadMilkList, shiftLabel, type MilkRow, type PartyRow } from "../../../../src/lib/mobile/live-read";
import { liveAuth, type LiveBag } from "../bits";
import { McaGlass } from "./glass-homes";
import { Btn, Card, Field } from "../kit";
import { colors } from "../kit";
import { farmerPortrait } from "../farmer-portraits";

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

function karachiHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", hourCycle: "h23" }).format(now);
  const value = Number(hour);
  return Number.isFinite(value) ? value : now.getHours();
}

export function RoleScreen({ tab, data, queueCount, onEnqueue, onSync, readOnly = false, live, onProfile, onTab }: { tab: string; data: any; queueCount: number; onEnqueue: (item: any) => void; onSync: () => void; readOnly?: boolean; live?: LiveBag; onProfile?: () => void; onTab?: (key: string) => void }) {
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
  const [pickupOpen, setPickupOpen] = useState(false);

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

  function openPickup(id: string) {
    if (readOnly) return;
    setFarmerId(id);
    setShift(karachiHour() < 12 ? "morning" : "evening");
    setLiters("");
    setLr("");
    setSaved(null);
    setNote("");
    setPickupOpen(true);
  }

  const box = { borderWidth: 1, borderColor: "#E2E8E0", borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#fff" };
  const showPickup = tab === "route";
  const selectedFarmer = farmers.find((farmer) => farmer.id === farmerId);
  const selectedIndex = Math.max(0, farmers.findIndex((farmer) => farmer.id === farmerId));
  const pickupModal = (
    <Modal visible={pickupOpen} transparent animationType="slide" onRequestClose={() => { if (!busy) setPickupOpen(false); }}>
      <View style={{ flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(8,25,14,0.45)" }}>
        <View style={{ maxHeight: "88%", backgroundColor: "#F7FAF6", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 18 }}>
          <ScrollView keyboardShouldPersistTaps="handled">
            <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
              <Image source={farmerPortrait(selectedIndex)} style={{ width: 64, height: 64, borderRadius: 18, marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>{selectedFarmer?.full_name || "Kisan"}</Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>{selectedFarmer?.farmer_code || "Milk farmer"}</Text>
              </View>
              <Pressable disabled={busy} onPress={() => setPickupOpen(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "#E6EEE5", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: colors.text, fontSize: 20, fontWeight: "900" }}>×</Text>
              </Pressable>
            </View>
            <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>Doodh uthana</Text>
            <Text style={{ color: colors.muted, marginTop: 4 }}>12 baje se pehle Subah, 12 ke baad Shaam auto hai. Zaroorat par badal sakte hain.</Text>
            <View style={{ flexDirection: "row", marginTop: 12 }}>
              <Pressable onPress={() => setShift("morning")} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: shift === "morning" ? colors.green : "#E7F0E4" }}>
                <Text style={{ textAlign: "center", color: shift === "morning" ? "#fff" : colors.text, fontWeight: "900" }}>Subah</Text>
              </Pressable>
              <View style={{ width: 8 }} />
              <Pressable onPress={() => setShift("evening")} style={{ flex: 1, padding: 12, borderRadius: 12, backgroundColor: shift === "evening" ? colors.green : "#E7F0E4" }}>
                <Text style={{ textAlign: "center", color: shift === "evening" ? "#fff" : colors.text, fontWeight: "900" }}>Shaam</Text>
              </Pressable>
            </View>
            <TextInput value={liters} onChangeText={setLiters} placeholder="Uthaya hua doodh · Litre" keyboardType="decimal-pad" style={box} />
            <TextInput value={lr} onChangeText={setLr} placeholder="LR agar maujood ho — optional" keyboardType="decimal-pad" style={box} />
            <Text style={{ color: colors.muted, marginTop: 8 }}>LR khali chhor dein to MCO chiller par LR aur Fat darj karke entry complete karega.</Text>
            {note ? <Text style={{ color: note.startsWith("Doodh save") ? colors.greenDark : colors.danger, marginTop: 10, fontWeight: "700" }}>{note}</Text> : null}
            <Btn label={busy ? "Save ho raha hai" : "MCO ko bhejein"} onPress={() => { if (!busy) void savePickup(); }} />
            {saved ? <Text style={{ color: colors.text, marginTop: 8 }}>Saved · {shiftLabel(saved.shift)} · {saved.quantity_liters} L · LR {saved.lr ?? "MCO par pending"}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
  if (tab === "home") return <>{pickupModal}<McaGlass live={live} farmers={farmers} onProfile={onProfile} onTab={onTab} onFarmerPress={openPickup} /></>;

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
          {farmers.slice(0, 10).map((farmer, index) => {
            const selected = farmer.id === farmerId;
            return (
              <Pressable
                key={farmer.id || String(index)}
                onPress={() => { if (farmer.id) openPickup(farmer.id); }}
                style={{ marginTop: 8, flexDirection: "row", alignItems: "center", padding: 8, borderRadius: 14, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.green : colors.line, backgroundColor: selected ? "#ECF8EF" : "#fff" }}
              >
                <Image source={farmerPortrait(index)} style={{ width: 52, height: 52, borderRadius: 14, marginRight: 10 }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ color: selected ? colors.greenDark : colors.text, fontWeight: "800" }}>{farmer.full_name || "Kisan"}</Text>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>{farmer.farmer_code || "Milk farmer"}</Text>
                </View>
                <Text style={{ color: selected ? colors.greenDark : colors.muted, fontWeight: "800" }}>{selected ? "Selected" : "Choose"}</Text>
              </Pressable>
            );
          })}
          {!auth ? <Text style={{ color: colors.muted, marginTop: 8 }}>Login ke baghair kisan ki fehrist nahi khulti.</Text> : null}
          <Text style={{ color: colors.muted, marginTop: 10 }}>Farmer card dabayen; litre aur optional LR popup mein darj honge.</Text>
        </Card>
      ) : null}
      {!readOnly && tab === "start" ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 18 }}>Start Shift</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>GPS attendance ke sath aaj ka collection route start karein.</Text>
          <Btn label="Start Shift · GPS Hazri" onPress={() => void attendance()} />
        </Card>
      ) : null}
      {!readOnly && tab === "meter" ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 18 }}>Opening Meter Photo</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Motorcycle meter reading likhein aur camera se tasveer lein.</Text>
          <TextInput value={km} onChangeText={setKm} placeholder="Meter KM" keyboardType="decimal-pad" style={box} />
          <Btn label="Camera kholen aur save karein" onPress={() => void meter()} />
        </Card>
      ) : null}
      {!readOnly && tab === "petrol" ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.text, fontSize: 18 }}>Petrol Entry</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Petrol litres likhein aur receipt ki tasveer lagayein.</Text>
          <TextInput value={fuel} onChangeText={setFuel} placeholder="Petrol litre" keyboardType="decimal-pad" style={box} />
          <Btn label="Receipt camera aur save" kind="gold" onPress={() => void petrol()} />
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
      {pickupModal}
    </ScrollView>
  );
}
