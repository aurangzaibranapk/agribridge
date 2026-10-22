import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Stop } from "react-native-svg";
import type { TimelineStep } from "../../../src/lib/mobile/glass-metrics";
import { timelineFinished, timelineProgress } from "../../../src/lib/mobile/glass-metrics";
import { liveAuth, type LiveBag } from "./bits";
import { liveGet, liveGetScoped } from "../../../src/lib/mobile/live-read";

export const glass = {
  bg: "#07140F",
  card: "rgba(14, 32, 28, 0.92)",
  line: "rgba(255,255,255,0.08)",
  text: "#F4F7F4",
  muted: "#8FA399",
  gold: "#C8A058",
  up: "#3DDC97",
  down: "#FF6B6B",
  blue: "#5B8CFF",
  purple: "#C4B5FD",
  orange: "#F5B942",
};

export function GlassScreen({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: glass.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing === true} onRefresh={onRefresh} tintColor={glass.up} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Rise({ index, children }: { index: number; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay: index * 70, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 420, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, shift]);
  return <Animated.View style={{ opacity, transform: [{ translateY: shift }] }}>{children}</Animated.View>;
}

export function BrandHeader({ role, name, onProfile }: { role: string; name: string; onProfile?: () => void }) {
  const initial = (name.trim().charAt(0) || role.charAt(0) || "A").toUpperCase();
  return (
    <Rise index={0}>
      <Text style={{ color: glass.gold, fontSize: 11, letterSpacing: 1.1, fontWeight: "700" }}>WASELA ECO MAHABALI · {role.toUpperCase()}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 12 }}>
        <Text style={{ color: glass.text, fontSize: 26, fontWeight: "800", flex: 1, paddingRight: 8 }}>Assalam o Alaikum, {name || "—"}</Text>
        <Pressable onPress={onProfile} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#146B3A", alignItems: "center", justifyContent: "center", shadowColor: "#3DDC97", shadowOpacity: 0.7, shadowRadius: 10 }}>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{initial}</Text>
        </Pressable>
      </View>
    </Rise>
  );
}

export type WeatherView = {
  place: string;
  temp: string;
  condition: string;
  humidity: string;
  wind: string;
  when: string;
  note: string | null;
};

const WMO: Record<number, string> = {
  0: "Saaf",
  1: "Halki dhoop",
  2: "Halki dhoop",
  3: "Badal",
  45: "Dhund",
  48: "Dhund",
  51: "Halki barish",
  53: "Halki barish",
  55: "Barish",
  61: "Barish",
  63: "Barish",
  65: "Tez barish",
  80: "Barish",
  81: "Barish",
  82: "Tez barish",
  95: "Toofan",
};

export function useFace(live?: LiveBag): { name: string; place: string } {
  const auth = liveAuth(live);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  useEffect(() => {
    if (!auth?.userId) return;
    const id = encodeURIComponent(auth.userId);
    void liveGet<{ full_name?: string | null }>(auth, `profiles?select=full_name&id=eq.${id}&limit=1`, fetch).then((rows) => {
      const full = rows.ok ? rows.rows[0]?.full_name || "" : "";
      setName(full.trim().split(/\s+/)[0] || "");
    });
    void liveGetScoped<{ village?: string | null; tehsil?: string | null; district?: string | null }>(auth, `farmers?select=village,tehsil,district&user_id=eq.${id}&limit=1`, fetch).then((rows) => {
      const row = rows.ok ? rows.rows[0] : null;
      setPlace(row?.village || row?.tehsil || row?.district || "");
    });
  }, [auth?.token, auth?.userId, auth?.url]);
  return { name, place };
}

