import { useState, type ReactElement } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import {
  EMPTY_FACTS,
  SAMPLE_ENTRIES,
  SAMPLE_HOME,
  SAMPLE_INBOX,
  dueReminders,
  homeUsesSample,
  incomeText,
  khataSides,
  nameInitials,
  openOrderStats,
  orderInbox,
  orderSpend,
  overviewDate,
  periodBounds,
  prettyPhone,
  recentEntries,
  reminderInbox,
  todayMilk,
  walletCard,
  type DeskEntry,
  type FarmFacts,
  type MunshiPeriod,
} from "../../../../src/lib/mobile/farmer-desk";
import { karachiDate, type HealthRow, type KhataView, type MilkRow, type OrderRow, type ReadResult } from "../../../../src/lib/mobile/live-read";
import { karachiWeek } from "../../../../src/lib/mobile/statement";
import type { LiveBag } from "../bits";
import { useFace, useWeather, type WeatherView } from "../glass";
import { AppVersionStrip } from "../glass";

const PAGE = "#F3F6F2";
const GREEN = "#0E7A3C";
const DEEP = "#0C5C30";
const INK = "#14281C";
const MUTED = "#6D7B72";

type Go = (key: string) => void;

export function FarmerShell({
  tab,
  live,
  khata,
  milk,
  orders,
  health,
  names,
  facts,
  refreshing,
  onRefresh,
  onTab,
  onRole,
  onSupport,
  onSettings,
  onLogout,
}: {
  tab: "home" | "munshi" | "add" | "services" | "more";
  live?: LiveBag;
  khata: KhataView;
  milk: ReadResult<MilkRow>;
  orders: ReadResult<OrderRow>;
  health: ReadResult<HealthRow>;
  names: Map<string, string>;
  facts: FarmFacts | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onTab?: Go;
  onRole?: () => void;
  onSupport?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}) {
  const face = useFace(live, "Kisan / Customer");
  const card = facts ?? EMPTY_FACTS;
  const place = card.place || face.place;
  const weather = useWeather(place);
  const name = card.name || face.name || "Kisan";
  const milkRows = milk.ok ? milk.rows : [];
  const orderRows = orders.ok ? orders.rows : [];
  const healthRows = health.ok ? health.rows : [];
  const today = karachiDate();
  const sample = homeUsesSample({
    milkOk: milk.ok,
    milkCount: milkRows.length,
    ordersOk: orders.ok,
    orderCount: orderRows.length,
    healthOk: health.ok,
    healthCount: healthRows.length,
    khataOwed: khata.owed,
    khataNote: khata.note,
  });
  const refresh = onRefresh ? <RefreshControl refreshing={refreshing === true} onRefresh={onRefresh} tintColor={GREEN} /> : undefined;

  if (tab === "munshi") {
    return (
      <Munshi
        name={name}
        milkRows={milkRows}
        orderRows={orderRows}
        lines={khata.lines}
        names={names}
        owed={khata.owed}
        note={khata.note}
        milkOk={milk.ok}
        ordersOk={orders.ok}
        sample={sample}
        refresh={refresh}
        onTab={onTab}
      />
    );
  }
  if (tab === "add") return <Entry onTab={onTab} />;
  if (tab === "services") {
    return (
      <Services
        facts={card}
        milkRows={milkRows}
        orderRows={orderRows}
        healthRows={healthRows}
        today={today}
        sample={sample}
        milkOk={milk.ok}
        ordersOk={orders.ok}
        healthOk={health.ok}
        onTab={onTab}
        onSupport={onSupport}
      />
    );
  }
  if (tab === "more") {
    return (
      <Profile
        name={name}
        place={place}
        phone={prettyPhone(card.phone)}
        code={card.code}
        farms={card.farms}
        crops={card.crops}
        animals={card.animals}
        onRole={onRole}
        onSupport={onSupport}
        onSettings={onSettings}
        onLogout={onLogout}
      />
    );
  }
  return (
    <Home
      name={name}
      place={place}
      weather={weather}
      today={today}
      sample={sample}
      milk={milk}
      milkRows={milkRows}
      orders={orders}
      orderRows={orderRows}
      health={health}
      healthRows={healthRows}
      animals={card.animalRows}
      khata={khata}
      refresh={refresh}
      onTab={onTab}
      onRole={onRole}
    />
  );
}

