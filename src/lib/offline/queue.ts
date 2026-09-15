/**
 * Har module ke liye ek hi qatar (IndexedDB).
 *
 * Doodh ke liye ye kaam pehle se ho chuka hai aur chal raha hai
 * (`src/lib/offline-queue.ts`). Wo qatar sirf doodh ki shakal ki hai --
 * us ke andar `liters`, `lr`, `shift` type mein jame hue hain -- is liye
 * machinery ka kaam, diesel, cash ya hazri us mein nahi rakhe ja sakte.
 *
 * Ye us ka aam roop hai. Doodh wali file ko HAATH NAHI LAGAYA GAYA: wo
 * production mein chal rahi hai, aur do cheezein ek sath badalna wahi
 * ghalti hoti hai jis mein pata nahi chalta ke kaun si toot-i.
 *
 * DATABASE ALAG KYUN HAI
 *
 * Doodh wali qatar `agribridge-offline` (version 1) kholti hai. Agar ye
 * usi database ko version 2 par kholta, to purana code us ke baad
 * VersionError par gir jata -- yani doodh ki entry us phone par foran
 * ruk jati jahan dono chal rahe hon. Is liye ye apna alag database
 * kholta hai. Jis din doodh is engine par aayega, us din wo apni qatar
 * yahan le aayega -- ek qadam, apne waqt par.
 *
 * TASVEEREIN BLOB MEIN, base64 MEIN NAHI
 *
 * base64 asal file se takreeban ek tihai bara hota hai, aur JSON mein
 * ja kar poora memory mein khulta hai. Chaar paanch tasveerein ho jayen
 * to qatar parhna hi bhaari ho jata hai. IndexedDB Blob seedha rakhta
 * hai -- na barhta hai, na parhne par khulta hai. Is liye tasveerein
 * apne alag khane mein Blob ki shakal mein rehti hain, aur qatar ki
 * qatar chhoti aur tez rehti hai.
 */

const DB_NAME = "agribridge-queue";
const DB_VERSION = 1;

const STORE_ACTIONS = "actions";
const STORE_EVIDENCE = "evidence";
const STORE_META = "meta";

/** Qatar mein pari hui cheez kis haal mein hai. */
export type SyncStatus =
  /** Bhejne ka intezar. */
  | "pending"
  /** Abhi ja rahi hai. */
  | "syncing"
  /** Server tak pahunch gayi. */
  | "synced"
  /**
   * Server ne wajah ke sath mana kar diya (ghalat raqba, ijazat nahi,
   * booking band ho chuki). Ise dobara bhejne ka koi fayda nahi -- wajah
   * bande ke saamne aani chahiye. Network ki nakaami is se ALAG hai: wo
   * `pending` hi rehti hai aur khud dobara chali jati hai.
   */
  | "needs_attention";

export interface QueuedAction {
  /**
   * Chaabi. Device par banti hai, BHEJNE SE PEHLE -- yehi wajah hai ke
   * dobara bhejne par bhi qatar ek hi banti hai. Server par is par
   * unique index laga hua hai (189).
   */
  client_action_id: string;
  /** Kaun sa kaam -- jaise "machinery.work". */
  action_type: string;
  /** Kis cheez par -- jaise "machinery_work_records". */
  entity_type: string;
  payload: Record<string, unknown>;
  device_id: string;
  created_at: string;
  sync_status: SyncStatus;
  retry_count: number;
  last_error: string | null;
  last_attempt_at: string | null;
  /** Kitni tasveerein is ke sath hain (asal Blob alag khane mein). */
  evidence_count: number;
}

export interface EvidenceBlob {
  id: string;
  action_id: string;
  blob: Blob;
  mime: string;
  /** Kis khane mein jayegi, jaise "completion_photo". */
  slot: string;
}

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_ACTIONS)) {
        db.createObjectStore(STORE_ACTIONS, { keyPath: "client_action_id" });
      }
      if (!db.objectStoreNames.contains(STORE_EVIDENCE)) {
        const s = db.createObjectStore(STORE_EVIDENCE, { keyPath: "id" });
        s.createIndex("by_action", "action_id", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META, { keyPath: "key" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Device ka khana khul nahi saka."));
  });
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(store, mode);
        const req = fn(tx.objectStore(store));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error ?? new Error("Device par likha nahi ja saka."));
        tx.oncomplete = () => db.close();
      })
  );
}

/**
 * Is phone ka nishan.
 *
 * Ek hi bande ke do phone ho sakte hain, aur jab do jagah se ek jaisi
 * entry aaye to ye batata hai ke kis device se aayi. Device ka nishan
 * bhi IndexedDB mein rehta hai -- localStorage mein nahi, jo browser ka
 * data saaf karne par chup chaap gayab ho jata hai.
 */
export async function deviceId(): Promise<string> {
  const found = await run<{ key: string; value: string } | undefined>(
    STORE_META, "readonly", (s) => s.get("device_id") as IDBRequest<{ key: string; value: string } | undefined>
  );
  if (found?.value) return found.value;
  const fresh = crypto.randomUUID();
  await run(STORE_META, "readwrite", (s) => s.put({ key: "device_id", value: fresh }) as IDBRequest<IDBValidKey>);
  return fresh;
}

/**
 * Tasveer ko chhota karna -- bhejne se pehle, device par hi.
 *
 * Phone ki tasveer 4-6 MB ki hoti hai. Us ka poora hona kisi kaam ka
 * nahi: yahan sawal ye hai ke "kaam hua ya nahi", aur us ka jawab 1200
 * pixel ki tasveer bhi utni hi achhi tarah deti hai. Chhoti tasveer
 * kamzor network par pahunch bhi jati hai; 5 MB wali beech mein tootti
 * rehti hai aur qatar bhari kar deti hai.
 */
