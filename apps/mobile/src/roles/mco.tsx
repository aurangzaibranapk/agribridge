import { useState } from "react";
import { ScrollView, Text, TextInput } from "react-native";
import { paginate } from "../../../../src/lib/mobile/sync";
import { Btn, Card, Field, GoldCard } from "../kit";
import { colors } from "../kit";

export function RoleScreen({ tab, data, onEnqueue, readOnly = false }: { tab: string; data: any; onEnqueue: (item: any) => void; readOnly?: boolean }) {
  const [fat, setFat] = useState("");
  const [lr, setLr] = useState("");
  const [entry, setEntry] = useState("");
  const rows = paginate(Array.isArray(data?.pendingFat) ? data.pendingFat : [], 1).items;
  const totals = data?.totals;
  return (
    <ScrollView style={{ padding: 16 }}>
      {readOnly ? (
        <Card>
          <Text style={{ fontWeight: "800", color: colors.text }}>TEST · MCO</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>Fat, LR aur invoice band hain. Asal chiller par kuch nahi likhta. TEST doodh kisan aur admin ghar par hai. Yahan Rs 0 is liye nahi ke hisaab sifar hai — sync ki totals is build mein nahi aati.</Text>
        </Card>
      ) : (
        <>
          <GoldCard title="Subah" value={`${totals?.morningLiters ?? 0} L`} sub={`Rs ${totals?.morningAmount ?? 0}`} />
          <GoldCard title="Shaam" value={`${totals?.eveningLiters ?? 0} L`} sub={`Rs ${totals?.eveningAmount ?? 0}`} />
        </>
      )}
      {!readOnly && (tab === "fat" || tab === "home") ? (
        <Card>
          <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 8 }}>FAT / LR — apni entry nahi</Text>
          {rows.map((row: any) => (
            <Text key={row.id} style={{ color: colors.text, marginBottom: 4 }} onPress={() => setEntry(row.id)}>
              {row.collection_number} · {row.quantity_liters} L · LR {row.lr ?? "—"}
            </Text>
          ))}
          <TextInput value={entry} onChangeText={setEntry} placeholder="Entry id" style={input} />
          <TextInput value={fat} onChangeText={setFat} placeholder="FAT" keyboardType="decimal-pad" style={input} />
          <TextInput value={lr} onChangeText={setLr} placeholder="LR agar khali ho" keyboardType="decimal-pad" style={input} />
          <Btn label="Invoice queue" onPress={() => onEnqueue({ kind: "fat", payload: { entry_id: entry, fat: Number(fat), lr: lr ? Number(lr) : null } })} />
        </Card>
      ) : null}
      {tab === "drop" ? (
        <Card>
          <Field label="Chiller" value={data?.chillerName || "—"} />
          <Text style={{ color: colors.muted }}>Drop check upar wali pending entries par hai. Kami ki hadd settings se aati hai.</Text>
        </Card>
      ) : null}
    </ScrollView>
  );
}

const input = { borderWidth: 1, borderColor: "#E2E8E0", borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#fff" };