function Home({
  name,
  place,
  weather,
  today,
  sample,
  milk,
  milkRows,
  orders,
  orderRows,
  health,
  healthRows,
  animals,
  khata,
  refresh,
  onTab,
  onRole,
}: {
  name: string;
  place: string;
  weather: WeatherView | null;
  today: string;
  sample: boolean;
  milk: ReadResult<MilkRow>;
  milkRows: MilkRow[];
  orders: ReadResult<OrderRow>;
  orderRows: OrderRow[];
  health: ReadResult<HealthRow>;
  healthRows: HealthRow[];
  animals: FarmFacts["animalRows"];
  khata: KhataView;
  refresh?: ReactElement;
  onTab?: Go;
  onRole?: () => void;
}) {
  const [allInbox, setAllInbox] = useState(false);
  const doodh = todayMilk(milkRows, today);
  const wallet = walletCard(khata.owed, khata.note);
  const vet = dueReminders(healthRows, today);
  const open = openOrderStats(orderRows);
  const inbox = sample
    ? SAMPLE_INBOX
    : [...reminderInbox(healthRows, animals, today), ...orderInbox(orderRows)];
  const shown = allInbox ? inbox : inbox.slice(0, 2);
  return (
    <ScrollView style={{ flex: 1, backgroundColor: PAGE }} contentContainerStyle={{ padding: 16, paddingBottom: 28 }} refreshControl={refresh}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <View style={styles.pill}>
          <Text style={{ marginRight: 4 }}>🌱</Text>
          <Text style={styles.pillText}>Kisan / Customer</Text>
        </View>
        <View style={{ flex: 1 }} />
        <Pressable onPress={onRole} style={styles.pill}>
          <Text style={styles.pillText}>Role badlo </Text>
          <Text style={{ color: GREEN }}>⇄</Text>
        </Pressable>
      </View>
      <View style={styles.hero}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>🌱</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ color: "#fff", fontSize: 20, fontWeight: "800" }}>Kisan Pakistan</Text>
                <AppVersionStrip />
              </View>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.88)", marginTop: 14 }}>Assalam o Alaikum</Text>
            <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 2 }}>{name}</Text>
            <Text style={{ color: "rgba(255,255,255,0.9)", marginTop: 4 }}>📍 {place || "Gaon record nahi"}</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={{ color: GREEN, fontSize: 22, fontWeight: "800" }}>{nameInitials(name)}</Text>
          </View>
        </View>
      </View>
      <WeatherStrip weather={weather} />
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 10 }}>
        <Text style={styles.h}>Aaj ka overview</Text>
        <Text style={{ color: MUTED, fontWeight: "700" }}>{overviewDate(today)}</Text>
      </View>
      <View style={styles.grid}>
        <Stat emoji="🥛" tint="#E7F6EC" title="Doodh aaj" value={sample ? SAMPLE_HOME.doodh : milk.ok ? doodh.text : "—"} sub={sample ? SAMPLE_HOME.doodhSub : milk.ok ? doodh.sub : "nahi khula"} onPress={() => onTab?.("doodh")} />
        <Stat emoji="📒" tint="#FFF6E0" title="Khata balance" value={sample ? SAMPLE_HOME.khata : wallet.value} sub={sample ? SAMPLE_HOME.khataSub : wallet.sub} onPress={() => onTab?.("munshi")} />
        <Stat emoji="💉" tint="#FDECEC" title="Vet reminders" value={sample ? SAMPLE_HOME.vet : health.ok ? String(vet.count) : "—"} sub={sample ? SAMPLE_HOME.vetSub : health.ok ? (vet.deworm ? "deworm due" : vet.count ? "due" : "koi due nahi") : "nahi khula"} alert={sample || vet.deworm} onPress={() => onTab?.("vet")} />
        <Stat emoji="🛒" tint="#FFF1E6" title="Open orders" value={sample ? SAMPLE_HOME.orders : orders.ok ? String(open.open) : "—"} sub={sample ? SAMPLE_HOME.ordersSub : orders.ok ? (open.moving ? `${open.moving} raste mein` : "open") : "nahi khule"} onPress={() => onTab?.("karyana")} />
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 8 }}>
        <Text style={styles.h}>Inbox</Text>
        <Pressable onPress={() => setAllInbox(true)}><Text style={{ color: GREEN, fontWeight: "800" }}>Sab dekhein</Text></Pressable>
      </View>
      {shown.length === 0 ? <Text style={{ color: MUTED, marginBottom: 8 }}>Koi naya paigham nahi.</Text> : null}
      {shown.map((row) => (
        <Pressable key={row.title} onPress={() => onTab?.(row.dest)} style={styles.row}>
          <Bubble emoji={row.title.startsWith("Order") ? "🚚" : "⚠️"} tint={row.title.startsWith("Order") ? "#EEF3FF" : "#FFF4E0"} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: INK, fontWeight: "800" }}>{row.title}</Text>
            <Text style={{ color: MUTED, marginTop: 2 }}>{row.detail}</Text>
          </View>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      ))}
      <Text style={[styles.h, { marginTop: 8, marginBottom: 10 }]}>Services</Text>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Mini emoji="🐄" tint="#F4EFE4" label="Janwar" onPress={() => onTab?.("vet")} />
        <Mini emoji="🩺" tint="#FDECEC" label="Vet" onPress={() => onTab?.("vet")} />
        <Mini emoji="🌾" tint="#FFF6E0" label="Faslein" onPress={() => onTab?.("farm")} />
      </View>
      {sample ? <Text style={{ color: MUTED, textAlign: "center", marginTop: 8, fontSize: 12 }}>Mockup data</Text> : null}
    </ScrollView>
  );
}

