import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { approvalTimeline, milkTimeline, orderTimeline, pctChange, romanWeekday } from "../../../../src/lib/mobile/glass-metrics";
import { karachiDate, karachiDaySeries, liveGetScoped, loadMilkList, loadProfileNames, milkLitres, pricedMilkTotal, rupees, shiftLabel, type AdminHome, type HealthRow, type KhataView, type MilkRow, type OrderRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { liveAuth, type LiveBag } from "../bits";
import { BarChart, BarTrack, BrandHeader, Donut, GlassCard, GlassScreen, Kpi, LineChart, Pill, Rise, TankRow, Timeline, WeatherCard, glass, useFace, useWeather } from "../glass";

type Refresh = { refreshing?: boolean; onRefresh?: () => void; onProfile?: () => void; onTab?: (key: string) => void };

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function litres(row: MilkRow): number {
  return row.quantity_liters != null ? num(row.quantity_liters) : num(row.field_collected_volume);
}

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10;
}

function dayValues(rows: MilkRow[], days: string[]): number[] {
  return days.map((day) => milkLitres(rows.filter((row) => row.entry_date === day)));
}

function orderTone(status: string | null | undefined): { label: string; tone: "green" | "orange" | "red" | "blue" } {
  const key = String(status ?? "").toLowerCase();
  if (key === "delivered" || key === "completed" || key === "grn_submitted") return { label: "Delivered", tone: "green" };
  if (key === "in_transit" || key === "dispatched") return { label: "Raste mein", tone: "blue" };
  if (key === "cancelled" || key === "rejected") return { label: "Cancel", tone: "red" };
  if (key === "processing" || key === "approved") return { label: "Pack", tone: "orange" };
  return { label: key || "Pending", tone: "orange" };
}

function money(value: number | null | undefined, missing: boolean): string {
  if (missing || value == null) return "—";
  return rupees(value);
}

