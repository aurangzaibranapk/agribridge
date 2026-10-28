import { useMemo, useState } from "react";
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { MilkRow, PartyRow } from "../../../../src/lib/mobile/live-read";
import type { OutboxItem } from "../../../../src/lib/mobile/queue";
import { farmerPortrait } from "../farmer-portraits";

const C = { green: "#075B39", green2: "#128044", bg: "#F7F8F3", card: "#FFFFFF", line: "#DDE7DF", text: "#14261C", muted: "#68756D", mint: "#EAF5EC", goldBg: "#FFF5D8", red: "#D84A4A", redBg: "#FFE9E7", blueBg: "#EAF3FF" };

export type McoFarmer = PartyRow & { farmer_code?: string | null };
export type McoDispatch = {
  id?: string;
  dispatch_date?: string | null;
  shift?: string | null;
  vehicle_name?: string | null;
  driver_name?: string | null;
  dispatched_liters?: number | string | null;
  received_liters?: number | string | null;
  shortage_liters?: number | string | null;
  created_at?: string | null;
};

type Props = {
  tab: string;
  today: string;
  rows: MilkRow[];
  farmers: McoFarmer[];
  dispatches: McoDispatch[];
  route: string;
  chiller: string;
  note: string;
  error: string;
  queue: OutboxItem[];
  queueCount: number;
  refreshing: boolean;
  readOnly: boolean;
  receiveMode: "field" | "dropoff";
  search: string;
  appliedSearch: string;
  verifyOpen: boolean;
  dropoff: boolean;
  selectedRow?: MilkRow;
  selectedFarmerId: string;
  checkedLitres: string;
  fat: string;
  lr: string;
  busy: boolean;
  dispatchOpen: boolean;
  dispatchLitres: string;
  vehicle: string;
  driver: string;
  destination: string;
  onTab?: (key: string) => void;
  onProfile?: () => void;
  onRefresh: () => void;
  onSync: () => void;
  onMode: (mode: "field" | "dropoff") => void;
  onSearch: (value: string) => void;
  onApplySearch: () => void;
  onOpenRow: (row: MilkRow) => void;
  onOpenFarmer: (farmerId: string) => void;
  onCloseVerify: () => void;
  onCheckedLitres: (value: string) => void;
  onFat: (value: string) => void;
  onLr: (value: string) => void;
  onSaveVerify: () => void;
  onSendBack: () => void;
  onOpenDispatch: () => void;
  onCloseDispatch: () => void;
  onDispatchLitres: (value: string) => void;
  onVehicle: (value: string) => void;
  onDriver: (value: string) => void;
  onDestination: (value: string) => void;
  onSaveDispatch: () => void;
};

function n(value: number | string | null | undefined): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function litres(row: MilkRow): number { return n(row.quantity_liters ?? row.field_collected_volume); }
function fmt(value: number | null, suffix = ""): string { if (value == null) return "—"; const shown = Number.isInteger(value) ? value.toLocaleString("en-PK") : value.toFixed(2).replace(/\.00$/, ""); return `${shown}${suffix}`; }
function farmerIndex(p: Props, id?: string | null): number { return Math.max(0, p.farmers.findIndex((farmer) => farmer.id === id)); }
function farmerFor(p: Props, id?: string | null): McoFarmer | undefined { return p.farmers.find((farmer) => farmer.id === id); }
function isDone(row: MilkRow): boolean { return row.status === "priced" || row.status === "verified"; }
function shift(row: MilkRow): string { return row.shift === "evening" ? "Shaam" : "Subah"; }
function time(row: MilkRow): string { if (!row.collected_at) return "—"; const d = new Date(row.collected_at); return Number.isNaN(d.getTime()) ? "—" : new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }).format(d); }

