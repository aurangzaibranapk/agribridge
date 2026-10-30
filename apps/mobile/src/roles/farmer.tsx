import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { settingsOrError } from "../../../../src/lib/mobile/pricing";
import { priceFromSettings } from "../../../../src/lib/mobile/pricing";
import type { MilkSettings } from "../../../../src/lib/dairy/rules";
import { EMPTY_FACTS, type FarmFacts } from "../../../../src/lib/mobile/farmer-desk";
import { karachiDaySeries, liveGet, liveGetScoped, liveInsert, loadCatalog, loadHealth, loadKhata, loadMilkList, loadMilkSettings, loadMyFarmerId, loadProfileNames, loadRoleOrders, loadVaccines, pricedMilkTotal, rupees, salesByDay, shiftLabel, testOrdersFor, type CatalogRow, type HealthRow, type KhataView, type LiveAuth, type MilkRow, type OrderRow, type PartyRow, type ReadResult, type VaccineRow } from "../../../../src/lib/mobile/live-read";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { Empty, SaleChart, Section, liveAuth, type LiveBag } from "../bits";
import { FarmerShell } from "./farmer-shell";
import { FarmerGlass } from "./glass-homes";
import { Btn, colors } from "../kit";

async function loadFacts(auth: LiveAuth): Promise<FarmFacts> {
  const farmerId = await loadMyFarmerId(auth, fetch);
  if (!farmerId) return EMPTY_FACTS;
  const id = encodeURIComponent(farmerId);
  const [farmer, farms, animals] = await Promise.all([
    liveGetScoped<{ full_name?: string | null; village?: string | null; tehsil?: string | null; phone_number?: string | null; farmer_code?: string | null; total_farms_count?: number | null; cow_count?: number | null; buffalo_count?: number | null; calves_count?: number | null }>(auth, `farmers?select=full_name,village,tehsil,phone_number,farmer_code,total_farms_count,cow_count,buffalo_count,calves_count&id=eq.${id}&limit=1`, fetch),
    liveGet<{ id?: string }>(auth, `farms?select=id&farmer_id=eq.${id}&limit=40`, fetch),
    liveGet<{ id?: string; tag_no?: string | null; species?: string | null; status?: string | null }>(auth, `dairy_animals?select=id,tag_no,species,status&farmer_id=eq.${id}&limit=80`, fetch),
  ]);
  const row = farmer.ok ? farmer.rows[0] : undefined;
  let phone = row?.phone_number || null;
  if (!phone && auth.userId) {
    const profile = await liveGet<{ phone_number?: string | null }>(auth, `profiles?select=phone_number&id=eq.${encodeURIComponent(auth.userId)}&limit=1`, fetch);
    phone = profile.ok ? profile.rows[0]?.phone_number || null : null;
  }
  let crops: number | null = farms.ok ? 0 : null;
  if (farms.ok && farms.rows.length) {
    const ids = farms.rows.map((farm) => farm.id).filter((value): value is string => Boolean(value)).map((value) => encodeURIComponent(value)).join(",");
    const cropRows = await liveGet<{ harvest_booked_at?: string | null }>(auth, `crop_history?select=id,harvest_booked_at&farm_id=in.(${ids})&limit=80`, fetch);
    crops = cropRows.ok ? cropRows.rows.filter((crop) => !crop.harvest_booked_at).length : null;
  }
  const liveAnimals = animals.ok ? animals.rows.filter((animal) => animal.status !== "sold" && animal.status !== "dead") : [];
  const fromCounts = row && [row.cow_count, row.buffalo_count, row.calves_count].some((value) => value != null)
    ? num(row.cow_count) + num(row.buffalo_count) + num(row.calves_count)
    : null;
  return {
    name: String(row?.full_name || "").trim(),
    place: [row?.village, row?.tehsil].map((value) => String(value || "").trim()).filter(Boolean).join(", "),
    phone,
    code: row?.farmer_code || null,
    farms: farms.ok ? farms.rows.length : row?.total_farms_count ?? null,
    crops,
    animals: animals.ok ? liveAnimals.length : fromCounts,
    animalRows: liveAnimals,
  };
}

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

