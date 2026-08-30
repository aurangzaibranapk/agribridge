"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { notifyRoles } from "@/lib/notifications";
import { logAudit } from "@/lib/audit";
import { createServiceClient } from "@/lib/supabase/service";

/**
 * Vendor ka apna raasta.
 *
 * Vendor hamara mulazim nahi -- wo doosri taraf ka bandobast hai. Us ko
 * wo sab kuch dikhana jo staff dekhta hai ghalat hoga (doosre vendors ka
 * kaam, hamara commission ka hisaab, kisan ke paise). Is liye ye file
 * jaan boojh kar chhoti hai: vendor sirf apna kaam bhej sakta hai aur
 * apna khata dekh sakta hai.
 *
 * Aur us ka bheja hua kaam SEEDHA record nahi banta. Wajah ilzam nahi,
 * bunyad hai: bill se vendor ka apna hissa nikalta hai, yani wo apne hi
 * paise ka adad likh raha hota hai. Jis se paisa milna ho wo apni raqam
 * khud tay nahi karta. Is liye us ka indraj dawa rehta hai jab tak
 * hamari team dekh na le (migration 150 mein yehi rok DB par bhi hai).
 */

export interface VendorActionState {
  error?: string;
  success?: boolean;
  notice?: string;
}

function num(formData: FormData, key: string): number | null {
  const raw = formData.get(key);
  if (raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function str(formData: FormData, key: string): string | null {
  const raw = formData.get(key);
  const v = raw === null ? "" : String(raw).trim();
  return v === "" ? null : v;
}

export async function submitVendorWork(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) return { error: "Ye login kisi vendor se juda hua nahi hai." };

  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking chunein." };

  const acres = num(formData, "actual_area_acres");
  const kanal = num(formData, "actual_area_kanal");
  const area = (acres ?? 0) + (kanal ?? 0) / 8;
  if (area <= 0) return { error: "Kitne acre kaate, wo likhein." };

  // Booking waqai isi vendor ki hai? DB par bhi yehi rok hai, magar
  // yahan se saaf jawab milta hai -- wahan se sirf "policy" ka error.
  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id, status, harvest_type")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.vendor_id !== vendor.id) {
    return { error: "Ye booking aap ki machine ki nahi hai." };
  }

  // Do qism ki booking par vendor bhi batwara likhta hai (176). Wo dawa
  // hai, hisaab nahi -- tasdeeq ke baghair ye kahin nahi ginta. Magar
  // batwara wahin puchhna zaroori hai: baad mein daftar ke bande ko
  // yaad nahi hoga ke us din kitna sabit tha aur kitna kutra.
  let sabitArea: number | null = null;
  let kutraArea: number | null = null;
  if (booking.harvest_type === "dono") {
    sabitArea = num(formData, "sabit_area") ?? 0;
    kutraArea = num(formData, "kutra_area") ?? 0;
    if (sabitArea < 0 || kutraArea < 0) return { error: "Raqba manfi nahi ho sakta." };
    if (Math.round((sabitArea + kutraArea) * 10000) !== Math.round(area * 10000)) {
      return {
        error: `Sabit (${sabitArea}) aur Kutra (${kutraArea}) ka jor ${sabitArea + kutraArea} banta hai, kul ${area} acre likha hai. Dono barabar hone chahiye.`,
      };
    }
  }

  const workDate = str(formData, "work_date") ?? new Date().toISOString().slice(0, 10);

  const { error } = await supabase.from("machinery_work_records").insert({
    booking_id: bookingId,
    work_date: workDate,
    is_final: formData.get("is_final") === "on",
    actual_area_acres: acres,
    actual_area_kanal: kanal,
    sabit_area: sabitArea,
    kutra_area: kutraArea,
    started_at: str(formData, "started_at"),
    finished_at: str(formData, "finished_at"),
    meter_reading: num(formData, "meter_reading"),
    completion_photo_url: str(formData, "completion_photo_url"),
    notes: str(formData, "notes"),
    source: "vendor",
    verification_status: "claimed",
    submitted_by: user.id,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    "Vendor ne kaam darj kiya — tasdeeq baqi",
    `${vendor.vendor_name} ne booking ${booking.booking_number} par ${area} acre darj kiya hai.`,
    "/admin/machinery-rental/work-claims"
  );

  revalidatePath("/vendor");
  return {
    success: true,
    notice:
      "Aap ka indraj pohanch gaya. Hamari team dekh kar tasdeeq karegi — us ke baad ye bill ka hissa banega.",
  };
}

/**
 * Vendor ka diesel.
 *
 * Khata yahan NAHI poochha jata: vendor ko pata hi nahi hota ke ART ne
 * kis khate se paisa nikala. Wo sawal tasdeeq ke waqt ka hai. Yahan tak
 * ka indraj sirf ye kehta hai ke itna diesel dala aur kis ne dala.
 */
export async function submitVendorFuel(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) return { error: "Ye login kisi vendor se juda hua nahi hai." };

  const bookingId = str(formData, "booking_id");
  if (!bookingId) return { error: "Booking chunein." };

  // Raqam maangi nahi jati -- litre aur us din ka rate maange jate
  // hain, aur raqam DB khud banata hai (170). Haath se likhi hui
  // raqam wo jagah hai jahan ek sifar zyada lag jata hai.
  const litres = num(formData, "litres");
  const ratePerLitre = num(formData, "rate_per_litre");
  const paidBy = str(formData, "paid_by");
  if (!litres || litres <= 0) return { error: "Kitne litre diesel dala, wo likhein." };
  if (!ratePerLitre || ratePerLitre <= 0) return { error: "Us din diesel ka rate kya tha, wo likhein." };
  if (!paidBy) return { error: "Diesel kis ne dala, wo batayein." };

  const amount = Math.round(litres * ratePerLitre * 100) / 100;

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.vendor_id !== vendor.id) {
    return { error: "Ye booking aap ki machine ki nahi hai." };
  }

  const { error } = await supabase.from("machinery_fuel_logs").insert({
    booking_id: bookingId,
    log_date: str(formData, "log_date") ?? new Date().toISOString().slice(0, 10),
    litres,
    rate_per_litre: ratePerLitre,
    amount,
    paid_by: paidBy,
    notes: str(formData, "notes"),
    source: "vendor",
    verification_status: "claimed",
    submitted_by: user.id,
    created_by: user.id,
  });
  if (error) return { error: error.message };

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    "Vendor ne diesel darj kiya — tasdeeq baqi",
    `${vendor.vendor_name} ne booking ${booking.booking_number} par Rs ${amount.toLocaleString()} ka diesel darj kiya hai.`,
    "/admin/machinery-rental/work-claims"
  );

  revalidatePath("/vendor");
  return {
    success: true,
    notice: "Diesel ka indraj pohanch gaya. Hamari team dekh kar tasdeeq karegi.",
  };
}