export function FarmerGlass({ live, khata, milk, names, ...bar }: Refresh & { live?: LiveBag; khata: KhataView | null; milk: ReadResult<MilkRow> | null; names: Map<string, string> }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  if (!khata || !milk) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const rows = milk.ok ? milk.rows : [];
  const days = karachiDaySeries(7);
  const today = days[days.length - 1];
  const yesterday = days[days.length - 2];
  const series = dayValues(rows, days);
  const payByDay = days.map((day) => pricedMilkTotal(rows.filter((row) => row.entry_date === day)));
  const payLine = payByDay.every((value) => value == null) ? [] : payByDay.map((value) => value ?? 0);
  const todayRows = rows.filter((row) => row.entry_date === today);
  const yesterdayRows = rows.filter((row) => row.entry_date === yesterday);
  const week = karachiWeek();
  const weekRows = rows.filter((row) => inWeek(String(row.entry_date || ""), week));
  const prevRows = rows.filter((row) => String(row.entry_date || "") < week.start && String(row.entry_date || "") >= days[0]);
  const weekPay = pricedMilkTotal(weekRows);
  const prevPay = pricedMilkTotal(prevRows);
  const fats = todayRows.map((row) => num(row.fat_percentage)).filter((value, index) => rowHas(todayRows[index], "fat_percentage") && value > 0);
  const snfs = todayRows.map((row) => num(row.snf_percentage)).filter((value, index) => rowHas(todayRows[index], "snf_percentage") && value > 0);
  const yFats = yesterdayRows.map((row) => num(row.fat_percentage)).filter((value, index) => rowHas(yesterdayRows[index], "fat_percentage") && value > 0);
  const latest = rows[0] ?? null;
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Kisan" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={2} label="Wallet balance" value={money(khata.owed, Boolean(khata.note && khata.owed == null))} sub={khata.note || "Khata baqaya"} color="#C8A058" series={payLine} pct={pctChange(weekPay, prevPay)} />
        <Kpi index={3} label="Aaj ka doodh" value={milk.ok ? `${milkLitres(todayRows)} L` : "—"} sub={milk.ok ? "" : milk.message} color="#5B8CFF" series={series} pct={pctChange(milkLitres(todayRows), yesterday ? milkLitres(yesterdayRows) : null)} />
        <Kpi index={4} label="Fat / SNF avg" value={avg(fats) == null && avg(snfs) == null ? "—" : `${avg(fats) ?? "—"} / ${avg(snfs) ?? "—"}`} color="#C4B5FD" series={fats.length ? fats : []} pct={pctChange(avg(fats), avg(yFats))} />
        <Kpi index={5} label="Hafte ki kamai" value={money(weekPay, weekPay == null)} sub={`${week.start} se ${week.end}`} color="#F5B942" series={payLine} pct={pctChange(weekPay, prevPay)} />
      </View>
      <GlassCard title="Pichlay 7 din ka doodh (L)" sub={series.some((value) => value > 0) ? `Avg ${(series.reduce((sum, value) => sum + value, 0) / series.length).toFixed(1)} L` : "Abhi litre nahi"} index={6}>
        {!milk.ok ? <Text style={{ color: glass.muted }}>{milk.message}</Text> : <LineChart values={series} labels={days.map(romanWeekday)} color="#3DDC97" />}
      </GlassCard>
      <GlassCard title="Aakhri collections" index={7}>
        {!milk.ok ? <Text style={{ color: glass.muted }}>{milk.message}</Text> : null}
        {milk.ok && rows.length === 0 ? <Text style={{ color: glass.muted }}>Abhi koi collection nahi.</Text> : null}
        {rows.slice(0, 3).map((row, index) => {
          const who = row.mca_profile_id ? names.get(row.mca_profile_id) || "MCA" : "MCA";
          const amount = row.total_amount == null || row.total_amount === "" ? null : num(row.total_amount);
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: glass.text, fontWeight: "700" }}>{shiftLabel(row.shift)} · {litres(row)} L</Text>
                <Text style={{ color: glass.muted }}>{who} · Fat {row.fat_percentage ?? "—"}</Text>
              </View>
              <Pill label={amount == null ? "Pending" : rupees(amount)} tone={amount == null ? "orange" : "green"} />
            </View>
          );
        })}
      </GlassCard>
      <Timeline title="Doodh ka safar" steps={milkTimeline(latest)} onAction={() => bar.onTab?.("doodh")} index={8} />
      <Text style={{ color: glass.muted, marginTop: 4 }} onPress={() => bar.onTab?.("vet")}>Vet doctor</Text>
      <Text style={{ color: glass.muted, marginTop: 6 }} onPress={() => bar.onTab?.("karyana")}>Karyana</Text>
    </GlassScreen>
  );
}

function rowHas(row: MilkRow | undefined, key: "fat_percentage" | "snf_percentage"): boolean {
  const value = row?.[key];
  return value != null && value !== "";
}

