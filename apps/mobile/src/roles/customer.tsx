import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { loadCatalog, loadKhata, loadOrders, rupees, type CatalogRow, type KhataView, type OrderRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";

export function RoleScreen({ tab, live }: { tab: string; live?: LiveBag }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [orders, setOrders] = useState<ReadResult<OrderRow> | null>(null);
  const [shop, setShop] = useState<ReadResult<CatalogRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextOrders, nextShop] = await Promise.all([loadKhata(auth, fetch), loadOrders(auth, fetch), loadCatalog(auth, fetch)]);
    setKhata(nextKhata);
    setOrders(nextOrders);
    setShop(nextShop);
  }, [auth?.token, auth?.url]);
  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Customer"><Empty title="Login chahiye" body="Khata aur dukaan live account se aate hain." /></Section></ScrollView>;
  if (!khata || !orders || !shop) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {tab === "shop" ? <Shop result={shop} /> : null}
      {tab === "orders" ? <Orders result={orders} /> : null}
      {tab === "home" || tab === "khata" ? (
        <View>
          <View style={{ backgroundColor: colors.green, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: "#E7F2E4", fontWeight: "700" }}>Khata</Text>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 4 }}>{khata.note && khata.owed == null ? "—" : rupees(khata.owed)}</Text>
            <Text style={{ color: "#E7F2E4", marginTop: 4 }}>{khata.note || "Aapka baqaya"}</Text>
          </View>
          <Section title="Lines">
            {khata.linesNote ? <Empty title="Lines nahi khulin" body={khata.linesNote} /> : null}
            {!khata.linesNote && khata.lines.length === 0 ? <Empty title="Koi line nahi" body="Bill ya adaigi jab darj hogi, wo yahan aayegi." /> : null}
            {khata.lines.map((line, index) => <Text key={`${line.entry_date}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{line.entry_date} · {line.tafseel || line.category || "Line"} · {line.baqaya ?? "—"}</Text>)}
          </Section>
          {tab === "home" ? <Orders result={orders} /> : null}
        </View>
      ) : null}
      {tab === "more" ? <Section title="Aur"><Empty title="Sirf dekhna" body="Dukaan se yahan order nahi banta. Home, Shop, Orders aur Khata par apna hisaab hai." /></Section> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Orders({ result }: { result: ReadResult<OrderRow> }) {
  return (
    <Section title="Orders">
      {!result.ok ? <Empty title="Orders nahi khule" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi order nahi" body="Aapka order jab banega, number aur status yahan aayenge." /> : null}
      {result.ok ? result.rows.map((row, index) => <Text key={`${row.order_number}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.order_number || "Order"} · {row.status} · {row.grand_total == null ? "—" : rupees(Number(row.grand_total))}</Text>) : null}
    </Section>
  );
}

function Shop({ result }: { result: ReadResult<CatalogRow> }) {
  return (
    <Section title="Dukaan" sub="Browse only">
      {!result.ok ? <Empty title="Catalog nahi khula" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi maal nahi" body="Available products yahan naam aur rate ke sath aayenge. Is screen se khareed nahi hoti." /> : null}
      {result.ok ? result.rows.map((row) => <Text key={row.id} style={{ color: colors.text, marginBottom: 6 }}>{row.name} · {row.selling_price == null ? "—" : rupees(Number(row.selling_price))}</Text>) : null}
    </Section>
  );
}
