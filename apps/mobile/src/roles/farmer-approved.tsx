import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { DigitalMunshiData, MunshiAnimal, MunshiCrop } from "../../../../src/lib/mobile/digital-munshi";
import { karachiDate, rupees, shiftLabel, type CatalogRow, type HealthRow, type KhataView, type MilkRow, type OrderRow, type ReadResult, type VaccineRow } from "../../../../src/lib/mobile/live-read";
import type { MilkSettings } from "../../../../src/lib/dairy/rules";
import { karachiWeek } from "../../../../src/lib/mobile/statement";

const C = {
  green: "#075B39",
  green2: "#0F7547",
  mint: "#EAF5EC",
  pale: "#F7F8F3",
  card: "#FFFFFF",
  line: "#DDE7DF",
  text: "#14261C",
  muted: "#68756D",
  gold: "#D89D18",
  goldBg: "#FFF7DC",
  red: "#D84A4A",
  redBg: "#FFE8E6",
  blue: "#3D73D9",
  blueBg: "#EAF1FF",
};

type Props = {
  tab: string;
  khata: KhataView;
  milk: ReadResult<MilkRow>;
  orders: ReadResult<OrderRow>;
  shop: ReadResult<CatalogRow>;
  health: ReadResult<HealthRow>;
  vaccines: ReadResult<VaccineRow>;
  settings: MilkSettings | null;
  munshi: DigitalMunshiData;
  names: Map<string, string>;
  refreshing: boolean;
  onRefresh: () => void;
  onTab?: (key: string) => void;
  onProfile?: () => void;
  amount: string;
  onAmount: (value: string) => void;
  orderNote: string;
  orderBusy: boolean;
  onPlaceOrder: () => void;
  vetBusy: boolean;
  vetNote: string;
  onRequestVet: (animalId: string, symptoms: string, priority: "normal" | "emergency") => void;
};

function n(value: number | string | null | undefined): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function display(value: number | string | null | undefined, suffix = ""): string {
  if (value == null || value === "") return "—";
  const parsed = Number(value);
  const shown = Number.isFinite(parsed) ? parsed.toLocaleString("en-PK", { maximumFractionDigits: 2 }) : String(value);
  return `${shown}${suffix}`;
}

function todayMilk(data: DigitalMunshiData): number | null {
  const rows = data.yields.filter((row) => row.yield_date === karachiDate());
  if (!rows.length) return null;
  return rows.reduce((sum, row) => sum + n(row.liters), 0);
}

function activeAnimals(data: DigitalMunshiData): MunshiAnimal[] {
  return data.animals.filter((row) => !["sold", "dead"].includes(String(row.status || "").toLowerCase()));
}

function moneyOrDash(value: number | null): string {
  return value == null ? "—" : rupees(Math.abs(value));
}

function Page({ children, refreshing, onRefresh }: { children: React.ReactNode; refreshing: boolean; onRefresh: () => void }) {
  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.pageContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.green2} />}
    >
      {children}
    </ScrollView>
  );
}

function FarmerHeader({ data, onProfile }: { data: DigitalMunshiData; onProfile?: () => void }) {
  const name = data.profile?.full_name || "Kisan / Customer";
  const initial = name.trim().slice(0, 1).toUpperCase() || "K";
  return (
    <View style={styles.hero}>
      <View style={styles.brandRow}>
        <View style={styles.leaf}><Text style={styles.leafText}>◆</Text></View>
        <View style={{ flex: 1 }}><Text style={styles.brand}>Kisan Pakistan</Text><Text style={styles.tagline}>AgriBridge</Text></View>
        <Pressable onPress={onProfile} style={styles.bell}><Text style={styles.bellText}>♟</Text></Pressable>
      </View>
      <Pressable onPress={onProfile} style={styles.personRow}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{initial}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.hello}>Assalam-o-Alaikum</Text>
          <Text style={styles.personName}>{name}</Text>
          <Text style={styles.location}>⌖ {data.profile?.village || "Location record nahi mila"}</Text>
        </View>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </View>
  );
}

function ScreenTitle({ title, sub, onBack }: { title: string; sub?: string; onBack?: () => void }) {
  return (
    <View style={styles.screenHead}>
      {onBack ? <Pressable onPress={onBack} style={styles.back}><Text style={styles.backText}>‹</Text></Pressable> : null}
      <View style={{ flex: 1 }}><Text style={styles.screenTitle}>{title}</Text>{sub ? <Text style={styles.screenSub}>{sub}</Text> : null}</View>
    </View>
  );
}

const SERVICES = [
  ["Digital Munshi", "▤", "munshi", "#EAF5EC"],
  ["Meri Faslein", "♧", "farm", "#F1F6E7"],
  ["Dairy", "♞", "doodh", "#EAF1FF"],
  ["Vet Doctor", "+", "vet", "#E9F7F3"],
  ["Khata & Wallet", "₨", "khata", "#FFF7DC"],
  ["Orders", "▣", "karyana", "#FFF0DF"],
] as const;

function ServiceGrid({ onTab }: { onTab?: (key: string) => void }) {
  return <View style={styles.serviceGrid}>{SERVICES.map(([label, mark, key, tint]) => (
    <Pressable key={key} onPress={() => onTab?.(key)} style={[styles.service, { backgroundColor: tint }]}>
      <Text style={styles.serviceMark}>{mark}</Text><Text style={styles.serviceLabel}>{label}</Text>
    </Pressable>
  ))}</View>;
}

