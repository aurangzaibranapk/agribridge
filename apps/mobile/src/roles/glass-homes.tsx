import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { cleanPerson } from "../../../../src/lib/mobile/display-name";
import { approvalJourney, approvalTimeline, compactRupee, hazarFigure, karachiClock, milkTimeline, monthBuckets, orderTimeline, pctChange, romanWeekday } from "../../../../src/lib/mobile/glass-metrics";
import { karachiDate, karachiDaySeries, liveGet, liveGetScoped, loadFarmerNames, loadMilkList, loadMilkWindow, loadMonthPurchases, loadMonthSales, loadOwnAttendance, loadPhoneNotes, loadSalesMonths, milkLitres, pricedMilkTotal, rupees, saleMonthKey, shiftLabel, type AdminHome, type HealthRow, type KhataView, type MilkRow, type OrderRow, type PhoneNote, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { liveAuth, type LiveBag } from "../bits";
import { ActionGrid, BarChart, BarTrack, BrandHeader, Donut, GlassCard, GlassScreen, Kpi, KpiGrid, LineChart, Pill, Rise, TankRow, TankTemp, Timeline, WeatherCard, glass, useFace, useWeather } from "../glass";

type Refresh = { refreshing?: boolean; onRefresh?: () => void; onProfile?: () => void; onTab?: (key: string) => void };

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function flatSeries(value: number | null | undefined): number[] {
  if (value == null || !Number.isFinite(value)) return [];
  return [value, value];
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

function orderTone(status: string | null | undefined, surface: "customer" | "dealer" = "customer"): { label: string; tone: "green" | "orange" | "red" | "blue" } {
  const key = String(status ?? "").toLowerCase();
  if (key === "delivered" || key === "completed" || key === "grn_submitted") return { label: "Delivered", tone: "green" };
  if (key === "in_transit" || key === "dispatched") return surface === "dealer" ? { label: "Dispatch", tone: "blue" } : { label: "Raste mein", tone: "blue" };
  if (key === "cancelled" || key === "rejected") return { label: "Cancel", tone: "red" };
  if (key === "processing" || key === "approved") return { label: "Pack", tone: "orange" };
  if (key === "submitted" || key === "draft" || key === "sales_verified" || key === "finance_verified" || !key) return { label: "Pending", tone: "orange" };
  return { label: "Pending", tone: "orange" };
}

function litreText(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  const body = Number.isInteger(rounded) ? Math.round(rounded).toLocaleString("en-PK") : String(rounded);
  return `${body} L`;
}

function lakhRupees(value: number): string {
  return `Rs ${Math.round(value).toLocaleString("en-IN")}`;
}

function taskPill(task: { count: number; detail?: string; status?: string | null }): { label: string; tone: "green" | "orange" | "blue" } {
  const status = `${task.status || ""} ${task.detail || ""}`.toLowerCase();
  if (/\bjari\b/.test(status)) return { label: "Jari", tone: "blue" };
  if (String(task.status || "").toLowerCase() === "done" || task.count <= 0) return { label: "Done", tone: "green" };
  return { label: "Baqi", tone: "orange" };
}

function money(value: number | null | undefined, missing: boolean): string {
  if (missing || value == null) return "—";
  return rupees(value);
}

function walletParts(owed: number | null | undefined, missing: boolean, baqaya: string): { value: string; sub: string } {
  if (missing || owed == null) return { value: "—", sub: baqaya };
  if (owed < 0) return { value: rupees(Math.abs(owed)), sub: "Credit" };
  return { value: rupees(owed), sub: baqaya };
}

function usePhoneNotes(live: LiveBag | undefined): PhoneNote[] | null {
  const auth = liveAuth(live);
  const [rows, setRows] = useState<PhoneNote[] | null>(null);
  useEffect(() => {
    if (!auth) return;
    let gone = false;
    void loadPhoneNotes(auth, fetch).then((result) => {
      if (!gone) setRows(result.ok ? result.rows : []);
    });
    return () => { gone = true; };
  }, [auth?.token, auth?.url]);
  return rows;
}

function noteNumber(rows: PhoneNote[] | null, key: string): number | null {
  const row = rows?.find((item) => item.key === key);
  if (!row || row.value == null || row.value === "") return null;
  const value = num(row.value);
  return Number.isFinite(value) ? value : null;
}

function orderAxis(value: number): string {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value) < 1000) return compactRupee(value);
  return hazarFigure(value);
}

function stockUnit(detail: string | null | undefined): string | null {
  const text = (detail || "").trim();
  if (!text || text.length > 12 || text.includes("%")) return null;
  return text;
}

