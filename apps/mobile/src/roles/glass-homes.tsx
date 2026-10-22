import { useEffect, useState, type ReactNode } from "react";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { approvalJourney, approvalTimeline, goalDeadline, goalRemaining, karachiClock, milkTimeline, monthEnd, monthShare, orderTimeline, pctChange, romanWeekday } from "../../../../src/lib/mobile/glass-metrics";
import { karachiDate, karachiDaySeries, liveGetScoped, loadGoalTargets, loadMilkList, loadMonthSales, loadOwnAttendance, loadProfileNames, milkLitres, pricedMilkTotal, rupees, shiftLabel, type AdminHome, type GoalTargetRow, type HealthRow, type KhataView, type MilkRow, type OrderRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { liveAuth, type LiveBag } from "../bits";
import { BarChart, BarTrack, BrandHeader, Donut, GlassCard, GlassScreen, GoalCard, Kpi, LineChart, Pill, RingMeter, Rise, TankRow, Timeline, WeatherCard, glass, useFace, useWeather } from "../glass";

type Refresh = { refreshing?: boolean; onRefresh?: () => void; onProfile?: () => void; onTab?: (key: string) => void };

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

type GoalNumberKey = "farmer_month_litres" | "collection_day_litres" | "staff_month_present" | "admin_month_sales";

function useGoals(live: LiveBag | undefined) {
  const auth = liveAuth(live);
  const [goals, setGoals] = useState<ReadResult<GoalTargetRow> | null>(null);
  useEffect(() => {
    if (!auth) {
      setGoals({ ok: false, status: 0, message: "Login chahiye." });
      return;
    }
    let gone = false;
    void loadGoalTargets(auth, fetch).then((rows) => {
      if (!gone) setGoals(rows);
    });
    return () => { gone = true; };
  }, [auth?.token, auth?.url, auth?.testAccount]);
  return goals;
}

function goalState(goals: ReadResult<GoalTargetRow> | null): { row?: GoalTargetRow; problem: string | null; loading: boolean } {
  if (!goals) return { loading: true, problem: null };
  if (!goals.ok) return { loading: false, problem: goals.message };
  const row = goals.rows[0];
  if (!row) return { loading: false, problem: "Target record nahi mila." };
  return { loading: false, problem: null, row };
}

function goalNumber(row: GoalTargetRow | undefined, key: GoalNumberKey): number | null {
  const value = row?.[key];
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function goalAmount(value: number | null, unit: "L" | "Rs" | "din"): string {
  if (value == null) return "—";
  if (unit === "Rs") return rupees(value);
  if (unit === "din") return `${Math.round(value)} din`;
  return `${Math.round(value * 10) / 10} L`;
}

function goalView(actual: number | null, target: number | null, unit: "L" | "Rs" | "din") {
  return {
    pct: monthShare(actual, target),
    targetText: goalAmount(target, unit),
    remainingText: goalAmount(goalRemaining(actual, target), unit),
  };
}

function periodLine(stored: string | null | undefined, periodEnd: string | null, label: string): string {
  const date = goalDeadline(stored, periodEnd);
  if (date === "—") return "—";
  if (stored && /^\d{4}-\d{2}-\d{2}$/.test(stored)) return date;
  return `${label} · ${date}`;
}

function goalSubtitle(input: {
  problem: string | null;
  cutNote: string | null;
  loading: boolean;
  target: number | null;
  actual: number | null;
  actualLine: string;
  idle: string;
}): string {
  if (input.problem) return input.problem;
  if (input.cutNote) return input.cutNote;
  if (input.loading) return "Target dekha ja raha hai.";
  if (input.target == null) return input.actual != null ? `${input.actualLine}. Target set nahi.` : "Target set nahi.";
  return input.actual != null ? input.actualLine : input.idle;
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
  const face = useFace(live);
  const weather = useWeather(face.place);
  const goals = useGoals(live);
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
  const monthKey = today.slice(0, 7);
  const monthCut = milk.ok && rows.length >= 80 && String(rows[rows.length - 1]?.entry_date || "").startsWith(monthKey);
  const monthActual = !milk.ok || monthCut ? null : milkLitres(rows.filter((row) => String(row.entry_date || "").startsWith(monthKey)));
  const goal = goalState(goals);
  const farmerTarget = goal.row ? goalNumber(goal.row, "farmer_month_litres") : null;
  const farmerGoal = goalView(monthActual, farmerTarget, "L");
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
                <Text style={{ color: glass.muted }}>Fat {row.fat_percentage ?? "—"}{filledAmount(row) ? ` · ${rupees(num(row.total_amount))}` : ""}</Text>
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
        <BrandHeader role="Kisan" name={face.name} onProfile={bar.onProfile} />
        {track}
      </GlassScreen>
    );
  }
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
      <GoalCard
        title="Mahine ka target"
        subtitle={goalSubtitle({
          problem: !milk.ok ? milk.message : goal.problem,
          cutNote: monthCut ? "Doodh ki fehrist adhoori hai." : null,
          loading: goal.loading,
          target: farmerTarget,
          actual: monthActual,
          actualLine: `Is mahine ${goalAmount(monthActual, "L")}`,
          idle: "Is mahine ke litre",
        })}
        tone="green"
        pct={farmerGoal.pct}
        targetText={farmerGoal.targetText}
        remainingText={farmerGoal.remainingText}
        deadline={periodLine(goal.row?.farmer_deadline, monthEnd(today), "Aakhri din")}
        onPress={() => bar.onTab?.("doodh")}
      />
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
      {track}
      <Text style={{ color: glass.muted, marginTop: 4 }} onPress={() => bar.onTab?.("vet")}>Vet doctor</Text>
      <Text style={{ color: glass.muted, marginTop: 6 }} onPress={() => bar.onTab?.("karyana")}>Karyana</Text>
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

export function McaGlass({ live, farmers, ...bar }: Refresh & { live?: LiveBag; farmers: { id?: string; full_name?: string | null }[] }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  const goals = useGoals(live);
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
  const todayCut = Boolean(milk?.ok) && rows.length >= 80 && String(rows[rows.length - 1]?.entry_date || "") === today;
  const todayActual = !milk?.ok || todayCut ? null : milkLitres(todayRows);
  const goal = goalState(goals);
  const dayTarget = goal.row ? goalNumber(goal.row, "collection_day_litres") : null;
  const dayGoal = goalView(todayActual, dayTarget, "L");
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
      <GoalCard
        title="Aaj ka target"
        subtitle={goalSubtitle({
          problem: milk && !milk.ok ? milk.message : goal.problem,
          cutNote: todayCut ? "Aaj ki fehrist adhoori hai." : null,
          loading: goal.loading || !milk,
          target: dayTarget,
          actual: todayActual,
          actualLine: `Aaj ${goalAmount(todayActual, "L")}`,
          idle: "Aaj ki collection",
        })}
        tone="green"
        pct={dayGoal.pct}
        targetText={dayGoal.targetText}
        remainingText={dayGoal.remainingText}
        deadline={periodLine(null, today, "Aaj")}
        onPress={() => bar.onTab?.("route")}
      />
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
  const goals = useGoals(live);
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
  const todayCut = Boolean(rows) && !error && list.length >= 120 && String(list[list.length - 1]?.entry_date || "") === today;
  const todayActual = !rows || error || todayCut ? null : milkLitres(todayRows);
  const goal = goalState(goals);
  const dayTarget = goal.row ? goalNumber(goal.row, "collection_day_litres") : null;
  const dayGoal = goalView(todayActual, dayTarget, "L");
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
      <GoalCard
        title="Aaj ka target"
        subtitle={goalSubtitle({
          problem: error || goal.problem,
          cutNote: todayCut ? "Aaj ki fehrist adhoori hai." : null,
          loading: goal.loading,
          target: dayTarget,
          actual: todayActual,
          actualLine: `Aaj ${goalAmount(todayActual, "L")}`,
          idle: "Aaj ki collection",
        })}
        tone="green"
        pct={dayGoal.pct}
        targetText={dayGoal.targetText}
        remainingText={dayGoal.remainingText}
        deadline={periodLine(null, today, "Aaj")}
        onPress={() => bar.onTab?.("fat")}
      />
      <GlassCard title="Tank fill level" sub="Tank ka level track nahi hota" index={6}>
        <RingMeter pct={null} label="Chiller" />
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
      <Timeline title="Doodh ka safar" detail={null} steps={milkTimeline(pending[0] ?? list[0] ?? null, "Fat lagayein")} onAction={() => bar.onTab?.("fat")} />
    </GlassScreen>
  );
}

