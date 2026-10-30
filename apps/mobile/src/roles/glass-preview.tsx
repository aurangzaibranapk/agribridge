import type { ReactNode } from "react";
import { ScrollView, Text, View } from "react-native";
import type { HealthRow, KhataView, MilkRow, OrderRow, ReadResult } from "../../../../src/lib/mobile/live-read";
import { milkSteps } from "../../../../src/lib/mobile/admin-desk";
import { DealerGlass, FarmerGlass, McaGlass, McoGlass, StaffGlass, VetGlass } from "./glass-homes";
import { AdminDetailView, AdminHomeView, AdminInboxView, AdminProfileView, type HomeCard } from "./admin-ui";

const khata: KhataView = { owed: null, note: "Khata", lines: [], linesNote: null };
const milk: ReadResult<MilkRow> = { ok: true, rows: [] };
const orders: ReadResult<OrderRow> = { ok: true, rows: [] };
const attendance: ReadResult<{ attendance_date?: string | null; status?: string | null; check_in_at?: string | null }> = { ok: true, rows: [] };
const salary: ReadResult<{ net_salary?: number | string | null }> = { ok: true, rows: [] };
const advances: ReadResult<{ amount?: number | string | null }> = { ok: true, rows: [] };
const health: HealthRow[] = [];
const blankCards: HomeCard[] = [
  { key: "approvals", title: "Approvals", value: "—", sub: "pending", icon: "clip" },
  { key: "sales", title: "POS sales", value: "—", sub: "today", icon: "cart" },
  { key: "cash", title: "Cash alerts", value: "—", sub: "high priority", icon: "bell" },
  { key: "stock", title: "Stock alerts", value: "—", sub: "low stock", icon: "alert" },
  { key: "milk", title: "Doodh today", value: "—", sub: "today", icon: "milk" },
  { key: "farmers", title: "Farmers", value: "—", sub: "registered", icon: "farmer" },
  { key: "attendance", title: "Staff present", value: "—", sub: "today", icon: "people" },
  { key: "support", title: "Support", value: "—", sub: "unresolved", icon: "headset" },
];

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ width: 390, marginRight: 16, marginBottom: 16, height: 844, overflow: "hidden", borderRadius: 28, borderWidth: 1, borderColor: "#DDE7DF", backgroundColor: "#F7F8F3" }}>
      <Text style={{ color: "#0B5D35", fontSize: 11, fontWeight: "700", paddingHorizontal: 12, paddingTop: 8 }}>{title}</Text>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

/** Web-only empty layout. Numbers stay blank. Open with ?glass=1 */
export function GlassPreview() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: "#EEF4EC" }} contentContainerStyle={{ padding: 16 }}>
      <Text style={{ color: "#10271D", fontSize: 16, fontWeight: "800", marginBottom: 8 }}>Approved card layout · khali data</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Frame title="Kisan / Customer"><FarmerGlass khata={khata} milk={milk} names={new Map()} /></Frame>
        <Frame title="MCA"><McaGlass farmers={[]} /></Frame>
        <Frame title="MCO"><McoGlass rows={[]} error="" names={new Map()} /></Frame>
        <Frame title="Admin"><AdminHomeView fullName="" role="admin" photoUrl={null} cards={blankCards} onOpen={() => undefined} /></Frame>
        <Frame title="Staff"><StaffGlass attendance={attendance} salary={salary} advances={advances} tasks={[]} tasksNote={null} checkLabel="Check-in · aaj" checkBusy={false} readOnly={false} onCheckIn={() => undefined} /></Frame>
        <Frame title="Vet"><VetGlass health={health} error="" /></Frame>
        <Frame title="Dealer"><DealerGlass khata={khata} orders={orders} /></Frame>
        <Frame title="Track kisan"><FarmerGlass focus="track" khata={khata} milk={milk} names={new Map()} /></Frame>
        <Frame title="Admin approvals"><AdminInboxView items={[]} filter="all" mineOnly={false} note={null} onFilter={() => undefined} onMine={() => undefined} onOpen={() => undefined} /></Frame>
        <Frame title="Admin approval"><AdminDetailView heading="Doodh approval" partyLabel="Party name" party="—" quantityLabel="Quantity" quantity="—" amountLabel="Amount" amount="—" steps={milkSteps({ status: "priced", collectedAt: null, fatAt: null, verifiedAt: null, requestedBy: null, checkedBy: null, decidedBy: null })} note={null} readOnly={false} busy={false} onBack={() => undefined} onDecide={() => undefined} /></Frame>
        <Frame title="Admin profile"><AdminProfileView fullName="" role="admin" extraRoles={[]} phone={null} email={null} place={null} org={null} designation={null} photoUrl={null} gaps={["Login ke baghair profile nahi."]} versionExtra="" onOpen={() => undefined} /></Frame>
      </View>
    </ScrollView>
  );
}

export function glassPreviewOn(): boolean {
  if (typeof globalThis === "undefined" || !("location" in globalThis)) return false;
  const search = String((globalThis as { location?: { search?: string } }).location?.search || "");
  return /(?:^|[?&])glass=1(?:&|$)/.test(search);
}
