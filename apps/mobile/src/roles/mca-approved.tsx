import { useMemo, useState } from "react";
import { Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { MilkRow, PartyRow } from "../../../../src/lib/mobile/live-read";
import type { OutboxItem } from "../../../../src/lib/mobile/queue";
import { farmerPortrait } from "../farmer-portraits";

const C = { green: "#075B39", green2: "#128044", bg: "#F7F8F3", card: "#FFFFFF", line: "#DDE7DF", text: "#14261C", muted: "#68756D", mint: "#EAF5EC", gold: "#F5B942", goldBg: "#FFF5D8", purple: "#8157C7", purpleBg: "#F1E9FF", red: "#D84A4A", redBg: "#FFE9E7", blueBg: "#EAF3FF" };

export type McaFarmer = PartyRow & { village?: string | null };

type Props = {
  tab: string;
  farmers: McaFarmer[];
  collections: MilkRow[];
  route: string;
  chiller: string;
  farmerNote: string;
  note: string;
  queue: OutboxItem[];
  queueCount: number;
  refreshing: boolean;
  readOnly: boolean;
  pickupOpen: boolean;
  selectedFarmerId: string;
  liters: string;
  lr: string;
  shift: "morning" | "evening";
  shiftUnlocked: boolean;
  transport: "mca" | "mco";
  proofAttached: boolean;
  busy: boolean;
  editingId: string;
  onTab?: (key: string) => void;
  onProfile?: () => void;
  onRefresh: () => void;
  onSync: () => void;
  onOpenFarmer: (id: string) => void;
  onOpenEdit: (row: MilkRow) => void;
  onClosePickup: () => void;
  onLiters: (value: string) => void;
  onLr: (value: string) => void;
  onShift: (value: "morning" | "evening") => void;
  onUnlockShift: () => void;
  onTransport: (value: "mca" | "mco") => void;
  onProof: () => void;
  onSave: () => void;
};

function n(value: number | string | null | undefined): number { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; }
function litres(row: MilkRow): number { return n(row.quantity_liters ?? row.field_collected_volume); }
function showNum(value: number | null, suffix = ""): string { if (value == null) return "—"; return `${Number.isInteger(value) ? value.toLocaleString("en-PK") : value.toFixed(2).replace(/\.00$/, "")}${suffix}`; }
function timeOf(row: MilkRow): string { const raw = row.collected_at; if (!raw) return "—"; const d = new Date(raw); if (Number.isNaN(d.getTime())) return "—"; return new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", hour: "2-digit", minute: "2-digit" }).format(d); }
function statusOf(row: MilkRow | undefined): { label: string; tone: "green" | "purple" | "gold"; locked: boolean } {
  if (!row) return { label: "Baqi", tone: "gold", locked: false };
  if (row.status === "verified") return { label: "Verified", tone: "green", locked: true };
  if (row.status === "priced") return { label: "Fat laga", tone: "green", locked: true };
  return { label: "MCO pending", tone: "purple", locked: false };
}

function Page({ children, p }: { children: React.ReactNode; p: Props }) {
  return <ScrollView style={styles.page} contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} tintColor={C.green2} />}>{children}</ScrollView>;
}

function BrandHeader({ title, p }: { title: string; p: Props }) {
  return <View style={styles.header}><View style={styles.brandMark}><Text style={styles.brandMarkText}>◆</Text></View><View style={{ flex: 1 }}><Text style={styles.brand}>AgriBridge</Text><Text style={styles.tagline}>Kisan ka Wasela</Text></View><View style={{ alignItems: "flex-end" }}><Text style={styles.role}>{title}</Text><Text style={styles.online}>● Online</Text></View></View>;
}

function ScreenHead({ title, sub, p }: { title: string; sub?: string; p: Props }) { return <><BrandHeader title="MCA" p={p} /><View style={styles.screenHead}><View><Text style={styles.screenTitle}>{title}</Text>{sub ? <Text style={styles.screenSub}>{sub}</Text> : null}</View></View></>; }

