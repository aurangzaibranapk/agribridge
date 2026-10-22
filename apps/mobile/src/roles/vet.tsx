import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text } from "react-native";
import { liveGet, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";

type LinkRow = { role?: string | null; label?: string | null };

export function RoleScreen({ tab, live }: { tab: string; live?: LiveBag }) {
  const auth = liveAuth(live);
  const [links, setLinks] = useState<ReadResult<LinkRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !live?.userId) return;
    const id = encodeURIComponent(live.userId);
    setLinks(await liveGet<LinkRow>(auth, `app_test_links?select=role,label&account_id=eq.${id}&order=role.asc`, fetch));
  }, [auth?.token, live?.userId]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Vet"><Empty title="Login chahiye" body="TEST vet ka ghar login ke baad khulta hai." /></Section></ScrollView>;
  if (!links) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  const vet = links.ok ? links.rows.filter((row) => row.role === "vet" || row.role === "farmer") : [];
  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      <Section title="Vet" sub={tab === "stock" ? "Stock" : tab === "visits" ? "Visits" : "Home"}>
        <Empty title="TEST · likhai band" body="Vet ki ziyarat aur stock asal tables mein nahi likhe jaate. Neeche sirf TEST links hain." />
      </Section>
      <Section title="TEST links">
        {!links.ok ? <Empty title="Links nahi khule" body={links.message.includes("is_test") || links.message.includes("app_test") ? "Migration 699 abhi live par nahi. Boss backup ke baad lagaenge." : links.message} /> : null}
        {links.ok && vet.length === 0 ? <Empty title="Koi TEST vet link nahi" body="Seed script TEST Farmer aur TEST Vet ki line yahan laati hai." /> : null}
        {vet.map((row) => <Text key={`${row.role}-${row.label}`} style={{ color: colors.text, marginBottom: 6 }}>{row.role} · {row.label}</Text>)}
      </Section>
    </ScrollView>
  );
}