function Page({ p, children }: { p: Props; children: React.ReactNode }) {
  return <ScrollView style={s.page} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={C.green2} />}>{children}</ScrollView>;
}
function Header({ p, title, sub }: { p: Props; title?: string; sub?: string }) {
  return <><View style={s.header}><View style={s.brandMark}><Text style={s.brandMarkText}>◆</Text></View><View style={{ flex: 1 }}><Text style={s.brand}>AgriBridge</Text><Text style={s.tagline}>Kisan ka Wasela</Text></View><View style={{ alignItems: "flex-end" }}><Text style={s.role}>MCO</Text><Text style={s.online}>● Online</Text></View></View>{title ? <View style={s.headline}><Text style={s.title}>{title}</Text>{sub ? <Text style={s.sub}>{sub}</Text> : null}</View> : null}</>;
}
function Stat({ mark, label, value, tint = C.mint }: { mark: string; label: string; value: string; tint?: string }) { return <View style={[s.stat, { backgroundColor: tint }]}><Text style={s.statMark}>{mark}</Text><Text style={s.statLabel}>{label}</Text><Text style={s.statValue}>{value}</Text></View>; }
function Action({ mark, title, onPress }: { mark: string; title: string; onPress: () => void }) { return <Pressable onPress={onPress} style={s.action}><Text style={s.actionMark}>{mark}</Text><Text style={s.actionText}>{title}</Text><Text style={s.arrow}>›</Text></Pressable>; }
function Empty({ text }: { text: string }) { return <View style={s.empty}><Text style={s.emptyMark}>—</Text><Text style={s.emptyText}>{text}</Text></View>; }
function Note({ p }: { p: Props }) { return <>{p.error ? <Text style={s.error}>{p.error}</Text> : null}{p.note ? <Text style={s.note}>{p.note}</Text> : null}{p.readOnly ? <Text style={s.readOnly}>Sirf dekhna · Save aur verification band hain.</Text> : null}</>; }

function Home({ p }: { p: Props }) {
  const today = p.rows.filter((row) => row.entry_date === p.today);
  const received = today.length ? today.reduce((sum, row) => sum + litres(row), 0) : null;
  const pending = today.filter((row) => row.status === "pending_fat").length;
  const dispatched = p.dispatches.filter((row) => row.dispatch_date === p.today).reduce((sum, row) => sum + n(row.dispatched_liters), 0);
  const stock = received == null ? null : Math.max(0, received - dispatched);
  return <Page p={p}><Header p={p} /><View style={s.identity}><Image source={farmerPortrait(8)} style={s.staffPhoto} /><View style={{ flex: 1 }}><Text style={s.staffName}>Milk Collection Officer</Text><Text style={s.staffMeta}>Route: {p.route || "—"}</Text><Text style={s.staffMeta}>Chiller: {p.chiller || "—"}</Text></View></View>
    <Text style={s.sectionTitle}>Aaj ka Chiller</Text><View style={s.grid}><Stat mark="◉" label="Received Today" value={fmt(received, " L")} /><Stat mark="!" label="Pending Quality" value={today.length ? String(pending) : "—"} tint={C.goldBg} /><Stat mark="▰" label="Chiller Stock" value={fmt(stock, " L")} tint={C.blueBg} /><Stat mark="↻" label="Offline Queue" value={p.queueCount ? String(p.queueCount) : "—"} /></View>
    <View style={s.actionGrid}><Action mark="◉" title="Receive Milk" onPress={() => p.onTab?.("receive")} /><Action mark="✓" title="Quality Pending" onPress={() => p.onTab?.("quality")} /><Action mark="▰" title="Chiller Ledger" onPress={() => p.onTab?.("chiller")} /><Action mark="▣" title="Dispatch" onPress={p.onOpenDispatch} /></View>
    <View style={s.routeCard}><Text style={s.routeTitle}>MCA Route Status</Text><Text style={s.routeMeta}>{p.route || "Route —"} · {p.chiller || "Chiller —"}</Text><View style={s.routeStats}><Text style={s.routeValue}>{today.length ? String(today.length) : "—"}<Text style={s.routeLabel}> entries</Text></Text><Text style={s.routeValue}>{fmt(received, " L")}</Text></View></View><Note p={p} />
  </Page>;
}

