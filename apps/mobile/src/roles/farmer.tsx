import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import { settingsOrError } from "../../../../src/lib/mobile/pricing";
import { priceFromSettings } from "../../../../src/lib/mobile/pricing";
import type { MilkSettings } from "../../../../src/lib/dairy/rules";
import { karachiDate, karachiDaySeries, liveGet, liveGetScoped, liveInsert, loadCatalog, loadHealth, loadKhata, loadMilkList, loadMilkSettings, loadMyFarmerId, loadProfileNames, loadRoleOrders, loadVaccines, pricedMilkTotal, rupees, salesByDay, shiftLabel, testOrdersFor, type CatalogRow, type HealthRow, type KhataView, type MilkRow, type OrderRow, type PartyRow, type ReadResult, type VaccineRow } from "../../../../src/lib/mobile/live-read";
import { inWeek, karachiWeek } from "../../../../src/lib/mobile/statement";
import { Empty, SaleChart, Section, liveAuth, type LiveBag } from "../bits";
import { FarmerGlass } from "./glass-homes";
import { Btn, colors } from "../kit";
import { loadDigitalMunshi, type DigitalMunshiData } from "../../../../src/lib/mobile/digital-munshi";
import { ApprovedFarmerApp } from "./farmer-approved";

function num(value: number | string | null | undefined): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function total(values: (number | string | null | undefined)[]): number {
  return Math.round(values.reduce<number>((sum, value) => sum + num(value), 0) * 100) / 100;
}

function formatNum(value: number): string {
  return Number.isInteger(value) ? value.toLocaleString("en-PK") : value.toFixed(2).replace(/\.00$/, "");
}

function activeAnimals(data: DigitalMunshiData): number {
  return data.animals.filter((row) => !["sold", "dead"].includes(String(row.status || "").toLowerCase())).length;
}

