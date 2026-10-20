import type { ComplaintCategory, ComplaintStatus, PartyKind, SlaTone } from "@/lib/call-center/rules";

export interface SearchHit {
  kind: PartyKind;
  id: string;
  name: string;
  code: string;
  place: string | null;
  phoneMasked: string;
}

export interface RecentRow {
  at: string;
  name: string;
  kindLabel: string;
  place: string | null;
  phoneMasked: string;
  href: string;
}

export interface ConsoleData {
  example: boolean;
  query: string;
  results: SearchHit[] | null;
  recent: RecentRow[];
  callsToday: number | null;
  complaintsToday: number | null;
  openComplaints: number | null;
  notice: string | null;
}

export interface LedgerLine {
  date: string;
  detail: string;
  debit: number | null;
  credit: number | null;
  balance: number | null;
  side: "Dr" | "Cr";
}

export interface PartyData {
  example: boolean;
  found: boolean;
  kind: PartyKind;
  id: string;
  name: string;
  code: string;
  place: string | null;
  typeLabel: string;
  phoneMasked: string;
  tracked: boolean;
  balance: number | null;
  balanceSide: "Dr" | "Cr" | null;
  lines: LedgerLine[];
  milk: { tracked: boolean; todayLiters: number | null; rate: number | null; nextPayment: string | null };
  rates: { name: string; rate: number }[];
  complaints: { number: string; category: ComplaintCategory; status: ComplaintStatus }[];
  notice: string | null;
}

export interface BoardRow {
  id: string;
  number: string;
  callerName: string;
  category: ComplaintCategory;
  department: string;
  createdAt: string;
  slaDue: string;
  status: ComplaintStatus;
  createdBy: string;
  createdByName: string;
  /** Example screen par mockup ka likha hua waqt. */
  ageText?: string;
  sla?: SlaTone;
}

export interface BoardData {
  example: boolean;
  open: number | null;
  inProgress: number | null;
  resolved: number | null;
  slaBreach: number | null;
  rows: BoardRow[];
  actorId: string;
  actorRoles: string[];
  notice: string | null;
}

export interface AgentRow {
  code: string;
  name: string;
  status: string;
  callsToday: number | null;
}

export interface AuditRow {
  at: string;
  agent: string;
  party: string;
  action: string;
  device: string;
}

export interface AgentsData {
  example: boolean;
  agents: AgentRow[];
  audit: AuditRow[];
  notice: string | null;
  canCreate: boolean;
}
