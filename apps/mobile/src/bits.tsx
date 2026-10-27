import type { ReactNode } from "react";
import { Text, View } from "react-native";
import type { DataFlavor, MobileChannel } from "../../../src/lib/mobile/live-login";
import type { RefreshFailure, RefreshSuccess } from "../../../src/lib/mobile/session-refresh";
import type { LiveAuth } from "../../../src/lib/mobile/live-read";
import { colors } from "./kit";

export type LiveBag = {
  url: string;
  anonKey: string;
  token: string | null;
  userId: string | null;
  channel: MobileChannel;
  flavor?: DataFlavor;
  testAccount?: boolean;
  refreshSession?: () => Promise<RefreshSuccess | RefreshFailure>;
};

export function liveAuth(live: LiveBag | undefined): LiveAuth | null {
  if (!live?.token || !live.url || !live.anonKey) return null;
  return {
    url: live.url,
    anonKey: live.anonKey,
    token: live.token,
    channel: live.channel,
    flavor: live.flavor === "test" ? "test" : "live",
    testAccount: live.testAccount === true,
    refreshSession: live.refreshSession,
    userId: live.userId,
  };
}

export function Empty({ title, body }: { title: string; body: string }) {
  return (
    <View style={{ paddingVertical: 6 }}>
      <Text style={{ fontWeight: "700", color: colors.text }}>{title}</Text>
      <Text style={{ color: colors.muted, marginTop: 4, lineHeight: 18 }}>{body}</Text>
    </View>
  );
}

export function Section({ title, sub, children }: { title: string; sub?: string; children: ReactNode }) {
  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 16, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.line }}>
      <Text style={{ fontWeight: "800", color: colors.text, fontSize: 16 }}>{title}</Text>
      {sub ? <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 8, marginTop: 2 }}>{sub}</Text> : <View style={{ height: 8 }} />}
      {children}
    </View>
  );
}

export function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <View style={{ width: "48%", backgroundColor: "#fff", borderRadius: 14, padding: 12, borderWidth: 1, borderColor: colors.line, marginBottom: 8 }}>
      <Text style={{ color: colors.muted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.greenDark, fontSize: 18, fontWeight: "800", marginTop: 2 }}>{value}</Text>
      {sub ? <Text style={{ color: colors.muted, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </View>
  );
}

const palette = ["#186838", "#C8A058", "#3D6B8A", "#8C4A3A", "#5E6B62", "#9BB59A"];

export function SaleChart({ points }: { points: { day: string; amount: number }[] }) {
  const max = Math.max(...points.map((point) => point.amount), 1);
  return (
    <View>
      <View style={{ height: 110, flexDirection: "row", alignItems: "flex-end" }}>
        {points.map((point) => (
          <View key={point.day} style={{ flex: 1, alignItems: "center", justifyContent: "flex-end" }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.green, marginBottom: 3 }} />
            <View style={{ width: 12, height: Math.max(6, (point.amount / max) * 86), backgroundColor: "#D7E6D4", borderRadius: 6 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", marginTop: 4 }}>
        {points.map((point) => (
          <Text key={point.day} style={{ flex: 1, textAlign: "center", fontSize: 10, color: colors.muted }}>{point.day.slice(8)}</Text>
        ))}
      </View>
    </View>
  );
}

export function ShareBar({ parts }: { parts: { label: string; amount: number }[] }) {
  const total = parts.reduce((sum, part) => sum + part.amount, 0) || 1;
  return (
    <View>
      <View style={{ flexDirection: "row", height: 16, borderRadius: 8, overflow: "hidden", backgroundColor: colors.line }}>
        {parts.map((part, index) => (
          <View key={part.label} style={{ flex: Math.max(part.amount / total, 0.04), backgroundColor: palette[index % palette.length] }} />
        ))}
      </View>
      {parts.map((part, index) => (
        <Text key={part.label} style={{ color: colors.text, marginTop: 6, fontSize: 13 }}>
          <Text style={{ color: palette[index % palette.length] }}>● </Text>
          {part.label} · Rs {Math.round(part.amount).toLocaleString("en-PK")}
        </Text>
      ))}
    </View>
  );
}
