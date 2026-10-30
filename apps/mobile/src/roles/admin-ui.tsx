import { useState, type ReactNode } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { greetingName } from "../../../../src/lib/mobile/display-name";
import { agoLabel, approvalHeadline, categoryLabel, roleTitle, rupeeLabel, type ApprovalFilter, type DeskStep, type InboxItem } from "../../../../src/lib/mobile/admin-desk";
import { AGRIBRIDGE_OS_VERSION } from "../../../../src/lib/app-version";
import { glass } from "../glass";
import { VisionCard } from "./vision-card";

const green = "#0E7A3C";
const greenDeep = "#0C5C34";
const page = "#F5F7F5";
const red = "#E11D48";
const ink = "#10271D";

export type HomeCard = {
  key: string;
  title: string;
  value: string;
  sub: string;
  alert?: boolean;
  icon: GlyphName;
};

type GlyphName = "clip" | "cart" | "bell" | "alert" | "milk" | "farmer" | "people" | "headset" | "leaf" | "sprout" | "cal" | "shield" | "pin" | "phone" | "mail" | "check" | "bag" | "gear" | "building" | "user" | "menu" | "filter" | "clock" | "lock" | "power" | "swap" | "bridge" | "android" | "pencil";

function Glyph({ name, color, size = 22 }: { name: GlyphName; color: string; size?: number }) {
  const props = { width: size, height: size, viewBox: "0 0 24 24", fill: "none" as const };
  if (name === "clip") return <Svg {...props}><Rect x="6" y="3.5" width="12" height="17" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M9 3.5h6v2.2H9zM8.5 12.2l2.2 2.2 4.2-4.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (name === "cart") return <Svg {...props}><Path d="M4 6h2l2 10h10l2-7H8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><Circle cx="10" cy="19" r="1.4" fill={color} /><Circle cx="17" cy="19" r="1.4" fill={color} /></Svg>;
  if (name === "bell") return <Svg {...props}><Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "alert") return <Svg {...props}><Path d="M12 4l8 14H4L12 4z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M12 10v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" /><Circle cx="12" cy="16.5" r="0.9" fill={color} /></Svg>;
  if (name === "milk") return <Svg {...props}><Path d="M8 3h8l-1 3v12a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3V6L8 3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M9 10h6" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "farmer") return <Svg {...props}><Circle cx="12" cy="9" r="3" stroke={color} strokeWidth="1.7" /><Path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19" stroke={color} strokeWidth="1.7" strokeLinecap="round" /><Path d="M8 7.5c.4-2 1.8-3.2 4-3.2s3.6 1.2 4 3.2" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "people") return <Svg {...props}><Circle cx="9" cy="9" r="2.4" stroke={color} strokeWidth="1.7" /><Circle cx="16" cy="10" r="2" stroke={color} strokeWidth="1.7" /><Path d="M4.5 18c.8-2.4 2.6-3.6 4.5-3.6s3.7 1.2 4.5 3.6M14 14.6c1.3-.4 2.6-.2 3.8.8 1 1.2 1.4 2.6 1.7 3.6" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "headset") return <Svg {...props}><Path d="M5 13a7 7 0 0 1 14 0" stroke={color} strokeWidth="1.7" /><Rect x="4" y="13" width="3.5" height="6" rx="1.2" stroke={color} strokeWidth="1.7" /><Rect x="16.5" y="13" width="3.5" height="6" rx="1.2" stroke={color} strokeWidth="1.7" /><Path d="M12 20h3" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "leaf" || name === "sprout") return <Svg {...props}><Path d="M12 21V10" stroke={color} strokeWidth="1.7" strokeLinecap="round" /><Path d="M12 13c0-4 3.2-6.2 7-6.2-1 4.2-4 6.2-7 6.2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M12 16c0-3.2-2.6-5.2-6.2-5.2 1 3.6 3.6 5.2 6.2 5.2z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /></Svg>;
  if (name === "cal") return <Svg {...props}><Rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 3v4M16 3v4M4 10h16" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "shield") return <Svg {...props}><Path d="M12 3l7 3v6c0 4.5-3 7-7 9-4-2-7-4.5-7-9V6l7-3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "pin") return <Svg {...props}><Path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" stroke={color} strokeWidth="1.7" /><Circle cx="12" cy="11" r="2" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "phone") return <Svg {...props}><Path d="M8 3.5h2.6l1.2 2.8-1.8 1.1a11 11 0 0 0 5.1 5.1l1.1-1.8 2.8 1.2V15a2 2 0 0 1-2.2 2A14.2 14.2 0 0 1 6 6.2 2 2 0 0 1 8 3.5z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" /></Svg>;
  if (name === "mail") return <Svg {...props}><Rect x="3" y="6" width="18" height="12" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M4 7l8 6 8-6" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /></Svg>;
  if (name === "bag") return <Svg {...props}><Rect x="4" y="7" width="16" height="13" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 7V6a4 4 0 0 1 8 0v1" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "gear") return <Svg {...props}><Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7" /><Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "building") return <Svg {...props}><Rect x="4" y="4" width="16" height="16" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 20v-4h8v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "user") return <Svg {...props}><Circle cx="12" cy="8" r="3.2" stroke={color} strokeWidth="1.7" /><Path d="M5 19c1.2-3.2 3.4-4.8 7-4.8s5.8 1.6 7 4.8" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "menu") return <Svg {...props}><Path d="M4 7h16M4 12h16M4 17h16" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></Svg>;
  if (name === "filter") return <Svg {...props}><Path d="M4 6h16M7 12h10M10 18h4" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></Svg>;
  if (name === "clock") return <Svg {...props}><Circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.7" /><Path d="M12 8v4.5l3 2" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "lock") return <Svg {...props}><Rect x="6" y="11" width="12" height="9" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 11V8a4 4 0 0 1 8 0v3" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "power") return <Svg {...props}><Path d="M12 3v7" stroke={color} strokeWidth="1.8" strokeLinecap="round" /><Path d="M7.2 6.2a7 7 0 1 0 9.6 0" stroke={color} strokeWidth="1.8" strokeLinecap="round" /></Svg>;
  if (name === "swap") return <Svg {...props}><Path d="M20 12a8 8 0 0 0-13.7-5.6L4 8" stroke={color} strokeWidth="1.7" strokeLinecap="round" /><Path d="M4 4v4h4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><Path d="M4 12a8 8 0 0 0 13.7 5.6L20 16" stroke={color} strokeWidth="1.7" strokeLinecap="round" /><Path d="M20 20v-4h-4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (name === "bridge") return <Svg {...props}><Path d="M4 17V11a8 8 0 0 1 16 0v6" stroke={color} strokeWidth="1.8" strokeLinecap="round" /><Path d="M4 17h16M12 11v6" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "android") return <Svg {...props}><Rect x="7" y="8" width="10" height="8" rx="2" stroke={color} strokeWidth="1.6" /><Path d="M9.5 8 8 5.2M14.5 8 16 5.2M8 18v2M16 18v2M4 12H2.5M21.5 12H20" stroke={color} strokeWidth="1.6" strokeLinecap="round" /><Circle cx="10" cy="11.5" r="0.8" fill={color} /><Circle cx="14" cy="11.5" r="0.8" fill={color} /></Svg>;
  if (name === "pencil") return <Svg {...props}><Path d="M14 5l5 5L8 21H3v-5L14 5z" stroke={color} strokeWidth="1.6" strokeLinejoin="round" /><Path d="M12 7l5 5" stroke={color} strokeWidth="1.6" /></Svg>;
  return <Svg {...props}><Path d="M5 12l5 5L20 7" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
}

