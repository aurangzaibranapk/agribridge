/** POS khulte waqt default dukaan. DB ke baghair. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  KISAAN_KARYANA_MAHABALI_SHOP_ID,
  isKisaanKaryanaMahabali,
  pickPosCounter,
  sortPosCounters,
  type PosCounterChoice,
} from "../src/lib/pos/default-counter";

let n = 0;
const test = (name: string, fn: () => void) => {
  fn();
  n += 1;
  console.log("ok", name);
};

const DUKAN = "e6b4df10-4eb7-4445-a08f-65be18f04946";
const KARYANA = KISAAN_KARYANA_MAHABALI_SHOP_ID;
const NB = "7c26257e-335f-4493-85c2-bc9b3cdb02da";

const dukan: PosCounterChoice = {
  id: "5accbf98-2818-4ae3-850d-9ef54bcbbfbd",
  name: "Dukan POS-01",
  shopId: DUKAN,
  shopName: "Kisaan Dukan Mahabali",
  shopCode: "01",
};
const karyana: PosCounterChoice = {
  id: "38b8acef-9879-4c63-8f1a-16a378172987",
  name: "Karyana POS-01",
  shopId: KARYANA,
  shopName: "Kisaan Karyana Mahabali",
  shopCode: "03",
};
const karyana2: PosCounterChoice = {
  id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  name: "Karyana POS-02",
  shopId: KARYANA,
  shopName: "Kisaan Karyana Mahabali",
  shopCode: "03",
};
const nb: PosCounterChoice = {
  id: "48fac66a-f0f8-4061-8c6b-7b9fd05d0e80",
  name: "Karyana POS-02",
  shopId: NB,
  shopName: "Kisaan Kryana 157 NB",
  shopCode: "KC002",
};

const all = [dukan, nb, karyana];

test("157 NB Karyana Mahabali nahi", () => {
  assert.equal(isKisaanKaryanaMahabali({ id: NB, name: "Kisaan Kryana 157 NB", code: "KC002" }), false);
  assert.equal(isKisaanKaryanaMahabali({ id: DUKAN, name: "Kisaan Dukan Mahabali", code: "01" }), false);
  assert.equal(isKisaanKaryanaMahabali({ id: KARYANA, name: "Kisaan Karyana Mahabali", code: "03" }), true);
  assert.equal(isKisaanKaryanaMahabali({ id: "testing-id", name: "Kisan Karyana Mahabali" }), true);
  assert.equal(
    isKisaanKaryanaMahabali({ id: "testing-id", name: "Kisaan Karyana Mahabali Shop", code: "03" }),
    true,
  );
});

test("Owner bina shift ke Karyana Mahabali", () => {
  const pick = pickPosCounter({
    counters: all,
    openShiftCounterIds: [],
    unrestricted: true,
    assignedShopId: null,
  });
  assert.equal(pick.reason, "karyana-default");
  assert.equal(pick.counterId, karyana.id);
  assert.equal(pick.preferredShopId, KARYANA);
});

test("Owner ka Dukan par khula shift Karyana ko nahi cheenta", () => {
  const pick = pickPosCounter({
    counters: all,
    openShiftCounterIds: [dukan.id],
    unrestricted: true,
    assignedShopId: DUKAN,
  });
  assert.equal(pick.counterId, karyana.id);
  assert.equal(pick.reason, "karyana-default");
});

test("Owner dono par shift khula ho to Karyana wala POS", () => {
  const pick = pickPosCounter({
    counters: [dukan, karyana, karyana2],
    openShiftCounterIds: [karyana2.id, dukan.id],
    unrestricted: true,
  });
  assert.equal(pick.counterId, karyana2.id);
});

test("?counter= Dukan, chahe Owner ho", () => {
  const pick = pickPosCounter({
    counters: all,
    openShiftCounterIds: [],
    requestedCounterId: dukan.id,
    unrestricted: true,
  });
  assert.equal(pick.reason, "requested");
  assert.equal(pick.counterId, dukan.id);
});

test("Anwar: shop Karyana, khula shift Dukan — Karyana", () => {
  const pick = pickPosCounter({
    counters: [dukan, karyana],
    openShiftCounterIds: [dukan.id],
    assignedShopId: KARYANA,
    unrestricted: false,
  });
  assert.equal(pick.reason, "assigned-shop");
  assert.equal(pick.counterId, karyana.id);
  assert.equal(pick.preferredShopId, KARYANA);
});

test("Staff shop Dukan, Karyana par shift khula — phir bhi Dukan", () => {
  const pick = pickPosCounter({
    counters: [karyana, dukan],
    openShiftCounterIds: [karyana.id],
    assignedShopId: DUKAN,
    unrestricted: false,
  });
  assert.equal(pick.counterId, dukan.id);
  assert.equal(pick.reason, "assigned-shop");
});

test("Staff shop Dukan aur wahi par shift khula — wahi POS", () => {
  const pick = pickPosCounter({
    counters: [karyana, dukan],
    openShiftCounterIds: [dukan.id],
    assignedShopId: DUKAN,
    unrestricted: false,
  });
  assert.equal(pick.counterId, dukan.id);
});

test("Staff shop 157 NB — Mahabali Karyana nahi", () => {
  const pick = pickPosCounter({
    counters: [karyana, nb],
    openShiftCounterIds: [],
    assignedShopId: NB,
    unrestricted: false,
  });
  assert.equal(pick.counterId, nb.id);
  assert.equal(pick.preferredShopId, NB);
});

test("Staff bina shop_id, khula shift usi counter par", () => {
  const pick = pickPosCounter({
    counters: [karyana, dukan],
    openShiftCounterIds: [dukan.id],
    assignedShopId: null,
    unrestricted: false,
  });
  assert.equal(pick.reason, "open-shift");
  assert.equal(pick.counterId, dukan.id);
});

test("Staff bina shop, ek hi counter", () => {
  const pick = pickPosCounter({
    counters: [dukan],
    openShiftCounterIds: [],
    unrestricted: false,
  });
  assert.equal(pick.reason, "only-counter");
  assert.equal(pick.counterId, dukan.id);
});

test("Staff ki shop counters mein nahi to khula shift", () => {
  const pick = pickPosCounter({
    counters: [dukan, karyana],
    openShiftCounterIds: [dukan.id],
    assignedShopId: "00000000-0000-0000-0000-000000000000",
    unrestricted: false,
  });
  assert.equal(pick.reason, "open-shift");
  assert.equal(pick.counterId, dukan.id);
});

test("Owner ke paas Karyana counter nahi to khula shift", () => {
  const pick = pickPosCounter({
    counters: [dukan, nb],
    openShiftCounterIds: [dukan.id],
    unrestricted: true,
  });
  assert.equal(pick.reason, "open-shift");
  assert.equal(pick.counterId, dukan.id);
});

test("Do Karyana counters, koi shift nahi — naam se pehla", () => {
  const pick = pickPosCounter({
    counters: [karyana2, karyana, dukan],
    openShiftCounterIds: [],
    unrestricted: true,
  });
  assert.equal(pick.counterId, karyana.id);
});

test("Galat ?counter= nazarandaz, phir Karyana", () => {
  const pick = pickPosCounter({
    counters: all,
    openShiftCounterIds: [dukan.id],
    requestedCounterId: "missing",
    unrestricted: true,
  });
  assert.equal(pick.counterId, karyana.id);
});

test("Chunao: kai counters, na shop na shift na admin", () => {
  const pick = pickPosCounter({
    counters: [dukan, karyana],
    openShiftCounterIds: [],
    unrestricted: false,
  });
  assert.equal(pick.reason, "none");
  assert.equal(pick.counterId, null);
});

test("Fehrist mein preferred dukaan upar", () => {
  const sorted = sortPosCounters(all, KARYANA);
  assert.equal(sorted[0].id, karyana.id);
  assert.notEqual(sorted[0].shopId, DUKAN);
});

test("POS page ab pehla khula shift default nahi maanta", () => {
  const page = readFileSync(new URL("../src/app/admin/pos/page.tsx", import.meta.url), "utf8");
  assert.match(page, /pickPosCounter\(/);
  assert.doesNotMatch(page, /openShifts\[0\]\?\.counter_id/);
  const picker = readFileSync(new URL("../src/components/pos/counter-shift-picker.tsx", import.meta.url), "utf8");
  assert.match(picker, /initialCounterId/);
});

console.log(`\n${n} tests passed`);