function Home({ p }: { p: Props }) {
  const reminder = p.munshi.reminders.find((row) => !row.seen_at);
  const milkValue = todayMilk(p.munshi);
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}>
    <FarmerHeader data={p.munshi} onProfile={p.onProfile} />
    <View style={styles.weatherRow}>
      <View><Text style={styles.weatherIcon}>☀</Text></View>
      <View style={{ flex: 1 }}><Text style={styles.weatherTitle}>Aaj ka din</Text><Text style={styles.weatherSub}>{karachiDate()} · Mausam —</Text></View>
      <View style={styles.weatherStat}><Text style={styles.weatherStatValue}>{display(p.munshi.farms.reduce((s, f) => s + n(f.area_acres), 0), " ac")}</Text><Text style={styles.weatherStatLabel}>Zameen</Text></View>
    </View>
    {reminder ? <Pressable onPress={() => p.onTab?.("doodh")} style={styles.alert}>
      <Text style={styles.alertMark}>!</Text><View style={{ flex: 1 }}><Text style={styles.alertTitle}>{reminder.task || "Dairy reminder"}</Text><Text style={styles.alertSub}>{reminder.due_date || "Due date —"}</Text></View><Text style={styles.alertArrow}>›</Text>
    </Pressable> : null}
    <ServiceGrid onTab={p.onTab} />
    <View style={styles.twoCol}>
      <MiniCard title="Aaj ka doodh" value={milkValue == null ? "—" : `${display(milkValue)} L`} sub="Subah + shaam" />
      <MiniCard title="Active janwar" value={p.munshi.animals.length ? String(activeAnimals(p.munshi).length) : "—"} sub="Dairy record" />
    </View>
    <Card title="Aaj ka kaam" action="Sab dekhein" onAction={() => p.onTab?.("services")}>
      <DataLine mark="♧" title="Faslein" value={p.munshi.crops.length ? `${p.munshi.crops.length} records` : "—"} />
      <DataLine mark="+" title="Vet reminders" value={p.munshi.reminders.length ? String(p.munshi.reminders.filter((r) => !r.seen_at).length) : "—"} />
      <DataLine mark="▣" title="Orders" value={p.orders.ok && p.orders.rows.length ? String(p.orders.rows.length) : "—"} last />
    </Card>
  </Page>;
}

function MiniCard({ title, value, sub }: { title: string; value: string; sub: string }) {
  return <View style={styles.miniCard}><Text style={styles.miniTitle}>{title}</Text><Text style={styles.miniValue}>{value}</Text><Text style={styles.miniSub}>{sub}</Text></View>;
}

function Card({ title, action, onAction, children }: { title: string; action?: string; onAction?: () => void; children: React.ReactNode }) {
  return <View style={styles.card}><View style={styles.cardHead}><Text style={styles.cardTitle}>{title}</Text>{action ? <Text onPress={onAction} style={styles.cardAction}>{action}</Text> : null}</View>{children}</View>;
}

function DataLine({ mark, title, sub, value, last }: { mark: string; title: string; sub?: string; value: string; last?: boolean }) {
  return <View style={[styles.dataLine, last ? { borderBottomWidth: 0 } : null]}><View style={styles.dataIcon}><Text style={styles.dataIconText}>{mark}</Text></View><View style={{ flex: 1 }}><Text style={styles.dataTitle}>{title}</Text>{sub ? <Text style={styles.dataSub}>{sub}</Text> : null}</View><Text style={styles.dataValue}>{value}</Text></View>;
}

