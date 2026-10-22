import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, Text } from "react-native";
import { loadStaffHome, rupees, type AdvanceRow, type AttendanceRow, type ReadResult, type SalaryRow } from "../../../../src/lib/mobile/live-read";
import { Empty, Section, liveAuth, type LiveBag } from "../bits";
import { colors } from "../kit";

export function RoleScreen({ tab, live }: { tab: string; live?: LiveBag }) {
  const auth = liveAuth(live);
  const [attendance, setAttendance] = useState<ReadResult<AttendanceRow> | null>(null);
  const [salary, setSalary] = useState<ReadResult<SalaryRow> | null>(null);
  const [advances, setAdvances] = useState<ReadResult<AdvanceRow> | null>(null);
  const [tasks, setTasks] = useState<{ label: string; count: number }[]>([]);
  const [tasksNote, setTasksNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!auth || !live?.userId) return;
    const home = await loadStaffHome(auth, live.userId, fetch);
    setAttendance(home.attendance);
    setSalary(home.salary);
    setAdvances(home.advances);
    setTasks(home.tasks);
    setTasksNote(home.tasksNote);
  }, [auth?.token, live?.userId]);

  useEffect(() => { void load(); }, [load]);
  if (!auth || !live?.userId) return <ScrollView style={{ padding: 16 }}><Section title="Staff"><Empty title="Login chahiye" body="Hazri, tankhwah aur tasks aap ke account se aate hain." /></Section></ScrollView>;
  if (!attendance || !salary || !advances) return <ActivityIndicator color={colors.green} style={{ marginTop: 24 }} />;

  return (
    <ScrollView style={{ padding: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
      {tab === "home" || tab === "visits" ? (
        <Section title="Meri hazri" sub="Aap ki apni qatarein">
          {!attendance.ok ? <Empty title="Hazri nahi khuli" body={attendance.message} /> : null}
          {attendance.ok && attendance.rows.length === 0 ? <Empty title="Koi hazri nahi" body="Jab aap check-in karenge, tareekh aur status yahan aayenge." /> : null}
          {attendance.ok ? attendance.rows.map((row, index) => <Text key={`${row.attendance_date}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.attendance_date} · {row.status}{row.check_in_at ? ` · ${row.check_in_at.slice(11, 16)}` : ""}</Text>) : null}
        </Section>
      ) : null}
      {tab === "home" || tab === "khata" ? (
        <Section title="Tankhwah aur advance">
          {!salary.ok ? <Empty title="Tankhwah nahi khuli" body={salary.message} /> : null}
          {salary.ok && salary.rows.length === 0 ? <Empty title="Koi tankhwah nahi" body="Jab aap ki salary line bane gi, mahina aur raqam yahan aayenge." /> : null}
          {salary.ok ? salary.rows.map((row, index) => <Text key={`${row.pay_year}-${row.pay_month}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>{row.pay_year}-{row.pay_month} · {row.status} · {row.net_salary == null ? "—" : rupees(Number(row.net_salary))}</Text>) : null}
          {!advances.ok ? <Empty title="Advance nahi khula" body={advances.message} /> : null}
          {advances.ok && advances.rows.length === 0 ? <Empty title="Koi advance nahi" body="Agar aap ne advance liya hai aur wo aap ko nazar aata hai, wo yahan aayega." /> : null}
          {advances.ok ? advances.rows.map((row, index) => <Text key={`${row.created_at}-${index}`} style={{ color: colors.text, marginBottom: 6 }}>Advance · {row.status} · {row.amount == null ? "—" : rupees(Number(row.amount))}</Text>) : null}
        </Section>
      ) : null}
      {tab === "home" || tab === "orders" ? (
        <Section title="Tasks" sub="Jo kaam aap ki manzoori ka intezar karta hai">
          {tasksNote ? <Empty title="Tasks nahi khule" body={tasksNote} /> : null}
          {!tasksNote && tasks.length === 0 ? <Empty title="Aap ke naam koi task nahi" body="Jab koi darkhwast aap par ruke gi, us ki ginati yahan aayegi." /> : null}
          {tasks.map((task) => <Text key={task.label} style={{ color: colors.text, marginBottom: 6 }}>{task.label} · {task.count}</Text>)}
        </Section>
      ) : null}
      {tab === "more" ? <Section title="Aur"><Empty title="Apna kaam" body="Hazri, tankhwah, advance aur tasks Home par hain. Ye screen sirf parhti hai." /></Section> : null}
      <ScrollPad />
    </ScrollView>
  );
}

function ScrollPad() {
  return <Text style={{ height: 24 }}> </Text>;
}