function Mode({ p, mode, title, sub, mark }: { p: Props; mode: "field" | "dropoff"; title: string; sub: string; mark: string }) { const on = p.receiveMode === mode; return <Pressable onPress={() => p.onMode(mode)} style={[s.mode, on ? s.modeOn : null]}><Text style={s.modeMark}>{mark}</Text><View style={{ flex: 1 }}><Text style={s.modeTitle}>{title}</Text><Text style={s.modeSub}>{sub}</Text></View></Pressable>; }
function Receive({ p }: { p: Props }) {
  const q = p.appliedSearch.trim().toLowerCase();
  const pending = p.rows.filter((row) => row.entry_date === p.today && row.status === "pending_fat" && (!q || (farmerFor(p, row.farmer_id)?.full_name || "").toLowerCase().includes(q)));
  const farmers = p.farmers.filter((farmer) => !q || (farmer.full_name || "").toLowerCase().includes(q) || (farmer.farmer_code || "").toLowerCase().includes(q));
  return <Page p={p}><Header p={p} title="Doodh receive karein" sub="MCC drop-off ya MCA field collection" /><View style={s.two}><Mode p={p} mode="dropoff" title="MCC Drop-off" sub="Chiller par seedha" mark="▣" /><Mode p={p} mode="field" title="MCA Field Collection" sub="MCA se receive" mark="◉" /></View>
    <View style={s.searchRow}><TextInput value={p.search} onChangeText={p.onSearch} placeholder="Farmer ka naam ya ID" style={s.search} /><Pressable onPress={p.onApplySearch} style={s.apply}><Text style={s.applyText}>Apply</Text></Pressable></View>
    <Text style={s.sectionTitle}>{p.receiveMode === "field" ? `Pending MCA Handoff (${pending.length})` : `Farmer chunein (${farmers.length})`}</Text>
    {p.receiveMode === "field" ? pending.map((row, index) => <MilkCard key={row.id || String(index)} p={p} row={row} index={index} action="Open" onPress={() => p.onOpenRow(row)} />) : farmers.slice(0, 40).map((farmer, index) => <FarmerCard key={farmer.id || String(index)} farmer={farmer} index={index} onPress={() => farmer.id && p.onOpenFarmer(farmer.id)} />)}
    {p.receiveMode === "field" && !pending.length ? <Empty text="MCA se koi pending entry nahi." /> : null}{p.receiveMode === "dropoff" && !farmers.length ? <Empty text="Is search mein farmer nahi mila." /> : null}<Note p={p} />
  </Page>;
}

function FarmerCard({ farmer, index, onPress }: { farmer: McoFarmer; index: number; onPress: () => void }) { return <Pressable onPress={onPress} style={s.milkCard}><Image source={farmerPortrait(index)} style={s.photo} /><View style={{ flex: 1 }}><Text style={s.person}>{farmer.full_name || "Kisan"}</Text><Text style={s.meta}>{farmer.farmer_code || "Code —"} · MCC Drop-off</Text></View><View style={s.open}><Text style={s.openText}>Select</Text></View></Pressable>; }
function MilkCard({ p, row, index, action, onPress }: { p: Props; row: MilkRow; index: number; action: string; onPress: () => void }) { const farmer = farmerFor(p, row.farmer_id); return <Pressable onPress={onPress} style={s.milkCard}><Image source={farmerPortrait(farmerIndex(p, row.farmer_id) || index)} style={s.photo} /><View style={{ flex: 1 }}><Text style={s.person}>{farmer?.full_name || "Kisan"}</Text><Text style={s.meta}>{farmer?.farmer_code || "—"} · {shift(row)} · {time(row)}</Text><Text style={s.detail}>MCA: {fmt(litres(row), " L")} · Fat {row.fat_percentage ?? "—"} · LR {row.lr ?? "—"}</Text></View><View style={s.open}><Text style={s.openText}>{action}</Text></View></Pressable>; }

function Quality({ p }: { p: Props }) {
  const [filter, setFilter] = useState<"all" | "morning" | "evening" | "missing">("all");
  const rows = p.rows.filter((row) => row.entry_date === p.today && (filter === "all" || (filter === "missing" ? row.status === "pending_fat" : row.shift === filter)));
  return <Page p={p}><Header p={p} title="Quality Pending" sub="Fat, LR aur actual litres" /><View style={s.filters}>{[["all", "All"], ["morning", "Subah"], ["evening", "Shaam"], ["missing", "Missing Fat/LR"]].map(([key, label]) => <Pressable key={key} onPress={() => setFilter(key as typeof filter)} style={[s.filter, filter === key ? s.filterOn : null]}><Text style={[s.filterText, filter === key ? s.filterTextOn : null]}>{label}</Text></Pressable>)}</View>
    {rows.map((row, index) => <QualityCard key={row.id || String(index)} p={p} row={row} index={index} onPress={() => p.onOpenRow(row)} />)}{!rows.length ? <Empty text="Is filter mein koi quality record nahi." /> : null}<Note p={p} />
  </Page>;
}
function QualityCard({ p, row, index, onPress }: { p: Props; row: MilkRow; index: number; onPress: () => void }) { const farmer = farmerFor(p, row.farmer_id); const done = isDone(row); return <View style={s.qualityCard}><Image source={farmerPortrait(farmerIndex(p, row.farmer_id) || index)} style={s.photo} /><View style={{ flex: 1 }}><Text style={s.person}>{farmer?.full_name || "Kisan"}</Text><Text style={s.meta}>{fmt(litres(row), " L")} · {shift(row)} · {time(row)}</Text><Text style={s.detail}>Fat {row.fat_percentage ?? "Missing"} · LR {row.lr ?? "Missing"}</Text></View>{done ? <View style={s.done}><Text style={s.doneText}>{row.status === "verified" ? "✓ Verified" : "✓ Quality done"}</Text></View> : <Pressable onPress={onPress} style={s.review}><Text style={s.reviewText}>Review</Text></Pressable>}</View>; }

