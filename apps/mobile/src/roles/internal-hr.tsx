import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { karachiDate, liveGetScoped, liveInsert, loadStaffHome, rupees, type AdvanceRow, type AttendanceRow, type ReadResult, type SalaryRow } from "../../../../src/lib/mobile/live-read";
import type { LiveAuth } from "../../../../src/lib/mobile/live-read";
import { colors } from "../kit";

type HrPage = "menu" | "attendance" | "leave" | "salary" | "advance" | "requests";
type LeaveRow = { id?: string; from_date?: string | null; to_date?: string | null; leave_type?: string | null; reason?: string | null; status?: string | null; created_at?: string | null };

export function InternalHr({ auth, userId, readOnly = false }: { auth: LiveAuth; userId: string; readOnly?: boolean }) {
  const [page, setPage] = useState<HrPage>("menu");
  const [attendance, setAttendance] = useState<ReadResult<AttendanceRow> | null>(null);
  const [salary, setSalary] = useState<ReadResult<SalaryRow> | null>(null);
  const [advances, setAdvances] = useState<ReadResult<AdvanceRow> | null>(null);
  const [leaves, setLeaves] = useState<ReadResult<LeaveRow> | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [note, setNote] = useState("");
  const [fromDate, setFromDate] = useState(karachiDate());
  const [toDate, setToDate] = useState(karachiDate());
  const [reason, setReason] = useState("");
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceReason, setAdvanceReason] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [home, leaveRead] = await Promise.all([
      loadStaffHome(auth, userId, fetch),
      liveGetScoped<LeaveRow>(auth, `leave_requests?select=id,from_date,to_date,leave_type,reason,status,created_at&profile_id=eq.${encodeURIComponent(userId)}&order=created_at.desc&limit=30`, fetch),
    ]);
    setAttendance(home.attendance); setSalary(home.salary); setAdvances(home.advances); setLeaves(leaveRead);
  }, [auth.token, auth.url, userId]);
  useEffect(() => { void load(); }, [load]);
  async function submitLeave() {
    if (readOnly || busy) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate) || toDate < fromDate) { setNote("Sahi From aur To date likhein: YYYY-MM-DD"); return; }
    if (reason.trim().length < 5) { setNote("Chhutti ki wajah kam az kam 5 huroof mein likhein."); return; }
    setBusy(true);
    const saved = await liveInsert<LeaveRow>(auth, "leave_requests", { profile_id: userId, from_date: fromDate, to_date: toDate, leave_type: "casual", reason: reason.trim(), status: "pending" }, fetch);
    setBusy(false); setNote(saved.ok ? "Chhutti ki darkhwast bhej di." : saved.message);
    if (saved.ok) { setReason(""); await load(); setPage("requests"); }
  }
  async function submitAdvance() {
    if (readOnly || busy) return;
    const amount = Number(advanceAmount);
    if (!(amount > 0) || advanceReason.trim().length < 5) { setNote("Raqam aur wajah sahi likhein."); return; }
    const today = karachiDate(); const year = Number(today.slice(0, 4)); const month = Number(today.slice(5, 7));
    setBusy(true);
    const saved = await liveInsert<AdvanceRow>(auth, "staff_advances", { profile_id: userId, amount, installments: 1, installment_amount: amount, first_year: year, first_month: month, reason: advanceReason.trim(), requested_by: userId, status: "requested" }, fetch);
    setBusy(false); setNote(saved.ok ? "Advance request bhej di." : saved.message);
    if (saved.ok) { setAdvanceAmount(""); setAdvanceReason(""); await load(); setPage("requests"); }
  }
  if (!attendance || !salary || !advances || !leaves) return <ActivityIndicator color={colors.green} style={{ marginTop: 28 }} />;
  const pending = leaves.ok ? leaves.rows.filter((row) => row.status === "pending").length : null;
  const latestSalary = salary.ok ? salary.rows[0] : null;
  return <ScrollView style={s.screen} contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load().finally(() => setRefreshing(false)); }} tintColor={colors.green} />}>
    <View style={s.header}>{page !== "menu" ? <Pressable onPress={() => { setPage("menu"); setNote(""); }} style={s.back}><Text style={s.backText}>‹</Text></Pressable> : null}<View style={{ flex: 1 }}><Text style={s.title}>{page === "menu" ? "My HR" : page === "attendance" ? "Attendance History" : page === "leave" ? "Leave Request" : page === "salary" ? "Salary & Payslip" : page === "advance" ? "Advance Request" : "My HR Requests"}</Text><Text style={s.sub}>Aap ka apna HR record</Text></View></View>
    {note ? <Text style={s.note}>{note}</Text> : null}
    {page === "menu" ? <>
      <View style={s.grid}>
        <HrCard title="Attendance History" value={attendance.ok && attendance.rows.length ? String(attendance.rows.length) : "—"} sub="View records" onPress={() => setPage("attendance")} />
        <HrCard title="Leave / Short Leave" value={pending == null || pending === 0 ? "—" : String(pending)} sub="Apply or view" onPress={() => setPage("leave")} />
        <HrCard title="Salary & Payslip" value={latestSalary?.net_salary == null ? "—" : rupees(Number(latestSalary.net_salary))} sub="View payslip" onPress={() => setPage("salary")} />
        <HrCard title="Advance Request" value={advances.ok && advances.rows.length ? String(advances.rows.length) : "—"} sub="Request advance" onPress={() => setPage("advance")} />
        <HrCard title="My HR Requests" value={leaves.ok && leaves.rows.length ? String(leaves.rows.length) : "—"} sub="Status and history" onPress={() => setPage("requests")} />
        <HrCard title="Documents" value="—" sub="HR documents" onPress={() => setNote("Documents website HR record se sync honge.")} />
      </View>
      <View style={s.help}><Text style={s.helpTitle}>Need Help?</Text><Text style={s.helpText}>HR related query ke liye apne manager ya HR team se rabta karein.</Text></View>
    </> : null}
    {page === "attendance" ? <View style={s.card}><Text style={s.section}>Daily Attendance</Text>{!attendance.ok ? <Text style={s.empty}>{attendance.message}</Text> : attendance.rows.length ? attendance.rows.map((row, i) => <Row key={`${row.attendance_date}-${i}`} title={row.attendance_date || "—"} value={row.status || "—"} sub={row.check_in_at ? `Check-in ${row.check_in_at.slice(11, 16)}` : ""} />) : <Text style={s.empty}>Koi attendance record nahi.</Text>}</View> : null}
    {page === "leave" ? <View style={s.card}><Text style={s.section}>Nayi Darkhwast</Text><View style={s.segment}><Text style={s.segmentOn}>Full Day Leave</Text><Text style={s.segmentOff}>Short Leave</Text></View><Field label="From Date" value={fromDate} onChange={setFromDate} /><Field label="To Date" value={toDate} onChange={setToDate} /><Field label="Reason for Leave" value={reason} onChange={setReason} multiline /><Pressable disabled={readOnly || busy} onPress={() => void submitLeave()} style={[s.primary, readOnly ? { opacity: 0.5 } : null]}><Text style={s.primaryText}>{busy ? "Bhej rahe hain…" : "Submit Request"}</Text></Pressable></View> : null}
    {page === "salary" ? <View style={s.card}><Text style={s.section}>Salary History</Text>{!salary.ok ? <Text style={s.empty}>{salary.message}</Text> : salary.rows.length ? salary.rows.map((row, i) => <Row key={`${row.pay_year}-${row.pay_month}-${i}`} title={`${row.pay_year || "—"}-${String(row.pay_month || "—").padStart(2, "0")}`} value={row.net_salary == null ? "—" : rupees(Number(row.net_salary))} sub={row.status || "—"} />) : <Text style={s.empty}>Salary line abhi nahi.</Text>}</View> : null}
    {page === "advance" ? <View style={s.card}><Text style={s.section}>Nayi Advance Request</Text><Field label="Amount" value={advanceAmount} onChange={setAdvanceAmount} keyboard="numeric" /><Field label="Reason" value={advanceReason} onChange={setAdvanceReason} multiline /><Pressable disabled={readOnly || busy} onPress={() => void submitAdvance()} style={[s.primary, readOnly ? { opacity: 0.5 } : null]}><Text style={s.primaryText}>{busy ? "Bhej rahe hain…" : "Submit Advance Request"}</Text></Pressable></View> : null}
    {page === "requests" ? <><View style={s.card}><Text style={s.section}>Leave Requests</Text>{!leaves.ok ? <Text style={s.empty}>{leaves.message}</Text> : leaves.rows.length ? leaves.rows.map((row, i) => <Row key={row.id || String(i)} title={`${row.from_date || "—"} — ${row.to_date || "—"}`} value={row.status || "—"} sub={`${row.leave_type || "leave"} · ${row.reason || ""}`} />) : <Text style={s.empty}>Koi leave request nahi.</Text>}</View><View style={s.card}><Text style={s.section}>Advance Requests</Text>{!advances.ok ? <Text style={s.empty}>{advances.message}</Text> : advances.rows.length ? advances.rows.map((row, i) => <Row key={`${row.created_at}-${i}`} title={row.created_at?.slice(0, 10) || "—"} value={row.amount == null ? "—" : rupees(Number(row.amount))} sub={row.status || "—"} />) : <Text style={s.empty}>Koi advance request nahi.</Text>}</View></> : null}
  </ScrollView>;
}