function WeatherStrip({ weather }: { weather: WeatherView | null }) {
  const rain = weather?.rain || "—";
  return (
    <View style={[styles.row, { marginBottom: 0 }]}>
      <Text style={{ flex: 1, color: INK, fontWeight: "700" }}>☀ {weather?.temp || "—"} · {weather?.condition || "Mausam"}</Text>
      <Text style={{ color: INK, fontWeight: "700", marginRight: 10 }}>Barish: {rain}</Text>
      <Text style={{ color: GREEN, fontWeight: "800" }}>Mausam ›</Text>
    </View>
  );
}

function Munshi({
  name,
  milkRows,
  orderRows,
  lines,
  names,
  owed,
  note,
  milkOk,
  ordersOk,
  sample,
  refresh,
  onTab,
}: {
  name: string;
  milkRows: MilkRow[];
  orderRows: OrderRow[];
  lines: KhataView["lines"];
  names: Map<string, string>;
  owed: number | null;
  note: string | null;
  milkOk: boolean;
  ordersOk: boolean;
  sample: boolean;
  refresh?: ReactElement;
  onTab?: Go;
}) {
  const [period, setPeriod] = useState<MunshiPeriod>("aaj");
  const today = karachiDate();
  const bounds = periodBounds(period, today, karachiWeek());
  const sides = khataSides(owed, note);
  const entries = sample ? SAMPLE_ENTRIES : recentEntries({ milk: milkRows, names, orders: orderRows, lines, start: bounds.start, end: bounds.end });
  const periods: { key: MunshiPeriod; label: string }[] = [
    { key: "aaj", label: "Aaj" },
    { key: "hafte", label: "Is Hafte" },
    { key: "mahine", label: "Is Mahine" },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <View style={styles.banner}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>📒 Digital Munshi</Text>
        <Text style={{ color: "rgba(255,255,255,0.86)", marginTop: 2 }}>{name} ka khata</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }} refreshControl={refresh}>
        <View style={styles.segment}>
          {periods.map((item) => {
            const on = period === item.key;
            return (
              <Pressable key={item.key} onPress={() => setPeriod(item.key)} style={[styles.segmentItem, on ? styles.segmentOn : null]}>
                <Text style={{ color: on ? INK : MUTED, fontWeight: "800" }}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.grid}>
          <Stat emoji="⬆️" tint="#E7F6EC" title="Aamdani" value={sample ? SAMPLE_HOME.aamdani : milkOk ? incomeText(milkRows, bounds.start, bounds.end) : "—"} sub={sample ? "is mahine" : bounds.sub} onPress={() => onTab?.("doodh")} />
          <Stat emoji="⬇️" tint="#FDECEC" title="Kharcha" value={sample ? SAMPLE_HOME.kharcha : ordersOk ? orderSpend(orderRows, bounds.start, bounds.end).text : "—"} sub={sample ? "is mahine" : bounds.sub} alert onPress={() => onTab?.("karyana")} />
          <Stat emoji="🪙" tint="#FFF1E6" title="Lenay hain" value={sample ? SAMPLE_HOME.lenay : sides.lenay} sub={sample ? SAMPLE_HOME.lenaySub : sides.lenaySub} onPress={() => onTab?.("munshi")} />
          <Stat emoji="🪙" tint="#FFF6E0" title="Dene hain" value={sample ? SAMPLE_HOME.dene : sides.dene} sub={sample ? SAMPLE_HOME.deneSub : sides.deneSub} alert onPress={() => onTab?.("munshi")} />
        </View>
        <View style={[styles.row, { marginTop: 4 }]}>
          <Text style={{ flex: 1, color: INK, fontWeight: "800" }}>💵 Cash in hand</Text>
          <Text style={{ color: INK, fontWeight: "800" }}>{sample ? SAMPLE_HOME.cash : sides.cash}</Text>
        </View>
        <Text style={[styles.h, { marginTop: 16, marginBottom: 10 }]}>Jaldi entry</Text>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Mini emoji="💵" tint="#E7F6EC" label="Sale" width="23%" onPress={() => onTab?.("karyana")} />
          <Mini emoji="🛍️" tint="#F3EEF8" label="Khareed" width="23%" onPress={() => onTab?.("karyana")} />
          <Mini emoji="🪙" tint="#FDECEC" label="Wasooli" width="23%" onPress={() => onTab?.("munshi")} />
          <Mini emoji="🪙" tint="#FFF6E0" label="Adaigi" width="23%" onPress={() => onTab?.("munshi")} />
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 8 }}>
          <Text style={styles.h}>Haaliya entries</Text>
          <Text style={{ color: GREEN, fontWeight: "800" }}>Sab ›</Text>
        </View>
        {entries.length === 0 ? <Text style={{ color: MUTED }}>Is dauran koi entry nahi.</Text> : null}
        {entries.map((row) => <EntryLine key={`${row.title}-${row.detail}`} row={row} />)}
        {sample ? <Text style={{ color: MUTED, textAlign: "center", marginTop: 8, fontSize: 12 }}>Mockup data</Text> : null}
        <Pressable onPress={() => onTab?.("add")} style={[styles.row, { marginTop: 14 }]}>
          <Text style={{ marginRight: 8 }}>🎤</Text>
          <Text style={{ flex: 1, color: MUTED, fontWeight: "700" }}>Bol kar entry karein</Text>
          <Text style={styles.chev}>›</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function EntryLine({ row }: { row: DeskEntry }) {
  const emoji = row.title.startsWith("Doodh") ? "🥛" : row.title.startsWith("Wasooli") ? "🪙" : "🌾";
  return (
    <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10 }}>
      <Bubble emoji={emoji} tint="#F4F7F4" />
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: INK, fontWeight: "800" }}>{row.title}</Text>
        <Text style={{ color: MUTED, marginTop: 2 }}>{row.detail}</Text>
      </View>
      <Text style={{ color: row.tone === "out" ? "#D64545" : GREEN, fontWeight: "800" }}>{row.amount}</Text>
    </View>
  );
}