export function McaGlass({ live, farmers, ...bar }: Refresh & { live?: LiveBag; farmers: { id?: string; full_name?: string | null }[] }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  const auth = liveAuth(live);
  const [milk, setMilk] = useState<ReadResult<MilkRow> | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  useEffect(() => {
    if (!auth) return;
    void loadMilkList(auth, fetch, 80).then(async (rows) => {
      setMilk(rows);
      if (rows.ok) setNames(await loadProfileNames(auth, rows.rows.map((row) => row.farmer_id || ""), fetch));
    });
  }, [auth?.token, auth?.url, auth?.testAccount]);
  const rows = milk?.ok ? milk.rows : [];
  const days = karachiDaySeries(7);
  const today = karachiDate();
  const yesterday = days[days.length - 2];
  const todayRows = rows.filter((row) => row.entry_date === today);
  const series = dayValues(rows, days);
  const pending = todayRows.filter((row) => row.status === "pending_fat").length;
  const fats = todayRows.map((row) => num(row.fat_percentage)).filter((_, index) => rowHas(todayRows[index], "fat_percentage"));
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="MCA" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={2} label="Aaj ki collection" value={milk?.ok ? `${milkLitres(todayRows)} L` : "—"} color="#3DDC97" series={series} pct={pctChange(milkLitres(todayRows), milkLitres(rows.filter((row) => row.entry_date === yesterday)))} />
        <Kpi index={3} label="Kisan count" value={String(farmers.length)} color="#F5B942" series={[]} pct={null} />
        <Kpi index={4} label="Pending entries" value={milk?.ok ? String(pending) : "—"} color="#F5B942" series={[]} pct={null} />
        <Kpi index={5} label="Avg fat" value={avg(fats) == null ? "—" : `${avg(fats)}%`} color="#C4B5FD" series={fats} pct={null} />
      </View>
      <GlassCard title="Haftay ki collection (L)" index={6}>
        <BarChart values={series} labels={days.map(romanWeekday)} color="#5B8CFF" />
      </GlassCard>
      <GlassCard title="Aaj ki entries" index={7}>
        {!milk ? <ActivityIndicator color={glass.up} /> : null}
        {milk && !milk.ok ? <Text style={{ color: glass.muted }}>{milk.message}</Text> : null}
        {milk?.ok && todayRows.length === 0 ? <Text style={{ color: glass.muted }}>Aaj koi entry nahi.</Text> : null}
        {todayRows.slice(0, 6).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: glass.text, fontWeight: "700" }}>{row.farmer_id ? names.get(row.farmer_id) || "Kisan" : "Kisan"}</Text>
              <Text style={{ color: glass.muted }}>{litres(row)} L · Fat {row.fat_percentage ?? "—"}</Text>
            </View>
            <Pill label={row.status === "pending_fat" ? "Pending" : row.status === "rejected" ? "Reject" : "Saved"} tone={row.status === "pending_fat" ? "orange" : row.status === "rejected" ? "red" : "green"} />
          </View>
        ))}
      </GlassCard>
    </GlassScreen>
  );
}

export function McoGlass({ live, rows, error, names, ...bar }: Refresh & { live?: LiveBag; rows: MilkRow[] | null; error: string; names: Map<string, string> }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  if (!rows && !error) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = rows ?? [];
  const days = karachiDaySeries(7);
  const today = karachiDate();
  const todayRows = list.filter((row) => row.entry_date === today);
  const subah = todayRows.filter((row) => shiftLabel(row.shift) === "Subah");
  const shaam = todayRows.filter((row) => shiftLabel(row.shift) === "Shaam");
  const pending = list.filter((row) => row.status === "pending_fat");
  const fats = todayRows.map((row) => num(row.fat_percentage)).filter((_, index) => rowHas(todayRows[index], "fat_percentage"));
  const subahSeries = days.map((day) => milkLitres(list.filter((row) => row.entry_date === day && shiftLabel(row.shift) === "Subah")));
  const shaamSeries = days.map((day) => milkLitres(list.filter((row) => row.entry_date === day && shiftLabel(row.shift) === "Shaam")));
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="MCO / Chiller" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={2} label="Subah ka doodh" value={rows ? `${milkLitres(subah)} L` : "—"} color="#5B8CFF" series={subahSeries} pct={pctChange(subahSeries[subahSeries.length - 1] ?? null, subahSeries[subahSeries.length - 2] ?? null)} />
        <Kpi index={3} label="Shaam ka doodh" value={rows ? `${milkLitres(shaam)} L` : "—"} color="#C4B5FD" series={shaamSeries} pct={pctChange(shaamSeries[shaamSeries.length - 1] ?? null, shaamSeries[shaamSeries.length - 2] ?? null)} />
        <Kpi index={4} label="Avg fat" value={avg(fats) == null ? "—" : `${avg(fats)}%`} color="#3DDC97" series={fats} pct={null} />
        <Kpi index={5} label="Pending checks" value={rows ? String(pending.length) : "—"} color="#F5B942" series={[]} pct={null} />
      </View>
      <GlassCard title="Tank fill level" sub="Tank ka level track nahi hota" index={6}>
        <TankRow levels={[{ name: "Tank 1", pct: null }, { name: "Tank 2", pct: null }, { name: "Tank 3", pct: null }, { name: "Bulk", pct: null }]} />
      </GlassCard>
      <GlassCard title="MCA receipts" index={7}>
        {error ? <Text style={{ color: glass.muted }}>{error}</Text> : null}
        {pending.slice(0, 4).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: glass.text, flex: 1 }}>{row.mca_profile_id ? names.get(row.mca_profile_id) || "MCA" : "MCA"} · {litres(row)} L</Text>
            <Pill label="Pending" tone="orange" />
          </View>
        ))}
        {list.filter((row) => row.entry_date === today && row.status !== "pending_fat").slice(0, 3).map((row, index) => (
          <View key={`done-${row.id ?? index}`} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: glass.text, flex: 1 }}>{row.mca_profile_id ? names.get(row.mca_profile_id) || "MCA" : "MCA"} · {litres(row)} L · Fat {row.fat_percentage ?? "—"}</Text>
            <Pill label={row.status === "rejected" ? "Reject" : "Checked"} tone={row.status === "rejected" ? "red" : "green"} />
          </View>
        ))}
      </GlassCard>
      <Timeline title="Doodh ka safar" steps={milkTimeline(pending[0] ?? list[0] ?? null)} onAction={() => bar.onTab?.("fat")} />
    </GlassScreen>
  );
}