export async function compressImage(
  file: Blob,
  { maxSide = 1280, quality = 0.7 }: { maxSide?: number; quality?: number } = {}
): Promise<Blob> {
  if (typeof createImageBitmap !== "function" || typeof OffscreenCanvas === "undefined") {
    return file;
  }
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const out = await canvas.convertToBlob({ type: "image/jpeg", quality });
    // Chhoti karne par bari ho jaye to asal hi behtar hai.
    return out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

/** Qatar mein daalna. Chaabi yahin banti hai -- bhejne se pehle. */
export async function enqueue(input: {
  actionType: string;
  entityType: string;
  payload: Record<string, unknown>;
  evidence?: Array<{ blob: Blob; slot: string }>;
}): Promise<string> {
  const clientActionId = crypto.randomUUID();
  const device = await deviceId();
  const evidence = input.evidence ?? [];

  // Tasveerein PEHLE likhi jati hain. Ulta karte to qatar mein aisi
  // entry aa jati jis ki tasveer kabhi likhi hi na gayi ho -- aur wo
  // "mukammal" nazar aati.
  for (const e of evidence) {
    await run(STORE_EVIDENCE, "readwrite", (s) =>
      s.put({
        id: crypto.randomUUID(),
        action_id: clientActionId,
        blob: e.blob,
        mime: e.blob.type || "image/jpeg",
        slot: e.slot,
      } satisfies EvidenceBlob) as IDBRequest<IDBValidKey>
    );
  }

  const action: QueuedAction = {
    client_action_id: clientActionId,
    action_type: input.actionType,
    entity_type: input.entityType,
    payload: input.payload,
    device_id: device,
    created_at: new Date().toISOString(),
    sync_status: "pending",
    retry_count: 0,
    last_error: null,
    last_attempt_at: null,
    evidence_count: evidence.length,
  };
  await run(STORE_ACTIONS, "readwrite", (s) => s.put(action) as IDBRequest<IDBValidKey>);
  return clientActionId;
}

export async function allActions(): Promise<QueuedAction[]> {
  const rows = await run<QueuedAction[]>(STORE_ACTIONS, "readonly", (s) => s.getAll() as IDBRequest<QueuedAction[]>);
  return rows.sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export async function pendingActions(): Promise<QueuedAction[]> {
  return (await allActions()).filter((a) => a.sync_status === "pending" || a.sync_status === "syncing");
}

export async function evidenceFor(actionId: string): Promise<EvidenceBlob[]> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_EVIDENCE, "readonly");
    const req = tx.objectStore(STORE_EVIDENCE).index("by_action").getAll(actionId);
    req.onsuccess = () => resolve(req.result as EvidenceBlob[]);
    req.onerror = () => reject(req.error);
    tx.oncomplete = () => db.close();
  });
}

async function patch(id: string, change: Partial<QueuedAction>): Promise<void> {
  const found = await run<QueuedAction | undefined>(
    STORE_ACTIONS, "readonly", (s) => s.get(id) as IDBRequest<QueuedAction | undefined>
  );
  if (!found) return;
  await run(STORE_ACTIONS, "readwrite", (s) => s.put({ ...found, ...change }) as IDBRequest<IDBValidKey>);
}

export const markSyncing = (id: string) =>
  patch(id, { sync_status: "syncing", last_attempt_at: new Date().toISOString() });

/**
 * Network ne dhoka diya -- ye ghalti nahi, intezar hai.
 *
 * Entry `pending` par wapas aati hai aur agli dafa khud chali jayegi.
 * `retry_count` sirf ginti ke liye barhta hai, rokne ke liye nahi.
 */
export const markRetryable = (id: string, retryCount: number, error: string) =>
  patch(id, { sync_status: "pending", retry_count: retryCount + 1, last_error: error });

/**
 * Server ne wajah ke sath mana kar diya.
 *
 * Ise dobara bhejna bekaar hai -- jawab har dafa wohi aayega. Entry
 * rukti hai aur wajah ke sath bande ke saamne aati hai. Ye farq na
 * rakhte to ghalat entry hamesha ke liye qatar mein baithi rehti aur
 * har dafa nakaam hoti, aur kisi ko pata na chalta ke masla kya hai.
 */
export const markNeedsAttention = (id: string, error: string) =>
  patch(id, { sync_status: "needs_attention", last_error: error });

/** Server tak pahunch gayi -- ab device par rakhne ki zaroorat nahi. */
export async function markSynced(id: string): Promise<void> {
  const shots = await evidenceFor(id);
  for (const shot of shots) {
    await run(STORE_EVIDENCE, "readwrite", (s) => s.delete(shot.id) as IDBRequest<undefined>);
  }
  await run(STORE_ACTIONS, "readwrite", (s) => s.delete(id) as IDBRequest<undefined>);
}

/**
 * Nakaam entry ko banda khud hata sakta hai -- magar khud, chup chaap
 * nahi. Jo cheez bina bataye gayab ho jaye, us par kisi ko bharosa nahi
 * rehta.
 */
export const dropAction = (id: string) => markSynced(id);

export interface QueueCounts {
  pending: number;
  syncing: number;
  needsAttention: number;
  total: number;
}

export async function queueCounts(): Promise<QueueCounts> {
  const rows = await allActions();
  return {
    pending: rows.filter((r) => r.sync_status === "pending").length,
    syncing: rows.filter((r) => r.sync_status === "syncing").length,
    needsAttention: rows.filter((r) => r.sync_status === "needs_attention").length,
    total: rows.length,
  };
}