function todayDairyLitres(data: DigitalMunshiData): number {
  const today = karachiDate();
  return total(data.yields.filter((row) => row.yield_date === today).map((row) => row.liters));
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
  const [munshi, setMunshi] = useState<DigitalMunshiData | null>(null);
  const [names, setNames] = useState<Map<string, string>>(new Map());
  const [refreshing, setRefreshing] = useState(false);
  const [amount, setAmount] = useState("");
  const [orderNote, setOrderNote] = useState("");
  const [orderBusy, setOrderBusy] = useState(false);
  const [vetBusy, setVetBusy] = useState(false);
  const [vetNote, setVetNote] = useState("");

  const load = useCallback(async () => {
    if (!auth) return;
    const farmerId = auth.testAccount ? await loadMyFarmerId(auth, fetch) : undefined;
    const [nextKhata, nextMilk, nextOrders, nextShop, nextHealth, nextVaccines, nextSettings, nextMunshi] = await Promise.all([
      loadKhata(auth, fetch),
      loadMilkList(auth, fetch, 80, auth.testAccount ? farmerId ?? null : undefined),
      loadRoleOrders(auth, "customer", fetch),
      loadCatalog(auth, fetch),
      loadHealth(auth, fetch),
      loadVaccines(auth, fetch),
      loadMilkSettings(auth, fetch),
      loadDigitalMunshi(auth, fetch),
    ]);
    setKhata(nextKhata);
    setMilk(nextMilk);
    setOrders(nextOrders.ok && auth.testAccount ? { ok: true, rows: testOrdersFor(nextOrders.rows, "customer") } : nextOrders);
    setShop(nextShop);
    setHealth(nextHealth);
    setVaccines(nextVaccines);
    setMunshi(nextMunshi);
    const resolved = nextSettings.ok ? settingsOrError(nextSettings.rows[0] ?? null) : null;
    setSettings(resolved && !("error" in resolved) ? resolved : null);
    if (nextMilk.ok) {
      setNames(await loadProfileNames(auth, nextMilk.rows.map((row) => row.mca_profile_id || ""), fetch));
    }
  }, [auth?.token, auth?.url, auth?.userId, auth?.testAccount, auth?.flavor]);

  useEffect(() => { void load(); }, [load]);
  if (!auth) return <ScrollView style={{ padding: 16 }}><Section title="Kisan / Customer"><Empty title="Login chahiye" body="Wallet, khata, orders aur doodh isi account se aate hain." /></Section></ScrollView>;
  if (!khata || !milk || !orders || !shop || !health || !vaccines || !munshi) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

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

  async function requestVet(animalId: string, symptoms: string, priority: "normal" | "emergency") {
    const farmerId = munshi?.farmerId;
    if (!auth || !farmerId || vetBusy) return;
    setVetBusy(true);
    setVetNote("");
    const emergency = priority === "emergency";
    const saved = await liveInsert<HealthRow>(auth, "dairy_health_events", {
      farmer_id: farmerId,
      animal_id: animalId,
      kind: "vet_visit",
      event_date: karachiDate(),
      diagnosis: symptoms.slice(0, 120),
      notes: `${emergency ? "EMERGENCY" : "Vet visit request"} · Mobile app se darkhwast`,
      created_by: auth.userId,
      voided: false,
    }, fetch);
    setVetBusy(false);
    setVetNote(saved.ok ? (emergency ? "Emergency request Vet Team ko bhej di gayi." : "Vet visit request bhej di gayi.") : saved.message);
    if (saved.ok) await load();
  }

  return (
    <ApprovedFarmerApp
      tab={tab}
      khata={khata}
      milk={milk}
      orders={orders}
      shop={shop}
      health={health}
      vaccines={vaccines}
      settings={settings}
      munshi={munshi}
      names={names}
      refreshing={refreshing}
      onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
      onTab={onTab}
      onProfile={onProfile}
      amount={amount}
      onAmount={setAmount}
      orderNote={orderNote}
      orderBusy={orderBusy}
      onPlaceOrder={() => { if (!orderBusy) void placeOrder(); }}
      vetBusy={vetBusy}
      vetNote={vetNote}
      onRequestVet={(animalId, symptoms, priority) => void requestVet(animalId, symptoms, priority)}
    />
  );

  /* Legacy farmer screens retained in source for a safe rollback.
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
        munshi={munshi}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
      />
    );
  }

  return (
    <ScrollView style={{ padding: 16, backgroundColor: "#F7F8F3" }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {tab === "farm" ? (
        <View>
          <Section title="Digital Munshi · Mere Farms" sub={`${munshi.farms.length} farms · ${formatNum(total(munshi.farms.map((row) => row.area_acres)))} acres`}>
            {munshi.notes.length ? <Text style={{ color: colors.muted, marginBottom: 8 }}>{munshi.notes[0]}</Text> : null}
            {munshi.farms.length === 0 ? <Empty title="Farm record nahi mila" body="Website par farm add hoga to yahan naam, acres aur verification dikhegi." /> : null}
            {munshi.farms.map((farm) => (
              <View key={farm.id || farm.name || "farm"} style={{ backgroundColor: "#F3F8F2", borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>{farm.name || "Farm"} · {formatNum(num(farm.area_acres))} acres</Text>
                <Text style={{ color: colors.muted, marginTop: 3 }}>{farm.village || "Village nahi likha"} · {farm.is_verified ? "Verified" : "Verification pending"}</Text>
              </View>
            ))}
          </Section>
          <Section title="Faslein aur kharcha" sub={`${munshi.crops.length} crop records · ${rupees(total(munshi.expenses.map((row) => row.amount)))}`}>
            {munshi.crops.length === 0 ? <Empty title="Fasal record nahi" body="Website Digital Munshi mein fasal add hogi to yahan schedule aur acres aayenge." /> : null}
            {munshi.crops.slice(0, 12).map((crop) => (
              <View key={crop.id || `${crop.crop_name}-${crop.sowing_date}`} style={{ borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 8 }}>
                <Text style={{ color: colors.text, fontWeight: "800" }}>{crop.crop_name || "Fasal"} · {formatNum(num(crop.area_sown_acres))} acres</Text>
                <Text style={{ color: colors.muted, marginTop: 2 }}>Kasht {crop.sowing_date || "—"} · Kataai {crop.expected_harvest_date || "—"}</Text>
              </View>
            ))}
            <ServiceLink label="Machinery bookings" detail={`${munshi.machinery.length} booking records`} onPress={() => onTab?.("machinery")} />
            <ServiceLink label="Paidawar / Produce" detail={`${munshi.produce.length} sale listings`} onPress={() => onTab?.("produce")} />
          </Section>
          <Section title="Mera Khata" sub="Asal receivable/payable record">
            <ServiceLink label="Wallet / Khata" detail={khata.note || (khata.owed == null ? "Record nahi mila" : rupees(Math.abs(khata.owed)))} onPress={() => onTab?.("khata")} />
          </Section>
        </View>
      ) : null}
      {tab === "doodh" ? (
        <View>
          <Section title="Dairy Management" sub={`${activeAnimals(munshi)} active animals · aaj ${formatNum(todayDairyLitres(munshi))} L`}>
            {munshi.animals.length === 0 ? <Empty title="Janwar record nahi" body="Website Dairy Management mein janwar add hoga to tag, breed aur status yahan aayega." /> : null}
            {munshi.animals.slice(0, 12).map((animal) => (
              <Text key={animal.id || animal.tag_no || animal.name || "animal"} style={{ color: colors.text, marginBottom: 7 }}>#{animal.tag_no || "—"} · {animal.name || animal.species || "Janwar"} · {animal.breed || "breed —"} · {animal.status || "status —"}</Text>
            ))}
          </Section>
          <Section title="Vet services & reminders" sub={`${munshi.reminders.filter((row) => !row.seen_at).length} reminders · ${munshi.health.length} health records`}>
            {munshi.reminders.length === 0 ? <Text style={{ color: colors.muted, marginBottom: 8 }}>Koi active dairy reminder nahi.</Text> : null}
            {munshi.reminders.slice(0, 8).map((row) => <Text key={row.id || `${row.task}-${row.due_date}`} style={{ color: colors.text, marginBottom: 6 }}>{row.due_date || "—"} · {row.task || "Dairy reminder"}</Text>)}
            <ServiceLink label="Doctor / treatment history" detail={`${munshi.health.length} visits, vaccine aur treatment records`} onPress={() => onTab?.("vet")} />
          </Section>
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
      {tab === "machinery" ? (
        <Section title="Machinery bookings" sub="Digital Munshi ka asal record">
          {munshi.machinery.length === 0 ? <Empty title="Koi machinery booking nahi" body="Website se booking hogi to number, crop, acres aur status yahan aayega." /> : null}
          {munshi.machinery.map((row) => <Text key={row.id || row.booking_number || row.booking_date} style={{ color: colors.text, marginBottom: 7 }}>{row.booking_number || "Booking"} · {row.crop_type || "crop —"} · {formatNum(num(row.harvest_area))} acres · {row.status || "status —"}</Text>)}
        </Section>
      ) : null}
      {tab === "produce" ? (
        <View>
          <Section title="Paidawar sale" sub="Marketplace listings">
            {munshi.produce.length === 0 ? <Empty title="Koi paidawar listing nahi" body="Website par paidawar sale ke liye lagayenge to yahan nazar aayegi." /> : null}
            {munshi.produce.map((row) => <Text key={row.id || row.crop_name} style={{ color: colors.text, marginBottom: 7 }}>{row.crop_name || "Fasal"} · {formatNum(num(row.quantity_available))} {row.unit || ""} · {row.status || "status —"}</Text>)}
          </Section>
          <Section title="Inputs demand" sub="Seed, fertilizer, pesticide aur wanda">
            {munshi.demands.length === 0 ? <Empty title="Koi demand nahi" body="Digital Munshi se bheji demand yahan status ke sath aayegi." /> : null}
            {munshi.demands.map((row) => <Text key={row.id || `${row.product_name}-${row.created_at}`} style={{ color: colors.text, marginBottom: 7 }}>{row.product_name || "Product"} · {formatNum(num(row.quantity))} {row.unit || ""} · {row.status || "status —"}</Text>)}
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
  ); */
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
