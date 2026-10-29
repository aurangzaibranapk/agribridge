import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  karachiDate,
  liveGet,
  loadAttendance,
  loadMilkList,
  loadPurchases,
  milkByShift,
  milkLitres,
  rupees,
  searchParties,
  type AdminHome,
  type InventoryRow,
  type LiveAuth,
  type MilkRow,
  type ProductRow,
} from "../../../../src/lib/mobile/live-read";
import type { AdminDigitalOverview } from "../../../../src/lib/mobile/digital-munshi";
import { colors } from "../kit";

export type AdminPanel =
  | "menu"
  | "sales"
  | "finance"
  | "parties"
  | "stock"
  | "purchases"
  | "milk"
  | "farmers"
  | "vet"
  | "staff"
  | "activity"
  | "settings";

type Props = {
  panel: AdminPanel;
  auth: LiveAuth | null;
  home: AdminHome | null;
  milk: MilkRow[];
  digital: AdminDigitalOverview | null;
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (panel: AdminPanel) => void;
  onProfile?: () => void;
};

const MODULES: { panel: AdminPanel; icon: string; title: string; sub: string }[] = [
  { panel: "sales", icon: "▣", title: "POS & Sales", sub: "Shops, bills aur payment mix" },
  { panel: "finance", icon: "₨", title: "Finance & Accounts", sub: "Cash, bank, wallet aur transfers" },
  { panel: "parties", icon: "◎", title: "Parties & Khata", sub: "Farmer/customer, supplier, dealer" },
  { panel: "stock", icon: "▦", title: "Products & Stock", sub: "Batch, expiry, rate aur movement" },
  { panel: "purchases", icon: "▤", title: "Purchases", sub: "PO, bill, GRN aur payable" },
  { panel: "milk", icon: "◉", title: "Milk Operations", sub: "DCA/MCA, MCO aur admin verify" },
  { panel: "farmers", icon: "♧", title: "Digital Munshi", sub: "Farmer/customer ka mukammal record" },
  { panel: "vet", icon: "✚", title: "Vet & Dairy", sub: "Animals, visits aur reminders" },
  { panel: "staff", icon: "◫", title: "Staff & Attendance", sub: "Role, shop, shift aur hazri" },
  { panel: "activity", icon: "!", title: "Activity & Alerts", sub: "System timeline aur data health" },
  { panel: "settings", icon: "⚙", title: "Settings & Access", sub: "Branches, roles aur business rules" },
];

export function AdminWorkspace(props: Props) {
  const title = MODULES.find((item) => item.panel === props.panel)?.title || "Admin Modules";
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={props.refreshing} onRefresh={props.onRefresh} tintColor={colors.green} />}
    >
      <View style={styles.top}>
        {props.panel === "menu" ? <View style={styles.brand}><Text style={styles.brandText}>A</Text></View> : (
          <Pressable accessibilityRole="button" onPress={() => props.onOpen("menu")} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable>
        )}
        <View style={{ flex: 1 }}><Text style={styles.title}>{title}</Text><Text style={styles.sub}>{props.panel === "menu" ? "Admin Command Center" : "Asal ERP records · read only"}</Text></View>
        <Pressable onPress={props.onProfile} style={styles.avatar}><Text style={styles.avatarText}>AR</Text></Pressable>
      </View>
      {!props.auth ? <Notice title="Hisaab nahi khula" body="Login session ya database configuration nahi mili." /> : props.panel === "menu" ? <ModuleMenu onOpen={props.onOpen} /> : <PanelBody {...props} />}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function ModuleMenu({ onOpen }: { onOpen: (panel: AdminPanel) => void }) {
  return <View style={styles.moduleGrid}>{MODULES.map((item) => (
    <Pressable key={item.panel} onPress={() => onOpen(item.panel)} style={styles.moduleCard}>
      <View style={styles.moduleIcon}><Text style={styles.moduleIconText}>{item.icon}</Text></View>
      <Text style={styles.moduleTitle}>{item.title}</Text><Text style={styles.moduleSub}>{item.sub}</Text>
    </Pressable>
  ))}</View>;
}