function Chiller({ p }: { p: Props }) {
  const [dateDraft, setDateDraft] = useState(p.today); const [date, setDate] = useState(p.today);
  const rows = p.rows.filter((row) => !date || row.entry_date === date); const received = rows.length ? rows.reduce((sum, row) => sum + litres(row), 0) : null;
  const dispatches = p.dispatches.filter((row) => !date || row.dispatch_date === date); const sent = dispatches.reduce((sum, row) => sum + n(row.dispatched_liters), 0); const loss = dispatches.reduce((sum, row) => sum + n(row.shortage_liters), 0); const closing = received == null ? null : Math.max(0, received - sent);
  return <Page p={p}><Header p={p} title="Chiller Ledger" sub={p.chiller || "Assigned chiller"} /><View style={s.searchRow}><TextInput value={dateDraft} onChangeText={setDateDraft} placeholder="YYYY-MM-DD" style={s.search} /><Pressable onPress={() => setDate(dateDraft.trim())} style={s.apply}><Text style={s.applyText}>Apply</Text></Pressable></View>
    <View style={s.grid}><Stat mark="◫" label="Opening" value="—" /><Stat mark="◉" label="Received" value={fmt(received, " L")} /><Stat mark="▣" label="Dispatched" value={dispatches.length ? fmt(sent, " L") : "—"} tint={C.blueBg} /><Stat mark="↓" label="Loss" value={dispatches.length ? fmt(loss, " L") : "—"} tint={C.redBg} /><Stat mark="▰" label="Closing" value={fmt(closing, " L")} /></View>
    <Pressable onPress={p.onOpenDispatch} style={s.primary}><Text style={s.primaryText}>▣  Create Dispatch</Text></Pressable><Text style={s.sectionTitle}>Transactions</Text>
    {rows.map((row, index) => <View key={row.id || String(index)} style={s.tx}><Text style={s.txMark}>◉</Text><View style={{ flex: 1 }}><Text style={s.txTitle}>{farmerFor(p, row.farmer_id)?.full_name || "Milk collection"}</Text><Text style={s.meta}>{shift(row)} · {row.status || "pending"}</Text></View><Text style={s.txValue}>{fmt(litres(row), " L")}</Text></View>)}
    {dispatches.map((row, index) => <View key={row.id || `d-${index}`} style={s.tx}><Text style={s.txMark}>▣</Text><View style={{ flex: 1 }}><Text style={s.txTitle}>{row.vehicle_name || "Milk dispatch"}</Text><Text style={s.meta}>{row.driver_name || "Driver —"} · {row.shift === "evening" ? "Shaam" : "Subah"}</Text></View><Text style={s.txValue}>-{fmt(n(row.dispatched_liters), " L")}</Text></View>)}
    {!rows.length && !dispatches.length ? <Empty text="Is date par koi transaction nahi." /> : null}<Note p={p} />
  </Page>;
}

