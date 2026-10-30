import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { liveGet, liveGetScoped, type LiveAuth } from "../../../../src/lib/mobile/live-read";
import { resolveWorkspaces, WORK_LABELS, type WorkKey } from "../../../../src/lib/mobile/work-access";
import { colors } from "../kit";

type StaffRow = { designation?: string | null; department?: string | null; field_app_role?: string | null; milk_route_name?: string | null; milk_chiller_name?: string | null };
type ProfileRow = { role?: string | null; full_name?: string | null; branch_id?: string | null };
type PermissionRow = { feature_key?: string | null; actions?: string[] | null; expires_at?: string | null };
type Operation = { title: string; sub: string; route: string };

const OPERATIONS: Record<WorkKey, { title: string; sub: string; route: string }[]> = {
  karyana: [
    { title: "POS Sale", sub: "Create new sale", route: "/admin/pos" },
    { title: "Load & Bill", sub: "Load stock & create bill", route: "/admin/load-bill" },
    { title: "Udhaar", sub: "Manage customer credit", route: "/admin/load-bill" },
    { title: "Recovery", sub: "Collect payments", route: "/admin/recovery" },
    { title: "Stock Count", sub: "Physical stock count", route: "/admin/stock-count" },
    { title: "Cash Handover", sub: "End of day handover", route: "/admin/cash-handover" },
  ],
  finance: [
    { title: "Accounts", sub: "Chart of accounts", route: "/admin/finance" },
    { title: "Payments", sub: "Make and receive payments", route: "/admin/finance" },
    { title: "Recovery", sub: "Customer recovery", route: "/admin/recovery" },
    { title: "Bank Transfer", sub: "Send or receive", route: "/admin/finance/transfers" },
    { title: "Cash Verification", sub: "Verify cash in hand", route: "/admin/cash-close" },
    { title: "Ledger Review", sub: "View and reconcile", route: "/admin/finance" },
  ],
  warehouse: [
    { title: "Stock Receive", sub: "Receive inventory", route: "/admin/purchases/grn" },
    { title: "GRN Queue", sub: "Pending receipts", route: "/admin/purchases/grn" },
    { title: "Stock Transfer", sub: "Between locations", route: "/admin/inventory/transfers" },
    { title: "Stock Count", sub: "Physical verification", route: "/admin/stock-count" },
    { title: "Expiry", sub: "Batch and expiry", route: "/admin/inventory" },
  ],
  purchase: [
    { title: "Purchase Bill", sub: "Qty × trade rate", route: "/admin/purchases/supplier-bill" },
    { title: "CSV Bill", sub: "Import and safely map", route: "/admin/purchases/supplier-bill" },
    { title: "Supplier", sub: "Supplier accounts", route: "/admin/suppliers" },
    { title: "Payables", sub: "Bills and due amount", route: "/admin/purchases/payables" },
  ],
  milk: [
    { title: "Collection", sub: "Farmer milk entries", route: "/admin/milk-collection" },
    { title: "Quality", sub: "Fat and LR", route: "/admin/milk-collection/verify" },
    { title: "Chiller", sub: "Receiving and dispatch", route: "/admin/milk-collection" },
    { title: "Farmer Ledger", sub: "Milk payable link", route: "/admin/farmers" },
  ],
  vet: [
    { title: "Visits", sub: "Assigned field visits", route: "/admin/vet" },
    { title: "Treatment", sub: "Animal treatment", route: "/admin/vet" },
    { title: "Vaccination", sub: "Vaccine record", route: "/admin/vet" },
    { title: "Follow-up", sub: "Due cases", route: "/admin/vet" },
  ],
  grain: [
    { title: "Purchase", sub: "Farmer or party purchase", route: "/admin/grain-procurement" },
    { title: "Weight & Bags", sub: "Kg, maund and bags", route: "/admin/grain-procurement" },
    { title: "Cut & Chungi", sub: "Editable business rules", route: "/admin/grain-procurement" },
    { title: "Ledger", sub: "Linked grain statement", route: "/admin/grain" },
  ],
  delivery: [
    { title: "Orders", sub: "Ready for delivery", route: "/admin/orders" },
    { title: "Dispatch", sub: "Assign and dispatch", route: "/admin/orders" },
    { title: "Cash", sub: "Cash collected", route: "/admin/cash-handover" },
    { title: "Proof", sub: "Delivery proof", route: "/admin/orders" },
  ],
};

