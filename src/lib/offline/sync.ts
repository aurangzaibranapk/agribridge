import {
  allActions, evidenceFor, markNeedsAttention, markRetryable, markSynced, markSyncing,
  pendingActions, type QueuedAction,
} from "@/lib/offline/queue";

/**
 * Qatar ko server tak pahunchana.
 *
 * Doodh wale sync se do sabaq seedha yahan aaye hain, kyunke wo do
 * baatein khet mein hi maloom hoti hain:
 *
 *   CHHOTE GUCHHON MEIN. Gaon ke network par bara paighaam beech mein
 *   toot jata hai aur poora dobara bhejna parta hai. Chhote guchhon
 *   mein jo pahunch gaya wo pahunch gaya.
 *
 *   DO QISM KI NAKAAMI ALAG HAIN. Network ka na milna GHALTI NAHI,
 *   intezar hai -- entry device par rehti hai aur agli dafa khud chali
 *   jati hai. Server ka wajah ke sath mana kar dena alag baat hai --
 *   usay dobara bhejne ka koi fayda nahi, jawab har dafa wohi aayega.
 *   Wo entry rukti hai aur wajah ke sath bande ke saamne aati hai.
 *
 *   Farq na rakhte to ghalat entry hamesha qatar mein baithi rehti,
 *   har dafa nakaam hoti, aur kisi ko pata na chalta ke masla kya hai.
 *
 * CHAABI YAHAN NAHI BANTI. Wo qatar mein daalte waqt bani thi -- bhejne
 * se pehle. Yehi wajah hai ke chaahe ye function das dafa chale, server
 * par qatar ek hi banti hai.
 */

const BATCH = 5;

/** Ek qatar kis raaste se jayegi. Har module apna raasta yahan likhta hai. */
export type Sender = (
  action: QueuedAction,
  evidence: Array<{ blob: Blob; slot: string; mime: string }>
) => Promise<{ ok: true } | { ok: false; retryable: boolean; error: string }>;

const senders = new Map<string, Sender>();

export function registerSender(actionType: string, sender: Sender): void {
  senders.set(actionType, sender);
}

export interface SyncOutcome {
  sent: number;
  /** Wajah ke sath ruk gayin -- ab insan ki nazar chahiye. */
  stopped: number;
  /** Network nahi mila -- koshish agli dafa. */
  waiting: number;
}

/**
 * Network hai ya nahi.
 *
 * `navigator.onLine` sirf itna batata hai ke device kisi network se
 * juda hai -- wo network internet tak pahunchta hai ya nahi, ye us se
 * maloom nahi hota. Gaon mein signal ki teen lakeerein hoti hain aur
 * data phir bhi nahi chalta. Is liye ise sirf "yaqeeni nahi" ke liye
 * istemal karte hain: jab ye kehta hai ke offline hai, tab waqai
 * offline hai. Us ke ulte par bharosa nahi.
 */
function definitelyOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

export async function syncQueue(): Promise<SyncOutcome> {
  const out: SyncOutcome = { sent: 0, stopped: 0, waiting: 0 };
  if (definitelyOffline()) {
    out.waiting = (await pendingActions()).length;
    return out;
  }

  const queue = await pendingActions();
  for (let i = 0; i < queue.length; i += BATCH) {
    const batch = queue.slice(i, i + BATCH);
    for (const action of batch) {
      const sender = senders.get(action.action_type);
      if (!sender) {
        // Aisi qatar jise bhejne wala hi koi nahi -- ye code ki ghalti
        // hai. Chup chaap qatar mein rakhne se wo hamesha "pending"
        // dikhti rehti aur kabhi jati nahi.
        await markNeedsAttention(action.client_action_id, `Is qism ka koi raasta nahi: ${action.action_type}`);
        out.stopped += 1;
        continue;
      }

      await markSyncing(action.client_action_id);
      const shots = await evidenceFor(action.client_action_id);
      const result = await sender(
        action,
        shots.map((s) => ({ blob: s.blob, slot: s.slot, mime: s.mime }))
      );

      if (result.ok) {
        await markSynced(action.client_action_id);
        out.sent += 1;
      } else if (result.retryable) {
        await markRetryable(action.client_action_id, action.retry_count, result.error);
        out.waiting += 1;
        // Network gaya hua hai to baqi qatar par waqt zaya nahi karte.
        if (definitelyOffline()) return out;
      } else {
        await markNeedsAttention(action.client_action_id, result.error);
        out.stopped += 1;
      }
    }
  }
  return out;
}

/**
 * Server action ko bhejne ka aam raasta.
 *
 * Jo bhi cheez `{ error }` lauta de, wo SERVER ka jawab hai -- yani
 * dobara bhejne se kuch nahi badlega. Jo cheez phenk de (exception),
 * wo raaste ki nakaami hai -- network, timeout, ya server ka gir jana:
 * us par dobara koshish banti hai.
 */
export function formSender(
  run: (fd: FormData) => Promise<{ error?: string; success?: boolean }>,
  build: (action: QueuedAction, evidence: Array<{ blob: Blob; slot: string; mime: string }>) => FormData
): Sender {
  return async (action, evidence) => {
    try {
      const fd = build(action, evidence);
      const res = await run(fd);
      if (res?.error) return { ok: false, retryable: false, error: res.error };
      return { ok: true };
    } catch (e) {
      return {
        ok: false,
        retryable: true,
        error: e instanceof Error ? e.message : "Network tak baat nahi pahunchi.",
      };
    }
  };
}

/** Safhe par dikhane ke liye -- kitni qatarein kis haal mein hain. */
export async function syncSummary() {
  const rows = await allActions();
  return {
    pending: rows.filter((r) => r.sync_status === "pending").length,
    syncing: rows.filter((r) => r.sync_status === "syncing").length,
    needsAttention: rows.filter((r) => r.sync_status === "needs_attention"),
    total: rows.length,
  };
}
