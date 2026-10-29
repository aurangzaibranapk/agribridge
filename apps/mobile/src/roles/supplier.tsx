import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView } from "react-native";
import { loadKhata, loadPurchases, type KhataView, type PurchaseRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";
import { MerchantApproved, type MerchantOrderView } from "./merchant-approved";

export function RoleScreen({ tab, live, onProfile }: { tab: string; live?: LiveBag; onProfile?: () => void }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [purchases, setPurchases] = useState<ReadResult<PurchaseRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    if (!auth) return;
    const [nextKhata, nextPurchases] = await Promise.all([loadKhata(auth, fetch), loadPurchases(auth, fetch)]);
    setKhata(nextKhata);
    setPurchases(nextPurchases);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);
  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Supplier"><Empty title="Login chahiye" body="Business Munshi, purchase orders aur settlement login ke baad khulte hain." /></Section></ScrollView>;
  if (!khata || !purchases) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;
  const rows: MerchantOrderView[] = purchases.ok ? purchases.rows.map((row, index) => ({ id: `${row.purchase_number || "purchase"}-${index}`, number: row.purchase_number || row.supplier_bill_no, status: row.status, amount: row.total_amount == null ? null : Number(row.total_amount), date: row.purchase_date })) : [];
  return <MerchantApproved role="supplier" tab={tab} khata={khata} orders={rows} ordersNote={purchases.ok ? null : purchases.message} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} onProfile={onProfile} />;
}