const cardFace = {
  backgroundColor: "#fff",
  borderRadius: 16,
  borderWidth: 1,
  borderColor: "#E6EEE8",
  shadowColor: "#143024",
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 2 },
  elevation: 1,
} as const;

function Screen({ children, refreshing, onRefresh, header }: { children: ReactNode; refreshing?: boolean; onRefresh?: () => void; header?: ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: page }}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: header ? 14 : 8, paddingBottom: 110 }}
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing === true} onRefresh={onRefresh} tintColor={green} /> : undefined}
      >
        {children}
      </ScrollView>
    </View>
  );
}

function IconBubble({ name, alert }: { name: GlyphName; alert?: boolean }) {
  return (
    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: alert ? "#FDECEC" : "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
      <Glyph name={name} color={alert ? red : green} size={20} />
    </View>
  );
}

export function AdminHomeView({
  fullName,
  role,
  photoUrl,
  cards,
  banner,
  refreshing,
  onRefresh,
  onOpen,
  testBuild,
  onRole,
}: {
  fullName: string;
  role: string;
  photoUrl: string | null;
  cards: HomeCard[];
  banner?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpen: (key: string) => void;
  testBuild?: boolean;
  onRole?: () => void;
}) {
  const short = greetingName(fullName) || fullName;
  const initial = (fullName.trim().charAt(0) || "A").toUpperCase();
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ marginHorizontal: -16, marginTop: -8, paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8, flexDirection: "row", alignItems: "center" }}>
        {testBuild ? (
          <View style={{ flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: green, borderRadius: 16, paddingLeft: 10, paddingRight: 8, paddingVertical: 4 }}>
            <Text style={{ color: green, fontWeight: "800", fontSize: 12, letterSpacing: 0.4 }}>TEST</Text>
            <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: green, marginLeft: 6 }} />
          </View>
        ) : <View />}
        <View style={{ flex: 1 }} />
        <Text style={{ color: ink, fontWeight: "700", fontSize: 15, marginRight: onRole ? 8 : 0 }}>{roleTitle(role)}</Text>
        {onRole ? (
          <Pressable onPress={onRole} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "#D5E0D8", borderRadius: 18, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text style={{ color: ink, fontWeight: "700", fontSize: 13 }}>Role badlo</Text>
            <View style={{ marginLeft: 6 }}>
              <Glyph name="user" color={ink} size={16} />
            </View>
          </Pressable>
        ) : null}
      </View>
      <View style={{ backgroundColor: greenDeep, borderRadius: 22, padding: 16, marginBottom: 18, overflow: "hidden" }}>
        <Svg style={{ position: "absolute", right: -8, bottom: -16 }} width={170} height={120} viewBox="0 0 170 120" pointerEvents="none">
          <Path d="M20 100c20-40 50-62 90-70" stroke="rgba(255,255,255,0.08)" strokeWidth="1.4" fill="none" />
          <Path d="M48 110c16-28 40-46 78-54" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" fill="none" />
          <Circle cx="132" cy="28" r="26" fill="rgba(255,255,255,0.04)" />
        </Svg>
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Glyph name="sprout" color="#D8F5C8" size={26} />
              <View style={{ marginLeft: 8 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Kisan Pakistan</Text>
                <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13, marginTop: 1 }}>AgriBridge</Text>
              </View>
            </View>
            <View style={{ width: 42, height: 3, borderRadius: 2, backgroundColor: "#E6C15A", marginTop: 14 }} />
          </View>
          <View style={{ width: 68, height: 68, borderRadius: 34, backgroundColor: "#176B3A", borderWidth: 2, borderColor: "rgba(255,255,255,0.7)", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: 68, height: 68 }} /> : <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{initial}</Text>}
          </View>
        </View>
        <View style={{ alignItems: "flex-end", marginTop: 16 }}>
          <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 13 }}>Assalam o Alaikum</Text>
          <Text style={{ color: "#fff", fontSize: 28, fontWeight: "800", marginTop: 2 }}>{short || " "}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600", marginRight: 4 }}>{roleTitle(role)}</Text>
            <Glyph name="shield" color="#B7F0C8" size={16} />
          </View>
        </View>
      </View>
      <VisionCard role={role} />
      {banner ? <Text style={{ color: "#8A5A00", marginBottom: 8 }}>{banner}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Text style={{ flex: 1, color: ink, fontSize: 20, fontWeight: "800" }}>Today overview</Text>
        <Glyph name="cal" color={green} size={22} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {cards.map((card) => (
          <Pressable key={card.key} onPress={() => onOpen(card.key)} style={{ width: "48.5%", padding: 14, marginBottom: 12, minHeight: 124, ...cardFace }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <IconBubble name={card.icon} alert={card.alert} />
              <Text style={{ flex: 1, marginLeft: 8, color: ink, fontWeight: "700", fontSize: 13 }} numberOfLines={1}>{card.title}</Text>
              <Text style={{ color: "#B7C2BB", fontSize: 18 }}>›</Text>
            </View>
            <Text style={{ color: ink, fontSize: 26, fontWeight: "800", marginTop: 10 }}>{card.value}</Text>
            <Text style={{ color: card.alert ? red : green, fontWeight: "700", fontSize: 13, marginTop: 2 }}>{card.sub}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const FILTERS: { key: ApprovalFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "doodh", label: "Doodh" },
  { key: "purchase", label: "Purchase" },
  { key: "leave", label: "Leave" },
];

function bucketIcon(category: string): GlyphName {
  if (category === "milk_verify") return "milk";
  if (category === "purchases") return "cart";
  if (category === "leave") return "cal";
  return "clip";
}

export function AdminInboxView({
  items,
  filter,
  mineOnly,
  note,
  refreshing,
  onRefresh,
  onFilter,
  onMine,
  onOpen,
  onMenu,
  onAlerts,
}: {
  items: InboxItem[];
  filter: ApprovalFilter;
  mineOnly: boolean;
  note: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onFilter: (filter: ApprovalFilter) => void;
  onMine: () => void;
  onOpen: (item: InboxItem) => void;
  onMenu?: () => void;
  onAlerts?: () => void;
}) {
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={onRefresh}
      header={(
        <View style={{ backgroundColor: greenDeep, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 18, borderBottomLeftRadius: 26, borderBottomRightRadius: 26 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Pressable onPress={onMenu} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Glyph name="menu" color="#fff" />
            </Pressable>
            <View style={{ flex: 1, alignItems: "center" }}>
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800" }}>Approvals</Text>
              <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 12, marginTop: 2 }}>Review and manage pending requests</Text>
            </View>
            <Pressable onPress={onAlerts} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
              <Glyph name="bell" color="#fff" />
              {items.length > 0 ? <View style={{ position: "absolute", top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: "#3DDC97", borderWidth: 1, borderColor: greenDeep }} /> : null}
            </Pressable>
          </View>
        </View>
      )}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 1, flexShrink: 1, height: 40 }} contentContainerStyle={{ alignItems: "center", paddingRight: 8 }}>
          {FILTERS.map((chip) => {
            const on = filter === chip.key;
            return (
              <Pressable key={chip.key} onPress={() => onFilter(chip.key)} style={{ marginRight: 8, backgroundColor: on ? greenDeep : "#fff", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: on ? greenDeep : "#E1EAE3" }}>
                <Text style={{ color: on ? "#fff" : ink, fontWeight: "700" }}>{chip.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <Pressable onPress={onMine} style={{ flexDirection: "row", alignItems: "center", marginLeft: 4, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 16, backgroundColor: mineOnly ? "#F8E7A0" : "transparent" }}>
          <Glyph name="filter" color={ink} size={16} />
          <Text style={{ color: ink, fontWeight: "700", marginLeft: 4 }}>Filter</Text>
        </Pressable>
      </View>
      <Text style={{ color: ink, fontSize: 18, fontWeight: "800" }}>Pending Approvals</Text>
      <Text style={{ color: glass.muted, marginBottom: 12, marginTop: 2 }}>Tap any request to view details</Text>
      {note ? <Text style={{ color: "#8A5A00", marginBottom: 8 }}>{note}</Text> : null}
      {items.length === 0 ? <Text style={{ color: glass.muted, marginBottom: 12 }}>{note ? "Fehrist adhoori hai." : "Koi pending approval nahi."}</Text> : null}
      {items.map((item) => {
        const when = agoLabel(item.createdAt);
        return (
          <Pressable key={`${item.category}-${item.itemId}`} onPress={() => onOpen(item)} style={{ ...cardFace, padding: 12, marginBottom: 10, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
              <Glyph name={bucketIcon(item.category)} color={green} />
            </View>
            <View style={{ flex: 1, marginLeft: 10, marginRight: 8 }}>
              <View style={{ alignSelf: "flex-start", backgroundColor: "#E7F6EC", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: green, fontSize: 11, fontWeight: "800" }}>{categoryLabel(item.category)}</Text>
              </View>
              <Text style={{ color: ink, fontWeight: "800", fontSize: 15, marginTop: 4 }} numberOfLines={1}>{approvalHeadline(item)}</Text>
              <Text style={{ color: ink, fontWeight: "700", marginTop: 1 }}>{item.category === "leave" || item.amount == null ? "—" : rupeeLabel(item.amount)}</Text>
              {when ? (
                <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
                  <Glyph name="clock" color={glass.muted} size={12} />
                  <Text style={{ color: glass.muted, fontSize: 12, marginLeft: 4 }}>{when}</Text>
                </View>
              ) : null}
            </View>
            <View style={{ backgroundColor: "#F8E7A0", borderRadius: 14, paddingHorizontal: 8, paddingVertical: 5, flexDirection: "row", alignItems: "center", flexShrink: 0 }}>
              <Glyph name="clock" color="#8A6A12" size={12} />
              <Text style={{ color: "#8A6A12", fontSize: 11, fontWeight: "800", marginLeft: 4 }}>Check baqi</Text>
            </View>
            <Text style={{ color: "#B7C2BB", fontSize: 20, marginLeft: 6 }}>›</Text>
          </Pressable>
        );
      })}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8, marginBottom: 12 }}>
        <Glyph name="check" color={green} size={16} />
        <Text style={{ color: glass.muted, marginLeft: 6, flex: 1, fontSize: 12 }}>All approvals are securely logged for audit and compliance.</Text>
      </View>
    </Screen>
  );
}

function stepLines(detail: string): { primary: string; extra: string | null } {
  const parts = detail.split(" · ");
  if (parts.length >= 2 && /\d{4}/.test(parts[parts.length - 1] || "")) {
    return { primary: parts[parts.length - 1], extra: parts.slice(0, -1).join(" · ") };
  }
  return { primary: detail, extra: null };
}

function StepMark({ state, size = 22 }: { state: DeskStep["state"]; size?: number }) {
  if (state === "done") {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: green, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: size > 18 ? 12 : 10, fontWeight: "800" }}>✓</Text>
      </View>
    );
  }
  if (state === "current") {
    return (
      <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "#E0B23A", backgroundColor: "#FFF8E4", alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: size > 18 ? 8 : 6, height: size > 18 ? 8 : 6, borderRadius: 4, backgroundColor: "#E0B23A" }} />
      </View>
    );
  }
  return <View style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: "#C5CDC8", backgroundColor: "#F4F6F4" }} />;
}

