import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { karachiDate, karachiDaySeries, livePatch, loadAdminHome, loadAttendance, loadMilkList, loadOrders, loadPurchases, milkByShift, milkInRange, milkLitres, pricedMilkTotal, rupees, salesByDay, searchParties, shiftLabel, stockAlerts, type AdminHome, type LiveAuth, type MilkRow, type OrderRow, type ProductRow, type InventoryRow } from "../../../../src/lib/mobile/live-read";
import { liveGet } from "../../../../src/lib/mobile/live-read";
import { fatActorError } from "../../../../src/lib/mobile/outbox";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { Empty, Kpi, SaleChart, Section, ShareBar, liveAuth, type LiveBag } from "../bits";
import { AdminGlass } from "./glass-homes";
import { Btn, colors } from "../kit";
import { loadAdminDigitalOverview, type AdminDigitalOverview } from "../../../../src/lib/mobile/digital-munshi";
import { AdminWorkspace, type AdminPanel } from "./admin-workspace";
import { InternalHr } from "./internal-hr";

type Panel = "home" | "parties" | "stock" | "milk" | "purchases" | "attendance";

export function RoleScreen({ tab, live, readOnly = false, onProfile, onTab }: { tab: string; live?: LiveBag; readOnly?: boolean; onProfile?: () => void; onTab?: (key: string) => void }) {
  const auth = liveAuth(live);
  const [home, setHome] = useState<AdminHome | null>(null);
  const [milk, setMilk] = useState<MilkRow[]>([]);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [panel, setPanel] = useState<Panel>("home");
  const [note, setNote] = useState("");
  const [verifyBusy, setVerifyBusy] = useState("");
  const [digital, setDigital] = useState<AdminDigitalOverview | null>(null);
  const [workspace, setWorkspace] = useState<AdminPanel>("menu");

  const load = useCallback(async () => {
    if (!auth) { setError("Live Supabase is build mein set nahi. Login ke baad hisaab yahin aata hai."); return; }
    setError("");
    const [nextHome, nextMilk, nextOrders, nextDigital] = await Promise.all([
      loadAdminHome(auth, fetch),
      loadMilkList(auth, fetch, 120),
      loadOrders(auth, fetch),
      loadAdminDigitalOverview(auth, fetch),
    ]);
    setHome(nextHome);
    setMilk(nextMilk.ok ? nextMilk.rows : []);
    setOrders(nextOrders.ok ? nextOrders.rows : []);
    setDigital(nextDigital);
    if (!nextMilk.ok) setNote(nextMilk.message);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);

  async function verifyHero(row: MilkRow) {
    if (!auth || !row.id || readOnly) return;
    const self = !auth.testAccount ? fatActorError(auth.userId || "", row) : null;
    if (self) { setNote(self); return; }
    setVerifyBusy(row.id);
    const saved = await livePatch<MilkRow>(auth, "milk_entries", row.id, {
      status: "verified",
      verified_by_profile_id: auth.userId,
      verified_comment: "TEST tasdeeq",
      verified_at: new Date().toISOString(),
    }, fetch);
    setVerifyBusy("");
    if (!saved.ok) {
      const denied = saved.status === 401 || saved.status === 403 || /42501|row-level security/i.test(saved.detail || "");
      setNote(denied ? "Tasdeeq nahi hui. Testing par 701_app_test_mco_admin.sql lagani hai." : saved.message);
      return;
    }
    setNote("Tasdeeq ho gayi. Entry verified hai.");
    await load();
  }
  useEffect(() => { if (tab === "approvals" || tab === "reports" || tab === "home") setPanel("home"); }, [tab]);

  useEffect(() => { if (tab !== "work") setWorkspace("menu"); }, [tab]);

  if (!home && !error) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  if (tab === "work") {
    return <AdminWorkspace panel={workspace} auth={auth} home={home} milk={milk} digital={digital} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} onOpen={setWorkspace} onProfile={onProfile} />;
  }
  if (tab === "hr" && auth?.userId) return <InternalHr auth={auth} userId={auth.userId} readOnly={readOnly} />;
  if (tab === "profile") return <AdminWorkspace panel="settings" auth={auth} home={home} milk={milk} digital={digital} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} onOpen={setWorkspace} onProfile={onProfile} />;
  if (tab === "reports" && home) {
    return <AdminReports home={home} milk={milk} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} />;
  }
  if ((tab === "home" || tab === "approvals") && panel === "home") {
    return (
      <AdminGlass
        focus={tab === "approvals" ? "track" : "home"}
        live={live}
        home={home}
        milk={milk}
        orders={orders}
        digital={digital}
        onProfile={onProfile}
        onTab={onTab}
        onModule={(next) => { setWorkspace(next); onTab?.("work"); }}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
        onVerify={hero => { if (!verifyBusy) void verifyHero(hero); }}
        footer={tab === "approvals" && home ? <Approvals home={home} milk={milk} orders={orders} auth={auth} readOnly={readOnly} note={note} onReload={load} /> : null}
      />
    );
  }

  return (
    <ScrollView
      style={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}
    >
      {panel !== "home" && auth ? <ListPanel panel={panel} auth={auth} day={home?.today ?? ""} onBack={() => setPanel("home")} /> : null}
      {panel === "home" ? <Dashboard tab={tab} home={home} error={error} onOpen={setPanel} milk={milk} orders={orders} auth={auth} readOnly={readOnly} note={note} onReload={load} /> : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function Dashboard({ tab, home, error, onOpen, milk, orders, auth, readOnly, note, onReload }: { tab: string; home: AdminHome | null; error: string; onOpen: (panel: Panel) => void; milk: MilkRow[]; orders: OrderRow[]; auth: LiveAuth | null; readOnly: boolean; note: string; onReload: () => Promise<void> }) {
  if (error) return <Section title="Admin"><Empty title="Hisaab nahi khula" body={error} /></Section>;
  if (!home) return null;
  if (tab === "approvals") {
    return <Approvals home={home} milk={milk} orders={orders} auth={auth} readOnly={readOnly} note={note} onReload={onReload} />;
  }
  return (
    <View>
      {home.banner ? (
        <View style={{ backgroundColor: "#F4E4C4", borderRadius: 12, padding: 10, marginBottom: 8 }}>
          <Text style={{ fontWeight: "800", color: "#7A4E00" }}>TEST</Text>
          <Text style={{ color: "#3d2e10", marginTop: 4 }}>{home.banner}</Text>
        </View>
      ) : null}
      <Text style={{ color: colors.muted, marginBottom: 8 }}>Aaj · {home.today} · {auth?.testAccount ? "TEST" : "live hisaab"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi label="Aaj ki sale" value={home.sales.state === "ok" ? rupees(home.sales.total) : "—"} sub={home.sales.state === "ok" ? `${home.sales.bills} bill${home.sales.partial ? " · adhoori" : ""}` : "nahi khuli"} />
        <Kpi label="Cash" value={home.cash.state === "ok" ? rupees(home.cash.cash) : "—"} sub={home.cash.state === "ok" ? `${home.cash.accounts} accounts` : home.cash.state === "empty" ? "koi account nahi" : "ijazat"} />
        <Kpi label="Bank" value={home.cash.state === "ok" ? rupees(home.cash.bank) : "—"} sub={home.cash.state === "ok" ? `Wallet ${rupees(home.cash.wallet)}` : ""} />
        <Kpi label="Doodh subah" value={home.milk.state === "ok" ? `${Math.round(home.milk.subah)} L` : "—"} sub={home.milk.state === "ok" ? `Shaam ${Math.round(home.milk.shaam)} L` : "nahi khula"} />
      </View>
      {home.sales.state === "error" ? <Section title="Sale"><Empty title="Aaj ki sale nahi dikhi" body={home.sales.message} /></Section> : null}
      {home.sales.state === "ok" && home.sales.bills === 0 ? <Section title="Aaj ki sale"><Empty title="Aaj abhi koi bill nahi" body="Jab dukan par bill katega, raqam aur 7 din ka chart yahin barh jayega. Rs 0 is liye hai ke bills parh liye gaye aur koi nahi mila." /></Section> : null}
      {home.cash.state === "error" ? <Section title="Cash / Bank"><Empty title="Balance nahi dikha" body={home.cash.message} /></Section> : null}
      {home.cash.state === "empty" ? <Section title="Cash / Bank"><Empty title="Koi account nazar nahi aaya" body={home.banner ? "TEST cash/bank (is_test) is login ko nahi mila. Khali ko Rs 0 nahi likha." : "Cash ya bank ka balance tab dikhega jab finance accounts is login ko nazar aayen. Khali fehrist ko Rs 0 nahi likha."} /></Section> : null}
      {home.milk.state === "error" ? <Section title="Doodh"><Empty title="Aaj ka doodh nahi dikha" body={home.milk.message} /></Section> : null}
      {home.milk.state === "ok" && home.milk.subah === 0 && home.milk.shaam === 0 ? <Section title="Doodh"><Empty title="Aaj koi litre darj nahi" body="Entries parh li gayin. Subah ya shaam ka litre jab darj hoga, yahan aayega." /></Section> : null}
      {tab === "reports" ? <MilkReports milk={milk} /> : null}
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

function Approvals({ home, milk, orders, auth, readOnly, note, onReload }: { home: AdminHome; milk: MilkRow[]; orders: OrderRow[]; auth: LiveAuth | null; readOnly: boolean; note: string; onReload: () => Promise<void> }) {
  const [local, setLocal] = useState(note);
  const [busy, setBusy] = useState("");
  const [filter, setFilter] = useState<"all" | "milk" | "orders" | "payments" | "stock">("all");
  const priced = milk.filter((row) => row.status === "priced" && row.id);
  const waiting = milk.filter((row) => row.status === "pending_fat");
  async function verify(row: MilkRow) {
    if (!auth || !row.id || readOnly) return;
    const self = !auth.testAccount ? fatActorError(auth.userId || "", row) : null;
    if (self) { setLocal(self); return; }
    setBusy(row.id);
    const saved = await livePatch<MilkRow>(auth, "milk_entries", row.id, {
      status: "verified",
      verified_by_profile_id: auth.userId,
      verified_comment: "TEST tasdeeq",
      verified_at: new Date().toISOString(),
    }, fetch);
    setBusy("");
    if (!saved.ok) {
      const denied = saved.status === 401 || saved.status === 403 || /42501|row-level security/i.test(saved.detail || "");
      setLocal(denied ? "Tasdeeq nahi hui. Testing par 701_app_test_mco_admin.sql lagani hai." : saved.message);
      return;
    }
    setLocal("Tasdeeq ho gayi. Entry verified hai.");
    await onReload();
  }
  return (
    <View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        {(["all", "milk", "orders", "payments", "stock"] as const).map((key) => <Pressable key={key} onPress={() => setFilter(key)} style={{ backgroundColor: filter === key ? colors.green : "#fff", borderWidth: 1, borderColor: filter === key ? colors.green : colors.line, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6, marginRight: 6, marginBottom: 6 }}><Text style={{ color: filter === key ? "#fff" : colors.muted, fontWeight: "700", textTransform: "capitalize" }}>{key}</Text></Pressable>)}
      </View>
      {filter === "all" || filter === "milk" ? (
      <Section title="Pending approvals" sub="Doodh ki tasdeeq. Manzoor asal row par likhta hai.">
        {local ? <Text style={{ color: colors.greenDark, marginBottom: 6 }}>{local}</Text> : null}
        {readOnly ? <Text style={{ color: colors.muted, marginBottom: 6 }}>Sirf dekhna. Manzoor band hai.</Text> : null}
        {priced.length === 0 && waiting.length === 0 ? <Empty title="Koi doodh tasdeeq nahi" body="MCO jab fat laga dega, priced entry yahan Manzoor ke sath aayegi." /> : null}
        {priced.map((row) => (
          <View key={row.id} style={{ marginBottom: 8 }}>
            <Text style={{ color: colors.text }}>{row.entry_date} · {shiftLabel(row.shift)} · {row.quantity_liters} L · {row.total_amount == null ? "—" : rupees(Number(row.total_amount))}</Text>
            {readOnly ? null : <Btn label={busy === row.id ? "Ho raha hai" : "Manzoor"} onPress={() => void verify(row)} />}
          </View>
        ))}
        {waiting.map((row) => (
          <Text key={row.id} style={{ color: colors.muted, marginBottom: 4 }}>{row.entry_date} · {shiftLabel(row.shift)} · {row.quantity_liters} L · pehle MCO fat lagaye</Text>
        ))}
      </Section>
      ) : null}
      {filter === "all" || filter === "orders" ? (
      <Section title="Orders" sub="Khud ki darkhwast khud manzoor nahi hoti">
        {orders.length === 0 ? <Empty title="Koi order nahi" body="TEST order jab nazar aayega, status yahan dikhega." /> : null}
        {orders.map((row) => {
          const own = Boolean(auth?.userId && row.requested_by && row.requested_by === auth.userId);
          return (
            <Text key={row.id || row.order_number} style={{ color: colors.text, marginBottom: 6 }}>
              {row.order_number || "Order"} · {row.status} · {row.grand_total == null ? "—" : rupees(Number(row.grand_total))}
              {own ? " · Order maangne wala khud approve nahi kar sakta." : ""}
            </Text>
          );
        })}
      </Section>
      ) : null}
      {filter === "payments" || filter === "stock" ? <Section title={filter === "payments" ? "Payments" : "Stock adjustments"}><Empty title="Pending queue" body={home.pendingNote || `${filter} ki visible pending lines yahan aayengi. Koi fake record nahi dikhaya.`} /></Section> : null}
      {!home.pendingNote && home.pending.length > 0 ? (
        <Section title="Aur pending" sub="Ginati">
          {home.pending.map((row) => <Row key={row.label} title={row.label} value={String(row.count)} />)}
        </Section>
      ) : null}
    </View>
  );
}

function AdminReports({ home, milk, refreshing, onRefresh }: { home: AdminHome; milk: MilkRow[]; refreshing: boolean; onRefresh: () => void }) {
  const [range, setRange] = useState<"today" | "month" | "year" | "custom">("today");
  const today = karachiDate();
  const [from, setFrom] = useState(`${today.slice(0, 8)}01`);
  const [to, setTo] = useState(today);
  const activeFrom = range === "today" ? today : range === "month" ? `${today.slice(0, 8)}01` : range === "year" ? `${today.slice(0, 4)}-01-01` : from;
  const activeTo = range === "today" ? today : to;
  const rows = milkInRange(milk, activeFrom, activeTo);
  const shifts = milkByShift(rows);
  const amount = pricedMilkTotal(rows);
  return <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.green} />}>
    <Text style={{ color: colors.text, fontSize: 22, fontWeight: "900" }}>Reports & Audit</Text>
    <Text style={{ color: colors.muted, marginTop: 3, marginBottom: 12 }}>Date, month, year aur custom filter</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>{(["today", "month", "year", "custom"] as const).map((key) => <Pressable key={key} onPress={() => setRange(key)} style={{ backgroundColor: range === key ? colors.green : "#fff", borderWidth: 1, borderColor: range === key ? colors.green : colors.line, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7, marginRight: 6, marginBottom: 6 }}><Text style={{ color: range === key ? "#fff" : colors.muted, fontWeight: "700", textTransform: "capitalize" }}>{key}</Text></Pressable>)}</View>
    {range === "custom" ? <View style={{ flexDirection: "row", marginBottom: 8 }}><TextInput value={from} onChangeText={setFrom} placeholder="YYYY-MM-DD" style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 10, marginRight: 6 }} /><TextInput value={to} onChangeText={setTo} placeholder="YYYY-MM-DD" style={{ flex: 1, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 10 }} /></View> : null}
    <Text style={{ color: colors.muted, marginBottom: 8 }}>{activeFrom} se {activeTo}</Text>
    <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
      <Kpi label="Sales" value={range === "today" && home.sales.state === "ok" ? rupees(home.sales.total) : "—"} sub={range === "today" ? "Asal POS bills" : "Range sale API pending"} />
      <Kpi label="Cash / Bank" value={range === "today" && home.cash.state === "ok" ? rupees(home.cash.cash + home.cash.bank + home.cash.wallet) : "—"} sub="Visible accounts" />
      <Kpi label="Milk" value={`${milkLitres(rows)} L`} sub={`Subah ${Math.round(shifts.subah)} · Shaam ${Math.round(shifts.shaam)}`} />
      <Kpi label="Milk amount" value={amount == null ? "—" : rupees(amount)} sub="Priced / verified" />
    </View>
    <Section title="Audit health" sub="Delete nahi; pehle review">
      {home.pendingNote ? <Empty title="Pending health nahi khuli" body={home.pendingNote} /> : home.pending.length ? home.pending.map((row) => <Row key={row.label} title={row.label} value={String(row.count)} />) : <Empty title="Visible pending zero" body="Pending queue parh li gayi aur koi visible item nahi mila." />}
    </Section>
    <Section title="Recent activity">
      {home.activityNote ? <Empty title="Activity nahi khuli" body={home.activityNote} /> : home.activity.length ? home.activity.map((row, index) => <Row key={`${row.at}-${index}`} title={row.action || "Activity"} value={row.at ? row.at.slice(0, 10) : "—"} />) : <Empty title="Koi visible activity nahi" body="Is login ko recent activity lines nazar nahi aayin." />}
    </Section>
    <View style={{ height: 24 }} />
  </ScrollView>;
}

function MilkReports({ milk }: { milk: MilkRow[] }) {
  const today = karachiDate();
  const week = karachiWeek();
  const monthFrom = `${today.slice(0, 8)}01`;
  const todayRows = milk.filter((row) => row.entry_date === today);
  const weekRows = milk.filter((row) => inWeek(row.entry_date ?? null, week));
  const monthRows = milkInRange(milk, monthFrom, today);
  const days = karachiDaySeries(7);
  const byDay = new Map<string, number>();
  for (const row of milk) {
    const day = String(row.entry_date || "");
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + Number(row.quantity_liters || 0));
  }
  const chart = salesByDay(days.map((day) => ({ created_at: day, total_amount: byDay.get(day) ?? 0, status: "ok" })), days);
  const block = (title: string, rows: MilkRow[], sub: string) => {
    const shifts = milkByShift(rows);
    const amount = pricedMilkTotal(rows);
    return (
      <Section key={title} title={title} sub={sub}>
        <Text style={{ color: colors.text, fontWeight: "700" }}>{milkLitres(rows)} L · {amount == null ? "raqam —" : rupees(amount)}</Text>
        <Text style={{ color: colors.muted, marginTop: 4 }}>Subah {Math.round(shifts.subah)} L · Shaam {Math.round(shifts.shaam)} L</Text>
      </Section>
    );
  };
  return (
    <View>
      <Text style={{ color: colors.muted, marginBottom: 8 }}>Reports · doodh din, hafta, mahina</Text>
      {block("Aaj", todayRows, today)}
      {block("Hafta", weekRows, `${week.start} se ${week.end}`)}
      {block("Mahina", monthRows, `${monthFrom} se ${today}`)}
      <Section title="7 din ka doodh" sub="Litre">
        {chart.every((point) => point.amount === 0) ? <Empty title="Chart khali hai" body="TEST ya live doodh jab hoga, chart yahan banega." /> : <SaleChart points={chart} />}
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
