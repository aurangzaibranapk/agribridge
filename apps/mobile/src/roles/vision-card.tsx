import { Text, View } from "react-native";
import { VISION_AHEAD, VISION_NEXT, VISION_SUB, liveChipsFor, visionRoleLabel } from "../../../../src/lib/mobile/vision";

const green = "#0E7A3C";
const ink = "#143024";

/**
 * Har role ke Home par ek hi card. Badge aur LIVE chips role se aate hain.
 */
export function VisionCard({ role }: { role: string }) {
  const chips = liveChipsFor(role);
  const badge = visionRoleLabel(role);
  return (
    <View style={{ backgroundColor: "#fff", borderRadius: 18, borderWidth: 1.5, borderColor: "#1F8A4C", borderLeftWidth: 5, padding: 14, marginBottom: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
        <Text style={{ fontSize: 16, marginRight: 6 }}>🌱</Text>
        <Text style={{ flex: 1, color: green, fontSize: 16, fontWeight: "800", paddingRight: 8 }}>Kisan Pakistan vision</Text>
        <View style={{ backgroundColor: "#E5F6EA", borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5 }}>
          <Text style={{ color: green, fontWeight: "800", fontSize: 12 }}>Aap ka role: {badge}</Text>
        </View>
      </View>
      <Text style={{ color: "#5E6E64", fontSize: 13, lineHeight: 18, marginTop: 8 }}>{VISION_SUB}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
        <Text style={{ color: ink, fontWeight: "800", fontSize: 14 }}>Ab chal raha hai </Text>
        <Text style={{ color: green, fontWeight: "800", fontSize: 14 }}>LIVE</Text>
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        {chips.map((chip) => (
          <View key={chip} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#E7F6EC", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: green, marginRight: 6 }} />
            <Text style={{ color: "#146B3A", fontWeight: "700", fontSize: 13 }}>{chip}</Text>
          </View>
        ))}
      </View>
      <Text style={{ color: ink, fontWeight: "800", fontSize: 14, marginTop: 4 }}>Jald aa raha hai</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", marginTop: 8 }}>
        {VISION_NEXT.map((chip) => (
          <View key={chip} style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F1F3F1", borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, marginRight: 8, marginBottom: 8 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: "#B7C2BB", marginRight: 6 }} />
            <Text style={{ color: "#8A9690", fontWeight: "700", fontSize: 13 }}>{chip}</Text>
          </View>
        ))}
      </View>
      <View style={{ borderTopWidth: 1, borderStyle: "dashed", borderColor: "#D5E0D8", marginTop: 6, paddingTop: 10 }}>
        <Text style={{ color: "#3D6B4F", fontSize: 13 }}>→ {VISION_AHEAD}</Text>
      </View>
    </View>
  );
}