function PanelBody(props: Props) {
  const auth = props.auth as LiveAuth;
  if (props.panel === "sales") return <SalesPanel home={props.home} />;
  if (props.panel === "finance") return <FinancePanel auth={auth} home={props.home} />;
  if (props.panel === "parties") return <PartiesPanel auth={auth} />;
  if (props.panel === "stock") return <StockPanel auth={auth} />;
  if (props.panel === "purchases") return <PurchasesPanel auth={auth} />;
  if (props.panel === "milk") return <MilkPanel rows={props.milk} />;
  if (props.panel === "farmers") return <FarmersPanel auth={auth} digital={props.digital} />;
  if (props.panel === "vet") return <VetPanel auth={auth} digital={props.digital} />;
  if (props.panel === "staff") return <StaffPanel auth={auth} />;
  if (props.panel === "activity") return <ActivityPanel home={props.home} auth={auth} />;
  if (props.panel === "settings") return <SettingsPanel onProfile={props.onProfile} />;
  return null;
}

function SalesPanel({ home }: { home: AdminHome | null }) {
  if (!home) return <Loading />;
  return <View>
    <KpiGrid items={[
      ["Aaj ki sale", home.sales.state === "ok" ? rupees(home.sales.total) : "—"],
      ["Bills", home.sales.state === "ok" ? String(home.sales.bills) : "—"],
      ["Cash", home.cash.state === "ok" ? rupees(home.cash.cash) : "—"],
      ["Bank / wallet", home.cash.state === "ok" ? rupees(home.cash.bank + home.cash.wallet) : "—"],
    ]} />
    <Card title="7 din ki sale">
      {home.days.length ? home.days.map((row) => <DataRow key={row.day} title={row.day} value={rupees(row.amount)} />) : <Empty text="Sale ki qatarein nahi milin." />}
    </Card>
    <Card title="Category wise sale">
      {home.categories.length ? home.categories.map((row) => <DataRow key={row.label} title={row.label} value={rupees(row.amount)} />) : <Empty text="Category lines nazar nahi aayin." />}
    </Card>
  </View>;
}

type AccountRow = { id?: string; name?: string | null; account_name?: string | null; account_type?: string | null; current_balance?: number | string | null; is_active?: boolean | null };
function FinancePanel({ auth, home }: { auth: LiveAuth; home: AdminHome | null }) {
  const read = useRead(() => liveGet<AccountRow>(auth, "finance_accounts?select=id,name,account_name,account_type,current_balance,is_active&is_active=eq.true&order=account_type.asc&limit=100", fetch), [auth.token]);
  return <View>
    <KpiGrid items={[
      ["Cash", home?.cash.state === "ok" ? rupees(home.cash.cash) : "—"],
      ["Bank", home?.cash.state === "ok" ? rupees(home.cash.bank) : "—"],
      ["Wallet", home?.cash.state === "ok" ? rupees(home.cash.wallet) : "—"],
      ["Accounts", read.rows ? String(read.rows.length) : "—"],
    ]} />
    <Card title="Accounts">
      <ResultState state={read}>{read.rows?.map((row, index) => <DataRow key={row.id || String(index)} title={row.account_name || row.name || row.account_type || "Account"} value={row.current_balance == null ? "—" : rupees(Number(row.current_balance))} sub={row.account_type || ""} />)}</ResultState>
    </Card>
    <Notice title="Account transfer" body="Sending aur receiving dono side ki entry finance ledger mein link honi chahiye. Mobile se write action permission milne tak yahan read-only rakha gaya hai." />
  </View>;
}

function PartiesPanel({ auth }: { auth: LiveAuth }) {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<Awaited<ReturnType<typeof searchParties>> | null>(null);
  const [busy, setBusy] = useState(false);
  const run = useCallback(async () => { setBusy(true); setResult(await searchParties(auth, query, fetch)); setBusy(false); }, [auth.token, query]);
  useEffect(() => { void run(); }, [auth.token]);
  return <View>
    <Search value={query} onChange={setQuery} onApply={() => void run()} placeholder="Naam, mobile ya CNIC" />
    <Card title="Kisan / Customer · one identity">
      {busy ? <Loading /> : !result ? null : !result.farmers.ok ? <Empty text={result.farmers.message} /> : result.farmers.rows.length ? result.farmers.rows.map((row, index) => <DataRow key={row.id || String(index)} title={row.full_name || row.name || "Kisan / Customer"} value="Statement ›" />) : <Empty text="Koi farmer/customer nahi mila." />}
    </Card>
    <Card title="Customer khata">
      {!result ? null : !result.customers.ok ? <Empty text={result.customers.message} /> : result.customers.rows.length ? result.customers.rows.map((row, index) => <DataRow key={row.id || String(index)} title={row.name || row.full_name || "Customer"} value={row.current_balance == null ? "—" : rupees(Number(row.current_balance))} />) : <Empty text="Koi customer nahi mila." />}
    </Card>
  </View>;
}