function HrCard({ title, value, sub, onPress }: { title: string; value: string; sub: string; onPress: () => void }) { return <Pressable onPress={onPress} style={s.hrCard}><Text style={s.hrTitle}>{title}</Text><Text style={s.hrValue}>{value}</Text><Text style={s.hrSub}>{sub} ›</Text></Pressable>; }
function Field({ label, value, onChange, multiline = false, keyboard = "default" }: { label: string; value: string; onChange: (value: string) => void; multiline?: boolean; keyboard?: "default" | "numeric" }) { return <View style={{ marginBottom: 10 }}><Text style={s.label}>{label}</Text><TextInput value={value} onChangeText={onChange} multiline={multiline} keyboardType={keyboard} style={[s.input, multiline ? { minHeight: 82, textAlignVertical: "top" } : null]} /></View>; }
function Row({ title, value, sub }: { title: string; value: string; sub?: string }) { return <View style={s.row}><View style={{ flex: 1 }}><Text style={s.rowTitle}>{title}</Text>{sub ? <Text style={s.rowSub}>{sub}</Text> : null}</View><Text style={s.rowValue}>{value}</Text></View>; }

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F8F3" }, content: { padding: 14, paddingBottom: 110 }, header: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 18, padding: 14, marginBottom: 10 }, back: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#EEF4EF", alignItems: "center", justifyContent: "center", marginRight: 9 }, backText: { color: colors.green, fontWeight: "900", fontSize: 24, marginTop: -3 }, title: { color: colors.text, fontSize: 21, fontWeight: "900" }, sub: { color: colors.muted, fontSize: 12, marginTop: 2 },
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }, hrCard: { width: "48.5%", minHeight: 124, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 13, marginBottom: 10 }, hrTitle: { color: colors.text, fontWeight: "900", fontSize: 14 }, hrValue: { color: colors.greenDark, fontSize: 20, fontWeight: "900", marginTop: 12 }, hrSub: { color: colors.muted, fontSize: 11, marginTop: 5 },
  help: { backgroundColor: "#E7F7ED", borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#C5E8D0" }, helpTitle: { color: colors.text, fontWeight: "900" }, helpText: { color: colors.muted, marginTop: 4, lineHeight: 18 }, card: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 16, padding: 14, marginBottom: 10 }, section: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderBottomColor: colors.line, paddingVertical: 10 }, rowTitle: { color: colors.text, fontWeight: "800" }, rowSub: { color: colors.muted, fontSize: 11, marginTop: 3 }, rowValue: { color: colors.greenDark, fontWeight: "800", marginLeft: 10, maxWidth: "38%", textAlign: "right" }, empty: { color: colors.muted, lineHeight: 19 },
  segment: { flexDirection: "row", borderWidth: 1, borderColor: colors.line, borderRadius: 12, overflow: "hidden", marginBottom: 12 }, segmentOn: { flex: 1, textAlign: "center", backgroundColor: colors.green, color: "#fff", paddingVertical: 9, fontWeight: "800" }, segmentOff: { flex: 1, textAlign: "center", color: colors.muted, paddingVertical: 9, fontWeight: "700" }, label: { color: colors.muted, fontSize: 12, marginBottom: 5 }, input: { backgroundColor: "#fff", borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, color: colors.text }, primary: { backgroundColor: colors.green, borderRadius: 13, paddingVertical: 12, alignItems: "center", marginTop: 3 }, primaryText: { color: "#fff", fontWeight: "900" }, note: { color: colors.greenDark, backgroundColor: "#E7F7ED", borderRadius: 12, padding: 10, marginBottom: 10 },
});