const DONUT_COLORS = ["#3DDC97", "#C4B5FD", "#F5B942", "#5B8CFF", "#FF6B6B"];

export function AdminGlass({ live, home, milk, orders, ...bar }: Refresh & { live?: LiveBag; home: AdminHome | null; milk: MilkRow[]; orders: OrderRow[] }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  const [farmers, setFarmers] = useState<number | null>(null);
  const auth = liveAuth(live);
  useEffect(() => {
    if (!auth) return;
    void liveGetScoped<{ id?: string }>(auth, "farmers?select=id&limit=200", fetch).then((rows) => {
      setFarmers(rows.ok ? rows.rows.length : null);
    });
  }, [auth?.token, auth?.url, auth?.testAccount]);
  if (!home) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const days = home.days.map((point) => point.amount);
  const labels = home.days.map((point) => romanWeekday(point.day));
  const milkToday = home.milk.state === "ok" ? home.milk.subah + home.milk.shaam : null;
  const approvals = approvalTimeline(home.pending, !home.pendingNote);
  const priced = milk.filter((row) => row.status === "priced");
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Admin" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      {home.banner ? <Text style={{ color: glass.gold, marginBottom: 8 }}>{home.banner}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={2} label="Total sales" value={home.sales.state === "ok" ? rupees(home.sales.total) : "—"} sub={home.sales.state === "error" ? "Asal bills nahi" : `${home.sales.bills} bill`} color="#C4B5FD" series={days} pct={pctChange(days[days.length - 1] ?? null, days[days.length - 2] ?? null)} />
        <Kpi index={3} label="Milk collection" value={milkToday == null ? "—" : `${Math.round(milkToday)} L`} color="#3DDC97" series={[]} pct={null} />
        <Kpi index={4} label="Grain stock" value="—" sub="Maund stock track nahi hota" color="#F5B942" series={[]} pct={null} />
        <Kpi index={5} label="Active farmers" value={farmers == null ? "—" : farmers >= 200 ? "200+" : String(farmers)} color="#5B8CFF" series={[]} pct={null} />
      </View>
      <GlassCard title="Revenue" sub={home.days.length ? "7 din" : "Sale nahi khuli"} index={6}>
        {days.length ? <LineChart values={days} labels={labels} color="#C4B5FD" /> : <Text style={{ color: glass.muted }}>{home.sales.state === "error" ? home.sales.message : "Chart nahi bana."}</Text>}
      </GlassCard>
      <GlassCard title="Category wise sales" index={7}>
        <Donut center={home.sales.state === "ok" ? rupees(home.sales.total) : "—"} parts={home.categories.map((part, index) => ({ label: part.label, value: part.amount, color: DONUT_COLORS[index % DONUT_COLORS.length] }))} />
      </GlassCard>
      <GlassCard title="Approvals · P&L" index={8}>
        {priced.slice(0, 3).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: glass.text, flex: 1 }}>Doodh {row.entry_date} · {row.total_amount == null ? "—" : rupees(num(row.total_amount))}</Text>
            <Pill label="Pending" tone="orange" />
          </View>
        ))}
        {home.pending.map((row) => <Text key={row.label} style={{ color: glass.muted, marginBottom: 4 }}>{row.label} · {row.count}</Text>)}
        {home.pendingNote ? <Text style={{ color: glass.muted }}>{home.pendingNote}</Text> : null}
      </GlassCard>
      <Timeline title="Manzoori" steps={approvals} onAction={() => bar.onTab?.("approvals")} />
      {orders.length ? <Text style={{ color: glass.muted }}>Orders {orders.length}</Text> : null}
    </GlassScreen>
  );
}

