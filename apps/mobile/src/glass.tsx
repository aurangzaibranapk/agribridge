import { Children, createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Animated, Pressable, RefreshControl, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Circle, Defs, LinearGradient, Path, Polyline, Rect, Stop } from "react-native-svg";
import { greetingName, roleNameKey } from "../../../src/lib/mobile/display-name";
import type { TimelineStep } from "../../../src/lib/mobile/glass-metrics";
import { countDelta, pctChange, ringDashOffset, timelineFinished, timelinePercent } from "../../../src/lib/mobile/glass-metrics";
import { type AppLang } from "../../../src/lib/mobile/sub-brand";
import { liveAuth, type LiveBag } from "./bits";
import { liveGet, liveGetScoped, loadPhoneNotes } from "../../../src/lib/mobile/live-read";
import { AGRIBRIDGE_OS_VERSION } from "../../../src/lib/app-version";
import { pickPakistan, preferVillage, shortPlace, usablePlace } from "../../../src/lib/mobile/weather-place";

export const glass = {
  bg: "#F7F8F3",
  card: "#FFFFFF",
  line: "#DDE7DF",
  text: "#10271D",
  muted: "#63736A",
  gold: "#A86E05",
  up: "#169447",
  down: "#FF6B6B",
  blue: "#5B8CFF",
  purple: "#C4B5FD",
  orange: "#F5B942",
};

function starDots(): { x: number; y: number; r: number; o: number }[] {
  const dots: { x: number; y: number; r: number; o: number }[] = [];
  let n = 42;
  for (let i = 0; i < 56; i += 1) {
    n = (n * 1103515245 + 12345) % 2147483647;
    dots.push({ x: (n % 1000) / 10, y: ((Math.floor(n / 9) % 1000) / 10), r: (n % 3) * 0.4 + 0.5, o: 0.28 + (n % 5) * 0.1 });
  }
  return dots;
}

const STARS = starDots();

export function StarField() {
  return (
    <Svg style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }} width="100%" height="100%" pointerEvents="none">
      <Defs>
        <LinearGradient id="agriSky" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#F1F8EF" />
          <Stop offset="0.5" stopColor="#FAFAF6" />
          <Stop offset="1" stopColor="#F7F3E9" />
        </LinearGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#agriSky)" />
      {STARS.slice(0, 18).map((star, index) => (
        <Circle key={index} cx={`${star.x}%`} cy={`${star.y}%`} r={star.r * 3} fill={index % 4 === 0 ? "#E7C97B" : "#B8DDB9"} opacity={star.o * 0.18} />
      ))}
    </Svg>
  );
}