function Stat({ mark, label, value, tint = C.mint }: { mark: string; label: string; value: string; tint?: string }) { return <View style={[styles.stat, { backgroundColor: tint }]}><Text style={styles.statMark}>{mark}</Text><Text style={styles.statLabel}>{label}</Text><Text style={styles.statValue}>{value}</Text></View>; }

function Home({ p }: { p: Props }) {
  const today = p.collections;
  const morning = today.filter((row) => row.shift === "morning");
  const evening = today.filter((row) => row.shift === "evening");
  const total = today.length ? today.reduce((sum, row) => sum + litres(row), 0) : null;
  const morningL = morning.length ? morning.reduce((sum, row) => sum + litres(row), 0) : null;
  const eveningL = evening.length ? evening.reduce((sum, row) => sum + litres(row), 0) : null;
  const done = new Set(today.map((row) => row.farmer_id).filter(Boolean)).size;
  return <Page p={p}><BrandHeader title="MCA" p={p} />
    <View style={styles.identity}><Image source={farmerPortrait(9)} style={styles.staffPhoto} /><View style={{ flex: 1 }}><Text style={styles.staffName}>Milk Collection Agent</Text><Text style={styles.staffMeta}>Route: {p.route || "—"}</Text><Text style={styles.staffMeta}>Chiller: {p.chiller || "—"}</Text></View></View>
    <Text style={styles.sectionTitle}>Aaj ka Khaka</Text>
    <View style={styles.statGrid}><Stat mark="◉" label="Aaj ka Total" value={showNum(total, " L")} /><Stat mark="☀" label="Subah" value={showNum(morningL, " L")} tint={C.goldBg} /><Stat mark="☾" label="Shaam" value={showNum(eveningL, " L")} tint={C.blueBg} /><Stat mark="✓" label="Farmers Complete" value={today.length ? String(done) : "—"} /><Stat mark="◷" label="Farmers Pending" value={p.farmers.length ? String(Math.max(0, p.farmers.length - done)) : "—"} tint={C.goldBg} /><Stat mark="↻" label="Offline Queue" value={p.queueCount ? String(p.queueCount) : "—"} tint={C.blueBg} /></View>
    <Pressable onPress={() => p.onTab?.("route")} style={styles.primary}><Text style={styles.primaryMark}>◉</Text><Text style={styles.primaryText}>Doodh uthana</Text><Text style={styles.primaryArrow}>›</Text></Pressable>
    <View style={styles.two}><Pressable onPress={() => p.onTab?.("sync")} style={styles.infoCard}><Text style={styles.infoMark}>☁</Text><View><Text style={styles.infoTitle}>Offline Queue</Text><Text style={styles.infoSub}>{p.queueCount ? `${p.queueCount} entries` : "— entries"}</Text></View></Pressable><Pressable onPress={() => p.onTab?.("sync")} style={styles.infoCard}><Text style={styles.infoMark}>↻</Text><View><Text style={styles.infoTitle}>Sync Status</Text><Text style={styles.infoSub}>Last sync: —</Text></View></Pressable></View>
  </Page>;
}

function farmerRowFor(p: Props, farmerId: string, shift: "morning" | "evening"): MilkRow | undefined { return p.collections.find((row) => row.farmer_id === farmerId && row.shift === shift); }

function StatusChip({ row, label }: { row?: MilkRow; label: string }) { const s = statusOf(row); return <View style={[styles.statusChip, s.tone === "green" ? styles.statusGreen : s.tone === "purple" ? styles.statusPurple : styles.statusGold]}><Text style={styles.statusShift}>{label}</Text><Text style={[styles.statusText, s.tone === "purple" ? { color: C.purple } : s.tone === "green" ? { color: C.green2 } : null]}>{s.label}</Text></View>; }

