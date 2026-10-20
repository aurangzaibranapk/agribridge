import type { AgentsData, BoardData, ConsoleData, PartyData } from "@/lib/call-center/model";

const partyHref = "/call-center-preview/party";

export const exampleConsole: ConsoleData = {
  example: true,
  query: "",
  results: null,
  callsToday: 38,
  complaintsToday: 6,
  openComplaints: 11,
  notice: null,
  recent: [
    { at: "13:42", name: "Muhammad Aslam (Example)", kindLabel: "Kisan", place: "Chak 45 GB", phoneMasked: "0322-*****76", href: partyHref },
    { at: "13:20", name: "Bilal Dairy Shop (Example)", kindLabel: "Customer", place: "Jaranwala", phoneMasked: "0301-*****09", href: partyHref },
    { at: "12:58", name: "Ghulam Rasool (Example)", kindLabel: "Kisan", place: "Chak 112 RB", phoneMasked: "0345-*****33", href: partyHref },
  ],
};

export const exampleParty: PartyData = {
  example: true,
  found: true,
  kind: "farmer",
  id: "example-aslam",
  name: "Muhammad Aslam (Example)",
  code: "FRM-000045",
  place: "Chak 45 GB",
  typeLabel: "Kisan",
  phoneMasked: "0322-****76",
  tracked: true,
  balance: 42350,
  balanceSide: "Cr",
  notice: null,
  milk: { tracked: true, todayLiters: 18.5, rate: 210, nextPayment: "25 Oct 2026" },
  lines: [
    { date: "2026-10-20", detail: "Doodh 18.5 L", debit: null, credit: 3885, balance: 42350, side: "Cr" },
    { date: "2026-10-19", detail: "Doodh 19 L", debit: null, credit: 3990, balance: 38465, side: "Cr" },
    { date: "2026-10-18", detail: "DAP 1 bag", debit: 14500, credit: null, balance: 34475, side: "Cr" },
    { date: "2026-10-15", detail: "Payment ada (kisan ko)", debit: 20000, credit: null, balance: 48975, side: "Cr" },
    { date: "2026-10-14", detail: "Doodh 15 days", debit: null, credit: 58800, balance: 68975, side: "Cr" },
  ],
  rates: [
    { name: "Urea (50kg)", rate: 4650 },
    { name: "DAP (50kg)", rate: 14500 },
    { name: "Gandum beej (40kg)", rate: 6800 },
    { name: "Makai beej (10kg)", rate: 9200 },
  ],
  complaints: [
    { number: "CMP-000098", category: "doodh", status: "resolved" },
    { number: "CMP-000111", category: "delivery", status: "in_progress" },
    { number: "CMP-000119", category: "khata_ghalat", status: "open" },
  ],
};

export const exampleBoard: BoardData = {
  example: true,
  open: 11,
  inProgress: 7,
  resolved: 54,
  slaBreach: 2,
  actorId: "dept-accounts",
  actorRoles: ["finance"],
  notice: null,
  rows: [
    { id: "1", number: "CMP-000123", callerName: "Muhammad Aslam (Example)", category: "khata_ghalat", department: "accounts", createdAt: "2026-10-20T06:00:00Z", slaDue: "2026-10-21T06:00:00Z", status: "open", createdBy: "agent-sana", createdByName: "Agent: Sana", ageText: "2h", sla: "on_time" },
    { id: "2", number: "CMP-000121", callerName: "Bilal Dairy Shop (Example)", category: "delivery", department: "logistics", createdAt: "2026-10-19T12:00:00Z", slaDue: "2026-10-21T12:00:00Z", status: "in_progress", createdBy: "agent-sana", createdByName: "Agent: Sana", ageText: "20h", sla: "near" },
    { id: "3", number: "CMP-000119", callerName: "Muhammad Aslam (Example)", category: "khata_ghalat", department: "accounts", createdAt: "2026-10-18T18:00:00Z", slaDue: "2026-10-19T18:00:00Z", status: "open", createdBy: "agent-sana", createdByName: "Agent: Sana", ageText: "1d 6h", sla: "late" },
    { id: "4", number: "CMP-000115", callerName: "Ghulam Rasool (Example)", category: "khaad", department: "sales", createdAt: "2026-10-19T23:00:00Z", slaDue: "2026-10-21T23:00:00Z", status: "in_progress", createdBy: "agent-sana", createdByName: "Agent: Sana", ageText: "9h", sla: "on_time" },
    { id: "5", number: "CMP-000111", callerName: "Muhammad Aslam (Example)", category: "delivery", department: "logistics", createdAt: "2026-10-18T08:00:00Z", slaDue: "2026-10-19T08:00:00Z", status: "in_progress", createdBy: "dept-accounts", createdByName: "Agent: Sana", ageText: "2d", sla: "late" },
    { id: "6", number: "CMP-000098", callerName: "Rafiq Ahmed (Example)", category: "doodh", department: "dairy", createdAt: "2026-10-10T08:00:00Z", slaDue: "2026-10-11T08:00:00Z", status: "resolved", createdBy: "agent-sana", createdByName: "Agent: Sana", ageText: "—", sla: "none" },
  ],
};

export const exampleAgents: AgentsData = {
  example: true,
  canCreate: true,
  smsConfigured: false,
  notice: null,
  agents: [
    { code: "AGT-0001", name: "Imran Ali", status: "active", callsToday: 21 },
    { code: "AGT-0002", name: "Sana Iqbal", status: "active", callsToday: 17 },
  ],
  audit: [
    { at: "20 Oct 13:42", agent: "Sana Iqbal", party: "FRM-000045 M. Aslam", action: "Khata dekha", device: "PC-CC-01" },
    { at: "20 Oct 13:44", agent: "Sana Iqbal", party: "FRM-000045 M. Aslam", action: "Complaint CMP-000123", device: "PC-CC-01" },
    { at: "20 Oct 13:20", agent: "Imran Ali", party: "CUS-000210 Bilal Dairy", action: "Rate dekhe", device: "PC-CC-02" },
    { at: "20 Oct 12:58", agent: "Imran Ali", party: "FRM-000077 G. Rasool", action: "Doodh info", device: "PC-CC-02" },
    { at: "20 Oct 12:31", agent: "Sana Iqbal", party: "CUS-000188 (Example)", action: "Khata dekha", device: "PC-CC-01" },
  ],
};