function Munshi({ p }: { p: Props }) {
  const [period, setPeriod] = useState<"today" | "week" | "month">("today");
  const today = karachiDate();
  const week = karachiWeek(new Date(`${today}T12:00:00+05:00`));
  const entries = p.munshi.credit.filter((row) => {
    const day = String(row.created_at || "").slice(0, 10);
    if (!day) return false;
    if (period === "today") return day === today;
    if (period === "week") return day >= week.start && day <= week.end;
    return day.slice(0, 7) === today.slice(0, 7);
  });
  const signed = entries.map((row) => ({ ...row, value: n(row.amount), kind: String(row.ledger_type || "").toLowerCase() }));
  const incomeRows = signed.filter((row) => row.value > 0 || /credit|receive|income|sale|wasooli/.test(row.kind));
  const expenseRows = signed.filter((row) => row.value < 0 || /debit|expense|purchase|payment|adaigi/.test(row.kind));
  const income = incomeRows.length ? incomeRows.reduce((s, row) => s + Math.abs(row.value), 0) : null;
  const expense = expenseRows.length ? expenseRows.reduce((s, row) => s + Math.abs(row.value), 0) : null;
  const receivable = p.khata.owed != null && p.khata.owed > 0 ? p.khata.owed : null;
  const payable = p.khata.owed != null && p.khata.owed < 0 ? Math.abs(p.khata.owed) : null;
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}>
    <ScreenTitle title="Digital Munshi" sub="Aap ka mukammal roznamcha" onBack={() => p.onTab?.("home")} />
    <View style={styles.segment}>{(["today", "week", "month"] as const).map((key) => <Pressable key={key} onPress={() => setPeriod(key)} style={[styles.segmentBtn, period === key ? styles.segmentOn : null]}><Text style={[styles.segmentText, period === key ? styles.segmentTextOn : null]}>{key === "today" ? "Aaj" : key === "week" ? "Is Hafte" : "Is Mahine"}</Text></Pressable>)}</View>
    <Card title={period === "today" ? "Aaj ka Khata" : period === "week" ? "Is Hafte ka Khata" : "Is Mahine ka Khata"}>
      <DataLine mark="↑" title="Aamdani" value={moneyOrDash(income)} />
      <DataLine mark="↓" title="Kharcha" value={moneyOrDash(expense)} />
      <DataLine mark="↙" title="Lenay hain (Wasooli)" value={moneyOrDash(receivable)} />
      <DataLine mark="↗" title="Dene hain (Adaigi)" value={moneyOrDash(payable)} />
      <DataLine mark="₨" title="Cash Balance" value={p.khata.owed == null ? "—" : moneyOrDash(p.khata.owed)} last />
    </Card>
    <View style={styles.quickRow}>{[["Sale", "♧"], ["Khareed", "▣"], ["Wasooli", "↙"], ["Adaigi", "↗"]].map(([label, icon]) => <Pressable key={label} onPress={() => p.onTab?.("add")} style={styles.quick}><Text style={styles.quickMark}>{icon}</Text><Text style={styles.quickText}>{label}</Text></Pressable>)}</View>
    <Pressable onPress={() => p.onTab?.("add")} style={styles.voice}><View style={styles.mic}><Text style={styles.micText}>●</Text></View><View style={{ flex: 1 }}><Text style={styles.voiceTitle}>Awaaz se entry karein</Text><Text style={styles.voiceSub}>Bol kar nayi entry shuru karein</Text></View><Text style={styles.voiceWave}>▂▄▆▃▅▂</Text></Pressable>
    <Card title="Haal ki entries" action="Sab dekhein">
      {entries.length ? entries.slice(0, 8).map((row, index) => <DataLine key={`${row.created_at}-${index}`} mark={n(row.amount) >= 0 ? "↑" : "↓"} title={row.source_type || row.ledger_type || "Khata entry"} sub={row.created_at?.slice(0, 10) || "—"} value={row.amount == null ? "—" : rupees(Math.abs(n(row.amount)))} last={index === Math.min(entries.length, 8) - 1} />) : <Empty text="Abhi koi ledger entry nahi mili." />}
    </Card>
  </Page>;
}

function cropFarmName(data: DigitalMunshiData, crop: MunshiCrop): string {
  return data.farms.find((farm) => farm.id === crop.farm_id)?.name || "Farm";
}

function Crops({ p }: { p: Props }) {
  const totalExpense = p.munshi.expenses.length ? p.munshi.expenses.reduce((sum, row) => sum + n(row.amount), 0) : null;
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}>
    <ScreenTitle title="Meri Faslein" sub={`${p.munshi.farms.length || "—"} farms · ${p.munshi.crops.length || "—"} crop records`} onBack={() => p.onTab?.("home")} />
    <View style={styles.segment}><View style={[styles.segmentBtn, styles.segmentOn]}><Text style={[styles.segmentText, styles.segmentTextOn]}>Mere Khet</Text></View><View style={styles.segmentBtn}><Text style={styles.segmentText}>Fasal Calendar</Text></View></View>
    {p.munshi.crops.length ? p.munshi.crops.map((crop, index) => <CropCard key={crop.id || String(index)} crop={crop} farm={cropFarmName(p.munshi, crop)} expense={totalExpense} />) : <Card title="Faslein"><Empty text="Website Digital Munshi mein fasal add hogi to yahan nazar aayegi." /></Card>}
    <Card title="Agley kaam">
      {p.munshi.demands.length ? p.munshi.demands.slice(0, 5).map((row, index) => <DataLine key={row.id || String(index)} mark="✓" title={row.product_name || "Input demand"} sub={`${display(row.quantity)} ${row.unit || ""}`} value={row.status || "—"} last={index === Math.min(5, p.munshi.demands.length) - 1} />) : <Empty text="Koi crop task ya input demand nahi." />}
    </Card>
  </Page>;
}

function CropCard({ crop, farm, expense }: { crop: MunshiCrop; farm: string; expense: number | null }) {
  return <View style={styles.cropCard}><View style={styles.cropTop}><View style={styles.cropImage}><Text style={styles.cropImageMark}>♧</Text></View><View style={{ flex: 1 }}><Text style={styles.cropFarm}>{farm}</Text><Text style={styles.cropName}>{crop.crop_name || "Fasal"}</Text><Text style={styles.cropMeta}>{display(crop.area_sown_acres, " acre")} · Kasht {crop.sowing_date || "—"}</Text></View></View>
    <View style={styles.timeline}><Stage label="Bowai" on /><Stage label="Ugrowt" /><Stage label="Dana" /><Stage label="Harvest" /></View>
    <View style={styles.cropStats}><View><Text style={styles.statLabel}>Kul Kharcha</Text><Text style={styles.statValue}>{moneyOrDash(expense)}</Text></View><View><Text style={styles.statLabel}>Mumkin Kataai</Text><Text style={styles.statValue}>{crop.expected_harvest_date || "—"}</Text></View></View>
  </View>;
}

function Stage({ label, on }: { label: string; on?: boolean }) { return <View style={styles.stage}><View style={[styles.stageDot, on ? styles.stageOn : null]} /><Text style={styles.stageLabel}>{label}</Text></View>; }

