import { createServiceClient } from "@/lib/supabase/service";

/**
 * Double-entry ka darwaza -- har rupya yahin se guzarta hai.
 *
 * Bunyadi usool: har Rs 1 ki DO taraf hoti hain. Kahan se aaya, aur
 * kahan gaya. Ek taraf likhna aur doosri chhor dena hi wo raasta hai
 * jis se paisa "ghaib" hota hai -- kyunke phir koi sawal poochh hi nahi
 * sakta ke gaya kahan.
 *
 * Pehle system mein saat alag khate the (kisan ka, khata, branch,
 * staff, customer, wallet, finance) -- saare ek tarfa, aur aapas mein
 * jude hue nahi. Har khana apni alag kahani sunata tha, aur do kahaniyon
 * ko mila kar dekhna mumkin hi nahi tha.
 *
 * Do taale database mein lage hue hain, code mein nahi:
 *   1. Debit ≠ Credit  -> poori entry rad. Rs 1 ka farq bhi.
 *   2. Financial record mitaya nahi ja sakta -- ghalti reversal se
 *      theek hoti hai, mitane se nahi. Warna ghalti ke sath us ka
 *      nishan bhi chala jata hai.
 */

export interface JournalLine {
  /** gl_accounts ka code, jaise "1000" (Cash in Hand). */
  account: string;
  debit?: number;
  credit?: number;
  /** Kis ke sath -- farmer / customer / supplier / staff / branch. */
  partyType?: string | null;
  partyId?: string | null;
  memo?: string | null;
}

/**
 * Wo row jis ka hisaab ye entry de rahi hai.
 *
 * Ek kaarobari waqia aksar kai tables mein likha jata hai. Kisan Rs 5,000
 * wapas kare to farmer_credit_ledger mein bhi row banti hai aur
 * finance_transactions mein bhi -- magar waqia EK hai, is liye entry bhi
 * EK banti hai jo dono rows ka daawa karti hai.
 *
 * Daawe par database mein primary key hai: ek row do entries mein nahi
 * aa sakti. Is se dobara ginne ka darwaza band ho jata hai -- aur ye wo
 * ghalti hai jo khud nahi pakri jati, kyunki kitab phir bhi barabar
 * rehti hai.
 */
export interface SourceClaim {
  table: string;
  rowId: string;
}

export interface JournalInput {
  description: string;
  /** Kis hisse se aayi: pos / milk / expense / cash_close ... */
  sourceModule: string;
  sourceId?: string | null;
  entryDate?: string;
  branchId?: string | null;
  posShiftId?: string | null;
  shopId?: string | null;
  createdBy: string | null;
  lines: JournalLine[];
  /** Purani tareekh ki entry -- wajah lazmi. */
  backdateReason?: string | null;
  /** Kaun si rows ka hisaab -- v_ledger_unposted isi se khali hota hai. */
  claims?: SourceClaim[];
  /** Device action key for offline replay; NULL keeps all online callers unchanged. */
  clientActionId?: string | null;
}

export interface PostedEntry {
  id: string;
  entryNumber: string;
  total: number;
}

/** Paisa gin-ne mein paisay (decimal) ki ghalti se bachne ke liye. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}


/**
 * Entry post karta hai.
 *
 * Barabri yahan bhi ginte hain, database ke taale se pehle. Wajah ye
 * nahi ke taale par bharosa nahi -- wajah ye hai ke database ki ghalti
 * poore paighaam ko rok deti hai aur bulane wale ko sirf ek technical
 * jumla milta hai. Yahan se saaf jumla jata hai: kitna farq hai aur kis
 * taraf.
 */
export async function postJournal(input: JournalInput): Promise<PostedEntry | { error: string }> {
  if (input.lines.length < 2) {
    return { error: "Entry mein kam az kam do qataren honi chahiyen — ek debit, ek credit." };
  }

  let debit = 0;
  let credit = 0;
  for (const line of input.lines) {
    const d = round2(line.debit ?? 0);
    const c = round2(line.credit ?? 0);
    if (!Number.isFinite(d) || !Number.isFinite(c)) return { error: "Raqam valid number honi chahiye." };
    if (d < 0 || c < 0) return { error: "Raqam manfi nahi ho sakti." };
    if (d > 0 && c > 0) return { error: "Ek qatar mein debit aur credit dono nahi ho sakte." };
    if (d === 0 && c === 0) return { error: "Har qatar mein raqam honi chahiye." };
    debit += d;
    credit += c;
  }

  debit = round2(debit);
  credit = round2(credit);

  if (debit !== credit) {
    const gap = round2(Math.abs(debit - credit));
    return {
      error: `Debit aur Credit barabar nahi — farq Rs ${gap.toLocaleString()}. Jab tak dono taraf barabar nahi hotin, entry post nahi hogi.`,
    };
  }

  const service = createServiceClient();
  // A source row already claimed cannot be claimed again. The database
  // returns the first entry, so the caller used to see success. An offline
  // replay with the same clientActionId still keeps the first entry.
  if (input.claims?.length) {
    for (const claim of input.claims) {
      const { data: prior } = await service
        .from("journal_entry_sources")
        .select("entry_id")
        .eq("source_table", claim.table)
        .eq("source_row_id", claim.rowId)
        .limit(1)
        .maybeSingle();
      if (!prior?.entry_id) continue;
      if (input.clientActionId) {
        const { data: entry } = await service
          .from("journal_entries")
          .select("client_action_id")
          .eq("id", prior.entry_id)
          .maybeSingle();
        if (entry?.client_action_id === input.clientActionId) continue;
      }
      return { error: "Ye qatar pehle se ledger mein darj hai. Dobara daawa nahi ho sakta." };
    }
  }
  const { data, error } = await (service as any).rpc("post_journal_atomic", { p_input: input });
  if (error) return { error: `Ledger posting nahi hui: ${error.message}` };
  if (!data?.id || !data?.entryNumber) return { error: "Ledger posting ka jawab nahi mila." };
  return data as PostedEntry;
}

/**
 * Ghalti theek karne ka WAHID tareeqa.
 *
 * Purani entry jyon ki tyon rehti hai, aur us ke ulat ek nayi entry
 * banti hai. Do qataren nazar aati hain, dono ka nishan rehta hai.
 * Mita dene se ghalti ke sath us ka saboot bhi chala jata hai -- aur
 * phir ye sawal kabhi jawab nahi paata ke wo raqam thi kahan.
 */
export async function reverseJournal(
  entryId: string,
  reason: string,
  byProfileId: string | null
): Promise<PostedEntry | { error: string }> {
  if (reason.trim().length < 5) return { error: "Reversal ki wajah likhna zaroori hai." };

  const { data, error } = await (createServiceClient() as any).rpc("reverse_journal_atomic", {
    p_id: entryId, p_reason: reason.trim(), p_by: byProfileId,
  });
  if (error || !data?.id) return { error: error?.message ?? "Reversal save nahi hui." };
  return data as PostedEntry;
}
