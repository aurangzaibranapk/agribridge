import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Score ki tableain parhne ka chhota darwaza.
 *
 * database.types.ts ek generated file hai (700 KB) aur us mein score ki
 * nayi tableain abhi nahi hain. Us poori file ko haath se badalna theek
 * nahi -- wo agli dafa generate hote hi wapas apni jagah aa jati.
 *
 * Is liye score ka parhna yahan se guzarta hai: yahan ek dafa typing
 * kholi jati hai aur us ke saath ye shaklein likh di gayi hain, taake
 * safhon ko `any` na chhuna pare. Jab types dobara generate hon, sirf
 * yahan ki ek satar hategi -- safhe waise ke waise chalenge.
 */
type AnyClient = SupabaseClient<any, "public", any>;
export const scoreDb = (c: unknown): AnyClient => c as AnyClient;

export interface ScoreFactor {
  factor: string;
  label: string;
  weight: number;
  applicable: boolean;
  sub_score: number | null;
  points: number | null;
  punitive: boolean;
  reason?: string;
}

export interface ScoreSnapshot {
  subject_type: string;
  subject_id: string;
  snapshot_date: string;
  /** KHALI HO SAKTA HAI. Khali ka matlab "darja bana hi nahi" -- sifar nahi. */
  score: number | null;
  band: string | null;
  state: string;
  evidence_coverage: number | null;
  credit_history_state: string | null;
  relationship_days: number | null;
  verified_event_count: number | null;
  factors: ScoreFactor[];
  risk_flags: string[];
  engine_version: number;
  reason_summary: string | null;
}

export interface ScoreEvent {
  id: string;
  factor_key: string;
  event_type: string;
  direction: number;
  magnitude: number;
  occurred_at: string;
  never_decays: boolean;
  source_table: string;
  source_id: string;
  evidence_state: string;
  note: string | null;
  /** Bhara ho to hisaab se bahar -- magar qatar apni jagah maujood. */
  invalidated_at: string | null;
  invalidated_reason: string | null;
}

export interface ScoreObligation {
  kind: string;
  source_table: string;
  source_id: string;
  amount: number;
  settled_amount: number;
  /** Khali reh sakta hai -- aur khali hona jhoot nahi, sach hai. */
  due_date: string | null;
  due_date_source: string | null;
  state: string;
}

export interface CreditEligibility {
  level: string;
  blocked: string[];
  requires_human_approval: boolean;
  reasons: Array<{ reason?: string }>;
}
