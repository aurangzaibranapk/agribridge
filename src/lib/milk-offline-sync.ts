import { queueAll, queueRemove, queueMarkError, type QueuedItem } from "@/lib/offline-queue";

/**
 * Device par rukhi entries server tak pahunchana.
 *
 * Ek baar mein poora dher nahi bhejte -- gaon ke network par bara
 * paighaam beech mein toot jata hai aur poora dobara bhejna parta hai.
 * Chhote guchhon mein bhejne se jo pahunch gaya wo pahunch gaya.
 *
 * Do tarah ki nakaami mein farq rakha gaya hai, jaan boojh kar:
 *
 *   Network ki nakaami  -- entry device par rehti hai, agli dafa khud
 *                          chali jayegi. Ye ghalti nahi, intezar hai.
 *   Server ki nakaami   -- server ne wajah batayi (jaise kisan ka code
 *                          ghalat). Ise dobara bhejne ka koi fayda
 *                          nahi; entry rukti hai aur MCA ko wajah ke
 *                          sath dikh jati hai.
 *
 * Agar dono ko ek jaisa samajhte to ghalat code wali entry hamesha ke
 * liye qatar mein baithi rehti aur har baar nakaam hoti -- aur MCA ko
 * kabhi pata na chalta ke masla kya hai.
 */

const BATCH = 10;

export interface SyncOutcome {
  sent: number;
  failed: number;
  /** Network hi nahi mila -- koshish agli dafa. */
  offline: boolean;
}

export async function syncQueue(): Promise<SyncOutcome> {
  const all = await queueAll();
  const pending = all.filter((item) => !item.error);
  if (pending.length === 0) return { sent: 0, failed: 0, offline: false };

  let sent = 0;
  let failed = 0;

  for (let index = 0; index < pending.length; index += BATCH) {
    const batch = pending.slice(index, index + BATCH);

    let data: { results?: Array<{ client_uuid?: string; ok?: boolean; error?: string }> };
    try {
      const response = await fetch("/api/milk/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: "offline", items: batch.map(toPayload) }),
      });

      if (response.status === 401 || response.status === 403) {
        // Login khatam ho gaya. Entries device par mahfooz rehti hain --
        // MCA dobara login karega to khud chali jayengi.
        return { sent, failed, offline: true };
      }

      data = await response.json();
      if (!response.ok) return { sent, failed, offline: true };
    } catch {
      return { sent, failed, offline: true };
    }

    for (const result of data.results ?? []) {
      if (!result.client_uuid) continue;
      if (result.ok) {
        await queueRemove(result.client_uuid);
        sent += 1;
      } else {
        await queueMarkError(result.client_uuid, result.error ?? "Server ne qabool nahi kiya.");
        failed += 1;
      }
    }
  }

  return { sent, failed, offline: false };
}

function toPayload(item: QueuedItem) {
  return {
    client_uuid: item.client_uuid,
    farmer_id: item.farmer_id,
    farmer_code: item.farmer_code,
    liters: item.liters,
    lr: item.lr,
    shift: item.shift,
    collected_at: item.collected_at,
    entry_date: item.collected_at.slice(0, 10),
    lr_image_base64: item.lr_image_base64,
    lr_image_mime: item.lr_image_mime,
  };
}