export function RoleScreen({ tab, live, onTab, onProfile, onLogout, onRoleSwitch, onSupport, onSettings }: { tab: string; live?: LiveBag; onTab?: (key: string) => void; onProfile?: () => void; onLogout?: () => void; onRoleSwitch?: () => void; onSupport?: () => void; onSettings?: () => void }) {
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
  const [amount, setAmount] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [facts, setFacts] = useState<FarmFacts | null>(null);

  const load = useCallback(async () => {
    if (!auth) return;
    const farmerId = auth.testAccount ? await loadMyFarmerId(auth, fetch) : undefined;
    const [nextKhata, nextMilk, nextOrders, nextShop, nextHealth, nextVaccines, nextSettings, nextFacts] = await Promise.all([
      loadKhata(auth, fetch),
      loadMilkList(auth, fetch, 80, auth.testAccount ? farmerId ?? null : undefined),
      loadRoleOrders(auth, "customer", fetch),
      loadCatalog(auth, fetch),
      loadHealth(auth, fetch),
      loadVaccines(auth, fetch),
      loadMilkSettings(auth, fetch),
      loadFacts(auth),
    ]);
    setKhata(nextKhata);
    setMilk(nextMilk);
    setOrders(nextOrders.ok && auth.testAccount ? { ok: true, rows: testOrdersFor(nextOrders.rows, "customer") } : nextOrders);
    setShop(nextShop);
    setHealth(nextHealth);
    setVaccines(nextVaccines);
    const resolved = nextSettings.ok ? settingsOrError(nextSettings.rows[0] ?? null) : null;
    setSettings(resolved && !("error" in resolved) ? resolved : null);
    setFacts(nextFacts);
    if (nextMilk.ok) {
      setNames(await loadProfileNames(auth, nextMilk.rows.map((row) => row.mca_profile_id || ""), fetch));
    }
  }, [auth?.token, auth?.url, auth?.userId, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Kisan / Customer"><Empty title="Login chahiye" body="Wallet, khata, orders aur doodh isi account se aate hain." /></Section></ScrollView>;
  if (!khata || !milk || !orders || !shop || !health || !vaccines) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  const milkRows = milk.ok ? milk.rows : [];
  const week = karachiWeek();
  const weekRows = milkRows.filter((row) => inWeek(row.entry_date ?? null, week));
  const weekLitres = Math.round(weekRows.reduce((sum, row) => sum + litresOf(row), 0) * 100) / 100;
  const days = karachiDaySeries(7);
  const byDay = new Map<string, number>();
  for (const row of milkRows) {
    const day = String(row.entry_date || "");
    if (!day) continue;
    byDay.set(day, (byDay.get(day) ?? 0) + litresOf(row));
  }
  const chart = salesByDay(days.map((day) => ({ created_at: day, total_amount: byDay.get(day) ?? 0, status: "ok" })), days);

  async function placeOrder() {
    if (!auth) return;
    const total = Number(amount);
    if (!(total > 0)) { setOrderNote("Raqam sahi likhein."); return; }
    const uid = encodeURIComponent(auth.userId || "");
    let customer: PartyRow | null = null;
    if (uid) {
      const own = await liveGetScoped<PartyRow>(auth, `customers?select=id,name&user_id=eq.${uid}&limit=1`, fetch);
      if (own.ok) customer = own.rows[0] ?? null;
    }
    const farmerId = await loadMyFarmerId(auth, fetch);
    if (!customer && farmerId) {
      const linked = await liveGetScoped<PartyRow>(auth, `customers?select=id,name&farmer_id=eq.${encodeURIComponent(farmerId)}&limit=1`, fetch);
      if (linked.ok) customer = linked.rows[0] ?? null;
    }
    if (!customer && auth.testAccount && auth.userId) {
      const link = await liveGet<{ record_id?: string | null }>(auth, `app_test_links?select=record_id&account_id=eq.${encodeURIComponent(auth.userId)}&role=eq.customer&limit=1`, fetch);
      const recordId = link.ok ? link.rows[0]?.record_id : null;
      if (recordId) {
        const linked = await liveGetScoped<PartyRow>(auth, `customers?select=id,name&id=eq.${encodeURIComponent(recordId)}&limit=1`, fetch);
        if (linked.ok) customer = linked.rows[0] ?? null;
      }
    }
    setOrderBusy(true);
    const saved = await liveInsert<OrderRow>(auth, "agri_orders", {
      order_number: `APP-${Date.now()}`,
      order_type: "Karyana",
      order_to_type: "Farmer",
      partner_name: customer?.name || "Kisan / Customer",
      customer_id: customer?.id ?? null,
      party_link_state: customer?.id ? "linked" : "unlinked_unknown",
      status: "draft",
      grand_total: total,
      notes: "Mobile app karyana",
      requested_by: auth.userId,
      is_test: auth.testAccount === true,
    }, fetch);
    setOrderBusy(false);
    if (!saved.ok) { setOrderNote(saved.message); return; }
    setAmount("");
    setOrderNote("Draft order ban gaya.");
    await load();
  }

  const refresh = () => { setRefreshing(true); void load().finally(() => setRefreshing(false)); };
  if (tab === "khata") {
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
        onRefresh={refresh}
      />
    );
  }
  if (tab === "home" || tab === "munshi" || tab === "add" || tab === "services" || tab === "more") {
    return (
      <FarmerShell
        tab={tab}
        live={live}
        khata={khata}
        milk={milk}
        orders={orders}
        health={health}
        names={names}
        facts={facts}
        refreshing={refreshing}
        onRefresh={refresh}
        onTab={onTab}
        onRole={onRoleSwitch}
        onSupport={onSupport}
        onSettings={onSettings}
        onLogout={onLogout}
      />
    );
  }

  return (
    <ScrollView style={{ padding: 16, backgroundColor: "#F7F8F3" }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.green} />}>
      <Text onPress={() => onTab?.("home")} style={{ color: colors.greenDark, fontWeight: "800", marginBottom: 8 }}>‹ Home</Text>
      {tab === "farm" ? (
        <View>
          <Section title="Mera Farm" sub="Kisan aur Customer ka aik hi account">
            <ServiceLink label="Crops / Faslein" detail="Fasal ka record aur schedule" />
            <ServiceLink label="Dairy Management" detail="Doodh, janwar aur health" onPress={() => onTab?.("doodh")} />
            <ServiceLink label="Livestock" detail="Janwar aur treatment record" onPress={() => onTab?.("vet")} />
            <ServiceLink label="Inputs" detail="Seed, fertilizer aur pesticide" onPress={() => onTab?.("karyana")} />
            <ServiceLink label="Machinery" detail="Farm machinery services" />
            <ServiceLink label="Kisan AI" detail="Farm help aur rehnumai" />
          </Section>
          <Section title="Mera Khata" sub="Asal receivable/payable record">
            <ServiceLink label="Wallet / Khata" detail={khata.note || (khata.owed == null ? "Record nahi mila" : rupees(Math.abs(khata.owed)))} onPress={() => onTab?.("khata")} />
          </Section>
        </View>
      ) : null}
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
          <Section title="Profile & Services" sub="Isi account ka tamam record">
            <ServiceLink label="Wallet / Khata" detail="Receivable aur payable" onPress={() => onTab?.("khata")} />
            <ServiceLink label="Vet doctor" detail="Treatment aur vaccine" onPress={() => onTab?.("vet")} />
            <ServiceLink label="Karyana / Orders" detail="Market aur order history" onPress={() => onTab?.("karyana")} />
            <ServiceLink label="Farm services" detail="Crops, dairy, livestock aur machinery" onPress={() => onTab?.("farm")} />
          </Section>
        </View>
      ) : null}
      {tab === "karyana" ? (
        <View>
          <Section title="Naya order" sub="Isi Kisan / Customer account ke khata se link hoga">
            {orderNote ? <Text style={{ color: colors.greenDark, marginBottom: 6 }}>{orderNote}</Text> : null}
            <TextInput value={amount} onChangeText={setAmount} placeholder="Order ki raqam" keyboardType="decimal-pad" style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 10, padding: 12, color: colors.text, backgroundColor: "#fff", marginBottom: 8 }} />
            <Btn label={orderBusy ? "Ban raha hai" : "Order bhejein"} onPress={() => { if (!orderBusy) void placeOrder(); }} />
          </Section>
          <Orders result={orders} />
          <Catalog result={shop} />
        </View>
      ) : null}
      <View style={{ height: 24 }} />
    </ScrollView>
  );
}

function ServiceLink({ label, detail, onPress }: { label: string; detail: string; onPress?: () => void }) {
  return (
    <Text onPress={onPress} style={{ color: colors.text, backgroundColor: "#F3F8F2", borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: 12, marginBottom: 8, fontWeight: "800" }}>
      {label}{"\n"}<Text style={{ color: colors.muted, fontWeight: "400" }}>{detail}{onPress ? "  →" : ""}</Text>
    </Text>
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