function Dairy({ p }: { p: Props }) {
  const animals = activeAnimals(p.munshi);
  const milk = todayMilk(p.munshi);
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}>
    <ScreenTitle title="Dairy" sub="Janwar, doodh aur health" onBack={() => p.onTab?.("home")} />
    <View style={styles.twoCol}><MiniCard title="Kul Pashu" value={p.munshi.animals.length ? String(animals.length) : "—"} sub="Active animals" /><MiniCard title="Aaj ka Doodh" value={milk == null ? "—" : `${display(milk)} L`} sub="Subah + shaam" /></View>
    <View style={styles.segment}><View style={[styles.segmentBtn, styles.segmentOn]}><Text style={[styles.segmentText, styles.segmentTextOn]}>Mere Pashu</Text></View><Pressable onPress={() => p.onTab?.("doodh-record")} style={styles.segmentBtn}><Text style={styles.segmentText}>Doodh Record</Text></Pressable><View style={styles.segmentBtn}><Text style={styles.segmentText}>Feed & Health</Text></View></View>
    {animals.length ? animals.map((animal, index) => <AnimalCard key={animal.id || animal.tag_no || String(index)} animal={animal} reminder={p.munshi.reminders.find((r) => r.animal_id === animal.id && !r.seen_at)} onPress={() => p.onTab?.("vet")} />) : <Card title="Mere Pashu"><Empty text="Website Dairy Management mein janwar add hoga to yahan nazar aayega." /></Card>}
    <Card title="Dairy reminders">
      {p.munshi.reminders.length ? p.munshi.reminders.slice(0, 8).map((row, index) => <DataLine key={row.id || String(index)} mark="!" title={row.task || "Reminder"} value={row.due_date || "—"} last={index === Math.min(8, p.munshi.reminders.length) - 1} />) : <Empty text="Koi active dairy reminder nahi." />}
    </Card>
  </Page>;
}

function AnimalCard({ animal, reminder, onPress }: { animal: MunshiAnimal; reminder?: { task?: string | null; due_date?: string | null }; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.animalCard}><View style={styles.animalPhoto}><Text style={styles.animalMark}>♞</Text></View><View style={{ flex: 1 }}><Text style={styles.animalTag}>Tag #{animal.tag_no || "—"}</Text><Text style={styles.animalName}>{animal.name || animal.species || "Janwar"}</Text><Text style={styles.animalMeta}>{animal.breed || "Breed —"} · {animal.status || "Status —"}</Text>{reminder ? <Text style={styles.due}>{reminder.task || "Reminder"} · {reminder.due_date || "—"}</Text> : null}</View><Text style={styles.chevron}>›</Text></Pressable>;
}