function StockPanel({ auth }: { auth: LiveAuth }) {
  const read = useRead(async () => {
    const [products, inventory] = await Promise.all([
      liveGet<ProductRow>(auth, "products?select=id,name,min_stock_threshold,selling_price,unit,is_available&is_deleted=eq.false&order=name.asc&limit=200", fetch),
      liveGet<InventoryRow>(auth, "inventory?select=product_id,quantity_on_hand&limit=2000", fetch),
    ]);
    if (!products.ok) return products;
    if (!inventory.ok) return inventory;
    const qty = new Map(inventory.rows.map((row) => [row.product_id, Number(row.quantity_on_hand || 0)]));
    return { ok: true as const, rows: products.rows.map((row) => ({ ...row, quantity: qty.get(row.id) })) };
  }, [auth.token]);
  const lows = read.rows?.filter((row) => row.min_stock_threshold != null && Number(row.quantity || 0) <= Number(row.min_stock_threshold)) ?? [];
  return <View>
    <KpiGrid items={[["Products", read.rows ? String(read.rows.length) : "—"], ["Low stock", read.rows ? String(lows.length) : "—"], ["Near expiry", "—"], ["Unlinked rows", "—"]]} />
    <Card title="Products & stock">
      <ResultState state={read}>{read.rows?.map((row, index) => <DataRow key={row.id || String(index)} title={row.name || "Product"} value={row.quantity == null ? "—" : `${row.quantity} ${row.unit || ""}`} sub={row.selling_price == null ? "Sale rate —" : `Sale rate ${rupees(Number(row.selling_price))}`} />)}</ResultState>
    </Card>
  </View>;
}

function PurchasesPanel({ auth }: { auth: LiveAuth }) {
  const read = useRead(() => loadPurchases(auth, fetch), [auth.token]);
  return <View>
    <View style={styles.actionGrid}><MiniAction title="CSV Bill" sub="Auto map" /><MiniAction title="Purchase Bill" sub="Qty × rate" /><MiniAction title="GRN Queue" sub="Receive" /></View>
    <Notice title="Calculation protection" body="Har row quantity × trade rate se dobara calculate honi chahiye; purana CSV line total reuse nahi hoga." />
    <Card title="Recent supplier bills">
      <ResultState state={read}>{read.rows?.map((row, index) => <DataRow key={`${row.purchase_number || row.supplier_bill_no || "bill"}-${index}`} title={row.purchase_number || row.supplier_bill_no || "Supplier bill"} value={row.total_amount == null ? "—" : rupees(Number(row.total_amount))} sub={`${row.purchase_date || "Date —"} · ${row.status || "Status —"}`} />)}</ResultState>
    </Card>
  </View>;
}

function MilkPanel({ rows }: { rows: MilkRow[] }) {
  const today = karachiDate();
  const todays = rows.filter((row) => row.entry_date === today);
  const shifts = milkByShift(todays);
  const pending = todays.filter((row) => row.status === "pending_fat");
  const approval = todays.filter((row) => row.status === "priced");
  return <View>
    <KpiGrid items={[["Subah", `${Math.round(shifts.subah)} L`], ["Shaam", `${Math.round(shifts.shaam)} L`], ["Pending MCO", String(pending.length)], ["Admin verify", String(approval.length)]]} />
    <Card title="Live flow">
      <FlowRow step="1" title="DCA / MCA pickup" sub="Farmer · shift · litres · optional LR" state="Field" />
      <FlowRow step="2" title="MCO quality check" sub="Verified litres · Fat · LR · amount" state={pending.length ? "Pending" : "Checked"} />
      <FlowRow step="3" title="Admin approval" sub="Farmer ledger + milk payable link" state={approval.length ? "Review" : "Final"} />
    </Card>
    <Card title={`Aaj ki entries · ${milkLitres(todays)} L`}>
      {todays.length ? todays.map((row, index) => <DataRow key={row.id || String(index)} title={`${row.entry_date} · ${row.shift === "evening" ? "Shaam" : "Subah"}`} value={`${row.quantity_liters ?? row.field_collected_volume ?? "—"} L`} sub={`Fat ${row.fat_percentage ?? "—"} · LR ${row.lr ?? "—"} · ${row.status || "—"}`} />) : <Empty text="Aaj koi milk entry nazar nahi aayi." />}
    </Card>
  </View>;
}