/**
 * Vendor ka login banana.
 *
 * Do baatein jaan boojh kar aisi hain.
 *
 * Pehli: email lazmi nahi. Machine walon ke paas aksar email hota hi
 * nahi, magar phone hamesha hota hai. Email na ho to us ke phone se ek
 * bana diya jata hai -- wo sirf login ka naam hai, koi us par khat nahi
 * bhejta. Us ke baghair bohat se vendors kabhi login na kar pate.
 *
 * Doosri: password yahan ek dafa dikhaya jata hai aur kahin mehfooz
 * nahi hota. Mehfooz rakhne ka matlab hota ke jo bhi ye safha khole wo
 * har vendor ke khate mein daakhil ho sake. Vendor bhool jaye to naya
 * banaya jata hai -- purana dhoondhne ka koi rasta nahi hona chahiye.
 */
/**
 * Kisan ne mujhe paisa diya -- vendor apne haath se.
 *
 * Ye roz hota hai: kisan machine wale ke haath mein paisa pakraata
 * hai. Ab tak wo baat sirf tab likhi jati thi jab vendor hamare bande
 * ko batata aur wo darj karta -- yani us ke aur record ke darmiyan ek
 * insaan aur do din khare rehte the. Beech mein kisan phone karta
 * ke "maine to de diya hai", aur hamari qatar mein wo raqam kahin
 * nahi hoti.
 *
 * Magar KEHNA hisaab nahi hai. Ye indraj 'claimed' rehta hai: kisi
 * khate mein nahi jata, kisan ka baqi kam nahi karta, cash book mein
 * nazar nahi aata. Sirf hamari fehrist mein khara ho jata hai ke ise
 * dekho -- aur tasdeeq ke baad hi wo hisaab banta hai.
 *
 * Ek sawal aur poochha jata hai jo baad mein sab se zyada ulajhta
 * hai: wo paisa vendor ne APNE hisse mein rakh liya, ya wo hamein
 * de raha hai? Hisaab mein ye do bilkul alag baatein hain, aur baad
 * mein poochho to kisi ko theek yaad nahi rehta.
 */