function Entry({ onTab }: { onTab?: Go }) {
  const groups: { title: string; rows: { emoji: string; tint: string; title: string; sub: string; tab: string }[] }[] = [
    {
      title: "Khata",
      rows: [
        { emoji: "💵", tint: "#E7F6EC", title: "Sale", sub: "Kuch becha", tab: "karyana" },
        { emoji: "🛍️", tint: "#F3EEF8", title: "Khareed", sub: "Kuch khareeda", tab: "karyana" },
        { emoji: "🪙", tint: "#FFF6E0", title: "Wasooli / Adaigi", sub: "Paisay liye ya diye", tab: "munshi" },
      ],
    },
    {
      title: "Dairy & Farm",
      rows: [
        { emoji: "🥛", tint: "#E7F6EC", title: "Doodh", sub: "Subah / shaam ka doodh", tab: "doodh" },
        { emoji: "🐄", tint: "#F3EEF8", title: "Janwar", sub: "Naya janwar ya sehat note", tab: "vet" },
        { emoji: "🌾", tint: "#FFF6E0", title: "Fasal kaam", sub: "Bijai, khaad, spray", tab: "farm" },
      ],
    },
    {
      title: "Orders",
      rows: [
        { emoji: "🛒", tint: "#EEF3FF", title: "Naya order", sub: "Feed, beej, dawai mangwayein", tab: "karyana" },
      ],
    },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <View style={styles.banner}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>+ Nayi Entry</Text>
        <Text style={{ color: "rgba(255,255,255,0.86)", marginTop: 2 }}>Kya darj karna hai?</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        {groups.map((group) => (
          <View key={group.title}>
            <Text style={[styles.h, { marginBottom: 8, marginTop: 6 }]}>{group.title}</Text>
            <View style={styles.card}>
              {group.rows.map((row, index) => (
                <Pressable key={row.title} onPress={() => onTab?.(row.tab)} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: "#EEF2EE" }}>
                  <Bubble emoji={row.emoji} tint={row.tint} />
                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text style={{ color: INK, fontWeight: "800" }}>{row.title}</Text>
                    <Text style={{ color: MUTED, marginTop: 2 }}>{row.sub}</Text>
                  </View>
                  <Text style={styles.chev}>›</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function Services({
  facts,
  milkRows,
  orderRows,
  healthRows,
  today,
  sample,
  milkOk,
  ordersOk,
  healthOk,
  onTab,
  onSupport,
}: {
  facts: FarmFacts;
  milkRows: MilkRow[];
  orderRows: OrderRow[];
  healthRows: HealthRow[];
  today: string;
  sample: boolean;
  milkOk: boolean;
  ordersOk: boolean;
  healthOk: boolean;
  onTab?: Go;
  onSupport?: () => void;
}) {
  const doodh = todayMilk(milkRows, today);
  const vet = dueReminders(healthRows, today);
  const open = openOrderStats(orderRows);
  const tiles = [
    { emoji: "🐄", tint: "#F4EFE4", title: "Janwar", sub: sample ? SAMPLE_HOME.animals : facts.animals == null ? "—" : `${facts.animals} janwar`, tab: "vet" },
    { emoji: "🩺", tint: "#FDECEC", title: "Vet", sub: sample ? SAMPLE_HOME.vetTile : healthOk ? (vet.count ? `${vet.count} due` : "koi due nahi") : "—", tab: "vet" },
    { emoji: "🌾", tint: "#FFF6E0", title: "Faslein", sub: sample ? SAMPLE_HOME.crops : facts.crops == null ? "—" : `${facts.crops} active`, tab: "farm" },
    { emoji: "🛒", tint: "#EEF3FF", title: "Shop", sub: "Feed, beej", tab: "karyana" },
    { emoji: "🥛", tint: "#E7F6EC", title: "Doodh", sub: sample ? SAMPLE_HOME.doodhTile : milkOk ? `${doodh.text} aaj` : "—", tab: "doodh" },
    { emoji: "📦", tint: "#FFF1E6", title: "Orders", sub: sample ? SAMPLE_HOME.ordersTile : ordersOk ? `${open.open} open` : "—", tab: "karyana" },
  ];
  const more = [
    { emoji: "🚜", tint: "#FFF6E0", title: "Machinery", sub: "Tractor / thresher kiraye pe", tab: "farm" },
    { emoji: "📈", tint: "#E7F6EC", title: "Paidawar", sub: "Fasal bechein, rate dekhein", tab: "farm" },
    { emoji: "🎧", tint: "#EEF3FF", title: "Support", sub: "Masla batayein — hum madad karenge", tab: "support" },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <View style={styles.banner}>
        <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>🧩 Meri Services</Text>
        <Text style={{ color: "rgba(255,255,255,0.86)", marginTop: 2 }}>Kisan Pakistan</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28 }}>
        <Text style={[styles.h, { marginBottom: 10 }]}>Ahem services</Text>
        <View style={styles.grid}>
          {tiles.map((tile) => (
            <Pressable key={tile.title} onPress={() => onTab?.(tile.tab)} style={styles.tile}>
              <Bubble emoji={tile.emoji} tint={tile.tint} />
              <Text style={{ color: INK, fontWeight: "800", marginTop: 8 }}>{tile.title}</Text>
              <Text style={{ color: MUTED, marginTop: 2 }}>{tile.sub}</Text>
            </Pressable>
          ))}
        </View>
        {sample ? <Text style={{ color: MUTED, textAlign: "center", marginBottom: 8, fontSize: 12 }}>Mockup data</Text> : null}
        <Text style={[styles.h, { marginBottom: 8 }]}>Mazeed</Text>
        <View style={styles.card}>
          {more.map((row, index) => (
            <Pressable key={row.title} onPress={() => { if (row.tab === "support") onSupport?.(); else onTab?.(row.tab); }} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: "#EEF2EE" }}>
              <Bubble emoji={row.emoji} tint={row.tint} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: INK, fontWeight: "800" }}>{row.title}</Text>
                <Text style={{ color: MUTED, marginTop: 2 }}>{row.sub}</Text>
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Profile({
  name,
  place,
  phone,
  code,
  farms,
  crops,
  animals,
  onRole,
  onSupport,
  onSettings,
  onLogout,
}: {
  name: string;
  place: string;
  phone: string | null;
  code: string | null;
  farms: number | null;
  crops: number | null;
  animals: number | null;
  onRole?: () => void;
  onSupport?: () => void;
  onSettings?: () => void;
  onLogout?: () => void;
}) {
  const rows = [
    { emoji: "⚙️", tint: "#EEF3FF", title: "Settings", sub: "Zaban, notifications", color: INK, onPress: onSettings },
    { emoji: "⇄", tint: "#E7F6EC", title: "Role badlo", sub: onRole ? "Kisan / Customer" : "Is login par role switch band hai", color: INK, onPress: onRole },
    { emoji: "🎧", tint: "#FFF6E0", title: "Support", sub: "Madad chahiye?", color: INK, onPress: onSupport },
    { emoji: "🚪", tint: "#FDECEC", title: "Logout", sub: "", color: "#D64545", onPress: onLogout },
  ];
  return (
    <View style={{ flex: 1, backgroundColor: PAGE }}>
      <View style={[styles.banner, { alignItems: "center", paddingBottom: 28 }]}>
        <View style={[styles.avatar, { width: 84, height: 84, borderRadius: 42, marginBottom: 10 }]}>
          <Text style={{ color: GREEN, fontSize: 28, fontWeight: "800" }}>{nameInitials(name)}</Text>
        </View>
        <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{name}</Text>
        <Text style={{ color: "rgba(255,255,255,0.86)", marginTop: 4 }}>Kisan aur customer ek hi account</Text>
        <View style={{ backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 14, paddingHorizontal: 12, paddingVertical: 4, marginTop: 10 }}>
          <Text style={{ color: GREEN, fontWeight: "800" }}>{code || "—"}</Text>
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 28, marginTop: -12 }}>
        <View style={styles.card}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
            <Bubble emoji="📍" tint="#FDECEC" />
            <View style={{ marginLeft: 10 }}>
              <Text style={{ color: INK, fontWeight: "800" }}>Gaon</Text>
              <Text style={{ color: MUTED }}>{place || "Gaon record nahi"}</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: "#EEF2EE" }}>
            <Bubble emoji="📞" tint="#EEF3FF" />
            <View style={{ marginLeft: 10 }}>
              <Text style={{ color: INK, fontWeight: "800" }}>Phone</Text>
              <Text style={{ color: MUTED }}>{phone || "Phone record nahi"}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 16 }}>
          <Count label="Farms" value={farms} />
          <Count label="Faslein" value={crops} />
          <Count label="Janwar" value={animals} />
        </View>
        <Text style={[styles.h, { marginBottom: 8 }]}>Account</Text>
        <View style={styles.card}>
          {rows.map((row, index) => (
            <Pressable key={row.title} onPress={row.onPress} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 12, borderTopWidth: index ? 1 : 0, borderTopColor: "#EEF2EE" }}>
              <Bubble emoji={row.emoji} tint={row.tint} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={{ color: row.color, fontWeight: "800" }}>{row.title}</Text>
                {row.sub ? <Text style={{ color: MUTED, marginTop: 2 }}>{row.sub}</Text> : null}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function Count({ label, value }: { label: string; value: number | null }) {
  return (
    <View style={[styles.card, { width: "31%", alignItems: "center", paddingVertical: 14 }]}>
      <Text style={{ color: INK, fontSize: 22, fontWeight: "800" }}>{value == null ? "—" : String(value)}</Text>
      <Text style={{ color: MUTED, marginTop: 2 }}>{label}</Text>
    </View>
  );
}

function Stat({ emoji, tint, title, value, sub, alert, onPress }: { emoji: string; tint: string; title: string; value: string; sub: string; alert?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.stat}>
      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Bubble emoji={emoji} tint={tint} />
        <Text style={{ flex: 1, color: INK, fontWeight: "700", marginLeft: 8 }} numberOfLines={1}>{title}</Text>
        <Text style={styles.chev}>›</Text>
      </View>
      <Text style={{ color: INK, fontSize: 22, fontWeight: "800", marginTop: 10 }}>{value}</Text>
      <Text style={{ color: alert ? "#D64545" : GREEN, fontWeight: "700", marginTop: 2 }}>{sub}</Text>
    </Pressable>
  );
}

function Mini({ emoji, tint, label, width = "31%", onPress }: { emoji: string; tint: string; label: string; width?: `${number}%`; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.card, { width, alignItems: "center", paddingVertical: 14 }]}>
      <Bubble emoji={emoji} tint={tint} />
      <Text style={{ color: INK, fontWeight: "700", marginTop: 8 }}>{label}</Text>
    </Pressable>
  );
}