export function useWeather(place: string): WeatherView | null {
  const [view, setView] = useState<WeatherView | null>(null);
  useEffect(() => {
    let stop = false;
    void (async () => {
      if (!place.trim()) {
        if (!stop) setView({ place: "—", temp: "—", condition: "Mausam", humidity: "—", wind: "—", when: "", note: "Shehar record mein nahi. Mausam nahi dikhaya." });
        return;
      }
      try {
        const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=1&language=en&format=json`);
        const geo = await geoRes.json() as { results?: { latitude: number; longitude: number; name: string }[] };
        const hit = geo.results?.[0];
        if (!hit) {
          if (!stop) setView({ place, temp: "—", condition: "Mausam", humidity: "—", wind: "—", when: "", note: "Is shehar ka mausam nahi mila." });
          return;
        }
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=Asia%2FKarachi`);
        const data = await res.json() as { current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number; weather_code?: number; time?: string } };
        const current = data.current;
        if (!current || current.temperature_2m == null) {
          if (!stop) setView({ place: hit.name, temp: "—", condition: "Mausam", humidity: "—", wind: "—", when: "", note: "Mausam ka jawab adhoora hai." });
          return;
        }
        const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "numeric", month: "short" }).format(new Date());
        if (!stop) setView({
          place: hit.name,
          temp: `${Math.round(current.temperature_2m)}°C`,
          condition: WMO[current.weather_code ?? -1] || "Mausam",
          humidity: current.relative_humidity_2m == null ? "—" : `${Math.round(current.relative_humidity_2m)}%`,
          wind: current.wind_speed_10m == null ? "—" : `${Math.round(current.wind_speed_10m)} km/h`,
          when,
          note: null,
        });
      } catch {
        if (!stop) setView({ place, temp: "—", condition: "Mausam", humidity: "—", wind: "—", when: "", note: "Mausam network par nahi aaya." });
      }
    })();
    return () => { stop = true; };
  }, [place]);
  return view;
}

export function WeatherCard({ weather, index = 1 }: { weather: WeatherView | null; index?: number }) {
  return (
    <Rise index={index}>
      <View style={{ backgroundColor: "#0C3B2C", borderRadius: 22, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: "rgba(61,220,151,0.28)" }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <View>
            <Text style={{ color: glass.muted }}>{weather?.place || "—"}</Text>
            <Text style={{ color: glass.text, fontSize: 34, fontWeight: "800" }}>{weather?.temp || "—"}</Text>
            <Text style={{ color: glass.gold }}>{weather?.condition || "Mausam"}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: glass.muted }}>{weather?.humidity || "—"}</Text>
            <Text style={{ color: glass.muted, marginTop: 4 }}>{weather?.wind || "—"}</Text>
            <Text style={{ color: glass.muted, marginTop: 8 }}>{weather?.when || ""}</Text>
          </View>
        </View>
        {weather?.note ? <Text style={{ color: glass.muted, marginTop: 8 }}>{weather.note}</Text> : null}
      </View>
    </Rise>
  );
}

export function Spark({ values, color }: { values: number[]; color: string }) {
  const width = 108;
  const height = 36;
  if (values.length < 2) return <View style={{ height }} />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - 4 - ((value - min) / span) * (height - 8);
    return `${x},${y}`;
  }).join(" ");
  return (
    <Svg width={width} height={height}>
      <Polyline points={points} fill="none" stroke={color} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  );
}

function chartPoints(values: number[], width: number, height: number): { x: number; y: number }[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  return values.map((value, index) => ({
    x: values.length === 1 ? width / 2 : (index / (values.length - 1)) * (width - 16) + 8,
    y: height - 18 - ((value - min) / span) * (height - 32),
  }));
}