export async function submitVendorCollection(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) return { error: "Ye login kisi vendor se juda hua nahi hai." };

  const bookingId = str(formData, "booking_id");
  const amount = num(formData, "amount") ?? 0;
  const settlement = str(formData, "settlement");
  if (!bookingId) return { error: "Booking chunein." };
  if (amount <= 0) return { error: "Raqam likhein." };
  if (settlement !== "kept" && settlement !== "handed_over") {
    return { error: "Batayein ke wo paisa aap ne rakha ya hamein de rahe hain." };
  }

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id, farmer_id")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.vendor_id !== vendor.id) {
    return { error: "Ye booking aap ki machine ki nahi hai." };
  }

  // Shart DB par bhi lagi hui hai (167). Yahan wohi qeematein bheji
  // ja rahi hain -- agar kabhi yahan koi ghalti ho jaye to indraj
  // wahan ruk jayega, aur wohi theek hai.
  const { error } = await supabase.from("machinery_payments").insert({
    booking_id: bookingId,
    kind: "final",
    amount,
    method: "vendor_collected",
    payment_date: str(formData, "payment_date") ?? new Date().toISOString().slice(0, 10),
    reference: str(formData, "reference"),
    collected_by_vendor_id: vendor.id,
    vendor_settlement: settlement,
    verification_status: "claimed",
    claimed_by: user.id,
    claimed_at: new Date().toISOString(),
  });
  if (error) return { error: error.message };

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    "Vendor ne kisan se li hui raqam darj ki — tasdeeq baqi",
    `${vendor.vendor_name} kehte hain ke booking ${booking.booking_number} par kisan ne Rs ${amount.toLocaleString()} unhein diye` +
      (settlement === "kept" ? " aur wo unhon ne apne hisse mein rakh liye." : " aur wo hamein de rahe hain."),
    "/admin/machinery-rental/work-claims"
  );

  revalidatePath("/vendor");
  return {
    success: true,
    notice: "Aap ka indraj pohanch gaya. Hamari team dekh kar tasdeeq karegi — us ke baad hi ye hisaab mein aayega.",
  };
}

/**
 * "Khet pahunch gaya" aur "kaam shuru ho gaya".
 *
 * Ye do khabrein kahin darj nahi hoti thin. Kisan phone karta hai ke
 * "machine abhi tak nahi aayi" aur hamare paas jawab nahi hota --
 * sirf itna pata hota hai ke machine bheji ja chuki hai.
 *
 * Ye PAISE ki baat nahi, is liye tasdeeq bhi nahi: kisi hisaab par
 * is ka koi asar nahi. Sirf khabar hai -- aur khabar ka der se aana
 * hi us ka sab se bara masla hai.
 *
 * Waqt bhi vendor se nahi maanga jata, wo khud lag jata hai. "Kab
 * pahunche the" poochhne par jawab hamesha thora sa behtar hota hai
 * asal se.
 */
export async function markVendorProgress(
  _prev: VendorActionState,
  formData: FormData
): Promise<VendorActionState> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: vendor } = await supabase
    .from("machinery_vendors")
    .select("id, vendor_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vendor) return { error: "Ye login kisi vendor se juda hua nahi hai." };

  const bookingId = str(formData, "booking_id");
  const step = str(formData, "step");
  if (!bookingId) return { error: "Booking chunein." };
  if (step !== "reached" && step !== "started") return { error: "Kya hua, wo batayein." };

  const { data: booking } = await supabase
    .from("machinery_bookings")
    .select("id, booking_number, vendor_id, reached_farm_at, work_started_at")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking || booking.vendor_id !== vendor.id) {
    return { error: "Ye booking aap ki machine ki nahi hai." };
  }

  // Ek dafa lagi hui khabar dobara nahi lagti. Dobara lagne se waqt
  // badal jata, aur "kab pahunche the" ka jawab har dafa naya hota.
  if (step === "reached" && booking.reached_farm_at) {
    return { error: "Ye pehle hi darj ho chuka hai." };
  }
  if (step === "started" && booking.work_started_at) {
    return { error: "Ye pehle hi darj ho chuka hai." };
  }

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("machinery_bookings")
    .update(step === "reached" ? { reached_farm_at: now } : { work_started_at: now })
    .eq("id", bookingId);
  if (error) return { error: error.message };

  await notifyRoles(
    ["manager", "super_admin", "admin", "owner"],
    step === "reached" ? "Machine khet pahunch gayi" : "Kattai shuru ho gayi",
    `${vendor.vendor_name} — booking ${booking.booking_number}`,
    `/admin/machinery-rental/booking/${bookingId}`
  );

  revalidatePath("/vendor");
  revalidatePath(`/admin/machinery-rental/booking/${bookingId}`);
  return {
    success: true,
    notice: step === "reached" ? "Darj ho gaya: machine khet pahunch gayi." : "Darj ho gaya: kaam shuru.",
  };
}