function Bubble({ emoji, tint }: { emoji: string; tint: string }) {
  return (
    <View style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: tint, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
    </View>
  );
}

const styles = {
  pill: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: "#fff", borderWidth: 1, borderColor: "#D7E4DA", borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 },
  pillText: { color: INK, fontWeight: "700" as const, fontSize: 13 },
  hero: { backgroundColor: DEEP, borderRadius: 22, padding: 16, marginBottom: 12 },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: "#fff", alignItems: "center" as const, justifyContent: "center" as const },
  h: { flex: 1, color: INK, fontSize: 18, fontWeight: "800" as const },
  grid: { flexDirection: "row" as const, flexWrap: "wrap" as const, justifyContent: "space-between" as const },
  stat: { width: "48.5%" as const, backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E6EEE8" },
  row: { flexDirection: "row" as const, alignItems: "center" as const, backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: "#E6EEE8" },
  card: { backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 4, marginBottom: 12, borderWidth: 1, borderColor: "#E6EEE8" },
  tile: { width: "31%" as const, backgroundColor: "#fff", borderRadius: 16, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E6EEE8" },
  chev: { color: "#C3CEC6", fontSize: 22, fontWeight: "500" as const },
  banner: { backgroundColor: DEEP, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18 },
  segment: { flexDirection: "row" as const, backgroundColor: "#E7EEE8", borderRadius: 14, padding: 4, marginBottom: 12 },
  segmentItem: { flex: 1, alignItems: "center" as const, paddingVertical: 8, borderRadius: 12 },
  segmentOn: { backgroundColor: "#fff" },
};
