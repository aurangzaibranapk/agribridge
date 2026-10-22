import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text } from "react-native";
import { karachiDate, liveInsert, loadStaffHome, rupees, type AdvanceRow, type AttendanceRow, type ReadResult, type SalaryRow } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { StaffGlass } from "./glass-homes";
import { Btn, colors } from "../kit";

export function RoleScreen({ tab, live, readOnly = false, onProfile }: { tab: string; live?: LiveBag; readOnly?: boolean; onProfile?: () => void }) {
  const auth = liveAuth(live);
  const [attendance, setAttendance] = useState<ReadResult<AttendanceRow> | null>(null);
  const [salary, setSalary] = useState<ReadResult<SalaryRow> | null>(null);
  const [advances, setAdvances] = useState<ReadResult<AdvanceRow> | null>(null);
  const [tasks, setTasks] = useState<{ label: string; count: number }[]>([]);
  const [tasksNote, setTasksNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !live?.userId) return;
    const home = await loadStaffHome(auth, live.userId, fetch);
    setAttendance(home.attendance);
    setSalary(home.salary);
    setAdvances(home.advances);
    setTasks(home.tasks);
    setTasksNote(home.tasksNote);
  }, [auth?.token, auth?.testAccount, live?.userId]);

  useEffect(() => { void load(); }, [load]);
  if (!auth || !live?.userId) return <ScrollView style={{ padding: 16 }}><Section title="Staff"><Empty title="Login chahiye" body="Hazri, tankhwah aur tasks aap ke account se aate hain." /></Section></ScrollView>;
  if (!attendance || !salary || !advances) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  const today = karachiDate();
  const todayRow = attendance.ok ? attendance.rows.find((row) => row.attendance_date === today) : null;
  async function checkIn() {
    if (!auth || !live?.userId || readOnly || todayRow) return;
    setBusy(true);
    const saved = await liveInsert<AttendanceRow>(auth, "attendance_records", {
      profile_id: live.userId,
      attendance_date: today,
      status: "present",
      check_in_at: new Date().toISOString(),
      source: "app",
      notes: "App check-in",
      is_test: auth.testAccount === true,
    }, fetch);
    setBusy(false);
    if (!saved.ok) {
      const duplicate = /23505|duplicate/i.test(saved.detail || "");
      const source = /source nahi lag sakta/i.test(saved.detail || "");
      setNote(duplicate ? "Aaj ki hazri pehle se hai." : source ? "Check-in nahi hua. Testing par 702_app_test_phase_c.sql lagani hai." : saved.message);
      return;
    }
    setNote("Check-in ho gaya.");
    await load();
  }

  const checkLabel = todayRow ? `Aaj · ${todayRow.status} · check-in ho chuka hai` : note || "Check-in · aaj";
  if (tab === "home") {
    return (
      <StaffGlass
        live={live}
        onProfile={onProfile}
        attendance={attendance}
        salary={salary}
        advances={advances}
        tasks={tasks}
        tasksNote={tasksNote}
        checkLabel={checkLabel}
        checkBusy={busy}
        readOnly={readOnly}
        onCheckIn={() => { void checkIn(); }}
        refreshing={refreshing}
        onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }}
      />
    );
  }

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {note ? <Text style={{ color: colors.greenDark, marginBottom: 8 }}>{note}</Text> : null}
      {tab === "visits" ? (
        <Section title="Meri hazri" sub="Aap ki apni qatarein">
          {todayRow ? <Text style={{ color: colors.text, fontWeight: "700", marginBottom: 6 }}>Aaj · {todayRow.status} · check-in ho chuka hai</Text> : readOnly ? <Text style={{ color: colors.muted }}>Sirf dekhna. Check-in band hai.</Text> : <Btn label={busy ? "Ho raha hai" : "Check-in"} onPress={() => { if (!busy) void checkIn(); }} />}
          {!attendance.ok ? <Empty title="Hazri nahi khuli" body={attendance.message} /> : null}
          {attendance.ok && attendance.rows.length === 0 ? <Empty title="Koi hazri nahi" body="Jab aap check-in karenge, tareekh aur status yahan aayenge." /> : null}
          {attendance.ok ? attendance.rows.map((row, index) => <Text key={`${row.attendance_date}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.attendance_date} · {row.status}{row.check_in_at ? ` · ${row.check_in_at.slice(11, 16)}` : ""}</Text>) : null}
        </Section>
      ) : null}
      {tab === "home" || tab === "khata" ? (
        <Section title="Tankhwah aur advance">
          {!salary.ok ? <Empty title="Tankhwah nahi khuli" body={salary.message} /> : null}
          {salary.ok && salary.rows.length === 0 ? <Empty title="Koi tankhwah nahi" body={live?.testAccount ? "TEST account ki tankhwah asal payroll mein nahi daali, taake qist na ban jaye. Upar hazri ki TEST line hai." : "Jab aap ki salary line bane gi, mahina aur raqam yahan aayenge."} /> : null}
          {salary.ok ? salary.rows.map((row, index) => <Text key={`${row.pay_year}-${row.pay_month}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.pay_year}-{row.pay_month} · {row.status} · {row.net_salary == null ? "—" : rupees(Number(row.net_salary))}</Text>) : null}
          {!advances.ok ? <Empty title="Advance nahi khula" body={advances.message} /> : null}
          {advances.ok && advances.rows.length === 0 ? <Empty title="Koi advance nahi" body={live?.testAccount ? "TEST advance asal staff_advances mein nahi, kyunke wahan qist khud ban jati hai." : "Agar aap ne advance liya hai aur wo aap ko nazar aata hai, wo yahan aayega."} /> : null}
          {advances.ok ? advances.rows.map((row, index) => <Text key={`${row.created_at}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>Advance · {row.status} · {row.amount == null ? "—" : rupees(Number(row.amount))}</Text>) : null}
        </Section>
      ) : null}
      {tab === "home" || tab === "orders" ? (
        <Section title="Mere kaam" sub="Jo kaam aap ki manzoori ka intezar karta hai">
          {tasksNote ? <Empty title="Tasks nahi khule" body={tasksNote} /> : null}
          {!tasksNote && tasks.length === 0 ? <Empty title="Aap ke naam koi task nahi" body="Jab koi darkhwast aap par ruke gi, us ki ginati yahan aayegi." /> : null}
          {tasks.map((task) => <Text key={task.label} style={{ color: colors.text, marginBottom: 6 }}>{task.label} · {task.count}</Text>)}
        </Section>
      ) : null}
      {tab === "more" ? <Section title="Aur"><Empty title="Apna kaam" body="Hazri aur Check-in Home par hain. Tankhwah aur tasks bhi wahi hain." /></Section> : null}
      <ScrollPad />
    </ScrollView>
  );
}

function ScrollPad() {
  return <Text style={{ height: 24 }}> </Text>;
}