/**
 * Naam se login ka pata banana.
 *
 * "Noman Shah" se "nomanshah@alranatraders.pk". Phone number wala
 * pata ("vendor03457583294@...") koi yaad nahi rakh sakta, aur phone
 * par bolna pare to teen dafa dohrana parta hai. Naam wala pata
 * vendor khud pehchanta hai.
 *
 * Number login ke liye theek bhi nahi tha: number badal jata hai, aur
 * tab login us number se juRa rehta hai jo ab kisi aur ka hai.
 *
 * Naam mein huroof hi na hon (sirf adad ya nishan) to phone par gir
 * jate hain -- koi login na hona us se bura hai.
 */
function vendorLoginStem(vendorName: string, phone: string | null): string | null {
  const base = (vendorName ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");
  return base || (phone ?? "").replace(/\D/g, "") || null;
}

export async function createVendorLogin(
  _prev: VendorActionState & { loginId?: string; password?: string },
  formData: FormData
): Promise<VendorActionState & { loginId?: string; password?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active || !["admin", "owner", "super_admin", "manager"].includes(String(profile.role))) {
    return { error: "Vendor ka login sirf admin ya manager bana sakta hai." };
  }

  const vendorId = str(formData, "vendor_id");
  if (!vendorId) return { error: "Vendor nahi mila." };

  const service = createServiceClient();
  const { data: vendor } = await service
    .from("machinery_vendors")
    .select("id, vendor_name, phone, user_id")
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor) return { error: "Vendor nahi mila." };
  if (vendor.user_id) {
    return { error: "Is vendor ka login pehle se maujood hai. Password bhool gaye ho to naya password banayein." };
  }

  // Login vendor ke NAAM se banta hai, phone number se nahi.
  //
  // "vendor03457583294@..." wo cheez hai jo koi yaad nahi rakh sakta,
  // aur phone par bolni pare to teen dafa dohrani parti hai. Naam se
  // bana hua login vendor khud pehchanta hai: "nomanshah".
  //
  // Phone number login banane ke liye theek bhi nahi tha: number badal
  // jata hai, aur tab login us number se juRa rehta hai jo ab kisi aur
  // ka hai.
  const typedEmail = str(formData, "email");
  const stem = vendorLoginStem(vendor.vendor_name, vendor.phone);
  if (!typedEmail && !stem) {
    return { error: "Vendor ka naam ya phone chahiye — login ka pata inhi mein se banta hai." };
  }

  // Password aisa jo phone par bola ja sake: gine chune huroof, koi
  // aisa jora nahi jo sun kar galat likha jaye (0/O, 1/l).
  const password = makeSpokenPassword();

  // Do vendor ek hi naam ke ho sakte hain -- gaon mein aadha naam
  // mushtarak hota hai. Us soorat mein doosre ko "nomanshah2" milta
  // hai. Ginti tab lagti hai jab waqai takrao ho, pehle se nahi:
  // "nomanshah1" bila wajah ajeeb lagta hai.
  //
  // Takrao pehle se dhoondne ke bajaye banane ki koshish ki jati hai:
  // dono ke darmiyan koi doosra wohi pata le sakta hai, aur asli jawab
  // banane wale se hi milta hai.
  let loginId = typedEmail ?? `${stem}@alranatraders.pk`;
  let created: Awaited<ReturnType<typeof service.auth.admin.createUser>>["data"] | null = null;
  let authError: { message: string } | null = null;

  for (let n = 0; n < 20; n += 1) {
    if (!typedEmail && stem) loginId = `${stem}${n === 0 ? "" : n + 1}@alranatraders.pk`;
    const res = await service.auth.admin.createUser({
      email: loginId,
      password,
      email_confirm: true,
      user_metadata: { full_name: vendor.vendor_name, vendor_id: vendor.id },
    });
    if (res.data?.user) {
      created = res.data;
      authError = null;
      break;
    }
    authError = res.error ? { message: res.error.message } : { message: "Login nahi ban saka." };
    const busy = /already|registered|exists/i.test(authError.message);
    // Pata pehle se kisi aur ka hai to agla azmate hain. Koi aur
    // wajah ho to dohrane ka faida nahi -- wahi ghalti dobara aayegi.
    if (!busy || typedEmail) break;
  }

  if (authError || !created?.user) {
    return { error: authError?.message ?? "Login nahi ban saka." };
  }

  // Profile chahiye: login ke baad safha darje se hi tay hota hai ke
  // aadmi kahan jayega. Darja machinery_vendor hai, staff wala nahi --
  // staff ke darje /admin ka darwaza kholte hain.
  const { error: profileError } = await service.from("profiles").upsert(
    {
      id: created.user.id,
      full_name: vendor.vendor_name,
      role: "machinery_vendor",
      is_active: true,
    },
    { onConflict: "id" }
  );
  if (profileError) {
    await service.auth.admin.deleteUser(created.user.id);
    return { error: profileError.message };
  }

  const { error: linkError } = await service
    .from("machinery_vendors")
    .update({ user_id: created.user.id })
    .eq("id", vendorId);
  if (linkError) {
    await service.auth.admin.deleteUser(created.user.id);
    return { error: linkError.message };
  }

  await logAudit({
    actionType: "create",
    module: "machinery_vendors",
    recordId: vendorId,
    recordLabel: vendor.vendor_name,
    description: `Vendor ka login banaya gaya: ${loginId}`,
  });

  revalidatePath("/admin/machinery-rental");
  return {
    success: true,
    loginId,
    password,
    notice:
      "Login ban gaya. Ye password sirf ABHI nazar aa raha hai -- ise vendor tak pohancha dein. Kahin mehfooz nahi kiya gaya.",
  };
}

