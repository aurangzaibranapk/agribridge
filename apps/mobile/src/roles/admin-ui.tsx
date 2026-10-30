import { useState, type ReactNode } from "react";
import { Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";
import { greetingName } from "../../../../src/lib/mobile/display-name";
import { agoLabel, approvalHeadline, categoryLabel, roleTitle, rupeeLabel, type ApprovalFilter, type DeskStep, type InboxItem } from "../../../../src/lib/mobile/admin-desk";
import { AGRIBRIDGE_OS_VERSION } from "../../../../src/lib/app-version";
import { glass } from "../glass";

const green = "#0E6A38";
const greenDeep = "#0C4E2C";
const page = "#F4F7F4";
const red = "#E11D48";
const yellow = "#F8E7A0";

export type HomeCard = {
  key: string;
  title: string;
  value: string;
  sub: string;
  alert?: boolean;
  icon: GlyphName;
};

type GlyphName = "clip" | "cart" | "bell" | "alert" | "milk" | "farmer" | "people" | "headset" | "leaf" | "cal" | "shield" | "pin" | "phone" | "mail" | "check" | "bag" | "gear" | "building";

function Glyph({ name, color }: { name: GlyphName; color: string }) {
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const };
  if (name === "clip") return <Svg {...props}><Rect x="6" y="4" width="12" height="16" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M9 4.5h6v2H9zM8 11h8M8 15h5" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "cart") return <Svg {...props}><Path d="M4 6h2l2 10h10l2-7H8" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /><Circle cx="10" cy="19" r="1.4" fill={color} /><Circle cx="17" cy="19" r="1.4" fill={color} /></Svg>;
  if (name === "bell") return <Svg {...props}><Path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2H4.5L6 16z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M10 19a2 2 0 0 0 4 0" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "alert") return <Svg {...props}><Path d="M12 4l8 14H4L12 4z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M12 10v4" stroke={color} strokeWidth="1.7" strokeLinecap="round" /><Circle cx="12" cy="16.5" r="0.9" fill={color} /></Svg>;
  if (name === "milk") return <Svg {...props}><Path d="M8 3h8l-1 3v12a3 3 0 0 1-3 3h0a3 3 0 0 1-3-3V6L8 3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M9 10h6" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "farmer") return <Svg {...props}><Circle cx="12" cy="9" r="3" stroke={color} strokeWidth="1.7" /><Path d="M5 19c1.4-3 3.8-4.5 7-4.5S17.6 16 19 19" stroke={color} strokeWidth="1.7" strokeLinecap="round" /><Path d="M8 7.5c.4-2 1.8-3.2 4-3.2s3.6 1.2 4 3.2" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "people") return <Svg {...props}><Circle cx="9" cy="9" r="2.4" stroke={color} strokeWidth="1.7" /><Circle cx="16" cy="10" r="2" stroke={color} strokeWidth="1.7" /><Path d="M4.5 18c.8-2.4 2.6-3.6 4.5-3.6s3.7 1.2 4.5 3.6M14 14.6c1.3-.4 2.6-.2 3.8.8 1 1.2 1.4 2.6 1.7 3.6" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "headset") return <Svg {...props}><Path d="M5 13a7 7 0 0 1 14 0" stroke={color} strokeWidth="1.7" /><Rect x="4" y="13" width="3.5" height="6" rx="1.2" stroke={color} strokeWidth="1.7" /><Rect x="16.5" y="13" width="3.5" height="6" rx="1.2" stroke={color} strokeWidth="1.7" /><Path d="M12 20h3" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "leaf") return <Svg {...props}><Path d="M5 19C5 11 11 5 19 5c0 8-6 14-14 14z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M9 15c2-2 4-4 6-6" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "cal") return <Svg {...props}><Rect x="4" y="5" width="16" height="15" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 3v4M16 3v4M4 10h16" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "shield") return <Svg {...props}><Path d="M12 3l7 3v6c0 4.5-3 7-7 9-4-2-7-4.5-7-9V6l7-3z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /><Path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "pin") return <Svg {...props}><Path d="M12 21s6-5.2 6-10a6 6 0 1 0-12 0c0 4.8 6 10 6 10z" stroke={color} strokeWidth="1.7" /><Circle cx="12" cy="11" r="2" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "phone") return <Svg {...props}><Rect x="7" y="3" width="10" height="18" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M11 18h2" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "mail") return <Svg {...props}><Rect x="3" y="6" width="18" height="12" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M4 7l8 6 8-6" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /></Svg>;
  if (name === "bag") return <Svg {...props}><Rect x="4" y="7" width="16" height="13" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 7V6a4 4 0 0 1 8 0v1" stroke={color} strokeWidth="1.7" /></Svg>;
  if (name === "gear") return <Svg {...props}><Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="1.7" /><Path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6L17 7M7 17l-1.4 1.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  if (name === "building") return <Svg {...props}><Rect x="4" y="4" width="16" height="16" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 20v-4h8v4M8 8h.01M12 8h.01M16 8h.01M8 12h.01M12 12h.01M16 12h.01" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  return <Svg {...props}><Path d="M5 12l5 5L20 7" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
}

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