function clockLabel(value: string | null | undefined): string | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value || "").trim());
  if (!match) return null;
  let hour = Number(match[1]);
  if (!Number.isFinite(hour) || hour > 23) return null;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${match[2]} ${suffix}`;
}

function monthTotals(rows: OrderRow[], today: string): { values: number[]; labels: string[] } {
  const buckets = monthBuckets(today, 6);
  return {
    labels: buckets.map((bucket) => bucket.label),
    values: buckets.map((bucket) => rows.filter((row) => saleMonthKey(row.created_at) === bucket.key).reduce((sum, row) => sum + num(row.grand_total), 0)),
  };
}

function useOrderExtra(live: LiveBag | undefined, orderId: string | null) {
  const auth = liveAuth(live);
  const [extra, setExtra] = useState<{ detail: string | null; details: (string | null)[]; times: (string | null)[]; place: string | null } | null>(null);
  useEffect(() => {
    if (!auth || !orderId) { setExtra(null); return; }
    const id = encodeURIComponent(orderId);
    void (async () => {
      const [items, dispatch, marks] = await Promise.all([
        liveGetScoped<{ product_name?: string | null; order_qty?: number | string | null }>(auth, `agri_order_items?select=product_name,order_qty&order_id=eq.${id}&limit=6`, fetch),
        liveGetScoped<{ driver_name?: string | null; vehicle_no?: string | null; delivery_location?: string | null }>(auth, `agri_dispatches?select=driver_name,vehicle_no,delivery_location&order_id=eq.${id}&order=created_at.desc&limit=1`, fetch),
        liveGetScoped<{ status?: string | null; created_at?: string | null }>(auth, `agri_order_timeline?select=status,created_at&order_id=eq.${id}&order=created_at.asc&limit=20`, fetch),
      ]);
      const item = items.ok ? items.rows[0] : null;
      const run = dispatch.ok ? dispatch.rows[0] : null;
      const detail = item?.product_name ? `${item.product_name}${item.order_qty != null && item.order_qty !== "" ? ` ${item.order_qty}` : ""}` : null;
      const rider = run && (run.driver_name || run.vehicle_no) ? `Rider: ${[run.driver_name, run.vehicle_no].filter(Boolean).join(" · ")}` : null;
      const times: (string | null)[] = [null, null, null, null, null];
      if (marks.ok) {
        for (const mark of marks.rows) {
          const steps = orderTimeline(mark.status);
          const index = steps.findIndex((step) => step.state === "active" || step.state === "action");
          const at = steps.every((step) => step.state === "done") ? 4 : index;
          const clock = karachiClock(mark.created_at);
          if (at >= 0 && at < 5 && clock && !times[at]) times[at] = clock;
        }
      }
      setExtra({ detail, details: [null, null, rider, run?.delivery_location || null, null], times, place: run?.delivery_location || null });
    })();
  }, [auth?.token, auth?.url, orderId]);
  return extra;
}

export function FarmerGlass({ live, khata, milk, names, focus = "home", footer, ...bar }: Refresh & { live?: LiveBag; khata: KhataView | null; milk: ReadResult<MilkRow> | null; names: Map<string, string>; focus?: "home" | "track"; footer?: ReactNode }) {
  const face = useFace(live, "Kisan / Customer");
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
  const latest = todayRows[0] ?? rows[0] ?? null;
  const milkTitle = latest ? `${latest.entry_date === today ? "Aaj ka doodh" : latest.entry_date || "Doodh"} · ${litres(latest)} L` : "Aaj ka doodh";
  const milkWho = latest ? [shiftLabel(latest.shift), latest.mca_profile_id ? names.get(latest.mca_profile_id) || "MCA" : null].filter(Boolean).join(" · ") : null;
  const yesterdayList = rows.filter((row) => row.entry_date === yesterday);
  const track = (
    <>
      <Timeline title={milkTitle} detail={milkWho} steps={milkTimeline(latest)} onAction={() => bar.onTab?.("doodh")} index={focus === "track" ? 2 : 8} />
      <GlassCard title="Kal ka doodh" index={focus === "track" ? 3 : 9}>
        {yesterdayList.length === 0 ? <Text style={{ color: glass.muted }}>Kal ki collection nahi.</Text> : null}
        {yesterdayList.slice(0, 3).map((row, index) => {
          const verified = row.status === "verified";
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: glass.text, fontWeight: "700" }}>{shiftLabel(row.shift)} · {litres(row)} L</Text>
                <Text style={{ color: glass.muted }}>Fat {row.fat_percentage ?? "—"}{row.rate_per_liter != null && row.rate_per_liter !== "" ? ` · Rs ${row.rate_per_liter}/L` : filledAmount(row) ? ` · ${rupees(num(row.total_amount))}` : ""}</Text>
              </View>
              <Pill label={verified ? "Wallet credit" : row.status === "pending_fat" ? "Pending" : row.status === "priced" ? "Rate laga" : "Saved"} tone={verified ? "green" : "orange"} mark={verified ? "check" : undefined} />
            </View>
          );
        })}
      </GlassCard>
      {footer}
    </>
  );
  if (focus === "track") {
    return (
      <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
        <BrandHeader role="Kisan / Customer" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
        {track}
      </GlassScreen>
    );
  }
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Kisan / Customer" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <WeatherCard weather={weather} />
      <ActionGrid title="Meri Services" actions={[
        { label: "Farms", key: "farm", onPress: () => bar.onTab?.("farm") },
        { label: "Dairy", key: "doodh", onPress: () => bar.onTab?.("doodh") },
        { label: "Orders", key: "karyana", onPress: () => bar.onTab?.("karyana") },
        { label: "Wallet", key: "khata", onPress: () => bar.onTab?.("khata") },
        { label: "Vet", key: "vet", onPress: () => bar.onTab?.("vet") },
        { label: "Profile", key: "more", onPress: bar.onProfile },
      ]} />
      <KpiGrid>
        <Kpi index={2} label="Wallet balance" value={walletParts(khata.owed, Boolean(khata.note && khata.owed == null), khata.note || "Khata baqaya").value} sub={walletParts(khata.owed, Boolean(khata.note && khata.owed == null), khata.note || "Khata baqaya").sub} color="#C8A058" series={payLine} pct={pctChange(weekPay, prevPay)} />
        <Kpi index={3} label="Aaj ka doodh" value={milk.ok ? litreText(milkLitres(todayRows)) : "—"} sub={milk.ok ? "" : milk.message} color="#5B8CFF" series={series} pct={pctChange(milkLitres(todayRows), yesterday ? milkLitres(yesterdayRows) : null)} />
        <Kpi index={4} label="Fat / SNF avg" value={avg(fats) == null && avg(snfs) == null ? "—" : `${avg(fats) ?? "—"} / ${avg(snfs) ?? "—"}`} color="#C4B5FD" series={fats.length ? fats : []} pct={pctChange(avg(fats), avg(yFats))} />
        <Kpi index={5} label="Hafte ki kamai" value={money(weekPay, weekPay == null)} sub={`${week.start} se ${week.end}`} color="#F5B942" series={payLine} pct={pctChange(weekPay, prevPay)} />
      </KpiGrid>
      <GlassCard title="Pichlay 7 din ka doodh (L)" sub={series.some((value) => value > 0) ? `Avg ${(series.reduce((sum, value) => sum + value, 0) / series.length).toFixed(1)} L` : "Abhi litre nahi"} index={7}>
        {!milk.ok ? <Text style={{ color: glass.muted }}>{milk.message}</Text> : <LineChart values={series} labels={days.map(romanWeekday)} color="#3DDC97" />}
      </GlassCard>
      <GlassCard title="Aakhri collections" index={8}>
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
    </GlassScreen>
  );
}

function filledAmount(row: MilkRow): boolean {
  return row.total_amount != null && row.total_amount !== "";
}

function rowHas(row: MilkRow | undefined, key: "fat_percentage" | "snf_percentage"): boolean {
  const value = row?.[key];
  return value != null && value !== "";
}

function fatNums(rows: MilkRow[]): number[] {
  return rows.map((row) => num(row.fat_percentage)).filter((_, index) => rowHas(rows[index], "fat_percentage"));
}

function fatOn(rows: MilkRow[], day: string): number | null {
  return avg(fatNums(rows.filter((row) => row.entry_date === day)));
}

export function McaGlass({ live, farmers, ...bar }: Refresh & { live?: LiveBag; farmers: { id?: string; full_name?: string | null }[] }) {
  const face = useFace(live, "MCA");
  const weather = useWeather(face.place);
  const auth = liveAuth(live);
  const [milk, setMilk] = useState<ReadResult<MilkRow> | null>(null);
  const [week, setWeek] = useState<ReadResult<Pick<MilkRow, "entry_date" | "shift" | "quantity_liters">> | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const days = karachiDaySeries(7);
  useEffect(() => {
    if (!auth) return;
    void loadMilkList(auth, fetch, 80).then(async (rows) => {
      setMilk(rows);
      if (rows.ok) setNames(await loadFarmerNames(auth, rows.rows.map((row) => row.farmer_id || ""), fetch));
    });
    void loadMilkWindow(auth, days[0], days[days.length - 1], fetch).then(setWeek);
  }, [auth?.token, auth?.url, auth?.testAccount]);
  const rows = milk?.ok ? milk.rows : [];
  const today = karachiDate();
  const yesterday = days[days.length - 2];
  const todayRows = rows.filter((row) => row.entry_date === today);
  const series = dayValues(rows, days);
  const pending = todayRows.filter((row) => row.status === "pending_fat").length;
  const yesterdayRows = rows.filter((row) => row.entry_date === yesterday);
  const yPending = yesterdayRows.filter((row) => row.status === "pending_fat").length;
  const fats = fatNums(todayRows);
  const yFats = fatNums(yesterdayRows);
  const todayFat = avg(fats);
  const yFat = avg(yFats);
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="DCA / Milk Collection" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <WeatherCard weather={weather} />
      <ActionGrid actions={[
        { label: "Entry", key: "route", onPress: () => bar.onTab?.("route") },
        { label: "Kisan", key: "fuel", onPress: () => bar.onTab?.("fuel") },
        { label: "Pending", key: "route", onPress: () => bar.onTab?.("route") },
        { label: "Meter", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Petrol", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Profile", key: "more", onPress: bar.onProfile },
      ]} />
      <KpiGrid>
        <Kpi index={2} label="Aaj ki collection" value={milk?.ok ? litreText(milkLitres(todayRows)) : "—"} color="#3DDC97" series={series} pct={pctChange(milkLitres(todayRows), milkLitres(rows.filter((row) => row.entry_date === yesterday)))} />
        <Kpi index={3} label="Kisan count" value={String(farmers.length)} color="#F5B942" series={flatSeries(farmers.length)} pct={null} badge="count" />
        <Kpi index={4} label="Pending entries" value={milk?.ok ? String(pending) : "—"} color="#F5B942" series={milk?.ok ? [yPending, pending] : []} pct={pctChange(pending, yPending)} />
        <Kpi index={5} label="Avg fat" value={todayFat == null ? "—" : `${todayFat}%`} color="#C4B5FD" series={todayFat != null && yFat != null ? [yFat, todayFat] : flatSeries(todayFat)} pct={pctChange(todayFat, yFat)} />
      </KpiGrid>
      <GlassCard title="Haftay ki collection (L)" sub={week?.ok && week.rows.length >= 500 ? "Hafta adhoora hai" : "7 din"} index={6}>
        <BarChart values={week?.ok && week.rows.length < 500 ? dayValues(week.rows as MilkRow[], days) : series} labels={days.map(romanWeekday)} color="#5B8CFF" />
      </GlassCard>
      <GlassCard title="Aaj ki entries" badge={todayRows.length > 4 ? `+${todayRows.length - 4}` : null} index={7}>
        {!milk ? <ActivityIndicator color={glass.up} /> : null}
        {milk && !milk.ok ? <Text style={{ color: glass.muted }}>{milk.message}</Text> : null}
        {milk?.ok && todayRows.length === 0 ? <Text style={{ color: glass.muted }}>Aaj koi entry nahi.</Text> : null}
        {todayRows.slice(0, 4).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: glass.text, fontWeight: "700" }}>{cleanPerson(row.farmer_id ? names.get(row.farmer_id) : "") || row.route_name || "Kisan"}</Text>
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
  const face = useFace(live, "MCO / Chiller");
  const notes = usePhoneNotes(live);
  const days = karachiDaySeries(7);
  const [week, setWeek] = useState<ReadResult<Pick<MilkRow, "entry_date" | "shift" | "quantity_liters">> | null>(null);
  const auth = liveAuth(live);
  useEffect(() => {
    if (!auth) return;
    void loadMilkWindow(auth, days[0], days[days.length - 1], fetch).then(setWeek);
  }, [auth?.token, auth?.url, auth?.testAccount]);
  if (!rows && !error) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = rows ?? [];
  const weekRows = week?.ok && week.rows.length < 500 ? week.rows : list;
  const today = karachiDate();
  const todayRows = list.filter((row) => row.entry_date === today);
  const subah = todayRows.filter((row) => shiftLabel(row.shift) === "Subah");
  const shaam = todayRows.filter((row) => shiftLabel(row.shift) === "Shaam");
  const pending = todayRows.filter((row) => row.status === "pending_fat");
  const fats = fatNums(todayRows);
  const fatSeries = days.map((day) => fatOn(list, day)).filter((value): value is number => value != null);
  const subahSeries = days.map((day) => milkLitres(weekRows.filter((row) => row.entry_date === day && shiftLabel(row.shift) === "Subah")));
  const shaamSeries = days.map((day) => milkLitres(weekRows.filter((row) => row.entry_date === day && shiftLabel(row.shift) === "Shaam")));
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="MCO / Chiller" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <ActionGrid actions={[
        { label: "Receive", key: "fat", onPress: () => bar.onTab?.("fat") },
        { label: "Tanks", key: "drop", onPress: () => bar.onTab?.("drop") },
        { label: "Pending", key: "fat", onPress: () => bar.onTab?.("fat") },
        { label: "Kisan", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Reports", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Profile", key: "more", onPress: bar.onProfile },
      ]} />
      <KpiGrid>
        <Kpi index={2} label="Subah ka doodh" value={rows ? litreText(milkLitres(subah)) : "—"} color="#5B8CFF" series={subahSeries} pct={pctChange(subahSeries[subahSeries.length - 1] ?? null, subahSeries[subahSeries.length - 2] ?? null)} />
        <Kpi index={3} label="Shaam ka doodh" value={rows ? litreText(milkLitres(shaam)) : "—"} color="#C4B5FD" series={shaamSeries} pct={pctChange(shaamSeries[shaamSeries.length - 1] ?? null, shaamSeries[shaamSeries.length - 2] ?? null)} />
        <Kpi index={4} label="Avg fat" value={avg(fats) == null ? "—" : `${avg(fats)}%`} color="#3DDC97" series={fatSeries.length >= 2 ? fatSeries : fats.length ? fats : []} pct={pctChange(fatOn(list, today), fatOn(list, days[days.length - 2]))} />
        <Kpi index={5} label="Pending checks" value={rows ? String(pending.length) : "—"} color="#F5B942" badge="count" series={days.map((day) => list.filter((row) => row.entry_date === day && row.status === "pending_fat").length)} pct={null} />
      </KpiGrid>
      <GlassCard title="Tank fill level" aside={<TankTemp celsius={noteNumber(notes, "home.tank.temp")} status={stockUnit(notes?.find((row) => row.key === "home.tank.temp")?.detail)} />} sub={notes && notes.some((row) => String(row.key || "").startsWith("home.tank.")) ? undefined : "Tank ka level set nahi"} index={6}>
        <TankRow levels={[1, 2, 3, 4].map((index) => {
          const row = notes?.find((item) => item.key === `home.tank.${index}`);
          return { name: row?.label || ["Tank 1", "Tank 2", "Tank 3", "Bulk"][index - 1], pct: noteNumber(notes, `home.tank.${index}`) };
        })} />
      </GlassCard>
      <GlassCard title="MCA receipts" index={7}>
        {error ? <Text style={{ color: glass.muted }}>{error}</Text> : null}
        {pending.slice(0, 4).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: glass.text, flex: 1, fontWeight: "700" }}>{row.route_name || row.chiller_name || "Centre"}</Text>
              <Pill label="Pending" tone="orange" />
            </View>
            <Text style={{ color: glass.muted }}>{cleanPerson(row.farmer_id ? names.get(row.farmer_id) : "") || "Kisan"} · {litres(row)} L · {row.route_name || row.chiller_name || "Centre"}</Text>
          </View>
        ))}
        {list.filter((row) => row.entry_date === today && row.status !== "pending_fat").slice(0, 3).map((row, index) => (
          <View key={`done-${row.id ?? index}`} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ color: glass.text, flex: 1, fontWeight: "700" }}>{row.route_name || row.chiller_name || "Centre"}</Text>
              <Pill label={row.status === "rejected" ? "Reject" : "Checked"} tone={row.status === "rejected" ? "red" : "green"} />
            </View>
            <Text style={{ color: glass.muted }}>{cleanPerson(row.farmer_id ? names.get(row.farmer_id) : "") || "Kisan"} · {litres(row)} L · Fat {row.fat_percentage ?? "—"}</Text>
          </View>
        ))}
      </GlassCard>
    </GlassScreen>
  );
}

const DONUT_COLORS = ["#3DDC97", "#C4B5FD", "#F5B942", "#5B8CFF", "#FF6B6B"];

export function AdminGlass({ live, home, milk, orders: _orders, focus = "home", footer, onVerify, ...bar }: Refresh & { live?: LiveBag; home: AdminHome | null; milk: MilkRow[]; orders: OrderRow[]; focus?: "home" | "track"; footer?: ReactNode; onVerify?: (row: MilkRow) => void }) {
  const face = useFace(live, "Admin");
  const [farmers, setFarmers] = useState<number | null>(null);
  const [monthSales, setMonthSales] = useState<{ total: number | null; note: string | null } | null>(null);
  const [monthKharch, setMonthKharch] = useState<{ total: number | null; note: string | null } | null>(null);
  const [saleMonths, setSaleMonths] = useState<{ ok: true; values: number[]; labels: string[]; cut: boolean } | { ok: false; message: string } | null>(null);
  const auth = liveAuth(live);
  const notes = usePhoneNotes(live);
  useEffect(() => {
    if (!auth) return;
    void liveGetScoped<{ id?: string }>(auth, "farmers?select=id&limit=200", fetch).then((rows) => {
      setFarmers(rows.ok ? rows.rows.length : null);
    });
    const start = `${karachiDate().slice(0, 7)}-01`;
    void loadMonthSales(auth, start, fetch).then(setMonthSales);
    void loadMonthPurchases(auth, start, fetch).then(setMonthKharch);
    void loadSalesMonths(auth, karachiDate(), fetch).then(setSaleMonths);
  }, [auth?.token, auth?.url, auth?.testAccount]);
  if (!home) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const days = home.days.map((point) => point.amount);
  const monthLine = saleMonths?.ok ? saleMonths : null;
  const catNotes = [1, 2, 3, 4].map((index) => notes?.find((row) => row.key === `home.cat.${index}`));
  const seededCats = catNotes.every((row) => row?.label && row.value != null && row.value !== "");
  const catParts = seededCats
    ? catNotes.map((row, index) => ({ label: row?.label || "", value: num(row?.value), color: DONUT_COLORS[index % DONUT_COLORS.length] }))
    : home.categories.slice(0, 4).map((part, index) => ({ label: part.label, value: part.amount, color: DONUT_COLORS[index % DONUT_COLORS.length] }));
  const milkToday = home.milk.state === "ok" ? home.milk.subah + home.milk.shaam : null;
  const milkSeries = karachiDaySeries(7).map((day) => milkLitres(milk.filter((row) => row.entry_date === day)));
  const approvals = approvalTimeline(home.pending, !home.pendingNote);
  const priced = milk.filter((row) => row.status === "priced");
  const hero = milk.find((row) => row.status === "verified") ?? priced[0] ?? milk.find((row) => row.status === "pending_fat") ?? null;
  const approvalSteps = hero ? approvalJourney(hero) : home.pending.length ? approvals : home.pendingNote ? approvalTimeline([], false) : approvalJourney(null);
  const approvalTitle = hero ? `Doodh · ${hero.entry_date || "—"}` : home.pending[0] ? `${home.pending[0].label} · ${home.pending[0].count}` : "Koi manzoori baqi nahi";
  const approvalDetail = hero
    ? [hero.quantity_liters != null ? `${hero.quantity_liters} L` : null, hero.total_amount != null && hero.total_amount !== "" ? rupees(num(hero.total_amount)) : null].filter(Boolean).join(" · ") || null
    : home.pendingNote;
  const salesCut = monthSales?.note === "Sale ki fehrist adhoori hai.";
  const salesActual = monthSales && !salesCut ? monthSales.total : null;
  const revPct = monthLine && monthLine.values.length >= 2 ? pctChange(monthLine.values[monthLine.values.length - 1], monthLine.values[monthLine.values.length - 2]) : null;
  const revAside = revPct == null ? null : `${revPct > 0 ? "▲" : "▼"} ${Math.abs(revPct)}% is mahina`;
  const munafa = monthSales?.total != null && monthKharch?.total != null ? monthSales.total - monthKharch.total : null;
  void _orders;
  const baqi = (
    <GlassCard title="Baqi approvals" index={5}>
      {priced.filter((row) => row !== hero).map((row, index) => (
        <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: glass.text, fontWeight: "700" }}>Doodh {row.entry_date || "—"}</Text>
            <Text style={{ color: glass.muted }}>{row.total_amount == null || row.total_amount === "" ? "Raqam —" : rupees(num(row.total_amount))}</Text>
          </View>
          <Pill label="Check baqi" tone="orange" />
        </View>
      ))}
      {milk.filter((row) => row.status === "pending_fat" && row !== hero).slice(0, 4).map((row, index) => (
        <View key={row.id ?? `fat-${index}`} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: glass.text, fontWeight: "700" }}>Doodh {row.entry_date || "—"}</Text>
            <Text style={{ color: glass.muted }}>Fat check baqi</Text>
          </View>
          <Pill label="Pending" tone="orange" />
        </View>
      ))}
      {home.pending.map((row) => (
        <View key={row.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: glass.text, fontWeight: "700" }}>{row.label}</Text>
            <Text style={{ color: glass.muted }}>{row.count} baqi</Text>
          </View>
          <Pill label="Pending" tone="orange" />
        </View>
      ))}
      {!priced.length && !home.pending.length && !milk.some((row) => row.status === "pending_fat") ? <Text style={{ color: glass.muted }}>Koi baqi manzoori nahi.</Text> : null}
      {home.pendingNote ? <Text style={{ color: glass.muted }}>{home.pendingNote}</Text> : null}
    </GlassCard>
  );
  if (focus === "track") {
    return (
      <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
        <BrandHeader role="Admin" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
        <Timeline title={approvalTitle} detail={approvalDetail} steps={approvalSteps} onAction={() => { if (hero && hero.status === "priced" && onVerify) onVerify(hero); else bar.onTab?.("approvals"); }} index={2} />
        {baqi}
        {footer}
      </GlassScreen>
    );
  }
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Admin" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <ActionGrid actions={[
        { label: "Reports", key: "reports", onPress: () => bar.onTab?.("reports") },
        { label: "Approvals", key: "approvals", onPress: () => bar.onTab?.("approvals") },
        { label: "Branches", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Shops", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Alerts", key: "approvals", onPress: () => bar.onTab?.("approvals") },
        { label: "Profile", key: "more", onPress: bar.onProfile },
      ]} />
      <KpiGrid>
        <Kpi index={2} label="Total sales" value={home.sales.state === "ok" ? rupees(home.sales.total) : "—"} sub={home.sales.state === "error" ? "Asal bills nahi" : `${home.sales.bills} bill`} color="#C4B5FD" series={days} pct={pctChange(days[days.length - 1] ?? null, days[days.length - 2] ?? null)} />
        <Kpi index={3} label="Milk collection" value={milkToday == null ? "—" : litreText(milkToday)} color="#3DDC97" series={milkSeries.some((value) => value > 0) ? milkSeries : milkToday == null ? [] : [milkToday, milkToday]} pct={milkSeries.some((value) => value > 0) ? pctChange(milkSeries[milkSeries.length - 1], milkSeries[milkSeries.length - 2]) : null} />
        <Kpi index={4} label="Grain stock" value={noteNumber(notes, "home.grain.maund") == null ? "—" : `${Math.round(noteNumber(notes, "home.grain.maund") || 0)} mn`} sub={noteNumber(notes, "home.grain.maund") == null ? "Maund record nahi mila" : "Maund"} color="#F5B942" series={noteNumber(notes, "home.grain.maund") == null ? [] : [noteNumber(notes, "home.grain.maund") || 0, noteNumber(notes, "home.grain.maund") || 0]} pct={null} />
        <Kpi index={5} label="Active farmers" value={farmers == null ? "—" : farmers >= 200 ? "200+" : String(farmers)} color="#5B8CFF" series={farmers == null ? [] : [farmers, farmers]} pct={null} badge="count" />
      </KpiGrid>
      <GlassCard title="Revenue (lakh Rs)" aside={revAside ? <Text style={{ color: revPct != null && revPct < 0 ? glass.down : glass.up, fontSize: 12, fontWeight: "700" }}>{revAside}</Text> : null} sub={monthLine?.cut ? "fehrist adhoori" : undefined} index={6}>
        {monthLine && monthLine.values.some((value) => value > 0) ? <LineChart values={monthLine.values} labels={monthLine.labels} color="#C4B5FD" /> : <Text style={{ color: glass.muted }}>{saleMonths && !saleMonths.ok ? saleMonths.message : home.sales.state === "error" ? home.sales.message : "Chart ke liye mahine ki sale nahi."}</Text>}
      </GlassCard>
      <GlassCard title="Category wise sales" index={7}>
        <Donut center={seededCats ? (salesActual != null ? rupees(salesActual) : "—") : home.sales.state === "ok" ? rupees(home.sales.total) : "—"} parts={catParts} />
      </GlassCard>
      <GlassCard title="Approvals · P&L" index={8}>
        {priced.slice(0, 2).map((row, index) => (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: glass.text, fontWeight: "700" }}>Doodh {row.entry_date || "—"} · {row.total_amount == null || row.total_amount === "" ? "—" : rupees(num(row.total_amount))}</Text>
              <Text style={{ color: glass.muted }}>Entry · fat check</Text>
            </View>
            <Pill label="Pending" tone="orange" />
          </View>
        ))}
        {home.pending.slice(0, 2).map((row) => (
          <View key={row.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: glass.text, fontWeight: "700" }}>{row.label}</Text>
              <Text style={{ color: glass.muted }}>{row.count} baqi</Text>
            </View>
            <Pill label="Pending" tone="orange" />
          </View>
        ))}
        {home.pendingNote ? <Text style={{ color: glass.muted, marginBottom: 8 }}>{home.pendingNote}</Text> : null}
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 4 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: glass.text, fontWeight: "800" }}>Is mahina munafa</Text>
            <Text style={{ color: glass.muted }}>{monthSales?.total != null && monthKharch?.total != null ? `Income ${rupees(monthSales.total)} · Kharch ${rupees(monthKharch.total)}` : monthSales?.note || monthKharch?.note || "Mahina khul raha hai"}</Text>
          </View>
          <Text style={{ color: munafa != null && munafa < 0 ? glass.down : glass.up, fontSize: 16, fontWeight: "800" }}>{munafa == null ? "—" : `${munafa > 0 ? "+" : ""} ${rupees(munafa)}`}</Text>
        </View>
      </GlassCard>
    </GlassScreen>
  );
}

function featuredOrder(rows: OrderRow[]): OrderRow | null {
  const open = rows.filter((row) => !["delivered", "completed", "grn_submitted", "cancelled", "rejected"].includes(String(row.status || "").toLowerCase()));
  const moving = open.find((row) => ["dispatched", "in_transit", "processing", "approved"].includes(String(row.status || "").toLowerCase()));
  return moving ?? open[0] ?? rows[0] ?? null;
}

function orderCard(row: OrderRow | null, extra: ReturnType<typeof useOrderExtra>) {
  const total = row?.grand_total == null || row.grand_total === "" ? null : lakhRupees(num(row.grand_total));
  const detail = [extra?.detail, total].filter(Boolean).join(" · ") || null;
  const times = extra?.times ? [...extra.times] : undefined;
  if (times && row?.created_at) times[0] = times[0] || karachiClock(row.created_at);
  return {
    title: row?.order_number ? `Order #${row.order_number}` : "Order",
    detail,
    steps: orderTimeline(row?.status, row?.created_at, { details: extra?.details, times }),
    progressNote: extra?.place || null,
  };
}

