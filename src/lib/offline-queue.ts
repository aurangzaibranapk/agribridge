/**
 * Device par rukhi hui entries (IndexedDB).
 *
 * Gaon mein network aata jata rehta hai. MCA ka kaam us par nahi ruk
 * sakta -- doodh subah uthta hai, chahe signal ho ya na ho. Is liye
 * entry pehle device par girti hai aur network aane par khud chali jati
 * hai.
 *
 * localStorage jaan boojh kar nahi: LR ki tasveerein us ki hadd (aam tor
 * par 5 MB) foran bhar deti hain, aur bharne par wo bagair bataye
 * nakaam hota hai -- yani entry chup chaap gum. IndexedDB ki gunjaish
 * bohot zyada hai.
 *
 * Chaabi client_uuid hai. Wohi nishan server par bhi jata hai, is liye
 * ek entry chahe jitni dafa bheji jaye, banti ek hi baar hai.
 */

const DB_NAME = "agribridge-offline";
const DB_VERSION = 1;
const STORE = "milk-queue";

export interface QueuedItem {
  client_uuid: string;
  farmer_id?: string;
  farmer_code?: string;
  farmer_label: string;
  liters: number;
  lr: number | null;
  shift: string;
  collected_at: string;
  lr_image_base64?: string;
  lr_image_mime?: string;
  /** Server ne wajah batayi -- ab khud se dobara nahi bheja jayega. */
  error?: string;
  queued_at: string;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "client_uuid" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Device ka khana khul nahi saka."));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const request = run(tx.objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Device par likha nahi ja saka."));
    tx.oncomplete = () => db.close();
  });
}

export async function queueAdd(item: QueuedItem): Promise<void> {
  await withStore("readwrite", (store) => store.put(item) as IDBRequest<IDBValidKey>);
}

export async function queueAll(): Promise<QueuedItem[]> {
  const rows = await withStore<QueuedItem[]>("readonly", (store) => store.getAll() as IDBRequest<QueuedItem[]>);
  return rows.sort((a, b) => a.queued_at.localeCompare(b.queued_at));
}

export async function queueRemove(clientUuid: string): Promise<void> {
  await withStore("readwrite", (store) => store.delete(clientUuid) as IDBRequest<undefined>);
}

export async function queueMarkError(clientUuid: string, error: string): Promise<void> {
  const rows = await queueAll();
  const found = rows.find((r) => r.client_uuid === clientUuid);
  if (!found) return;
  await queueAdd({ ...found, error });
}

export function offlineSupported(): boolean {
  return typeof window !== "undefined" && "indexedDB" in window;
}