export function AdminHomeView({
  fullName,
  role,
  photoUrl,
  cards,
  banner,
  refreshing,
  onRefresh,
  onOpen,
}: {
  fullName: string;
  role: string;
  photoUrl: string | null;
  cards: HomeCard[];
  banner?: string | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onOpen: (key: string) => void;
}) {
  const short = greetingName(fullName) || fullName;
  const initial = (fullName.trim().charAt(0) || "A").toUpperCase();
  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={{ backgroundColor: greenDeep, borderRadius: 22, padding: 16, marginBottom: 16, overflow: "hidden" }}>
        <View style={{ position: "absolute", right: -20, top: -30, width: 140, height: 140, borderRadius: 70, backgroundColor: "rgba(255,255,255,0.05)" }} />
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1, paddingRight: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Glyph name="leaf" color="#D8F5C8" />
              <View style={{ marginLeft: 8 }}>
                <Text style={{ color: "#fff", fontSize: 18, fontWeight: "800" }}>Kisan Pakistan</Text>
                <Text style={{ color: "rgba(255,255,255,0.82)", fontSize: 13 }}>AgriBridge</Text>
              </View>
            </View>
            <View style={{ width: 36, height: 3, borderRadius: 2, backgroundColor: "#E6C15A", marginTop: 12 }} />
          </View>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: "#176B3A", borderWidth: 2, borderColor: "rgba(255,255,255,0.35)", overflow: "hidden", alignItems: "center", justifyContent: "center" }}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: 64, height: 64 }} /> : <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{initial}</Text>}
          </View>
        </View>
        <View style={{ alignItems: "flex-end", marginTop: 14 }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13 }}>Assalam o Alaikum</Text>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800" }}>{short || " "}</Text>
          <View style={{ flexDirection: "row", alignItems: "center", marginTop: 2 }}>
            <Text style={{ color: "#fff", fontSize: 14, marginRight: 4 }}>{roleTitle(role)}</Text>
            <Glyph name="shield" color="#B7F0C8" />
          </View>
        </View>
      </View>
      {banner ? <Text style={{ color: "#8A5A00", marginBottom: 8 }}>{banner}</Text> : null}
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
        <Text style={{ flex: 1, color: glass.text, fontSize: 20, fontWeight: "800" }}>Today overview</Text>
        <Glyph name="cal" color={green} />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {cards.map((card) => (
          <Pressable key={card.key} onPress={() => onOpen(card.key)} style={{ width: "48.5%", backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: "#E6EEE8", minHeight: 118 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: card.alert ? "#FDECEC" : "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
                <Glyph name={card.icon} color={card.alert ? red : green} />
              </View>
              <Text style={{ flex: 1, marginLeft: 8, color: glass.text, fontWeight: "700" }} numberOfLines={1}>{card.title}</Text>
              <Text style={{ color: "#9AA89F", fontSize: 18 }}>›</Text>
            </View>
            <Text style={{ color: glass.text, fontSize: 26, fontWeight: "800", marginTop: 8 }}>{card.value}</Text>
            <Text style={{ color: card.alert ? red : green, fontWeight: "700", marginTop: 2 }}>{card.sub}</Text>
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
}) {
  return (
    <Screen
      refreshing={refreshing}
      onRefresh={onRefresh}
      header={(
        <View style={{ backgroundColor: greenDeep, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 }}>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center" }}>Approvals</Text>
          <Text style={{ color: "rgba(255,255,255,0.8)", textAlign: "center", marginTop: 2 }}>Review and manage pending requests</Text>
        </View>
      )}
    >
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
        {FILTERS.map((chip) => {
          const on = filter === chip.key;
          return (
            <Pressable key={chip.key} onPress={() => onFilter(chip.key)} style={{ marginRight: 8, marginBottom: 8, backgroundColor: on ? greenDeep : "#fff", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, borderWidth: 1, borderColor: on ? greenDeep : "#E1EAE3" }}>
              <Text style={{ color: on ? "#fff" : glass.text, fontWeight: "700" }}>{chip.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={onMine} style={{ backgroundColor: mineOnly ? "#F8E7A0" : "#fff", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1, borderColor: "#E1EAE3", marginBottom: 8 }}>
          <Text style={{ color: glass.text, fontWeight: "700" }}>Filter</Text>
        </Pressable>
      </View>
      <Text style={{ color: glass.text, fontSize: 18, fontWeight: "800", marginTop: 8 }}>Pending Approvals</Text>
      <Text style={{ color: glass.muted, marginBottom: 10 }}>Tap any request to view details</Text>
      {note ? <Text style={{ color: "#8A5A00", marginBottom: 8 }}>{note}</Text> : null}
      {items.length === 0 ? <Text style={{ color: glass.muted, marginBottom: 12 }}>{note ? "Fehrist adhoori hai." : "Koi pending approval nahi."}</Text> : null}
      {items.map((item) => (
        <Pressable key={`${item.category}-${item.itemId}`} onPress={() => onOpen(item)} style={{ backgroundColor: "#fff", borderRadius: 18, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: "#E6EEE8", flexDirection: "row", alignItems: "center" }}>
          <View style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
            <Glyph name={bucketIcon(item.category)} color={green} />
          </View>
          <View style={{ flex: 1, marginLeft: 10 }}>
            <View style={{ alignSelf: "flex-start", backgroundColor: "#E7F6EC", borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
              <Text style={{ color: green, fontSize: 11, fontWeight: "800" }}>{categoryLabel(item.category)}</Text>
            </View>
            <Text style={{ color: glass.text, fontWeight: "800", marginTop: 3 }} numberOfLines={1}>{approvalHeadline(item)}</Text>
            <Text style={{ color: glass.text, fontWeight: "700" }}>{item.category === "leave" || item.amount == null ? "—" : rupeeLabel(item.amount)}</Text>
            <Text style={{ color: glass.muted, fontSize: 12 }}>{agoLabel(item.createdAt)}</Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <View style={{ backgroundColor: yellow, borderRadius: 14, paddingHorizontal: 8, paddingVertical: 4, marginBottom: 8 }}>
              <Text style={{ color: "#8A6A12", fontSize: 11, fontWeight: "800" }}>Check baqi</Text>
            </View>
            <Text style={{ color: "#9AA89F", fontSize: 18 }}>›</Text>
          </View>
        </Pressable>
      ))}
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6, marginBottom: 12 }}>
        <Glyph name="check" color={green} />
        <Text style={{ color: glass.muted, marginLeft: 6, flex: 1 }}>All approvals are securely logged for audit and compliance.</Text>
      </View>
    </Screen>
  );
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
  return (
    <Screen
      header={(
        <View style={{ paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, backgroundColor: page, flexDirection: "row", alignItems: "center" }}>
          <Pressable onPress={onBack} style={{ padding: 8 }}><Text style={{ fontSize: 22, color: glass.text }}>←</Text></Pressable>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={{ color: greenDeep, fontWeight: "900", fontSize: 18 }}>AgriBridge</Text>
            <Text style={{ color: glass.muted, fontSize: 10, letterSpacing: 1 }}>DAIRY ERP</Text>
          </View>
          <Text style={{ color: glass.text, fontWeight: "700", paddingRight: 8 }}>Admin</Text>
        </View>
      )}
    >
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <Pressable onPress={onBack} style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: green, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
          <Text style={{ color: "#fff", fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={{ color: glass.text, fontSize: 26, fontWeight: "800" }}>{heading}</Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
        <Glyph name="check" color={green} />
        <Text style={{ color: green, marginLeft: 6, fontWeight: "700" }}>Same record as ERP website</Text>
      </View>
      <View style={{ backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#E6EEE8", marginBottom: 14 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
          <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#E7F6EC", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
            <Glyph name="farmer" color={green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ color: glass.muted }}>{partyLabel}</Text>
            <Text style={{ color: glass.text, fontWeight: "800", fontSize: 16 }}>{party}</Text>
          </View>
        </View>
        <View style={{ flexDirection: "row" }}>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Glyph name="milk" color={green} />
            <View style={{ marginLeft: 8 }}>
              <Text style={{ color: glass.muted }}>{quantityLabel}</Text>
              <Text style={{ color: glass.text, fontWeight: "800", fontSize: 18 }}>{quantity}</Text>
            </View>
          </View>
          <View style={{ width: 1, backgroundColor: "#E6EEE8", marginHorizontal: 8 }} />
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <Text style={{ color: green, fontWeight: "800", fontSize: 18, marginRight: 6 }}>₨</Text>
            <View>
              <Text style={{ color: glass.muted }}>{amountLabel}</Text>
              <Text style={{ color: glass.text, fontWeight: "800", fontSize: 18 }}>{amount}</Text>
            </View>
          </View>
        </View>
      </View>
      {steps.map((step, index) => {
        const done = step.state === "done";
        const current = step.state === "current";
        const tint = done ? "#E7F6EC" : current ? "#FFF6D8" : "#F3F4F3";
        const mark = done ? green : current ? "#C98900" : "#9AA89F";
        return (
          <View key={`${step.title}-${index}`} style={{ flexDirection: "row" }}>
            <View style={{ width: 28, alignItems: "center" }}>
              <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: done ? green : current ? "#F5C451" : "#E4E7E4", alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: done ? "#fff" : "#5C675F", fontSize: 11, fontWeight: "800" }}>{done ? "✓" : index + 1}</Text>
              </View>
              {index < steps.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: "#E1E6E1", minHeight: 18 }} /> : null}
            </View>
            <View style={{ flex: 1, backgroundColor: tint, borderRadius: 14, padding: 12, marginBottom: 10, marginLeft: 8 }}>
              <Text style={{ color: glass.text, fontWeight: "800" }}>{index + 1} {step.title}</Text>
              <Text style={{ color: mark, marginTop: 2 }}>{step.detail}</Text>
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
          style={{ backgroundColor: "#fff", borderRadius: 12, borderWidth: 1, borderColor: "#E6EEE8", padding: 12, marginTop: 4 }}
        />
      )}
      <View style={{ flexDirection: "row", marginTop: 8 }}>
        <Pressable disabled={busy || readOnly} onPress={() => onDecide("approve", comment)} style={{ flex: 1, backgroundColor: busy || readOnly ? "#9BB8A6" : green, borderRadius: 14, paddingVertical: 14, alignItems: "center", marginRight: 8 }}>
          <Text style={{ color: "#fff", fontWeight: "800" }}>{busy ? "Ho raha hai" : "Approve"}</Text>
        </Pressable>
        <Pressable disabled={busy || readOnly} onPress={() => onDecide("reject", comment)} style={{ flex: 1, backgroundColor: "#fff", borderRadius: 14, paddingVertical: 14, alignItems: "center", borderWidth: 1.5, borderColor: red }}>
          <Text style={{ color: red, fontWeight: "800" }}>Reject</Text>
        </Pressable>
      </View>
      <Text style={{ textAlign: "center", color: glass.muted, marginTop: 16 }}>Secure · Audited · Trusted</Text>
    </Screen>
  );
}

export function AdminWorkView({ title = "Work", sub = "Poora ERP yahin se. Har card asal record kholta hai.", tiles, onOpen }: { title?: string; sub?: string; tiles?: { key: string; title: string; sub: string; icon: GlyphName }[]; onOpen: (key: string) => void }) {
  const items = tiles ?? [
    { key: "approvals", title: "Approvals", sub: "Pending inbox", icon: "clip" },
    { key: "sales", title: "POS sales", sub: "Aaj ki bills", icon: "cart" },
    { key: "cash", title: "Cash alerts", sub: "High priority", icon: "bell" },
    { key: "stock", title: "Stock", sub: "Low stock", icon: "alert" },
    { key: "milk", title: "Doodh", sub: "Collection", icon: "milk" },
    { key: "farmers", title: "Farmers", sub: "Registered", icon: "farmer" },
    { key: "purchases", title: "Purchases", sub: "Supplier bills", icon: "bag" },
    { key: "attendance", title: "Staff", sub: "Hazri", icon: "people" },
    { key: "support", title: "Support", sub: "Tickets", icon: "headset" },
    { key: "orders", title: "Orders", sub: "Agri orders", icon: "clip" },
    { key: "parties", title: "Khata", sub: "Parties", icon: "building" },
    { key: "hr", title: "HR", sub: "Leave and hazri", icon: "cal" },
  ];
  return (
    <Screen>
      <Text style={{ color: glass.text, fontSize: 22, fontWeight: "800", marginBottom: 4 }}>{title}</Text>
      <Text style={{ color: glass.muted, marginBottom: 12 }}>{sub}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        {items.map((tile) => (
          <Pressable key={tile.key} onPress={() => onOpen(tile.key)} style={{ width: "48.5%", backgroundColor: "#fff", borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: "#E6EEE8" }}>
            <Glyph name={tile.icon} color={green} />
            <Text style={{ color: glass.text, fontWeight: "800", marginTop: 8 }}>{tile.title}</Text>
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
  designation,
  photoUrl,
  gaps,
  versionExtra,
  onOpen,
  onRole,
  onLogout,
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
}) {
  const initial = (fullName.trim().charAt(0) || "A").toUpperCase();
  const badges = [roleTitle(role), ...extraRoles.filter((extra) => extra !== role).map(roleTitle)];
  return (
    <Screen
      header={(
        <View style={{ backgroundColor: greenDeep, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 54 }}>
          <Text style={{ color: "#fff", fontSize: 26, fontWeight: "800", textAlign: "center" }}>AgriBridge</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", textAlign: "center" }}>Kisan ka wasila</Text>
        </View>
      )}
    >
      <View style={{ marginTop: -40, backgroundColor: "#fff", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#E6EEE8" }}>
        <View style={{ flexDirection: "row" }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: "#E7F6EC", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
            {photoUrl ? <Image source={{ uri: photoUrl }} style={{ width: 72, height: 72 }} /> : <Text style={{ color: greenDeep, fontSize: 32, fontWeight: "800" }}>{initial}</Text>}
          </View>
          <View style={{ flex: 1, marginLeft: 12, justifyContent: "center" }}>
            <Text style={{ color: glass.text, fontSize: 20, fontWeight: "800" }}>{fullName}</Text>
            {designation ? <Text style={{ color: glass.muted }}>{designation}</Text> : null}
            <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 6 }}>
              {badges.map((badge) => (
                <View key={badge} style={{ backgroundColor: badge === roleTitle(role) ? "#E7F6EC" : "#F4EFE0", borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 4 }}>
                  <Text style={{ color: greenDeep, fontWeight: "800", fontSize: 12 }}>{badge}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
        <ProfileLine icon="pin" text={place || "Branch / shop darj nahi"} />
        <ProfileLine icon="phone" text={phone || "Phone darj nahi"} />
        <ProfileLine icon="mail" text={email || "Email darj nahi"} />
        {org ? <ProfileLine icon="building" text={org} /> : null}
        {gaps.map((gap) => <Text key={gap} style={{ color: "#8A5A00", marginTop: 4 }}>{gap}</Text>)}
      </View>
      <MenuGroup title="Account">
        <MenuRow icon="people" title="Role badlo" sub={onRole ? "Switch between available roles" : "Is login par role switch band hai"} onPress={onRole} />
        <MenuRow icon="bell" title="Notifications" sub="Manage notification preferences" onPress={() => onOpen("notifications")} />
      </MenuGroup>
      <MenuGroup title="Organization">
        <MenuRow icon="building" title="Organization" sub={org || "Organization profile"} onPress={() => onOpen("org")} />
        <MenuRow icon="gear" title="Settings" sub="System configuration & business controls" onPress={() => onOpen("settings")} />
        <MenuRow icon="pin" title="Branches" sub="Manage branches and locations" onPress={() => onOpen("branches")} />
        <MenuRow icon="people" title="Users & roles" sub="Manage users, roles and permissions" onPress={() => onOpen("users")} />
        <MenuRow icon="clip" title="Business rules" sub="Configure validations and workflows" onPress={() => onOpen("rules")} />
      </MenuGroup>
      <MenuGroup title="App">
        <MenuRow icon="gear" title="Version" sub="Current app version" trailing={`${AGRIBRIDGE_OS_VERSION}${versionExtra}`} />
        <MenuRow icon="alert" title="Logout" sub="Sign out from this device" danger onPress={onLogout} />
      </MenuGroup>
    </Screen>
  );
}

function ProfileLine({ icon, text }: { icon: GlyphName; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}>
      <Glyph name={icon} color={green} />
      <Text style={{ color: glass.text, marginLeft: 8, flex: 1 }}>{text}</Text>
    </View>
  );
}

function MenuGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginTop: 14 }}>
      <Text style={{ color: glass.muted, fontWeight: "800", marginBottom: 6 }}>{title}</Text>
      <View style={{ backgroundColor: "#fff", borderRadius: 16, borderWidth: 1, borderColor: "#E6EEE8", overflow: "hidden" }}>{children}</View>
    </View>
  );
}

function MenuRow({ icon, title, sub, trailing, danger, onPress }: { icon: GlyphName; title: string; sub: string; trailing?: string; danger?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={{ flexDirection: "row", alignItems: "center", padding: 12, borderTopWidth: 1, borderTopColor: "#F1F4F1" }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: danger ? "#FDECEC" : "#E7F6EC", alignItems: "center", justifyContent: "center" }}>
        <Glyph name={icon} color={danger ? red : green} />
      </View>
      <View style={{ flex: 1, marginLeft: 10 }}>
        <Text style={{ color: danger ? red : glass.text, fontWeight: "800" }}>{title}</Text>
        <Text style={{ color: glass.muted, fontSize: 12 }}>{sub}</Text>
      </View>
      {trailing ? <Text style={{ color: green, fontWeight: "800" }}>{trailing}</Text> : <Text style={{ color: "#9AA89F", fontSize: 18 }}>›</Text>}
    </Pressable>
  );
}

export function RecordList({ title, sub, onBack, rows, empty }: { title: string; sub?: string | null; onBack: () => void; rows: { key: string; title: string; value: string }[]; empty: string }) {
  return (
    <Screen>
      <Pressable onPress={onBack}><Text style={{ color: green, fontWeight: "800", marginBottom: 8 }}>‹ Wapas</Text></Pressable>
      <Text style={{ color: glass.text, fontSize: 22, fontWeight: "800" }}>{title}</Text>
      {sub ? <Text style={{ color: "#8A5A00", marginBottom: 8 }}>{sub}</Text> : null}
      {rows.length === 0 ? <Text style={{ color: glass.muted, marginTop: 8 }}>{empty}</Text> : null}
      {rows.map((row) => (
        <View key={row.key} style={{ backgroundColor: "#fff", borderRadius: 14, padding: 12, marginTop: 8, borderWidth: 1, borderColor: "#E6EEE8", flexDirection: "row" }}>
          <Text style={{ flex: 1, color: glass.text, fontWeight: "700", paddingRight: 8 }}>{row.title}</Text>
          <Text style={{ color: greenDeep, fontWeight: "800" }}>{row.value}</Text>
        </View>
      ))}
    </Screen>
  );
}