export function GlassScreen({ children, refreshing, onRefresh }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void }) {
  return (
    <View style={{ flex: 1, minHeight: 0, backgroundColor: glass.bg }}>
      <StarField />
      <ScrollView
        style={{ flex: 1, minHeight: 0, backgroundColor: "transparent" }}
        contentContainerStyle={{ paddingHorizontal: 14, paddingTop: 10, paddingBottom: 118, width: "100%" }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing === true} onRefresh={onRefresh} tintColor={glass.up} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

export function Rise({ index, style, children }: { index: number; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const shift = useRef(new Animated.Value(16)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 420, delay: index * 70, useNativeDriver: true }),
      Animated.timing(shift, { toValue: 0, duration: 420, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, [index, opacity, shift]);
  return <Animated.View style={[{ opacity, transform: [{ translateY: shift }] }, style]}>{children}</Animated.View>;
}

/** Do cards ek line. Doosri line alag row hai, taake neeche wali card kat na jaye. */
export function KpiGrid({ children }: { children: ReactNode }) {
  const items = Children.toArray(children);
  const rows: ReactNode[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <View style={{ width: "100%" }}>
      {rows.map((row, index) => (
        <View key={index} style={{ width: "100%", flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          {row}
        </View>
      ))}
    </View>
  );
}

const ACTION_TINTS = ["#E8F7E8", "#FFF4D8", "#E8F2FF", "#F1EAFE", "#FFE9E7", "#E7F7F2"];
const ACTION_MARKS: Record<string, string> = {
  Wallet: "₨", Khata: "₨", Orders: "▣", Doodh: "♜", Dairy: "♜", Farms: "⌂", Crops: "♧",
  Vet: "+", Inputs: "▰", Machinery: "⚙", Livestock: "♞", Reports: "▤", Approvals: "✓",
  Branches: "⌂", Shops: "▦", Alerts: "!", Entry: "+", Kisan: "☺", Petrol: "◉", Meter: "◫",
  "Start Shift": "▶", "Opening Meter Photo": "▣", "Petrol Entry": "◉",
  Receive: "↓", Tanks: "▥", Tasks: "✓", Hazri: "◷", Recovery: "₨", POS: "▣", Profile: "◉",
};

export function ActionGrid({ title = "Quick Actions", actions }: { title?: string; actions: { label: string; key: string; onPress?: () => void }[] }) {
  return (
    <Rise index={2}>
      <View style={{ marginBottom: 12 }}>
        <Text style={{ color: glass.text, fontSize: 17, fontWeight: "900", marginBottom: 9 }}>{title}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
          {actions.map((action, index) => {
            const mark = ACTION_MARKS[action.label] || ACTION_MARKS[action.key] || "•";
            return (
              <Pressable key={`${action.key}-${index}`} onPress={action.onPress} style={{ width: "31.8%", minHeight: 86, borderRadius: 16, paddingHorizontal: 8, paddingVertical: 11, marginBottom: 8, backgroundColor: ACTION_TINTS[index % ACTION_TINTS.length], borderWidth: 1, borderColor: "rgba(20,105,57,0.07)", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#12753A", fontSize: 25, fontWeight: "900" }}>{mark}</Text>
                <Text style={{ color: glass.text, fontSize: 11, lineHeight: 14, fontWeight: "800", textAlign: "center", marginTop: 5 }} numberOfLines={2}>{action.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Rise>
  );
}

const LangContext = createContext<{ lang: AppLang; line: string; mark: string }>({ lang: "rm", line: "", mark: "" });

export function LanguageProvider({ lang, line = "", mark = "", children }: { lang: AppLang; line?: string; mark?: string; children: ReactNode }) {
  return <LangContext.Provider value={{ lang, line, mark }}>{children}</LangContext.Provider>;
}

export function useAppLang(): AppLang {
  return useContext(LangContext).lang;
}

export function BrandStack({ title, line, rtl, titleSize, lineSize }: { title: string; line: string; rtl: boolean; titleSize: number; lineSize: number }) {
  const align = rtl ? "right" : "left";
  const direction = rtl ? "rtl" : "ltr";
  return (
    <View>
      <Text style={{ color: glass.text, fontSize: titleSize, fontWeight: "800", textAlign: align, writingDirection: direction }}>{title}</Text>
      <Text style={{ color: glass.muted, fontSize: lineSize, marginTop: 2, textAlign: align, writingDirection: direction }}>{line}</Text>
    </View>
  );
}

export function BrandHeader({ role, name, onProfile }: { role: string; name: string; centre?: string; onProfile?: () => void; live?: LiveBag }) {
  const ctx = useContext(LangContext);
  const mark = ctx.mark.trim() || "AgriBridge";
  const line = ctx.line.trim();
  const initial = (name.trim().charAt(0) || role.charAt(0) || "A").toUpperCase();
  const roleTitle = /dashboard$/i.test(role) ? role : `${role} Dashboard`;
  return (
    <Rise index={0}>
      <View style={{ marginBottom: 12, backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: glass.line, shadowColor: "#17452E", shadowOpacity: 0.08, shadowRadius: 12, elevation: 3 }}>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ flex: 1, paddingRight: 10 }}>
            <View style={{ flexDirection: "row", alignItems: "baseline" }}>
              <Text style={{ color: "#0B5D35", fontSize: 21, fontWeight: "900" }} numberOfLines={1}>{mark}</Text>
              <Text style={{ color: glass.muted, fontSize: 10, marginLeft: 7 }}>{AGRIBRIDGE_OS_VERSION}</Text>
            </View>
            {line ? <Text style={{ color: "#0B5D35", fontSize: 11, marginTop: 1 }} numberOfLines={1}>{line}</Text> : null}
          </View>
          <Text style={{ color: "#0B5D35", fontSize: 20, marginRight: 12 }}>♧</Text>
          <Pressable onPress={onProfile} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#176B3A", alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: "#E7F3E7" }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 18 }}>{initial}</Text>
          </Pressable>
        </View>
        <Text style={{ color: glass.text, fontSize: 24, lineHeight: 30, fontWeight: "900", marginTop: 12 }} numberOfLines={2}>{roleTitle}</Text>
        <Text style={{ color: glass.muted, fontSize: 14, marginTop: 2 }} numberOfLines={1}>Assalam o Alaikum{name ? `, ${name}` : ""}</Text>
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

export function useFace(live?: LiveBag, role?: string): { name: string; place: string } {
  const auth = liveAuth(live);
  const [name, setName] = useState("");
  const [place, setPlace] = useState("");
  useEffect(() => {
    if (!auth?.userId) return;
    const id = encodeURIComponent(auth.userId);
    const key = roleNameKey(role);
    void (async () => {
      const [rows, notes] = await Promise.all([
        liveGet<{ full_name?: string | null }>(auth, `profiles?select=full_name&id=eq.${id}&limit=1`, fetch),
        live?.testAccount && key ? loadPhoneNotes(auth, fetch) : Promise.resolve(null),
      ]);
      const demo = notes?.ok ? notes.rows.find((row) => row.key === key)?.label : "";
      const full = rows.ok ? rows.rows[0]?.full_name || "" : "";
      setName(greetingName(demo || full));
    })();
    void liveGetScoped<{ village?: string | null; tehsil?: string | null; district?: string | null }>(auth, `farmers?select=village,tehsil,district&user_id=eq.${id}&limit=1`, fetch).then(async (rows) => {
      const row = rows.ok ? rows.rows[0] : null;
      let place = usablePlace(row?.village) || usablePlace(row?.tehsil) || usablePlace(row?.district);
      if (!place) {
        const list = await liveGetScoped<{ village?: string | null; tehsil?: string | null; district?: string | null }>(auth, "farmers?select=village,tehsil,district&limit=40", fetch);
        place = list.ok ? preferVillage(list.rows) : "";
      }
      setPlace(place);
    });
  }, [auth?.token, auth?.userId, auth?.url, auth?.testAccount, role]);
  return { name, place };
}

let cachedWeather: WeatherView | null = null;

const NO_PLACE: WeatherView = { place: "—", temp: "—", condition: "Mausam", humidity: "—", wind: "—", when: "", note: "Shehar record mein nahi. Mausam nahi dikhaya." };

async function fetchWeather(place: string): Promise<WeatherView | null> {
  const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(place)}&count=5&language=en&format=json`);
  const geo = await geoRes.json() as { results?: { latitude: number; longitude: number; name: string; country_code?: string; country?: string }[] };
  const hit = pickPakistan(geo.results);
  if (!hit) return null;
  const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${hit.latitude}&longitude=${hit.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code&wind_speed_unit=kmh&timezone=Asia%2FKarachi`);
  const data = await res.json() as { current?: { temperature_2m?: number; relative_humidity_2m?: number; wind_speed_10m?: number; weather_code?: number } };
  const current = data.current;
  if (!current || current.temperature_2m == null) return null;
  const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Karachi", weekday: "short", day: "numeric", month: "short" }).format(new Date());
  return {
    place: shortPlace(place, hit.name),
    temp: `${Math.round(current.temperature_2m)}°C`,
    condition: WMO[current.weather_code ?? -1] || "Mausam",
    humidity: current.relative_humidity_2m == null ? "—" : `${Math.round(current.relative_humidity_2m)}%`,
    wind: current.wind_speed_10m == null ? "—" : `${Math.round(current.wind_speed_10m)} km/h`,
    when,
    note: null,
  };
}

export function useWeather(place: string): WeatherView | null {
  const [view, setView] = useState<WeatherView | null>(cachedWeather);
  useEffect(() => {
    let stop = false;
    void (async () => {
      if (!place.trim()) {
        if (!stop) setView(cachedWeather ?? NO_PLACE);
        return;
      }
      try {
        const next = await fetchWeather(place);
        if (stop) return;
        if (next) {
          cachedWeather = next;
          setView(next);
          return;
        }
        setView(cachedWeather ?? { place, temp: "—", condition: "Mausam", humidity: "—", wind: "—", when: "", note: "Is shehar ka mausam nahi mila." });
      } catch {
        if (!stop) setView(cachedWeather ?? { place, temp: "—", condition: "Mausam", humidity: "—", wind: "—", when: "", note: "Mausam network par nahi aaya." });
      }
    })();
    return () => { stop = true; };
  }, [place]);
  return view;
}

function weatherGlyph(condition: string | undefined): string {
  const name = condition || "";
  if (/barish|toofan/i.test(name)) return "M6 14a6 6 0 0 1 12 0 M8 18v2 M12 18v3 M16 18v2";
  if (/badal|dhund/i.test(name)) return "M7 16a4 4 0 0 1 1-8 5 5 0 0 1 9 1 3 3 0 0 1 1 7z";
  return "M12 7a5 5 0 1 0 .1 0 M12 2v2 M12 20v2 M4 12H6 M18 12h2 M6 6l1.5 1.5 M16.5 16.5L18 18 M18 6l-1.5 1.5 M7.5 16.5L6 18";
}

export function WeatherCard({ weather, index = 1 }: { weather: WeatherView | null; index?: number }) {
  return (
    <Rise index={index}>
      <View style={{ backgroundColor: "rgba(10, 62, 42, 0.82)", borderRadius: 18, paddingVertical: 14, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: "rgba(61,220,151,0.28)" }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: "rgba(244,247,244,0.82)", fontSize: 13 }} numberOfLines={1}>{weather?.place || "—"}</Text>
            <Text style={{ color: glass.text, fontSize: 34, lineHeight: 40, fontWeight: "800", marginTop: 2 }}>{weather?.temp || "—"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
              <Svg width={16} height={16} viewBox="0 0 24 24">
                <Path d={weatherGlyph(weather?.condition)} stroke="#F5B942" strokeWidth={1.7} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={{ color: glass.gold, fontSize: 14, marginLeft: 6 }} numberOfLines={1}>{weather?.condition || "Mausam"}</Text>
            </View>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={{ color: "rgba(244,247,244,0.86)", fontSize: 13 }}>{weather?.humidity || "—"}</Text>
            <Text style={{ color: "rgba(244,247,244,0.86)", fontSize: 13, marginTop: 4 }}>{weather?.wind || "—"}</Text>
            <Text style={{ color: glass.muted, fontSize: 12, marginTop: 8 }}>{weather?.when || ""}</Text>
          </View>
        </View>
        {weather?.note ? <Text style={{ color: glass.muted, fontSize: 12, marginTop: 8 }}>{weather.note}</Text> : null}
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

export function BarChart({ values, labels, color, format }: { values: number[]; labels: string[]; color: string; format?: (value: number) => string }) {
  const max = Math.max(...values, 0);
  if (!values.length) return <Text style={{ color: glass.muted }}>Chart ke liye qatarein nahi.</Text>;
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", height: 156 }}>
      {values.map((value, index) => (
        <View key={`${labels[index]}-${index}`} style={{ flex: 1, alignItems: "center" }}>
          <Text style={{ color: glass.muted, fontSize: 11, marginBottom: 6 }} numberOfLines={1}>{value > 0 ? (format ? format(value) : (Number.isInteger(value) ? String(value) : value.toFixed(1))) : ""}</Text>
          <View style={{ width: "68%", maxWidth: 40, minWidth: 22, height: max > 0 ? Math.max(8, (value / max) * 96) : 8, borderRadius: 10, backgroundColor: color, opacity: value > 0 ? 1 : 0.25 }} />
          <Text style={{ color: glass.muted, fontSize: 11, marginTop: 6 }}>{labels[index]}</Text>
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
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(18,82,48,0.10)" strokeWidth={14} fill="none" />
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
          <View key={part.label} style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: part.color, marginRight: 8 }} />
            <Text style={{ color: glass.text, flex: 1 }}>{part.label} {total > 0 ? `${Math.round((part.value / total) * 100)}%` : ""}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export function Pct({ value }: { value: number | null }) {
  if (value == null || value === 0 || Math.abs(value) >= 90 || Math.abs(value) > 300) return null;
  const up = value > 0;
  const shown = `${Math.abs(value)}%`;
  return (
    <View style={{ backgroundColor: up ? "rgba(61,220,151,0.15)" : "rgba(255,107,107,0.15)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: up ? glass.up : glass.down, fontSize: 11, fontWeight: "700" }}>{up ? "▲" : "▼"} {shown}</Text>
    </View>
  );
}

function CountBadge({ value }: { value: number | null }) {
  if (value == null || value === 0) return null;
  const up = value > 0;
  return (
    <View style={{ backgroundColor: up ? "rgba(61,220,151,0.15)" : "rgba(255,107,107,0.15)", borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 }}>
      <Text style={{ color: up ? glass.up : glass.down, fontSize: 11, fontWeight: "700" }}>{up ? "▲" : "▼"} {Math.abs(value)}</Text>
    </View>
  );
}

export function TankTemp({ celsius, status }: { celsius: number | null; status?: string | null }) {
  const note = (status || "").trim();
  const text = celsius == null ? "—" : `${celsius}°C${note ? ` ${note}` : ""}`;
  return <Text style={{ color: celsius == null ? glass.muted : glass.up, fontSize: 12, fontWeight: "700" }}>{text}</Text>;
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

function glyphFor(label: string): string {
  if (GLYPH[label]) return GLYPH[label];
  const key = Object.keys(GLYPH).sort((a, b) => b.length - a.length).find((item) => label.startsWith(item));
  return (key && GLYPH[key]) || "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0";
}

export function Kpi({ label, value, sub, color, series, pct, index, badge = "pct" }: { label: string; value: string; sub?: string; color: string; series: number[]; pct: number | null; index: number; badge?: "pct" | "count" }) {
  const clean = series.filter((point) => Number.isFinite(point));
  const line = clean.length >= 2 ? clean : clean.length === 1 ? [clean[0], clean[0]] : [];
  const change = badge === "count" ? null : pct != null ? pct : line.length >= 2 ? pctChange(line[line.length - 1], line[line.length - 2]) : null;
  const delta = badge === "count" ? countDelta(line) : null;
  return (
    <Rise index={index} style={{ width: "48%", maxWidth: "48%", flexBasis: "48%", flexGrow: 0, flexShrink: 0 }}>
      <View style={{ width: "100%", backgroundColor: glass.card, borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: glass.line, shadowColor: "#123E28", shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View style={{ width: 34, height: 34, borderRadius: 12, backgroundColor: `${color}22`, alignItems: "center", justifyContent: "center" }}>
            <Svg width={16} height={16} viewBox="0 0 24 24">
              <Path d={glyphFor(label)} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
          {badge === "count" ? <CountBadge value={delta} /> : <Pct value={change} />}
        </View>
        <Text style={{ color: glass.muted, marginTop: 10, fontSize: 12, lineHeight: 16 }} numberOfLines={2}>{label}</Text>
        <Text style={{ color: glass.text, fontSize: 20, fontWeight: "800", marginTop: 2, lineHeight: 24 }} numberOfLines={1}>{value}</Text>
        {sub ? <Text style={{ color: glass.muted, fontSize: 11, lineHeight: 14 }}>{sub}</Text> : null}
        <Spark values={line} color={color} />
      </View>
    </Rise>
  );
}

export function GlassCard({ title, sub, badge, aside, children, index = 2 }: { title: string; sub?: string; badge?: string | null; aside?: ReactNode; children: ReactNode; index?: number }) {
  return (
    <Rise index={index}>
      <View style={{ backgroundColor: glass.card, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: glass.line, shadowColor: "#123E28", shadowOpacity: 0.055, shadowRadius: 10, elevation: 2 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Text style={{ color: glass.text, fontWeight: "800", flex: 1 }}>{title}</Text>
          {aside}
          {badge ? <Pill label={badge} tone="blue" /> : null}
          {sub ? <Text style={{ color: glass.muted, fontSize: 12, marginLeft: 8 }}>{sub}</Text> : null}
        </View>
        {children}
      </View>
    </Rise>
  );
}

export function Pill({ label, tone, mark }: { label: string; tone: "green" | "orange" | "red" | "blue"; mark?: "dot" | "check" | "bang" }) {
  const color = tone === "green" ? glass.up : tone === "orange" ? glass.orange : tone === "red" ? glass.down : glass.blue;
  const glyph = mark === "check" ? "✓ " : mark === "bang" ? "! " : mark === "dot" ? "● " : "";
  return (
    <View style={{ borderRadius: 14, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: `${color}12`, borderWidth: 1, borderColor: `${color}55` }}>
      <Text style={{ color, fontWeight: "700", fontSize: 12 }}>{glyph}{label}</Text>
    </View>
  );
}

function StepMark({ state }: { state: TimelineStep["state"] }) {
  if (state === "done") {
    return <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: glass.up, alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#07140F", fontSize: 12, fontWeight: "800" }}>✓</Text></View>;
  }
  if (state === "active") {
    return (
      <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: glass.blue, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: glass.blue }} />
      </View>
    );
  }
  if (state === "action") {
    return <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: "#FF5A5A", alignItems: "center", justifyContent: "center" }}><Text style={{ color: "#fff", fontSize: 13, fontWeight: "800" }}>!</Text></View>;
  }
  return <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: "rgba(18,82,48,0.22)" }} />;
}

function trackPill(steps: TimelineStep[]): { label: string; tone: "green" | "orange" | "red" | "blue"; mark: "dot" | "check" | "bang" } | null {
  if (steps.some((step) => step.state === "action")) return { label: "Action chahiye", tone: "red", mark: "bang" };
  if (timelineFinished(steps)) return { label: "Mukammal", tone: "green", mark: "check" };
  const active = steps.find((step) => step.state === "active");
  if (active) return { label: active.label, tone: "blue", mark: "dot" };
  return null;
}

export function Timeline({ title, detail, steps, onAction, showProgress = false, progressNote, index = 4 }: {
  title: string;
  detail?: string | null;
  steps: TimelineStep[];
  onAction?: () => void;
  showProgress?: boolean;
  progressNote?: string | null;
  index?: number;
}) {
  const pill = trackPill(steps);
  const percent = timelinePercent(steps);
  const border = steps.some((step) => step.state === "action")
    ? "rgba(255,90,90,0.95)"
    : timelineFinished(steps)
      ? "rgba(61,220,151,0.9)"
      : steps.some((step) => step.state === "active" || step.state === "done")
        ? "rgba(91,140,255,0.55)"
        : "rgba(18,82,48,0.18)";
  return (
    <Rise index={index}>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF5A7A", marginRight: 6 }} />
        <Text style={{ color: glass.text, fontWeight: "700" }}>Live tracking</Text>
      </View>
      <View style={{ backgroundColor: glass.card, borderRadius: 18, padding: 14, marginBottom: 12, borderWidth: 1.5, borderColor: border }}>
        <View style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 12 }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Text style={{ color: glass.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
            {detail ? <Text style={{ color: glass.muted, marginTop: 2 }}>{detail}</Text> : null}
          </View>
          {pill ? <Pill label={pill.label} tone={pill.tone} mark={pill.mark} /> : null}
        </View>
        {steps.map((step, stepIndex) => {
          const time = step.time || (step.state === "active" ? "Abhi" : step.state === "pending" || step.state === "done" || step.state === "action" ? "—" : "");
          const line = step.state === "done" ? glass.up : "rgba(18,82,48,0.16)";
          return (
            <View key={`${step.label}-${stepIndex}`} style={{ flexDirection: "row", alignItems: "stretch" }}>
              <View style={{ width: 28, alignItems: "center" }}>
                <StepMark state={step.state} />
                {stepIndex < steps.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: line, marginVertical: 2 }} /> : null}
              </View>
              <View style={{ flex: 1, paddingBottom: stepIndex < steps.length - 1 ? 12 : 0, marginLeft: 8 }}>
                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ color: step.state === "pending" ? glass.muted : glass.text, fontWeight: "800" }}>{step.label}</Text>
                    {step.detail ? <Text style={{ color: glass.muted, fontSize: 12, marginTop: 1 }}>{step.detail}</Text> : null}
                  </View>
                  <Text style={{ color: glass.muted, fontSize: 12 }}>{time}</Text>
                </View>
                {step.state === "action" ? (
                  <Pressable onPress={onAction} style={{ marginTop: 8, alignSelf: "flex-start", backgroundColor: "#FF4B4B", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 8 }}>
                    <Text style={{ color: "#fff", fontWeight: "800" }}>{step.actionLabel || "Action chahiye"}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          );
        })}
        {showProgress ? (
          <View style={{ marginTop: 14 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
              <Text style={{ color: glass.muted, fontSize: 12 }}>{progressNote ? `🚚  ${progressNote}` : ""}</Text>
              <Text style={{ color: glass.muted, fontSize: 12 }}>{percent}%</Text>
            </View>
            <View style={{ height: 6, borderRadius: 3, backgroundColor: "rgba(18,82,48,0.10)" }}>
              <View style={{ width: `${percent}%`, height: 6, borderRadius: 3, backgroundColor: glass.up }} />
            </View>
          </View>
        ) : null}
      </View>
    </Rise>
  );
}

function ChargeBit({ x, delay, color }: { x: number; delay: number; color: string }) {
  const rise = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(rise, { toValue: -64, duration: 1500, useNativeDriver: true }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.75, duration: 280, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0, duration: 1220, useNativeDriver: true }),
          ]),
        ]),
        Animated.timing(rise, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity, rise]);
  return (
    <Animated.View
      style={{
        position: "absolute",
        left: x,
        bottom: 28,
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY: rise }],
      }}
    />
  );
}

/** Glowing ring. pct null = beech mein dash. Number 0 se count hota hai. */
export function RingMeter({ pct, label, size = 168 }: { pct: number | null; label: string; size?: number }) {
  const gid = `ring${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const stroke = 12;
  const r = (size - stroke * 3) / 2;
  const c = 2 * Math.PI * r;
  const [offset, setOffset] = useState(c);
  const [shown, setShown] = useState(pct == null ? "—" : "0%");
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (pct == null || !Number.isFinite(pct)) {
      setShown("—");
      setOffset(c);
      return;
    }
    setShown("0%");
    progress.setValue(0);
    const to = Math.max(0, Math.min(100, pct)) / 100;
    const anim = Animated.timing(progress, { toValue: to, duration: 1100, useNativeDriver: false });
    const sub = progress.addListener(({ value }) => {
      const current = Math.round(value * 100);
      setShown(`${current}%`);
      setOffset(ringDashOffset(c, current));
    });
    anim.start();
    return () => {
      anim.stop();
      progress.removeListener(sub);
    };
  }, [c, pct, progress]);
  const bits = [0.18, 0.34, 0.5, 0.66, 0.82].map((part) => Math.round(part * (size - 20)));
  return (
    <View style={{ alignItems: "center", paddingVertical: 6 }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Defs>
            <LinearGradient id={gid} x1="0" y1="1" x2="1" y2="0">
              <Stop offset="0" stopColor="#C4B5FD" />
              <Stop offset="0.48" stopColor="#F472B6" />
              <Stop offset="1" stopColor="#3DDC97" />
            </LinearGradient>
          </Defs>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#C4B5FD" strokeWidth={22} fill="none" opacity={0.16} />
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(18,82,48,0.10)" strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c} ${c}`}
            strokeDashoffset={offset}
            rotation={-90}
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0, alignItems: "center", justifyContent: "center" }}>
          <Text style={{ color: glass.text, fontSize: size > 140 ? 40 : 28, fontWeight: "800" }}>{shown}</Text>
          {label ? <Text style={{ color: glass.muted, fontSize: 12, marginTop: 2 }}>{label}</Text> : null}
        </View>
        {bits.map((x, index) => (
          <ChargeBit key={x} x={x} delay={index * 220} color={index % 2 === 0 ? "#F472B6" : "#3DDC97"} />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, value, mark }: { label: string; value: string; mark: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F5F8F4", borderRadius: 14, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: glass.line }}>
      <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: "rgba(196,181,253,0.22)", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: glass.text, fontWeight: "800" }}>{mark}</Text>
      </View>
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={{ color: glass.muted, fontSize: 11 }}>{label}</Text>
        <Text style={{ color: glass.text, fontWeight: "800" }}>{value}</Text>
      </View>
    </View>
  );
}

/** Goal card. % aur Target/Baqi sirf jab number diye jayen. */
export function GoalCard({ title, subtitle, tone = "purple", pct, targetText, remainingText, deadline, onPress }: {
  title: string;
  subtitle: string;
  tone?: "purple" | "green";
  pct: number | null;
  targetText: string;
  remainingText: string;
  deadline: string;
  onPress?: () => void;
}) {
  const gid = `goal${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const bid = `goalBtn${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [width, setWidth] = useState(0);
  const [pressed, setPressed] = useState(false);
  const from = tone === "green" ? "#146B3A" : "#6D28D9";
  const to = tone === "green" ? "#3DDC97" : "#5B8CFF";
  return (
    <Rise index={6}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ borderRadius: 18, overflow: "hidden", backgroundColor: glass.card, borderWidth: 1, borderColor: glass.line, marginBottom: 12 }}>
        <View style={{ height: 72 }}>
          {width > 0 ? (
            <Svg width={width} height={72}>
              <Defs>
                <LinearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor={from} />
                  <Stop offset="1" stopColor={to} />
                </LinearGradient>
              </Defs>
              <Rect width={width} height={72} fill={`url(#${gid})`} />
            </Svg>
          ) : <View style={{ height: 72, backgroundColor: from }} />}
          <View style={{ position: "absolute", left: 14, right: 14, top: 0, bottom: 0, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
              <Text style={{ color: "#fff", fontWeight: "800" }}>◎</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{title}</Text>
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 2 }}>{subtitle}</Text>
            </View>
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 8 }}>
          <RingMeter pct={pct} label="" size={128} />
          <View style={{ flex: 1, paddingRight: 8 }}>
            <Chip label="Target" value={targetText} mark="T" />
            <Chip label="Baqi" value={remainingText} mark="B" />
          </View>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16 }}>
          <Text style={{ color: glass.muted, marginRight: 6 }}>▦</Text>
          <Text style={{ color: glass.muted }}>{deadline}</Text>
        </View>
        <Pressable
          onPress={onPress}
          onPressIn={() => setPressed(true)}
          onPressOut={() => setPressed(false)}
          style={{
            margin: 14,
            borderRadius: 14,
            transform: [{ translateY: pressed ? -3 : 0 }],
            shadowColor: from,
            shadowOffset: { width: 0, height: pressed ? 10 : 2 },
            shadowOpacity: pressed ? 0.55 : 0.22,
            shadowRadius: pressed ? 14 : 4,
            elevation: pressed ? 10 : 3,
          }}
        >
          <View style={{ height: 44, borderRadius: 14, overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {width > 28 ? (
              <Svg width={width - 28} height={44} style={{ position: "absolute", left: 0, top: 0 }}>
                <Defs>
                  <LinearGradient id={bid} x1="0" y1="0" x2="1" y2="0">
                    <Stop offset="0" stopColor={from} />
                    <Stop offset="1" stopColor={to} />
                  </LinearGradient>
                </Defs>
                <Rect width={width - 28} height={44} rx={14} fill={`url(#${bid})`} />
              </Svg>
            ) : null}
            <Text style={{ color: "#fff", fontWeight: "800" }}>Tafseel dekhein</Text>
          </View>
        </Pressable>
      </View>
    </Rise>
  );
}

const TANK_COLOR = ["#3DDC97", "#5B8CFF", "#F5B942", "#C4B5FD"];

export function TankRow({ levels }: { levels: { name: string; pct: number | null }[] }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      {levels.map((tank, index) => (
        <View key={tank.name} style={{ alignItems: "center", width: 64 }}>
          <View style={{ width: 36, height: 84, borderRadius: 18, borderWidth: 2, borderColor: TANK_COLOR[index % TANK_COLOR.length], overflow: "hidden", justifyContent: "flex-end", backgroundColor: "rgba(18,82,48,0.04)" }}>
            {tank.pct != null ? <View style={{ height: `${Math.max(0, Math.min(100, tank.pct))}%`, backgroundColor: TANK_COLOR[index % TANK_COLOR.length] }} /> : null}
          </View>
          <Text style={{ color: glass.text, marginTop: 6, fontWeight: "700" }}>{tank.pct == null ? "—" : `${Math.round(tank.pct)}%`}</Text>
          <Text style={{ color: glass.muted, fontSize: 11 }}>{tank.name}</Text>
        </View>
      ))}
    </View>
  );
}

export function BarTrack({ label, value, max, color, unit }: { label: string; value: number | null; max: number | null; color: string; unit?: string | null }) {
  const width = value != null && max != null && max > 0 ? Math.max(6, Math.min(100, (value / max) * 100)) : 0;
  const unitText = (unit || "").trim();
  const amount = value == null ? "—" : `${Number.isInteger(value) ? String(value) : String(Math.round(value))}${unitText ? ` ${unitText}` : ""}`;
  return (
    <View style={{ marginBottom: 8 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: glass.text, flex: 1, paddingRight: 8 }}>{label}</Text>
        <Text style={{ color: glass.muted }}>{amount}</Text>
      </View>
      <View style={{ height: 12, borderRadius: 6, backgroundColor: "rgba(18,82,48,0.08)", marginTop: 6 }}>
        <View style={{ width: `${width}%`, height: 12, borderRadius: 6, backgroundColor: color }} />
      </View>
    </View>
  );
}