type FarmerRow = { id?: string; full_name?: string | null; farmer_code?: string | null; village?: string | null; mobile?: string | null };
function FarmersPanel({ auth, digital }: { auth: LiveAuth; digital: AdminDigitalOverview | null }) {
  const [query, setQuery] = useState("");
  const [applied, setApplied] = useState("");
  const read = useRead(() => liveGet<FarmerRow>(auth, `farmers?select=id,full_name,farmer_code,village,mobile&order=full_name.asc&limit=200`, fetch), [auth.token]);
  const shown = read.rows?.filter((row) => !applied || [row.full_name, row.farmer_code, row.village, row.mobile].some((value) => String(value || "").toLowerCase().includes(applied.toLowerCase())));
  return <View>
    <Search value={query} onChange={setQuery} onApply={() => setApplied(query.trim())} placeholder="Farmer name, code, mobile, village" />
    <KpiGrid items={[["Kisan", valueOf(digital?.farmers)], ["Farms", valueOf(digital?.farms)], ["Faslein", valueOf(digital?.crops)], ["Janwar", valueOf(digital?.animals)]]} />
    <Card title="Farmer / Customer profiles">
      <ResultState state={read}>{shown?.map((row, index) => <DataRow key={row.id || String(index)} title={row.full_name || "Kisan / Customer"} value="Open ›" sub={[row.farmer_code, row.village, row.mobile].filter(Boolean).join(" · ")} />)}</ResultState>
    </Card>
    <View style={styles.actionGrid}>{["Farms", "Crops", "Khata", "Dairy", "Machinery", "Orders"].map((title) => <MiniAction key={title} title={title} />)}</View>
  </View>;
}

type HealthRow = { id?: string; kind?: string | null; event_date?: string | null; next_due?: string | null; diagnosis?: string | null; medicine?: string | null; vet_name?: string | null };
function VetPanel({ auth, digital }: { auth: LiveAuth; digital: AdminDigitalOverview | null }) {
  const read = useRead(() => liveGet<HealthRow>(auth, "dairy_health_events?select=id,kind,event_date,next_due,diagnosis,medicine,vet_name&voided=eq.false&order=event_date.desc&limit=100", fetch), [auth.token]);
  return <View>
    <KpiGrid items={[["Active animals", valueOf(digital?.animals)], ["Due / open", valueOf(digital?.vetOpen)], ["Health records", read.rows ? String(read.rows.length) : "—"], ["Milk yield", "—"]]} />
    <Card title="Vet work queue">
      <ResultState state={read}>{read.rows?.map((row, index) => <DataRow key={row.id || String(index)} title={row.kind || row.diagnosis || "Health event"} value={row.next_due || row.event_date || "—"} sub={[row.medicine, row.vet_name].filter(Boolean).join(" · ")} />)}</ResultState>
    </Card>
    <View style={styles.actionGrid}><MiniAction title="Animals" /><MiniAction title="Reminders" /><MiniAction title="Vet Team" /></View>
  </View>;
}

function StaffPanel({ auth }: { auth: LiveAuth }) {
  const read = useRead(async () => {
    const result = await loadAttendance(auth, karachiDate(), fetch);
    if (!result.rows.ok) return result.rows;
    return { ok: true as const, rows: result.rows.rows.map((row) => ({ ...row, name: result.names.get(row.profile_id || "") || "Staff" })) };
  }, [auth.token]);
  return <View>
    <KpiGrid items={[["Aaj present", read.rows ? String(read.rows.filter((row) => String(row.status).toLowerCase() === "present").length) : "—"], ["Attendance rows", read.rows ? String(read.rows.length) : "—"], ["Late", read.rows ? String(read.rows.filter((row) => String(row.status).toLowerCase() === "late").length) : "—"], ["Absent", read.rows ? String(read.rows.filter((row) => String(row.status).toLowerCase() === "absent").length) : "—"]]} />
    <Card title="Today attendance">
      <ResultState state={read}>{read.rows?.map((row, index) => <DataRow key={`${row.profile_id}-${index}`} title={row.name} value={row.status || "—"} sub={row.check_in_at ? `Check-in ${row.check_in_at.slice(11, 16)}` : "Check-in —"} />)}</ResultState>
    </Card>
  </View>;
}

