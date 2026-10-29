import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { loadKhata, loadMyMerchantOrders, loadMyMerchantProfile, loadMyMerchantSettlements, type KhataView, type MerchantOrderRow, type MerchantProfileRow, type MerchantSettlementRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";
import { MerchantApproved, type MerchantOrderView } from "./merchant-approved";

export function RoleScreen({ tab, live, onProfile, onSupport, onTab }: { tab: string; live?: LiveBag; onProfile?: () => void; onSupport?: () => void; onTab?: (key: string) => void }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [orders, setOrders] = useState<ReadResult<MerchantOrderRow> | null>(null);
  const [settlements, setSettlements] = useState<ReadResult<MerchantSettlementRow> | null>(null);
  const [profile, setProfile] = useState<ReadResult<MerchantProfileRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextOrders, nextSettlements, nextProfile] = await Promise.all([
      loadKhata(auth, fetch), loadMyMerchantOrders(auth, "dealer", fetch), loadMyMerchantSettlements(auth, "dealer", fetch), loadMyMerchantProfile(auth, "dealer", fetch),
    ]);
    setKhata(nextKhata);
    setOrders(nextOrders);
    setSettlements(nextSettlements);
    setProfile(nextProfile);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);
  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Dealer"><Empty title="Login chahiye" body="Business Munshi, guaranteed orders aur settlement login ke baad khulte hain." /></Section></ScrollView>;
  if (!khata || !orders || !settlements || !profile) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  const rows: MerchantOrderView[] = orders.ok ? orders.rows.map((row) => ({ id: row.id, number: row.number, status: row.status, amount: row.amount == null ? null : Number(row.amount), date: row.order_date, guaranteeStatus: row.guarantee_status })) : [];
  return <MerchantApproved role="dealer" tab={tab} khata={khata} orders={rows} ordersNote={orders.ok ? null : orders.message} settlements={settlements} profile={profile} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} onProfile={onProfile} onSupport={onSupport} onTab={onTab} />;
}
