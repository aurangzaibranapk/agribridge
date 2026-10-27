import assert from "node:assert/strict";
import fs from "node:fs";
import { buildIdCardPdf } from "../src/lib/hr/id-card-pdf";
import {
  cardMessage,
  hireStaffPatch,
  mailtoUrl,
  mergeIdCard,
  pkWhatsAppDigits,
  whatsAppUrl,
} from "../src/lib/hr/id-card-profile";

const card = mergeIdCard({
  fullName: "M Usama Saleem",
  designation: "Milk Collection Officer & Karyana Staff",
  branchName: "2nd Branch 157 Na",
  staffPhone: null,
  staffCnic: null,
  staffPhoto: null,
  staffBlood: null,
  staffEmergencyName: null,
  staffEmergencyPhone: null,
  applicationPhone: "03037694656",
  applicationCnic: "38405-0000000-1",
  applicationBlood: null,
});
assert.equal(card.phone, "03037694656");
assert.equal(card.cnic, "38405-0000000-1");
assert.equal(card.bloodGroup, null);
assert.equal(card.photoUrl, null);
assert.equal(card.designation.includes("Milk Collection"), true);
assert.equal(pkWhatsAppDigits(card.phone), "923037694656");

const text = cardMessage(card, "Darj nahi");
assert.match(text, /03037694656/);
assert.match(text, /38405-0000000-1/);
assert.match(text, /Blood group: Darj nahi/);
assert.match(text, /Emergency: Darj nahi/);
assert.equal(whatsAppUrl(card.phone, text).startsWith("https://wa.me/923037694656?text="), true);
assert.equal(mailtoUrl(card.fullName, text).startsWith("mailto:?subject="), true);
assert.match(decodeURIComponent(mailtoUrl(card.fullName, text)), /38405-0000000-1/);

assert.equal(mergeIdCard({ staffBlood: "B positive", applicationBlood: "O+" }).bloodGroup, "B positive");
assert.equal(mergeIdCard({ staffBlood: null, applicationBlood: "O positive" }).bloodGroup, "O+");
assert.equal(mergeIdCard({ staffPhone: "03001112222", applicationPhone: "03037694656" }).phone, "03001112222");
assert.equal(mergeIdCard({ staffPhone: null, whatsappNumber: "03001234567", applicationPhone: "03037694656" }).phone, "03001234567");

const fresh = hireStaffPatch(null, {
  id: "a29c9397-56c3-4e65-a42e-aa4182768f5f",
  phone: "03037694656",
  cnic: "38405-0000000-1",
  blood_group: "O+",
  emergency_contact_name: "Abid",
  emergency_contact_phone: "03001112222",
  photo_url: "https://example.com/photo.jpg",
}, { id: "5d2cb48a-2fff-4510-a378-aec1f1816a80", status: "accepted", designation: "MCO", proposed_salary: 25000 });
assert.equal(fresh.phone, "03037694656");
assert.equal(fresh.cnic, "38405-0000000-1");
assert.equal(fresh.blood_group, "O+");
assert.equal(fresh.emergency_contact_name, "Abid");
assert.equal(fresh.photo_url, "https://example.com/photo.jpg");
assert.equal(fresh.application_id, "a29c9397-56c3-4e65-a42e-aa4182768f5f");
assert.equal(fresh.offer_id, "5d2cb48a-2fff-4510-a378-aec1f1816a80");
assert.equal(fresh.designation, "MCO");

const kept = hireStaffPatch(
  { phone: "03009998888", cnic: "11111-1111111-1", blood_group: "A+", designation: "Already set" },
  { id: "app-1", phone: "03037694656", cnic: "38405-0000000-1", blood_group: "O+" },
  { id: "offer-2", status: "pending", designation: "New", proposed_salary: 1 },
);
assert.equal(kept.phone, undefined);
assert.equal(kept.cnic, undefined);
assert.equal(kept.blood_group, undefined);
assert.equal(kept.designation, undefined);
assert.equal(kept.application_id, "app-1");
assert.equal("offer_id" in kept, false);

const pdf = buildIdCardPdf(card, "blue", "Darj nahi", null);
assert.equal(Buffer.from(pdf.subarray(0, 5)).toString(), "%PDF-");

const client = fs.readFileSync("src/app/admin/hr/id-card/[profileId]/id-card-client.tsx", "utf8");
assert.match(client, /print-color-adjust: exact/);
assert.match(client, /window\.print\(\)/);
assert.match(client, /buildIdCardPdf/);
assert.match(client, /whatsAppUrl/);
assert.match(client, /mailtoUrl/);
assert.doesNotMatch(client, /text\/plain/);
assert.match(client, /id="staff-id-print"/);

const page = fs.readFileSync("src/app/admin/hr/id-card/[profileId]/page.tsx", "utf8");
assert.match(page, /mergeIdCard/);
assert.match(page, /job_applications/);
assert.match(page, /applicationPhone/);

const migration = fs.readFileSync("supabase/migrations/720_id_card_application_fields.sql", "utf8");
assert.match(migration, /add column if not exists blood_group/);
assert.match(migration, /emergency_contact_name/);
assert.match(migration, /photo_url/);
assert.match(migration, /coalesce\(nullif\(btrim\(sd\.phone\), ''\), c\.phone\)/);
assert.match(migration, /coalesce\(nullif\(btrim\(sd\.cnic\), ''\), c\.cnic\)/);
assert.match(migration, /created_profile_id/);
const rollback = fs.readFileSync("supabase/migrations/720_id_card_application_fields.rollback.sql", "utf8");
assert.match(rollback, /drop column if exists blood_group/);
assert.doesNotMatch(rollback, /update public\.staff_details/i);

const form = fs.readFileSync("src/app/(site)/careers/apply-form.tsx", "utf8");
assert.match(form, /name="blood_group"/);
assert.match(form, /name="emergency_contact_name"/);
assert.match(form, /name="emergency_contact_phone"/);
assert.match(form, /name: "photo"/);

console.log("id card profile ok");
