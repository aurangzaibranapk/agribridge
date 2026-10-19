import "server-only";
import { createClient } from "@/lib/supabase/server";
import { parseStatement, parseSummary, type KhataSummary, type StatementRow } from "./khata";

/**
 * Mera Khata -- 565 ke functions kisan ke apne session se (auth.uid()).
 * Service client nahi chahiye: function khud sirf apna khata lautata hai.
 */
export async function loadKhata(from: string | null, to: string | null): Promise<{ summary: KhataSummary | null; rows: StatementRow[]; error: string | null }> {
  const sb = createClient();
  // 565 abhi generated types mein nahi -- rpc ko dheela type.
  const rpc = sb.rpc.bind(sb) as unknown as (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  const [s, st] = await Promise.all([
    rpc("fn_my_khata_summary", {}),
    rpc("fn_my_khata_statement", { p_from: from, p_to: to }),
  ]);
  return {
    summary: parseSummary(s.data),
    rows: parseStatement(st.data),
    error: s.error?.message ?? st.error?.message ?? null,
  };
}
