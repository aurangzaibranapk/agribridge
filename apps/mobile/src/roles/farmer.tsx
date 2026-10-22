import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { loadCatalog, loadKhata, loadMilkList, loadOrders, milkByShift, rupees, salesByDay, type CatalogRow, type KhataView, type MilkRow, type OrderRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, SaleChart, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";

export function RoleScreen({ tab, live }: { tab: string; live?: LiveBag }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [milk, setMilk] = useState<ReadResult<MilkRow> | null>(null);
  const [orders, setOrders] = useState<ReadResult<OrderRow> | null>(null);
  const [shop, setShop] = useState<ReadResult<CatalogRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextMilk, nextOrders, nextShop] = await Promise.all([
      loadKhata(auth, fetch),
      loadMilkList(auth, fetch),
      loadOrders(auth, fetch),
      loadCatalog(auth, fetch),
    ]);
    setKhata(nextKhata);
    setMilk(nextMilk);
    setOrders(nextOrders);
    setShop(nextShop);
  }, [auth?.token, auth?.url]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Kisan"><Empty title="Login chahiye" body="Wallet aur doodh live account se aate hain. Is build mein Supabase key set nahi." /></Section></ScrollView>;
  if (!khata || !milk || !orders || !shop) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  const milkRows = milk.ok ? milk.rows : [];
  const latest = milkRows[0];
  const byDay = new Map<string, number>();
  for (const row of milkRows) {
    const day = String(row.entry_date || "");
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + Number(row.quantity_liters || 0));
  }
  const days = [...byDay.keys()].sort().slice(-7);
  const chart = salesByDay(days.map((day) => ({ created_at: day, total_amount: byDay.get(day) ?? 0, status: "ok" })), days);
  const shifts = milkByShift(milkRows.filter((row) => row.entry_date === latest?.entry_date));

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {tab === "shop" ? <Catalog result={shop} /> : null}
      {tab === "orders" ? <Orders result={orders} /> : null}
      {tab === "khata" || tab === "home" ? (
        <View>
          <View style={{ backgroundColor: colors.gold, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: "#3d2e10", fontWeight: "700" }}>Mera khata</Text>
            <Text style={{ color: "#1c1408", fontSize: 28, fontWeight: "800", marginTop: 4 }}>{khata.note && khata.owed == null ? "—" : rupees(khata.owed)}</Text>
            <Text style={{ color: "#3d2e10", marginTop: 4 }}>{khata.note || "Baqaya, aap ki apni lines se"}</Text>
          </View>
          {tab === "home" ? (
            <Section title="Doodh ki ittila" sub="Aakhri collection">
              {!milk.ok ? <Empty title="Doodh nahi dikha" body={milk.message} /> : null}
              {milk.ok && !latest ? <Empty title="Abhi koi collection nahi" body="Jab doodh uthaya jayega, litre, fat aur raqam is card par aayenge." /> : null}
              {latest ? (
                <View>
                  <Text style={{ color: colors.text, fontSize: 16, fontWeight: "700" }}>{latest.entry_date} · {latest.shift === "evening" ? "Shaam" : "Subah"} · {latest.quantity_liters} L</Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>Fat {latest.fat_percentage ?? "—"} · Rs {latest.total_amount ?? "—"} · {latest.route_name || "route"}</Text>
                  <Text style={{ color: colors.muted, marginTop: 4 }}>Us din subah {Math.round(shifts.subah)} L · shaam {Math.round(shifts.shaam)} L</Text>
                </View>
              ) : null}
            </Section>
          ) : null}
          {tab === "home" ? (
            <Section title="Doodh ka chart" sub="Aakhri din, litre">
              {chart.length === 0 ? <Empty title="Chart khali hai" body="Jab kai din ki collection aa jayegi, yahan unka chart banega." /> : <SaleChart points={chart} />}
            </Section>
          ) : null}
          <Section title="Khata ki lines" sub="Pichle 90 din">
            {khata.linesNote ? <Empty title="Lines nahi khulin" body={khata.linesNote} /> : null}
            {!khata.linesNote && khata.lines.length === 0 ? <Empty title="Koi line nahi" body="Udhaar ya adaigi jab darj hogi, tareekh aur raqam yahan aayenge." /> : null}
            {khata.lines.map((line, index) => (
              <Text key={`${line.entry_date}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>
                {line.entry_date} · {line.tafseel || line.category || "Line"} · {line.udhaar ? `udhaar ${line.udhaar}` : ""} {line.adaigi ? `adaigi ${line.adaigi}` : ""} · baqaya {line.baqaya ?? "—"}
              </Text>
            ))}
          </Section>
          {tab === "home" ? <Orders result={orders} /> : null}
        </View>
      ) : null}
      {tab === "more" ? <Section title="Aur"><Empty title="Support upar hai" body="Masla batayein sirf test build par hai. Baqi kaam Home, Shop, Orders aur Khata par hai." /></Section> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Orders({ result }: { result: ReadResult<OrderRow> }) {
  return (
    <Section title="Orders" sub="Dukaan ke orders">
      {!result.ok ? <Empty title="Orders nahi khule" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi order nahi" body="Jab aap dukan se order denge, number, status aur raqam yahan aayenge." /> : null}
      {result.ok ? result.rows.map((row, index) => (
        <Text key={`${row.order_number}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.order_number || "Order"} · {row.status} · {row.grand_total == null ? "—" : rupees(Number(row.grand_total))}</Text>
      )) : null}
    </Section>
  );
}

function Catalog({ result }: { result: ReadResult<CatalogRow> }) {
  return (
    <Section title="Dukaan" sub="Sirf dekhna, khareed is screen se nahi">
      {!result.ok ? <Empty title="Catalog nahi khula" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi product nahi" body="Jo maal dukan par available hoga, naam aur rate yahan aayenge." /> : null}
      {result.ok ? result.rows.map((row) => (
        <Text key={row.id} style={{ color: colors.text, marginBottom: 6 }}>{row.name} · {row.selling_price == null ? "—" : rupees(Number(row.selling_price))} {row.unit ? `/ ${row.unit}` : ""}</Text>
      )) : null}
    </Section>
  );
}