type ActivityRow = { id?: string; action?: string | null; created_at?: string | null; entity_type?: string | null };
function ActivityPanel({ home, auth }: { home: AdminHome | null; auth: LiveAuth }) {
  const read = useRead(() => liveGet<ActivityRow>(auth, "activity_logs?select=id,action,created_at,entity_type&order=created_at.desc&limit=100", fetch), [auth.token]);
  return <View>
    <Notice title="Data health" body="Unposted, duplicate aur missing-link records sirf review honge; mobile se koi automatic delete nahi." />
    <Card title="System-wide activity">
      {read.error && home?.activity.length ? home.activity.map((row, index) => <DataRow key={`${row.at}-${index}`} title={row.action || "Activity"} value={row.at ? row.at.slice(0, 16).replace("T", " ") : "—"} />) : <ResultState state={read}>{read.rows?.map((row, index) => <DataRow key={row.id || String(index)} title={row.action || "Activity"} value={row.created_at ? row.created_at.slice(0, 16).replace("T", " ") : "—"} sub={row.entity_type || ""} />)}</ResultState>}
    </Card>
  </View>;
}

function SettingsPanel({ onProfile }: { onProfile?: () => void }) {
  const groups = [
    ["Organization", ["Branches & Shops", "Slip names & assignments"]],
    ["Users, Roles & Permissions", ["Admin, staff, DCA/MCA, MCO, Vet, dealer"]],
    ["Business Rules", ["Milk rate, grain bags, chungi, cut, limits"]],
    ["Data Safety", ["Before/after counts, migrations, backup verification"]],
  ];
  return <View>
    {groups.map(([title, lines]) => <Card key={title as string} title={title as string}>{(lines as string[]).map((line) => <DataRow key={line} title={line} value="›" />)}</Card>)}
    <Pressable onPress={onProfile} style={styles.primary}><Text style={styles.primaryText}>Profile & App Settings</Text></Pressable>
  </View>;
}