export function CustomerGlass({ live, khata, orders, ...bar }: Refresh & { live?: LiveBag; khata: KhataView | null; orders: ReadResult<OrderRow> | null }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  if (!khata || !orders) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = orders.ok ? orders.rows : [];
  const latest = list[0] ?? null;
  const totals = list.map((row) => num(row.grand_total));
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Customer" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={2} label="Mere orders" value={orders.ok ? String(list.length) : "—"} color="#5B8CFF" series={[]} pct={null} />
        <Kpi index={3} label="Baqi balance" value={money(khata.owed, Boolean(khata.note && khata.owed == null))} sub={khata.note || "Khata"} color="#F5B942" series={[]} pct={null} />
      </View>
      <GlassCard title="Mahana kharch" sub="Aakhri orders" index={4}>
        {orders.ok && totals.length ? <LineChart values={totals.slice().reverse()} labels={list.slice().reverse().map((row) => (row.created_at || "").slice(5, 10) || "—")} color="#F5B942" /> : <Text style={{ color: glass.muted }}>{orders.ok ? "Chart ke liye qatarein nahi." : orders.message}</Text>}
      </GlassCard>
      <GlassCard title="Order status" index={5}>
        {list.length === 0 ? <Text style={{ color: glass.muted }}>Koi order nahi.</Text> : null}
        {list.slice(0, 6).map((row, index) => {
          const tone = orderTone(row.status);
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: glass.text, fontWeight: "700" }}>{row.order_number || "Order"}</Text>
                <Text style={{ color: glass.muted }}>{row.grand_total == null ? "—" : rupees(num(row.grand_total))}</Text>
              </View>
              <Pill label={tone.label} tone={tone.tone} />
            </View>
          );
        })}
      </GlassCard>
      <Timeline title="Order ka safar" steps={orderTimeline(latest?.status, latest?.created_at?.slice(0, 10))} onAction={() => bar.onTab?.("orders")} />
    </GlassScreen>
  );
}

export function DealerGlass({ live, khata, orders, ...bar }: Refresh & { live?: LiveBag; khata: KhataView | null; orders: ReadResult<OrderRow> | null }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  if (!khata || !orders) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = orders.ok ? orders.rows : [];
  const monthKey = karachiDate().slice(0, 7);
  const dated = list.filter((row) => String(row.created_at || "").length >= 7);
  const monthCount = dated.filter((row) => String(row.created_at).startsWith(monthKey)).length;
  const days = karachiDaySeries(7);
  const byDay = days.map((day) => list.filter((row) => String(row.created_at || "").slice(0, 10) === day).reduce((sum, row) => sum + num(row.grand_total), 0));
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Dealer" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={2} label="Is mahine orders" value={orders.ok ? (dated.length ? String(monthCount) : String(list.length)) : "—"} sub={dated.length ? "Is mahine" : "Aakhri fehrist"} color="#3DDC97" series={byDay} pct={null} />
        <Kpi index={3} label="HQ khata balance" value={money(khata.owed, Boolean(khata.note && khata.owed == null))} sub={khata.note || "HQ khata"} color="#FF6B6B" series={[]} pct={null} />
        <Kpi index={4} label="Stock items" value="—" sub="Stock is login ko alag track nahi" color="#3DDC97" series={[]} pct={null} />
        <Kpi index={5} label="Kam stock" value="—" sub="Hadd se kam maal yahan nahi" color="#F5B942" series={[]} pct={null} />
      </View>
      <GlassCard title="Mahana orders" sub="Aakhri 7 din" index={6}>
        <BarChart values={byDay} labels={days.map(romanWeekday)} color="#5B8CFF" />
      </GlassCard>
      <GlassCard title="Stock" index={7}>
        <BarTrack label="Stock" value={null} max={null} color="#3DDC97" />
        <Text style={{ color: glass.muted }}>Dealer ka maal is screen par tab aayega jab stock is account ko nazar aaye. Abhi track nahi.</Text>
      </GlassCard>
      <GlassCard title="Recent orders" index={8}>
        {list.slice(0, 4).map((row, index) => {
          const tone = orderTone(row.status);
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <Text style={{ color: glass.text, flex: 1 }}>{row.order_number || "Order"} · {row.grand_total == null ? "—" : rupees(num(row.grand_total))}</Text>
              <Pill label={tone.label} tone={tone.tone} />
            </View>
          );
        })}
      </GlassCard>
      <Timeline title="Order ka safar" steps={orderTimeline(list[0]?.status, list[0]?.created_at?.slice(0, 10))} onAction={() => bar.onTab?.("orders")} />
    </GlassScreen>
  );
}

