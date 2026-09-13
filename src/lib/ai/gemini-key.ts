/**
 * Gemini ki chabi -- ek jagah se.
 *
 * Is project mein do naam chalte rahe: `GEMINI_API_KEY` (bill reader,
 * maal andar, gaari ki tasveer, fasal doctor, lagat ka andaza) aur
 * `BRIDGE_AI_GEMINI_API_KEY` (Bridge AI chat, kisan AI, investor AI).
 * Chabi ek hi hai; sirf naam do hain.
 *
 * 4 September ko Live par yehi baat pakRi gayi: `BRIDGE_AI_...` laga
 * hua tha aur doosra nahi -- to chat chal rahi thi magar bill reader
 * chup chaap nakaam ho raha tha. Safha keh raha tha "GEMINI_API_KEY na
 * laga ho", aur wo sach keh raha tha, magar admin ke liye wo do naamon
 * ka farq samajhna mushkil tha.
 *
 * Ab dono naam qabool hain. Ek lagi ho to kaam chalta hai. Do naamon ko
 * ek jagah se parhna is ghalti ko dobara hone se rokta hai -- har file
 * mein alag alag likhne se ek jagah theek aur doosri ghalat reh jati
 * hai.
 */
export function geminiApiKey(): string | undefined {
  return process.env.GEMINI_API_KEY || process.env.BRIDGE_AI_GEMINI_API_KEY || undefined;
}
