import type { ReactNode } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { rupees, type KhataView } from "../../../../src/lib/mobile/live-read";
import { merchantRoleLabel } from "../../../../src/lib/mobile/merchant-finance";
import { colors } from "../kit";

export type MerchantOrderView = {
  id?: string | null;
  number?: string | null;
  status?: string | null;
  amount?: number | null;
  date?: string | null;
};

type Props = {
  role: "supplier" | "dealer";
  tab: string;
  khata: KhataView;
  orders: MerchantOrderView[];
  ordersNote?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onProfile?: () => void;
};

function statusLabel(status: string | null | undefined): string {
  const key = String(status || "").toLowerCase();
  if (["approved", "confirmed"].includes(key)) return "Approved";
  if (["delivered", "completed", "paid"].includes(key)) return "Complete";
  if (["cancelled", "void", "rejected"].includes(key)) return "Cancelled";
  if (["draft", "pending", "submitted"].includes(key)) return "Pending approval";
  return status || "—";
}

function openCount(rows: MerchantOrderView[]): number {
  return rows.filter((row) => !["delivered", "completed", "paid", "cancelled", "void", "rejected"].includes(String(row.status || "").toLowerCase())).length;
}

function Page({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.green} />}>{children}<View style={{ height: 24 }} /></ScrollView>;
}

function Head({ role, title, sub }: { role: "supplier" | "dealer"; title: string; sub: string }) {
  return <View style={s.head}><View style={s.logo}><Text style={s.logoText}>⌁</Text></View><View style={{ flex: 1 }}><Text style={s.role}>{merchantRoleLabel(role)} Workspace</Text><Text style={s.title}>{title}</Text><Text style={s.sub}>{sub}</Text></View><View style={s.test}><Text style={s.testText}>TEST</Text></View></View>;
}

function Metric({ label, value, tone = "green", sub }: { label: string; value: string; tone?: "green" | "gold" | "red" | "blue"; sub?: string }) {
  return <View style={[s.metric, tone === "gold" ? s.metricGold : tone === "red" ? s.metricRed : tone === "blue" ? s.metricBlue : null]}><Text style={s.metricLabel}>{label}</Text><Text style={s.metricValue}>{value}</Text>{sub ? <Text style={s.metricSub}>{sub}</Text> : null}</View>;
}

function Tile({ title, sub, mark }: { title: string; sub: string; mark: string }) {
  return <View style={s.tile}><View style={s.tileIcon}><Text style={s.tileMark}>{mark}</Text></View><Text style={s.tileTitle}>{title}</Text><Text style={s.tileSub}>{sub}</Text></View>;
}

