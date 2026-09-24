"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { logAudit } from "@/lib/audit";
import { postCropLiftSettlement, postCropLifterPayment, ACC, failed } from "@/lib/ledger/rules";

/**
 * Fasal uthane wale -- fehrist, booking par tag, bill, aur adaigi.
 *
 * TEEN ADAD, TEEN ALAG SABAB -- aur ye file un ka wahid darwaza hai:
 *
 *   kattai ka baqi   -> is booking ka bill, jo abhi tak nahi mila
 *   purana baqi      -> kisan ka baqi sab kuch (ledger 1150), kattai
 *                       nikaal kar
 *   hamara commission-> fasal ki qeemat ka fisad, UTHANE WALE ki jeb se
 *
 * Teesra pehle do se bunyadi tor par alag hai: wo kisan ka qarza nahi
 * hai. Is liye kisan ka khata sirf pehli do se saaf hota hai.
 *
 * NOTE: "use server" file sirf async functions export kar sakti hai --
 * har madadgaar cheez yahin andar rehti hai.
 */

export interface LifterState {
  error?: string;
  notice?: string;
  success?: boolean;
}

const ok = (notice: string): LifterState => ({ success: true, notice });

function str(fd: FormData, key: string): string | null {
  const raw = fd.get(key);
  if (raw === null) return null;
  const s = String(raw).trim();
  return s === "" ? null : s;
}

