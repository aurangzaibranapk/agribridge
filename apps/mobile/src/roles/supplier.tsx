import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { loadKhata, loadMyMerchantOrders, loadMyMerchantSettlements, type KhataView, type MerchantOrderRow, type MerchantSettlementRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";
import { MerchantApproved, type MerchantOrderView } from "./merchant-approved";

export function RoleScreen({ tab, live, onProfile }: { tab: string; live?: LiveBag; onProfile?: () => void }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [purchases, setPurchases] = useState<ReadResult<MerchantOrderRow> | null>(null);
  const [settlements, setSettlements] = useState<ReadResult<MerchantSettlementRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextPurchases, nextSettlements] = await Promise.all([
      loadKhata(auth, fetch), loadMyMerchantOrders(auth, "supplier", fetch), loadMyMerchantSettlements(auth, "supplier", fetch),
    ]);
    setKhata(nextKhata);
    setPurchases(nextPurchases);
    setSettlements(nextSettlements);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);
  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Supplier"><Empty title="Login chahiye" body="Business Munshi, purchase orders aur settlement login ke baad khulte hain." /></Section></ScrollView>;
  if (!khata || !purchases || !settlements) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  const rows: MerchantOrderView[] = purchases.ok ? purchases.rows.map((row, index) => ({ id: row.id || `${row.number || "purchase"}-${index}`, number: row.number, status: row.status, amount: row.amount == null ? null : Number(row.amount), date: row.order_date, guaranteeStatus: row.guarantee_status })) : [];
  return <MerchantApproved role="supplier" tab={tab} khata={khata} orders={rows} ordersNote={purchases.ok ? null : purchases.message} settlements={settlements} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} onProfile={onProfile} />;
}
