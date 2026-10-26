// Admin party invite — form, paigham, channel, brand. DB ke baghair.
import assert from "node:assert/strict";
import fs from "node:fs";
import { getRoleRedirectPath } from "../src/lib/utils/roles";
import {
  PREVIEW_LOGIN,
  brandProblem,
  buildInviteMessage,
  canCreatePartyInvite,
  dispatchInvite,
  inviteEmailHtml,
  loginEmailFor,
  parsePartyForm,
  partyCode,
  partyRow,
  phoneKey,
  planSend,
  previewSends,
  smsFailReason,
} from "../src/lib/party-invite";

let n = 0;
const ok = (name: string, fn: () => void | Promise<void>) => {
  const run = fn();
  if (run && typeof (run as Promise<void>).then === "function") {
    return (run as Promise<void>).then(() => {
      n += 1;
      console.log(`  ✓ ${name}`);
    });
  }
  n += 1;
  console.log(`  ✓ ${name}`);
};

const good = {
  role: "dealer",
  fullName: "Bilal Traders",
  phone: "+92 301 7654321",
  email: "bilal.traders@gmail.com",
  branchId: "branch-1",
};

async function main() {
console.log("Ijazat:");
await ok("sirf owner / super_admin / admin", () => {
  for (const role of ["owner", "super_admin", "admin"]) assert.equal(canCreatePartyInvite(role), true);
  for (const role of ["hr", "manager", "sales_staff", "farmer", "customer", "dealer", ""]) assert.equal(canCreatePartyInvite(role), false);
});

console.log("Form:");
await ok("dealer form theek", () => {
  const r = parsePartyForm(good);
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.email, "bilal.traders@gmail.com");
});
await ok("buyer, sarmayakar, vendor bhi", () => {
  for (const role of ["buyer", "investor", "machinery_vendor"]) {
    const r = parsePartyForm({ ...good, role });
    assert.equal(r.ok, true, role);
  }
});
await ok("staff role yahan nahi", () => assert.equal(parsePartyForm({ ...good, role: "hr" }).ok, false));
await ok("mobile adhoora rukta hai", () => assert.equal(parsePartyForm({ ...good, phone: "123" }).ok, false));
await ok("email khali chal jata hai", () => {
  const r = parsePartyForm({ ...good, email: "  " });
  assert.equal(r.ok, true);
  if (r.ok) assert.equal(r.value.email, null);
});
await ok("kharab email rukta hai", () => assert.equal(parsePartyForm({ ...good, email: "nahi" }).ok, false));
await ok("branch zaroori", () => assert.equal(parsePartyForm({ ...good, branchId: "" }).ok, false));
await ok("phone key aakhri 10", () => assert.equal(phoneKey("+92 301 7654321"), "3017654321"));
await ok("bina email login phone.agribridge.local", () => {
  assert.equal(loginEmailFor("3017654321", null), "3017654321@phone.agribridge.local");
  assert.equal(loginEmailFor("3017654321", "a@b.com"), "a@b.com");
});

console.log("Paigham:");
const built = buildInviteMessage({
  fullName: "Bilal Traders",
  role: "dealer",
  branchName: "Mahabali",
  phone: "+92 301 7654321",
  email: "bilal.traders@gmail.com",
  loginUrl: PREVIEW_LOGIN,
});
await ok("AgriBridge + Kisan ka Wasela, OTP, login", () => {
  assert.equal(brandProblem(built.text), null);
  assert.match(built.text, /AgriBridge/);
  assert.match(built.text, /Kisan ka Wasela/);
  assert.match(built.text, /OTP/);
  assert.match(built.text, /https:\/\/agribridge\.pk\/login/);
  assert.match(built.text, /Mahabali/);
  assert.match(built.text, /Bilal Traders/);
  assert.doesNotMatch(built.text, /al\s*rana/i);
  assert.doesNotMatch(built.text, /\bART\b/);
  assert.doesNotMatch(built.subject, /al\s*rana/i);
});
await ok("email html mein bhi brand, ART nahi", () => {
  const html = inviteEmailHtml(built.text);
  assert.match(html, /AgriBridge/);
  assert.match(html, /Kisan ka Wasela/);
  assert.doesNotMatch(html, /al\s*rana|alranatraders/i);
  assert.doesNotMatch(html, /\bART\b/);
});
await ok("ART brand rok deta hai", () => assert.ok(brandProblem("ART account")));
await ok("preview aur send ek hi text", () => {
  const plan = planSend({
    channel: "whatsapp",
    fullName: "Bilal Traders",
    role: "buyer",
    branchName: "Mahabali",
    phone: "+92 301 7654321",
    email: "bilal.traders@gmail.com",
    loginUrl: PREVIEW_LOGIN,
  });
  const again = buildInviteMessage({
    fullName: "Bilal Traders",
    role: "buyer",
    branchName: "Mahabali",
    phone: "+92 301 7654321",
    email: "bilal.traders@gmail.com",
    loginUrl: PREVIEW_LOGIN,
  });
  assert.equal(plan.ok, true);
  assert.equal(plan.text, again.text);
  assert.match(plan.text, /Buyer/);
});
await ok("email channel baghair email fail, text phir bhi", () => {
  const plan = planSend({
    channel: "email",
    fullName: "Bilal Traders",
    role: "dealer",
    branchName: "Mahabali",
    phone: "+92 301 7654321",
    email: null,
    loginUrl: PREVIEW_LOGIN,
  });
  assert.equal(plan.ok, false);
  assert.match(plan.error ?? "", /email zaroori/i);
  assert.match(plan.text, /AgriBridge/);
});
await ok("timeline fixture mein poora content aur SMS wajah", () => {
  const [wa, sms] = previewSends();
  assert.equal(wa.status, "sent");
  assert.match(wa.content, /Kisan ka Wasela/);
  assert.equal(wa.content, built.text);
  assert.equal(sms.status, "failed");
  assert.match(sms.error ?? "", /Veevo/);
  assert.equal(sms.content, built.text);
  assert.match(smsFailReason("INVALID_NUMBER"), /qabil nahi/);
});