function RouteList({ p }: { p: Props }) {
  const [draft, setDraft] = useState(""); const [query, setQuery] = useState("");
  const shown = p.farmers.filter((farmer) => `${farmer.full_name || ""} ${farmer.farmer_code || ""} ${farmer.village || ""}`.toLowerCase().includes(query.toLowerCase())).slice(0, 10);
  return <Page p={p}><ScreenHead title={`Aaj ki Route (${p.farmers.length || "—"} farmers)`} sub={`${p.route || "Route —"} · ${p.chiller || "Chiller —"}`} p={p} />
    <View style={styles.searchRow}><TextInput value={draft} onChangeText={setDraft} placeholder="Farmer naam ya code se dhoondein" style={styles.search} /><Pressable onPress={() => setQuery(draft.trim())} style={styles.apply}><Text style={styles.applyText}>Apply</Text></Pressable></View>
    {p.farmerNote ? <Text style={styles.error}>{p.farmerNote}</Text> : null}
    {shown.map((farmer, index) => { const morning = farmer.id ? farmerRowFor(p, farmer.id, "morning") : undefined; const evening = farmer.id ? farmerRowFor(p, farmer.id, "evening") : undefined; return <Pressable key={farmer.id || String(index)} onPress={() => farmer.id && p.onOpenFarmer(farmer.id)} style={styles.farmerCard}><Image source={farmerPortrait(index)} style={styles.farmerPhoto} /><View style={{ flex: 1 }}><Text style={styles.farmerName}>{farmer.full_name || "Kisan"}</Text><Text style={styles.farmerMeta}>{farmer.farmer_code || "Code —"}{farmer.village ? ` · ${farmer.village}` : ""}</Text></View><StatusChip row={morning} label="Subah" /><StatusChip row={evening} label="Shaam" /><Text style={styles.chevron}>›</Text></Pressable>; })}
    {!shown.length ? <Empty text="Is search mein koi farmer nahi mila." /> : null}
  </Page>;
}

function Collections({ p }: { p: Props }) {
  const [filter, setFilter] = useState<"all" | "morning" | "evening" | "pending">("all");
  const rows = p.collections.filter((row) => filter === "all" ? true : filter === "pending" ? row.status === "pending_fat" : row.shift === filter);
  return <Page p={p}><ScreenHead title="Today's Collections" sub="Apni aaj ki milk entries" p={p} />
    <View style={styles.filterRow}>{(["all", "morning", "evening", "pending"] as const).map((key) => <Pressable key={key} onPress={() => setFilter(key)} style={[styles.filter, filter === key ? styles.filterOn : null]}><Text style={[styles.filterText, filter === key ? styles.filterTextOn : null]}>{key === "all" ? "All" : key === "morning" ? "Subah" : key === "evening" ? "Shaam" : "Pending"}</Text></Pressable>)}</View>
    {rows.length ? rows.map((row, index) => { const farmerIndex = Math.max(0, p.farmers.findIndex((f) => f.id === row.farmer_id)); const farmer = p.farmers[farmerIndex]; const status = statusOf(row); const editable = row.status === "pending_fat" && !p.readOnly; return <View key={row.id || String(index)} style={styles.collectionCard}><Image source={farmerPortrait(farmerIndex)} style={styles.collectionPhoto} /><View style={{ flex: 1 }}><Text style={styles.farmerName}>{farmer?.full_name || "Kisan"}</Text><Text style={styles.farmerMeta}>{timeOf(row)} · {row.shift === "evening" ? "Shaam" : "Subah"}</Text><Text style={styles.collectionDetail}>Litres {showNum(litres(row))} · LR {row.lr ?? "—"}</Text></View>{editable ? <Pressable onPress={() => p.onOpenEdit(row)} style={styles.edit}><Text style={styles.editText}>Edit</Text></Pressable> : <View style={[styles.locked, status.tone === "green" ? styles.statusGreen : styles.statusPurple]}><Text style={styles.lockText}>{status.locked ? "✓ Locked" : status.label}</Text></View>}</View>; }) : <Empty text="Is filter mein koi collection nahi." />}
  </Page>;
}