type ReadState<T> = { rows: T[] | null; error: string; busy: boolean };
function useRead<T>(loader: () => Promise<{ ok: true; rows: T[] } | { ok: false; message: string }>, deps: unknown[]): ReadState<T> {
  const [state, setState] = useState<ReadState<T>>({ rows: null, error: "", busy: true });
  useEffect(() => {
    let gone = false;
    setState({ rows: null, error: "", busy: true });
    void loader().then((result) => {
      if (gone) return;
      setState(result.ok ? { rows: result.rows, error: "", busy: false } : { rows: null, error: result.message, busy: false });
    });
    return () => { gone = true; };
  // Callers pass stable identity fields intentionally.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

function ResultState<T>({ state, children }: { state: ReadState<T>; children: ReactNode }) {
  if (state.busy) return <Loading />;
  if (state.error) return <Empty text={state.error} />;
  if (!state.rows?.length) return <Empty text="Koi record nazar nahi aaya." />;
  return <>{children}</>;
}

function valueOf(value: number | null | undefined) { return typeof value === "number" ? String(value) : "—"; }
function Loading() { return <ActivityIndicator color={colors.green} style={{ marginVertical: 20 }} />; }
function Empty({ text }: { text: string }) { return <Text style={styles.empty}>{text}</Text>; }
function Notice({ title, body }: { title: string; body: string }) { return <View style={styles.notice}><Text style={styles.noticeTitle}>{title}</Text><Text style={styles.noticeBody}>{body}</Text></View>; }
function Card({ title, children }: { title: string; children: ReactNode }) { return <View style={styles.card}><Text style={styles.cardTitle}>{title}</Text>{children}</View>; }
function DataRow({ title, value, sub }: { title: string; value: string; sub?: string }) { return <View style={styles.row}><View style={{ flex: 1, paddingRight: 10 }}><Text style={styles.rowTitle}>{title}</Text>{sub ? <Text style={styles.rowSub}>{sub}</Text> : null}</View><Text style={styles.rowValue}>{value}</Text></View>; }
function KpiGrid({ items }: { items: [string, string][] }) { return <View style={styles.kpiGrid}>{items.map(([label, value]) => <View key={label} style={styles.kpi}><Text style={styles.kpiLabel}>{label}</Text><Text style={styles.kpiValue}>{value}</Text></View>)}</View>; }
function MiniAction({ title, sub }: { title: string; sub?: string }) { return <View style={styles.action}><Text style={styles.actionMark}>+</Text><Text style={styles.actionTitle}>{title}</Text>{sub ? <Text style={styles.actionSub}>{sub}</Text> : null}</View>; }
function Search({ value, onChange, onApply, placeholder }: { value: string; onChange: (value: string) => void; onApply: () => void; placeholder: string }) { return <View style={styles.search}><TextInput value={value} onChangeText={onChange} onSubmitEditing={onApply} placeholder={placeholder} style={styles.searchInput} /><Pressable onPress={onApply} style={styles.apply}><Text style={styles.applyText}>Apply</Text></Pressable></View>; }
function FlowRow({ step, title, sub, state }: { step: string; title: string; sub: string; state: string }) { return <View style={styles.row}><View style={styles.step}><Text style={styles.stepText}>{step}</Text></View><View style={{ flex: 1, paddingHorizontal: 10 }}><Text style={styles.rowTitle}>{title}</Text><Text style={styles.rowSub}>{sub}</Text></View><Text style={styles.pill}>{state}</Text></View>; }

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F5F7F2" },
  content: { padding: 16 },
  top: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  brand: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.green, alignItems: "center", justifyContent: "center", marginRight: 10 },
  brandText: { color: "#fff", fontSize: 20, fontWeight: "900" },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#E8F1E8", alignItems: "center", justifyContent: "center", marginRight: 10 },
  backText: { color: colors.green, fontSize: 32, lineHeight: 34, fontWeight: "700" },
  title: { color: colors.text, fontSize: 21, fontWeight: "900" },
  sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#D5E8D6", alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.greenDark, fontWeight: "900" },
  moduleGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  moduleCard: { width: "48.5%", minHeight: 150, backgroundColor: "#fff", borderRadius: 20, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.line },
  moduleIcon: { width: 42, height: 42, borderRadius: 13, backgroundColor: "#E9F5E8", alignItems: "center", justifyContent: "center", marginBottom: 12 },
  moduleIconText: { color: colors.green, fontSize: 20, fontWeight: "900" },
  moduleTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  moduleSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 5 },
  card: { backgroundColor: "#fff", borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", minHeight: 54, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E9EEE8" },
  rowTitle: { color: colors.text, fontWeight: "800" },
  rowSub: { color: colors.muted, fontSize: 12, lineHeight: 17, marginTop: 3 },
  rowValue: { color: colors.greenDark, fontWeight: "800", textAlign: "right", maxWidth: "38%" },
  empty: { color: colors.muted, lineHeight: 20, paddingVertical: 12 },
  notice: { backgroundColor: "#FFF8E7", borderColor: "#EBD6A6", borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 12 },
  noticeTitle: { color: "#62480C", fontWeight: "900" },
  noticeBody: { color: "#715C2C", lineHeight: 19, marginTop: 4 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 2 },
  kpi: { width: "48.5%", minHeight: 90, backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: colors.line },
  kpiLabel: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  kpiValue: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 8 },
  actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 2 },
  action: { width: "32%", minHeight: 98, backgroundColor: "#EAF5EA", borderRadius: 16, padding: 10, marginBottom: 10 },
  actionMark: { color: colors.green, fontSize: 20, fontWeight: "900" },
  actionTitle: { color: colors.text, fontWeight: "900", fontSize: 12, marginTop: 6 },
  actionSub: { color: colors.muted, fontSize: 10, marginTop: 2 },
  search: { flexDirection: "row", marginBottom: 12 },
  searchInput: { flex: 1, backgroundColor: "#fff", borderRadius: 14, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, minHeight: 48 },
  apply: { backgroundColor: colors.green, borderRadius: 14, paddingHorizontal: 16, alignItems: "center", justifyContent: "center", marginLeft: 8 },
  applyText: { color: "#fff", fontWeight: "800" },
  step: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.green, alignItems: "center", justifyContent: "center" },
  stepText: { color: "#fff", fontWeight: "900" },
  pill: { color: colors.greenDark, backgroundColor: "#E7F2E4", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11, fontWeight: "800", overflow: "hidden" },
  primary: { backgroundColor: colors.green, borderRadius: 14, padding: 14, alignItems: "center" },
  primaryText: { color: "#fff", fontWeight: "900" },
});