function OrderRows({ rows, note }: { rows: MerchantOrderView[]; note?: string | null }) {
  if (note) return <Notice title="Orders nahi khule" body={note} />;
  if (!rows.length) return <Notice title="Koi order nahi" body="Approved customer order aaye ga to number, guarantee aur settlement yahan nazar aayenge." />;
  return <View>{rows.slice(0, 20).map((row, index) => <View key={row.id || `${row.number}-${index}`} style={s.orderRow}><View style={{ flex: 1, paddingRight: 8 }}><Text style={s.orderTitle}>#{row.number || "—"}</Text><Text style={s.orderSub}>{row.date || "—"} · {row.amount == null ? "—" : rupees(row.amount)}</Text></View><View style={s.pill}><Text style={s.pillText}>{statusLabel(row.status)}</Text></View></View>)}</View>;
}

function Notice({ title, body }: { title: string; body: string }) {
  return <View style={s.notice}><Text style={s.noticeTitle}>{title}</Text><Text style={s.noticeBody}>{body}</Text></View>;
}

export function MerchantApproved({ role, tab, khata, orders, ordersNote, refreshing, onRefresh, onProfile }: Props) {
  const label = merchantRoleLabel(role);
  if (tab === "home") return <Page refreshing={refreshing} onRefresh={onRefresh}>
    <Head role={role} title="Guaranteed Sales Home" sub="AgriBridge Guarantee · Khata · Weekly Settlement" />
    <View style={s.guarantee}><View style={s.shield}><Text style={s.shieldText}>✓</Text></View><View style={{ flex: 1 }}><Text style={s.guaranteeTitle}>Payment Responsibility: AgriBridge</Text><Text style={s.guaranteeText}>Sirf Admin-approved guaranteed order par. Farmer ka default risk approval terms ke mutabiq AgriBridge manage karega.</Text></View></View>
    <View style={s.grid}>
      <Metric label="Guaranteed Receivable" value="—" sub="Settlement record nahi mila" />
      <Metric label="This Week Settlement" value="—" tone="gold" sub="Schedule record nahi mila" />
      <Metric label="Paid" value="—" tone="blue" sub="Bank proof nahi mila" />
      <Metric label="Pending Approval" value={String(openCount(orders))} tone="red" sub={ordersNote || "Open orders"} />
    </View>
    <Text style={s.sectionTitle}>Business Munshi</Text>
    <View style={s.grid}>
      <Tile mark="⌕" title="Check Customer" sub="Khata aur approved limit" />
      <Tile mark="▣" title="Guaranteed Orders" sub="Approval aur delivery" />
      <Tile mark="₨" title="Installments" sub="Weekly milk adjustment" />
      <Tile mark="⌂" title="Settlements" sub="Bank proof aur due" />
      <Tile mark="▤" title="Products & Stock" sub={`${label} business record`} />
      <Tile mark="◉" title="Profile" sub="Plan aur support" />
    </View>
  </Page>;

  if (tab === "orders") return <Page refreshing={refreshing} onRefresh={onRefresh}>
    <Head role={role} title="Guaranteed Orders" sub="Order · Approval · Delivery · Guarantee" />
    <Notice title="Guarantee rule" body="Guarantee sirf Admin approval aur delivery confirmation ke baad active hogi. Commission order ke waqt snapshot hoga; baad ki rate purane order ko nahi badle gi." />
    <View style={s.card}><Text style={s.cardTitle}>Orders</Text><OrderRows rows={orders} note={ordersNote} /></View>
  </Page>;

  if (tab === "munshi") return <Page refreshing={refreshing} onRefresh={onRefresh}>
    <Head role={role} title="Business Munshi" sub="Sale · Stock · Khata · Profit · Commission" />
    <View style={s.grid}>
      <Metric label="Gross Sales" value="—" sub="Posted sale record chahiye" />
      <Metric label="Platform Commission" value="—" tone="gold" sub="Admin rule snapshot" />
      <Metric label={`${label} Net`} value="—" tone="blue" sub="Gross minus commission" />
      <Metric label="Stock Value" value="—" sub="Linked stock record chahiye" />
    </View>
    <View style={s.card}><Text style={s.cardTitle}>Commission flexible hai</Text><Text style={s.body}>Admin percentage, fixed amount, minimum amount, category, merchant, slab aur start/end date set kar sakta hai. App mein koi 2% fixed rule nahi.</Text></View>
    <View style={s.card}><Text style={s.cardTitle}>Munshi modules</Text>{["Products & stock", "Purchases & supplier bills", "Sales & customer orders", "Receivable & payable", "Cash & bank", "Profit / loss", "Commission & platform fee", "Daily, weekly, monthly statement"].map((item) => <Text key={item} style={s.line}>✓ {item}</Text>)}</View>
  </Page>;

  if (tab === "settlements") return <Page refreshing={refreshing} onRefresh={onRefresh}>
    <Head role={role} title="Settlements & Khata" sub="Weekly adjustment · Bank proof · Statement" />
    <View style={s.flow}><Text style={s.flowText}>Weekly Milk Payment</Text><Text style={s.arrow}>→</Text><Text style={s.flowText}>Qist Adjustment</Text><Text style={s.arrow}>→</Text><Text style={s.flowText}>Remaining to Farmer Bank</Text></View>
    <View style={s.grid}>
      <Metric label="Total Guaranteed Due" value="—" sub="Guarantee ledger nahi mila" />
      <Metric label="This Week Payable" value="—" tone="gold" sub="Settlement schedule nahi mila" />
      <Metric label="Paid to Bank" value="—" tone="blue" sub="Proof nahi mila" />
      <Metric label="Remaining" value={khata.owed == null ? "—" : rupees(Math.abs(khata.owed))} tone="red" sub={khata.note || "Khata balance"} />
    </View>
    <View style={s.card}><Text style={s.cardTitle}>Recent Khata Lines</Text>{khata.linesNote ? <Notice title="Khata nahi khula" body={khata.linesNote} /> : khata.lines.length ? khata.lines.map((line, index) => <View key={`${line.entry_date}-${index}`} style={s.ledgerRow}><Text style={s.orderTitle}>{line.entry_date}</Text><Text style={s.orderSub}>{line.tafseel || line.category || "Line"}</Text><Text style={s.ledgerAmount}>{line.baqaya == null ? "—" : rupees(Number(line.baqaya))}</Text></View>) : <Notice title="Koi settlement line nahi" body="Posted qist, commission aur bank proof yahan nazar aayega." />}</View>
  </Page>;

  return <Page refreshing={refreshing} onRefresh={onRefresh}>
    <Head role={role} title="Business Profile & Plan" sub="Subscription · Bank · Support" />
    <View style={s.card}><Text style={s.cardTitle}>{label} Business</Text><Text style={s.line}>Business name: —</Text><Text style={s.line}>Phone: —</Text><Text style={s.line}>Address / territory: —</Text><Text style={s.line}>Bank account: —</Text></View>
    <View style={s.card}><Text style={s.cardTitle}>Platform Plan</Text><Text style={s.line}>Free trial end: —</Text><Text style={s.line}>Subscription plan: —</Text><Text style={s.line}>Next fee: —</Text><Text style={s.body}>Subscription fee aur transaction commission alag ledger entries hongi.</Text></View>
    <Notice title="No HR / Attendance" body={`${label} external business role hai. Is app mein salary, hazri aur leave nahi hain.`} />
    <Pressable onPress={onProfile} style={s.button}><Text style={s.buttonText}>Open Profile</Text></Pressable>
    <Pressable style={s.help}><Text style={s.helpText}>Masla Batayein</Text></Pressable>
  </Page>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F7F2" }, content: { padding: 14 }, head: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 20, padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 12 }, logo: { width: 44, height: 44, borderRadius: 15, backgroundColor: "#DFF5E7", alignItems: "center", justifyContent: "center", marginRight: 10 }, logoText: { color: colors.green, fontSize: 25, fontWeight: "900" }, role: { color: colors.green, fontSize: 12, fontWeight: "800" }, title: { color: colors.text, fontSize: 19, fontWeight: "900", marginTop: 1 }, sub: { color: colors.muted, fontSize: 11, marginTop: 3 }, test: { backgroundColor: "#FFF0C7", borderRadius: 10, paddingHorizontal: 9, paddingVertical: 5 }, testText: { color: "#7A5612", fontSize: 11, fontWeight: "900" },
  guarantee: { backgroundColor: "#FFF5D8", borderWidth: 1, borderColor: "#E8CD7C", borderRadius: 18, padding: 14, flexDirection: "row", marginBottom: 12 }, shield: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#D8A51D", alignItems: "center", justifyContent: "center", marginRight: 10 }, shieldText: { color: "#fff", fontWeight: "900", fontSize: 20 }, guaranteeTitle: { color: "#4C3608", fontWeight: "900", fontSize: 15 }, guaranteeText: { color: "#6E551C", lineHeight: 18, marginTop: 4, fontSize: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }, metric: { width: "48.5%", minHeight: 106, borderRadius: 17, padding: 13, backgroundColor: "#E8F7EE", borderWidth: 1, borderColor: "#CBE9D6", marginBottom: 10 }, metricGold: { backgroundColor: "#FFF5D8", borderColor: "#EBDCA8" }, metricRed: { backgroundColor: "#FFF0EF", borderColor: "#F2D0CD" }, metricBlue: { backgroundColor: "#EEF4FF", borderColor: "#D5E0F4" }, metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, metricValue: { color: colors.text, fontWeight: "900", fontSize: 19, marginTop: 8 }, metricSub: { color: colors.muted, fontSize: 10, lineHeight: 14, marginTop: 5 }, sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 17, marginTop: 4, marginBottom: 10 }, tile: { width: "48.5%", minHeight: 124, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 17, padding: 13, marginBottom: 10 }, tileIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#DFF5E7", alignItems: "center", justifyContent: "center", marginBottom: 9 }, tileMark: { color: colors.green, fontWeight: "900", fontSize: 18 }, tileTitle: { color: colors.text, fontWeight: "900", fontSize: 14 }, tileSub: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  card: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, marginBottom: 12 }, cardTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 10 }, body: { color: colors.muted, lineHeight: 19 }, line: { color: colors.text, marginBottom: 9, lineHeight: 18 }, orderRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EEF1ED" }, orderTitle: { color: colors.text, fontWeight: "800" }, orderSub: { color: colors.muted, fontSize: 11, marginTop: 3 }, pill: { backgroundColor: "#E8F7EE", borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5 }, pillText: { color: colors.green, fontSize: 10, fontWeight: "800" }, notice: { backgroundColor: "#F5F7F4", borderRadius: 14, padding: 12, marginBottom: 10 }, noticeTitle: { color: colors.text, fontWeight: "900" }, noticeBody: { color: colors.muted, lineHeight: 18, marginTop: 4, fontSize: 12 }, flow: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 12 }, flowText: { color: colors.text, fontSize: 10, fontWeight: "800", flex: 1, textAlign: "center" }, arrow: { color: colors.green, fontSize: 18, marginHorizontal: 3 }, ledgerRow: { paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#EEF1ED" }, ledgerAmount: { color: colors.green, fontWeight: "900", marginTop: 4 }, button: { backgroundColor: colors.green, borderRadius: 14, paddingVertical: 13, alignItems: "center", marginTop: 4 }, buttonText: { color: "#fff", fontWeight: "900" }, help: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.green, borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 10 }, helpText: { color: colors.green, fontWeight: "900" },
});
