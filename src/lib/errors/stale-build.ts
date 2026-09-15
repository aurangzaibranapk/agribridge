/**
 * Purane build ka khula hua safha -- aur us ka apne aap theek ho jana.
 *
 * =====================================================================
 * MALIK KI SHIKAYAT (6 September)
 * =====================================================================
 *
 *   *"Page refresh hota hai, data aa jata hai, phir 1 minute baad ya
 *   kuch time baad ye ho jata hai... aur bhi kafi jagon par aisa hota
 *   hai jo ke nahi hona chahiye."*
 *
 * Screen par ya to "Application error: a client-side exception has
 * occurred" aata hai, ya "Loading chunk 7164 failed".
 *
 * =====================================================================
 * YE HOTA KYUN HAI
 * =====================================================================
 *
 * Next.js safha ek dafa mein poora nahi bhejta. Wo pehle sirf utna
 * bhejta hai jitna abhi nazar aana hai, aur baqi hisse (chunks) baad
 * mein maangta hai -- jab banda kisi cheez par dabaye, ya jab background
 * mein agla safha pehle se tayar kiya ja raha ho.
 *
 * Har build ke chunks ka apna naam hota hai (`7164-10c7a0ca....js`).
 * Naya build server par charhte hi PURANE naam ke chunks khatam ho jate
 * hain.
 *
 * Ab jis bande ka safha PEHLE se khula tha, us ke browser mein abhi bhi
 * purana safha chal raha hai. Wo jab agla hissa maangta hai, wo naam ab
 * server par hai hi nahi -- aur safha toot jata hai.
 *
 * Yehi wajah hai ke "refresh karne par theek ho jata hai, phir kuch der
 * baad dobara" -- refresh naya safha laata hai, magar agar us ke baad
 * app dobara chale (cPanel par Passenger process ko band kar ke naya
 * chalata hai) to wohi kahani dobara.
 *
 * =====================================================================
 * ILAAJ
 * =====================================================================
 *
 * Ye kharabi hai hi nahi -- ye sirf ek PURANA SAFHA hai. Aur purane
 * safhe ka ek hi ilaaj hai: naya lena.
 *
 * Is liye ab is qism ki khata par safha KHUD ek dafa refresh ho jata
 * hai, aur bande ko koi laal safha nazar hi nahi aata.
 *
 * **Ek dafa** -- ye lafz ahem hai. Agar khata kisi aur wajah se aa rahi
 * ho to bar bar refresh karna safhe ko chakkar mein daal deta, aur banda
 * kabhi kuch parh hi na pata. Is liye pichhle refresh ka waqt
 * `sessionStorage` mein rakha jata hai: das second ke andar doosra
 * refresh nahi hota, aur us surat mein wohi purana laal safha aata hai
 * jis par wajah likhi hoti hai.
 */

const KEY = "ab:stale-build-reload";

/** Das second -- ek deploy ke liye kaafi, chakkar ke liye kam. */
const DOBARA_NA_KAREIN_MS = 10_000;

/**
 * Kya ye khata purane build ki wajah se hai?
 *
 * Browser har ek apne alfaz likhta hai, is liye naam aur paighaam dono
 * dekhe jate hain. Chrome "Loading chunk N failed" kehta hai, Firefox
 * "error loading dynamically imported module", Safari "Importing a
 * module script failed".
 */
export function puranaBuildKiKharabi(error: unknown): boolean {
  if (!error) return false;
  const e = error as { name?: string; message?: string };
  if (e.name === "ChunkLoadError") return true;

  const m = String(e.message ?? "");
  return (
    /loading chunk \S+ failed/i.test(m) ||
    /loading css chunk/i.test(m) ||
    /failed to fetch dynamically imported module/i.test(m) ||
    /error loading dynamically imported module/i.test(m) ||
    /importing a module script failed/i.test(m) ||
    // Next ka apna signal jab RSC ka jawab purane build ka ho.
    /failed to load script/i.test(m)
  );
}

/**
 * Agar purane build ki baat hai to safha khud naya le aata hai.
 *
 * Jawab `true` ho to bulane wale ko kuch dikhane ki zaroorat nahi --
 * safha waise bhi ja raha hai.
 */
export function puranaSafhaKhudTheekKarein(error: unknown): boolean {
  if (typeof window === "undefined") return false;
  if (!puranaBuildKiKharabi(error)) return false;

  try {
    const pichhla = Number(window.sessionStorage.getItem(KEY) ?? "0");
    if (Number.isFinite(pichhla) && Date.now() - pichhla < DOBARA_NA_KAREIN_MS) {
      // Abhi abhi refresh kiya tha aur baat phir bhi nahi bani -- yani
      // masla kuch aur hai. Ab laal safha dikhna hi chahiye.
      return false;
    }
    window.sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // Private window mein sessionStorage band ho sakti hai. Us surat
    // mein bhi ek refresh kar dena behtar hai -- chakkar ka khatra
    // us se kam hai jitna nuqsan toote hue safhe ka.
  }

  // `location.reload()` kabhi kabhi browser ke apne cache se wohi purana
  // safha wapas de deta hai. URL par ek nishan lagane se wo majboor ho
  // jata hai ke server se naya laaye.
  const url = new URL(window.location.href);
  url.searchParams.set("_r", String(Date.now()));
  window.location.replace(url.toString());
  return true;
}
