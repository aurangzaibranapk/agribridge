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

export interface JournalInput {
  description: string;
  /** Kis hisse se aayi: pos / milk / expense / cash_close ... */
  sourceModule: string;
  sourceId?: string | null;
  entryDate?: string;
  branchId?: string | null;
  createdBy: string | null;
  lines: JournalLine[];
  /** Purani tareekh ki entry -- wajah lazmi. */
  backdateReason?: string | null;
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

async function nextEntryNumber(): Promise<string> {
  const service = createServiceClient();
  const year = new Date().getFullYear() % 100;

  const { data: existing } = await service
    .from("journal_entry_counters")
    .select("last_number")
    .eq("year", year)
    .maybeSingle();
  const next = (existing?.last_number ?? 0) + 1;

  if (existing) {
    await service.from("journal_entry_counters").update({ last_number: next }).eq("year", year);
  } else {
    await service.from("journal_entry_counters").insert({ year, last_number: next });
  }

  return `TXN-${year}-${String(next).padStart(6, "0")}`;
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
  const entryNumber = await nextEntryNumber();
  const today = new Date().toISOString().slice(0, 10);
  const entryDate = input.entryDate ?? today;
  const backdated = entryDate < today;

  if (backdated && !input.backdateReason) {
    return { error: "Purani tareekh ki entry ke liye wajah likhna zaroori hai." };
  }

  const { data: entry, error: entryError } = await service
    .from("journal_entries")
    .insert({
      entry_number: entryNumber,
      entry_date: entryDate,
      description: input.description,
      source_module: input.sourceModule,
      source_id: input.sourceId ?? null,
      branch_id: input.branchId ?? null,
      is_backdated: backdated,
      backdate_reason: backdated ? (input.backdateReason ?? null) : null,
      created_by: input.createdBy,
    })
    .select("id, entry_number")
    .single();

  if (entryError) return { error: entryError.message };

  const { error: lineError } = await service.from("journal_lines").insert(
    input.lines.map((line, index) => ({
      entry_id: entry.id,
      account_code: line.account,
      debit: round2(line.debit ?? 0),
      credit: round2(line.credit ?? 0),
      party_type: line.partyType ?? null,
      party_id: line.partyId ?? null,
      memo: line.memo ?? null,
      line_order: index + 1,
    }))
  );

  if (lineError) {
    // Qataren na banein to sirf sarnama reh jata hai -- ek khali entry
    // jo kisi report mein nazar nahi aati. Us se behtar hai ke bulane
    // wala ghalti dekh le.
    return { error: `Qataren mahfooz nahi ho sakin: ${lineError.message}` };
  }

  return { id: entry.id, entryNumber: entry.entry_number, total: debit };
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

  const service = createServiceClient();

  const { data: original } = await service
    .from("journal_entries")
    .select("id, entry_number, description, source_module, source_id, branch_id, is_reversal")
    .eq("id", entryId)
    .maybeSingle();
  if (!original) return { error: "Entry nahi mili." };
  if (original.is_reversal) return { error: "Reversal ka reversal nahi hota." };

  const { data: already } = await service
    .from("journal_entries")
    .select("entry_number")
    .eq("reversal_of", entryId)
    .maybeSingle();
  if (already) return { error: `Ye entry pehle hi ulat di gayi thi (${already.entry_number}).` };

  const { data: lines } = await service
    .from("journal_lines")
    .select("account_code, debit, credit, party_type, party_id, memo")
    .eq("entry_id", entryId)
    .order("line_order");
  if (!lines || lines.length === 0) return { error: "Entry ki qataren nahi milin." };

  const entryNumber = await nextEntryNumber();

  const { data: entry, error: entryError } = await service
    .from("journal_entries")
    .insert({
      entry_number: entryNumber,
      description: `Reversal: ${original.description}`,
      source_module: original.source_module,
      source_id: original.source_id,
      branch_id: original.branch_id,
      is_reversal: true,
      reversal_of: entryId,
      reversal_reason: reason.trim(),
      created_by: byProfileId,
    })
    .select("id, entry_number")
    .single();
  if (entryError) return { error: entryError.message };

  // Debit aur credit ulat jate hain -- yahi reversal hai.
  const { error: lineError } = await service.from("journal_lines").insert(
    lines.map((line, index) => ({
      entry_id: entry.id,
      account_code: line.account_code,
      debit: Number(line.credit),
      credit: Number(line.debit),
      party_type: line.party_type,
      party_id: line.party_id,
      memo: `Reversal of ${original.entry_number}`,
      line_order: index + 1,
    }))
  );
  if (lineError) return { error: lineError.message };

  const total = lines.reduce((sum, l) => sum + Number(l.debit), 0);
  return { id: entry.id, entryNumber: entry.entry_number, total: round2(total) };
}