const DONUT_COLORS = ["#3DDC97", "#C4B5FD", "#F5B942", "#5B8CFF", "#FF6B6B"];

export function AdminGlass({ live, home, milk, orders, focus = "home", footer, onVerify, ...bar }: Refresh & { live?: LiveBag; home: AdminHome | null; milk: MilkRow[]; orders: OrderRow[]; focus?: "home" | "track"; footer?: ReactNode; onVerify?: (row: MilkRow) => void }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  const [farmers, setFarmers] = useState<number | null>(null);
  const [monthSales, setMonthSales] = useState<{ total: number | null; note: string | null } | null>(null);
  const auth = liveAuth(live);
  const goals = useGoals(live);
  useEffect(() => {
    if (!auth) return;
    void liveGetScoped<{ id?: string }>(auth, "farmers?select=id&limit=200", fetch).then((rows) => {
      setFarmers(rows.ok ? rows.rows.length : null);
    });
    const start = `${karachiDate().slice(0, 7)}-01`;
    void loadMonthSales(auth, start, fetch).then(setMonthSales);
  }, [auth?.token, auth?.url, auth?.testAccount]);
  if (!home) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const days = home.days.map((point) => point.amount);
  const labels = home.days.map((point) => romanWeekday(point.day));
  const milkToday = home.milk.state === "ok" ? home.milk.subah + home.milk.shaam : null;
  const approvals = approvalTimeline(home.pending, !home.pendingNote);
  const priced = milk.filter((row) => row.status === "priced");
  const hero = milk.find((row) => row.status === "verified") ?? priced[0] ?? milk.find((row) => row.status === "pending_fat") ?? null;
  const approvalSteps = hero ? approvalJourney(hero) : home.pending.length ? approvals : home.pendingNote ? approvalTimeline([], false) : approvalJourney(null);
  const approvalTitle = hero ? `Doodh · ${hero.entry_date || "—"}` : home.pending[0] ? `${home.pending[0].label} · ${home.pending[0].count}` : "Koi manzoori baqi nahi";
  const approvalDetail = hero
    ? [hero.quantity_liters != null ? `${hero.quantity_liters} L` : null, hero.total_amount != null && hero.total_amount !== "" ? rupees(num(hero.total_amount)) : null].filter(Boolean).join(" · ") || null
    : home.pendingNote;
  const goal = goalState(goals);
  const salesCut = monthSales?.note === "Sale ki fehrist adhoori hai.";
  const salesActual = monthSales && !salesCut ? monthSales.total : null;
  const salesTarget = goal.row ? goalNumber(goal.row, "admin_month_sales") : null;
  const salesGoal = goalView(salesActual, salesTarget, "Rs");
  const salesCard = (
    <GoalCard
      title="Mahine ka target"
      subtitle={goalSubtitle({
        problem: monthSales?.note && !salesCut ? monthSales.note : goal.problem,
        cutNote: salesCut ? monthSales?.note ?? null : null,
        loading: goal.loading || !monthSales,
        target: salesTarget,
        actual: salesActual,
        actualLine: `Is mahine ${goalAmount(salesActual, "Rs")}`,
        idle: "Is mahine ki sale",
      })}
      tone="purple"
      pct={salesGoal.pct}
      targetText={salesGoal.targetText}
      remainingText={salesGoal.remainingText}
      deadline={periodLine(goal.row?.admin_deadline, monthEnd(karachiDate()), "Aakhri din")}
      onPress={() => bar.onTab?.("reports")}
    />
  );
  const baqi = (
    <GlassCard title="Baqi approvals" index={5}>
      {priced.filter((row) => row !== hero).map((row, index) => (
        <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: glass.text, flex: 1 }}>Doodh {row.entry_date || "—"} · {row.total_amount == null || row.total_amount === "" ? "—" : rupees(num(row.total_amount))}</Text>
          <Pill label="Check baqi" tone="orange" />
        </View>
      ))}
      {milk.filter((row) => row.status === "pending_fat" && row !== hero).slice(0, 4).map((row, index) => (
        <View key={row.id ?? `fat-${index}`} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: glass.text, flex: 1 }}>Doodh {row.entry_date || "—"} · fat baqi</Text>
          <Pill label="Pending" tone="orange" />
        </View>
      ))}
      {home.pending.map((row) => (
        <View key={row.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: glass.text, flex: 1 }}>{row.label} · {row.count}</Text>
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
        <BrandHeader role="Admin" name={face.name} onProfile={bar.onProfile} />
        <Timeline title={approvalTitle} detail={approvalDetail} steps={approvalSteps} onAction={() => { if (hero && hero.status === "priced" && onVerify) onVerify(hero); else bar.onTab?.("approvals"); }} index={2} />
        {baqi}
        {footer}
      </GlassScreen>
    );
  }
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
      {salesCard}
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
      <Timeline title={approvalTitle} detail={approvalDetail} steps={approvalSteps} onAction={() => bar.onTab?.("approvals")} />
      {orders.length ? <Text style={{ color: glass.muted }}>Orders {orders.length}</Text> : null}
    </GlassScreen>
  );
}

