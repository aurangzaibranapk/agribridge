import { ScrollView, Text } from "react-native";
import { ROLE_NAV } from "../../../../src/lib/mobile/nav";
import type { AppRole } from "../../../../src/lib/mobile/roles";
import { Card } from "../kit";
import { colors } from "../kit";
import { VisionCard } from "./vision-card";

export function RoleScreen({ tab, role }: { tab: string; role: AppRole }) {
  const nav = ROLE_NAV[role];
  return (
    <ScrollView style={{ padding: 16 }}>
      <VisionCard role={role} />
      <Card>
        <Text style={{ fontWeight: "800", fontSize: 18, color: colors.text }}>{nav.title}</Text>
        <Text style={{ color: colors.muted, marginTop: 8 }}>
          {tab} ka poora kaam agli phase mein hai. Neeche wala navigation mockup ke mutabiq hai.
        </Text>
      </Card>
    </ScrollView>
  );
}