export function CustomerGlass({ live, khata, orders, focus = "home", ...bar }: Refresh & { live?: LiveBag; khata: KhataView | null; orders: ReadResult<OrderRow> | null; focus?: "home" | "track" }) {
  const face = useFace(live, "Customer");
  const weather = useWeather(face.place);
  const preview = orders?.ok ? featuredOrder(orders.rows) : null;
  const extra = useOrderExtra(live, preview?.id ?? null);
  if (!khata || !orders) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = orders.ok ? orders.rows : [];
  const latest = featuredOrder(list);
  const card = orderCard(latest, extra);
  const months = monthTotals(list, karachiDate());
  const today = karachiDate();
  const others = list.filter((row) => row.id !== latest?.id);
  if (focus === "track") {
    return (
      <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
        <BrandHeader role="Customer" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
        <Timeline
          title={latest ? card.title : "Order"}
          detail={latest ? card.detail : null}
          steps={latest ? card.steps : ["Order mila", "Pack hua", "Rawana hua", "Raste mein", "Pohanch gaya"].map((label) => ({ label, state: "pending" as const }))}
          showProgress={Boolean(latest)}
          progressNote={latest ? card.progressNote : null}
          onAction={() => bar.onTab?.("orders")}
          index={2}
        />
        <GlassCard title="Doosre orders" index={3}>
          {others.length === 0 ? <Text style={{ color: glass.muted }}>{orders.ok ? "Koi doosra order nahi." : orders.message}</Text> : null}
          {others.slice(0, 4).map((row, index) => {
            const tone = orderTone(row.status);
            return (
              <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={{ color: glass.text, fontWeight: "700" }}>#{row.order_number || "—"}</Text>
                  <Text style={{ color: glass.muted }}>{orderWhen(row.created_at, today)} · {row.grand_total == null || row.grand_total === "" ? "—" : lakhRupees(num(row.grand_total))}</Text>
                </View>
                <Pill label={tone.label} tone={tone.tone} mark={tone.tone === "green" ? "check" : undefined} />
              </View>
            );
          })}
        </GlassCard>
      </GlassScreen>
    );
  }
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Customer" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <WeatherCard weather={weather} />
      <KpiGrid>
        <Kpi index={2} label="Mere orders" value={orders.ok ? String(list.length) : "—"} color="#5B8CFF" badge="count" series={orders.ok ? orderCountSeries(list, today) : []} pct={null} />
        <Kpi index={3} label="Baqi balance" value={walletParts(khata.owed, Boolean(khata.note && khata.owed == null), khata.note || "Khata").value} sub={walletParts(khata.owed, Boolean(khata.note && khata.owed == null), khata.note || "Khata").sub} color="#F5B942" series={flatSeries(khata.owed == null ? null : Math.abs(khata.owed))} pct={null} />
      </KpiGrid>
      <GlassCard title="Mahana kharch (hazar Rs)" index={4}>
        {orders.ok && months.values.some((value) => value > 0) ? <LineChart values={months.values} labels={months.labels} color="#F5B942" /> : <Text style={{ color: glass.muted }}>{orders.ok ? "Chart ke liye qatarein nahi." : orders.message}</Text>}
      </GlassCard>
      <GlassCard title="Order status" index={5}>
        {!orders.ok ? <Text style={{ color: glass.muted }}>{orders.message}</Text> : null}
        {orders.ok && list.length === 0 ? <Text style={{ color: glass.muted }}>Koi order nahi.</Text> : null}
        {list.slice(0, 4).map((row, index) => {
          const tone = orderTone(row.status);
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: glass.text, fontWeight: "700" }}>#{row.order_number || "—"}{extra && row.id === latest?.id && extra.detail ? ` · ${extra.detail}` : ""}</Text>
                <Text style={{ color: glass.muted }}>{orderWhen(row.created_at, today)} · {row.grand_total == null || row.grand_total === "" ? "—" : lakhRupees(num(row.grand_total))}</Text>
              </View>
              <Pill label={tone.label} tone={tone.tone} />
            </View>
          );
        })}
      </GlassCard>
    </GlassScreen>
  );
}