console.log("Bhejna:");
await ok("WhatsApp sirf WhatsApp, nakaami ki wajah", async () => {
  const calls: string[] = [];
  const fail = await dispatchInvite("whatsapp", "+923017654321", built.text, null, {
    sendWhatsapp: async () => { calls.push("wa"); throw new Error("WhatsApp ki chaabi set nahi hai."); },
    sendEmail: async () => { calls.push("mail"); return { sent: true }; },
    sendSms: async () => { calls.push("sms"); return { sent: true, reason: "sent" }; },
  });
  assert.deepEqual(calls, ["wa"]);
  assert.equal(fail.ok, false);
  assert.match(fail.error ?? "", /chaabi/);
});
await ok("Email SMS par nahi girti", async () => {
  const calls: string[] = [];
  const sent = await dispatchInvite("email", "bilal.traders@gmail.com", built.text, built.subject, {
    sendWhatsapp: async () => { calls.push("wa"); },
    sendEmail: async (_to, subject, html) => {
      calls.push("mail");
      assert.match(subject, /AgriBridge/);
      assert.match(html, /Kisan ka Wasela/);
      return { sent: false, error: "Email nahi ja saki: password darj nahi." };
    },
    sendSms: async () => { calls.push("sms"); return { sent: true, reason: "sent" }; },
  });
  assert.deepEqual(calls, ["mail"]);
  assert.match(sent.error ?? "", /password/);
});
await ok("SMS WhatsApp par nahi girti", async () => {
  const calls: string[] = [];
  const sent = await dispatchInvite("sms", "+923017654321", built.text, null, {
    sendWhatsapp: async () => { calls.push("wa"); },
    sendEmail: async () => { calls.push("mail"); return { sent: true }; },
    sendSms: async () => { calls.push("sms"); return { sent: false, reason: "SMS provider not configured yet." }; },
  });
  assert.deepEqual(calls, ["sms"]);
  assert.match(sent.error ?? "", /Veevo/);
});

console.log("Party row:");
await ok("dealer / buyer / investor / vendor alag table", () => {
  const base = { userId: "u1", organizationId: "o1", fullName: "Bilal Traders", phone: "+92 301 7654321", code: partyCode("dealer", 1_700_000_000_000, "ab12"), createdBy: "admin" };
  const dealer = partyRow({ ...base, role: "dealer" });
  assert.equal(dealer.business_name, "Bilal Traders");
  assert.equal(dealer.dealer_code, base.code);
  assert.equal("email" in dealer, false);
  const buyer = partyRow({ ...base, role: "buyer", code: "BUY-1" });
  assert.equal(buyer.buyer_code, "BUY-1");
  const investor = partyRow({ ...base, role: "investor", code: "INV-1" });
  assert.equal(investor.full_name, "Bilal Traders");
  const vendor = partyRow({ ...base, role: "machinery_vendor" });
  assert.equal(vendor.vendor_name, "Bilal Traders");
  assert.equal(vendor.phone, base.phone);
});
await ok("dealer login /dealer, vendor /vendor, buyer customer /portal/c", () => {
  assert.equal(getRoleRedirectPath("dealer"), "/dealer");
  assert.equal(getRoleRedirectPath("machinery_vendor"), "/vendor");
  assert.equal(getRoleRedirectPath("customer"), "/portal/c");
  assert.equal(getRoleRedirectPath("farmer"), "/portal/dashboard");
});

console.log("Wiring:");
const action = fs.readFileSync("src/actions/party-invite.ts", "utf8");
const signup = fs.readFileSync("src/actions/farmer-signup.ts", "utf8");
await ok("public signup file is action se nahi judi", () => {
  assert.match(action, /^"use server";/);
  assert.match(action, /buildInviteMessage|planSend/);
  assert.match(action, /content: plan\.text/);
  assert.doesNotMatch(action, /farmer-signup|register\/farmer|organization-signup|inviteUserByEmail/);
  assert.doesNotMatch(signup, /party-invite|party_invite/);
});
await ok("screen par ART nahi", () => {
  const ui = fs.readFileSync("src/app/admin/hr/users/invite-client.tsx", "utf8");
  assert.match(ui, /Dekhein/);
  assert.match(ui, /WhatsApp pe bhejein/);
  assert.match(ui, /Account banayein/);
  assert.doesNotMatch(ui, /al\s*rana/i);
  assert.doesNotMatch(ui, /\bART\b/);
});

console.log(`\n${n} checks passed`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