/**
 * Naya password -- purana bhool jane par.
 *
 * Purana password kahin rakha hi nahi jata, is liye "yaad dilana"
 * mumkin nahi. Naya banana hi wahid rasta hai, aur wohi theek hai.
 */
export async function resetVendorPassword(
  _prev: VendorActionState & { loginId?: string; password?: string },
  formData: FormData
): Promise<VendorActionState & { loginId?: string; password?: string }> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Pehle login karein." };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.is_active || !["admin", "owner", "super_admin", "manager"].includes(String(profile.role))) {
    return { error: "Vendor ka password sirf admin ya manager badal sakta hai." };
  }

  const vendorId = str(formData, "vendor_id");
  if (!vendorId) return { error: "Vendor nahi mila." };

  const service = createServiceClient();
  const { data: vendor } = await service
    .from("machinery_vendors")
    .select("id, vendor_name, user_id")
    .eq("id", vendorId)
    .maybeSingle();
  if (!vendor?.user_id) return { error: "Is vendor ka abhi koi login nahi hai." };

  const password = makeSpokenPassword();
  const { error } = await service.auth.admin.updateUserById(vendor.user_id, { password });
  if (error) return { error: error.message };

  const { data: authUser } = await service.auth.admin.getUserById(vendor.user_id);

  await logAudit({
    actionType: "update",
    module: "machinery_vendors",
    recordId: vendorId,
    recordLabel: vendor.vendor_name,
    description: "Vendor ka password naya banaya gaya",
  });

  return {
    success: true,
    loginId: authUser?.user?.email ?? undefined,
    password,
    notice: "Naya password ban gaya. Ye sirf ABHI nazar aa raha hai.",
  };
}

// Aisa password jo phone par bola ja sake. 0/O aur 1/l jaise jore
// nikal diye gaye hain -- wo sun kar hamesha galat likhe jate hain.
function makeSpokenPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[Math.floor(Math.random() * set.length)]).join("");
  return `${pick(letters, 4)}${pick(digits, 4)}`;
}