function featuredOrder(rows: OrderRow[]): OrderRow | null {
  const open = rows.find((row) => !["delivered", "completed", "grn_submitted", "cancelled", "rejected"].includes(String(row.status || "").toLowerCase()));
  return open ?? rows[0] ?? null;
}

function orderCard(row: OrderRow | null, extra: ReturnType<typeof useOrderExtra>) {
  const total = row?.grand_total == null || row.grand_total === "" ? null : rupees(num(row.grand_total));
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
  const face = useFace(live);
  const weather = useWeather(face.place);
  const preview = orders?.ok ? featuredOrder(orders.rows) : null;
  const extra = useOrderExtra(live, preview?.id ?? null);
  if (!khata || !orders) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = orders.ok ? orders.rows : [];
  const latest = featuredOrder(list);
  const rest = list.filter((row) => row !== latest);
  const card = orderCard(latest, extra);
  const totals = list.map((row) => num(row.grand_total));
  const others = (
    <GlassCard title="Doosre orders" index={6}>
      {!orders.ok ? <Text style={{ color: glass.muted }}>{orders.message}</Text> : null}
      {orders.ok && rest.length === 0 ? <Text style={{ color: glass.muted }}>Koi doosra order nahi.</Text> : null}
      {rest.slice(0, 6).map((row, index) => {
        const tone = orderTone(row.status);
        return (
          <View key={row.id ?? String(index)} style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ color: glass.text, fontWeight: "700" }}>{row.order_number || "Order"}</Text>
              <Text style={{ color: glass.muted }}>{row.grand_total == null ? "—" : rupees(num(row.grand_total))}</Text>
            </View>
            <Pill label={tone.label} tone={tone.tone} mark={tone.tone === "green" ? "check" : undefined} />
          </View>
        );
      })}
    </GlassCard>
  );
  if (focus === "track") {
    return (
      <GlassScreen refreshing={bar.refreshing} onRefresh={bar.onRefresh}>
        <BrandHeader role="Customer" name={face.name} onProfile={bar.onProfile} />
        <Timeline title={card.title} detail={card.detail} steps={card.steps} showProgress progressNote={card.progressNote} onAction={() => bar.onTab?.("orders")} index={2} />
        {others}
      </GlassScreen>
    );
  }
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
      {others}
      <Timeline title={card.title} detail={card.detail} steps={card.steps} showProgress progressNote={card.progressNote} onAction={() => bar.onTab?.("orders")} />
    </GlassScreen>
  );
}

