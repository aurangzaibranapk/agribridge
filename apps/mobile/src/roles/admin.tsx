import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { loadAdminHome, loadAttendance, loadMilkList, loadPurchases, rupees, searchParties, stockAlerts, type AdminHome, type LiveAuth, type ProductRow, type InventoryRow } from "../../../../src/lib/mobile/live-read";
import { liveGet } from "../../../../src/lib/mobile/live-read";
import { Empty, Kpi, SaleChart, Section, ShareBar, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";

type Panel = "home" | "parties" | "stock" | "milk" | "purchases" | "attendance";

export function RoleScreen({ tab, live }: { tab: string; live?: LiveBag }) {
  const auth = liveAuth(live);
  const [home, setHome] = useState<AdminHome | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [panel, setPanel] = useState<Panel>("home");

  const load = useCallback(async () => {
    if (!auth) { setError("Live Supabase is build mein set nahi. Login ke baad hisaab yahin aata hai."); return; }
    setError("");
    setHome(await loadAdminHome(auth, fetch));
  }, [auth?.token, auth?.url, auth?.testAccount]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { if (tab === "approvals" || tab === "reports" || tab === "home") setPanel("home"); }, [tab]);

  if (!home && !error) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  return (
    <ScrollView
      style={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}
    >
      {panel !== "home" && auth ? <ListPanel panel={panel} auth={auth} day={home?.today ?? ""} onBack={() => setPanel("home")} /> : null}
      {panel === "home" ? <Dashboard tab={tab} home={home} error={error} onOpen={setPanel} /> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Dashboard({ tab, home, error, onOpen }: { tab: string; home: AdminHome | null; error: string; onOpen: (panel: Panel) => void }) {
  if (error) return <Section title="Admin"><Empty title="Hisaab nahi khula" body={error} /></Section>;
  if (!home) return null;
  if (tab === "approvals") {
    return (
      <Section title="Pending approvals" sub="Jo kaam manzoori ka intezar kar raha hai">
        {home.pendingNote ? <Empty title="Approvals nahi khulin" body={home.pendingNote} /> : null}
        {!home.pendingNote && home.pending.length === 0 ? <Empty title="Koi pending approval nahi" body="Jab koi darkhwast, kharcha, ya doodh ki tasdeeq ruke gi, wo yahan ginati mein aayegi." /> : null}
        {home.pending.map((row) => <Row key={row.label} title={row.label} value={String(row.count)} />)}
      </Section>
    );
  }
  return (
    <View>
      {home.banner ? (
        <View style={{ backgroundColor: "#F4E4C4", borderRadius: 12, padding: 10, marginBottom: 8 }}>
          <Text style={{ fontWeight: "800", color: "#7A4E00" }}>TEST</Text>
          <Text style={{ color: "#3d2e10", marginTop: 4 }}>{home.banner}</Text>
        </View>
      ) : null}
      <Text style={{ color: colors.muted, marginBottom: 8 }}>Aaj · {home.today} · {home.banner ? "TEST hisaab" : "live hisaab"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi label="Aaj ki sale" value={home.sales.state === "ok" ? rupees(home.sales.total) : "—"} sub={home.sales.state === "ok" ? `${home.sales.bills} bill${home.sales.partial ? " · adhoori" : ""}` : "nahi khuli"} />
        <Kpi label="Cash" value={home.cash.state === "ok" ? rupees(home.cash.cash) : "—"} sub={home.cash.state === "ok" ? `${home.cash.accounts} accounts` : home.cash.state === "empty" ? "koi account nahi" : "ijazat"} />
        <Kpi label="Bank" value={home.cash.state === "ok" ? rupees(home.cash.bank) : "—"} sub={home.cash.state === "ok" ? `Wallet ${rupees(home.cash.wallet)}` : ""} />
        <Kpi label="Doodh subah" value={home.milk.state === "ok" ? `${Math.round(home.milk.subah)} L` : "—"} sub={home.milk.state === "ok" ? `Shaam ${Math.round(home.milk.shaam)} L` : "nahi khula"} />
      </View>
      {home.sales.state === "error" ? <Section title="Sale"><Empty title="Aaj ki sale nahi dikhi" body={home.sales.message} /></Section> : null}
      {home.sales.state === "ok" && home.sales.bills === 0 ? <Section title="Aaj ki sale"><Empty title="Aaj abhi koi bill nahi" body="Jab dukan par bill katega, raqam aur 7 din ka chart yahin barh jayega. Rs 0 is liye hai ke bills parh liye gaye aur koi nahi mila." /></Section> : null}
      {home.cash.state === "error" ? <Section title="Cash / Bank"><Empty title="Balance nahi dikha" body={home.cash.message} /></Section> : null}
      {home.cash.state === "empty" ? <Section title="Cash / Bank"><Empty title={home.banner ? "Asal cash nahi" : "Koi account nazar nahi aaya"} body={home.banner ? "TEST account ko asal cash aur bank nahi dikhaya jata. Khali ko Rs 0 nahi likha." : "Cash ya bank ka balance tab dikhega jab finance accounts is login ko nazar aayen. Khali fehrist ko Rs 0 nahi likha."} /></Section> : null}
      {home.milk.state === "error" ? <Section title="Doodh"><Empty title="Aaj ka doodh nahi dikha" body={home.milk.message} /></Section> : null}
      {home.milk.state === "ok" && home.milk.subah === 0 && home.milk.shaam === 0 ? <Section title="Doodh"><Empty title="Aaj koi litre darj nahi" body="Entries parh li gayin. Subah ya shaam ka litre jab darj hoga, yahan aayega." /></Section> : null}
      {tab !== "reports" ? null : <Text style={{ color: colors.muted, marginBottom: 8 }}>Reports · charts neeche bhi hain</Text>}
      <Section title="7 din ki sale" sub="Har din ka bill, Karachi ki tareekh">
        {home.days.length === 0 ? <Empty title="Chart nahi bana" body={home.sales.state === "error" ? home.sales.message : "Sale ki qatarein nahi milin."} /> : <SaleChart points={home.days} />}
      </Section>
      <Section title="Qism" sub={home.categoryScope === "today" ? "Aaj ki sale" : home.categoryScope === "week" ? "Aaj khaali hai, pichle 7 din" : "Category"}>
        {home.categories.length === 0 ? <Empty title="Qism ka hisaab nahi" body="Jab sale ki lines nazar aayengi, fertilizer, feed, ya doosri qism yahan dikhegi." /> : <ShareBar parts={home.categories} />}
      </Section>
      <Section title="Stock alerts" sub="Hadd se kam maal">
        {home.alertsNote ? <Empty title="Stock poora nahi dikha" body={home.alertsNote} /> : null}
        {!home.alertsNote && home.alerts.length === 0 ? <Empty title="Koi stock alert nahi" body="Jis product ki kam se kam hadd lagi hai aur maal us se kam hai, wo yahan aayega." /> : null}
        {home.alerts.map((row) => <Row key={row.name} title={row.name} value={`${row.qty} / ${row.min}`} />)}
      </Section>
      {tab === "approvals" ? null : (
        <Section title="Pending approvals">
          {home.pendingNote ? <Empty title="Approvals nahi khulin" body={home.pendingNote} /> : null}
          {!home.pendingNote && home.pending.length === 0 ? <Empty title="Koi pending nahi" body="Manzoori ka intezar hone par ginati yahan aayegi." /> : null}
          {home.pending.map((row) => <Row key={row.label} title={row.label} value={String(row.count)} />)}
        </Section>
      )}
      <Section title="Haal ki activity">
        {home.activityNote ? <Empty title="Activity nahi khuli" body={home.activityNote} /> : null}
        {!home.activityNote && home.activity.length === 0 ? <Empty title="Activity nazar nahi aayi" body="Jab is login ko activity ki line nazar aayegi, wo yahan aayegi. Khali fehrist ko 'kuch hua hi nahi' nahi samjhein." /> : null}
        {home.activity.map((row, index) => <Text key={`${row.at}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.action} · {row.at ? row.at.slice(0, 16).replace("T", " ") : ""}</Text>)}
      </Section>
      <Section title="Modules" sub="Sirf parhna">
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          <Link label="Parties / khata" onPress={() => onOpen("parties")} />
          <Link label="Products / stock" onPress={() => onOpen("stock")} />
          <Link label="Milk" onPress={() => onOpen("milk")} />
          <Link label="Purchases" onPress={() => onOpen("purchases")} />
          <Link label="Hazri" onPress={() => onOpen("attendance")} />
        </View>
      </Section>
    </View>
  );
}

function Link({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ width: "48%", backgroundColor: colors.green, borderRadius: 12, padding: 12, marginBottom: 8 }}>
      <Text style={{ color: "#fff", fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
}

function Row({ title, value }: { title: string; value: string }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.line }}>
      <Text style={{ color: colors.text, flex: 1, paddingRight: 8 }}>{title}</Text>
      <Text style={{ color: colors.greenDark, fontWeight: "700" }}>{value}</Text>
    </View>
  );
}

function ListPanel({ panel, auth, day, onBack }: { panel: Panel; auth: LiveAuth; day: string; onBack: () => void }) {
  const [query, setQuery] = useState("");
  const [body, setBody] = useState<ReactNode>(<ActivityIndicator color={colors.green} />);
  const run = useCallback(async (term: string) => {
    if (panel === "parties") {
      const found = await searchParties(auth, term, fetch);
      setBody(
        <View>
          <PartyBlock title="Kisaan" result={found.farmers} name={(row) => row.full_name || "Kisan"} extra={() => ""} />
          <PartyBlock title="Customer" result={found.customers} name={(row) => row.name || "Customer"} extra={(row) => row.current_balance == null ? "" : rupees(Number(row.current_balance))} />
        </View>
      );
      return;
    }
    if (panel === "stock") {
      if (auth.testAccount) {
        setBody(<Empty title="TEST stock nahi" body="Asal products aur quantity yahan nahi aate, taake dukan ki fehrist na badle." />);
        return;
      }
      const [products, inventory] = await Promise.all([
        liveGet<ProductRow>(auth, "products?select=id,name,min_stock_threshold,unit&is_deleted=eq.false&order=name.asc&limit=40", fetch),
        liveGet<InventoryRow>(auth, "inventory?select=product_id,quantity_on_hand&limit=2000", fetch),
      ]);
      if (!products.ok) { setBody(<Empty title="Products nahi khule" body={products.message} />); return; }
      const alerts = inventory.ok ? stockAlerts(products.rows, inventory.rows) : [];
      setBody(
        <View>
          {!inventory.ok ? <Empty title="Stock qty nahi dikhi" body={inventory.message} /> : null}
          {products.rows.length === 0 ? <Empty title="Koi product nahi" body="Jo product darj hoga aur is login ko nazar aayega, wo yahan aayega." /> : null}
          {alerts.map((row) => <Row key={`a-${row.name}`} title={`${row.name} · alert`} value={`${row.qty}`} />)}
          {products.rows.map((row) => <Row key={row.id} title={row.name || "Product"} value={row.unit || ""} />)}
        </View>
      );
      return;
    }
    if (panel === "milk") {
      const rows = await loadMilkList(auth, fetch);
      setBody(!rows.ok ? <Empty title="Doodh ki fehrist nahi khuli" body={rows.message} /> : rows.rows.length === 0 ? <Empty title="Koi collection nahi" body="Farmer ki entry jab darj hogi, tareekh, shift, litre aur fat yahan aayenge." /> : (
        <View>{rows.rows.map((row, index) => <Row key={`${row.entry_date}-${index}`} title={`${row.entry_date} · ${row.shift === "evening" ? "Shaam" : "Subah"} · ${row.route_name || ""}`} value={`${row.quantity_liters ?? "—"} L`} />)}</View>
      ));
      return;
    }
    if (panel === "purchases") {
      if (auth.testAccount) {
        setBody(<Empty title="TEST khareed nahi" body="Asal supplier bills is account ko nahi dikhti. Koi nayi khareed nahi banti." />);
        return;
      }
      const rows = await loadPurchases(auth, fetch);
      setBody(!rows.ok ? <Empty title="Purchases nahi khulin" body={rows.message} /> : rows.rows.length === 0 ? <Empty title="Koi khareed nahi" body="Supplier ki bill jab darj hogi, number, tareekh aur raqam yahan aayenge." /> : (
        <View>{rows.rows.map((row, index) => <Row key={`${row.purchase_number}-${index}`} title={`${row.purchase_number || row.supplier_bill_no || "Bill"} · ${row.purchase_date || ""}`} value={row.total_amount == null ? "—" : rupees(Number(row.total_amount))} />)}</View>
      ));
      return;
    }
    const attendance = await loadAttendance(auth, day, fetch);
    setBody(!attendance.rows.ok ? <Empty title="Hazri nahi khuli" body={attendance.rows.message} /> : attendance.rows.rows.length === 0 ? <Empty title="Aaj koi hazri nahi" body="Staff ka check-in jab darj hoga, naam aur status yahan aayega." /> : (
      <View>{attendance.rows.rows.map((row, index) => <Row key={`${row.profile_id}-${index}`} title={attendance.names.get(row.profile_id || "") || "Staff"} value={String(row.status || "—")} />)}</View>
    ));
  }, [panel, auth, day]);

  useEffect(() => { void run(""); }, [run]);

  return (
    <Section title={panel} sub="Sirf parhna">
      <Pressable onPress={onBack}><Text style={{ color: colors.green, fontWeight: "700", marginBottom: 8 }}>Wapas</Text></Pressable>
      {panel === "parties" ? (
        <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void run(query)} placeholder="Naam likh kar enter" style={{ backgroundColor: "#F3F6F1", borderRadius: 10, padding: 10, marginBottom: 8 }} />
      ) : null}
      {body}
    </Section>
  );
}

function PartyBlock({ title, result, name, extra }: { title: string; result: { ok: true; rows: { id?: string; full_name?: string | null; name?: string | null; current_balance?: number | string | null }[] } | { ok: false; message: string }; name: (row: { full_name?: string | null; name?: string | null }) => string; extra: (row: { current_balance?: number | string | null }) => string }) {
  if (!result.ok) return <Empty title={`${title} nahi khule`} body={result.message} />;
  if (result.rows.length === 0) return <Empty title={`Koi ${title} nahi`} body="Naam likh kar talash karein, ya fehrist khali hai." />;
  return (
    <View style={{ marginBottom: 8 }}>
      <Text style={{ fontWeight: "700", color: colors.text, marginBottom: 4 }}>{title}</Text>
      {result.rows.map((row) => <Row key={row.id} title={name(row)} value={extra(row)} />)}
    </View>
  );
}