function orderCountSeries(rows: OrderRow[], today: string): number[] {
  if (rows.length >= 40) return flatSeries(rows.length);
  const counts = monthBuckets(today, 2).map((bucket) => rows.filter((row) => saleMonthKey(row.created_at) === bucket.key).length);
  return counts.length === 2 ? counts : flatSeries(rows.length);
}

function orderWhen(iso: string | null | undefined, today: string): string {
  if (!iso) return "—";
  const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
  if (day === today) return "Aaj";
  const yesterday = new Date(`${today}T12:00:00+05:00`);
  yesterday.setDate(yesterday.getDate() - 1);
  const y = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(yesterday);
  if (day === y) return "Kal";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const month = months[Number(day.slice(5, 7)) - 1];
  return month ? `${Number(day.slice(8, 10))} ${month}` : day;
}

export function DealerGlass({ live, khata, orders, ...bar }: Refresh & { live?: LiveBag; khata: KhataView | null; orders: ReadResult<OrderRow> | null }) {
  const face = useFace(live, "Dealer");
  const notes = usePhoneNotes(live);
  if (!khata || !orders) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = orders.ok ? orders.rows : [];
  const buckets = monthBuckets(karachiDate(), 6);
  const monthKey = buckets[buckets.length - 1]?.key ?? "";
  const prevKey = buckets[buckets.length - 2]?.key ?? "";
  const countOf = (key: string) => list.filter((row) => saleMonthKey(row.created_at) === key).length;
  const monthCount = countOf(monthKey);
  const prevCount = countOf(prevKey);
  const dated = list.some((row) => saleMonthKey(row.created_at).length === 7);
  const countSeries = buckets.map((bucket) => countOf(bucket.key));
  const months = monthTotals(list, karachiDate());
  const stockItems = noteNumber(notes, "home.dealer.items");
  const stockLow = noteNumber(notes, "home.dealer.low");
  const stockBars = (notes ?? []).filter((row) => String(row.key || "").startsWith("home.dealer.stock.") && row.label);
  const stockMax = Math.max(1, ...stockBars.map((row) => num(row.value)));
  const hq = walletParts(khata.owed, Boolean(khata.note && khata.owed == null), khata.note || "HQ khata");
  const today = karachiDate();
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Dealer" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <ActionGrid actions={[
        { label: "Orders", key: "orders", onPress: () => bar.onTab?.("orders") },
        { label: "Khata", key: "khata", onPress: () => bar.onTab?.("khata") },
        { label: "Stock", key: "home", onPress: () => bar.onTab?.("home") },
        { label: "Reports", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Recovery", key: "khata", onPress: () => bar.onTab?.("khata") },
        { label: "Profile", key: "more", onPress: bar.onProfile },
      ]} />
      <KpiGrid>
        <Kpi index={2} label="Is mahine orders" value={orders.ok ? (dated ? String(monthCount) : String(list.length)) : "—"} sub={dated ? "Is mahine" : "Aakhri fehrist"} color="#3DDC97" series={countSeries.some((value) => value > 0) ? countSeries : flatSeries(orders.ok ? list.length : null)} pct={dated ? pctChange(monthCount, prevCount) : null} />
        <Kpi index={3} label="HQ khata balance" value={hq.value} sub={hq.sub} color="#FF6B6B" series={flatSeries(khata.owed == null ? null : Math.abs(khata.owed))} pct={null} />
        <Kpi index={4} label="Stock items" value={stockItems == null ? "—" : String(Math.round(stockItems))} sub={notes == null ? "" : stockItems == null ? "Stock record nahi mila" : "Items"} color="#3DDC97" series={flatSeries(stockItems)} pct={null} badge="count" />
        <Kpi index={5} label="Kam stock" value={stockLow == null ? "—" : String(Math.round(stockLow))} sub={notes == null ? "" : stockLow == null ? "Hadd se kam maal nahi mila" : "Hadd se kam"} color="#F5B942" series={flatSeries(stockLow)} pct={null} badge="count" />
      </KpiGrid>
      <GlassCard title="Mahana orders (hazar Rs)" index={6}>
        <BarChart values={months.values} labels={months.labels} color="#5B8CFF" format={orderAxis} />
      </GlassCard>
      <GlassCard title="Stock" index={7}>
        {stockBars.length ? stockBars.map((row, index) => (
          <BarTrack key={row.key || String(index)} label={row.label || "Item"} value={num(row.value)} max={stockMax} color={DONUT_COLORS[index % DONUT_COLORS.length]} unit={stockUnit(row.detail)} />
        )) : (
          <>
            <BarTrack label="Items" value={stockItems} max={stockItems == null ? null : Math.max(stockItems, 1)} color="#3DDC97" />
            <BarTrack label="Kam stock" value={stockLow} max={stockItems} color="#F5B942" />
          </>
        )}
      </GlassCard>
      <GlassCard title="Recent orders" index={8}>
        {list.slice(0, 4).map((row, index) => {
          const tone = orderTone(row.status, "dealer");
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: glass.text, fontWeight: "700" }}>#{row.order_number || "—"}</Text>
                <Text style={{ color: glass.muted }}>{orderWhen(row.created_at, today)} · {row.grand_total == null || row.grand_total === "" ? "—" : lakhRupees(num(row.grand_total))}</Text>
              </View>
              <Pill label={tone.label} tone={tone.tone} mark={tone.tone === "green" ? "check" : undefined} />
            </View>
          );
        })}
        {orders.ok && list.length === 0 ? <Text style={{ color: glass.muted }}>Koi order nahi.</Text> : null}
        {!orders.ok ? <Text style={{ color: glass.muted }}>{orders.message}</Text> : null}
      </GlassCard>
    </GlassScreen>
  );
}