function qtyIcon(label: string): GlyphName {
  if (label === "Days") return "cal";
  if (label === "Bill") return "bag";
  return "milk";
}

export function AdminDetailView({
  heading,
  partyLabel,
  party,
  quantityLabel,
  quantity,
  amountLabel,
  amount,
  steps,
  note,
  readOnly,
  busy,
  onBack,
  onDecide,
}: {
  heading: string;
  partyLabel: string;
  party: string;
  quantityLabel: string;
  quantity: string;
  amountLabel: string;
  amount: string;
  steps: DeskStep[];
  note: string | null;
  readOnly: boolean;
  busy: boolean;
  onBack: () => void;
  onDecide: (decision: "approve" | "reject", comment: string) => void;
}) {
  const [comment, setComment] = useState("");
  const locked = busy || readOnly;
  return (
    <Screen
      header={(
        <View style={{ paddingHorizontal: 8, paddingTop: 6, paddingBottom: 8, backgroundColor: "#fff", flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: "#EEF3EF" }}>
          <Pressable onPress={onBack} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Text style={{ fontSize: 22, color: ink }}>←</Text>
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Glyph name="bridge" color={green} size={22} />
              <Text style={{ color: greenDeep, fontWeight: "900", fontSize: 18, marginLeft: 6 }}>AgriBridge</Text>
            </View>
            <Text style={{ color: glass.muted, fontSize: 10, letterSpacing: 1.4, marginTop: 1 }}>DAIRY ERP</Text>
          </View>
          <Text style={{ width: 56, textAlign: "right", color: ink, fontWeight: "700", paddingRight: 8 }}>Admin</Text>
        </View>
      )}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 6 }}>
        <Pressable onPress={onBack} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: green, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          <Text style={{ color: "#fff", fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={{ color: ink, fontSize: 26, fontWeight: "800", flex: 1 }}>{heading}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 14 }}>
        <Glyph name="check" color={green} size={16} />
        <Text style={{ color: green, marginLeft: 6, fontWeight: "700" }}>Same record as ERP website</Text>
      </View>
      <View style={{ ...cardFace, padding: 14, marginBottom: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#E6EEE8" }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#E7F6EC", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
            <Glyph name="user" color={green} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: glass.muted, fontSize: 12 }}>{partyLabel}</Text>
            <Text style={{ color: ink, fontWeight: "800", fontSize: 16, marginTop: 1 }}>{party}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row", paddingTop: 12 }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Glyph name={qtyIcon(quantityLabel)} color={green} size={26} />
            <View style={{ marginLeft: 8 }}>
              <Text style={{ color: glass.muted, fontSize: 12 }}>{quantityLabel}</Text>
              <Text style={{ color: ink, fontWeight: "800", fontSize: 18 }}>{quantity}</Text>
            </View>
          </View>
          <View style={{ width: 1, backgroundColor: "#E6EEE8", marginHorizontal: 8 }} />
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: green, fontWeight: "800", fontSize: 14 }}>₹</Text>
            </View>
            <View style={{ marginLeft: 8 }}>
              <Text style={{ color: glass.muted, fontSize: 12 }}>{amountLabel}</Text>
              <Text style={{ color: ink, fontWeight: "800", fontSize: 18 }}>{amount}</Text>
            </View>
          </View>
        </View>
      </View>
      {steps.map((step, index) => {
        const done = step.state === "done";
        const current = step.state === "current";
        const tint = done ? "#E7F6EC" : current ? "#FFF6D8" : "#F3F4F3";
        const mark = done ? green : current ? "#C98900" : "#8E9992";
        const lines = stepLines(step.detail);
        return (
          <View key={`${step.title}-${index}`} style={{ flexDirection: "row", alignItems: "stretch" }}>
            <View style={{ width: 28, alignItems: "center" }}>
              <StepMark state={step.state} />
              {index < steps.length - 1 ? (
                <View style={{ flex: 1, alignItems: "center", justifyContent: "space-evenly", minHeight: 18, paddingVertical: 3 }}>
                  {[0, 1, 2, 3].map((dot) => <View key={dot} style={{ width: 3, height: 3, borderRadius: 2, backgroundColor: "#C5D0C8" }} />)}
                </View>
              ) : null}
            </View>
            <View style={{ flex: 1, backgroundColor: tint, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, marginLeft: 8 }}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ flex: 1, color: ink, fontWeight: "800", fontSize: 15 }}>{index + 1} {step.title}</Text>
                <StepMark state={step.state} size={18} />
              </View>
              <Text style={{ color: mark, marginTop: 3, fontWeight: current ? "700" : "500" }}>{lines.primary}</Text>
              {lines.extra ? <Text style={{ color: glass.muted, fontSize: 12, marginTop: 1 }}>{lines.extra}</Text> : null}
            </View>
          </View>
        );
      })}
      {note ? <Text style={{ color: "#8A5A00", marginBottom: 8 }}>{note}</Text> : null}
      {readOnly ? <Text style={{ color: glass.muted, marginBottom: 8 }}>Sirf dekhna. Manzoor band hai.</Text> : (
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Wajah likhein (kam az kam 5 harf)"
          style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E6EEE8", padding: 12, marginTop: 4, color: ink }}
        />
      )}
      <View style={{ flexDirection: "row", marginTop: 12 }}>
        <Pressable disabled={locked} onPress={() => onDecide("approve", comment)} style={{ flex: 1.15, backgroundColor: locked ? "#9BB8A6" : green, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", marginRight: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, borderColor: "#fff", alignItems: "center", justifyContent: "center", marginRight: 8 }}>
            <Text style={{ color: "#fff", fontWeight: "800", fontSize: 12 }}>✓</Text>
          </View>
          <Text style={{ color: "#fff", fontWeight: "800", fontSize: 16 }}>{busy ? "Ho raha hai" : "Approve"}</Text>
        </Pressable>
        <Pressable disabled={locked} onPress={() => onDecide("reject", comment)} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center", flexDirection: "row", borderWidth: 1.5, borderColor: red }}>
          <Text style={{ color: red, fontWeight: "800", fontSize: 16, marginRight: 6 }}>✕</Text>
          <Text style={{ color: red, fontWeight: "800", fontSize: 16 }}>Reject</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 18 }}>
        <Glyph name="lock" color={glass.muted} size={14} />
        <Text style={{ textAlign: "center", color: glass.muted, marginLeft: 6 }}>Secure · Audited · Trusted</Text>
      </View>
    </Screen>
  );
}