export function DealerGlass({ live, khata, orders, ...bar }: Refresh & { live?: LiveBag; khata: KhataView | null; orders: ReadResult<OrderRow> | null }) {
  const face = useFace(live);
  const weather = useWeather(face.place);
  const preview = orders?.ok ? featuredOrder(orders.rows) : null;
  const extra = useOrderExtra(live, preview?.id ?? null);
  if (!khata || !orders) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const list = orders.ok ? orders.rows : [];
  const monthKey = karachiDate().slice(0, 7);
  const dated = list.filter((row) => String(row.created_at || "").length >= 7);
  const monthCount = dated.filter((row) => String(row.created_at).startsWith(monthKey)).length;
  const days = karachiDaySeries(7);
  const byDay = days.map((day) => list.filter((row) => String(row.created_at || "").slice(0, 10) === day).reduce((sum, row) => sum + num(row.grand_total), 0));
  const deal = orderCard(featuredOrder(list), extra);
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
      <Timeline title={deal.title} detail={deal.detail} steps={deal.steps} showProgress progressNote={deal.progressNote} onAction={() => bar.onTab?.("orders")} />
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
  const auth = liveAuth(live);
  const goals = useGoals(live);
  const [monthHazri, setMonthHazri] = useState<ReadResult<{ status?: string | null }> | null>(null);
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
  if (!attendance || !salary || !advances) return <ActivityIndicator color={glass.up} style={{ marginTop: 24 }} />;
  const today = karachiDate();
  const month = today.slice(0, 7);
  const monthRows = attendance.ok ? attendance.rows.filter((row) => String(row.attendance_date || "").startsWith(month)) : [];
  const present = monthRows.filter((row) => row.status === "present").length;
  const dayNum = Number(today.slice(8, 10));
  const pay = salary.ok && salary.rows[0]?.net_salary != null ? num(salary.rows[0].net_salary) : null;
  const advance = advances.ok && advances.rows[0]?.amount != null ? num(advances.rows[0].amount) : null;
  const taskDone = tasks.reduce((sum, task) => sum + task.count, 0);
  const goal = goalState(goals);
  const hazriCut = monthHazri?.ok === true && monthHazri.rows.length >= 40;
  const hazriActual = monthHazri?.ok === true && !hazriCut ? monthHazri.rows.filter((row) => row.status === "present").length : null;
  const hazriTarget = goal.row ? goalNumber(goal.row, "staff_month_present") : null;
  const hazriGoal = goalView(hazriActual, hazriTarget, "din");
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
        <Kpi index={4} label="Is mahine tankhwah" value={pay == null ? "—" : rupees(pay)} sub={!salary.ok ? salary.message : salary.rows.length === 0 ? "Koi tankhwah line nahi" : ""} color="#5B8CFF" series={[]} pct={null} />
        <Kpi index={5} label="Advance baqi" value={advance == null ? "—" : rupees(advance)} sub={!advances.ok ? advances.message : advances.rows.length === 0 ? "Koi advance nahi" : ""} color="#F5B942" series={[]} pct={null} />
        <Kpi index={6} label="Hazri" value={attendance.ok ? `${present}/${dayNum || "—"}` : "—"} color="#3DDC97" series={[]} pct={null} />
        <Kpi index={7} label="Tasks" value={tasksNote ? "—" : String(taskDone)} sub={tasksNote || "Ginati"} color="#C4B5FD" series={[]} pct={null} />
      </View>
      <GoalCard
        title="Mahine ka target"
        subtitle={goalSubtitle({
          problem: monthHazri && !monthHazri.ok ? monthHazri.message : goal.problem,
          cutNote: hazriCut ? "Hazri ki fehrist adhoori hai." : null,
          loading: goal.loading || !monthHazri,
          target: hazriTarget,
          actual: hazriActual,
          actualLine: `Hazri ${goalAmount(hazriActual, "din")}`,
          idle: "Is mahine ki hazri",
        })}
        tone="purple"
        pct={hazriGoal.pct}
        targetText={hazriGoal.targetText}
        remainingText={hazriGoal.remainingText}
        deadline={periodLine(goal.row?.staff_deadline, monthEnd(today), "Aakhri din")}
        onPress={() => bar.onTab?.("visits")}
      />
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