function smoothLine(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i += 1) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x} ${c1y}, ${c2x} ${c2y}, ${p2.x} ${p2.y}`;
  }
  return d;
}

export function LineChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const width = 300;
  const height = 120;
  if (!values.length) return <Text style={{ color: glass.muted }}>Chart ke liye qatarein nahi.</Text>;
  const points = chartPoints(values, width, height);
  const line = smoothLine(points);
  const fill = `${line} L ${points[points.length - 1].x} ${height} L ${points[0].x} ${height} Z`;
  const gid = `fill${color.replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <View>
      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Path d={fill} fill={`url(#${gid})`} />
        <Path d={line} fill="none" stroke={color} strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((point, index) => <Circle key={index} cx={point.x} cy={point.y} r={3.2} fill={color} />)}
      </Svg>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        {labels.map((label, index) => <Text key={`${label}-${index}`} style={{ color: glass.muted, fontSize: 11 }}>{label}</Text>)}
      </View>
    </View>
  );
}

export function BarChart({ values, labels, color }: { values: number[]; labels: string[]; color: string }) {
  const max = Math.max(...values, 0);
  if (!values.length) return <Text style={{ color: glass.muted }}>Chart ke liye qatarein nahi.</Text>;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 132 }}>
      {values.map((value, index) => (
        <View key={`${labels[index]}-${index}`} style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: glass.muted, fontSize: 9, marginBottom: 4 }}>{value > 0 ? (Number.isInteger(value) ? String(value) : value.toFixed(1)) : ""}</Text>
          <View style={{ width: 16, height: max > 0 ? Math.max(6, (value / max) * 84) : 6, borderRadius: 8, backgroundColor: color, opacity: value > 0 ? 1 : 0.25 }} />
          <Text style={{ color: glass.muted, fontSize: 10, marginTop: 4 }}>{labels[index]}</Text>
        </View>
      ))}
    </View>
  );
}

export function Donut({ parts, center }: { parts: { label: string; value: number; color: string }[]; center?: string }) {
  const total = parts.reduce((sum, part) => sum + (part.value > 0 ? part.value : 0), 0);
  const size = 116;
  const r = 42;
  const c = 2 * Math.PI * r;
  let offset = 0;
  if (!(total > 0)) return <Text style={{ color: glass.muted }}>Qism ka hisaab nahi.</Text>;
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={14} fill="none" />
        {parts.map((part) => {
          if (!(part.value > 0)) return null;
          const len = (part.value / total) * c;
          const dash = `${len} ${c - len}`;
          const node = <Circle key={part.label} cx={size / 2} cy={size / 2} r={r} stroke={part.color} strokeWidth={14} fill="none" strokeDasharray={dash} strokeDashoffset={-offset} rotation={-90} origin={`${size / 2}, ${size / 2}`} />;
          offset += len;
          return node;
        })}
      </Svg>
      {center ? (
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center", paddingHorizontal: 28 }}>
          <Text style={{ color: glass.text, fontWeight: "800", fontSize: 11, textAlign: "center" }}>{center}</Text>
        </View>
      ) : null}
      </View>
      <View style={{ marginLeft: 12, flex: 1 }}>
        {parts.map((part) => (
          <Text key={part.label} style={{ color: glass.text, marginBottom: 4 }}>{part.label} {total > 0 ? `${Math.round((part.value / total) * 100)}%` : ""}</Text>
        ))}
      </View>
    </View>
  );
}