export function StaffGlass({ live, attendance, salary, advances, tasks, tasksNote, checkLabel, checkBusy, readOnly, onCheckIn, ...bar }: Refresh & {
  live?: LiveBag;
  attendance: ReadResult<{ attendance_date?: string | null; status?: string | null; check_in_at?: string | null }> | null;
  salary: ReadResult<{ net_salary?: number | string | null; pay_month?: number | null; pay_year?: number | null }> | null;
  advances: ReadResult<{ amount?: number | string | null }> | null;
  tasks: { label: string; count: number; detail?: string; status?: string | null }[];
  tasksNote: string | null;
  checkLabel: string;
  checkBusy: boolean;
  readOnly: boolean;
  onCheckIn: () => void;
}) {
  const face = useFace(live, "Staff");
  const auth = liveAuth(live);
  const notes = usePhoneNotes(live);
  const [monthHazri, setMonthHazri] = useState<ReadResult<{ status?: string | null }> | null>(null);
  const [shiftWindow, setShiftWindow] = useState<string | null>(null);
  const [dutyPlace, setDutyPlace] = useState<string | null>(null);
  useEffect(() => {
    if (!auth?.userId) {
      setMonthHazri({ ok: false, status: 0, message: "Login chahiye." });
      return;
    }
    const start = `${karachiDate().slice(0, 7)}-01`;
    let gone = false;
    void loadOwnAttendance(auth, auth.userId, start, fetch).then((rows) => {
      if (!gone) setMonthHazri(rows);
    });
    return () => { gone = true; };
  }, [auth?.token, auth?.url, auth?.userId, auth?.testAccount]);
  useEffect(() => {
    if (!auth?.userId) return;
    let gone = false;
    void liveGet<{ shift_start?: string | null; shift_end?: string | null; branch_id?: string | null }>(auth, "hr_work_schedules?select=shift_start,shift_end,branch_id&is_active=eq.true&limit=8", fetch).then((rows) => {
      if (gone || !rows.ok) return;
      const row = rows.rows.find((item) => !item.branch_id) ?? rows.rows[0];
      const start = clockLabel(row?.shift_start);
      const end = clockLabel(row?.shift_end);
      if (start && end) setShiftWindow(`${start} – ${end}`);
    });
    void liveGet<{ milk_route_name?: string | null; milk_chiller_name?: string | null }>(auth, `staff_details?select=milk_route_name,milk_chiller_name&profile_id=eq.${encodeURIComponent(auth.userId)}&limit=1`, fetch).then((rows) => {
      if (gone || !rows.ok) return;
      const row = rows.rows[0];
      const place = [row?.milk_chiller_name, row?.milk_route_name].map((item) => String(item || "").trim()).filter(Boolean).join(" · ");
      if (place) setDutyPlace(place);
    });
    return () => { gone = true; };
  }, [auth?.token, auth?.url, auth?.userId]);
  if (!attendance || !salary || !advances) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const today = karachiDate();
  const month = today.slice(0, 7);
  const monthRows = attendance.ok ? attendance.rows.filter((row) => String(row.attendance_date || "").startsWith(month)) : [];
  const present = monthRows.filter((row) => row.status === "present").length;
  const dayNum = Number(today.slice(8, 10));
  const payRows = salary.ok ? salary.rows.map((row) => (row.net_salary == null ? null : num(row.net_salary))).filter((value): value is number => value != null) : [];
  const pay = payRows[0] ?? null;
  const prevPay = payRows[1] ?? null;
  const advance = advances.ok && advances.rows[0]?.amount != null ? num(advances.rows[0].amount) : null;
  const phoneAdvance = noteNumber(notes, "home.staff.advance");
  const advanceShown = advance != null ? advance : phoneAdvance;
  const noteTasks = (notes ?? []).filter((row) => String(row.key || "").startsWith("home.task.")).map((row) => ({ label: row.label || row.detail || "Kaam", detail: row.label && row.detail ? row.detail : "", count: num(row.value) }));
  const shownTasks = tasks.length ? tasks.map((task) => ({ label: task.label, count: task.count, detail: task.detail || "", status: task.status ?? null })) : noteTasks.map((task) => ({ ...task, status: null as string | null }));
  const taskNote = shownTasks.length ? null : tasksNote;
  const hazriCut = monthHazri?.ok === true && monthHazri.rows.length >= 40;
  const presentCount = monthHazri?.ok === true && !hazriCut ? monthHazri.rows.filter((row) => row.status === "present").length : present;
  const doneTasks = shownTasks.filter((task) => task.count <= 0).length;
  const monthShort = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Karachi", month: "short" }).format(new Date());
  const onDuty = Boolean(monthRows.find((row) => row.attendance_date === today));
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Staff" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <ActionGrid actions={[
        { label: "Hazri", key: "visits", onPress: () => bar.onTab?.("visits") },
        { label: "Tasks", key: "orders", onPress: () => bar.onTab?.("orders") },
        { label: "POS", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Recovery", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Khata", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Profile", key: "more", onPress: bar.onProfile },
      ]} />
      <Rise index={2}>
        <View style={{ backgroundColor: "#146B3A", borderRadius: 18, padding: 14, marginBottom: 12, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "rgba(61,220,151,0.35)" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Hazri lagayein</Text>
            <Text style={{ color: "rgba(255,255,255,0.8)", marginTop: 4 }}>{readOnly ? "Sirf dekhna. Check-in band hai." : checkLabel}</Text>
          </View>
          {readOnly ? null : (
            <Pressable onPress={() => { if (!checkBusy && !checkLabel.includes("ho chuka")) onCheckIn(); }} style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: "#3DDC97", alignItems: "center", justifyContent: "center" }}>
              {checkBusy ? <Text style={{ color: "#07140F", fontSize: 20, fontWeight: "800" }}>…</Text> : (
                <Svg width={26} height={26} viewBox="0 0 24 24">
                  <Path d="M9 11V6.2a1.2 1.2 0 0 1 2.4 0V11M11.4 10.2V4.8a1.2 1.2 0 0 1 2.4 0V11M13.8 10.4V6.6a1.2 1.2 0 0 1 2.4 0V12.2M16.2 11.4V8.4a1.2 1.2 0 0 1 2.1.8c.2 1.2.2 2.4 0 3.6-.6 2.6-2.2 4.4-4.6 4.4h-2.2c-1.8 0-3.1-.8-3.8-2.2L7 13.2a1.3 1.3 0 0 1 2.2-1.4L9 13" stroke="#07140F" strokeWidth={1.6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </Svg>
              )}
            </Pressable>
          )}
        </View>
      </Rise>
      <GlassCard title="Aaj ki duty" index={3}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ color: glass.gold, fontSize: 16, marginRight: 8 }}>◷</Text>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: glass.text, fontWeight: "800" }}>{shiftWindow || (!attendance.ok ? attendance.message : onDuty ? `Check-in ${String(monthRows.find((row) => row.attendance_date === today)?.check_in_at || "").slice(11, 16) || "ho chuka"}` : "Aaj ki hazri abhi nahi")}</Text>
            <Text style={{ color: glass.muted, marginTop: 2 }}>{dutyPlace || checkLabel}</Text>
          </View>
          <Pill label={onDuty ? "On duty" : "Baqi"} tone={onDuty ? "green" : "orange"} />
        </View>
      </GlassCard>
      <KpiGrid>
        <Kpi index={4} label="Is mahine tankhwah" value={pay == null ? "—" : rupees(pay)} sub={!salary.ok ? salary.message : salary.rows.length === 0 ? "Koi tankhwah line nahi" : ""} color="#5B8CFF" series={payRows.length >= 2 ? [...payRows].reverse() : flatSeries(pay)} pct={pctChange(pay, prevPay)} />
        <Kpi index={5} label="Advance baqi" value={advanceShown == null ? "—" : rupees(advanceShown)} sub={!advances.ok && advanceShown == null ? advances.message : advanceShown == null ? "Koi advance nahi" : "Baqi"} color="#F5B942" series={flatSeries(advanceShown)} pct={null} />
        <Kpi index={6} label={`Hazri (${monthShort})`} value={attendance.ok ? `${presentCount}/${dayNum || "—"}` : "—"} sub={hazriCut ? "Hazri ki fehrist adhoori hai." : ""} color="#3DDC97" series={attendance.ok ? flatSeries(presentCount) : []} pct={null} />
        <Kpi index={7} label="Tasks done" value={taskNote || shownTasks.length === 0 ? "—" : `${doneTasks}/${shownTasks.length}`} sub={taskNote || ""} color="#C4B5FD" series={taskNote ? [] : flatSeries(doneTasks)} pct={null} />
      </KpiGrid>
      <GlassCard title="Aaj ke tasks" index={8}>
        {taskNote ? <Text style={{ color: glass.muted }}>{taskNote}</Text> : null}
        {!taskNote && shownTasks.length === 0 ? <Text style={{ color: glass.muted }}>Aap ke naam koi task nahi.</Text> : null}
        {shownTasks.map((task) => (
          <View key={task.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1, paddingRight: 8 }}>
              <Text style={{ color: glass.text, fontWeight: "700" }}>{task.label}</Text>
              {task.detail ? <Text style={{ color: glass.muted }}>{task.detail}</Text> : null}
            </View>
            <Pill label={taskPill(task).label} tone={taskPill(task).tone} />
          </View>
        ))}
      </GlassCard>
    </GlassScreen>
  );
}

