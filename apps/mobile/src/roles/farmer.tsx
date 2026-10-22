import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { settingsOrError } from "../../../../src/lib/mobile/pricing";
import { priceFromSettings } from "../../../../src/lib/mobile/pricing";
import type { MilkSettings } from "../../../../src/lib/dairy/rules";
import { karachiDaySeries, loadCatalog, loadHealth, loadKhata, loadMilkList, loadMilkSettings, loadMyFarmerId, loadOrders, loadProfileNames, loadVaccines, pricedMilkTotal, rupees, salesByDay, shiftLabel, type CatalogRow, type HealthRow, type KhataView, type MilkRow, type OrderRow, type ReadResult, type VaccineRow } from "../../../../src/lib/mobile/live-read";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { Empty, SaleChart, Section, liveAuth, type LiveBag } from "../bits";
import { FarmerGlass } from "./glass-homes";
import { colors } from "../kit";

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function litresOf(row: MilkRow): number {
  return row.quantity_liters != null ? num(row.quantity_liters) : num(row.field_collected_volume);
}

function snfText(row: MilkRow, settings: MilkSettings | null): string {
  if (row.snf_percentage != null && row.snf_percentage !== "") return String(row.snf_percentage);
  if (!settings || row.fat_percentage == null || row.lr == null) return "—";
  return String(priceFromSettings(litresOf(row) || 1, num(row.fat_percentage), num(row.lr), settings).snf);
}

function amountLine(row: MilkRow): string {
  if (row.total_amount == null || row.total_amount === "") {
    return row.fat_percentage == null || row.fat_percentage === ""
      ? "Rate abhi nahi — FAT ka intezar"
      : "Rate settings mein nahi. Rs 0 nahi likhte.";
  }
  const rate = row.rate_per_liter == null || row.rate_per_liter === "" ? "—" : rupees(num(row.rate_per_liter));
  return `Rate ${rate} / L · ${rupees(num(row.total_amount))}`;
}

function kindLabel(kind: string | null | undefined, vaccine?: string | null): string {
  if (kind === "vaccine") return vaccine ? `Vaccine · ${vaccine}` : "Vaccine";
  if (kind === "treatment") return "Dawai";
  if (kind === "deworm") return "Deworm";
  return "Vet visit";
}