function More({ p }: { p: Props }) {
  const todayRows = p.rows.filter((row) => row.entry_date === p.today); const pending = todayRows.filter((row) => row.status === "pending_fat").length; const quality = todayRows.filter((row) => isDone(row)).length;
  return <Page p={p}><Header p={p} title="Sync & Handoff" sub="MCA se farmer ledger tak" /><View style={s.syncCard}><Text style={s.syncMark}>☁</Text><View style={{ flex: 1 }}><Text style={s.person}>Offline Queue</Text><Text style={s.meta}>{p.queueCount ? `${p.queueCount} records pending sync` : "Sab records sync hain"}</Text></View><Pressable onPress={p.onSync} style={s.syncBtn}><Text style={s.syncBtnText}>Sync Now</Text></Pressable></View>
    {p.queue.slice(0, 10).map((item) => <View key={item.clientUuid} style={s.queue}><Text style={s.txMark}>↻</Text><View style={{ flex: 1 }}><Text style={s.txTitle}>{item.kind === "fat" ? "Quality verification" : item.kind === "drop" ? "MCC drop-off" : item.kind}</Text><Text style={s.meta}>{item.error || "Phone mein safe · sync pending"}</Text></View></View>)}
    <Text style={s.sectionTitle}>Data Handoff Flow</Text><View style={s.flow}><Flow step="1" title="MCA Saved" done /><Flow step="2" title="MCO Quality" done={quality > 0} /><Flow step="3" title="Chiller" done={quality > 0} /><Flow step="4" title="Farmer Ledger" done={todayRows.some((row) => row.status === "verified")} last /></View>
    <View style={s.handoffInfo}><Text style={s.person}>{pending ? `${pending} quality entries pending` : "MCO quality queue clear"}</Text><Text style={s.meta}>Quality done ke baad Admin approval farmer ledger ko final karta hai.</Text></View><Pressable onPress={p.onOpenDispatch} style={s.primary}><Text style={s.primaryText}>Dispatch Save</Text></Pressable><Pressable onPress={p.onProfile} style={s.outline}><Text style={s.outlineText}>Profile aur chiller settings</Text></Pressable><Note p={p} />
  </Page>;
}
function Flow({ step, title, done, last }: { step: string; title: string; done?: boolean; last?: boolean }) { return <View style={[s.flowStep, last ? { borderRightWidth: 0 } : null]}><View style={[s.flowDot, done ? s.flowDone : null]}><Text style={s.flowNo}>{done ? "✓" : step}</Text></View><Text style={s.flowText}>{title}</Text></View>; }

