import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { karachiDate, liveGetScoped, liveInsert, loadCatalog, loadKhata, loadOrders, rupees, type CatalogRow, type KhataView, type OrderRow, type PartyRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { CustomerGlass } from "./glass-homes";
import { Btn, colors } from "../kit";

const STEPS = ["draft", "submitted", "approved", "delivered"];

export function RoleScreen({ tab, live, readOnly = false, onProfile, onTab }: { tab: string; live?: LiveBag; readOnly?: boolean; onProfile?: () => void; onTab?: (key: string) => void }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [orders, setOrders] = useState<ReadResult<OrderRow> | null>(null);
  const [shop, setShop] = useState<ReadResult<CatalogRow> | null>(null);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextOrders, nextShop] = await Promise.all([
      loadKhata(auth, fetch),
      loadOrders(auth, fetch),
      auth.testAccount ? Promise.resolve({ ok: true as const, rows: [] as CatalogRow[] }) : loadCatalog(auth, fetch),
    ]);
    setKhata(nextKhata);
    setOrders(nextOrders);
    setShop(nextShop);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);
  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Customer"><Empty title="Login chahiye" body="Khata aur dukaan account se aate hain." /></Section></ScrollView>;
  if (!khata || !orders || !shop) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  async function placeOrder() {
    if (!auth || readOnly) return;
    const total = Number(amount);
    if (!(total > 0)) { setNote("Raqam sahi likhein."); return; }
    const customers = await liveGetScoped<PartyRow>(auth, "customers?select=id,name&order=name.asc&limit=1", fetch);
    const customer = customers.ok ? customers.rows[0] : null;
    setBusy(true);
    const saved = await liveInsert<OrderRow>(auth, "agri_orders", {
      order_number: `TEST-C${Date.now()}`,
      order_type: "Animal Feed",
      order_to_type: "Farmer",
      partner_name: customer?.name || "TEST Customer",
      customer_id: customer?.id ?? null,
      party_link_state: customer?.id ? "linked" : "unlinked_unknown",
      status: "draft",
      grand_total: total,
      notes: "App karyana",
      requested_by: auth.userId,
      is_test: auth.testAccount === true,
    }, fetch);
    setBusy(false);
    if (!saved.ok) {
      const denied = saved.status === 401 || saved.status === 403 || /42501|row-level security/i.test(saved.detail || "");
      setNote(denied ? "Order nahi bana. Testing par 702_app_test_phase_c.sql lagani hai." : saved.message);
      return;
    }
    setAmount("");
    setNote("Draft order ban gaya. Orders par status dikhega.");
    await load();
  }

  if (tab === "home" || tab === "orders") {
    return <CustomerGlass focus={tab === "orders" ? "track" : "home"} live={live} khata={khata} orders={orders} onProfile={onProfile} onTab={onTab} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />;
  }

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {tab === "shop" ? (
        <View>
          <Shop result={shop} testAccount={live?.testAccount === true} />
          {auth.testAccount ? (
            <Section title="Karyana order" sub="Draft. Khud ki darkhwast khud manzoor nahi hoti.">
              {note ? <Text style={{ color: colors.greenDark, marginBottom: 6 }}>{note}</Text> : null}
              {readOnly ? <Text style={{ color: colors.muted }}>Sirf dekhna. Order band hai.</Text> : (
                <View>
                  <TextInput value={amount} onChangeText={setAmount} placeholder="Raqam" keyboardType="decimal-pad" style={input} />
                  <Btn label={busy ? "Ban raha hai" : "Order bhejein"} onPress={() => { if (!busy) void placeOrder(); }} />
                </View>
              )}
            </Section>
          ) : null}
        </View>
      ) : null}
      {tab === "orders" ? <Orders result={orders} /> : null}
      {tab === "khata" || tab === "home" ? (
        <Section title="Haal ka len-den" sub="Khata">
          {khata.linesNote ? <Empty title="Lines nahi khulin" body={khata.linesNote} /> : null}
          {!khata.linesNote && khata.lines.length === 0 ? <Empty title="Koi line nahi" body="Bill ya adaigi jab darj hogi, wo yahan aayegi. Track na ho to dash rehta hai." /> : null}
          {khata.lines.map((line, index) => <Text key={`${line.entry_date}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{line.entry_date} · {line.tafseel || line.category || "Line"} · baqaya {line.baqaya ?? "—"}</Text>)}
        </Section>
      ) : null}
      {tab === "more" ? <Section title="Aur"><Empty title="Profile upar hai" body="Dukaan, orders aur khata neeche ke tabs par hain." /></Section> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Orders({ result }: { result: ReadResult<OrderRow> }) {
  return (
    <Section title="Order tracking" sub="Status">
      {!result.ok ? <Empty title="Orders nahi khule" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi order nahi" body="Karyana order jab banega, number aur status yahan aayenge." /> : null}
      {result.ok ? result.rows.map((row, index) => (
        <View key={`${row.order_number}-${index}`} style={{ marginBottom: 10 }}>
          <Text style={{ color: colors.text, fontWeight: "700" }}>{row.order_number || "Order"} · {row.grand_total == null ? "—" : rupees(Number(row.grand_total))}</Text>
          <Text style={{ color: colors.muted, marginTop: 2 }}>{STEPS.map((step) => step === row.status ? `● ${step}` : step).join("  ")}</Text>
        </View>
      )) : null}
    </Section>
  );
}

function Shop({ result, testAccount = false }: { result: ReadResult<CatalogRow>; testAccount?: boolean }) {
  if (testAccount) {
    return (
      <Section title="Karyana" sub="Asal dukaan ki fehrist nahi">
        <Empty title="TEST karyana" body={`Asal products nahi dikhte. Neeche draft order testing par likhta hai. Aaj ${karachiDate()}.`} />
      </Section>
    );
  }
  return (
    <Section title="Karyana" sub="Sirf dekhna">
      {!result.ok ? <Empty title="Catalog nahi khula" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi maal nahi" body="Available products yahan naam aur rate ke sath aayenge." /> : null}
      {result.ok ? result.rows.map((row) => <Text key={row.id} style={{ color: colors.text, marginBottom: 6 }}>{row.name} · {row.selling_price == null ? "—" : rupees(Number(row.selling_price))}</Text>) : null}
    </Section>
  );
}

const input = { borderWidth: 1, borderColor: "#E2E8E0", borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#fff" };
