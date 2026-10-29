import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { loadKhata, loadRoleOrders, testOrdersFor, type KhataView, type OrderRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";
import { MerchantApproved, type MerchantOrderView } from "./merchant-approved";

export function RoleScreen({ tab, live, onProfile }: { tab: string; live?: LiveBag; onProfile?: () => void }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [orders, setOrders] = useState<ReadResult<OrderRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextOrders] = await Promise.all([loadKhata(auth, fetch), loadRoleOrders(auth, "dealer", fetch)]);
    setKhata(nextKhata);
    setOrders(nextOrders.ok && auth.testAccount ? { ok: true, rows: testOrdersFor(nextOrders.rows, "dealer") } : nextOrders);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);
  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Dealer"><Empty title="Login chahiye" body="Business Munshi, guaranteed orders aur settlement login ke baad khulte hain." /></Section></ScrollView>;
  if (!khata || !orders) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  const rows: MerchantOrderView[] = orders.ok ? orders.rows.map((row) => ({ id: row.id, number: row.order_number, status: row.status, amount: row.grand_total == null ? null : Number(row.grand_total), date: row.created_at?.slice(0, 10) })) : [];
  return <MerchantApproved role="dealer" tab={tab} khata={khata} orders={rows} ordersNote={orders.ok ? null : orders.message} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} onProfile={onProfile} />;
}
