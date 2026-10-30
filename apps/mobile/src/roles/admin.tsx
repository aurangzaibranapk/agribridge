import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { cardRupees, filterInbox, litreLabel, roleTitle, type ApprovalFilter, type InboxItem } from "../../../../src/lib/mobile/admin-desk";
import {
  applyDeskDecision,
  loadAdminIdentity,
  loadAdminInbox,
  loadApprovalRecord,
  loadDeskCounts,
  planForRecord,
  type AdminIdentity,
  type ApprovalRecord,
  type DeskCounts,
} from "../../../../src/lib/mobile/admin-load";
import {
  karachiDate,
  liveGet,
  liveGetScoped,
  loadAttendance,
  loadMilkList,
  loadOrders,
  loadAdminHome,
  loadPurchases,
  rupees,
  searchParties,
  type AdminHome,
  type LiveAuth,
} from "../../../../src/lib/mobile/live-read";
import { liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";
import { AdminDetailView, AdminHomeView, AdminInboxView, AdminProfileView, AdminWorkView, RecordList, type HomeCard } from "./admin-ui";

type Panel = "sales" | "cash" | "stock" | "milk" | "farmers" | "purchases" | "attendance" | "support" | "orders" | "parties" | "users" | "branches" | "rules" | "notifications" | "settings" | "org" | "account";

export function RoleScreen({
  tab,
  live,
  readOnly = false,
  onTab,
  onRoleSwitch,
  onLogout,
}: {
  tab: string;
  live?: LiveBag;
  readOnly?: boolean;
  onProfile?: () => void;
  onTab?: (key: string) => void;
  onRoleSwitch?: () => void;
  onLogout?: () => void;
}) {
  const auth = liveAuth(live);
  const [home, setHome] = useState<AdminHome | null>(null);
  const [counts, setCounts] = useState<DeskCounts | null>(null);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [inboxNote, setInboxNote] = useState<string | null>(null);
  const [identity, setIdentity] = useState<AdminIdentity | { ok: false; message: string } | null>(null);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<ApprovalFilter>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [panel, setPanel] = useState<Panel | null>(null);
  const [picked, setPicked] = useState<InboxItem | null>(null);
  const [record, setRecord] = useState<ApprovalRecord | null>(null);
  const [decisionNote, setDecisionNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!auth) {
      setError("Live Supabase is build mein set nahi. Login ke baad hisaab yahin aata hai.");
      return;
    }
    setError("");
    const today = karachiDate();
    const [nextHome, nextCounts, nextInbox, nextIdentity] = await Promise.all([
      loadAdminHome(auth, fetch),
      loadDeskCounts(auth, today, fetch),
      loadAdminInbox(auth, fetch),
      loadAdminIdentity(auth, fetch),
    ]);
    setHome(nextHome);
    setCounts(nextCounts);
    setIdentity(nextIdentity);
    if (nextInbox.ok) {
      setInbox(nextInbox.rows);
      setInboxNote(nextInbox.note);
    } else {
      setInbox([]);
      setInboxNote(nextInbox.message);
    }
  }, [auth?.token, auth?.url, auth?.userId, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPanel(null); setPicked(null); setRecord(null); }, [tab]);

  async function openItem(item: InboxItem) {
    if (!auth) return;
    setPicked(item);
    setRecord(null);
    setDecisionNote("");
    const next = await loadApprovalRecord(auth, item, fetch);
    setRecord(next);
  }

  async function decide(decision: "approve" | "reject", comment: string) {
    if (!auth || !record || !identity || !identity.ok) {
      setDecisionNote(!identity || !identity.ok ? (identity && !identity.ok ? identity.message : "Profile nahi khuli.") : "Record nahi khula.");
      return;
    }
    const plan = planForRecord({
      readOnly,
      actor: { id: auth.userId || "", role: identity.role },
      record,
      decision,
      comment,
      nowIso: new Date().toISOString(),
    });
    if (!plan.ok) {
      setDecisionNote(plan.message);
      return;
    }
    setBusy(true);
    const saved = await applyDeskDecision(auth, plan, fetch, record.leave?.profileId);
    setBusy(false);
    if (!saved.ok) {
      setDecisionNote(saved.message);
      return;
    }
    const done = decision === "approve" ? "Manzoor ho gaya. Website par wahi record update hai." : "Rad ho gaya. Website par wahi record update hai.";
    setPicked(null);
    setRecord(null);
    await load();
    setInboxNote(done);
  }

  function openCard(key: string) {
    if (key === "approvals") {
      onTab?.("approvals");
      return;
    }
    if (key === "hr") {
      onTab?.("hr");
      return;
    }
    setPanel(key as Panel);
  }

  if (!auth) return <View style={{ padding: 16 }}><Text style={{ color: colors.text }}>{error || "Login ke baad hisaab yahin aata hai."}</Text></View>;
  if (!home || !counts || !identity) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  if (picked) {
    const detail = record;
    return (
      <AdminDetailView
        heading={detail?.heading || "Approval"}
        partyLabel={detail?.partyLabel || "Party name"}
        party={detail?.party || picked.title || "—"}
        quantityLabel={detail?.action === "leave" ? "Days" : detail?.action === "purchase" ? "Bill" : "Quantity"}
        quantity={detail?.quantity || "—"}
        amountLabel={detail?.action === "leave" ? "Type" : "Amount"}
        amount={detail?.amount || "—"}
        steps={detail?.steps || []}
        note={[detail?.note, decisionNote].filter(Boolean).join(" ") || null}
        readOnly={readOnly}
        busy={busy || !detail}
        onBack={() => { setPicked(null); setRecord(null); setDecisionNote(""); }}
        onDecide={(decision, comment) => { void decide(decision, comment); }}
      />
    );
  }

  if (panel) return <PanelBody panel={panel} auth={auth} home={home} identity={identity.ok ? identity : null} inbox={inbox} onBack={() => setPanel(null)} />;

  const face = identity.ok ? identity : null;
  if (tab === "approvals") {
    const mine = filterInbox(inbox, filter, mineOnly);
    return (
      <AdminInboxView
        items={mine}
        filter={filter}
        mineOnly={mineOnly}
        note={inboxNote}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
        onFilter={setFilter}
        onMine={() => setMineOnly((value) => !value)}
        onOpen={(item) => { void openItem(item); }}
        onMenu={() => onTab?.("work")}
        onAlerts={() => setPanel("notifications")}
      />
    );
  }
  if (tab === "work") return <AdminWorkView onOpen={openCard} />;
  if (tab === "hr") {
    return (
      <AdminWorkView
        title="HR"
        sub="Hazri, chhutti aur staff. Har card asal record kholta hai."
        tiles={[
          { key: "attendance", title: "Staff present", sub: counts.staff == null ? "Hazri nahi khuli" : `${counts.staff} today`, icon: "people" },
          { key: "approvals", title: "Leave", sub: "Pending chhutti", icon: "cal" },
          { key: "users", title: "Users & roles", sub: "Staff list", icon: "people" },
        ]}
        onOpen={(key) => {
          if (key === "approvals") { setFilter("leave"); onTab?.("approvals"); return; }
          openCard(key);
        }}
      />
    );
  }
  if (tab === "more") {
    if (!identity.ok) return <View style={{ padding: 16 }}><Text style={{ color: colors.text }}>{identity.message}</Text></View>;
    return (
      <AdminProfileView
        fullName={identity.fullName}
        role={identity.role}
        extraRoles={identity.extraRoles}
        phone={identity.phone}
        email={identity.email}
        place={identity.place}
        org={identity.org}
        designation={identity.designation}
        photoUrl={identity.photoUrl}
        gaps={identity.gaps}
        versionExtra={live?.testAccount || live?.flavor === "test" ? " TEST" : ""}
        onOpen={(key) => setPanel(key as Panel)}
        onRole={onRoleSwitch}
        onLogout={onLogout}
        onMenu={() => onTab?.("home")}
      />
    );
  }

  const stockCount = home.alertsNote ? null : home.alerts.length;
  const milkTotal = home.milk.state === "ok" ? home.milk.subah + home.milk.shaam : null;
  const cards: HomeCard[] = [
    { key: "approvals", title: "Approvals", value: counts.pending == null ? "—" : String(counts.pending), sub: counts.pendingNote || "pending", icon: "clip" },
    { key: "sales", title: "POS sales", value: home.sales.state === "ok" ? cardRupees(home.sales.total) : "—", sub: home.sales.state === "error" ? "nahi khuli" : "today", icon: "cart" },
    { key: "cash", title: "Cash alerts", value: counts.cash == null ? "—" : String(counts.cash), sub: counts.cashNote || "high priority", alert: (counts.cash ?? 0) > 0, icon: "bell" },
    { key: "stock", title: "Stock alerts", value: stockCount == null ? "—" : String(stockCount), sub: home.alertsNote || "low stock", alert: (stockCount ?? 0) > 0, icon: "alert" },
    { key: "milk", title: "Doodh today", value: milkTotal == null ? "—" : litreLabel(milkTotal), sub: home.milk.state === "error" ? "nahi khula" : "today", icon: "milk" },
    { key: "farmers", title: "Farmers", value: counts.farmers == null ? "—" : String(counts.farmers), sub: counts.farmersNote || "registered", icon: "farmer" },
    { key: "attendance", title: "Staff present", value: counts.staff == null ? "—" : String(counts.staff), sub: counts.staffNote || "today", icon: "people" },
    { key: "support", title: "Support", value: counts.support == null ? "—" : String(counts.support), sub: counts.supportNote || "unresolved", icon: "headset" },
  ];
  return (
    <AdminHomeView
      fullName={face?.fullName || ""}
      role={face?.role || "admin"}
      photoUrl={face?.photoUrl || null}
      testBuild={Boolean(live?.testAccount || live?.flavor === "test")}
      onRole={onRoleSwitch}
      cards={cards}
      banner={identity.ok ? null : identity.message}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
      onOpen={openCard}
    />
  );
}

