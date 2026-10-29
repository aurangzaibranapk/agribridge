import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

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
  Munshi: "▤",
  Settlements: "₨",
  Add: "+",
  Services: "♧",
  Route: "♧",
  Collections: "▤",
  Sync: "↻",
  Entry: "+",
  Kisan: "☺",
  Receive: "↓",
  Quality: "✓",
  Chiller: "▭",
  Tanks: "▭",
  Reports: "▤",
  Approve: "✓",
  More: "••",
  Order: "▣",
  Orders: "☰",
  Hazri: "⏱",
  Tasks: "✓",
  "My Work": "▣",
  Work: "▣",
  Approvals: "✓",
  HR: "♙",
  Farmers: "♧",
  Receiving: "↓",
  Visits: "✚",
  Janwar: "◆",
  Khata: "₨",
};

export function Tabs({ tabs, current, onChange }: { tabs: { key: string; label: string }[]; current: string; onChange: (key: string) => void }) {
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
  laterTitle: { fontWeight: "700", color: colors.text, marginBottom: 6 },
  laterBody: { color: colors.muted, lineHeight: 20 },
});
