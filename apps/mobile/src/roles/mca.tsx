import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { Btn, Card, Field, Later } from "../kit";
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

export function RoleScreen({ tab, data, queueCount, onEnqueue, onSync, readOnly = false }: { tab: string; data: any; queueCount: number; onEnqueue: (item: any) => void; onSync: () => void; readOnly?: boolean }) {
  const [code, setCode] = useState("");
  const [liters, setLiters] = useState("");
  const [lr, setLr] = useState("");
  const [km, setKm] = useState("");
  const [fuel, setFuel] = useState("");
  const [note, setNote] = useState("");

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
  async function pickup() {
    const shot = await photo().catch(() => null);
    onEnqueue({
      kind: "pickup",
      payload: { farmer_code: code, liters: Number(liters), lr: lr ? Number(lr) : null, photo_base64: shot?.base64, photo_mime: shot?.mime, collected_at: new Date().toISOString() },
    });
    setNote("Kisan ki pickup queue mein hai.");
  }
  function drop() {
    onEnqueue({ kind: "drop", payload: { liters: Number(liters), field_liters: Number(liters) } });
    setNote("Chiller drop queue mein hai.");
  }

  const box = { borderWidth: 1, borderColor: "#E2E8E0", borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#fff" };
  return (
    <ScrollView style={{ padding: 16 }}>
      <Card>
        <Field label="Route" value={data?.routeName || "—"} />
        <Field label="Chiller" value={data?.chillerName || "—"} />
        <Field label="Offline queue" value={String(queueCount)} />
        <Text style={{ color: colors.muted }}>{note}</Text>
        {readOnly ? <Text style={{ color: colors.muted, marginTop: 8 }}>Sirf dekhna. GPS, meter, petrol, pickup aur drop band hain. Asal route par kuch nahi likhta.</Text> : <Btn label="Sync" kind="ghost" onPress={onSync} />}
      </Card>
      {!readOnly && (tab === "home" || tab === "fuel") ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text }}>Hazri, meter, petrol</Text>
          <Btn label="GPS hazri" onPress={() => void attendance()} />
          <TextInput value={km} onChangeText={setKm} placeholder="Meter KM" keyboardType="decimal-pad" style={box} />
          <Btn label="Meter ki tasveer" onPress={() => void meter()} />
          <TextInput value={fuel} onChangeText={setFuel} placeholder="Petrol litre" keyboardType="decimal-pad" style={box} />
          <Btn label="Petrol bill" kind="gold" onPress={() => void petrol()} />
        </Card>
      ) : null}
      {!readOnly && tab === "route" ? (
        <Card>
          <TextInput value={code} onChangeText={setCode} placeholder="Kisan ka code" style={box} />
          <TextInput value={liters} onChangeText={setLiters} placeholder="Litre" keyboardType="decimal-pad" style={box} />
          <TextInput value={lr} onChangeText={setLr} placeholder="LR" keyboardType="decimal-pad" style={box} />
          <Btn label="Pickup queue" onPress={() => void pickup()} />
        </Card>
      ) : null}
      {!readOnly && tab === "drop" ? (
        <Card>
          <TextInput value={liters} onChangeText={setLiters} placeholder="Chiller par litre" keyboardType="decimal-pad" style={box} />
          <Btn label="Drop queue" onPress={drop} />
        </Card>
      ) : null}
      {tab === "more" ? <Later title="MCA more" /> : null}
    </ScrollView>
  );
}
