import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export const colors = {
  bg: "#F3F6F1",
  green: "#186838",
  greenDark: "#0F4E28",
  gold: "#C8A058",
  card: "#FFFFFF",
  text: "#1C241C",
  muted: "#5E6B62",
  line: "#E2E8E0",
  danger: "#B42318",
};

export function Header({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function GoldCard({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <View style={styles.gold}>
      <Text style={styles.goldTitle}>{title}</Text>
      <Text style={styles.goldValue}>{value}</Text>
      {sub ? <Text style={styles.goldSub}>{sub}</Text> : null}
    </View>
  );
}

export function Field({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Text style={styles.fieldValue}>{value}</Text>
    </View>
  );
}

export function Btn({ label, onPress, kind = "green" }: { label: string; onPress: () => void; kind?: "green" | "gold" | "ghost" }) {
  return (
    <Pressable onPress={onPress} style={[styles.btn, kind === "gold" ? styles.btnGold : kind === "ghost" ? styles.btnGhost : styles.btnGreen]}>
      <Text style={[styles.btnText, kind === "ghost" ? styles.btnGhostText : null]}>{label}</Text>
    </Pressable>
  );
}

const TAB_MARK: Record<string, string> = {
  Home: "⌂",
  Farm: "♧",
  Dairy: "♜",
  Market: "▣",
  Doodh: "🥛",
  Wallet: "₨",
  Profile: "◉",
  Entry: "+",
  Kisan: "☺",
  Receive: "↓",
  Tanks: "▭",
  Reports: "▤",
  Work: "▦",
  Approve: "✓",
  Approvals: "✓",
  HR: "☺",
  More: "••",
  Order: "▣",
  Orders: "☰",
  Hazri: "⏱",
  Tasks: "✓",
  Visits: "✚",
  Janwar: "◆",
  Khata: "₨",
};

function AdminTabIcon({ label, color }: { label: string; color: string }) {
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const };
  if (label === "Home") return <Svg {...props}><Path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-8.5z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /></Svg>;
  if (label === "Work") return <Svg {...props}><Rect x="3" y="7" width="18" height="13" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 12h18" stroke={color} strokeWidth="1.7" /></Svg>;
  if (label === "Approvals") return <Svg {...props}><Rect x="6" y="3.5" width="12" height="17" rx="2" stroke={color} strokeWidth="1.7" /><Path d="M9 3.5h6v2.2H9zM8.5 12.2l2.2 2.2 4.2-4.4" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></Svg>;
  if (label === "HR") return <Svg {...props}><Circle cx="9" cy="9" r="2.3" stroke={color} strokeWidth="1.7" /><Circle cx="16" cy="10" r="1.8" stroke={color} strokeWidth="1.7" /><Path d="M4.5 18.5c.8-2.5 2.6-3.8 4.6-3.8s3.8 1.3 4.6 3.8M13.8 15c1.2-.3 2.5 0 3.6.9 1 1 1.5 2.2 1.8 3.6" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  return <Svg {...props}><Circle cx="12" cy="8" r="3" stroke={color} strokeWidth="1.7" /><Path d="M5.5 19c1.1-3 3.2-4.5 6.5-4.5s5.4 1.5 6.5 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
}

function FarmerTabIcon({ label, color }: { label: string; color: string }) {
  const props = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none" as const };
  if (label === "Munshi") return <Svg {...props}><Rect x="6" y="3.5" width="12" height="17" rx="1.6" stroke={color} strokeWidth="1.7" /><Path d="M9 8h6M9 12h6M9 16h4" stroke={color} strokeWidth="1.6" strokeLinecap="round" /></Svg>;
  if (label === "Services") return <Svg {...props}><Rect x="4" y="4" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.7" /><Rect x="13" y="4" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.7" /><Rect x="4" y="13" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.7" /><Rect x="13" y="13" width="7" height="7" rx="1.4" stroke={color} strokeWidth="1.7" /></Svg>;
  if (label === "Profile") return <Svg {...props}><Circle cx="12" cy="8" r="3" stroke={color} strokeWidth="1.7" /><Path d="M5.5 19c1.1-3 3.2-4.5 6.5-4.5s5.4 1.5 6.5 4.5" stroke={color} strokeWidth="1.7" strokeLinecap="round" /></Svg>;
  return <Svg {...props}><Path d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-5.2v-6.2H10.2V21H5a1 1 0 0 1-1-1v-8.5z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" /></Svg>;
}

export function Tabs({ tabs, current, onChange, kind = "pill" }: { tabs: { key: string; label: string }[]; current: string; onChange: (key: string) => void; kind?: "pill" | "admin" | "farmer" }) {
  if (kind === "farmer") {
    return (
      <View style={styles.farmerTabs}>
        {tabs.map((tab) => {
          const on = current === tab.key;
          const color = on ? "#0E7A3C" : "#8A9690";
          if (tab.label === "Add") {
            return (
              <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.farmerTab}>
                <View style={styles.farmerAdd}><Text style={styles.farmerAddText}>+</Text></View>
                <Text style={[styles.farmerLabel, { color }]}>Add</Text>
              </Pressable>
            );
          }
          return (
            <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.farmerTab}>
              <FarmerTabIcon label={tab.label} color={color} />
              <Text style={[styles.farmerLabel, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  if (kind === "admin") {
    return (
      <View style={styles.adminTabs}>
        {tabs.map((tab) => {
          const on = current === tab.key;
          const color = on ? "#0E7A3C" : "#8A9690";
          return (
            <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.adminTab}>
              {on ? <View style={styles.adminTabMark} /> : null}
              <AdminTabIcon label={tab.label} color={color} />
              <Text style={[styles.adminTabText, { color }]}>{tab.label}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return (
    <View style={styles.tabs}>
      {tabs.map((tab) => {
        const on = current === tab.key;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}>
            <Text style={[styles.tabMark, on ? styles.tabOn : null]}>{TAB_MARK[tab.label] || "•"}</Text>
            <Text style={[styles.tabText, on ? styles.tabOn : null]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Later({ title }: { title: string }) {
  return (
    <Card>
      <Text style={styles.laterTitle}>{title}</Text>
      <Text style={styles.laterBody}>Ye hissa agli phase mein hai. Navigation yahin hai taake role ka ghar mockup jaisa rahe.</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: colors.green, paddingHorizontal: 16, paddingTop: 18, paddingBottom: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerTitle: { color: "#fff", fontSize: 20, fontWeight: "700" },
  headerBtn: { backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  headerBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.line },
  gold: { backgroundColor: colors.gold, borderRadius: 18, padding: 16, marginBottom: 12 },
  goldTitle: { color: "#3d2e10", fontSize: 13, fontWeight: "600" },
  goldValue: { color: "#1c1408", fontSize: 28, fontWeight: "800", marginTop: 4 },
  goldSub: { color: "#3d2e10", marginTop: 4 },
  field: { marginBottom: 8 },
  fieldLabel: { color: colors.muted, fontSize: 12 },
  fieldValue: { color: colors.text, fontSize: 16, fontWeight: "600" },
  btn: { borderRadius: 14, paddingVertical: 12, alignItems: "center", marginTop: 8 },
  btnGreen: { backgroundColor: colors.green },
  btnGold: { backgroundColor: colors.gold },
  btnGhost: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line },
  btnText: { color: "#fff", fontWeight: "700" },
  btnGhostText: { color: colors.green },
  tabs: { flexDirection: "row", marginHorizontal: 10, marginBottom: 8, backgroundColor: "#FFFFFF", borderRadius: 22, borderWidth: 1, borderColor: colors.line, paddingVertical: 9, elevation: 10, shadowColor: "#163C28", shadowOpacity: 0.12, shadowRadius: 10 },
  tab: { flex: 1, alignItems: "center" },
  tabMark: { color: "#87948D", fontSize: 15, marginBottom: 2 },
  tabText: { color: "#748179", fontSize: 11, fontWeight: "700" },
  tabOn: { color: "#12823D" },
  adminTabs: { flexDirection: "row", backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E3EBE6", paddingBottom: 6 },
  adminTab: { flex: 1, alignItems: "center", paddingTop: 10, paddingBottom: 2 },
  adminTabMark: { position: "absolute", top: 0, width: 32, height: 3, borderRadius: 2, backgroundColor: "#0E7A3C" },
  adminTabText: { fontSize: 11, fontWeight: "700", marginTop: 3 },
  farmerTabs: { flexDirection: "row", alignItems: "flex-end", backgroundColor: "#FFFFFF", borderTopWidth: 1, borderTopColor: "#E3EBE6", paddingBottom: 8, paddingTop: 8, overflow: "visible" },
  farmerTab: { flex: 1, alignItems: "center", justifyContent: "flex-end", minHeight: 52 },
  farmerLabel: { fontSize: 11, fontWeight: "700", marginTop: 4 },
  farmerAdd: { width: 56, height: 56, borderRadius: 28, backgroundColor: "#0E7A3C", alignItems: "center", justifyContent: "center", marginTop: -26, borderWidth: 4, borderColor: "#F3F6F2" },
  farmerAddText: { color: "#fff", fontSize: 32, fontWeight: "500", marginTop: -2 },
  laterTitle: { fontWeight: "700", color: colors.text, marginBottom: 6 },
  laterBody: { color: colors.muted, lineHeight: 20 },
});