function Sync({ p }: { p: Props }) {
  return <Page p={p}><ScreenHead title="Offline & Sync" sub="Internet na ho to entry phone mein safe" p={p} />
    <View style={styles.syncInfo}><Text style={styles.syncInfoMark}>⌁</Text><View style={{ flex: 1 }}><Text style={styles.syncInfoTitle}>Entries aap ke phone mein safe hain</Text><Text style={styles.syncInfoSub}>Internet wapas aate hi Sync Now dabayein. Client UUID duplicate entry ko rokta hai.</Text></View></View>
    <Text style={styles.sectionTitle}>Offline Queue ({p.queueCount || "—"})</Text>
    {p.queue.length ? p.queue.map((item, index) => <View key={item.clientUuid} style={styles.queueCard}><Image source={farmerPortrait(index)} style={styles.queuePhoto} /><View style={{ flex: 1 }}><Text style={styles.farmerName}>{item.kind === "pickup" ? String(item.payload.farmer_name || "Milk pickup") : item.kind}</Text><Text style={styles.farmerMeta}>{new Date(item.createdAt).toLocaleString("en-PK")} · {item.payload.liters ? `${item.payload.liters} L` : "—"}</Text>{item.error ? <Text style={styles.queueError}>{item.error}</Text> : null}</View><View style={styles.retry}><Text style={styles.retryText}>{item.error ? "Retry" : "Queued"}</Text></View></View>) : <Empty text="Koi offline entry nahi. Sab sync hai." />}
    <Pressable onPress={p.onSync} style={styles.primary}><Text style={styles.primaryMark}>↻</Text><Text style={styles.primaryText}>Sync Now</Text></Pressable>
    {p.note ? <Text style={styles.note}>{p.note}</Text> : null}
  </Page>;
}

function Handoff({ p }: { p: Props }) {
  const pending = p.collections.filter((row) => row.status === "pending_fat"); const done = p.collections.filter((row) => row.status === "priced" || row.status === "verified");
  return <Page p={p}><ScreenHead title="MCO Handoff" sub="Collection se farmer ledger tak" p={p} />
    {[...pending, ...done].slice(0, 10).map((row, index) => { const farmerIndex = Math.max(0, p.farmers.findIndex((f) => f.id === row.farmer_id)); const farmer = p.farmers[farmerIndex]; const verified = row.status === "verified" || row.status === "priced"; return <View key={row.id || String(index)} style={styles.handoff}><View style={styles.handoffHead}><Image source={farmerPortrait(farmerIndex)} style={styles.handoffPhoto} /><View style={{ flex: 1 }}><Text style={styles.farmerName}>{farmer?.full_name || "Kisan"}</Text><Text style={styles.farmerMeta}>{farmer?.farmer_code || "—"} · {showNum(litres(row), " L")}</Text></View><View style={[styles.handoffPill, verified ? styles.statusGreen : styles.statusPurple]}><Text style={{ color: verified ? C.green2 : C.purple, fontWeight: "900", fontSize: 10 }}>{verified ? "Verified" : "MCO pending"}</Text></View></View><View style={styles.flow}><Flow label="MCA saved" done /><Flow label="Chiller received" done={verified} /><Flow label="Fat + LR checked" done={verified} /><Flow label="Farmer ledger posted" done={row.status === "verified"} last /></View>{!verified ? <View style={styles.pendingInfo}><Text style={styles.pendingMark}>!</Text><Text style={styles.pendingText}>{row.lr == null ? "MCO se LR/Fat baqi" : "LR darj hai · MCO Fat verify karega"}</Text></View> : null}</View>; })}
    {!p.collections.length ? <Empty text="Aaj ki collection ke baad handoff yahan nazar aayega." /> : null}
    <Pressable onPress={p.onProfile} style={styles.profileBtn}><Text style={styles.profileBtnText}>Profile aur route settings</Text></Pressable>
  </Page>;
}

