import { ScrollView, Text } from "react-native";
import { paginate } from "../../../../src/lib/mobile/sync";
import { Card, Field, GoldCard, Later } from "../kit";
import { colors } from "../kit";

export function RoleScreen({ tab, data }: { tab: string; data: any }) {
  const milk = Array.isArray(data?.milk) ? data.milk : [];
  const page = paginate(milk, 1);
  const owed = data?.khata?.owed;
  if (tab === "shop" || tab === "orders") return <ScrollView style={{ padding: 16 }}><Later title={tab === "shop" ? "Dukaan" : "Orders"} /></ScrollView>;
  if (tab === "khata") {
    return (
      <ScrollView style={{ padding: 16 }}>
        <GoldCard title="Mera khata" value={owed == null ? "—" : `Rs ${Number(owed).toLocaleString("en-PK")}`} sub="Doodh settings ke rate par" />
        <Card>
          <Text style={{ fontWeight: "700", marginBottom: 8, color: colors.text }}>Is hafte ka hisaab</Text>
          <Field label="Litre" value={String(data?.statement?.milkLiters ?? 0)} />
          <Field label="Raqam" value={`Rs ${Number(data?.statement?.milkAmount ?? 0).toLocaleString("en-PK")}`} />
          <Field label="Hafta" value={`${data?.statement?.start ?? "—"} → ${data?.statement?.end ?? "—"}`} />
        </Card>
        {page.items.map((row: any) => (
          <Card key={row.id}>
            <Field label="Kis ne uthaya" value={row.collector || "—"} />
            <Field label="Litre" value={String(row.liters)} />
            <Field label="Fat / SNF" value={`${row.fat ?? "—"} / ${row.snf ?? "—"}`} />
            <Field label="Rate / Raqam" value={`${row.rate ?? "—"} / ${row.amount ?? "—"}`} />
          </Card>
        ))}
      </ScrollView>
    );
  }
  return (
    <ScrollView style={{ padding: 16 }}>
      <GoldCard title="Wallet" value={owed == null ? "Track nahi hui" : `Rs ${Number(owed).toLocaleString("en-PK")}`} sub="Baqaya" />
      <Card>
        <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 8 }}>Doodh ki ittila</Text>
        {page.items.length === 0 ? <Text style={{ color: colors.muted }}>Abhi koi collection nahi.</Text> : null}
        {page.items.slice(0, 3).map((row: any) => (
          <Text key={row.id} style={{ color: colors.text, marginBottom: 6 }}>
            {row.collector || "Collector"} · {row.liters} L · Fat {row.fat ?? "—"} · SNF {row.snf ?? "—"} · Rs {row.amount ?? "—"}
          </Text>
        ))}
      </Card>
    </ScrollView>
  );
}