async function loadStaffRow(auth: LiveAuth, id: string) {
  const full = await liveGetScoped<StaffRow>(auth, `staff_details?select=designation,department,field_app_role,milk_route_name,milk_chiller_name&profile_id=eq.${encodeURIComponent(id)}&limit=1`, fetch);
  if (full.ok) return full;
  return liveGetScoped<StaffRow>(auth, `staff_details?select=designation,field_app_role,milk_route_name,milk_chiller_name&profile_id=eq.${encodeURIComponent(id)}&limit=1`, fetch);
}

export function StaffWorkspace({ auth, userId, portalUrl, appRole = "staff" }: { auth: LiveAuth; userId: string; portalUrl?: string | null; appRole?: string }) {
  const [staff, setStaff] = useState<StaffRow | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [selected, setSelected] = useState<WorkKey | null>(null);
  const [note, setNote] = useState("");
  const [opened, setOpened] = useState<Operation | null>(null);
  const [busy, setBusy] = useState(true);
  const load = useCallback(async () => {
    setBusy(true);
    const [staffRead, profileRead, permissionRead] = await Promise.all([
      loadStaffRow(auth, userId),
      liveGet<ProfileRow>(auth, `profiles?select=role,full_name,branch_id&id=eq.${encodeURIComponent(userId)}&limit=1`, fetch),
      liveGet<PermissionRow>(auth, `user_feature_permissions?select=feature_key,actions,expires_at&profile_id=eq.${encodeURIComponent(userId)}&limit=300`, fetch),
    ]);
    setStaff(staffRead.ok ? staffRead.rows[0] || null : null);
    setProfile(profileRead.ok ? profileRead.rows[0] || null : null);
    setPermissions(permissionRead.ok ? permissionRead.rows : []);
    setBusy(false);
  }, [auth.token, auth.url, userId]);
  useEffect(() => { void load(); }, [load]);
  const workspaces = useMemo(() => resolveWorkspaces({
    portalRole: profile?.role,
    appRole,
    designation: staff?.designation,
    department: staff?.department,
    featureKeys: permissions.filter((row) => !row.expires_at || new Date(row.expires_at).getTime() > Date.now()).map((row) => row.feature_key || ""),
  }), [profile?.role, appRole, staff?.designation, staff?.department, permissions]);
  useEffect(() => { if (!selected && workspaces.length) setSelected(workspaces[0]); }, [selected, workspaces]);
  async function open(route: string) {
    if (!portalUrl) { setNote("ERP link is build mein set nahi."); return; }
    const ok = await Linking.canOpenURL(`${portalUrl}${route}`);
    if (!ok) { setNote("Ye ERP page nahi khula."); return; }
    await Linking.openURL(`${portalUrl}${route}`);
  }
  if (busy) return <ActivityIndicator color={colors.green} style={{ marginTop: 28 }} />;
  if (opened) return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={s.header}><Pressable onPress={() => { setOpened(null); setNote(""); }} style={s.back}><Text style={s.backText}>‹</Text></Pressable><View style={{ flex: 1 }}><Text style={s.title}>{opened.title}</Text><Text style={s.sub}>{opened.sub}</Text></View></View>
    <View style={s.detailCard}><View style={s.detailIcon}><Text style={s.iconText}>▣</Text></View><Text style={s.detailTitle}>{opened.title}</Text><Text style={s.detailText}>Ye aap ke assigned department ka kaam hai. Record ERP, stock, khata, ledger aur reports ke sath linked rahega.</Text>{portalUrl ? <Pressable onPress={() => void open(opened.route)} style={s.primary}><Text style={s.primaryText}>Open ERP Work Screen</Text></Pressable> : <View style={s.local}><Text style={s.localTitle}>TEST safety</Text><Text style={s.localText}>TEST APK mein live portal link jaan-boojh kar band hai; is liye live data par write nahi hogi. Role, permission aur screen flow yahin test ho sakta hai.</Text></View>}</View>
    {note ? <Text style={s.note}>{note}</Text> : null}
  </ScrollView>;
  return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={busy} onRefresh={() => void load()} tintColor={colors.green} />}>
    <View style={s.header}><Text style={s.title}>My Work</Text><Text style={s.sub}>{staff?.designation || "Assigned workspaces"}</Text></View>
    {workspaces.length > 1 ? <View style={s.switcher}>{workspaces.map((key) => <Pressable key={key} onPress={() => setSelected(key)} style={[s.pill, selected === key ? s.pillOn : null]}><Text style={[s.pillText, selected === key ? s.pillTextOn : null]}>{WORK_LABELS[key]}</Text></Pressable>)}</View> : null}
    {!workspaces.length ? <View style={s.notice}><Text style={s.noticeTitle}>Koi workspace assigned nahi</Text><Text style={s.noticeText}>Admin department ya feature permission assign kare. App khud se Karyana ya Finance access nahi degi.</Text></View> : null}
    {selected ? <>
      <View style={s.assignment}><View style={{ flex: 1 }}><Text style={s.assignmentTitle}>{WORK_LABELS[selected]}</Text><Text style={s.assignmentSub}>Admin assigned · branch/shop/chiller scope</Text></View><Text style={s.active}>Active</Text></View>
      <View style={s.grid}>{OPERATIONS[selected].map((item, index) => <Pressable key={item.title} onPress={() => setOpened(item)} style={s.card}><View style={[s.icon, index % 3 === 1 ? s.iconGold : null]}><Text style={s.iconText}>{["▣", "₨", "◎", "▦", "✓", "↗"][index % 6]}</Text></View><Text style={s.cardTitle}>{item.title}</Text><Text style={s.cardSub}>{item.sub}</Text></Pressable>)}</View>
    </> : null}
    {note ? <Text style={s.note}>{note}</Text> : null}
    <View style={s.safe}><Text style={s.safeTitle}>Access protection</Text><Text style={s.safeText}>Sirf Admin assigned work yahan nazar aata hai. LIVE mein user apna role ya department khud nahi badal sakta.</Text></View>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8F3" }, content: { padding: 14, paddingBottom: 110 },
  header: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 15, marginBottom: 10 }, title: { fontSize: 22, fontWeight: "900", color: colors.text }, sub: { color: colors.muted, marginTop: 3 },
  switcher: { flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }, pill: { borderWidth: 1, borderColor: colors.line, backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7, marginRight: 6, marginBottom: 6 }, pillOn: { backgroundColor: colors.green, borderColor: colors.green }, pillText: { color: colors.muted, fontWeight: "700", fontSize: 12 }, pillTextOn: { color: "#fff" },
  assignment: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginBottom: 10 }, assignmentTitle: { fontSize: 17, fontWeight: "900", color: colors.text }, assignmentSub: { color: colors.muted, marginTop: 3, fontSize: 12 }, active: { color: colors.green, fontWeight: "800", backgroundColor: "#DFF5E7", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }, card: { width: "48.5%", minHeight: 130, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, marginBottom: 10 }, icon: { width: 36, height: 36, borderRadius: 12, backgroundColor: "#DFF5E7", alignItems: "center", justifyContent: "center", marginBottom: 10 }, iconGold: { backgroundColor: "#FFF2CB" }, iconText: { color: colors.green, fontSize: 18, fontWeight: "900" }, cardTitle: { color: colors.text, fontWeight: "900", fontSize: 15 }, cardSub: { color: colors.muted, fontSize: 11, marginTop: 4, lineHeight: 15 },
  notice: { backgroundColor: "#FFF6D9", borderWidth: 1, borderColor: "#E8CF85", borderRadius: 16, padding: 14, marginBottom: 10 }, noticeTitle: { color: colors.text, fontWeight: "900" }, noticeText: { color: colors.muted, marginTop: 5, lineHeight: 19 },
  note: { color: colors.greenDark, backgroundColor: "#E8F7EE", borderRadius: 12, padding: 10, marginBottom: 10 }, safe: { backgroundColor: "#FFF6D9", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#EADAA8" }, safeTitle: { color: colors.text, fontWeight: "900" }, safeText: { color: colors.muted, marginTop: 4, lineHeight: 18 },
  back: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EEF4EF", alignItems: "center", justifyContent: "center", marginRight: 9 }, backText: { color: colors.green, fontWeight: "900", fontSize: 24, marginTop: -3 }, detailCard: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 18 }, detailIcon: { width: 50, height: 50, borderRadius: 16, backgroundColor: "#DFF5E7", alignItems: "center", justifyContent: "center", marginBottom: 12 }, detailTitle: { color: colors.text, fontSize: 20, fontWeight: "900" }, detailText: { color: colors.muted, lineHeight: 20, marginTop: 7 }, primary: { backgroundColor: colors.green, borderRadius: 13, paddingVertical: 12, alignItems: "center", marginTop: 16 }, primaryText: { color: "#fff", fontWeight: "900" }, local: { backgroundColor: "#FFF6D9", borderRadius: 14, padding: 12, marginTop: 15 }, localTitle: { color: colors.text, fontWeight: "900" }, localText: { color: colors.muted, marginTop: 4, lineHeight: 18 },
});