function Flow({ label, done, last }: { label: string; done?: boolean; last?: boolean }) { return <View style={[styles.flowItem, last ? { borderRightWidth: 0 } : null]}><View style={[styles.flowDot, done ? styles.flowDone : null]}><Text style={styles.flowDotText}>{done ? "✓" : "•"}</Text></View><Text style={styles.flowLabel}>{label}</Text></View>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyMark}>—</Text><Text style={styles.emptyText}>{text}</Text></View>; }

function Choice({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) { return <Pressable onPress={onPress} style={[styles.choice, on ? styles.choiceOn : null]}><View style={[styles.radio, on ? styles.radioOn : null]}>{on ? <View style={styles.radioInner} /> : null}</View><Text style={[styles.choiceText, on ? { color: C.green } : null]}>{label}</Text></Pressable>; }

function PickupModal({ p }: { p: Props }) {
  const index = Math.max(0, p.farmers.findIndex((farmer) => farmer.id === p.selectedFarmerId)); const farmer = p.farmers[index];
  return <Modal visible={p.pickupOpen} transparent animationType="slide" onRequestClose={p.onClosePickup}><View style={styles.modalShade}><View style={styles.sheet}>
    <View style={styles.sheetHandle} /><View style={styles.sheetPerson}><Image source={farmerPortrait(index)} style={styles.sheetPhoto} /><View style={{ flex: 1 }}><Text style={styles.sheetName}>{farmer?.full_name || "Kisan"}</Text><Text style={styles.sheetMeta}>{farmer?.farmer_code || "Code —"}{farmer?.village ? ` · ${farmer.village}` : ""}</Text></View><Pressable onPress={p.onClosePickup} style={styles.close}><Text style={styles.closeText}>×</Text></Pressable></View>
    <View style={styles.rule}><Text style={styles.ruleMark}>◷</Text><View style={{ flex: 1 }}><Text style={styles.ruleTitle}>12:00 pm se pehle Subah · baad mein Shaam</Text><Text style={styles.ruleSub}>Shift khud-ba-khud select hoti hai.</Text></View></View>
    <View style={styles.shiftRow}><Text style={styles.fieldLabel}>Shift {p.shiftUnlocked ? "(editable)" : "(automatic)"}</Text><View style={styles.shiftBadge}><Text style={styles.shiftBadgeText}>{p.shift === "morning" ? "☀ Subah" : "☾ Shaam"}</Text></View><Pressable onPress={p.onUnlockShift} style={styles.change}><Text style={styles.changeText}>Badlein</Text></Pressable></View>
    {p.shiftUnlocked ? <View style={styles.two}><Choice on={p.shift === "morning"} label="Subah" onPress={() => p.onShift("morning")} /><Choice on={p.shift === "evening"} label="Shaam" onPress={() => p.onShift("evening")} /></View> : null}
    <View style={styles.two}><View style={{ width: "48.5%" }}><Text style={styles.fieldLabel}>Litres *</Text><TextInput value={p.liters} onChangeText={p.onLiters} keyboardType="decimal-pad" placeholder="—" style={styles.input} /></View><View style={{ width: "48.5%" }}><Text style={styles.fieldLabel}>LR (ikhtiyari)</Text><TextInput value={p.lr} onChangeText={p.onLr} keyboardType="decimal-pad" placeholder="—" style={styles.input} /></View></View>
    <Text style={styles.helper}>ⓘ LR khali ho to MCO chiller par LR aur Fat complete karega.</Text>
    <View style={styles.fixedMethod}><Text style={styles.fixedMethodMark}>●</Text><View><Text style={styles.fixedMethodTitle}>Field Collection</Text><Text style={styles.fixedMethodSub}>DCA / MCA farmer gate se doodh collect karta hai</Text></View></View>
    <Text style={styles.fieldLabel}>Transport to MCC</Text><View style={styles.two}><Choice on={p.transport === "mca"} label="Meri transport (MCA)" onPress={() => p.onTransport("mca")} /><Choice on={p.transport === "mco"} label="MCO ki transport" onPress={() => p.onTransport("mco")} /></View>
    <Pressable onPress={p.onProof} style={styles.proof}><Text style={styles.proofMark}>▣</Text><Text style={styles.proofText}>{p.proofAttached ? "Photo / Proof lag gayi" : "Photo / Proof (ikhtiyari)"}</Text><Text style={styles.chevron}>›</Text></Pressable>
    {p.note ? <Text style={[styles.modalNote, /save ho gaya|queue/i.test(p.note) ? { color: C.green2 } : null]}>{p.note}</Text> : null}
    <Pressable disabled={p.busy || p.readOnly} onPress={p.onSave} style={[styles.primary, (p.busy || p.readOnly) ? { opacity: 0.5 } : null]}><Text style={styles.primaryText}>{p.busy ? "Save ho raha hai…" : p.editingId ? "Tabdeeli save karein" : "Doodh save karein"}</Text></Pressable>
  </View></View></Modal>;
}

export function ApprovedMcaApp(p: Props) {
  const page = useMemo(() => p.tab === "home" ? <Home p={p} /> : p.tab === "route" ? <RouteList p={p} /> : p.tab === "collections" ? <Collections p={p} /> : p.tab === "sync" ? <Sync p={p} /> : <Handoff p={p} />, [p]);
  return <View style={{ flex: 1, backgroundColor: C.bg }}>{page}<PickupModal p={p} /></View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.bg }, content: { padding: 14, paddingBottom: 112 }, header: { minHeight: 62, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 11, flexDirection: "row", alignItems: "center", marginBottom: 10 }, brandMark: { width: 35, height: 35, borderRadius: 12, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", marginRight: 9 }, brandMarkText: { color: C.green2, fontSize: 18 }, brand: { color: C.green, fontSize: 17, fontWeight: "900" }, tagline: { color: C.muted, fontSize: 9 }, role: { color: C.text, fontWeight: "900", fontSize: 12 }, online: { color: C.green2, fontSize: 9, marginTop: 3 },
  identity: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 13, flexDirection: "row", alignItems: "center", marginBottom: 14 }, staffPhoto: { width: 62, height: 62, borderRadius: 18, marginRight: 11 }, staffName: { color: C.text, fontSize: 17, fontWeight: "900" }, staffMeta: { color: C.muted, fontSize: 11, marginTop: 3 }, sectionTitle: { color: C.text, fontSize: 16, fontWeight: "900", marginBottom: 8 }, statGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 5 }, stat: { width: "31.8%", minHeight: 99, borderRadius: 16, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: "rgba(7,91,57,0.06)" }, statMark: { color: C.green2, fontSize: 20, fontWeight: "900" }, statLabel: { color: C.muted, fontSize: 9, lineHeight: 12, marginTop: 6 }, statValue: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 5 },
  primary: { minHeight: 52, backgroundColor: C.green2, borderRadius: 15, paddingHorizontal: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", marginBottom: 10 }, primaryMark: { color: "#fff", fontSize: 20, marginRight: 10 }, primaryText: { color: "#fff", fontSize: 15, fontWeight: "900", flex: 1, textAlign: "center" }, primaryArrow: { color: "#fff", fontSize: 25 }, two: { flexDirection: "row", justifyContent: "space-between" }, infoCard: { width: "48.5%", minHeight: 76, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 12, flexDirection: "row", alignItems: "center" }, infoMark: { color: C.green2, fontSize: 22, marginRight: 9 }, infoTitle: { color: C.text, fontWeight: "800", fontSize: 11 }, infoSub: { color: C.muted, fontSize: 9, marginTop: 3 },
  screenHead: { marginBottom: 10 }, screenTitle: { color: C.text, fontSize: 21, fontWeight: "900" }, screenSub: { color: C.muted, fontSize: 10, marginTop: 3 }, searchRow: { flexDirection: "row", marginBottom: 10 }, search: { flex: 1, minHeight: 44, borderWidth: 1, borderColor: C.line, borderRadius: 13, backgroundColor: C.card, paddingHorizontal: 12, color: C.text }, apply: { width: 78, minHeight: 44, backgroundColor: C.green2, borderRadius: 13, alignItems: "center", justifyContent: "center", marginLeft: 8 }, applyText: { color: "#fff", fontWeight: "900" }, error: { color: C.red, marginBottom: 8, fontSize: 11 }, farmerCard: { minHeight: 78, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 9, marginBottom: 8, flexDirection: "row", alignItems: "center" }, farmerPhoto: { width: 54, height: 54, borderRadius: 16, marginRight: 9 }, farmerName: { color: C.text, fontWeight: "900", fontSize: 13 }, farmerMeta: { color: C.muted, fontSize: 9, marginTop: 3 }, statusChip: { minWidth: 52, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 5, marginLeft: 4, alignItems: "center" }, statusGreen: { backgroundColor: C.mint }, statusPurple: { backgroundColor: C.purpleBg }, statusGold: { backgroundColor: C.goldBg }, statusShift: { color: C.muted, fontSize: 7 }, statusText: { color: "#9A6A00", fontSize: 8, fontWeight: "900", marginTop: 1 }, chevron: { color: C.green, fontSize: 24, marginLeft: 4 },
  filterRow: { flexDirection: "row", marginBottom: 10 }, filter: { flex: 1, minHeight: 38, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, alignItems: "center", justifyContent: "center", borderRadius: 12, marginRight: 5 }, filterOn: { backgroundColor: C.green, borderColor: C.green }, filterText: { color: C.muted, fontSize: 10, fontWeight: "800" }, filterTextOn: { color: "#fff" }, collectionCard: { minHeight: 84, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" }, collectionPhoto: { width: 54, height: 54, borderRadius: 16, marginRight: 10 }, collectionDetail: { color: C.text, fontSize: 10, marginTop: 4, fontWeight: "700" }, edit: { borderWidth: 1, borderColor: C.green2, borderRadius: 11, paddingHorizontal: 13, paddingVertical: 8 }, editText: { color: C.green2, fontWeight: "900", fontSize: 10 }, locked: { borderRadius: 10, paddingHorizontal: 9, paddingVertical: 8 }, lockText: { color: C.green2, fontWeight: "900", fontSize: 9 },
  syncInfo: { backgroundColor: C.blueBg, borderRadius: 17, padding: 13, flexDirection: "row", alignItems: "center", marginBottom: 14 }, syncInfoMark: { color: "#1E70C1", fontSize: 26, marginRight: 10 }, syncInfoTitle: { color: C.text, fontWeight: "900", fontSize: 12 }, syncInfoSub: { color: C.muted, fontSize: 9, lineHeight: 13, marginTop: 3 }, queueCard: { minHeight: 74, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 16, padding: 10, marginBottom: 8, flexDirection: "row", alignItems: "center" }, queuePhoto: { width: 48, height: 48, borderRadius: 14, marginRight: 9 }, retry: { backgroundColor: C.goldBg, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7 }, retryText: { color: "#A86E05", fontWeight: "900", fontSize: 9 }, queueError: { color: C.red, fontSize: 8, marginTop: 3 }, note: { color: C.muted, fontSize: 10, textAlign: "center" },
  handoff: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 12, marginBottom: 10 }, handoffHead: { flexDirection: "row", alignItems: "center" }, handoffPhoto: { width: 46, height: 46, borderRadius: 14, marginRight: 9 }, handoffPill: { borderRadius: 11, paddingHorizontal: 9, paddingVertical: 7 }, flow: { flexDirection: "row", marginTop: 18 }, flowItem: { flex: 1, alignItems: "center", borderRightWidth: 1, borderRightColor: C.line }, flowDot: { width: 22, height: 22, borderRadius: 11, backgroundColor: "#CFD6D1", alignItems: "center", justifyContent: "center" }, flowDone: { backgroundColor: C.green2 }, flowDotText: { color: "#fff", fontWeight: "900", fontSize: 10 }, flowLabel: { color: C.muted, fontSize: 7, textAlign: "center", marginTop: 5 }, pendingInfo: { backgroundColor: C.goldBg, borderRadius: 11, padding: 9, flexDirection: "row", alignItems: "center", marginTop: 11 }, pendingMark: { color: "#A86E05", fontWeight: "900", marginRight: 7 }, pendingText: { color: "#735314", fontSize: 9, fontWeight: "700" }, profileBtn: { borderWidth: 1, borderColor: C.green2, borderRadius: 14, minHeight: 46, alignItems: "center", justifyContent: "center" }, profileBtnText: { color: C.green2, fontWeight: "900" },
  empty: { minHeight: 120, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, alignItems: "center", justifyContent: "center", padding: 16 }, emptyMark: { color: C.green2, fontSize: 24, fontWeight: "900" }, emptyText: { color: C.muted, fontSize: 10, textAlign: "center", marginTop: 5 },
  modalShade: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(7,25,15,0.52)" }, sheet: { backgroundColor: "#FBFCF8", borderTopLeftRadius: 27, borderTopRightRadius: 27, padding: 16, paddingBottom: 20 }, sheetHandle: { width: 46, height: 4, borderRadius: 2, backgroundColor: "#AEB8B1", alignSelf: "center", marginBottom: 10 }, sheetPerson: { flexDirection: "row", alignItems: "center", marginBottom: 9 }, sheetPhoto: { width: 57, height: 57, borderRadius: 17, marginRight: 10 }, sheetName: { color: C.text, fontSize: 19, fontWeight: "900" }, sheetMeta: { color: C.muted, fontSize: 10, marginTop: 3 }, close: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#E8EEE8", alignItems: "center", justifyContent: "center" }, closeText: { color: C.text, fontSize: 21 }, rule: { backgroundColor: C.mint, borderRadius: 13, padding: 9, flexDirection: "row", alignItems: "center", marginBottom: 8 }, ruleMark: { color: C.green2, fontSize: 20, marginRight: 8 }, ruleTitle: { color: C.green, fontWeight: "900", fontSize: 11 }, ruleSub: { color: C.muted, fontSize: 8, marginTop: 2 }, shiftRow: { minHeight: 38, flexDirection: "row", alignItems: "center", marginBottom: 6 }, fieldLabel: { color: C.text, fontSize: 9, fontWeight: "800", marginBottom: 4, flex: 1 }, shiftBadge: { backgroundColor: C.goldBg, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 7 }, shiftBadgeText: { color: "#8A6100", fontWeight: "900", fontSize: 10 }, change: { borderWidth: 1, borderColor: C.green2, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 7, marginLeft: 7 }, changeText: { color: C.green2, fontWeight: "900", fontSize: 9 }, choice: { width: "48.5%", minHeight: 39, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", backgroundColor: C.card, marginBottom: 7 }, choiceOn: { borderColor: C.green2, backgroundColor: C.mint }, radio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: "#AAB4AD", alignItems: "center", justifyContent: "center", marginRight: 7 }, radioOn: { borderColor: C.green2 }, radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.green2 }, choiceText: { color: C.text, fontSize: 9, fontWeight: "800" }, input: { minHeight: 43, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 11, color: C.text }, helper: { color: C.muted, fontSize: 8, marginBottom: 7 }, proof: { minHeight: 41, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 11, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", marginBottom: 6 }, proofMark: { color: C.green2, fontSize: 15, marginRight: 8 }, proofText: { flex: 1, color: C.text, fontSize: 9, fontWeight: "800" }, modalNote: { color: C.red, fontSize: 9, lineHeight: 13, marginBottom: 6, fontWeight: "700" }, fixedMethod: { minHeight: 43, borderWidth: 1, borderColor: C.green2, borderRadius: 11, backgroundColor: C.mint, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", marginBottom: 7 }, fixedMethodMark: { color: C.green2, marginRight: 8 }, fixedMethodTitle: { color: C.green, fontSize: 10, fontWeight: "900" }, fixedMethodSub: { color: C.muted, fontSize: 8, marginTop: 2 },
});