function num(fd: FormData, key: string): number | null {
  const raw = fd.get(key);
  if (raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

async function actor(): Promise<string | null> {
  const {
    data: { user },
  } = await createClient().auth.getUser();
  return user?.id ?? null;
}

function refresh(bookingId?: string | null) {
  revalidatePath("/admin/machinery-rental/lifters");
  revalidatePath("/admin/machinery-rental");
  revalidatePath("/admin/machinery-rental/list");
  if (bookingId) revalidatePath(`/admin/machinery-rental/booking/${bookingId}`);
}

// ---------------------------------------------------------------------
// 1) Fehrist
// ---------------------------------------------------------------------

export async function saveCropLifter(_prev: LifterState, fd: FormData): Promise<LifterState> {
  const actorId = await actor();
  const id = str(fd, "id");
  const name = str(fd, "name");
  const phone = str(fd, "phone");
  const rate = num(fd, "commission_rate");

  if (!name) return { error: "Naam likhein." };
  if (!phone) return { error: "Phone number likhein — usi se ye banda pehchana jata hai." };
  if (rate === null || rate < 0 || rate > 100) {
    return { error: "Commission ka rate 0 se 100 ke darmiyan likhein." };
  }

  const service = createServiceClient();
  const row = {
    name,
    phone,
    contact_person: str(fd, "contact_person"),
    cnic: str(fd, "cnic"),
    village: str(fd, "village"),
    address: str(fd, "address"),
    commission_rate: rate,
    notes: str(fd, "notes"),
  };

  if (id) {
    const { error } = await service.from("crop_lifters").update(row).eq("id", id);
    if (error) return { error: error.message };
    await logAudit({ actionType: "update", module: "Fasal uthane wale", recordId: id, recordLabel: name });
    refresh();
    return ok(`${name} ki tafseel mehfooz ho gayi.`);
  }

  const { data, error } = await service
    .from("crop_lifters")
    .insert({ ...row, created_by: actorId })
    .select("id")
    .single();

  // Ek phone ek uthane wala -- rok database mein lagi hai (226). Us ka
  // paighaam yahan insani zaban mein badla jata hai, warna staff ko
  // "duplicate key value violates unique constraint" parhna parta.
  if (error) {
    if (error.code === "23505") {
      return { error: "Is phone number par pehle se ek uthane wala darj hai. Wohi kholein." };
    }
    return { error: error.message };
  }

  await logAudit({ actionType: "create", module: "Fasal uthane wale", recordId: data.id, recordLabel: name });
  refresh();
  return ok(`${name} fehrist mein aa gaya.`);
}

/**
 * Band karna -- mitana nahi.
 *
 * Us ke naam par bookings aur paise ka hisaab khara hota hai. Mitane se
 * wo hisaab bebuniyad ho jata: qatarein reh jatin aur unhen kis se
 * maangna hai, ye nishan mit jata.
 */
export async function toggleCropLifter(_prev: LifterState, fd: FormData): Promise<LifterState> {
  const id = str(fd, "id");
  const makeActive = str(fd, "active") === "1";
  if (!id) return { error: "Uthane wala nahi mila." };

  const service = createServiceClient();

  if (!makeActive) {
    const { data: bal } = await service
      .from("v_crop_lifter_balances")
      .select("baqi, name")
      .eq("lifter_id", id)
      .maybeSingle();
    // Baqi khara ho to band karna us hisaab ko nazron se ghayab kar deta
    // hai -- aur ghayab hua baqi wapas nahi aata.
    if (bal && Number(bal.baqi) > 0) {
      return {
        error: `${bal.name} ke zimme abhi Rs ${Number(bal.baqi).toLocaleString()} hain. Pehle hisaab saaf karein, phir band karein.`,
      };
    }
  }

  const { error } = await service.from("crop_lifters").update({ is_active: makeActive }).eq("id", id);
  if (error) return { error: error.message };
  await logAudit({
    actionType: "update",
    module: "Fasal uthane wale",
    recordId: id,
    description: makeActive ? "Dobara chalu kiya" : "Band kiya",
  });
  refresh();
  return ok(makeActive ? "Dobara chalu ho gaya." : "Band kar diya gaya.");
}

// ---------------------------------------------------------------------
// 2) Booking par tag
// ---------------------------------------------------------------------

/**
 * Kis ne uthani hai -- ye SIRF ek wada hai.
 *
 * Yahan koi paisa nahi hilta. Rate ka aks rakh liya jata hai kyunke
 * bande ka rate kal badal sakta hai, aur ye sauda aaj ke rate par hua
 * tha.
 */
export async function tagCropLifter(_prev: LifterState, fd: FormData): Promise<LifterState> {
  const actorId = await actor();
  const bookingId = str(fd, "booking_id");
  const lifterId = str(fd, "lifter_id");
  if (!bookingId) return { error: "Booking nahi mili." };
  if (!lifterId) return { error: "Uthane wala chunein." };

  const service = createServiceClient();
  const { data: lifter } = await service
    .from("crop_lifters")
    .select("name, commission_rate, is_active")
    .eq("id", lifterId)
    .maybeSingle();
  if (!lifter) return { error: "Uthane wala nahi mila." };
  if (!lifter.is_active) return { error: `${lifter.name} band hai — pehle usay chalu karein.` };

  const { error } = await service.from("booking_crop_lifts").insert({
    booking_id: bookingId,
    lifter_id: lifterId,
    commission_rate: lifter.commission_rate,
    notes: str(fd, "notes"),
    created_by: actorId,
  });
  if (error) {
    if (error.code === "23505") return { error: "Is booking par pehle se ek uthane wala laga hua hai." };
    return { error: error.message };
  }

  await service
    .from("machinery_booking_events")
    .insert({
      booking_id: bookingId,
      event_type: "crop_lifter_tagged",
      note: `Fasal ${lifter.name} uthayega — commission ${lifter.commission_rate}%`,
      actor_id: actorId,
    });

  refresh(bookingId);
  return ok(`${lifter.name} is booking par lag gaya.`);
}

/** Wada tha, poora nahi hua. Paisa hila hi nahi tha, is liye kuch ulta bhi nahi karna. */
export async function untagCropLifter(_prev: LifterState, fd: FormData): Promise<LifterState> {
  const actorId = await actor();
  const bookingId = str(fd, "booking_id");
  if (!bookingId) return { error: "Booking nahi mili." };

  const service = createServiceClient();
  const { data: lift } = await service
    .from("booking_crop_lifts")
    .select("id, status")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!lift) return { error: "Is booking par koi uthane wala laga hi nahi." };

  // Utha chuki fasal ka tag hatana us settlement ko bebuniyad kar deta
  // jo ledger mein ja chuka hai. Wahan ka raasta ulta karne ka hai,
  // mitane ka nahi.
  if (lift.status === "lifted") {
    return { error: "Fasal utha chuki aur bill ban chuka hai — ab tag nahi hataya ja sakta." };
  }

  const { error } = await service.from("booking_crop_lifts").delete().eq("id", lift.id);
  if (error) return { error: error.message };

  await service.from("machinery_booking_events").insert({
    booking_id: bookingId,
    event_type: "crop_lifter_untagged",
    note: "Uthane wala hata diya gaya",
    actor_id: actorId,
  });

  refresh(bookingId);
  return ok("Uthane wala hata diya gaya.");
}

// ---------------------------------------------------------------------
// 3) Bill -- yahan paisa hilta hai
// ---------------------------------------------------------------------

/**
 * Fasal utha li, qeemat lag gayi -- ab bill.
 *
 * Chaar adad bante hain, aur teen aise hain jo staff nahi likhta:
 *
 *   fasal ki qeemat  -> staff likhta hai (uthane wale ne lagayi)
 *   kattai ka baqi   -> nizam nikalta hai
 *   purana baqi      -> nizam nikalta hai (ledger 1150 - kattai)
 *   commission       -> nizam nikalta hai (qeemat x rate)
 *
 * Ye teen isliye haath se nahi likhwaye jate ke haath ki likhai ek din
 * hisaab se alag ho jati hai, aur us farq ka pata mahine baad chalta
 * hai jab kisi se kam paisa maang liya gaya ho.
 *
 * KATTAI KA BAQI DO JAGAH DARJ HOTA HAI, MAGAR EK HI DAFA GINA JATA HAI:
 * machinery_payments mein `lifter_collected` ki qatar (jis se kisan ka
 * baqi har safhe par khud saaf ho jata hai) aur ledger ki entry. Khata
 * ki view us qatar ko parhti hai, `farmer_old_due_moved` ko alag --
 * dono ka jor kabhi ek doosre par nahi charhta.
 */
export async function recordCropLift(_prev: LifterState, fd: FormData): Promise<LifterState> {
  const actorId = await actor();
  const bookingId = str(fd, "booking_id");
  const cropValue = num(fd, "crop_value");
  const liftDate = str(fd, "lift_date") ?? new Date().toISOString().slice(0, 10);

  if (!bookingId) return { error: "Booking nahi mili." };
  if (cropValue === null || cropValue <= 0) {
    return { error: "Fasal ki qeemat likhein — jitne ki fasal gayi." };
  }

  const service = createServiceClient();

  const { data: lift } = await service
    .from("booking_crop_lifts")
    .select("id, lifter_id, commission_rate, status")
    .eq("booking_id", bookingId)
    .maybeSingle();
  if (!lift) return { error: "Is booking par koi uthane wala laga hi nahi. Pehle usay lagayein." };
  if (lift.status === "lifted") return { error: "Is booking ka bill pehle se ban chuka hai." };
  if (lift.status === "cancelled") return { error: "Ye tag mansookh ho chuka hai." };

  const { data: booking } = await service
    .from("machinery_bookings")
    .select("id, booking_number, farmer_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking?.farmer_id) return { error: "Booking par kisan darj nahi." };

  // Adad NIZAM se aate hain, form se nahi. Aur ye ek hi darwaza hai --
  // wohi function jo safha dikhane ke liye istemal karta hai.
  const { data: breakdownRows, error: bdError } = await service.rpc("fn_farmer_due_breakdown", {
    p_farmer_id: booking.farmer_id,
    p_booking_id: bookingId,
  });
  if (bdError) return { error: `Kisan ka baqi nahi nikala ja saka: ${bdError.message}` };

  const bd = Array.isArray(breakdownRows) ? breakdownRows[0] : breakdownRows;

  // KHALI aur SIFAR ek cheez nahi. Khali ka matlab "main bata hi nahi
  // sakta" hai -- us par bill banana kisan se kam ya zyada maangne ka
  // seedha raasta hai.
  if (!bd || bd.kul_baqi === null || bd.kattai_baqi === null) {
    return { error: "Kisan ka baqi parha nahi ja saka. Bill nahi banaya ja sakta — pehle ye theek karwayein." };
  }
  if (bd.bharosa === false) {
    return {
      error: `Money Trail mein ${bd.unposted ?? "kuch"} qatarein aisi hain jo ledger tak nahi pahunchin — kisan ka baqi adhoora ho sakta hai. Pehle wo saaf karein, phir bill banayein.`,
    };
  }

  const harvestDue = r2(Number(bd.kattai_baqi));
  const oldDue = r2(Number(bd.purana_baqi));
  const commission = r2((cropValue * Number(lift.commission_rate)) / 100);
  const farmerPayable = r2(cropValue - harvestDue - oldDue);
  const lifterPayable = r2(harvestDue + oldDue + commission);

  // Fasal ki qeemat kisan ke qarze se kam ho to kisan ko kuch nahi
  // milta -- aur ye baat saamne aani chahiye, chup chaap manfi adad
  // nahi. Manfi "dena" parh kar koi usay "lena" samajh leta hai.
  if (farmerPayable < 0) {
    return {
      error: `Kisan ka baqi (Rs ${r2(harvestDue + oldDue).toLocaleString()}) fasal ki qeemat (Rs ${cropValue.toLocaleString()}) se zyada hai. Ye bill aise nahi ban sakta — pehle tay karein ke kitna is fasal par kaatna hai.`,
    };
  }

  // Qatar PEHLE, ledger BAAD MEIN -- aur ledger nakaam ho to qatar wapas
  // uthai jati hai. Ulta karte to ledger mein entry par jati aur kisi
  // qatar ka us par daawa na hota: Money Trail par wo hamesha ke liye
  // laal khari rehti.
  let paymentId: string | null = null;
  if (harvestDue > 0) {
    const { data: pay, error: payError } = await service
      .from("machinery_payments")
      .insert({
        booking_id: bookingId,
        kind: "final",
        amount: harvestDue,
        method: "lifter_collected",
        collected_by_lifter_id: lift.lifter_id,
        payment_date: liftDate,
        verification_status: "verified",
        notes: `Kattai ka baqi uthane wale ke zimme — ${booking.booking_number}`,
        created_by: actorId,
      })
      .select("id")
      .single();
    if (payError) return { error: `Kattai ka zimma darj nahi hua: ${payError.message}` };
    paymentId = pay.id;
  }

  const posted = await postCropLiftSettlement({
    bookingId,
    farmerId: booking.farmer_id,
    lifterId: lift.lifter_id,
    harvestDue,
    oldDue,
    commission,
    description: `Fasal uthai — ${booking.booking_number}`,
    ctx: {
      createdBy: actorId,
      entryDate: liftDate,
      claims: [
        { table: "booking_crop_lifts", rowId: lift.id },
        ...(paymentId ? [{ table: "machinery_payments", rowId: paymentId }] : []),
      ],
    },
  });

  if (failed(posted)) {
    if (paymentId) await service.from("machinery_payments").delete().eq("id", paymentId);
    return { error: `Ledger mein nahi gaya, is liye bill nahi banaya: ${posted.error}` };
  }

  const { error: updError } = await service
    .from("booking_crop_lifts")
    .update({
      status: "lifted",
      crop_value: cropValue,
      commission_amount: commission,
      harvest_charge_moved: harvestDue,
      farmer_old_due_moved: oldDue,
      farmer_old_due_reliable: true,
      farmer_payable: farmerPayable,
      lifter_payable: lifterPayable,
      lifted_at: new Date(`${liftDate}T00:00:00Z`).toISOString(),
      lifted_by: actorId,
      moved_at: new Date().toISOString(),
      moved_by: actorId,
      billed_at: new Date().toISOString(),
      billed_by: actorId,
    })
    .eq("id", lift.id);
  if (updError) return { error: updError.message };

  await service.from("machinery_booking_events").insert({
    booking_id: bookingId,
    event_type: "crop_lifted",
    note:
      `Fasal Rs ${cropValue.toLocaleString()} ki gayi. Kisan ko Rs ${farmerPayable.toLocaleString()}, ` +
      `uthane wale ne hamein Rs ${lifterPayable.toLocaleString()} dene hain.`,
    actor_id: actorId,
  });

  refresh(bookingId);
  return ok(
    `Bill ban gaya. Kisan ko Rs ${farmerPayable.toLocaleString()} — uthane wale ne hamein Rs ${lifterPayable.toLocaleString()} dene hain.`
  );
}

// ---------------------------------------------------------------------
// 4) Uthane wale ki adaigi
// ---------------------------------------------------------------------

export async function recordLifterPayment(_prev: LifterState, fd: FormData): Promise<LifterState> {
  const actorId = await actor();
  const lifterId = str(fd, "lifter_id");
  const amount = num(fd, "amount");
  const method = str(fd, "method") ?? "cash";
  const accountId = str(fd, "finance_account_id");
  const payDate = str(fd, "payment_date") ?? new Date().toISOString().slice(0, 10);

  if (!lifterId) return { error: "Uthane wala nahi mila." };
  if (amount === null || amount <= 0) return { error: "Raqam likhein." };

  // Bank/wallet ka paisa kisi khate mein aata hai -- us ka naam likhna
  // lazmi hai, warna paisa aa to gaya magar pahuncha kahin nahi. Cash
  // lene wale ke haath mein hota hai (171 ka wohi faisla).
  if (method !== "cash" && method !== "other" && !accountId) {
    return { error: `"${method}" ke liye khata select karein — warna paisa aaya to hai magar pahuncha kahin nahi.` };
  }

  const service = createServiceClient();

  const { data: bal } = await service
    .from("v_crop_lifter_balances")
    .select("name, baqi")
    .eq("lifter_id", lifterId)
    .maybeSingle();
  if (!bal) return { error: "Uthane wala nahi mila." };

  // Zyada adaigi rokti nahi -- sirf batati hai. Kabhi banda thora zyada
  // de deta hai aur wo agle saude par chalta hai; usay rok dena us ke
  // paise ko darwaze par khara kar deta hai.
  const extra = amount > Number(bal.baqi) ? r2(amount - Number(bal.baqi)) : 0;

  const { data: pay, error: payError } = await service
    .from("crop_lifter_payments")
    .insert({
      lifter_id: lifterId,
      amount,
      payment_date: payDate,
      method,
      finance_account_id: method === "cash" || method === "other" ? null : accountId,
      reference: str(fd, "reference"),
      notes: str(fd, "notes"),
      created_by: actorId,
    })
    .select("id")
    .single();
  if (payError) return { error: payError.message };

  let glAccount: string = ACC.cash;
  if (method === "bank" || method === "wallet") {
    const { data: acc } = await service.from("finance_accounts").select("gl_code").eq("id", accountId!).maybeSingle();
    glAccount = acc?.gl_code ?? ACC.bank;
  }

  const posted = await postCropLifterPayment({
    paymentId: pay.id,
    lifterId,
    amount,
    toAccount: glAccount,
    description: `${bal.name ?? "Uthane wale"} se wasooli`,
    ctx: {
      createdBy: actorId,
      entryDate: payDate,
      claims: [{ table: "crop_lifter_payments", rowId: pay.id }],
    },
  });

  if (failed(posted)) {
    await service.from("crop_lifter_payments").delete().eq("id", pay.id);
    return { error: `Ledger mein nahi gaya, is liye adaigi darj nahi ki: ${posted.error}` };
  }

  await logAudit({
    actionType: "create",
    module: "Fasal uthane wale ki adaigi",
    recordId: pay.id,
    recordLabel: bal.name ?? undefined,
    description: `Rs ${amount.toLocaleString()} — ${method}`,
  });

  refresh();
  revalidatePath(`/admin/machinery-rental/lifters/${lifterId}`);
  return ok(
    extra > 0
      ? `Rs ${amount.toLocaleString()} darj ho gaye — Rs ${extra.toLocaleString()} baqi se zyada hain, wo un ke khate mein jama rahenge.`
      : `Rs ${amount.toLocaleString()} darj ho gaye.`
  );
}