function Vet({ p }: { p: Props }) {
  const [animal, setAnimal] = useState(p.munshi.animals[0]?.id || "");
  const [symptoms, setSymptoms] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<"normal" | "emergency">("normal");
  const healthRows = p.health.ok ? p.health.rows : [];
  const vaccineRows = p.vaccines.ok ? p.vaccines.rows : [];
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}>
    <ScreenTitle title="Vet Doctor" sub="Doctor request aur treatment history" onBack={() => p.onTab?.("home")} />
    <View style={styles.twoCol}><Pressable onPress={() => { setPriority("normal"); setMessage("Janwar aur alamat likh kar request bhejein."); }} style={[styles.requestTile, { backgroundColor: priority === "normal" ? C.mint : C.card }]}><Text style={styles.requestMark}>▣</Text><Text style={styles.requestTitle}>Vet Visit Request</Text><Text style={styles.requestSub}>Ghar par visit ke liye</Text></Pressable><Pressable onPress={() => { setPriority("emergency"); setMessage("Emergency request foran Vet Team ko nazar aayegi."); }} style={[styles.requestTile, { backgroundColor: priority === "emergency" ? C.redBg : C.card }]}><Text style={[styles.requestMark, { color: C.red }]}>☎</Text><Text style={styles.requestTitle}>Emergency Call</Text><Text style={styles.requestSub}>Fori madad ke liye</Text></Pressable></View>
    <Card title="Masla ki tafseel">
      <Text style={styles.fieldLabel}>Janwar chunein</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>{p.munshi.animals.length ? p.munshi.animals.map((row) => <Pressable key={row.id || row.tag_no} onPress={() => setAnimal(row.id || "")} style={[styles.animalChip, animal === row.id ? styles.animalChipOn : null]}><Text style={[styles.animalChipText, animal === row.id ? { color: C.green } : null]}>#{row.tag_no || "—"} {row.name || row.species || "Janwar"}</Text></Pressable>) : <Text style={styles.emptyText}>Janwar record nahi mila.</Text>}</ScrollView>
      <TextInput value={symptoms} onChangeText={setSymptoms} placeholder="Alamat likhein: bhook kam, bukhar, khansi…" multiline style={styles.textarea} />
      <Pressable disabled={p.vetBusy} onPress={() => !animal ? setMessage("Pehle janwar chunein.") : !symptoms.trim() ? setMessage("Alamat likhein.") : p.onRequestVet(animal, symptoms.trim(), priority)} style={[styles.primary, p.vetBusy ? { opacity: 0.5 } : null]}><Text style={styles.primaryText}>{p.vetBusy ? "Request bhej rahe hain…" : priority === "emergency" ? "Emergency request bhejein" : "Request bhejein"}</Text></Pressable>
      {p.vetNote || message ? <Text style={styles.info}>{p.vetNote || message}</Text> : null}
    </Card>
    <Card title="Meri Appointments" action="Treatment History">
      {healthRows.length ? healthRows.slice(0, 10).map((row, index) => <DataLine key={row.id || String(index)} mark="+" title={row.diagnosis || row.kind || "Vet visit"} sub={`${row.vet_name || "Doctor"} · ${row.event_date || "—"}`} value={row.next_due || "—"} last={index === Math.min(10, healthRows.length) - 1} />) : <Empty text={p.health.ok ? "Abhi koi appointment ya treatment record nahi." : p.health.message} />}
    </Card>
    <Card title="Vaccine Schedule">
      {vaccineRows.length ? vaccineRows.slice(0, 8).map((row, index) => <DataLine key={row.code || String(index)} mark="✓" title={row.name_rm || "Vaccine"} value={row.code || "—"} last={index === Math.min(8, vaccineRows.length) - 1} />) : <Empty text={p.vaccines.ok ? "Koi vaccine schedule nahi." : p.vaccines.message} />}
    </Card>
  </Page>;
}

function WalletOrders({ p }: { p: Props }) {
  const [section, setSection] = useState<"statement" | "orders" | "repayment">("orders");
  const balance = p.khata.owed == null ? "—" : rupees(Math.abs(p.khata.owed));
  const orderRows = p.orders.ok ? p.orders.rows : [];
  const catalogRows = p.shop.ok ? p.shop.rows : [];
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}>
    <ScreenTitle title="Khata & Wallet" sub="Statement, orders aur repayment" onBack={() => p.onTab?.("home")} />
    <View style={styles.walletHero}><View><Text style={styles.walletLabel}>Available Balance</Text><Text style={styles.walletValue}>{balance}</Text><Text style={styles.walletSub}>{p.khata.note || "Asal khata record"}</Text></View><View style={styles.walletMark}><Text style={styles.walletMarkText}>₨</Text></View></View>
    <Card title="Credit Plan (Agri Input)" action="Details"><DataLine mark="↑" title="Lenay hain (Receivable)" value={p.khata.owed != null && p.khata.owed > 0 ? balance : "—"} /><DataLine mark="↓" title="Dene hain (Payable)" value={p.khata.owed != null && p.khata.owed < 0 ? balance : "—"} last /></Card>
    <View style={styles.segment}>{(["statement", "orders", "repayment"] as const).map((key) => <Pressable key={key} onPress={() => setSection(key)} style={[styles.segmentBtn, section === key ? styles.segmentOn : null]}><Text style={[styles.segmentText, section === key ? styles.segmentTextOn : null]}>{key === "statement" ? "Statement" : key === "orders" ? "Orders" : "Repayment"}</Text></Pressable>)}</View>
    {section === "orders" ? <><Card title="Naya Order">
      <TextInput value={p.amount} onChangeText={p.onAmount} keyboardType="decimal-pad" placeholder="Order ki raqam" style={styles.input} />
      <Pressable onPress={p.onPlaceOrder} style={styles.primary}><Text style={styles.primaryText}>{p.orderBusy ? "Ban raha hai…" : "Order bhejein"}</Text></Pressable>{p.orderNote ? <Text style={styles.info}>{p.orderNote}</Text> : null}
    </Card><Card title="Mere Orders">{orderRows.length ? orderRows.map((row, index) => <DataLine key={`${row.order_number}-${index}`} mark="▣" title={row.order_number || "Order"} sub={row.status || "Status —"} value={row.grand_total == null ? "—" : rupees(Number(row.grand_total))} last={index === orderRows.length - 1} />) : <Empty text={p.orders.ok ? "Koi order nahi mila." : p.orders.message} />}</Card></> : null}
    {section === "statement" ? <Card title="Haal ka len-den">{p.khata.lines.length ? p.khata.lines.map((line, index) => <DataLine key={String(index)} mark="₨" title={line.tafseel || line.category || "Khata entry"} sub={line.entry_date || "—"} value={line.baqaya != null ? rupees(Math.abs(Number(line.baqaya))) : line.udhaar != null ? rupees(Math.abs(Number(line.udhaar))) : line.adaigi != null ? rupees(Math.abs(Number(line.adaigi))) : "—"} last={index === p.khata.lines.length - 1} />) : <Empty text={p.khata.linesNote || "Statement record nahi mila."} />}</Card> : null}
    {section === "repayment" ? <Card title="Repayment"><Empty text="Credit adjustment ka asal record available hoga to yahan crop/milk ke sath nazar aayega." /></Card> : null}
    <Card title="Available Products">{catalogRows.length ? catalogRows.slice(0, 8).map((row, index) => <DataLine key={row.id || String(index)} mark="♧" title={row.name || "Product"} sub={row.unit || ""} value={row.selling_price == null ? "—" : rupees(Number(row.selling_price))} last={index === Math.min(8, catalogRows.length) - 1} />) : <Empty text={p.shop.ok ? "Koi product available nahi." : p.shop.message} />}</Card>
  </Page>;
}

