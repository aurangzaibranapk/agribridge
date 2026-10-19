import type { ConversationRow, MessageRow, Party360, TemplateRow } from "./model";
/** Sirf preview / screenshot ke liye NAMOONA data. Asal data se koi rishta nahi. */
const NOW = Date.parse("2026-10-19T17:30:00Z");
const ago = (min: number) => new Date(NOW - min * 60000).toISOString();
const c = (o: Partial<ConversationRow> & Pick<ConversationRow, "id" | "title" | "party_kind">): ConversationRow => ({
  phone_key: "3000000000", phone_display: null, farmer_id: null, customer_id: null, branch_id: null, department_key: null,
  assigned_to: null, assigned_name: null, unread_count: 0, last_inbound_at: ago(30), last_outbound_at: null, last_preview: "",
  is_naya: false, pending_since: null, stuck_with: null, window_open: true, ...o,
});
export const SAMPLE_NOW = NOW;
export const SAMPLE_CONVS: ConversationRow[] = [
  c({ id: "c1", title: "Muhammad Aslam", party_kind: "farmer", farmer_id: "f1", phone_display: "+92 300 •••• 431", unread_count: 2, last_inbound_at: ago(2), last_preview: "🎙 10 bori urea chahiye, payment gandum par", is_naya: true, pending_since: ago(50), stuck_with: "Bilal", assigned_name: "Bilal", assigned_to: "me" }),
  c({ id: "c2", title: "Malik Traders", party_kind: "customer", customer_id: "k1", unread_count: 1, last_inbound_at: ago(18), last_preview: "Bill INV-2291 ki copy bhej dein", pending_since: ago(6 * 60), stuck_with: "Anwar", assigned_name: "Anwar" }),
  c({ id: "c3", title: "+92 301 •••• 882", party_kind: "unknown", unread_count: 1, last_inbound_at: ago(41), last_preview: "Assalam o alaikum, DAP ka rate?", is_naya: true, pending_since: ago(41), stuck_with: "Bina sapurd" }),
  c({ id: "c4", title: "Ghulam Rasool", party_kind: "farmer", farmer_id: "f2", last_inbound_at: ago(60 * 50), window_open: false, last_preview: "📷 fasal par dhabbe", pending_since: ago(60 * 50), stuck_with: "agronomy", department_key: "agronomy" }),
  c({ id: "c5", title: "Anwar Ul Hassan", party_kind: "staff", last_inbound_at: ago(120), last_preview: "Cash 45,000 jama kar diya", last_outbound_at: ago(100) }),
  c({ id: "c6", title: "Haji Bashir", party_kind: "customer", last_inbound_at: ago(180), last_preview: "Payment kal kar dunga inshallah", pending_since: ago(26 * 60), stuck_with: "recovery", assigned_to: "me", assigned_name: "Recovery" }),
  c({ id: "c7", title: "+92 345 •••• 120", party_kind: "unknown", last_inbound_at: ago(300), last_preview: "🎙 Voice · 0:11" }),
  c({ id: "c8", title: "Rana Dairy", party_kind: "customer", last_inbound_at: ago(1500), last_preview: "Order status?", window_open: false }),
];
export const SAMPLE_MESSAGES: Record<string, MessageRow[]> = {
  c1: [
    { id: "m1", direction: "in", msg_type: "image", body: "Assalam o alaikum, fasal par ye dhabbe aa gaye hain", media_mime: "image/jpeg", transcript: null, ai_intent: null, ai_draft: null, send_status: null, created_at: ago(140) },
    { id: "m2", direction: "out", msg_type: "text", body: "Photo Bilal (agronomy) ko bhej di hai, aaj shaam tak mashwara.", media_mime: null, transcript: null, ai_intent: null, ai_draft: null, send_status: "sent", sent_by_name: "Anwar", created_at: ago(120) },
    { id: "m3", direction: "in", msg_type: "audio", body: null, media_mime: "audio/ogg", transcript: "Mujhe 10 bori urea chahiye, payment gandum par karunga. Aur pichla baqaya kitna hai?", ai_intent: "new_order + my_khata", ai_draft: "Walaikum assalam Aslam sahab. 10 bori Urea (Rs 4,650/bori) = Rs 46,500. Aap ka pichla baqaya Rs 38,200 hai. Order ka draft approval ke liye bhej diya hai — approve hote hi batayenge.", send_status: null, created_at: ago(2) },
  ],
  c4: [
    { id: "m4", direction: "in", msg_type: "image", body: "fasal par dhabbe", media_mime: "image/jpeg", transcript: null, ai_intent: null, ai_draft: null, send_status: null, created_at: ago(60 * 50) },
  ],
};
export const SAMPLE_PARTY: Party360 = {
  party_kind: "farmer", balance: 38200, credit_limit: 80000,
  bills: [{ ref: "INV-2287 DAP×4", amount: 19600, status: "completed", at: ago(9000) }, { ref: "INV-2190 Urea×6", amount: 27900, status: "completed", at: ago(30000) }],
  orders: [{ ref: "ORD-0231 Seed", amount: 5000, status: "delivered", at: ago(12000) }],
  season: [{ campaign: "Rabi 2026", crop: "Gandum", acres: 12, status: "confirmed" }],
  promises: [{ amount: 20000, date: "2026-10-30", status: "open" }, { amount: 10000, date: "2026-10-12", status: "broken" }],
};
export const SAMPLE_TEMPLATES: TemplateRow[] = [
  { key: "follow_up", label: "Follow-up (Urdu)", body_preview: "Assalam o alaikum {{1}}, aap ke sawal ka jawab tayyar hai. Baat karne ke liye reply karein.", param_count: 1 },
];
export const SAMPLE_STAFF = [{ id: "s1", name: "Anwar Ul Hassan" }, { id: "s2", name: "Bilal (agronomy)" }, { id: "s3", name: "Recovery desk" }];
