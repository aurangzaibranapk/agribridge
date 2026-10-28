import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { fatRangeError, lrRangeError, type MilkSettings } from "../../../../src/lib/dairy/rules";
import { fatActorError } from "../../../../src/lib/mobile/outbox";
import { priceFromSettings, resolveThresholds, settingsOrError, milkAlerts, toMilkNotice } from "../../../../src/lib/mobile/pricing";
import { karachiDate, karachiDaySeries, liveInsert, livePatch, loadMilkList, loadMilkSettings, milkByShift, milkInRange, milkLitres, pricedMilkTotal, rupees, salesByDay, shiftLabel, type MilkRow, type PartyRow } from "../../../../src/lib/mobile/live-read";
import { liveGetScoped } from "../../../../src/lib/mobile/live-read";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { Empty, SaleChart, Section, liveAuth, type LiveBag } from "../bits";
import { McoGlass } from "./glass-homes";
import { Btn, colors } from "../kit";
import { farmerPortrait } from "../farmer-portraits";
import type { OutboxItem } from "../../../../src/lib/mobile/queue";
import { ApprovedMcoApp, type McoDispatch, type McoFarmer } from "./mco-approved";

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function amountText(rows: MilkRow[]): string {
  const amount = pricedMilkTotal(rows);
  return amount == null ? "raqam —" : rupees(amount);
}

function karachiHour(now = new Date()): number {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", hour: "2-digit", hour12: false }).format(now);
  return Number(hour) % 24;
}