export function StaffGlass({ live, attendance, salary, advances, tasks, tasksNote, checkLabel, checkBusy, readOnly, onCheckIn, ...bar }: Refresh & {
  live?: LiveBag;
  attendance: ReadResult<{ attendance_date?: string | null; status?: string | null; check_in_at?: string | null }> | null;
  salary: ReadResult<{ net_salary?: number | string | null; pay_month?: number | null; pay_year?: number | null }> | null;
  advances: ReadResult<{ amount?: number | string | null }> | null;
  tasks: { label: string; count: number }[];
  tasksNote: string | null;
  checkLabel: string;
  checkBusy: boolean;
  readOnly: boolean;
  onCheckIn: () => void;
}) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  if (!attendance || !salary || !advances) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const today = karachiDate();
  const month = today.slice(0, 7);
  const monthRows = attendance.ok ? attendance.rows.filter((row) => String(row.attendance_date || "").startsWith(month)) : [];
  const present = monthRows.filter((row) => row.status === "present").length;
  const dayNum = Number(today.slice(8, 10));
  const pay = salary.ok && salary.rows[0]?.net_salary != null ? num(salary.rows[0].net_salary) : null;
  const advance = advances.ok && advances.rows[0]?.amount != null ? num(advances.rows[0].amount) : null;
  const taskDone = tasks.reduce((sum, task) => sum + task.count, 0);
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Staff" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      <Rise index={2}>
        <View style={{ backgroundColor: "#146B3A", borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Hazri lagayein</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{readOnly ? "Sirf dekhna. Check-in band hai." : checkLabel}</Text>
          </View>
          {readOnly ? null : (
            <Pressable onPress={() => { if (!checkBusy && !checkLabel.includes("ho chuka")) onCheckIn(); }} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#3DDC97", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#07140F", fontSize: 20, fontWeight: "800" }}>{checkBusy ? "…" : "✓"}</Text>
            </Pressable>
          )}
        </View>
      </Rise>
      <GlassCard title="Aaj ki duty" index={3}>
        <Text style={{ color: glass.text }}>{attendance.ok ? (monthRows.find((row) => row.attendance_date === today) ? `Check-in ${String(monthRows.find((row) => row.attendance_date === today)?.check_in_at || "").slice(11, 16) || "ho chuka"}` : "Aaj ki hazri abhi nahi") : attendance.message}</Text>
      </GlassCard>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={4} label="Is mahine tankhwah" value={pay == null ? "—" : rupees(pay)} sub={salary.ok && salary.rows.length === 0 ? "Tankhwah track nahi, qist nahi" : ""} color="#5B8CFF" series={[]} pct={null} />
        <Kpi index={5} label="Advance baqi" value={advance == null ? "—" : rupees(advance)} sub={advances.ok && advances.rows.length === 0 ? "Advance track nahi" : ""} color="#F5B942" series={[]} pct={null} />
        <Kpi index={6} label="Hazri" value={attendance.ok ? `${present}/${dayNum || "—"}` : "—"} color="#3DDC97" series={[]} pct={null} />
        <Kpi index={7} label="Tasks" value={tasksNote ? "—" : String(taskDone)} sub={tasksNote || "Ginati"} color="#C4B5FD" series={[]} pct={null} />
      </View>
      <GlassCard title="Aaj ke tasks" index={8}>
        {tasksNote ? <Text style={{ color: glass.muted }}>{tasksNote}</Text> : null}
        {!tasksNote && tasks.length === 0 ? <Text style={{ color: glass.muted }}>Aap ke naam koi task nahi.</Text> : null}
        {tasks.map((task) => (
          <View key={task.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: glass.text, flex: 1 }}>{task.label}</Text>
            <Pill label={task.count > 0 ? "Baqi" : "Done"} tone={task.count > 0 ? "orange" : "green"} />
          </View>
        ))}
      </GlassCard>
    </GlassScreen>
  );
}

