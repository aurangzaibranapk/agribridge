import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { loadKhata, loadOrders, rupees, type KhataView, type OrderRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";

export function RoleScreen({ tab, live }: { tab: string; live?: LiveBag }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [orders, setOrders] = useState<ReadResult<OrderRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextOrders] = await Promise.all([loadKhata(auth, fetch), loadOrders(auth, fetch)]);
    setKhata(nextKhata);
    setOrders(nextOrders);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);
  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Dealer"><Empty title="Login chahiye" body="Outlet ka khata login ke baad khulta hai." /></Section></ScrollView>;
  if (!khata || !orders) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  const owed = khata.note && khata.owed == null ? "—" : rupees(khata.owed);

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {tab === "home" ? (
        <View style={{ backgroundColor: "#0F4E28", borderRadius: 22, padding: 18, marginBottom: 12 }}>
          <Text style={{ color: "#C8A058", fontWeight: "700" }}>Dealer / Outlet</Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 }}>{owed}</Text>
          <Text style={{ color: "#D7E6D4", marginTop: 4 }}>{khata.note || "HQ khata"}</Text>
        </View>
      ) : null}
      {tab === "home" || tab === "orders" ? (
        <Section title="Orders" sub="Status">
          {!orders.ok ? <Empty title="Orders nahi khule" body={orders.message} /> : null}
          {orders.ok && orders.rows.length === 0 ? <Empty title="Koi order nahi" body="HQ ka order jab hoga, number aur status yahan aayenge." /> : null}
          {orders.ok ? orders.rows.map((row, index) => <Text key={`${row.order_number}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.order_number || "Order"} · {row.status} · {row.grand_total == null ? "—" : rupees(Number(row.grand_total))}</Text>) : null}
        </Section>
      ) : null}
      {tab === "home" || tab === "khata" ? (
        <Section title="HQ khata" sub="Apni lines">
          {khata.linesNote ? <Empty title="Lines nahi khulin" body={khata.linesNote} /> : null}
          {!khata.linesNote && khata.lines.length === 0 ? <Empty title="Koi line nahi" body="Udhaar ya adaigi jab darj hogi, yahan aayegi. Track na ho to dash." /> : null}
          {khata.lines.map((line, index) => <Text key={`${line.entry_date}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{line.entry_date} · {line.tafseel || "Line"} · {line.baqaya ?? "—"}</Text>)}
        </Section>
      ) : null}
      {tab === "more" ? <Section title="Aur"><Empty title="Profile upar hai" body="Orders aur HQ khata apne tabs par hain." /></Section> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}