function MilkRecord({ p }: { p: Props }) {
  const rows = p.milk.ok ? p.milk.rows : [];
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}><ScreenTitle title="Doodh Record" sub="Litre, fat, SNF, LR aur raqam" onBack={() => p.onTab?.("doodh")} /><Card title="Collections">{rows.length ? rows.map((row, index) => <DataLine key={row.id || String(index)} mark="◉" title={`${row.entry_date || "—"} · ${shiftLabel(row.shift)}`} sub={`Fat ${row.fat_percentage ?? "—"} · SNF ${row.snf_percentage ?? "—"} · LR ${row.lr ?? "—"}`} value={`${display(row.quantity_liters ?? row.field_collected_volume, " L")}${row.total_amount != null ? ` · ${rupees(Number(row.total_amount))}` : ""}`} last={index === rows.length - 1} />) : <Empty text={p.milk.ok ? "Abhi koi collection nahi." : p.milk.message} />}</Card></Page>;
}

function QuickAdd({ p }: { p: Props }) {
  return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}><ScreenTitle title="Nayi Entry" sub="Kis qisam ki entry karni hai?" onBack={() => p.onTab?.("home")} /><View style={styles.addGrid}>{[["Sale", "munshi"], ["Khareed", "munshi"], ["Wasooli", "munshi"], ["Adaigi", "munshi"], ["Doodh", "doodh-record"], ["Fasal Task", "farm"], ["Vet Request", "vet"], ["Order", "karyana"]].map(([label, key], index) => <Pressable key={label} onPress={() => p.onTab?.(key)} style={styles.addCard}><Text style={styles.addMark}>{["↑", "↓", "↙", "↗", "◉", "♧", "+", "▣"][index]}</Text><Text style={styles.addTitle}>{label}</Text><Text style={styles.addArrow}>›</Text></Pressable>)}</View><View style={styles.voice}><View style={styles.mic}><Text style={styles.micText}>●</Text></View><View style={{ flex: 1 }}><Text style={styles.voiceTitle}>Awaaz se entry</Text><Text style={styles.voiceSub}>Roman Urdu mein bol kar shuru karein</Text></View></View></Page>;
}

function Services({ p }: { p: Props }) { return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}><ScreenTitle title="Meri Services" sub="Farmer/customer ka tamam record" onBack={() => p.onTab?.("home")} /><ServiceGrid onTab={p.onTab} /><Card title="Mazeed Services"><DataLine mark="⚙" title="Machinery Bookings" value={p.munshi.machinery.length ? String(p.munshi.machinery.length) : "—"} /><DataLine mark="♧" title="Paidawar / Produce" value={p.munshi.produce.length ? String(p.munshi.produce.length) : "—"} last /></Card></Page>; }

function Profile({ p }: { p: Props }) { return <Page refreshing={p.refreshing} onRefresh={p.onRefresh}><ScreenTitle title="Mera Profile" sub="Kisan aur customer ek hi account" onBack={() => p.onTab?.("home")} /><View style={styles.profileCard}><View style={styles.profileAvatar}><Text style={styles.profileAvatarText}>{(p.munshi.profile?.full_name || "K").slice(0, 1)}</Text></View><Text style={styles.profileName}>{p.munshi.profile?.full_name || "Kisan / Customer"}</Text><Text style={styles.profileSub}>{p.munshi.profile?.farmer_code || "Farmer code —"} · {p.munshi.profile?.village || "Village —"}</Text><Pressable onPress={p.onProfile} style={styles.outline}><Text style={styles.outlineText}>Settings aur account</Text></Pressable></View><Card title="Mera Record"><DataLine mark="⌂" title="Farms" value={p.munshi.farms.length ? String(p.munshi.farms.length) : "—"} /><DataLine mark="♧" title="Faslein" value={p.munshi.crops.length ? String(p.munshi.crops.length) : "—"} /><DataLine mark="♞" title="Janwar" value={p.munshi.animals.length ? String(activeAnimals(p.munshi).length) : "—"} last /></Card></Page>; }

function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyMark}>—</Text><Text style={styles.emptyText}>{text}</Text></View>; }