function Field({ label, value, onChange, placeholder, locked }: { label: string; value: string; onChange?: (value: string) => void; placeholder?: string; locked?: boolean }) { return <View style={{ width: "48.5%" }}><Text style={s.fieldLabel}>{label}</Text><TextInput value={value} onChangeText={onChange} editable={!locked} keyboardType="decimal-pad" placeholder={placeholder || "—"} style={[s.input, locked ? s.inputLocked : null]} /></View>; }
function VerifyModal({ p }: { p: Props }) { const row = p.selectedRow; const farmer = p.dropoff ? farmerFor(p, p.selectedFarmerId) : farmerFor(p, row?.farmer_id); const source = p.dropoff ? "MCC Drop-off" : "MCA Field Collection"; const recorded = row ? litres(row) : null; const actual = Number(p.checkedLitres); const diff = recorded == null || !Number.isFinite(actual) ? null : actual - recorded;
  return <Modal visible={p.verifyOpen} transparent animationType="slide" onRequestClose={p.onCloseVerify}><View style={s.shade}><View style={s.sheet}><View style={s.handle} /><View style={s.sheetPerson}><Image source={farmerPortrait(farmerIndex(p, farmer?.id))} style={s.sheetPhoto} /><View style={{ flex: 1 }}><Text style={s.sheetName}>{farmer?.full_name || "Kisan"}</Text><Text style={s.meta}>{farmer?.farmer_code || "Code —"} · {source}</Text></View><Pressable onPress={p.onCloseVerify} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
    <View style={s.sourceRow}><Text style={s.meta}>Source</Text><Text style={s.sourceValue}>{source}</Text><Text style={s.shiftBadge}>{row ? shift(row) : "Automatic shift"}</Text></View>{row ? <View style={s.recorded}><Text style={s.recordedLabel}>MCA Litres (Recorded)</Text><Text style={s.recordedValue}>{fmt(recorded, " L")}</Text></View> : null}
    <View style={s.two}><Field label="Actual Litres *" value={p.checkedLitres} onChange={p.onCheckedLitres} /><Field label="Fat % *" value={p.fat} onChange={p.onFat} /></View><View style={s.two}><Field label="LR *" value={p.lr} onChange={p.onLr} /><Field label="Chiller" value={p.chiller || "—"} locked /></View>
    {diff != null ? <View style={[s.difference, Math.abs(diff) > 0.001 ? s.differenceBad : null]}><Text style={s.diffText}>Difference (Actual - MCA)</Text><Text style={s.diffValue}>{diff > 0 ? "+" : ""}{fmt(diff, " L")}</Text></View> : null}<Text style={s.helper}>ⓘ Fat aur LR MCO complete karega. Save ke baad Admin final approval karega.</Text>{p.note ? <Text style={s.modalNote}>{p.note}</Text> : null}
    <View style={s.two}><Pressable disabled={p.busy} onPress={p.onSendBack} style={s.secondary}><Text style={s.secondaryText}>Send Back</Text></Pressable><Pressable disabled={p.busy || p.readOnly} onPress={p.onSaveVerify} style={[s.save, (p.busy || p.readOnly) ? { opacity: 0.5 } : null]}><Text style={s.saveText}>{p.busy ? "Saving…" : "Verify & Save"}</Text></Pressable></View>
  </View></View></Modal>;
}
function DispatchModal({ p }: { p: Props }) { return <Modal visible={p.dispatchOpen} transparent animationType="slide" onRequestClose={p.onCloseDispatch}><View style={s.shade}><View style={s.sheet}><View style={s.handle} /><View style={s.sheetPerson}><View style={s.dispatchMark}><Text style={s.dispatchMarkText}>▣</Text></View><View style={{ flex: 1 }}><Text style={s.sheetName}>Chiller Dispatch</Text><Text style={s.meta}>{p.chiller || "Assigned chiller"}</Text></View><Pressable onPress={p.onCloseDispatch} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View>
    <Text style={s.fieldLabel}>Litres *</Text><TextInput value={p.dispatchLitres} onChangeText={p.onDispatchLitres} keyboardType="decimal-pad" placeholder="—" style={s.input} /><Text style={s.fieldLabel}>Vehicle / Tanker</Text><TextInput value={p.vehicle} onChangeText={p.onVehicle} placeholder="Vehicle name / number" style={s.input} /><Text style={s.fieldLabel}>Driver</Text><TextInput value={p.driver} onChangeText={p.onDriver} placeholder="Driver name" style={s.input} /><Text style={s.fieldLabel}>Destination</Text><TextInput value={p.destination} onChangeText={p.onDestination} placeholder="Company / dairy" style={s.input} />{p.note ? <Text style={s.modalNote}>{p.note}</Text> : null}<Pressable disabled={p.busy || p.readOnly} onPress={p.onSaveDispatch} style={[s.primary, (p.busy || p.readOnly) ? { opacity: 0.5 } : null]}><Text style={s.primaryText}>{p.busy ? "Saving…" : "Dispatch Save"}</Text></Pressable>
  </View></View></Modal>; }