export function Pct({ value }: { value: number | null }) {
  if (value == null) return null;
  const up = value >= 0;
  return (
    <View style={{ backgroundColor: up ? "rgba(61,220,151,0.15)" : "rgba(255,107,107,0.15)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: up ? glass.up : glass.down, fontSize: 11, fontWeight: "700" }}>{up ? "▲" : "▼"} {Math.abs(value)}%</Text>
    </View>
  );
}

const GLYPH: Record<string, string> = {
  "Wallet balance": "M5 9h14v9H5z M5 9l2-3h10l2 3 M13 13h3",
  "Aaj ka doodh": "M9 4h6l1 4v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z",
  "Fat / SNF avg": "M10 3h4 M11 3v6L6 19h12L13 9V3",
  "Hafte ki kamai": "M4 17l4-5 3 3 6-8 M4 20h16",
  "Aaj ki collection": "M9 4h6l1 4v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z",
  "Kisan count": "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M4 19c1-3 3-4 5-4s4 1 5 4",
  "Pending entries": "M8 4h8 M8 20h8 M9 4c0 4 3 5 3 8s-3 4-3 8 M15 4c0 4-3 5-3 8s3 4 3 8",
  "Avg fat": "M10 3h4 M11 3v6L6 19h12L13 9V3",
  "Subah ka doodh": "M12 8a4 4 0 1 0 .1 0 M12 3v2 M12 19v2 M4 12H6 M18 12h2",
  "Shaam ka doodh": "M15 4a7 7 0 1 0 5 12 6 6 0 0 1-5-12z",
  "Pending checks": "M12 4l8 14H4z M12 10v4",
  "Total sales": "M4 17l4-5 3 3 6-8 M4 20h16",
  "Milk collection": "M9 4h6l1 4v11a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8z",
  "Grain stock": "M5 19c8 0 14-8 14-14-6 0-14 6-14 14z",
  "Active farmers": "M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6 M4 19c1-3 3-4 5-4s4 1 5 4",
  "Mere orders": "M4 8l8-4 8 4-8 4z M4 8v8l8 4 8-4V8",
  "Baqi balance": "M3 7h18v10H3z M3 11h18",
  "Is mahine orders": "M4 8l8-4 8 4-8 4z M4 8v8l8 4 8-4V8",
  "HQ khata balance": "M4 10l8-5 8 5 M6 10v7 M12 10v7 M18 10v7 M4 17h16",
  "Stock items": "M4 12l8-8h7v7l-8 8z",
  "Kam stock": "M12 4l8 14H4z M12 10v4",
  "Is mahine tankhwah": "M3 7h18v10H3z M3 11h18",
  "Advance baqi": "M3 7h18v10H3z M3 11h18",
  Hazri: "M5 6h14v13H5z M5 10h14 M8 4v4 M16 4v4",
  Tasks: "M5 12l5 5 9-10",
  "Aaj ke visits": "M5 6h14v13H5z M5 10h14",
  "Pending cases": "M8 4h8 M8 20h8 M9 4c0 4 3 5 3 8s-3 4-3 8",
  "Ilaj mukammal": "M5 12l5 5 9-10",
  "Kisan ke janwar": "M6 14c0-4 3-7 6-7s6 3 6 7v4H6z M8 10V7 M16 10V7",
};

export function Kpi({ label, value, sub, color, series, pct, index }: { label: string; value: string; sub?: string; color: string; series: number[]; pct: number | null; index: number }) {
  return (
    <Rise index={index}>
      <View style={{ width: "48%", backgroundColor: glass.card, borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: glass.line }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: color, opacity: 0.95, alignItems: "center", justifyContent: "center", shadowColor: color, shadowOpacity: 0.9, shadowRadius: 10, elevation: 6 }}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d={GLYPH[label] || "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"} stroke="#07140F" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          <Pct value={pct} />
        </View>
        <Text style={{ color: glass.muted, marginTop: 10, fontSize: 12 }}>{label}</Text>
        <Text style={{ color: glass.text, fontSize: 22, fontWeight: "800", marginTop: 2 }}>{value}</Text>
        {sub ? <Text style={{ color: glass.muted, fontSize: 11 }}>{sub}</Text> : null}
        <Spark values={series} color={color} />
      </View>
    </Rise>
  );
}

export function GlassCard({ title, sub, children, index = 2 }: { title: string; sub?: string; children: ReactNode; index?: number }) {
  return (
    <Rise index={index}>
      <View style={{ backgroundColor: glass.card, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: glass.line }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
          <Text style={{ color: glass.text, fontWeight: "800" }}>{title}</Text>
          {sub ? <Text style={{ color: glass.muted, fontSize: 12 }}>{sub}</Text> : null}
        </View>
        {children}
      </View>
    </Rise>
  );
}

export function Pill({ label, tone }: { label: string; tone: "green" | "orange" | "red" | "blue" }) {
  const color = tone === "green" ? glass.up : tone === "orange" ? glass.orange : tone === "red" ? glass.down : glass.blue;
  return (
    <View style={{ borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: color }}>
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function Timeline({ title, steps, onAction, index = 4 }: { title: string; steps: TimelineStep[]; onAction?: () => void; index?: number }) {
  const progress = timelineProgress(steps);
  const done = timelineFinished(steps);
  return (
    <GlassCard title={title} sub="Live step" index={index}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.08)", marginBottom: 10 }}>
        <View style={{ width: `${Math.round(progress * 100)}%`, height: 4, borderRadius: 2, backgroundColor: glass.up }} />
      </View>
      {steps.map((step, stepIndex) => (
        <View key={`${step.label}-${stepIndex}`} style={{ flexDirection: "row", marginBottom: 10 }}>
          <View style={{ width: 22, alignItems: "center" }}>
            <View style={{
              width: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: step.state === "done" ? glass.up : step.state === "active" ? glass.blue : step.state === "action" ? glass.down : "rgba(255,255,255,0.16)",
              alignItems: "center",
              justifyContent: "center",
            }}>
              {step.state === "done" ? <Text style={{ color: "#07140F", fontSize: 10, fontWeight: "800" }}>✓</Text> : null}
              {step.state === "active" ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#fff" }} /> : null}
            </View>
            {stepIndex < steps.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: "rgba(255,255,255,0.12)", marginTop: 2 }} /> : null}
          </View>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ color: step.state === "pending" ? glass.muted : glass.text, fontWeight: "700" }}>{step.label}</Text>
            {step.time && step.state === "done" ? <Text style={{ color: glass.muted, fontSize: 12 }}>{step.time}</Text> : null}
            {step.state === "action" ? (
              <Pressable onPress={onAction} style={{ marginTop: 6, alignSelf: "flex-start", backgroundColor: "#3A1518", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: glass.down, fontWeight: "800" }}>{step.actionLabel || "Action chahiye"}</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ))}
      {done ? <Text style={{ color: glass.up, fontWeight: "800" }}>Mukammal</Text> : null}
    </GlassCard>
  );
}

const TANK_COLOR = ["#3DDC97", "#5B8CFF", "#F5B942", "#C4B5FD"];

export function TankRow({ levels }: { levels: { name: string; pct: number | null }[] }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {levels.map((tank, index) => (
        <View key={tank.name} style={{ alignItems: "center", width: 64 }}>
          <View style={{ width: 36, height: 84, borderRadius: 18, borderWidth: 2, borderColor: TANK_COLOR[index % TANK_COLOR.length], overflow: "hidden", justifyContent: "flex-end", backgroundColor: "rgba(255,255,255,0.04)" }}>
            {tank.pct != null ? <View style={{ height: `${Math.max(0, Math.min(100, tank.pct))}%`, backgroundColor: TANK_COLOR[index % TANK_COLOR.length] }} /> : null}
          </View>
          <Text style={{ color: glass.text, marginTop: 6, fontWeight: "700" }}>{tank.pct == null ? "—" : `${Math.round(tank.pct)}%`}</Text>
          <Text style={{ color: glass.muted, fontSize: 11 }}>{tank.name}</Text>
        </View>
      ))}
    </View>
  );
}

export function BarTrack({ label, value, max, color }: { label: string; value: number | null; max: number | null; color: string }) {
  const width = value != null && max != null && max > 0 ? Math.max(6, Math.min(100, (value / max) * 100)) : 0;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: glass.text }}>{label}</Text>
        <Text style={{ color: glass.muted }}>{value == null ? "—" : String(value)}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.08)", marginTop: 4 }}>
        <View style={{ width: `${width}%`, height: 8, borderRadius: 4, backgroundColor: color }} />
      </View>
    </View>
  );
}