export function VetGlass({ live, health, ...bar }: Refresh & { live?: LiveBag; health: HealthRow[] | null; error: string }) {
  const face = useFace(live, "Vet");
  const weather = useWeather(face.place);
  const auth = liveAuth(live);
  const [animals, setAnimals] = useState<number | null>(null);
  const [animalNote, setAnimalNote] = useState<string | null>(null);
  const [animalMap, setAnimalMap] = useState<Map<string, { tag_no?: string | null; name?: string | null; species?: string | null }>>(new Map());
  const [places, setPlaces] = useState<Map<string, { name: string; village: string }>>(new Map());
  useEffect(() => {
    if (!auth) return;
    let gone = false;
    void liveGet<{ id?: string; status?: string | null; tag_no?: string | null; name?: string | null; species?: string | null }>(auth, "dairy_animals?select=id,status,tag_no,name,species&limit=200", fetch).then((rows) => {
      if (gone) return;
      if (!rows.ok) {
        setAnimals(null);
        setAnimalNote(rows.message);
        return;
      }
      setAnimals(rows.rows.filter((row) => row.status !== "sold" && row.status !== "dead").length);
      setAnimalNote(null);
      const map = new Map<string, { tag_no?: string | null; name?: string | null; species?: string | null }>();
      for (const row of rows.rows) if (row.id) map.set(row.id, row);
      setAnimalMap(map);
    });
    void liveGet<{ id?: string; full_name?: string | null; village?: string | null }>(auth, "farmers?select=id,full_name,village&limit=200", fetch).then((rows) => {
      if (gone || !rows.ok) return;
      const map = new Map<string, { name: string; village: string }>();
      for (const row of rows.rows) {
        if (!row.id) continue;
        map.set(row.id, { name: cleanPerson(row.full_name || ""), village: String(row.village || "").trim() });
      }
      setPlaces(map);
    });
    return () => { gone = true; };
  }, [auth?.token, auth?.url]);
  const today = karachiDate();
  const days = karachiDaySeries(7);
  const visits = health ?? [];
  const todayVisits = visits.filter((row) => row.event_date === today);
  const pending = visits.filter((row) => row.next_due && String(row.next_due) >= today);
  const visitSeries = days.map((day) => visits.filter((row) => row.event_date === day).length);
  const pendingSeries = days.map((day) => visits.filter((row) => row.next_due === day).length);
  return (
    <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
      <BrandHeader role="Vet" name={face.name} centre={face.place} onProfile={bar.onProfile} live={live} />
      <WeatherCard weather={weather} />
      <ActionGrid actions={[
        { label: "Visits", key: "visits", onPress: () => bar.onTab?.("visits") },
        { label: "Janwar", key: "stock", onPress: () => bar.onTab?.("stock") },
        { label: "Kisan", key: "more", onPress: () => bar.onTab?.("more") },
        { label: "Treatment", key: "visits", onPress: () => bar.onTab?.("visits") },
        { label: "Vaccine", key: "stock", onPress: () => bar.onTab?.("stock") },
        { label: "Profile", key: "more", onPress: bar.onProfile },
      ]} />
      <KpiGrid>
        <Kpi index={2} label="Aaj ke visits" value={health ? String(todayVisits.length) : "—"} color="#5B8CFF" badge="count" series={health ? visitSeries : []} pct={null} />
        <Kpi index={3} label="Pending cases" value={health ? String(pending.length) : "—"} color="#F5B942" badge="count" series={health ? pendingSeries : []} pct={null} />
        <Kpi index={4} label="Ilaj mukammal" value={health ? String(visits.filter((row) => !row.next_due).length) : "—"} color="#3DDC97" series={health ? flatSeries(visits.filter((row) => !row.next_due).length) : []} pct={null} />
        <Kpi index={5} label="Kisan ke janwar" value={animals == null ? "—" : String(animals)} sub={animalNote || ""} color="#C4B5FD" badge="count" series={flatSeries(animals)} pct={null} />
      </KpiGrid>
      <GlassCard title="Aaj ke visits" index={6}>
        {bar.error ? <Text style={{ color: glass.muted }}>{bar.error}</Text> : null}
        {todayVisits.length === 0 ? <Text style={{ color: glass.muted }}>Aaj koi visit nahi.</Text> : null}
        {todayVisits.slice(0, 5).map((row, index) => {
          const lines = visitLines(row, places, animalMap);
          const pill = todayVisitPill(row, today);
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: glass.text, fontWeight: "700" }}>{lines.title}</Text>
                <Text style={{ color: glass.muted }}>{lines.detail}</Text>
              </View>
              <Pill label={pill.label} tone={pill.tone} />
            </View>
          );
        })}
      </GlassCard>
      <GlassCard title="Ilaj list / pending" index={8}>
        {pending.slice(0, 4).map((row, index) => {
          const lines = visitLines(row, places, animalMap, "pending");
          const course = courseDay(row, today);
          return (
            <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={{ color: glass.text, fontWeight: "700" }}>{lines.title}</Text>
                <Text style={{ color: glass.muted }}>{lines.detail}</Text>
              </View>
              <Pill label={course || "Pending"} tone="orange" />
            </View>
          );
        })}
        {health && pending.length === 0 ? <Text style={{ color: glass.muted }}>Koi pending case nahi.</Text> : null}
      </GlassCard>
    </GlassScreen>
  );
}