export function RoleScreen({ tab, live, onTab, onProfile }: { tab: string; live?: LiveBag; onTab?: (key: string) => void; onProfile?: () => void }) {
  const auth = liveAuth(live);
  const [khata, setKhata] = useState<KhataView | null>(null);
  const [milk, setMilk] = useState<ReadResult<MilkRow> | null>(null);
  const [orders, setOrders] = useState<ReadResult<OrderRow> | null>(null);
  const [shop, setShop] = useState<ReadResult<CatalogRow> | null>(null);
  const [health, setHealth] = useState<ReadResult<HealthRow> | null>(null);
  const [vaccines, setVaccines] = useState<ReadResult<VaccineRow> | null>(null);
  const [settings, setSettings] = useState<MilkSettings | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth) return;
    const farmerId = auth.testAccount ? await loadMyFarmerId(auth, fetch) : undefined;
    const [nextKhata, nextMilk, nextOrders, nextShop, nextHealth, nextVaccines, nextSettings] = await Promise.all([
      loadKhata(auth, fetch),
      loadMilkList(auth, fetch, 80, auth.testAccount ? farmerId ?? null : undefined),
      loadOrders(auth, fetch),
      loadCatalog(auth, fetch),
      loadHealth(auth, fetch),
      loadVaccines(auth, fetch),
      loadMilkSettings(auth, fetch),
    ]);
    setKhata(nextKhata);
    setMilk(nextMilk);
    setOrders(nextOrders);
    setShop(nextShop);
    setHealth(nextHealth);
    setVaccines(nextVaccines);
    const resolved = nextSettings.ok ? settingsOrError(nextSettings.rows[0] ?? null) : null;
    setSettings(resolved && !("error" in resolved) ? resolved : null);
    if (nextMilk.ok) {
      setNames(await loadProfileNames(auth, nextMilk.rows.map((row) => row.mca_profile_id || ""), fetch));
    }
  }, [auth?.token, auth?.url, auth?.userId, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Kisan"><Empty title="Login chahiye" body="Wallet aur doodh testing account se aate hain. Is build mein Supabase key set nahi." /></Section></ScrollView>;
  if (!khata || !milk || !orders || !shop || !health || !vaccines) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  const milkRows = milk.ok ? milk.rows : [];
  const week = karachiWeek();
  const weekRows = milkRows.filter((row) => inWeek(row.entry_date ?? null, week));
  const weekLitres = Math.round(weekRows.reduce((sum, row) => sum + litresOf(row), 0) * 100) / 100;
  const khataText = khata.note && khata.owed == null ? "—" : rupees(khata.owed);
  const days = karachiDaySeries(7);
  const byDay = new Map<string, number>();
  for (const row of milkRows) {
    const day = String(row.entry_date || "");
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + litresOf(row));
  }
  const chart = salesByDay(days.map((day) => ({ created_at: day, total_amount: byDay.get(day) ?? 0, status: "ok" })), days);

  if (tab === "home" || tab === "khata") {
    return (
      <FarmerGlass
        focus={tab === "khata" ? "track" : "home"}
        live={live}
        onTab={onTab}
        onProfile={onProfile}
        khata={khata}
        milk={milk}
        names={names}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
        footer={tab === "khata" ? (
          <View>
            <View style={{ backgroundColor: colors.gold, borderRadius: 18, padding: 16, marginBottom: 12 }}>
              <Text style={{ color: "#3d2e10", fontWeight: "700" }}>Mera Wallet</Text>
              <Text style={{ color: "#1c1408", fontSize: 28, fontWeight: "800", marginTop: 4 }}>{khataText}</Text>
              <Text style={{ color: "#3d2e10", marginTop: 4 }}>{khata.note || "Baqaya, aap ki apni lines se"}</Text>
            </View>
            {khata.linesNote ? <Text style={{ color: "#8FA399" }}>{khata.linesNote}</Text> : null}
            {khata.lines.map((line, index) => (
              <Text key={`${line.entry_date}-${index}`} style={{ color: "#F4F7F4", marginBottom: 6 }}>
                {line.entry_date} · {line.tafseel || line.category || "Line"} · baqaya {line.baqaya ?? "—"}
              </Text>
            ))}
          </View>
        ) : null}
      />
    );
  }

  return (
    <ScrollView style={{ padding: 16, backgroundColor: "#07140F" }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {tab === "doodh" ? (
        <View>
          <MilkList title="Mera doodh" sub="Kis ne uthaya, litre, fat, SNF, LR, rate, raqam" result={milk} rows={milkRows} names={names} settings={settings} />
          <Section title="Mera doodh — chart" sub="Aakhri 7 din, litre">
            {chart.every((point) => point.amount === 0) ? <Empty title="Chart khali hai" body="Jab kai din ki collection aa jayegi, yahan unka chart banega." /> : <SaleChart points={chart} />}
          </Section>
          <Section title="Hafta milk statement" sub={`${week.start} se ${week.end}`}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{weekLitres} L {pricedMilkTotal(weekRows) == null ? "· raqam —" : `· ${rupees(pricedMilkTotal(weekRows))}`}</Text>
            {weekRows.length === 0 ? <Empty title="Is hafte koi doodh nahi" body="MCA jab pickup save karega, yahan din, shift aur raqam aa jayenge." /> : null}
            {weekRows.map((row, index) => (
              <Text key={`${row.id ?? row.entry_date}-${index}`} style={{ color: colors.text, marginTop: 6 }}>
                {row.entry_date} · {shiftLabel(row.shift)} · {litresOf(row)} L · {amountLine(row)}
              </Text>
            ))}
          </Section>
        </View>
      ) : null}
      {tab === "khata" ? (
        <View>
          <View style={{ backgroundColor: colors.gold, borderRadius: 18, padding: 16, marginBottom: 12 }}>
            <Text style={{ color: "#3d2e10", fontWeight: "700" }}>Mera Wallet</Text>
            <Text style={{ color: "#1c1408", fontSize: 28, fontWeight: "800", marginTop: 4 }}>{khataText}</Text>
            <Text style={{ color: "#3d2e10", marginTop: 4 }}>{khata.note || "Baqaya, aap ki apni lines se"}</Text>
          </View>
          <Section title="Haal ka len-den" sub="Pichle 90 din">
            {khata.linesNote ? <Empty title="Lines nahi khulin" body={khata.linesNote} /> : null}
            {!khata.linesNote && khata.lines.length === 0 ? <Empty title="Koi line nahi" body="Udhaar ya adaigi jab darj hogi, tareekh aur raqam yahan aayenge. Track na ho to dash rehta hai." /> : null}
            {khata.lines.map((line, index) => (
              <Text key={`${line.entry_date}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>
                {line.entry_date} · {line.tafseel || line.category || "Line"} · {line.udhaar ? `udhaar ${line.udhaar}` : ""} {line.adaigi ? `adaigi ${line.adaigi}` : ""} · baqaya {line.baqaya ?? "—"}
              </Text>
            ))}
          </Section>
        </View>
      ) : null}
      {tab === "vet" ? (
        <View>
          <Section title="Vet doctor" sub="Doctor ka record">
            {!health.ok ? <Empty title="Vet record nahi khula" body={health.message} /> : null}
            {health.ok && health.rows.length === 0 ? <Empty title="Abhi koi doctor note nahi" body="Jab vet visit darj hogi, tareekh, naam aur diagnosis yahan aayenge." /> : null}
            {health.ok ? health.rows.map((row, index) => (
              <View key={row.id ?? String(index)} style={{ marginBottom: 10 }}>
                <Text style={{ color: colors.text, fontWeight: "700" }}>{row.event_date} · {kindLabel(row.kind, row.vaccine_code)}</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>{row.vet_name || "Doctor"} · {row.diagnosis || row.medicine || row.notes || "Note nahi"}</Text>
                {row.next_due ? <Text style={{ color: colors.muted }}>Agla din {row.next_due}</Text> : null}
              </View>
            )) : null}
          </Section>
          <Section title="Vaccine" sub="Schedule">
            {!vaccines.ok ? <Empty title="Schedule nahi khuli" body={vaccines.message} /> : null}
            {vaccines.ok && vaccines.rows.length === 0 ? <Empty title="Koi vaccine nahi" body="Schedule khali hai." /> : null}
            {vaccines.ok ? vaccines.rows.map((row) => (
              <Text key={row.code || row.name_rm} style={{ color: colors.text, marginBottom: 6 }}>{row.code} · {row.name_rm || "Vaccine"}</Text>
            )) : null}
          </Section>
        </View>
      ) : null}
      {tab === "more" ? (
        <View>
          <Text style={{ color: "#F4F7F4", fontWeight: "800", marginBottom: 8 }} onPress={() => onTab?.("vet")}>Vet doctor</Text>
          <Text style={{ color: "#F4F7F4", fontWeight: "800" }} onPress={() => onTab?.("karyana")}>Karyana</Text>
        </View>
      ) : null}
      {tab === "karyana" ? (
        <View>
          <Orders result={orders} />
          <Catalog result={shop} />
        </View>
      ) : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function MilkList({ title, sub, result, rows, names, settings }: { title: string; sub: string; result: ReadResult<MilkRow>; rows: MilkRow[]; names: Map<string, string>; settings: MilkSettings | null }) {
  return (
    <Section title={title} sub={sub}>
      {!result.ok ? <Empty title="Doodh nahi dikha" body={result.message} /> : null}
      {result.ok && rows.length === 0 ? <Empty title="Abhi koi collection nahi" body="MCA jab pickup save karega, litre, fat, SNF, LR, rate aur raqam yahan aayenge." /> : null}
      {rows.map((row, index) => {
        const who = row.mca_profile_id ? names.get(row.mca_profile_id) || "MCA" : "Collector nahi likha";
        return (
          <View key={row.id ?? `${row.entry_date}-${index}`} style={{ paddingVertical: 8, borderTopWidth: index === 0 ? 0 : 1, borderTopColor: colors.line }}>
            <Text style={{ color: colors.text, fontWeight: "700" }}>{row.entry_date} · {shiftLabel(row.shift)} · {litresOf(row)} L</Text>
            <Text style={{ color: colors.muted, marginTop: 2 }}>{who} ne uthaya · {row.route_name || "route"}</Text>
            <Text style={{ color: colors.text, marginTop: 2 }}>Fat {row.fat_percentage ?? "—"} · SNF {snfText(row, settings)} · LR {row.lr ?? "—"}</Text>
            <Text style={{ color: colors.greenDark, marginTop: 2, fontWeight: "700" }}>{amountLine(row)}</Text>
          </View>
        );
      })}
    </Section>
  );
}

function Orders({ result }: { result: ReadResult<OrderRow> }) {
  return (
    <Section title="Karyana orders" sub="Dukaan ke orders">
      {!result.ok ? <Empty title="Orders nahi khule" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi order nahi" body="Jab karyana order darj hoga, number, status aur raqam yahan aayenge." /> : null}
      {result.ok ? result.rows.map((row, index) => (
        <Text key={`${row.order_number}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.order_number || "Order"} · {row.status} · {row.grand_total == null ? "—" : rupees(Number(row.grand_total))}</Text>
      )) : null}
    </Section>
  );
}

function Catalog({ result }: { result: ReadResult<CatalogRow> }) {
  return (
    <Section title="Karyana" sub="Maal ki fehrist, is screen se khareed nahi">
      {!result.ok ? <Empty title="Catalog nahi khula" body={result.message} /> : null}
      {result.ok && result.rows.length === 0 ? <Empty title="Koi product nahi" body="Jo maal dukan par available hoga, naam aur rate yahan aayenge." /> : null}
      {result.ok ? result.rows.map((row) => (
        <Text key={row.id} style={{ color: colors.text, marginBottom: 6 }}>{row.name} · {row.selling_price == null ? "—" : rupees(Number(row.selling_price))} {row.unit ? `/ ${row.unit}` : ""}</Text>
      )) : null}
    </Section>
  );
}