export function AdminWorkView({ title = "Work", sub = "Poora ERP yahin se. Har card asal record kholta hai.", tiles, onOpen }: { title?: string; sub?: string; tiles?: { key: string; title: string; sub: string; icon: GlyphName }[]; onOpen: (key: string) => void }) {
  const items = tiles ?? [
    { key: "approvals", title: "Approvals", sub: "Pending inbox", icon: "clip" as const },
    { key: "sales", title: "POS sales", sub: "Aaj ki bills", icon: "cart" as const },
    { key: "cash", title: "Cash alerts", sub: "High priority", icon: "bell" as const },
    { key: "stock", title: "Stock", sub: "Low stock", icon: "alert" as const },
    { key: "milk", title: "Doodh", sub: "Collection", icon: "milk" as const },
    { key: "farmers", title: "Farmers", sub: "Registered", icon: "farmer" as const },
    { key: "purchases", title: "Purchases", sub: "Supplier bills", icon: "bag" as const },
    { key: "attendance", title: "Staff", sub: "Hazri", icon: "people" as const },
    { key: "support", title: "Support", sub: "Tickets", icon: "headset" as const },
    { key: "orders", title: "Orders", sub: "Agri orders", icon: "clip" as const },
    { key: "parties", title: "Khata", sub: "Parties", icon: "building" as const },
    { key: "hr", title: "HR", sub: "Leave and hazri", icon: "cal" as const },
  ];
  return (
    <Screen>
      <Text style={{ color: ink, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: glass.muted, marginBottom: 12 }}>{sub}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {items.map((tile) => (
          <Pressable key={tile.key} onPress={() => onOpen(tile.key)} style={{ width: "48.5%", ...cardFace, padding: 14, marginBottom: 10 }}>
            <Glyph name={tile.icon} color={green} />
            <Text style={{ color: ink, fontWeight: "800", marginTop: 8 }}>{tile.title}</Text>
            <Text style={{ color: glass.muted }}>{tile.sub}</Text>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

export function AdminProfileView({
  fullName,
  role,
  extraRoles,
  phone,
  email,
  place,
  org,
  photoUrl,
  gaps,
  versionExtra,
  onOpen,
  onRole,
  onLogout,
  onMenu,
}: {
  fullName: string;
  role: string;
  extraRoles: string[];
  phone: string | null;
  email: string | null;
  place: string | null;
  org: string | null;
  designation: string | null;
  photoUrl: string | null;
  gaps: string[];
  versionExtra: string;
  onOpen: (key: string) => void;
  onRole?: () => void;
  onLogout?: () => void;
  onMenu?: () => void;
}) {
  const initial = (fullName.trim().charAt(0) || "A").toUpperCase();
  const primary = roleTitle(role);
  const extras = extraRoles.filter((extra) => extra !== role).map(roleTitle).filter((badge) => badge !== primary);
  return (
    <Screen>
      <View style={{ marginHorizontal: -16, marginTop: -8, backgroundColor: greenDeep, paddingHorizontal: 12, paddingTop: 8, paddingBottom: 48, borderBottomLeftRadius: 28, borderBottomRightRadius: 28, overflow: "hidden" }}>
        <Svg style={{ position: "absolute", right: -20, top: 10 }} width={140} height={80} viewBox="0 0 140 80" pointerEvents="none">
          <Path d="M10 70c24-30 50-46 90-52" stroke="rgba(255,255,255,0.08)" strokeWidth="1.3" fill="none" />
        </Svg>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={onMenu} style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Glyph name="menu" color="#fff" />
          </Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Glyph name="sprout" color="#D8F5C8" size={18} />
              <Text style={{ color: "#fff", fontSize: 22, fontWeight: "800", marginLeft: 6 }}>AgriBridge</Text>
            </View>
            <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 13 }}>Kisan ka wasila</Text>
          </View>
          <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
            <Glyph name="shield" color="#fff" size={22} />
          </View>
        </View>
      </View>
      <View style={{ marginTop: -36, flexDirection: "row", alignItems: "flex-start" }}>
        <View style={{ width: 88, height: 88 }}>
          <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: "#E7F6EC", borderWidth: 4, borderColor: "#fff", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: 88, height: 88 }} /> : <Text style={{ color: greenDeep, fontSize: 36, fontWeight: "800" }}>{initial}</Text>}
          </View>
          <Pressable onPress={() => onOpen("account")} style={{ position: "absolute", right: -2, bottom: -2, width: 28, height: 28, borderRadius: 14, backgroundColor: greenDeep, alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: "#fff" }}>
            <Glyph name="pencil" color="#fff" size={14} />
          </Pressable>
        </View>
        <View style={{ flex: 1, marginLeft: 12, paddingTop: 28 }}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: ink, fontSize: 20, fontWeight: "800", flexShrink: 1 }}>{fullName}</Text>
            <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: green, alignItems: "center", justifyContent: "center", marginLeft: 6 }}>
              <Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text>
            </View>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginTop: 4 }}>
            <Text style={{ color: green, fontWeight: "800" }}>{primary}</Text>
            {extras.map((badge) => (
              <View key={badge} style={{ flexDirection: "row", alignItems: "center" }}>
                <Text style={{ color: green, marginHorizontal: 6 }}>•</Text>
                <View style={{ backgroundColor: "#F4E7C4", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
                  <Text style={{ color: "#8A6A12", fontWeight: "800", fontSize: 12 }}>{badge}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ marginTop: 12 }}>
        <ProfileLine icon="pin" text={place || "Branch / shop darj nahi"} />
        <ProfileLine icon="phone" text={phone || "Phone darj nahi"} />
        <ProfileLine icon="mail" text={email || "Email darj nahi"} />
        {gaps.map((gap) => <Text key={gap} style={{ color: "#8A5A00", marginTop: 4 }}>{gap}</Text>)}
      </View>
      <MenuGroup>
        <MenuRow icon="user" title="Account" divider={false} onPress={() => onOpen("account")} />
        <MenuRow icon="swap" title="Role badlo" sub={onRole ? "Switch between available roles" : "Is login par role switch band hai"} onPress={onRole} />
        <MenuRow icon="bell" title="Notifications" sub="Manage notification preferences" onPress={() => onOpen("notifications")} />
      </MenuGroup>
      <MenuGroup>
        <MenuRow icon="building" title="Organization" sub={org || undefined} divider={false} onPress={() => onOpen("org")} />
        <MenuRow icon="gear" title="Settings" sub="System configuration & business controls" onPress={() => onOpen("settings")} />
      </MenuGroup>
      <MenuGroup>
        <MenuRow icon="sprout" title="Branches" sub="Manage branches and locations" divider={false} onPress={() => onOpen("branches")} />
        <MenuRow icon="people" title="Users & roles" sub="Manage users, roles and permissions" onPress={() => onOpen("users")} />
        <MenuRow icon="clip" title="Business rules" sub="Configure validations and workflows" onPress={() => onOpen("rules")} />
      </MenuGroup>
      <MenuGroup title="App">
        <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 }}>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
            <Glyph name="android" color={green} size={18} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <Text style={{ color: ink, fontWeight: "800" }}>Version</Text>
            <Text style={{ color: glass.muted, fontSize: 12 }}>Current app version</Text>
          </View>
          <Text style={{ color: green, fontWeight: "800" }}>{`${AGRIBRIDGE_OS_VERSION}${versionExtra}`}</Text>
        </View>
      </MenuGroup>
      <View style={{ marginTop: 14, backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#F3D0D4", overflow: "hidden" }}>
        <MenuRow icon="power" title="Logout" sub="Sign out from this device" danger divider={false} onPress={onLogout} />
      </View>
    </Screen>
  );
}

function ProfileLine({ icon, text }: { icon: GlyphName; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Glyph name={icon} color={green} size={18} />
      <Text style={{ color: ink, marginLeft: 8, flex: 1 }}>{text}</Text>
    </View>
  );
}

function MenuGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      {title ? <Text style={{ color: glass.muted, fontWeight: "800", marginBottom: 6, marginLeft: 4 }}>{title}</Text> : null}
      <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E6EEE8", overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function MenuRow({ icon, title, sub, trailing, danger, divider = true, onPress }: { icon: GlyphName; title: string; sub?: string; trailing?: string; danger?: boolean; divider?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12, borderTopWidth: divider ? 1 : 0, borderTopColor: "#F1F4F1" }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: danger ? "#FDECEC" : "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
        <Glyph name={icon} color={danger ? red : green} size={18} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: danger ? red : ink, fontWeight: "800" }}>{title}</Text>
        {sub ? <Text style={{ color: glass.muted, fontSize: 12, marginTop: 1 }}>{sub}</Text> : null}
      </View>
      {trailing ? <Text style={{ color: green, fontWeight: "800" }}>{trailing}</Text> : <Text style={{ color: "#B7C2BB", fontSize: 18 }}>›</Text>}
    </Pressable>
  );
}

export function RecordList({ title, sub, onBack, rows, empty }: { title: string; sub?: string | null; onBack: () => void; rows: { key: string; title: string; value: string }[]; empty: string }) {
  return (
    <Screen>
      <Pressable onPress={onBack}><Text style={{ color: green, fontWeight: "800", marginBottom: 8 }}>‹ Wapas</Text></Pressable>
      <Text style={{ color: ink, fontSize: 22, fontWeight: "800" }}>{title}</Text>
      {sub ? <Text style={{ color: "#8A5A00", marginBottom: 8 }}>{sub}</Text> : null}
      {rows.length === 0 ? <Text style={{ color: glass.muted, marginTop: 8 }}>{empty}</Text> : null}
      {rows.map((row) => (
        <View key={row.key} style={{ ...cardFace, padding: 12, marginTop: 8, flexDirection: "row" }}>
          <Text style={{ flex: 1, color: ink, fontWeight: "700", paddingRight: 8 }}>{row.title}</Text>
          <Text style={{ color: greenDeep, fontWeight: "800" }}>{row.value}</Text>
        </View>
      ))}
    </Screen>
  );
}