function visitTitle(row: HealthRow): string {
  const name = cleanPerson(row.diagnosis || "");
  if (name && !/^ilaj$/i.test(name)) return name;
  if (row.kind === "vaccine") return row.vaccine_code ? `Vaccine ${row.vaccine_code}` : "Vaccine";
  if (row.kind === "deworm") return "Deworm";
  if (row.kind === "treatment") return "Dawai";
  return cleanPerson(row.medicine || "") || "Visit";
}

function visitDetail(row: HealthRow): string {
  const medicine = cleanPerson(row.medicine || "");
  const dose = cleanPerson(row.dose || "");
  if (medicine && dose && dose !== medicine) return `${medicine} · ${dose}`;
  if (medicine && medicine !== visitTitle(row)) return medicine;
  if (row.kind === "vaccine") return "Vaccine";
  if (row.kind === "deworm") return "Deworm";
  if (row.kind === "treatment") return "Dawai";
  return row.event_date || "Visit";
}

function animalLabel(row: { tag_no?: string | null; name?: string | null; species?: string | null } | undefined): string {
  if (!row) return "";
  const kind = row.species === "buffalo" ? "Bhains" : row.species === "goat" ? "Bakri" : row.species === "cow" ? "Gaye" : row.species === "calf" ? "Bachhra" : "";
  const tag = String(row.tag_no || row.name || "").trim();
  return [kind, tag ? `#${tag.replace(/^#/, "")}` : ""].filter(Boolean).join(" ");
}