export function ApprovedMcoApp(p: Props) {
  const page = useMemo(() => p.tab === "home" ? <Home p={p} /> : p.tab === "receive" ? <Receive p={p} /> : p.tab === "quality" ? <Quality p={p} /> : p.tab === "chiller" ? <Chiller p={p} /> : <More p={p} />, [p]);
  return <View style={{ flex: 1, backgroundColor: C.bg }}>{page}<VerifyModal p={p} /><DispatchModal p={p} /></View>;
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, content: { padding: 14, paddingBottom: 112 }, header: { minHeight: 62, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 11, flexDirection: "row", alignItems: "center", marginBottom: 10 }, brandMark: { width: 35, height: 35, borderRadius: 12, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", marginRight: 9 }, brandMarkText: { color: C.green2, fontSize: 18 }, brand: { color: C.green, fontSize: 17, fontWeight: "900" }, tagline: { color: C.muted, fontSize: 9 }, role: { color: C.text, fontWeight: "900", fontSize: 12 }, online: { color: C.green2, fontSize: 9, marginTop: 3 }, headline: { marginBottom: 10 }, title: { color: C.text, fontSize: 21, fontWeight: "900" }, sub: { color: C.muted, fontSize: 10, marginTop: 3 },
  identity: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", marginBottom: 14 }, staffPhoto: { width: 62, height: 62, borderRadius: 18, marginRight: 11 }, staffName: { color: C.text, fontSize: 17, fontWeight: "900" }, staffMeta: { color: C.muted, fontSize: 11, marginTop: 3 }, sectionTitle: { color: C.text, fontSize: 16, fontWeight: "900", marginBottom: 8, marginTop: 4 }, grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 6 }, stat: { width: "48.5%", minHeight: 92, borderRadius: 16, padding: 11, marginBottom: 8, borderWidth: 1, borderColor: "rgba(7,91,57,0.06)" }, statMark: { color: C.green2, fontSize: 19, fontWeight: "900" }, statLabel: { color: C.muted, fontSize: 9, marginTop: 5 }, statValue: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 5 }, actionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8 }, action: { width: "48.5%", minHeight: 58, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 15, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", marginBottom: 8 }, actionMark: { color: C.green2, fontSize: 17, marginRight: 8 }, actionText: { flex: 1, color: C.text, fontWeight: "900", fontSize: 10 }, arrow: { color: C.green2, fontSize: 21 }, routeCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 13, marginBottom: 10 }, routeTitle: { color: C.text, fontWeight: "900", fontSize: 13 }, routeMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, routeStats: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 }, routeValue: { color: C.green, fontWeight: "900", fontSize: 16 }, routeLabel: { color: C.muted, fontSize: 9 },
  two: { flexDirection: "row", justifyContent: "space-between" }, mode: { width: "48.5%", minHeight: 70, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 15, padding: 10, flexDirection: "row", alignItems: "center", marginBottom: 10 }, modeOn: { borderWidth: 2, borderColor: C.green2, backgroundColor: C.mint }, modeMark: { color: C.green2, fontSize: 20, marginRight: 8 }, modeTitle: { color: C.text, fontWeight: "900", fontSize: 10 }, modeSub: { color: C.muted, fontSize: 8, marginTop: 3 }, searchRow: { flexDirection: "row", marginBottom: 12 }, search: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: 13, backgroundColor: C.card, paddingHorizontal: 12, color: C.text }, apply: { width: 76, minHeight: 44, borderRadius: 13, backgroundColor: C.green2, alignItems: "center", justifyContent: "center", marginLeft: 8 }, applyText: { color: "#fff", fontWeight: "900" }, milkCard: { minHeight: 79, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 9, marginBottom: 8, flexDirection: "row", alignItems: "center" }, photo: { width: 54, height: 54, borderRadius: 16, marginRight: 9 }, person: { color: C.text, fontSize: 13, fontWeight: "900" }, meta: { color: C.muted, fontSize: 9, marginTop: 3 }, detail: { color: C.text, fontSize: 9, fontWeight: "700", marginTop: 4 }, open: { borderWidth: 1, borderColor: C.green2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 }, openText: { color: C.green2, fontSize: 9, fontWeight: "900" },
  filters: { flexDirection: "row", marginBottom: 10 }, filter: { flex: 1, minHeight: 37, borderWidth: 1, borderColor: C.line, backgroundColor: C.card, alignItems: "center", justifyContent: "center", borderRadius: 12, marginRight: 4, paddingHorizontal: 3 }, filterOn: { backgroundColor: C.green, borderColor: C.green }, filterText: { color: C.muted, fontSize: 8, fontWeight: "800", textAlign: "center" }, filterTextOn: { color: "#fff" }, qualityCard: { minHeight: 84, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" }, review: { backgroundColor: C.green2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, reviewText: { color: "#fff", fontSize: 9, fontWeight: "900" }, done: { backgroundColor: C.mint, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 }, doneText: { color: C.green2, fontSize: 8, fontWeight: "900" },
  primary: { minHeight: 49, backgroundColor: C.green2, borderRadius: 14, alignItems: "center", justifyContent: "center", marginBottom: 10 }, primaryText: { color: "#fff", fontSize: 13, fontWeight: "900" }, tx: { minHeight: 58, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 10, marginBottom: 7, flexDirection: "row", alignItems: "center" }, txMark: { color: C.green2, fontSize: 17, marginRight: 9 }, txTitle: { color: C.text, fontWeight: "900", fontSize: 11 }, txValue: { color: C.green, fontWeight: "900", fontSize: 12 },
  syncCard: { minHeight: 76, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 11, flexDirection: "row", alignItems: "center", marginBottom: 12 }, syncMark: { color: C.green2, fontSize: 22, marginRight: 9 }, syncBtn: { backgroundColor: C.green2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 9 }, syncBtnText: { color: "#fff", fontSize: 9, fontWeight: "900" }, queue: { minHeight: 58, backgroundColor: C.goldBg, borderRadius: 14, padding: 10, flexDirection: "row", alignItems: "center", marginBottom: 7 }, flow: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 13, flexDirection: "row", marginBottom: 10 }, flowStep: { flex: 1, alignItems: "center", borderRightWidth: 1, borderRightColor: C.line }, flowDot: { width: 25, height: 25, borderRadius: 13, backgroundColor: "#AEB7B1", alignItems: "center", justifyContent: "center" }, flowDone: { backgroundColor: C.green2 }, flowNo: { color: "#fff", fontWeight: "900", fontSize: 9 }, flowText: { color: C.muted, fontSize: 7, textAlign: "center", marginTop: 5 }, handoffInfo: { backgroundColor: C.mint, borderRadius: 14, padding: 12, marginBottom: 10 }, outline: { minHeight: 45, borderWidth: 1, borderColor: C.green2, borderRadius: 13, alignItems: "center", justifyContent: "center" }, outlineText: { color: C.green2, fontWeight: "900", fontSize: 11 },
  empty: { minHeight: 115, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, alignItems: "center", justifyContent: "center", padding: 16, marginBottom: 9 }, emptyMark: { color: C.green2, fontSize: 24, fontWeight: "900" }, emptyText: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 5 }, error: { color: C.red, fontSize: 10, marginVertical: 6 }, note: { color: C.green, fontSize: 10, marginVertical: 6, fontWeight: "700" }, readOnly: { color: C.red, fontSize: 10, marginVertical: 6 },
  shade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(7,25,15,0.52)" }, sheet: { backgroundColor: "#FBFCF8", borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 16, paddingBottom: 22 }, handle: { width: 46, height: 4, borderRadius: 2, backgroundColor: "#AEB8B1", alignSelf: "center", marginBottom: 10 }, sheetPerson: { flexDirection: "row", alignItems: "center", marginBottom: 10 }, sheetPhoto: { width: 57, height: 57, borderRadius: 17, marginRight: 10 }, sheetName: { color: C.text, fontSize: 19, fontWeight: "900" }, close: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#E8EEE8", alignItems: "center", justifyContent: "center" }, closeText: { color: C.text, fontSize: 21 }, sourceRow: { flexDirection: "row", alignItems: "center", marginBottom: 9 }, sourceValue: { flex: 1, color: C.text, fontWeight: "900", fontSize: 10, marginLeft: 8 }, shiftBadge: { backgroundColor: C.goldBg, borderRadius: 10, paddingHorizontal: 9, paddingVertical: 6, color: "#805D00", fontSize: 9, fontWeight: "900" }, recorded: { minHeight: 43, backgroundColor: "#EFF1EF", borderRadius: 11, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }, recordedLabel: { color: C.muted, fontSize: 10 }, recordedValue: { color: C.text, fontWeight: "900", fontSize: 12 }, fieldLabel: { color: C.text, fontSize: 9, fontWeight: "800", marginBottom: 4, marginTop: 6 }, input: { minHeight: 43, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 11, color: C.text, marginBottom: 5 }, inputLocked: { backgroundColor: "#EFF1EF", color: C.muted }, difference: { minHeight: 40, backgroundColor: C.mint, borderRadius: 11, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 7 }, differenceBad: { backgroundColor: C.redBg }, diffText: { color: C.text, fontSize: 9, fontWeight: "800" }, diffValue: { color: C.red, fontSize: 12, fontWeight: "900" }, helper: { color: C.muted, fontSize: 8, lineHeight: 12, marginBottom: 7 }, modalNote: { color: C.red, fontSize: 9, fontWeight: "700", marginBottom: 7 }, secondary: { width: "48.5%", minHeight: 48, borderWidth: 1, borderColor: C.green2, borderRadius: 13, alignItems: "center", justifyContent: "center" }, secondaryText: { color: C.green2, fontWeight: "900" }, save: { width: "48.5%", minHeight: 48, backgroundColor: C.green2, borderRadius: 13, alignItems: "center", justifyContent: "center" }, saveText: { color: "#fff", fontWeight: "900" }, dispatchMark: { width: 53, height: 53, borderRadius: 16, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", marginRight: 10 }, dispatchMarkText: { color: C.green2, fontSize: 24 },
});