function PanelBody({ panel, auth, home, identity, inbox, onBack }: { panel: Panel; auth: LiveAuth; home: AdminHome; identity: Extract<AdminIdentity, { ok: true }> | null; inbox: InboxItem[]; onBack: () => void }) {
  const [rows, setRows] = useState<{ key: string; title: string; value: string }[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const day = home.today || karachiDate();

  useEffect(() => {
    let gone = false;
    void (async () => {
      const next = await loadPanel(panel, auth, day, home, identity, inbox);
      if (gone) return;
      setRows(next.rows);
      setNote(next.note);
    })();
    return () => { gone = true; };
  }, [panel, auth.token, auth.url, day]);

  if (!rows) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  return <RecordList title={panelTitle(panel)} sub={note} onBack={onBack} rows={rows} empty={note ? "Fehrist nahi khuli." : "Koi record nahi."} />;
}

function panelTitle(panel: Panel): string {
  const map: Record<Panel, string> = {
    sales: "POS sales",
    cash: "Cash alerts",
    stock: "Stock alerts",
    milk: "Doodh",
    farmers: "Farmers",
    purchases: "Purchases",
    attendance: "Staff present",
    support: "Support",
    orders: "Orders",
    parties: "Khata",
    users: "Users & roles",
    branches: "Branches",
    rules: "Business rules",
    notifications: "Notifications",
    settings: "Settings",
    org: "Organization",
    account: "Account",
  };
  return map[panel];
}

async function loadPanel(
  panel: Panel,
  auth: LiveAuth,
  day: string,
  home: AdminHome,
  identity: Extract<AdminIdentity, { ok: true }> | null,
  inbox: InboxItem[],
): Promise<{ rows: { key: string; title: string; value: string }[]; note: string | null }> {
  if (panel === "stock") {
    if (home.alertsNote) return { rows: [], note: home.alertsNote };
    return { rows: home.alerts.map((row) => ({ key: row.name, title: row.name, value: `${row.qty} / ${row.min}` })), note: null };
  }
  if (panel === "notifications") {
    if (home.activityNote) return { rows: [], note: home.activityNote };
    return {
      rows: home.activity.map((row, index) => ({ key: `${row.at}-${index}`, title: row.action, value: row.at ? row.at.slice(0, 16).replace("T", " ") : "" })),
      note: home.activity.length ? null : "Is login ko activity ki line nahi mili.",
    };
  }
  if (panel === "rules") {
    const groups = new Map<string, number>();
    for (const item of inbox) groups.set(item.category, (groups.get(item.category) || 0) + 1);
    return {
      rows: [
        { key: "milk", title: "Doodh", value: "Priced + 5 harf. Apni entry manager nahi." },
        { key: "leave", title: "Leave", value: "Apni chhutti nahi. Reporting RPC." },
        { key: "purchase", title: "Purchase", value: "Held payment website par." },
        ...[...groups.entries()].map(([key, count]) => ({ key, title: key.replace(/_/g, " "), value: String(count) })),
      ],
      note: null,
    };
  }
  if (panel === "account") {
    if (!identity) return { rows: [], note: "Profile nahi khuli." };
    return {
      rows: [
        { key: "name", title: "Name", value: identity.fullName },
        { key: "role", title: "Role", value: roleTitle(identity.role) },
        { key: "phone", title: "Phone", value: identity.phone || "darj nahi" },
        { key: "email", title: "Email", value: identity.email || "darj nahi" },
        { key: "place", title: "Branch / shop", value: identity.place || "darj nahi" },
        { key: "job", title: "Designation", value: identity.designation || "darj nahi" },
        { key: "org", title: "Organization", value: identity.org || "darj nahi" },
      ],
      note: null,
    };
  }
  if (panel === "org") {
    if (!identity) return { rows: [], note: "Profile nahi khuli." };
    return {
      rows: [
        { key: "org", title: "Organization", value: identity.org || "darj nahi" },
        { key: "place", title: "Branch / shop", value: identity.place || "darj nahi" },
        { key: "role", title: "Role", value: roleTitle(identity.role) },
      ],
      note: null,
    };
  }
  if (panel === "settings") {
    return {
      rows: [
        { key: "db", title: "Database", value: auth.testAccount || auth.flavor === "test" ? "Testing" : "Live" },
        { key: "channel", title: "Channel", value: auth.channel },
        { key: "user", title: "User", value: auth.userId || "—" },
      ],
      note: null,
    };
  }
  if (panel === "sales") {
    const since = `${day}T00:00:00+05:00`;
    const sales = await liveGet<{ total_amount?: number | string | null; created_at?: string | null; status?: string | null; payment_mode?: string | null }>(
      auth,
      `pos_sales?select=total_amount,created_at,status,payment_mode&created_at=gte.${encodeURIComponent(since)}&order=created_at.desc&limit=40`,
      fetch,
    );
    if (!sales.ok) return { rows: [], note: sales.message };
    return {
      rows: sales.rows.map((row, index) => ({
        key: `${row.created_at}-${index}`,
        title: `${String(row.created_at || "").slice(11, 16)} · ${row.payment_mode || row.status || "bill"}`,
        value: row.total_amount == null ? "—" : rupees(Number(row.total_amount)),
      })),
      note: null,
    };
  }
  if (panel === "cash") {
    const alerts = await liveGet<{ id?: string; entry_number?: string | null; alert_type?: string | null; amount?: number | string | null; party_label?: string | null }>(
      auth,
      "txn_whatsapp_alerts?select=id,entry_number,alert_type,amount,party_label&status=eq.pending&order=created_at.desc&limit=40",
      fetch,
    );
    if (!alerts.ok) return { rows: [], note: alerts.message };
    return {
      rows: alerts.rows.map((row) => ({
        key: row.id || row.entry_number || "alert",
        title: row.party_label || row.entry_number || row.alert_type || "Alert",
        value: row.amount == null ? row.alert_type || "—" : rupees(Number(row.amount)),
      })),
      note: null,
    };
  }
  if (panel === "milk") {
    const milk = await loadMilkList(auth, fetch, 40);
    if (!milk.ok) return { rows: [], note: milk.message };
    return {
      rows: milk.rows.map((row, index) => ({
        key: row.id || String(index),
        title: `${row.entry_date || ""} · ${row.shift === "evening" ? "Shaam" : "Subah"}`,
        value: `${row.quantity_liters ?? "—"} L`,
      })),
      note: null,
    };
  }
  if (panel === "farmers") {
    const farmers = await liveGetScoped<{ id?: string; full_name?: string | null; farmer_code?: string | null; village?: string | null }>(auth, "farmers?select=id,full_name,farmer_code,village&order=full_name.asc&limit=40", fetch);
    if (!farmers.ok) return { rows: [], note: farmers.message };
    return { rows: farmers.rows.map((row) => ({ key: row.id || row.full_name || "farmer", title: row.full_name || "Kisan", value: row.village || row.farmer_code || "" })), note: null };
  }
  if (panel === "purchases") {
    const purchases = await loadPurchases(auth, fetch);
    if (!purchases.ok) return { rows: [], note: purchases.message };
    return {
      rows: purchases.rows.map((row, index) => ({
        key: `${row.purchase_number}-${index}`,
        title: `${row.purchase_number || "Bill"} · ${row.purchase_date || ""}`,
        value: row.total_amount == null ? "—" : rupees(Number(row.total_amount)),
      })),
      note: null,
    };
  }
  if (panel === "attendance") {
    const attendance = await loadAttendance(auth, day, fetch);
    if (!attendance.rows.ok) return { rows: [], note: attendance.rows.message };
    return {
      rows: attendance.rows.rows.map((row, index) => ({
        key: `${row.profile_id}-${index}`,
        title: attendance.names.get(row.profile_id || "") || "Staff",
        value: String(row.status || "—"),
      })),
      note: null,
    };
  }
  if (panel === "support") {
    const tickets = await liveGet<{ id?: string; ticket_no?: number | null; title?: string | null; status?: string | null; priority?: string | null }>(
      auth,
      "support_tickets?select=id,ticket_no,title,status,priority&status=in.(new,assigned,investigating,testing,resolved_pending_verify,reopened)&order=created_at.desc&limit=40",
      fetch,
    );
    if (!tickets.ok) return { rows: [], note: tickets.message };
    return {
      rows: tickets.rows.map((row) => ({
        key: row.id || String(row.ticket_no),
        title: row.title || `Ticket ${row.ticket_no ?? ""}`,
        value: row.status || "",
      })),
      note: null,
    };
  }
  if (panel === "orders") {
    const orders = await loadOrders(auth, fetch);
    if (!orders.ok) return { rows: [], note: orders.message };
    return {
      rows: orders.rows.map((row) => ({
        key: row.id || row.order_number || "order",
        title: row.order_number || "Order",
        value: row.grand_total == null ? String(row.status || "") : rupees(Number(row.grand_total)),
      })),
      note: null,
    };
  }
  if (panel === "parties") {
    const found = await searchParties(auth, "", fetch);
    const rows = [
      ...(found.farmers.ok ? found.farmers.rows.map((row) => ({ key: `f-${row.id}`, title: row.full_name || "Kisan", value: "Kisan" })) : []),
      ...(found.customers.ok ? found.customers.rows.map((row) => ({ key: `c-${row.id}`, title: row.name || "Customer", value: row.current_balance == null ? "Customer" : rupees(Number(row.current_balance)) })) : []),
    ];
    const note = !found.farmers.ok ? found.farmers.message : !found.customers.ok ? found.customers.message : null;
    return { rows, note };
  }
  if (panel === "users") {
    const users = await liveGet<{ id?: string; full_name?: string | null; role?: string | null; is_active?: boolean | null }>(auth, "profiles?select=id,full_name,role,is_active&order=full_name.asc&limit=50", fetch);
    if (!users.ok) return { rows: [], note: users.message };
    return { rows: users.rows.map((row) => ({ key: row.id || row.full_name || "user", title: row.full_name || "User", value: roleTitle(row.role) })), note: null };
  }
  if (panel === "branches") {
    const branches = await liveGet<{ id?: string; name?: string | null; district?: string | null; tehsil?: string | null }>(auth, "branches?select=id,name,district,tehsil&order=name.asc&limit=40", fetch);
    if (!branches.ok) return { rows: [], note: branches.message };
    return { rows: branches.rows.map((row) => ({ key: row.id || row.name || "branch", title: row.name || "Branch", value: [row.tehsil, row.district].filter(Boolean).join(", ") })), note: null };
  }
  return { rows: [], note: null };
}
