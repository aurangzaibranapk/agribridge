import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { BANNED_PUBLIC_WORDS, DAIRY_PRODUCTS, buildBulkOrderText, faqJsonLd, productJsonLd, whatsappLink } from "../src/lib/dairy-public/offer";

// prices
const milk = DAIRY_PRODUCTS.find((p) => p.id === "doodh-13-ts")!;
assert.deepEqual(milk.offers.map((o) => [o.city, o.price, o.unitCode]), [["Lahore", 200, "LTR"], ["Islamabad", 230, "LTR"]]);
assert.equal(DAIRY_PRODUCTS.find((p) => p.id === "desi-ghee")!.offers[0].price, 4000);
assert.equal(DAIRY_PRODUCTS.find((p) => p.id === "desi-anday")!.offers[0].price, 30);

// whatsapp link
assert.equal(whatsappLink(), "https://wa.me/923226275476");
const t = buildBulkOrderText({ name: "Ali\u0007", city: "Lahore", milkLitresPerDay: "300", business: "" });
assert.ok(t.includes("Naam: Ali") && t.includes("Doodh (litre rozana): 300") && !t.includes("Karobar"));
const link = whatsappLink(t);
assert.ok(link.startsWith("https://wa.me/923226275476?text="));
assert.equal(decodeURIComponent(link.split("?text=")[1]), t);

// schema
const ld = productJsonLd("https://alranatraders.pk/dairy");
assert.equal(ld.length, 3);
for (const p of ld) for (const o of p.offers) assert.equal(o.priceCurrency, "PKR");
assert.ok(!JSON.stringify(ld).includes("aggregateRating"));
assert.equal(faqJsonLd()["@type"], "FAQPage");

// pages: no local names, no health claims, lang ur, no fetch/DB in form
const files = [
  "src/app/(site)/bulk-order/page.tsx",
  "src/components/site/dairy/product-card.tsx",
  "src/components/site/dairy/bulk-order-form.tsx",
  "src/lib/dairy-public/offer.ts",
];
const dairyPage = readFileSync("src/app/(site)/dairy/page.tsx", "utf8");
const newDairy = dairyPage.slice(0, dairyPage.indexOf("const SERVICES")) + dairyPage.slice(dairyPage.indexOf("export default function DairyPage"), dairyPage.indexOf("Kisanon ke liye"));
for (const [name, src] of [...files.map((f) => [f, readFileSync(f, "utf8")]), ["dairy(new part)", newDairy]] as [string, string][]) {
  const body = src.replace(/export const BANNED_PUBLIC_WORDS[\s\S]*?\];/, "").toLowerCase();
  for (const w of BANNED_PUBLIC_WORDS) assert.ok(!body.includes(w), `${name} contains banned word ${w}`);
}
const form = readFileSync("src/components/site/dairy/bulk-order-form.tsx", "utf8");
assert.ok(!/fetch\(|supabase|axios|action=/.test(form), "form must not send/save anything");
assert.ok(readFileSync("src/components/site/dairy/urdu.tsx", "utf8").includes('lang="ur"'));
const sm = readFileSync("src/app/sitemap.ts", "utf8");
assert.ok(sm.includes("/dairy`") && sm.includes("/bulk-order`"));
for (const src of [dairyPage, readFileSync(files[0], "utf8")]) {
  const title = src.match(/title: "([^"]+)"/)![1];
  assert.ok(title.length <= 65, title);
}
assert.ok(readFileSync("src/components/site/dairy/product-card.tsx", "utf8").includes("data-photo-placeholder"));
console.log("dairy-public-pages: all tests passed");
