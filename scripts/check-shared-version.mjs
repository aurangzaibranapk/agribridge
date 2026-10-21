import { readFileSync } from "node:fs";

const version = readFileSync(new URL("../VERSION", import.meta.url), "utf8").trim();
const portal = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")).version;
const mobile = JSON.parse(readFileSync(new URL("../apps/mobile/package.json", import.meta.url), "utf8")).version;
const appConfig = readFileSync(new URL("../apps/mobile/app.config.ts", import.meta.url), "utf8");
const product = readFileSync(new URL("../src/lib/product-version.ts", import.meta.url), "utf8");

if (version !== portal || version !== mobile) {
  console.error(`Shared version mismatch. VERSION=${version} portal=${portal} mobile=${mobile}`);
  process.exit(1);
}
if (!product.includes('join(process.cwd(), "VERSION")') || !appConfig.includes('join(__dirname, "../../VERSION")')) {
  console.error("Portal and Expo versions must be read from the VERSION file.");
  process.exit(1);
}
if (!appConfig.includes('raw === "debug"') || !appConfig.includes('return "production"')) {
  console.error("APP_CHANNEL must fail closed to production unless it is debug or internal.");
  process.exit(1);
}
console.log(`shared version ${version}`);