export function VetGlass({ live, health, ...bar }: Refresh & { live?: LiveBag; health: HealthRow[] | null; error: string }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  const auth = liveAuth(live);
  const [animals, setAnimals] = useState<number | null>(null);
  const [animalNote, setAnimalNote] = useState<string | null>(null);
  useEffect(() => {
    if (!auth) return;
    void liveGetScoped<{ id?: string; status?: string | null }>(auth, "dairy_animals?select=id,status&limit=200", fetch).then((rows) => {
      if (!rows.ok) {
        setAnimals(null);
        setAnimalNote(rows.message);
        return;
      }
      setAnimals(rows.rows.filter((row) => row.status !== "sold" && row.status !== "dead").length);
      setAnimalNote(null);
    });
  }, [auth?.token, auth?.url]);
  const today = karachiDate();
  const visits = health ?? [];
  const todayVisits = visits.filter((row) => row.event_date === today);
  const pending = visits.filter((row) => row.next_due && String(row.next_due) >= today);
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Vet" name={face.name} onProfile={bar.onProfile} />
      <WeatherCard weather={weather} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <Kpi index={2} label="Aaj ke visits" value={health ? String(todayVisits.length) : "—"} color="#5B8CFF" series={[]} pct={null} />
        <Kpi index={3} label="Pending cases" value={health ? String(pending.length) : "—"} color="#F5B942" series={[]} pct={null} />
        <Kpi index={4} label="Ilaj mukammal" value={health ? String(visits.filter((row) => !row.next_due).length) : "—"} color="#3DDC97" series={[]} pct={null} />
        <Kpi index={5} label="Kisan ke janwar" value={animals == null ? "—" : String(animals)} sub={animalNote || ""} color="#C4B5FD" series={[]} pct={null} />
      </View>
      <GlassCard title="Aaj ke visits" index={6}>
        {bar.error ? <Text style={{ color: glass.muted }}>{bar.error}</Text> : null}
        {todayVisits.length === 0 ? <Text style={{ color: glass.muted }}>Aaj koi visit nahi.</Text> : null}
        {todayVisits.slice(0, 5).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", marginBottom: 8 }}>
            <Text style={{ color: glass.text, flex: 1 }}>{row.diagnosis || row.notes || "Visit"}</Text>
            <Pill label={row.kind === "vet_visit" ? "Visit" : row.kind || "Note"} tone="blue" />
          </View>
        ))}
      </GlassCard>
      <GlassCard title="Ilaj list / pending" index={7}>
        {pending.slice(0, 4).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
            <Text style={{ color: glass.text, flex: 1 }}>{row.diagnosis || row.medicine || "Ilaj"} · {row.next_due}</Text>
            <Pill label="Pending" tone="orange" />
          </View>
        ))}
        {health && pending.length === 0 ? <Text style={{ color: glass.muted }}>Koi pending ilaj nahi.</Text> : null}
      </GlassCard>
    </GlassScreen>
  );
}