export function RoleScreen({ tab, queue = [], queueCount = 0, onEnqueue, onSync, readOnly = false, live, onProfile, onTab }: { tab: string; data?: unknown; queue?: OutboxItem[]; queueCount?: number; onEnqueue?: (item: { kind: "fat" | "drop"; payload: Record<string, unknown> }) => void; onSync?: () => void; readOnly?: boolean; live?: LiveBag; onProfile?: () => void; onTab?: (key: string) => void }) {
  const auth = liveAuth(live);
  const [rows, setRows] = useState<MilkRow[] | null>(null);
  const [error, setError] = useState("");
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [settings, setSettings] = useState<MilkSettings | null>(null);
  const [settingsNote, setSettingsNote] = useState("");
  const [thresholds, setThresholds] = useState(resolveThresholds(null));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [fat, setFat] = useState("");
  const [lr, setLr] = useState("");
  const [checkedLitres, setCheckedLitres] = useState("");
  const [pick, setPick] = useState("");
  const [farmerId, setFarmerId] = useState("");
  const [receiveMode, setReceiveMode] = useState<"field" | "dropoff">("field");
  const [dropLitres, setDropLitres] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [farmers, setFarmers] = useState<McoFarmer[]>([]);
  const [dispatches, setDispatches] = useState<McoDispatch[]>([]);
  const [route, setRoute] = useState("");
  const [chiller, setChiller] = useState("");
  const [branchId, setBranchId] = useState("");
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [dropoff, setDropoff] = useState(false);
  const [dispatchOpen, setDispatchOpen] = useState(false);
  const [dispatchLitres, setDispatchLitres] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [driver, setDriver] = useState("");
  const [destination, setDestination] = useState("");

  const load = useCallback(async () => {
    if (!auth) return;
    const [milk, rate, farmerRows, staff, profile, dispatchRows] = await Promise.all([
      loadMilkList(auth, fetch, 120),
      loadMilkSettings(auth, fetch),
      liveGetScoped<McoFarmer>(auth, "farmers?select=id,full_name,farmer_code&order=full_name.asc&limit=80", fetch),
      liveGetScoped<{ milk_route_name?: string | null; milk_chiller_name?: string | null; branch_id?: string | null }>(auth, `staff_details?select=milk_route_name,milk_chiller_name,branch_id&profile_id=eq.${encodeURIComponent(String(auth.userId || ""))}&limit=1`, fetch),
      liveGetScoped<{ branch_id?: string | null }>(auth, `profiles?select=branch_id&id=eq.${encodeURIComponent(String(auth.userId || ""))}&limit=1`, fetch),
      liveGetScoped<McoDispatch>(auth, "milk_dispatches?select=id,dispatch_date,shift,vehicle_name,driver_name,dispatched_liters,received_liters,shortage_liters,created_at&order=dispatch_date.desc,created_at.desc&limit=80", fetch),
    ]);
    if (!milk.ok) {
      setRows([]);
      setError(milk.message);
    } else {
      setRows(milk.rows);
      setError("");
      const firstPending = milk.rows.find((row) => row.status === "pending_fat");
      setPick((current) => current || firstPending?.id || "");
      setCheckedLitres((current) => current || (firstPending?.quantity_liters == null ? "" : String(firstPending.quantity_liters)));
    }
    const resolved = rate.ok ? settingsOrError(rate.rows[0] ?? null) : { error: rate.message };
    if ("error" in resolved) {
      setSettings(null);
      setSettingsNote(resolved.error);
      setThresholds(resolveThresholds(null));
    } else {
      setSettings(resolved);
      setSettingsNote("");
      setThresholds(resolveThresholds(null));
    }
    if (farmerRows.ok) {
      setFarmers(farmerRows.rows);
      const map = new Map<string, string>();
      for (const farmer of farmerRows.rows) if (farmer.id) map.set(farmer.id, farmer.full_name || "Kisan");
      setNames(map);
      setFarmerId((current) => current || farmerRows.rows[0]?.id || "");
    }
    if (staff.ok && staff.rows[0]) {
      setRoute(String(staff.rows[0].milk_route_name || ""));
      setChiller(String(staff.rows[0].milk_chiller_name || ""));
      setBranchId(String(staff.rows[0].branch_id || (profile.ok ? profile.rows[0]?.branch_id || "" : "")));
    } else if (profile.ok) {
      setBranchId(String(profile.rows[0]?.branch_id || ""));
    }
    if (dispatchRows.ok) setDispatches(dispatchRows.rows);
  }, [auth?.token, auth?.url, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="MCO"><Empty title="Login chahiye" body="Chiller ki entries testing account se aati hain." /></Section></ScrollView>;
  if (!rows) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  const today = karachiDate();
  const week = karachiWeek();
  const monthFrom = `${today.slice(0, 8)}01`;
  const todayRows = rows.filter((row) => row.entry_date === today);
  const shifts = milkByShift(todayRows);
  const pending = rows.filter((row) => row.status === "pending_fat");
  const chosen = rows.find((row) => row.id === pick) ?? pending[0];
  const days = karachiDaySeries(7);
  const byDay = new Map<string, number>();
  for (const row of rows) {
    const day = String(row.entry_date || "");
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + num(row.quantity_liters));
  }
  const chart = salesByDay(days.map((day) => ({ created_at: day, total_amount: byDay.get(day) ?? 0, status: "ok" })), days);
  const trendRows = farmerId ? rows.filter((row) => row.farmer_id === farmerId) : rows;
  const trendMap = new Map<string, number>();
  for (const row of trendRows) {
    const day = String(row.entry_date || "");
    if (!day) continue;
    trendMap.set(day, (trendMap.get(day) ?? 0) + num(row.quantity_liters));
  }
  const trend = salesByDay(days.map((day) => ({ created_at: day, total_amount: trendMap.get(day) ?? 0, status: "ok" })), days);

  async function saveFat() {
    if (!auth || !chosen?.id || readOnly) return;
    const self = !auth.testAccount ? fatActorError(auth.userId || "", chosen) : null;
    if (self) { setNote(self); return; }
    const fatValue = Number(fat);
    const lrValue = lr.trim() ? Number(lr) : chosen.lr == null ? null : num(chosen.lr);
    const fatError = fatRangeError(fatValue, false);
    if (fatError) { setNote(fatError); return; }
    if (lrValue == null) { setNote("LR likhein. Bina LR rate nahi lagta."); return; }
    const lrError = lrRangeError(lrValue, false);
    if (lrError) { setNote(lrError); return; }
    if (!settings) { setNote(settingsNote || "Doodh ka rate settings mein nahi. Andaza nahi lagate."); return; }
    const litres = Number(checkedLitres || chosen.quantity_liters);
    if (!(litres > 0)) { setNote("Chiller litre sahi likhein."); return; }
    const calc = priceFromSettings(litres, fatValue, lrValue, settings);
    setBusy(chosen.id);
    const saved = await livePatch<MilkRow>(auth, "milk_entries", chosen.id, {
      fat_percentage: fatValue,
      lr: lrValue,
      quantity_liters: litres,
      snf_percentage: calc.snf,
      ts_value: calc.ts,
      rate_per_liter: settings.standardRate,
      total_amount: calc.amount,
      status: "priced",
      fat_at: new Date().toISOString(),
    }, fetch);
    setBusy("");
    if (!saved.ok) {
      if (saved.status === 0 && onEnqueue) {
        onEnqueue({ kind: "fat", payload: { entry_id: chosen.id, liters: litres, fat: fatValue, lr: lrValue, snf: calc.snf, ts: calc.ts, rate_per_liter: settings.standardRate, total_amount: calc.amount, fat_at: new Date().toISOString() } });
        setNote("Network nahi mila. Quality entry phone mein safe hai; Sync Now se upload hogi.");
        setVerifyOpen(false);
        setFat(""); setLr(""); setCheckedLitres("");
        return;
      }
      const denied = saved.status === 401 || saved.status === 403 || /42501|row-level security|is_test/i.test(saved.detail || "");
      setNote(denied ? "Save nahi hua. Testing par 701_app_test_mco_admin.sql lagani hai." : saved.message);
      return;
    }
    setFat("");
    setLr("");
    setCheckedLitres("");
    setVerifyOpen(false);
    setNote(`Fat lag gaya. SNF ${calc.snf} · ${rupees(calc.amount)}. Kisan ki list mein ye raqam dikhega.`);
    await load();
  }

  async function saveDropoff() {
    if (!auth || !auth.userId || readOnly) return;
    const litres = Number(dropLitres);
    const fatValue = Number(fat);
    const lrValue = Number(lr);
    if (!farmerId) { setNote("Kisan chunein."); return; }
    if (!(litres > 0)) { setNote("Litre sahi likhein."); return; }
    const fatError = fatRangeError(fatValue, false);
    if (fatError) { setNote(fatError); return; }
    const lrError = lrRangeError(lrValue, false);
    if (lrError) { setNote(lrError); return; }
    if (!settings) { setNote(settingsNote || "Doodh ka rate settings mein nahi. Andaza nahi lagate."); return; }
    const calc = priceFromSettings(litres, fatValue, lrValue, settings);
    setBusy("dropoff");
    const saved = await liveInsert<MilkRow>(auth, "milk_entries", {
      farmer_id: farmerId,
      entry_date: karachiDate(),
      shift: karachiHour() < 12 ? "morning" : "evening",
      quantity_liters: litres,
      fat_percentage: fatValue,
      lr: lrValue,
      snf_percentage: calc.snf,
      ts_value: calc.ts,
      rate_per_liter: settings.standardRate,
      total_amount: calc.amount,
      status: "priced",
      entry_channel: "app",
      collection_source: "mco_dropoff",
      route_name: route || null,
      chiller_name: chiller || null,
      branch_id: branchId || null,
      created_by: auth.userId,
      client_uuid: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${auth.userId}`,
      notes: "MCC drop-off",
      is_test: auth.testAccount === true,
    }, fetch);
    setBusy("");
    if (!saved.ok) {
      if (saved.status === 0 && onEnqueue) {
        onEnqueue({ kind: "drop", payload: { farmer_id: farmerId, entry_date: karachiDate(), shift: karachiHour() < 12 ? "morning" : "evening", liters: litres, fat: fatValue, lr: lrValue, snf: calc.snf, ts: calc.ts, rate_per_liter: settings.standardRate, total_amount: calc.amount, route_name: route || null, chiller_name: chiller || null } });
        setNote("Network nahi mila. Drop-off phone mein safe hai; Sync Now se upload hogi.");
        setVerifyOpen(false);
        setDropLitres(""); setFat(""); setLr("");
        return;
      }
      setNote(saved.message); return;
    }
    setDropLitres("");
    setFat("");
    setLr("");
    setVerifyOpen(false);
    setNote(`Drop-off save ho gaya. SNF ${calc.snf} · ${rupees(calc.amount)}. Farmer confirmation queue system se chalegi.`);
    await load();
  }

  async function saveDispatch() {
    if (!auth || !auth.userId || readOnly) return;
    const litres = Number(dispatchLitres);
    if (!branchId) { setNote("MCO profile ke sath branch link nahi. Dispatch se pehle branch set karein."); return; }
    if (!(litres > 0)) { setNote("Dispatch ke litre sahi likhein."); return; }
    setBusy("dispatch");
    const saved = await liveInsert<McoDispatch>(auth, "milk_dispatches", {
      branch_id: branchId,
      dispatch_date: karachiDate(),
      shift: karachiHour() < 12 ? "morning" : "evening",
      dispatched_liters: litres,
      vehicle_name: vehicle.trim() || null,
      driver_name: driver.trim() || null,
      notes: destination.trim() ? `Destination: ${destination.trim()}` : null,
      created_by: auth.userId,
    }, fetch);
    setBusy("");
    if (!saved.ok) {
      setNote(/milk_dispatch_one_per_shift|duplicate|23505/i.test(saved.detail || "") ? "Is chiller ki is shift ki dispatch pehle se save hai." : saved.message);
      return;
    }
    setDispatchLitres(""); setVehicle(""); setDriver(""); setDestination(""); setDispatchOpen(false);
    setNote("Dispatch save ho gayi. Company receipt aane par Admin received litres verify karega.");
    await load();
  }

  return <ApprovedMcoApp
    tab={tab} today={today} rows={rows} farmers={farmers} dispatches={dispatches}
    route={route} chiller={chiller} note={note} error={error}
    queue={queue} queueCount={queueCount} refreshing={refreshing} readOnly={readOnly}
    receiveMode={receiveMode} search={search} appliedSearch={appliedSearch}
    verifyOpen={verifyOpen} dropoff={dropoff} selectedRow={chosen} selectedFarmerId={farmerId}
    checkedLitres={dropoff ? dropLitres : checkedLitres} fat={fat} lr={lr} busy={Boolean(busy)}
    dispatchOpen={dispatchOpen} dispatchLitres={dispatchLitres} vehicle={vehicle} driver={driver} destination={destination}
    onTab={onTab} onProfile={onProfile}
    onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
    onSync={() => onSync?.()}
    onMode={(mode) => { setReceiveMode(mode); setNote(""); }}
    onSearch={setSearch} onApplySearch={() => setAppliedSearch(search.trim())}
    onOpenRow={(row) => { if (!row.id) return; setDropoff(false); setPick(row.id); setCheckedLitres(String(row.quantity_liters ?? "")); setFat(row.fat_percentage == null ? "" : String(row.fat_percentage)); setLr(row.lr == null ? "" : String(row.lr)); setNote(""); setVerifyOpen(true); }}
    onOpenFarmer={(id) => { setDropoff(true); setFarmerId(id); setDropLitres(""); setFat(""); setLr(""); setNote(""); setVerifyOpen(true); }}
    onCloseVerify={() => { setVerifyOpen(false); setNote(""); }}
    onCheckedLitres={dropoff ? setDropLitres : setCheckedLitres} onFat={setFat} onLr={setLr}
    onSaveVerify={() => { if (!busy) void (dropoff ? saveDropoff() : saveFat()); }}
    onSendBack={() => { setVerifyOpen(false); setNote("Entry pending rakhi gayi. MCA se litres correction karwa kar dobara Review karein."); }}
    onOpenDispatch={() => { setNote(""); setDispatchOpen(true); }} onCloseDispatch={() => { setDispatchOpen(false); setNote(""); }}
    onDispatchLitres={setDispatchLitres} onVehicle={setVehicle} onDriver={setDriver} onDestination={setDestination}
    onSaveDispatch={() => { if (!busy) void saveDispatch(); }}
  />;

  if (tab === "home") {
    return <McoGlass
      live={live}
      rows={rows}
      error={error}
      names={names}
      onProfile={onProfile}
      onTab={onTab}
      onFieldReceive={() => { setReceiveMode("field"); onTab?.("fat"); }}
      onDropoff={() => { setReceiveMode("dropoff"); onTab?.("fat"); }}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
    />;
  }

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {error ? <Section title="MCO"><Empty title="Entries nahi khulin" body={error} /></Section> : null}
      {note ? <Text style={{ color: colors.greenDark, marginBottom: 8 }}>{note}</Text> : null}
      {readOnly ? <Text style={{ color: colors.muted, marginBottom: 8 }}>Sirf dekhna · MCO. Fat aur tasdeeq band hain.</Text> : null}
      {tab === "drop" ? (
        <View>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <ShiftCard title="Subah" litres={Math.round(shifts.subah * 100) / 100} money={amountText(todayRows.filter((row) => shiftLabel(row.shift) === "Subah"))} />
            <ShiftCard title="Shaam" litres={Math.round(shifts.shaam * 100) / 100} money={amountText(todayRows.filter((row) => shiftLabel(row.shift) === "Shaam"))} />
          </View>
          <Section title={tab === "drop" ? "Shift ki entries" : "Aaj ka chiller"} sub={`${today} · ${milkLitres(todayRows)} L · ${amountText(todayRows)}`}>
            {todayRows.length === 0 ? <Empty title="Aaj koi entry nahi" body="MCA jab pickup save karega, subah aur shaam yahan alag dikhengi." /> : null}
            {todayRows.map((row, index) => <MilkLine key={row.id} row={row} name={names.get(row.farmer_id || "") || "Kisan"} index={index} />)}
          </Section>
        </View>
      ) : null}
      {tab === "fat" || tab === "home" ? (
        <Section title="Check entries" sub="Fat + LR. Rate settings se. Apni asal entry par fat nahi.">
          <View style={{ flexDirection: "row", marginBottom: 10 }}>
            <Pressable onPress={() => setReceiveMode("field")} style={[modeButton, receiveMode === "field" ? modeButtonOn : null]}>
              <Text style={{ color: receiveMode === "field" ? "#fff" : colors.text, fontWeight: "800", textAlign: "center" }}>Field Collection</Text>
            </Pressable>
            <View style={{ width: 8 }} />
            <Pressable onPress={() => setReceiveMode("dropoff")} style={[modeButton, receiveMode === "dropoff" ? modeButtonOn : null]}>
              <Text style={{ color: receiveMode === "dropoff" ? "#fff" : colors.text, fontWeight: "800", textAlign: "center" }}>Drop-off</Text>
            </Pressable>
          </View>
          {receiveMode === "dropoff" ? (
            <View>
              <Text style={{ color: colors.muted, marginBottom: 6 }}>MCC par seedha aya doodh: kisan, litre, fat aur LR.</Text>
              {[...names.entries()].map(([id, name], index) => (
                <FarmerChoice key={id} id={id} name={name} index={index} selected={id === farmerId} onPress={() => setFarmerId(id)} />
              ))}
              <TextInput value={dropLitres} onChangeText={setDropLitres} placeholder="Litre" keyboardType="decimal-pad" style={input} />
              <TextInput value={fat} onChangeText={setFat} placeholder="Fat" keyboardType="decimal-pad" style={input} />
              <TextInput value={lr} onChangeText={setLr} placeholder="LR" keyboardType="decimal-pad" style={input} />
              {!readOnly ? <Btn label={busy === "dropoff" ? "Save ho raha hai" : "Drop-off save karein"} onPress={() => { if (!busy) void saveDropoff(); }} /> : null}
            </View>
          ) : (
          <View>
          {auth?.testAccount ? <Text style={{ color: colors.muted, marginBottom: 6 }}>TEST account apni TEST entry par fat laga sakta hai. Asal MCA apni uthai hui entry par nahi.</Text> : null}
          {settingsNote ? <Text style={{ color: colors.danger, marginBottom: 6 }}>{settingsNote}</Text> : null}
          {pending.length === 0 ? <Empty title="Check ke liye koi entry nahi" body="Jis doodh par fat baaki hai, wo yahan aayega." /> : null}
          {pending.map((row, index) => (
            <FarmerChoice
              key={row.id}
              id={row.farmer_id || row.id || String(index)}
              name={names.get(row.farmer_id || "") || "Kisan"}
              index={index}
              selected={row.id === chosen?.id}
              detail={`${shiftLabel(row.shift)} · ${row.quantity_liters} L · LR ${row.lr ?? "—"}`}
              action="Quality Check"
              onPress={() => {
                if (!row.id) return;
                setPick(row.id);
                setCheckedLitres(row.quantity_liters == null ? "" : String(row.quantity_liters));
                setLr(row.lr == null ? "" : String(row.lr));
              }}
            />
          ))}
          {chosen && chosen.status === "pending_fat" && !readOnly ? (
            <View>
              <TextInput value={checkedLitres} onChangeText={setCheckedLitres} placeholder="Chiller par verify litre" keyboardType="decimal-pad" style={input} />
              <TextInput value={fat} onChangeText={setFat} placeholder="Fat" keyboardType="decimal-pad" style={input} />
              <TextInput value={lr} onChangeText={setLr} placeholder={chosen.lr == null ? "LR" : `LR ${chosen.lr}`} keyboardType="decimal-pad" style={input} />
              <Btn label={busy ? "Save ho raha hai" : "Fat lagayein"} onPress={() => { if (!busy) void saveFat(); }} />
            </View>
          ) : null}
          </View>
          )}
        </Section>
      ) : null}
      {tab === "totals" ? (
        <View>
          <Period title="Aaj" rows={todayRows} />
          <Period title="Hafta" rows={(rows || []).filter((row) => inWeek(row.entry_date ?? null, week))} sub={`${week.start} se ${week.end}`} />
          <Period title="Mahina" rows={milkInRange(rows || [], monthFrom, today)} sub={`${monthFrom} se ${today}`} />
          <Section title="7 din ka chart" sub="Litre">
            {chart.every((point) => point.amount === 0) ? <Empty title="Chart khali hai" body="Jab kai din ki entry hogi, chart yahan banega." /> : <SaleChart points={chart} />}
          </Section>
        </View>
      ) : null}
      {tab === "more" ? (
        <View>
          <Section title="Kisan alerts" sub="Hadd se bahar fat, LR, ya SNF">
            <Alerts rows={rows || []} names={names} thresholds={thresholds} settings={settings} />
          </Section>
          <Section title="Kisan trend" sub="Aakhri 7 din, litre">
            {[...names.entries()].map(([id, name], index) => (
              <FarmerChoice key={id} id={id} name={name} index={index} selected={id === farmerId} action="Trend dekhein" onPress={() => setFarmerId(id)} />
            ))}
            {trend.every((point) => point.amount === 0) ? <Empty title="Trend khali hai" body="Is kisan ki entry in 7 din mein nahi." /> : <SaleChart points={trend} />}
          </Section>
        </View>
      ) : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function ShiftCard({ title, litres, money }: { title: string; litres: number; money: string }) {
  return (
    <View style={{ width: "48%", backgroundColor: "#0F4E28", borderRadius: 16, padding: 14, marginBottom: 12 }}>
      <Text style={{ color: "#C8A058", fontWeight: "700" }}>{title}</Text>
      <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginTop: 4 }}>{litres} L</Text>
      <Text style={{ color: "#D7E6D4", marginTop: 2 }}>{money}</Text>
    </View>
  );
}

function portraitSlot(id: string, fallback: number): number {
  if (!id) return fallback;
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = ((hash * 31) + id.charCodeAt(index)) | 0;
  return Math.abs(hash);
}

function FarmerChoice({ id, name, index, selected, detail, action = "Select", onPress }: { id: string; name: string; index: number; selected: boolean; detail?: string; action?: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", padding: 10, marginBottom: 8, borderRadius: 16, borderWidth: selected ? 2 : 1, borderColor: selected ? colors.green : "#DDE7DD", backgroundColor: selected ? "#F0FAF2" : "#fff" }}
    >
      <Image source={farmerPortrait(portraitSlot(id, index))} style={{ width: 54, height: 54, borderRadius: 15, marginRight: 10 }} />
      <View style={{ flex: 1, paddingRight: 8 }}>
        <Text style={{ color: colors.text, fontSize: 15, fontWeight: "900" }}>{name}</Text>
        <Text style={{ color: colors.muted, marginTop: 3 }}>{detail || "Milk farmer"}</Text>
      </View>
      <View style={{ backgroundColor: selected ? colors.green : "#E4F4E7", borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8 }}>
        <Text style={{ color: selected ? "#fff" : colors.greenDark, fontSize: 11, fontWeight: "900" }}>{selected ? "✓ Selected" : action}</Text>
      </View>
    </Pressable>
  );
}

function MilkLine({ row, name, index }: { row: MilkRow; name: string; index: number }) {
  const money = row.total_amount == null || row.total_amount === "" ? "raqam —" : rupees(num(row.total_amount));
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#E6ECE5" }}>
      <Image source={farmerPortrait(portraitSlot(row.farmer_id || row.id || "", index))} style={{ width: 48, height: 48, borderRadius: 14, marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: "900" }}>{name}</Text>
        <Text style={{ color: colors.muted, marginTop: 2 }}>{shiftLabel(row.shift)} · {row.quantity_liters} L · Fat {row.fat_percentage ?? "—"}</Text>
      </View>
      <Text style={{ color: colors.greenDark, fontWeight: "800" }}>{money}</Text>
    </View>
  );
}

function Period({ title, rows, sub }: { title: string; rows: MilkRow[]; sub?: string }) {
  const shifts = milkByShift(rows);
  return (
    <Section title={title} sub={sub || "Doodh"}>
      <Text style={{ color: colors.text, fontWeight: "700" }}>{milkLitres(rows)} L · {amountText(rows)}</Text>
      <Text style={{ color: colors.muted, marginTop: 4 }}>Subah {Math.round(shifts.subah * 100) / 100} L · Shaam {Math.round(shifts.shaam * 100) / 100} L · {rows.length} entries</Text>
    </Section>
  );
}

function Alerts({ rows, names, thresholds, settings }: { rows: MilkRow[]; names: Map<string, string>; thresholds: ReturnType<typeof resolveThresholds>; settings: MilkSettings | null }) {
  const lines: { id: string; text: string }[] = [];
  for (const row of rows) {
    if (!row.id || row.fat_percentage == null) continue;
    const notice = toMilkNotice({
      id: row.id,
      entry_date: row.entry_date,
      shift: row.shift,
      quantity_liters: num(row.quantity_liters),
      fat_percentage: num(row.fat_percentage),
      lr: row.lr == null ? null : num(row.lr),
      rate_per_liter: row.rate_per_liter == null ? null : num(row.rate_per_liter),
      total_amount: row.total_amount == null ? null : num(row.total_amount),
    }, settings);
    for (const alert of milkAlerts(notice, thresholds)) {
      lines.push({ id: `${row.id}-${alert}`, text: `${names.get(row.farmer_id || "") || "Kisan"} · ${row.entry_date} · ${alert}` });
    }
  }
  if (lines.length === 0) return <Empty title="Koi alert nahi" body="Fat 1 se 12 aur LR 15 se 40 ke bahar koi entry nahi. SNF ki hadd tab lagti hai jab settings mein ho." />;
  return <View>{lines.slice(0, 12).map((line) => <Text key={line.id} style={{ color: colors.danger, marginBottom: 6 }}>{line.text}</Text>)}</View>;
}

const input = { borderWidth: 1, borderColor: "#E2E8E0", borderRadius: 12, padding: 10, marginTop: 8, backgroundColor: "#fff" };
const modeButton = { flex: 1, borderRadius: 12, paddingVertical: 11, backgroundColor: "#EDF3EC", borderWidth: 1, borderColor: "#D9E5D8" };
const modeButtonOn = { backgroundColor: colors.green, borderColor: colors.green };