export function ApprovedFarmerApp(p: Props) {
  const screen = useMemo(() => {
    if (p.tab === "home") return <Home p={p} />;
    if (p.tab === "munshi") return <Munshi p={p} />;
    if (p.tab === "farm") return <Crops p={p} />;
    if (p.tab === "doodh") return <Dairy p={p} />;
    if (p.tab === "doodh-record") return <MilkRecord p={p} />;
    if (p.tab === "vet") return <Vet p={p} />;
    if (p.tab === "khata" || p.tab === "karyana") return <WalletOrders p={p} />;
    if (p.tab === "add") return <QuickAdd p={p} />;
    if (p.tab === "services" || p.tab === "machinery" || p.tab === "produce") return <Services p={p} />;
    return <Profile p={p} />;
  }, [p]);
  return <View style={{ flex: 1, backgroundColor: C.pale }}>{screen}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: C.pale },
  pageContent: { padding: 14, paddingBottom: 112 },
  hero: { backgroundColor: C.green, borderRadius: 24, overflow: "hidden", marginBottom: 12 },
  brandRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  leaf: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", marginRight: 9 },
  leafText: { color: "#BCE7B6", fontSize: 18 }, brand: { color: "#fff", fontWeight: "900", fontSize: 20 }, tagline: { color: "#CFE7D8", fontSize: 10 },
  bell: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(255,255,255,0.13)", alignItems: "center", justifyContent: "center" }, bellText: { color: "#fff", fontSize: 17 },
  personRow: { backgroundColor: "#FFFDF5", borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 15, flexDirection: "row", alignItems: "center" },
  avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#D7EBCF", borderWidth: 3, borderColor: "#fff", alignItems: "center", justifyContent: "center", marginRight: 12 }, avatarText: { color: C.green, fontSize: 23, fontWeight: "900" },
  hello: { color: C.muted, fontSize: 11 }, personName: { color: C.text, fontSize: 19, fontWeight: "900", marginTop: 1 }, location: { color: C.muted, fontSize: 12, marginTop: 4 }, chevron: { color: C.green, fontSize: 31, fontWeight: "400" },
  weatherRow: { flexDirection: "row", alignItems: "center", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 13, marginBottom: 10 }, weatherIcon: { fontSize: 29, marginRight: 10 }, weatherTitle: { color: C.text, fontWeight: "800" }, weatherSub: { color: C.muted, fontSize: 11, marginTop: 2 }, weatherStat: { alignItems: "flex-end" }, weatherStatValue: { color: C.text, fontWeight: "900" }, weatherStatLabel: { color: C.muted, fontSize: 10 },
  alert: { backgroundColor: C.redBg, borderRadius: 15, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 11 }, alertMark: { width: 30, height: 30, borderRadius: 15, textAlign: "center", textAlignVertical: "center", backgroundColor: C.red, color: "#fff", fontWeight: "900", marginRight: 9 }, alertTitle: { color: C.text, fontWeight: "800", fontSize: 13 }, alertSub: { color: C.red, fontSize: 11, marginTop: 2 }, alertArrow: { color: C.red, fontSize: 26 },
  serviceGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 }, service: { width: "31.8%", minHeight: 94, borderRadius: 16, borderWidth: 1, borderColor: "rgba(7,91,57,0.07)", alignItems: "center", justifyContent: "center", padding: 8, marginBottom: 8 }, serviceMark: { color: C.green, fontSize: 27, fontWeight: "900" }, serviceLabel: { color: C.text, fontSize: 11, lineHeight: 14, fontWeight: "800", textAlign: "center", marginTop: 5 },
  twoCol: { flexDirection: "row", justifyContent: "space-between", marginBottom: 11 }, miniCard: { width: "48.7%", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 14 }, miniTitle: { color: C.muted, fontSize: 11, fontWeight: "700" }, miniValue: { color: C.text, fontWeight: "900", fontSize: 22, marginTop: 5 }, miniSub: { color: C.muted, fontSize: 10, marginTop: 3 },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 11 }, cardHead: { flexDirection: "row", alignItems: "center", marginBottom: 8 }, cardTitle: { color: C.text, fontSize: 16, fontWeight: "900", flex: 1 }, cardAction: { color: C.green2, fontSize: 11, fontWeight: "800" },
  dataLine: { minHeight: 56, borderBottomWidth: 1, borderBottomColor: C.line, flexDirection: "row", alignItems: "center", paddingVertical: 7 }, dataIcon: { width: 34, height: 34, borderRadius: 11, backgroundColor: C.mint, alignItems: "center", justifyContent: "center", marginRight: 10 }, dataIconText: { color: C.green2, fontWeight: "900", fontSize: 16 }, dataTitle: { color: C.text, fontWeight: "800", fontSize: 13 }, dataSub: { color: C.muted, fontSize: 10, marginTop: 2 }, dataValue: { color: C.text, fontWeight: "800", fontSize: 12, maxWidth: "38%", textAlign: "right" },
  screenHead: { minHeight: 60, backgroundColor: C.green, borderRadius: 18, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 11 }, back: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", marginRight: 10 }, backText: { color: "#fff", fontSize: 30, lineHeight: 31 }, screenTitle: { color: "#fff", fontSize: 20, fontWeight: "900" }, screenSub: { color: "#CFE7D8", fontSize: 10, marginTop: 2 },
  segment: { flexDirection: "row", backgroundColor: "#EDF1EB", padding: 4, borderRadius: 14, marginBottom: 11 }, segmentBtn: { flex: 1, minHeight: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" }, segmentOn: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line }, segmentText: { color: C.muted, fontSize: 11, fontWeight: "800" }, segmentTextOn: { color: C.green },
  quickRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 11 }, quick: { width: "23.5%", backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 15, minHeight: 73, alignItems: "center", justifyContent: "center" }, quickMark: { color: C.green2, fontSize: 20, fontWeight: "900" }, quickText: { color: C.text, fontSize: 10, fontWeight: "800", marginTop: 5 },
  voice: { backgroundColor: "#E7F5EC", borderWidth: 1, borderColor: "#C6E6D2", borderRadius: 17, padding: 12, flexDirection: "row", alignItems: "center", marginBottom: 11 }, mic: { width: 45, height: 45, borderRadius: 23, backgroundColor: C.green, alignItems: "center", justifyContent: "center", marginRight: 11 }, micText: { color: "#fff", fontSize: 19 }, voiceTitle: { color: C.text, fontWeight: "900" }, voiceSub: { color: C.muted, fontSize: 10, marginTop: 2 }, voiceWave: { color: C.green2, letterSpacing: 2, fontWeight: "900" },
  cropCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 14, marginBottom: 11 }, cropTop: { flexDirection: "row", alignItems: "center" }, cropImage: { width: 70, height: 62, borderRadius: 14, backgroundColor: "#DDEBC6", alignItems: "center", justifyContent: "center", marginRight: 12 }, cropImageMark: { color: C.green, fontSize: 31 }, cropFarm: { color: C.muted, fontSize: 10 }, cropName: { color: C.text, fontSize: 18, fontWeight: "900", marginTop: 1 }, cropMeta: { color: C.muted, fontSize: 10, marginTop: 4 }, timeline: { flexDirection: "row", marginVertical: 16 }, stage: { flex: 1, alignItems: "center", borderTopWidth: 2, borderTopColor: C.line }, stageDot: { width: 11, height: 11, borderRadius: 6, backgroundColor: "#CBD4CE", marginTop: -7, marginBottom: 5 }, stageOn: { backgroundColor: C.green2, borderWidth: 2, borderColor: "#B8E0C5" }, stageLabel: { color: C.muted, fontSize: 9 }, cropStats: { flexDirection: "row", justifyContent: "space-between", backgroundColor: C.goldBg, borderRadius: 13, padding: 11 }, statLabel: { color: C.muted, fontSize: 9 }, statValue: { color: C.text, fontWeight: "900", marginTop: 3, fontSize: 12 },
  animalCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 18, padding: 11, marginBottom: 9, flexDirection: "row", alignItems: "center" }, animalPhoto: { width: 66, height: 66, borderRadius: 16, backgroundColor: "#DCE9D4", alignItems: "center", justifyContent: "center", marginRight: 12 }, animalMark: { color: C.green, fontSize: 30 }, animalTag: { color: C.muted, fontSize: 10 }, animalName: { color: C.text, fontWeight: "900", fontSize: 16, marginTop: 1 }, animalMeta: { color: C.muted, fontSize: 10, marginTop: 3 }, due: { color: C.red, backgroundColor: C.redBg, alignSelf: "flex-start", borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3, marginTop: 5, fontSize: 9, fontWeight: "700" },
  requestTile: { width: "48.7%", borderRadius: 17, padding: 13, minHeight: 115 }, requestMark: { color: C.green, fontSize: 26, fontWeight: "900" }, requestTitle: { color: C.text, fontWeight: "900", fontSize: 13, marginTop: 7 }, requestSub: { color: C.muted, fontSize: 9, marginTop: 3 }, fieldLabel: { color: C.muted, fontSize: 10, fontWeight: "700", marginBottom: 6 }, animalChip: { borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, marginRight: 7, backgroundColor: C.pale }, animalChipOn: { borderColor: C.green2, backgroundColor: C.mint }, animalChipText: { color: C.muted, fontSize: 10, fontWeight: "800" }, textarea: { minHeight: 92, borderWidth: 1, borderColor: C.line, borderRadius: 13, backgroundColor: C.pale, padding: 12, textAlignVertical: "top", color: C.text }, primary: { backgroundColor: C.green, borderRadius: 14, minHeight: 46, alignItems: "center", justifyContent: "center", marginTop: 10 }, primaryText: { color: "#fff", fontWeight: "900" }, info: { color: C.green, fontSize: 11, marginTop: 9, lineHeight: 16 },
  walletHero: { minHeight: 130, backgroundColor: C.goldBg, borderWidth: 1, borderColor: "#EBD49A", borderRadius: 20, padding: 17, marginBottom: 11, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }, walletLabel: { color: "#795815", fontSize: 11, fontWeight: "700" }, walletValue: { color: C.text, fontWeight: "900", fontSize: 28, marginTop: 5 }, walletSub: { color: "#795815", fontSize: 10, marginTop: 4 }, walletMark: { width: 55, height: 55, borderRadius: 18, backgroundColor: C.gold, alignItems: "center", justifyContent: "center" }, walletMarkText: { color: "#fff", fontWeight: "900", fontSize: 27 }, input: { minHeight: 48, borderWidth: 1, borderColor: C.line, borderRadius: 13, paddingHorizontal: 12, backgroundColor: C.pale, color: C.text },
  addGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 4 }, addCard: { width: "48.7%", minHeight: 90, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 14, marginBottom: 9, flexDirection: "row", alignItems: "center" }, addMark: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.mint, textAlign: "center", textAlignVertical: "center", color: C.green2, fontSize: 18, fontWeight: "900", marginRight: 9 }, addTitle: { color: C.text, fontWeight: "900", flex: 1, fontSize: 13 }, addArrow: { color: C.green2, fontSize: 24 },
  profileCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 21, padding: 20, alignItems: "center", marginBottom: 11 }, profileAvatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: "#D7EBCF", alignItems: "center", justifyContent: "center" }, profileAvatarText: { color: C.green, fontSize: 34, fontWeight: "900" }, profileName: { color: C.text, fontSize: 21, fontWeight: "900", marginTop: 10 }, profileSub: { color: C.muted, fontSize: 11, marginTop: 4 }, outline: { borderWidth: 1, borderColor: C.green2, borderRadius: 13, paddingHorizontal: 18, paddingVertical: 10, marginTop: 15 }, outlineText: { color: C.green, fontWeight: "800", fontSize: 12 },
  empty: { minHeight: 86, alignItems: "center", justifyContent: "center", padding: 12 }, emptyMark: { color: C.green2, fontSize: 23, fontWeight: "900" }, emptyText: { color: C.muted, textAlign: "center", fontSize: 11, lineHeight: 16, marginTop: 3 },
});