function visitLines(row: HealthRow, places: Map<string, { name: string; village: string }>, animals: Map<string, { tag_no?: string | null; name?: string | null; species?: string | null }>, mode: "visit" | "pending" = "visit"): { title: string; detail: string } {
  const place = row.farmer_id ? places.get(row.farmer_id) : undefined;
  const person = place?.name || "";
  const village = place?.village || "";
  const animal = animalLabel(row.animal_id ? animals.get(row.animal_id) : undefined);
  if (mode === "pending") {
    const medicine = cleanPerson(row.medicine || "");
    const dose = cleanPerson(row.dose || "");
    const detail = [medicine, dose].filter(Boolean).join(" · ") || visitDetail(row);
    return { title: animal || visitTitle(row), detail };
  }
  const title = person && village ? `${person} · ${village}` : person || visitTitle(row);
  const named = cleanPerson(row.diagnosis || "");
  const condition = named && !/^ilaj$/i.test(named) ? named : visitDetail(row);
  const detail = animal && condition && animal !== condition ? `${animal} · ${condition}` : animal || condition;
  return { title, detail };
}

function courseDay(row: HealthRow, today: string): string | null {
  const total = row.withdrawal_days == null ? 0 : num(row.withdrawal_days);
  const start = row.last_dose_date || row.event_date;
  if (!(total > 0) || !start || !/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(today)) return null;
  const from = Date.parse(`${start}T00:00:00Z`);
  const to = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const day = Math.round((to - from) / 86400000) + 1;
  if (day < 1 || day > total) return null;
  return `Day ${day}/${total}`;
}

function todayVisitPill(row: HealthRow, today: string): { label: string; tone: "green" | "orange" | "red" | "blue" } {
  if (/\burgent\b/i.test(row.notes || "")) return { label: "Urgent", tone: "red" };
  const clock = karachiClock(row.created_at);
  if (clock) return { label: clock, tone: "blue" };
  if (row.next_due && String(row.next_due) >= today) return { label: "Pending", tone: "orange" };
  return { label: "Done", tone: "green" };
}
